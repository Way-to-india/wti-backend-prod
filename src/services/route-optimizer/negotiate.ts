/**
 * L6 — NEGOTIATION ENGINE (spec §9). PURE.
 *
 * When a request is infeasible, a junior system errors out; a senior expert
 * NEGOTIATES. This module reads the infeasibility the engine ALREADY reports —
 * the `Plan contains a hard-constraint violation` warning (exp.infeasible), the
 * per-day `violations`, the §3.3/§7 rhythm-gate violations, and the day-budget
 * overage — generates the classic relaxation set, re-solves each under the SAME
 * builder the main solve uses, and ranks them by (feasibility gained ÷ experience
 * lost). It presents the top three in plain, priced English — each naming what it
 * costs (days / ₹ per person / comfort).
 *
 * Relaxations (spec §9):
 *   add_day · drop_node(x) · upgrade_mode(leg) · shift_start_date (reuse phaseShift)
 *   · allow_1_heavy_day · swap_node(x → nearer y)
 *
 * FACTS-ONLY (anti-hallucination, founder-locked): every relaxation is re-solved
 * over the VERIFIED candidate pool (`deps.pool`) — nothing invented. A relaxation
 * may drop a node, add a day, upgrade a class, shift the date, or accept ONE heavy
 * day within the rhythm gates. It may NEVER breach a body-truth hard gate
 * (physiology.ts): the per-day hour cap, chronotype floor, class floor and altitude
 * rule are enforced inside every re-solve (DDCV hardBlock) and can NOT be bought off
 * by any weight or relaxation. `allow_1_heavy_day` only discounts a RHYTHM
 * (alternation/streak) count — never a body gate — so no relaxation can ever
 * manufacture a hard violation. Any thin/unverified candidate carries `verifyFlag`.
 *
 * ADDITIVE: emitted as OptimizeResult.negotiation[]; plans[] and cards[] stay
 * present + unchanged, so the Itinerary Builder `loadFromOptimizer` seam is safe.
 * No re-implementation of sequencing — each re-solve is a `solveForObjective()` pass
 * (the same builder the main solve uses), so body gates, open-jaw endpoints and
 * VERIFY flags all carry through.
 */

import type {
  OptimizeInput, InputCity, CityNode, LegOption, Plan, Objective,
  Relaxation, RelaxationKind,
} from './types';
import { solveForObjective, type OptimizeDeps } from './optimize';
import { toleranceForProfile } from './physiology';
import { phaseShift, type WeekdayConstrainedLeg } from './constraints';
import { WEEKDAY_NAMES } from './types';

const legKey = (a: string, b: string) => `${a}||${b}`;

// ---- infeasibility magnitude -------------------------------------------------
// A single non-negative number: 0 = fully feasible. HARD dominates (a body-gate /
// gate / daylight day violation), then rhythm (§7 alternation/streak), then the
// day-budget overage. Everything is READ from the plan the engine actually built —
// negotiate never re-invents feasibility.

const HARD_W = 100; // a hard-constraint (body/gate/daylight) day violation dominates
const RHY_W = 2;    // each §7 rhythm violation
const DAY_W = 3;    // each day over the traveller's day budget

/** Body / gate / daylight hard-constraint day violations the engine flagged. */
export function hardViolations(p: Plan): number {
  const warned = p.warnings.filter((w) => /hard-constraint violation/i.test(w)).length;
  const dayLevel = p.days.filter((d) => (d.violations?.length ?? 0) > 0).length;
  return warned + dayLevel;
}
function rhythmViolations(p: Plan): number {
  return p.rhythm ? p.rhythm.violations.length : 0;
}
function overBudget(p: Plan, budget?: number): number {
  return budget != null ? Math.max(0, p.days.length - budget) : 0;
}

/** Total infeasibility magnitude. `rhythmDiscount` models allow_1_heavy_day: it
 *  forgives up to N rhythm (comfort) violations — NEVER a hard body gate. */
function infeasScore(p: Plan, budget?: number, rhythmDiscount = 0): number {
  const rhy = Math.max(0, rhythmViolations(p) - rhythmDiscount);
  return HARD_W * hardViolations(p) + RHY_W * rhy + DAY_W * overBudget(p, budget);
}

function costMid(p: Plan): number {
  const b = p.totals.costPpBand;
  return b ? (b[0] + b[1]) / 2 : 0;
}
function peakF(p: Plan): number {
  return p.rhythm?.peakF ?? 0;
}

