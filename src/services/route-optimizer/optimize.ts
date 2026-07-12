/**
 * Orchestrator — runs Stages A→F and returns best + 2 alternates.
 *
 * DB-free: the controller injects
 *   - resolved `nodes` (Stage A already done, incl. custom-stop coords)
 *   - `pool`: for each ordered pair "from||to", the curated LegOption[] (may be a
 *     single road option produced from OSRM). Pairs absent from the pool are
 *     treated as road with a large cost so the sequencer still connects them.
 *
 * Sequencing uses a scalar cost matrix reduced from the pool under the objective.
 * After ordering, each consecutive pair's best option is chosen, the weekday lock
 * is resolved from the weekday-limited legs, days are expanded with that lock, the
 * plan is scored, and guardrails attach the verify list.
 */

import type { CityNode, LegOption, OptimizeInput, OptimizeResult, Plan, Objective, MapRoute, MapRouteLeg, Mode } from './types';
import type { PlanContract } from './intent';
import { isTrueOvernight } from './constraints';
import { sequence } from './sequence';
import { expandDays } from './dayExpand';
import { resolveWeekdayLock, type WeekdayConstrainedLeg, phaseShift, type PhaseShiftResult } from './constraints';
import { scorePlan, toTotals } from './score';
import { verifyList } from './guardrails';
import { fmtDuration } from './geo';
import { ddcv, ddcvScalar, weightsForObjective, type LegCtx, type Weights } from './ddcv';
import { applyTPP } from './tpp';
import { buildLegExplain } from './explain';
import { toleranceForProfile, type Tolerance } from './physiology';
import { hybridAccessHours } from './fallback';
import type { AnchorCandidate } from './anchors';
import { runFatigueLedger, dayLoadsFromDays, projectComfort, rhythmHeadline } from './fatigue';
import { buildArchetypes } from './archetypes';
import { negotiate, needsNegotiation } from './negotiate';

const legKey = (a: string, b: string) => `${a}||${b}`;
const BIG = 1e7;

// Default door-to-door access hours per mode when no city transport profile is
// loaded (Sprint 1). Precise per-node access (airport/railhead transfer km) is the
// §4.5 airport-as-via-node hook that Sprint 2 fills in.
const ACCESS = { RAIL: { from: 0.75, to: 0.75 }, AIR: { from: 1.5, to: 1.0 } } as const;
const DEFAULT_TOL: Tolerance = toleranceForProfile(undefined);
function legCtx(o: LegOption, tol: Tolerance, pax: number, month?: number, contract?: PlanContract): LegCtx {
  const a = o.mode === 'RAIL' ? ACCESS.RAIL : o.mode === 'AIR' ? ACCESS.AIR : { from: 0, to: 0 };
  // §4.6 rung 2: a rail+road hybrid folds its onward Band-A road transfer into
  // door-to-door access so the DDCV charges the extra hours + taxi honestly (a far
  // drop railhead loses to a nearer one, exactly like a far airport).
  const hyb = hybridAccessHours(o);
  // Sprint 7: his contract rides with every leg. It can only TIGHTEN this party's gates.
  return { tol, pax, month, accessFromHrs: a.from, accessToHrs: a.to + hyb.hrs, accessCostPp: hyb.costPp, tighten: contract?.tighten };
}

/**
 * US-604 — THE CANDIDATE FILTER, and the flag that lied.
 *
 * The old line said:
 *     usable = opts.filter(o => opts2?.overnightTrains === false ? !(o.mode === 'RAIL') : true)
 * A traveller who says "no overnight trains" is not saying "no trains". That filter threw
 * away the pleasant 10 a.m. Shatabdi along with the 03:50 sleeper — the flag was named for
 * overnights and behaved like a blanket ban on rail. Fixed: it now removes the OVERNIGHT,
 * which is the thing he refused.
 *
 * And his refusals (Law 1) enter here, as a filter rather than a weight, because a weight
 * can be outvoted and a brief cannot.
 *
 * ONE HONEST LIMIT, stated out loud: if the filter would empty a leg's candidate set, we
 * do NOT invent a service and we do NOT silently hand him back the thing he refused. The
 * pool is returned intact, the leg is marked, and the consultant fallback (US-607) is the
 * one allowed to speak — with a finding, a reason, and a named alternative (Law 4).
 */
export interface UsableOpts {
  overnightTrains?: boolean;
  preferDaily?: boolean;
  dailyOnly?: boolean;
  contract?: PlanContract;
}

