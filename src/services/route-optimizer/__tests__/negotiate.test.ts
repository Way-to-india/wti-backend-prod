/**
 * Sprint 3 — increment 4 acceptance: NEGOTIATION ENGINE (spec §9, handoff §5).
 *
 * The classic: an ELDERLY party, 9 cities, 8 days. A junior system errors; a senior
 * expert NEGOTIATES. This proves the engine returns EXACTLY 3 priced relaxations in
 * plain English — each naming what it costs (days / ₹ per person / comfort) — that
 * the ranking is by (feasibility gained ÷ experience lost), and that NO relaxation
 * breaches a body-truth hard gate (physiology.ts).
 *
 * Fixture is synthetic + fixture-driven (like archetypes.test / explain.test): a
 * heartland chain whose two middle legs (Orchha→Khajuraho, Khajuraho→Varanasi) are
 * long enough to be HEAVY for a senior body — two back-to-back long days trip the §7
 * rhythm gate — and Khajuraho→Varanasi also carries a (pricier) flight the balanced
 * baseline does not take. 9 cities need 9 days, so the 8-day budget is over by one.
 * The three honest fixes mirror §9's own example: add days, drop Orchha, fly the leg.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/negotiate.test.ts
 */

import { optimize, solveForObjective, type OptimizeDeps } from '../optimize';
import { negotiate, enumerateRelaxations, needsNegotiation, hardViolations } from '../negotiate';
import type { CityNode, LegOption, OptimizeInput } from '../types';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`)); };

console.log('\nSprint 3 / inc-4 — negotiation engine (elderly · 9 cities · 8 days)\n');

// ---- fixture -----------------------------------------------------------------
const C = (name: string, lat: number, lng: number): CityNode => ({ name, coord: [lat, lng], profile: {} });
const nodes: CityNode[] = [
  C('Delhi', 28.61, 77.21), C('Agra', 27.18, 78.01), C('Gwalior', 26.22, 78.18),
  C('Jhansi', 25.45, 78.57), C('Orchha', 25.35, 78.64), C('Khajuraho', 24.85, 79.93),
  C('Varanasi', 25.32, 82.97), C('Ayodhya', 26.80, 82.20), C('Patna', 25.59, 85.14),
];
// a light comfortable road hop (senior-legal, well under the 5 h cap).
const light = (from: string, to: string, km = 100, min = 100): LegOption =>
  ({ from, to, mode: 'ROAD', distanceKm: km, durationMin: min, operatingDays: 127, reliability: 5, source: 'osrm' });
// a long road day — legal at the cap but HEAVY for a senior body.
const heavy = (from: string, to: string, min: number): LegOption =>
  ({ from, to, mode: 'ROAD', distanceKm: Math.round(min * 0.9), durationMin: min, operatingDays: 127, reliability: 5, source: 'osrm' });

const pool = new Map<string, LegOption[]>([
  ['Delhi||Agra', [light('Delhi', 'Agra')]],
  ['Agra||Gwalior', [light('Agra', 'Gwalior')]],
  ['Gwalior||Jhansi', [light('Gwalior', 'Jhansi')]],
  ['Jhansi||Orchha', [light('Jhansi', 'Orchha')]],
  ['Orchha||Khajuraho', [heavy('Orchha', 'Khajuraho', 295)]],           // heavy day 1
  ['Khajuraho||Varanasi', [
    heavy('Khajuraho', 'Varanasi', 300),                                 // heavy day 2 (baseline takes this)
    // the §9 flight — pricier, so the BALANCED baseline keeps the road; upgrade_mode forces it.
    { from: 'Khajuraho', to: 'Varanasi', mode: 'AIR', identifier: '6E 7431', distanceKm: 380, durationMin: 90, depTime: '10:00', arrTime: '11:30', operatingDays: 127, reliability: 4, farePpMin: 9500, farePpMax: 12500, source: 'air-sched' },
  ]],
  ['Varanasi||Ayodhya', [light('Varanasi', 'Ayodhya')]],
  ['Ayodhya||Patna', [light('Ayodhya', 'Patna')]],
  // drop-helper: the direct Jhansi→Khajuraho leg the engine uses when Orchha is dropped.
  ['Jhansi||Khajuraho', [light('Jhansi', 'Khajuraho')]],
]);
const deps: OptimizeDeps = { nodes, pool };

const input: OptimizeInput = {
  cities: nodes.map((n) => ({ name: n.name, nights: 1 })),
  start: 'Delhi', end: 'Patna', objective: 'BALANCED', pax: 2, profile: 'senior',
  dayBudget: 8,
} as OptimizeInput;

// ---- baseline is infeasible for 8 days (engine signals) ----------------------
const base = solveForObjective(input, deps, 'BALANCED', 'baseline');
check('baseline honestly needs more than 8 days (9 cities → 9 days)', base.days.length > 8, `days=${base.days.length}`);
check('baseline trips the §7 rhythm gate (two long days back to back)', (base.rhythm?.violations.length ?? 0) > 0, JSON.stringify(base.rhythm?.violations.map((v) => v.kind)));
check('needsNegotiation flags the infeasible request', needsNegotiation(base, 8) === true);
check('baseline has NO body/hard-gate violation (heavy ≠ illegal)', hardViolations(base) === 0, `hard=${hardViolations(base)}`);

// ---- THE DEMO GATE: exactly 3 priced relaxations -----------------------------
const neg = negotiate(input, deps, { dayBudget: 8 });
check('exactly 3 relaxations are offered', neg.length === 3, `len=${neg.length} kinds=${neg.map((r) => r.kind).join(',')}`);
check('every relaxation is written in plain English', neg.every((r) => typeof r.plainText === 'string' && r.plainText.length > 30));
check('every relaxation carries the §9 contract fields', neg.every((r) =>
  typeof r.kind === 'string' && typeof r.label === 'string' &&
  typeof r.deltaDays === 'number' && typeof r.deltaCostPp === 'number' &&
  typeof r.deltaFatigue === 'number' && typeof r.plainText === 'string'), JSON.stringify(neg[0]));

// each names its cost — the three currencies §9 asks for (days / ₹ pp / comfort).
check('one option is priced in DAYS (add days / drop a city)', neg.some((r) => /\bday(s)?\b/i.test(r.plainText)));
check('one option is priced in ₹ PER PERSON (the flight upgrade)', neg.some((r) => /₹[\d,]+\s*more per person/i.test(r.plainText)), neg.map((r) => r.plainText).join(' | '));
check('the trio matches §9 (add days · drop a city · fly a leg)',
  new Set(neg.map((r) => r.kind)).size === 3 &&
  neg.some((r) => r.kind === 'add_day') && neg.some((r) => r.kind === 'drop_node') && neg.some((r) => r.kind === 'upgrade_mode'),
  neg.map((r) => r.kind).join(','));

// ---- ranking is by (feasibility gained ÷ experience lost) --------------------
check('scores are ranked best-first (non-increasing)', neg.every((r, i) => i === 0 || (neg[i - 1].score ?? 0) >= (r.score ?? 0)),
  neg.map((r) => `${r.kind}:${r.score}`).join(' '));
check('score == feasibilityGained ÷ experienceLost for every relaxation', neg.every((r) =>
  r.score != null && r.feasibilityGained != null && r.experienceLost != null &&
  Math.abs(r.score - r.feasibilityGained / r.experienceLost) < 0.02),
  neg.map((r) => `${r.kind}:${r.feasibilityGained}/${r.experienceLost}=${r.score}`).join(' '));
check('every offered relaxation actually gains feasibility (>0)', neg.every((r) => (r.feasibilityGained ?? 0) > 0));
check('add_day (keep everything, just spend days) has the best ratio', neg[0].kind === 'add_day', neg[0].kind);

// ---- NO relaxation breaches a body gate --------------------------------------
const all = enumerateRelaxations(input, deps, { dayBudget: 8 });
check('the generator covers add_day, drop_node AND upgrade_mode', ['add_day', 'drop_node', 'upgrade_mode'].every((k) => all.some((c) => c.relaxation.kind === k)),
  all.map((c) => c.relaxation.kind).join(','));
check('NO relaxation re-solve breaches a body/hard gate', all.every((c) => hardViolations(c.plan) === 0),
  all.map((c) => `${c.relaxation.kind}:${hardViolations(c.plan)}`).join(' '));
check('NO relaxed plan carries the hard-constraint warning', all.every((c) => !c.plan.warnings.some((w) => /hard-constraint violation/i.test(w))));
const heavyOpt = all.find((c) => c.relaxation.kind === 'allow_1_heavy_day');
check('allow_1_heavy_day (when offered) costs comfort only — no ₹, nothing dropped', !heavyOpt ||
  (heavyOpt.relaxation.deltaCostPp === 0 && heavyOpt.relaxation.deltaDays === 0 && hardViolations(heavyOpt.plan) === 0));

// the upgrade actually prices the flight (real pool fare, not invented).
const up = neg.find((r) => r.kind === 'upgrade_mode');
check('upgrade_mode is priced from the real pool fare (> ₹0 per person)', !!up && up.deltaCostPp > 0, JSON.stringify({ deltaCostPp: up?.deltaCostPp }));
const drop = neg.find((r) => r.kind === 'drop_node');
check('drop_node names the city and saves travel-days (deltaDays < 0)', !!drop && drop.deltaDays < 0 && /Orchha/.test(drop.plainText), JSON.stringify({ deltaDays: drop?.deltaDays }));

// ---- feasible request → nothing to negotiate ---------------------------------
// A short all-light chain that fits its budget with no heavy day: fully feasible,
// so a senior expert has nothing to negotiate.
const feasibleInput: OptimizeInput = {
  cities: [{ name: 'Delhi', nights: 1 }, { name: 'Agra', nights: 1 }, { name: 'Gwalior', nights: 1 }],
  start: 'Delhi', end: 'Gwalior', objective: 'BALANCED', pax: 2, profile: 'senior', dayBudget: 5,
} as OptimizeInput;
const feasibleDeps: OptimizeDeps = {
  nodes: nodes.filter((n) => ['Delhi', 'Agra', 'Gwalior'].includes(n.name)),
  pool: new Map([['Delhi||Agra', pool.get('Delhi||Agra')!], ['Agra||Gwalior', pool.get('Agra||Gwalior')!]]),
};
const feasBase = solveForObjective(feasibleInput, feasibleDeps, 'BALANCED', 'feas');
check('the comfortable 3-city trip is fully feasible', needsNegotiation(feasBase, 5) === false, `days=${feasBase.days.length} rhythm=${feasBase.rhythm?.violations.length}`);
const feasible = negotiate(feasibleInput, feasibleDeps, { dayBudget: 5 });
check('a feasible request yields NO relaxations (nothing to negotiate)', feasible.length === 0, `len=${feasible.length}`);

// ---- additive on optimize(): plans[] + cards[] stay present ------------------
const res = optimize(input, deps);
check('optimize() attaches negotiation[] on the infeasible request', Array.isArray(res.negotiation) && (res.negotiation?.length ?? 0) === 3, `neg=${res.negotiation?.length}`);
check('plans[] is still present (loadFromOptimizer seam safe)', Array.isArray(res.plans) && res.plans.length >= 1);
check('cards[] is still present alongside negotiation', Array.isArray(res.cards) && (res.cards?.length ?? 0) >= 1);

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