// ---- experience-lost weights (the denominator of the ranking) ---------------
// A relaxation's "experience lost" in comparable units. Dropping a whole city
// destroys the most experience; accepting more days destroys the least (you keep
// everything, you only spend time); an upgrade is priced in money; a heavy day is a
// comfort cost that is HEAVIER for a fragile body.

const ADD_DAY_EXP = 1;      // per extra day accepted (keeps everything → cheapest)
const NODE_EXP = 6;         // per night of the dropped city (losing a place hurts most)
const MONEY_EXP_SCALE = 3000; // ₹ per person that equals one experience unit
const HEAVY_EXP_BASE = 3.5; // accepting one longer day (scaled up for a fragile body)
const SWAP_EXP = 3;         // swapping a place for a nearer, lesser one
const SHIFT_EXP = 0.5;      // sliding the start date — almost free

// ---- friendly party label (never leaks internal class ids) -------------------
function friendlyClass(cls: string): string {
  switch (cls) {
    case 'elderly': return 'senior';
    case 'reduced_mobility': return 'reduced-mobility';
    case 'family': return 'family';
    case 'young': return 'young';
    default: return 'standard';
  }
}

const inr = (n: number) => `₹${Math.round(Math.abs(n)).toLocaleString('en-IN')}`;
const plural = (n: number) => (Math.abs(n) === 1 ? '' : 's');

// ---- a scored relaxation candidate (internal; carries the re-solved plan) ----

export interface RelaxationCandidate {
  relaxation: Relaxation;
  /** the re-solved plan under this relaxation (base plan for add_day/allow_1_heavy). */
  plan: Plan;
  feasibilityGained: number;
  experienceLost: number;
  score: number;
}

/** An optional nearer alternative for swap_node(x → y): the pool must already carry
 *  y's legs (anti-hallucination — never invent a city or a service). */
export interface SwapTarget {
  drop: string;          // the city to replace
  add: string;           // the nearer city to replace it with
  addCoord: [number, number];
  nights?: number;
}

export interface NegotiateOpts {
  /** the traveller's day budget (e.g. 8). When set, an over-budget plan is infeasible. */
  dayBudget?: number;
  /** nearer alternatives for swap_node, each with pool legs already present. */
  swapTargets?: SwapTarget[];
}

// -----------------------------------------------------------------------------
// Re-solve helpers — all go through solveForObjective (no re-implemented sequencing)
// -----------------------------------------------------------------------------

function baseObjective(input: OptimizeInput): Objective {
  return input.objective ?? 'BALANCED';
}

/** Re-solve after removing city `drop` from the request + pool (drop_node). */
function solveWithoutNode(input: OptimizeInput, deps: OptimizeDeps, drop: string): Plan {
  const lc = drop.toLowerCase();
  const cities: InputCity[] = input.cities.filter((c) => c.name.toLowerCase() !== lc);
  const nodes: CityNode[] = deps.nodes.filter((n) => n.name.toLowerCase() !== lc);
  const pool = new Map<string, LegOption[]>();
  for (const [k, v] of deps.pool.entries()) {
    const [a, b] = k.split('||');
    if (a.toLowerCase() === lc || b.toLowerCase() === lc) continue;
    pool.set(k, v);
  }
  const start = input.start && input.start.toLowerCase() === lc ? nodes[0]?.name ?? null : input.start;
  const end = input.end && input.end.toLowerCase() === lc ? nodes[nodes.length - 1]?.name ?? null : input.end;
  const reduced: OptimizeInput = { ...input, cities, start, end };
  return solveForObjective(reduced, { ...deps, nodes, pool }, baseObjective(input), 'drop');
}

/** Re-solve after forcing one leg onto its faster candidate (upgrade_mode). The
 *  faster option MUST already be in the pool — we only prune the slower ones. */
function solveWithForcedLeg(input: OptimizeInput, deps: OptimizeDeps, from: string, to: string, forced: LegOption): Plan {
  const pool = new Map(deps.pool);
  pool.set(legKey(from, to), [forced]);
  return solveForObjective(input, { ...deps, pool }, baseObjective(input), 'upgrade');
}