export function usableOptions(opts: LegOption[], o2?: UsableOpts): { usable: LegOption[]; refusedAll: boolean } {
  const banned = new Set<Mode>(o2?.contract?.filters.banModes ?? []);
  const noOvernight = o2?.overnightTrains === false || !!o2?.contract?.filters.banOvernightRail;

  let usable = opts.filter((o) => !banned.has(o.mode));
  // the fix: the overnight, not the mode.
  if (noOvernight) usable = usable.filter((o) => !isTrueOvernight(o));

  // His word removed everything this leg had. That is not a licence to overrule him in
  // silence — it is the moment the consultant is supposed to speak.
  const refusedAll = usable.length === 0 && opts.length > 0;

  if (o2?.dailyOnly) {
    const daily = usable.filter((o) => (o.operatingDays ?? 127) === 127);
    if (daily.length) usable = daily;
  }
  return { usable, refusedAll };
}

export interface OptimizeDeps {
  nodes: CityNode[];
  pool: Map<string, LegOption[]>;
  /** names that are inserted en-route halts (for day labelling). */
  haltNames?: Set<string>;
  /** force daily-only services (the date-flexible alternate). */
  dailyOnly?: boolean;
  /** §4.4 candidate anchors per leg key (from||to), for pearl-split reasoning. */
  anchorsByLeg?: Map<string, AnchorCandidate[]>;
}

/**
 * Indicative per-person fare (₹) when no real fare is in the pool. Rough India
 * economics so COST can actually rank modes: train (AC) cheapest, road next,
 * flight most expensive with a floor. Replaced by real fares when a source lands.
 */
export function estCostPp(o: LegOption): number {
  if (o.farePpMin != null && o.farePpMax != null) return (o.farePpMin + o.farePpMax) / 2;
  const km = o.distanceKm ?? 400;
  switch (o.mode) {
    case 'AIR': return Math.max(2500, Math.round(km * 5));
    case 'RAIL': return Math.round(km * 1.2) + 150;   // 3A AC ballpark
    case 'FERRY': return Math.round(km * 3);
    default: return Math.round(km * 4);               // road, per-pax share
  }
}

/** scalarize one option to a comparable cost under the objective (lower = better).
 *  preferDaily: when the travel date is unknown, penalise non-daily services so the
 *  plan stays date-flexible unless nothing daily exists. */
function optionCost(o: LegOption, obj: Objective, pax: number, preferDaily = false, tol: Tolerance = DEFAULT_TOL, month?: number, w?: Weights, contract?: PlanContract): number {
  // ALL mode comparisons now run on the Door-to-Door Cost Vector (spec §4.1): raw
  // durations never compete. A body-truth hard-blocked option (over hour cap,
  // chronotype breach, class-floor fail) is strongly deprioritised for LIVE
  // sequencing but still connects the graph — dayExpand surfaces the infeasibility.
  const nonDaily = preferDaily && o.operatingDays != null && o.operatingDays !== 127;
  const penalty = nonDaily ? 40 : 0;
  const scalar = ddcvScalar(ddcv(o, legCtx(o, tol, pax, month, contract)), w ?? weightsForObjective(obj));
  const base = Number.isFinite(scalar) ? scalar : 1e6;
  return base + penalty;
}

function bestOption(opts: LegOption[] | undefined, obj: Objective, pax: number, opts2?: UsableOpts, tol: Tolerance = DEFAULT_TOL, month?: number, w?: Weights): LegOption | undefined {
  if (!opts || !opts.length) return undefined;
  const { usable } = usableOptions(opts, opts2);
  const pick = (usable.length ? usable : opts).slice().sort((a, b) => optionCost(a, obj, pax, opts2?.preferDaily, tol, month, w, opts2?.contract) - optionCost(b, obj, pax, opts2?.preferDaily, tol, month, w, opts2?.contract));
  return pick[0];
}

/** Rank a leg's candidate options best→worst under the objective, mirroring
 *  bestOption's usable-filter EXACTLY so ranked[0] === the chosen option. This is
 *  what lets the §10 decision record name a truthful winner + runner-up.
 *  (The two used to keep their own copies of the filter. One filter now — a rule that
 *  lives in two places is a rule that will one day disagree with itself.) */
function rankLegOptions(opts: LegOption[] | undefined, obj: Objective, pax: number, opts2?: UsableOpts, tol: Tolerance = DEFAULT_TOL, month?: number, w?: Weights): LegOption[] {
  if (!opts || !opts.length) return [];
  const { usable } = usableOptions(opts, opts2);
  const pool = usable.length ? usable : opts;
  return pool.slice().sort((a, b) => optionCost(a, obj, pax, opts2?.preferDaily, tol, month, w, opts2?.contract) - optionCost(b, obj, pax, opts2?.preferDaily, tol, month, w, opts2?.contract));
}

