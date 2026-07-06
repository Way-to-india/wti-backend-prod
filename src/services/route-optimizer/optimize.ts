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

import type { CityNode, LegOption, OptimizeInput, OptimizeResult, Plan, Objective, MapRoute, MapRouteLeg } from './types';
import { sequence } from './sequence';
import { expandDays } from './dayExpand';
import { resolveWeekdayLock, type WeekdayConstrainedLeg } from './constraints';
import { scorePlan, toTotals } from './score';
import { verifyList } from './guardrails';
import { fmtDuration } from './geo';

const legKey = (a: string, b: string) => `${a}||${b}`;
const BIG = 1e7;

export interface OptimizeDeps {
  nodes: CityNode[];
  pool: Map<string, LegOption[]>;
}

/** scalarize one option to a comparable cost under the objective (lower = better). */
function optionCost(o: LegOption, obj: Objective, pax: number): number {
  const time = (o.durationMin ?? BIG) / 60;
  const fare = o.farePpMin != null && o.farePpMax != null ? ((o.farePpMin + o.farePpMax) / 2) : 0;
  const cost = fare * Math.max(1, pax);
  switch (obj) {
    case 'TIME': return time;
    case 'COST': return cost || time * 500; // if no fare, proxy by time
    case 'EASE': return time + (o.reliability != null ? (5 - o.reliability) * 2 : 4) + (o.mode === 'ROAD' && (o.distanceKm ?? 0) > 300 ? 5 : 0);
    case 'BALANCED': default: return 0.35 * time + 0.35 * (cost / 1000 || time) + 0.30 * (time + (o.reliability != null ? (5 - o.reliability) * 2 : 4));
  }
}

function bestOption(opts: LegOption[] | undefined, obj: Objective, pax: number, opts2?: { overnightTrains?: boolean }): LegOption | undefined {
  if (!opts || !opts.length) return undefined;
  const usable = opts.filter((o) => opts2?.overnightTrains === false ? !(o.mode === 'RAIL') : true);
  const pick = (usable.length ? usable : opts).slice().sort((a, b) => optionCost(a, obj, pax) - optionCost(b, obj, pax));
  return pick[0];
}

function buildMatrix(names: string[], deps: OptimizeDeps, obj: Objective, pax: number): number[][] {
  const n = names.length;
  const m: number[][] = Array.from({ length: n }, () => new Array(n).fill(BIG));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j) { m[i][j] = 0; continue; }
    const best = bestOption(deps.pool.get(legKey(names[i], names[j])), obj, pax);
    m[i][j] = best ? optionCost(best, obj, pax) : BIG;
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

  // choose best option per consecutive pair
  const chosen = new Map<string, LegOption>();
  const chosenList: LegOption[] = [];
  for (let i = 1; i < names.length; i++) {
    const opt = bestOption(deps.pool.get(legKey(names[i - 1], names[i])), input.objective, pax, { overnightTrains: input.overnightTrains });
    if (opt) { chosen.set(legKey(names[i - 1], names[i]), opt); chosenList.push(opt); }
  }

  const nodesByName = new Map(deps.nodes.map((n) => [n.name, n] as const));

  // pass 1 — expand with no weekday to learn each constrained leg's day index
  const pass1 = expandDays({ sequence: names, nights, nodes: nodesByName, chosen, profile: input.profile ?? 'standard', maxRoadKmDay: input.maxRoadKmDay, startWeekday: null });
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
  const { lock } = resolveWeekdayLock(constrained, input.startWeekday ?? null);

  // pass 2 — expand with the resolved weekday lock
  const startWd = lock ? (['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'].indexOf(lock) as any) : (input.startWeekday ?? null);
  const exp = expandDays({ sequence: names, nights, nodes: nodesByName, chosen, profile: input.profile ?? 'standard', maxRoadKmDay: input.maxRoadKmDay, startWeekday: startWd });

  const metrics = scorePlan(exp.legs, exp.days, pax, input.profile ?? 'standard');
  const warnings = [...exp.warnings];
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
  };
}

export function optimize(input: OptimizeInput, deps: OptimizeDeps): OptimizeResult {
  const names0 = deps.nodes.map((n) => n.name);
  const pax = input.pax ?? 2;
  const startIdx = input.start ? names0.findIndex((n) => n.toLowerCase() === input.start!.toLowerCase()) : null;
  const endIdx = input.end ? names0.findIndex((n) => n.toLowerCase() === input.end!.toLowerCase()) : null;

  const matrix = buildMatrix(names0, deps, input.objective, pax);
  const { order } = sequence(matrix, { start: startIdx != null && startIdx >= 0 ? startIdx : null, end: endIdx != null && endIdx >= 0 ? endIdx : null });

  const best = buildPlan(order, names0, input, deps, `Best (${input.objective})`);

  // alternate 1 — edge-penalty diversification (penalise 30% of chosen edges, re-sequence)
  const alt1Matrix = matrix.map((row) => row.slice());
  for (let i = 1; i < order.length; i++) if (i % 3 === 0) alt1Matrix[order[i - 1]][order[i]] *= 1.6;
  const alt1Order = sequence(alt1Matrix, { start: startIdx ?? null, end: endIdx ?? null }).order;
  const alt1 = buildPlan(alt1Order, names0, input, deps, 'Alternate (diversified)');

  // alternate 2 — weekday-free fallback: force road/daily modes only (no weekday lock)
  const roadOnlyDeps: OptimizeDeps = {
    nodes: deps.nodes,
    pool: new Map(Array.from(deps.pool.entries()).map(([k, v]) => [k, v.filter((o) => (o.operatingDays ?? 127) === 127)] as const)),
  };
  const roadMatrix = buildMatrix(names0, roadOnlyDeps, input.objective, pax);
  const alt2Order = sequence(roadMatrix, { start: startIdx ?? null, end: endIdx ?? null }).order;
  const alt2 = buildPlan(alt2Order, names0, input, { ...deps, pool: roadOnlyDeps.pool }, 'Alternate (date-flexible, no weekday lock)');

  const plans = dedupePlans([best, alt1, alt2]);
  return { plans };
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