/** Re-solve after swapping city `drop` → `add` (swap_node). */
function solveWithSwap(input: OptimizeInput, deps: OptimizeDeps, t: SwapTarget): Plan {
  const lc = t.drop.toLowerCase();
  const cities: InputCity[] = input.cities.map((c) =>
    c.name.toLowerCase() === lc ? { name: t.add, nights: t.nights ?? c.nights ?? 1 } : c);
  const nodes: CityNode[] = deps.nodes.map((n) =>
    n.name.toLowerCase() === lc ? { name: t.add, coord: t.addCoord, profile: {} } : n);
  const start = input.start && input.start.toLowerCase() === lc ? t.add : input.start;
  const end = input.end && input.end.toLowerCase() === lc ? t.add : input.end;
  const swapped: OptimizeInput = { ...input, cities, start, end };
  return solveForObjective(swapped, { ...deps, nodes }, baseObjective(input), 'swap');
}

// -----------------------------------------------------------------------------
// Relaxation generators
// -----------------------------------------------------------------------------

/**
 * Enumerate every applicable relaxation for an infeasible request, each already
 * re-solved and scored. Exported for introspection + the acceptance test (which
 * proves the generator covers drop_node/upgrade_mode/etc. and that NO re-solve
 * breaches a body gate). Returns candidates whose feasibility gain is > 0, ranked
 * by (feasibility gained ÷ experience lost), best first.
 */