function buildMatrix(names: string[], deps: OptimizeDeps, obj: Objective, pax: number, preferDaily = false, tol: Tolerance = DEFAULT_TOL, month?: number, w?: Weights, contract?: PlanContract): number[][] {
  const n = names.length;
  const m: number[][] = Array.from({ length: n }, () => new Array(n).fill(BIG));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j) { m[i][j] = 0; continue; }
    const best = bestOption(deps.pool.get(legKey(names[i], names[j])), obj, pax, { preferDaily, contract }, tol, month, w);
    m[i][j] = best ? optionCost(best, obj, pax, preferDaily, tol, month, w, contract) : BIG;
  }
  return m;
}

function mapRoute(names: string[], chosen: Map<string, LegOption>, nodes: Map<string, CityNode>): MapRoute {
  const stops = names.map((nm, i) => {
    const c = nodes.get(nm)?.coord;
    return { order: i + 1, name: nm, day: i + 1, lat: c ? c[0] : null, lng: c ? c[1] : null };
  });
  const legs: MapRouteLeg[] = [];
  for (let i = 1; i < names.length; i++) {
    const o = chosen.get(legKey(names[i - 1], names[i]));
    const mode = o?.mode === 'AIR' ? 'flight' : o?.mode === 'RAIL' ? 'train' : o?.mode === 'FERRY' ? 'ferry' : 'road';
    legs.push({ day: i + 1, from: names[i - 1], to: names[i], mode, km: o?.distanceKm ?? null, timeText: fmtDuration(o?.durationMin), estimated: o?.source === 'osrm' || o?.source === 'haversine' });
  }
  const roadTotalKm = legs.filter((l) => l.mode === 'road' && l.km).reduce((a, l) => a + (l.km || 0), 0);
  return { stops, legs, roadTotalKm: Math.round(roadTotalKm), modes: Array.from(new Set(legs.map((l) => l.mode))) };
}