export function enumerateRelaxations(input: OptimizeInput, deps: OptimizeDeps, opts: NegotiateOpts = {}): RelaxationCandidate[] {
  const budget = opts.dayBudget;
  const base = solveForObjective(input, deps, baseObjective(input), 'baseline');
  const baseScore = infeasScore(base, budget);
  if (baseScore <= 0) return []; // feasible — nothing to negotiate

  const tol = toleranceForProfile(input.profile);
  const who = friendlyClass(tol.cls);
  const n = input.cities.length;
  const baseCost = costMid(base);
  const baseF = peakF(base);
  const baseOver = overBudget(base, budget);
  const baseRhythm = rhythmViolations(base);

  const cands: RelaxationCandidate[] = [];

  const push = (
    kind: RelaxationKind, label: string, plan: Plan, relaxedScore: number,
    experienceLost: number, plainText: string,
    over: { deltaDays?: number; deltaCostPp?: number; deltaFatigue?: number; verifyFlag?: boolean } = {},
  ) => {
    const feasibilityGained = Math.round((baseScore - relaxedScore) * 100) / 100;
    if (feasibilityGained <= 0 || experienceLost <= 0) return;
    const deltaDays = over.deltaDays ?? (plan.days.length - base.days.length);
    const deltaCostPp = over.deltaCostPp ?? Math.round(costMid(plan) - baseCost);
    const deltaFatigue = over.deltaFatigue ?? Math.round((peakF(plan) - baseF) * 10) / 10;
    const score = Math.round((feasibilityGained / experienceLost) * 1000) / 1000;
    const relaxation: Relaxation = {
      kind, label, deltaDays, deltaCostPp, deltaFatigue, plainText,
      feasibilityGained, experienceLost, score,
      ...(over.verifyFlag ? { verifyFlag: true } : {}),
    };
    cands.push({ relaxation, plan, feasibilityGained, experienceLost, score });
  };

  // --- (1) add_day: accept the honest day count + a rest day so no two long
  //         travel days fall back to back. Always reaches feasibility (given the
  //         days, rest days break the streak and absorb the overage). Cheapest —
  //         nothing is dropped. Cost is expressed in DAYS, never a fabricated ₹. ---
  {
    const extra = Math.max(1, baseOver + (baseRhythm > 0 ? 1 : 0));
    const exp = ADD_DAY_EXP * extra;
    const restClause = baseRhythm > 0 ? ' and adds a rest day so no two long travel days fall back to back' : '';
    const text = `Take ${extra} more day${plural(extra)} — keep all ${n} cities${restClause}. Costs ${extra} extra day${plural(extra)} on the trip; nothing is dropped and no extra flights.`;
    push('add_day', `Add ${extra} day${plural(extra)}`, base, 0, exp, text, { deltaDays: extra, deltaCostPp: 0, deltaFatigue: 0 });
  }

  // --- (2) drop_node(x): remove the single most droppable city (fewest nights →
  //         least experience lost). Re-solve; keep it only if it gains feasibility. ---
  {
    const pinned = new Set([input.start?.toLowerCase(), input.end?.toLowerCase()].filter(Boolean) as string[]);
    let best: { plan: Plan; city: InputCity; relaxedScore: number; exp: number } | null = null;
    for (const c of input.cities) {
      if (pinned.has(c.name.toLowerCase())) continue;
      let plan: Plan | undefined;
      try { plan = solveWithoutNode(input, deps, c.name); } catch { plan = undefined; }
      if (!plan || !plan.days.length) continue;
      const rs = infeasScore(plan, budget);
      const exp = NODE_EXP * Math.max(1, c.nights ?? 1);
      const gain = baseScore - rs;
      // pick the candidate with the best feasibility-per-experience among droppables.
      if (gain > 0 && (!best || gain / exp > (baseScore - best.relaxedScore) / best.exp)) {
        best = { plan, city: c, relaxedScore: rs, exp };
      }
    }
    if (best) {
      const savedDays = base.days.length - best.plan.days.length;
      const fits = budget != null ? `the trip then fits your ${budget} days` : 'the schedule then eases';
      const daysClause = savedDays > 0 ? ` it saves ${savedDays} travel-day${plural(savedDays)}` : ' it eases the pace';
      const text = `Drop ${best.city.name} — ${fits} and removes a back-to-back long day. You lose one city (${best.city.name});${daysClause}.`;
      push('drop_node', `Drop ${best.city.name}`, best.plan, best.relaxedScore, best.exp, text);
    }
  }

  // --- (3) upgrade_mode(leg): on the heaviest surface leg that carries a FASTER
  //         candidate the baseline did not take (e.g. a pricier flight vs a long
  //         drive), force the faster option and re-solve. Priced in ₹; saves hours
  //         and fatigue. Only kept if it gains feasibility. ------------------------
  {
    let best: { plan: Plan; from: string; to: string; forced: LegOption; savedHrs: number; relaxedScore: number; verify: boolean } | null = null;
    for (const leg of base.legs) {
      const pool = deps.pool.get(legKey(leg.from, leg.to)) ?? [];
      // a faster candidate = shorter door-to-door duration than the chosen leg and
      // a different (faster) mode; prefer AIR/RAIL over a long ROAD leg.
      const chosenDur = leg.durationMin ?? Number.MAX_SAFE_INTEGER;
      const faster = pool
        .filter((o) => o.mode !== leg.mode && (o.durationMin ?? Number.MAX_SAFE_INTEGER) < chosenDur)
        .sort((a, b) => (a.durationMin ?? 0) - (b.durationMin ?? 0))[0];
      if (!faster) continue;
      let plan: Plan | undefined;
      try { plan = solveWithForcedLeg(input, deps, leg.from, leg.to, faster); } catch { plan = undefined; }
      if (!plan || !plan.days.length) continue;
      const rs = infeasScore(plan, budget);
      if (rs >= baseScore) continue; // no feasibility gained
      const savedHrs = Math.max(0, Math.round(((leg.durationMin ?? 0) - (faster.durationMin ?? 0)) / 60));
      const verify = (faster.reliability != null && faster.reliability <= 2) || !!faster.seasonal;
      if (!best || rs < best.relaxedScore) best = { plan, from: leg.from, to: leg.to, forced: faster, savedHrs, relaxedScore: rs, verify };
    }
    if (best) {
      const deltaCostPp = Math.round(costMid(best.plan) - baseCost);
      const modeWord = best.forced.mode === 'AIR' ? 'Fly' : best.forced.mode === 'RAIL' ? 'Take the train' : 'Upgrade';
      const costClause = deltaCostPp > 0 ? ` Costs about ${inr(deltaCostPp)} more per person` : ' At little extra cost';
      const hrsClause = best.savedHrs > 0 ? `, and saves about ${best.savedHrs} hour${plural(best.savedHrs)} in the vehicle` : '';
      const verifyClause = best.verify ? ' (reconfirm this service before booking)' : '';
      const exp = Math.max(0.5, Math.abs(deltaCostPp) / MONEY_EXP_SCALE);
      const text = `${modeWord} ${best.from}–${best.to} instead of the long leg — keep all ${n} cities and remove the back-to-back long day.${costClause}${hrsClause}${verifyClause}.`;
      push('upgrade_mode', `${modeWord} ${best.from}–${best.to}`, best.plan, best.relaxedScore, exp, text, { deltaCostPp, verifyFlag: best.verify });
    }
  }

  // --- (4) shift_start_date: reuse phaseShift over the baseline's weekday-limited
  //         legs. Almost free — slides the whole trip to align the trains. Only
  //         applies when a soft window + weekday-limited legs exist. ---------------
  if (input.startWeekday != null && (input.softStartWindowDays ?? 0) > 0) {
    const constrained: WeekdayConstrainedLeg[] = [];
    let di = 0;
    for (const d of base.days) {
      if (d.transit) {
        const o = deps.pool.get(legKey(d.transit.from, d.transit.to))?.find((x) => x.identifier === (d.transit!.identifier ?? x.identifier));
        if (o && o.operatingDays != null && o.operatingDays !== 127) constrained.push({ dayIndex: di, operatingDays: o.operatingDays, identifier: o.identifier });
      }
      di = d.day - 1;
    }
    const ps = phaseShift(input.startWeekday, constrained, input.softStartWindowDays);
    if (ps.aligned && ps.shiftDays !== 0 && ps.startWeekday != null) {
      let plan: Plan | undefined;
      try { plan = solveForObjective({ ...input, startWeekday: ps.startWeekday }, deps, baseObjective(input), 'shift'); } catch { plan = undefined; }
      if (plan && plan.days.length) {
        const rs = infeasScore(plan, budget);
        const dir = ps.shiftDays > 0 ? 'later' : 'earlier';
        const mag = Math.abs(ps.shiftDays);
        const text = `Start ${mag} day${plural(mag)} ${dir} (Day-1 = ${WEEKDAY_NAMES[ps.startWeekday]}) — aligns the weekday-limited train without changing the route. Costs only a small shift of your dates.`;
        push('shift_start_date', `Start ${mag} day${plural(mag)} ${dir}`, plan, rs, SHIFT_EXP, text, { deltaDays: 0, deltaCostPp: 0, deltaFatigue: 0 });
      }
    }
  }

  // --- (5) allow_1_heavy_day: keep everything and accept exactly ONE longer travel
  //         day — forgives a single §7 rhythm (alternation/streak) count. NEVER a
  //         body gate: the per-day hour cap, chronotype, class floor and altitude
  //         rule are still enforced in the (unchanged) baseline plan. Only offered
  //         when the baseline actually carries a rhythm violation. -----------------
  if (baseRhythm > 0) {
    const relaxedScore = infeasScore(base, budget, 1);
    const exp = HEAVY_EXP_BASE * tol.ageFactor; // a heavy day costs more for a fragile body
    const text = `Accept one longer travel day — keep all ${n} cities, but one day runs past the comfortable ${who} pace (about ${tol.comfortableHrs} h). Costs comfort on that one day; no extra money and nothing dropped.`;
    push('allow_1_heavy_day', 'Accept one longer day', base, relaxedScore, exp, text, { deltaDays: 0, deltaCostPp: 0, deltaFatigue: 0 });
  }

  // --- (6) swap_node(x → nearer y): replace a far city with a nearer one whose
  //         legs are ALREADY in the pool (never invent a city/service). -----------
  for (const t of opts.swapTargets ?? []) {
    let plan: Plan | undefined;
    try { plan = solveWithSwap(input, deps, t); } catch { plan = undefined; }
    if (!plan || !plan.days.length) continue;
    const rs = infeasScore(plan, budget);
    if (rs >= baseScore) continue;
    const text = `Swap ${t.drop} for the nearer ${t.add} — eases the schedule and keeps ${n} cities. You trade ${t.drop} for ${t.add}.`;
    push('swap_node', `Swap ${t.drop} → ${t.add}`, plan, rs, SWAP_EXP, text);
  }

  // rank by feasibility gained ÷ experience lost (best first); stable tie-break by
  // larger feasibility gain, then by kind order for determinism.
  const kindOrder: RelaxationKind[] = ['add_day', 'drop_node', 'upgrade_mode', 'shift_start_date', 'swap_node', 'allow_1_heavy_day'];
  cands.sort((a, b) =>
    b.score - a.score ||
    b.feasibilityGained - a.feasibilityGained ||
    kindOrder.indexOf(a.relaxation.kind) - kindOrder.indexOf(b.relaxation.kind));
  return cands;
}

/**
 * The public negotiation surface (spec §9): the top-3 priced relaxations for an
 * infeasible request, in plain English, ranked by feasibility gained ÷ experience
 * lost. Empty when the request is already feasible. Additive on OptimizeResult.
 */
export function negotiate(input: OptimizeInput, deps: OptimizeDeps, opts: NegotiateOpts = {}): Relaxation[] {
  return enumerateRelaxations(input, deps, opts).slice(0, 3).map((c) => c.relaxation);
}

/** True when the baseline plan is infeasible by any engine signal (hard/gate/daylight
 *  day violation, §7 rhythm violation) or over the traveller's day budget — the
 *  trigger for optimize() to attach a negotiation. */
export function needsNegotiation(plan: Plan, dayBudget?: number): boolean {
  return infeasScore(plan, dayBudget) > 0;
}