function buildPlan(order: number[], names0: string[], input: OptimizeInput, deps: OptimizeDeps, label: string): Plan {
  const names = order.map((i) => names0[i]);
  const nodeMap = new Map(deps.nodes.map((n) => [n.name.toLowerCase(), n] as const));
  const nights = new Map(input.cities.map((c) => [c.name, c.nights ?? 1] as const));
  const pax = input.pax ?? 2;
  const tol = toleranceForProfile(input.profile);
  const month = input.month;

  // choose best option per consecutive pair. When no travel date is set, prefer
  // daily services so the plan is date-flexible; date-flexible alternate forces it.
  const preferDaily = input.startWeekday == null;
  const chosen = new Map<string, LegOption>();
  const chosenList: LegOption[] = [];
  // §10: rank each leg's options once (same objective ordering the sequencer uses),
  // keep ranked[0] as the chosen option, and retain the ranking for decision records.
  const explainByLeg = new Map<string, ReturnType<typeof buildLegExplain>>();
  // §14.5 the DDCV weight vector, rescaled by the traveller's psyche (w' = w ∘ M(TPP)).
  // Absent TPP = the objective weights unchanged (v1.0 behaviour). Hard gates untouched.
  const w = applyTPP(weightsForObjective(input.objective), input.tpp);
  for (let i = 1; i < names.length; i++) {
    const key = legKey(names[i - 1], names[i]);
    const ranked = rankLegOptions(deps.pool.get(key), input.objective, pax, { overnightTrains: input.overnightTrains, preferDaily, dailyOnly: deps.dailyOnly, contract: input.contract }, tol, month, w);
    if (ranked.length) {
      const opt = ranked[0];
      chosen.set(key, opt); chosenList.push(opt);
      explainByLeg.set(key, buildLegExplain(ranked, (legOpt) => legCtx(legOpt, tol, pax, month, input.contract), w));
    }
  }

  const nodesByName = new Map(deps.nodes.map((n) => [n.name, n] as const));

  // pass 1 — expand with no weekday to learn each constrained leg's day index
  const pass1 = expandDays({ sequence: names, nights, nodes: nodesByName, chosen, profile: input.profile ?? 'standard', maxRoadKmDay: input.maxRoadKmDay, startWeekday: null, haltNames: deps.haltNames, anchorsByLeg: deps.anchorsByLeg, month: input.month });
  const constrained: WeekdayConstrainedLeg[] = [];
  {
    let di = 0;
    for (const d of pass1.days) {
      if (d.transit) {
        const o = chosen.get(legKey(d.transit.from, d.transit.to));
        if (o && o.operatingDays != null && o.operatingDays !== 127) constrained.push({ dayIndex: di, operatingDays: o.operatingDays, identifier: o.identifier });
      }
      di = d.day - 1;
    }
  }
  let { lock } = resolveWeekdayLock(constrained, input.startWeekday ?? null);
  // §6.1 whole-trip phase shift: if the traveller's date is SOFT and their desired
  // Day-1 weekday does not align the weekday-limited trains, slide the whole trip by
  // up to ±softStartWindowDays days — the cheapest fix, tried before any reroute.
  let phase: PhaseShiftResult | undefined;
  let startWd: any = lock ? (['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'].indexOf(lock)) : (input.startWeekday ?? null);
  if (input.startWeekday != null && (input.softStartWindowDays ?? 0) > 0) {
    phase = phaseShift(input.startWeekday, constrained, input.softStartWindowDays);
    if (phase.aligned && phase.startWeekday != null) {
      startWd = phase.startWeekday;
      lock = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'][phase.startWeekday];
    }
  }
  const exp = expandDays({ sequence: names, nights, nodes: nodesByName, chosen, profile: input.profile ?? 'standard', maxRoadKmDay: input.maxRoadKmDay, startWeekday: startWd, haltNames: deps.haltNames, anchorsByLeg: deps.anchorsByLeg, month: input.month });

  // §10 attach decision records + legOptions to the legs the plan actually took
  // (additive, absent-safe; matched by from||to on the main sequencing path).
  for (const leg of exp.legs) {
    const ex = explainByLeg.get(legKey(leg.from, leg.to));
    if (ex) {
      if (ex.decisionRecord) leg.decisionRecord = ex.decisionRecord;
      leg.legOptions = ex.legOptions;
    }
  }

  const metrics = scorePlan(exp.legs, exp.days, pax, input.profile ?? 'standard');
  const warnings = [...exp.warnings];
  if (phase && (!phase.aligned || phase.shiftDays !== 0)) warnings.push(`Phase shift: ${phase.reason}`);
  // §3.3/§7 rhythm gates: accumulate the fatigue ledger over the scheduled days and
  // surface any two-consecutive-heavy / heavy→heavy-drive / 3-day-streak violation.
  const dayLoads = dayLoadsFromDays(exp.days, chosen, tol, month);
  const ledger = runFatigueLedger(dayLoads, tol);
  // §7 inc-2: project per-day comfort (fatigue/effort/comfortNote/marker) onto the days.
  projectComfort(dayLoads, exp.days, tol).forEach((c, i) => { const d = exp.days[i]; if (!d) return; d.fatigue = c.fatigue; d.effort = c.effort; d.comfortNote = c.comfortNote; if (c.marker) d.marker = c.marker; });
  for (const v of ledger.violations) warnings.push(`Rhythm (${v.kind}): ${v.detail}`);
  if (exp.infeasible) warnings.unshift('Plan contains a hard-constraint violation (gate/daylight/permit) — a day was flagged infeasible and must be rerouted.');
  void nodeMap;

  return {
    sequence: names,
    weekdayLock: lock,
    legs: exp.legs,
    days: exp.days,
    totals: toTotals(metrics),
    warnings,
    verifyBeforeBooking: verifyList(chosenList),
    map: mapRoute(names, chosen, nodesByName),
    label,
    rhythm: { ok: ledger.ok, peakF: ledger.F.length ? Math.max(...ledger.F) : 0, headline: rhythmHeadline(ledger, tol), violations: ledger.violations },
    phaseShift: phase ? { aligned: phase.aligned, shiftDays: phase.shiftDays, startWeekday: phase.startWeekday != null ? ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'][phase.startWeekday] : null, reason: phase.reason } : undefined,
  };
}

/**
 * Solve ONE full plan under a fixed objective (matrix → sequence → buildPlan).
 * Exported so the §8 archetype builder can produce Swift/Balanced/Gentle without
 * re-implementing sequencing. Deliberately does NOT build cards, so there is no
 * recursion with optimize(). The objective is forced into the input the plan sees so
 * its DDCV weights, ranking and decision records are all consistent with it.
 */
export function solveForObjective(input: OptimizeInput, deps: OptimizeDeps, objective: Objective, label: string): Plan {
  const names0 = deps.nodes.map((n) => n.name);
  const pax = input.pax ?? 2;
  const startIdx = input.start ? names0.findIndex((n) => n.toLowerCase() === input.start!.toLowerCase()) : null;
  const endIdx = input.end ? names0.findIndex((n) => n.toLowerCase() === input.end!.toLowerCase()) : null;
  const preferDaily = input.startWeekday == null;
  const solveTol = toleranceForProfile(input.profile);
  const solveW = applyTPP(weightsForObjective(objective), input.tpp);
  const matrix = buildMatrix(names0, deps, objective, pax, preferDaily, solveTol, input.month, solveW, input.contract);
  const { order } = sequence(matrix, { start: startIdx != null && startIdx >= 0 ? startIdx : null, end: endIdx != null && endIdx >= 0 ? endIdx : null });
  return buildPlan(order, names0, { ...input, objective }, deps, label);
}

export function optimize(input: OptimizeInput, deps: OptimizeDeps): OptimizeResult {
  const names0 = deps.nodes.map((n) => n.name);
  const pax = input.pax ?? 2;
  const startIdx = input.start ? names0.findIndex((n) => n.toLowerCase() === input.start!.toLowerCase()) : null;
  const endIdx = input.end ? names0.findIndex((n) => n.toLowerCase() === input.end!.toLowerCase()) : null;

  const preferDaily = input.startWeekday == null;
  const solveTol = toleranceForProfile(input.profile);
  const solveW = applyTPP(weightsForObjective(input.objective), input.tpp);
  const matrix = buildMatrix(names0, deps, input.objective, pax, preferDaily, solveTol, input.month, solveW, input.contract);
  const { order } = sequence(matrix, { start: startIdx != null && startIdx >= 0 ? startIdx : null, end: endIdx != null && endIdx >= 0 ? endIdx : null });

  const best = buildPlan(order, names0, input, deps, `Best (${input.objective})`);

  // alternate 1 — edge-penalty diversification (penalise 30% of chosen edges, re-sequence)
  const alt1Matrix = matrix.map((row) => row.slice());
  for (let i = 1; i < order.length; i++) if (i % 3 === 0) alt1Matrix[order[i - 1]][order[i]] *= 1.6;
  const alt1Order = sequence(alt1Matrix, { start: startIdx != null && startIdx >= 0 ? startIdx : null, end: endIdx != null && endIdx >= 0 ? endIdx : null }).order;
  const alt1 = buildPlan(alt1Order, names0, input, deps, 'Alternate (diversified)');

  // alternate 2 — weekday-free fallback: force road/daily modes only (no weekday lock)
  const roadOnlyDeps: OptimizeDeps = {
    nodes: deps.nodes,
    pool: new Map(Array.from(deps.pool.entries()).map(([k, v]) => [k, v.filter((o) => (o.operatingDays ?? 127) === 127)] as const)),
  };
  const roadMatrix = buildMatrix(names0, roadOnlyDeps, input.objective, pax, true, solveTol, input.month, solveW, input.contract);
  const alt2Order = sequence(roadMatrix, { start: startIdx != null && startIdx >= 0 ? startIdx : null, end: endIdx != null && endIdx >= 0 ? endIdx : null }).order;
  const alt2 = buildPlan(alt2Order, names0, input, { ...deps, pool: roadOnlyDeps.pool, dailyOnly: true }, 'Alternate (date-flexible, no weekday lock)');
  alt2.dateFlexible = true;

  const plans = dedupePlans([best, alt1, alt2]);
  // §8 additive: Swift/Balanced/Gentle archetype cards (each a full solve under a
  // fixed objective). plans[] stays present + unchanged — loadFromOptimizer is safe.
  const cards = buildArchetypes(input, deps);
  // §9 negotiation: only when the chosen plan is infeasible (engine signals) or over
  // the traveller's day budget — a senior expert negotiates instead of erroring. The
  // extra re-solves run ONLY on an infeasible request, so feasible solves are untouched.
  const negotiation = needsNegotiation(best, input.dayBudget)
    ? negotiate(input, deps, { dayBudget: input.dayBudget })
    : undefined;
  return { plans, cards, ...(negotiation && negotiation.length ? { negotiation } : {}) };
}

/**
 * Build a plan for an already-fixed sequence (no re-sequencing). Used after
 * en-route halts have been inserted into a chosen order: the controller supplies
 * the expanded ordered names (originals + halts), the augmented nodes/pool, and
 * input.cities carrying each halt's nights.
 */
export function planFromSequence(names: string[], input: OptimizeInput, deps: OptimizeDeps, label: string): Plan {
  return buildPlan(names.map((_, i) => i), names, input, deps, label);
}

function dedupePlans(plans: Plan[]): Plan[] {
  const seen = new Set<string>();
  const out: Plan[] = [];
  for (const p of plans) {
    const sig = p.sequence.join('>') + '|' + p.weekdayLock;
    if (!seen.has(sig)) { seen.add(sig); out.push(p); }
  }
  return out.length ? out : plans.slice(0, 1);
}
