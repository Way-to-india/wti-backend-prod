/**
 * Sprint 3 — increment 3 acceptance: THREE ARCHETYPES (spec §8, handoff §4).
 *
 * Proves the Pareto space collapses into Swift / Balanced / Gentle cards that
 * DIFFER EXPLAINABLY, that `recommended` lands on Gentle for a senior party, and
 * that `plans[]` stays present + unchanged (the loadFromOptimizer seam is safe).
 *
 * The divergence is proven at TWO levels:
 *   (1) the raw solver: solveForObjective('TIME') flies the long leg where
 *       solveForObjective('EASE') takes the overnight train — the mechanism;
 *   (2) the cards: Gentle's easeScore ≥ Swift's, and the two cards are not identical.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/archetypes.test.ts
 */

import { optimize, solveForObjective, type OptimizeDeps } from '../optimize';
import { buildArchetypes, isSeniorParty } from '../archetypes';
import type { CityNode, LegOption, OptimizeInput } from '../types';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`)); };

console.log('\nSprint 3 / inc-3 — three archetypes (Swift / Balanced / Gentle)\n');

// ---- fixture: a short road hop + one long corridor that carries BOTH a civil
//      daytime flight AND a comfortable 2A overnight train, so TIME flies and EASE
//      rails on the same leg. Synthetic pool — the engine is fixture-driven. -------
const nodes: CityNode[] = [
  { name: 'Delhi',  coord: [28.6139, 77.2090], profile: {} },
  { name: 'Jaipur', coord: [26.9124, 75.7873], profile: {} },
  { name: 'Mumbai', coord: [19.0760, 72.8777], profile: {} },
];
const pool = new Map<string, LegOption[]>([
  ['Delhi||Jaipur', [
    { from: 'Delhi', to: 'Jaipur', mode: 'ROAD', distanceKm: 280, durationMin: 300, operatingDays: 127, reliability: 5, source: 'osrm' },
  ]],
  ['Jaipur||Mumbai', [
    // fast morning flight — civil dep for a mid-age party (effective wake 08:30)
    { from: 'Jaipur', to: 'Mumbai', mode: 'AIR', identifier: '6E 6512', distanceKm: 1150, durationMin: 105, depTime: '10:00', arrTime: '11:45', operatingDays: 127, reliability: 4, farePpMin: 5200, farePpMax: 7200, source: 'air-sched' },
    // comfortable 2A overnight train — dep evening, arr next morning
    { from: 'Jaipur', to: 'Mumbai', mode: 'RAIL', identifier: '12956 Jaipur-Mumbai SF', classes: ['2A', '3A'], distanceKm: 1160, durationMin: 750, depTime: '20:15', arrTime: '08:45', arrDayOffset: 1, operatingDays: 127, reliability: 4, farePpMin: 1500, farePpMax: 2100, source: 'ir' },
  ]],
]);
const deps: OptimizeDeps = { nodes, pool };

const baseInput = (profile: 'standard' | 'senior'): OptimizeInput => ({
  cities: [{ name: 'Delhi', nights: 1 }, { name: 'Jaipur', nights: 1 }, { name: 'Mumbai', nights: 2 }],
  start: 'Delhi', end: 'Mumbai', objective: 'BALANCED', pax: 2, profile,
} as OptimizeInput);

// ---- (1) the MECHANISM: TIME flies where EASE rails --------------------------
const swiftPlan = solveForObjective(baseInput('standard'), deps, 'TIME', 'Swift');
const gentlePlan = solveForObjective(baseInput('standard'), deps, 'EASE', 'Gentle');
const swiftLeg = swiftPlan.legs.find((l) => l.from === 'Jaipur' && l.to === 'Mumbai');
const gentleLeg = gentlePlan.legs.find((l) => l.from === 'Jaipur' && l.to === 'Mumbai');
check('Swift (TIME) flies the long leg', swiftLeg?.mode === 'AIR', `mode=${swiftLeg?.mode} id=${swiftLeg?.identifier}`);
check('Gentle (EASE) takes the overnight train on the same leg', gentleLeg?.mode === 'RAIL', `mode=${gentleLeg?.mode} id=${gentleLeg?.identifier}`);
check('the overnight-train leg is flagged overnight (a hotel night saved)', gentleLeg?.overnight === true, JSON.stringify({ overnight: gentleLeg?.overnight }));

// ---- (2) the CARDS: standard party ------------------------------------------
const res = optimize(baseInput('standard'), deps);
const cards = res.cards ?? [];
check('optimize() emits three cards', cards.length === 3, `len=${cards.length}`);
check('cards are Swift, Balanced, Gentle in order', cards.map((c) => c.id).join(',') === 'swift,balanced,gentle', cards.map((c) => c.id).join(','));
check('each card carries the design contract fields', cards.every((c) =>
  typeof c.label === 'string' && typeof c.days === 'number' && typeof c.hotelNights === 'number' &&
  Array.isArray(c.sequence) && Array.isArray(c.fatigue) && typeof c.easeScore === 'number' &&
  c.totals && typeof c.totals.easeScore === 'number' && 'costPpBand' in c),
  JSON.stringify(cards[0]));
check('flat mirrors match the nested totals (data.js binding safe)', cards.every((c) =>
  c.easeScore === c.totals.easeScore && JSON.stringify(c.costPpBand) === JSON.stringify(c.totals.costPpBand)));
check('fatigue[] length equals the card day count', cards.every((c) => c.fatigue.length === c.days), JSON.stringify(cards.map((c) => [c.days, c.fatigue.length])));

const swift = cards.find((c) => c.id === 'swift')!;
const gentle = cards.find((c) => c.id === 'gentle')!;
// EXPLAINABLE DIFFERENCE — the spec-required inequality + a visible, card-level delta.
check('Gentle is at least as easy as Swift (easeScore ≥)', gentle.easeScore >= swift.easeScore, `gentle=${gentle.easeScore} swift=${swift.easeScore}`);
check('Swift costs more per person than Gentle (flight vs overnight rail)',
  (swift.costPpBand?.[1] ?? 0) > (gentle.costPpBand?.[1] ?? 0), JSON.stringify({ swift: swift.costPpBand, gentle: gentle.costPpBand }));
check('Swift and Gentle are not identical cards (they differ explainably)', JSON.stringify(swift) !== JSON.stringify(gentle));

// ---- recommended: standard → Balanced (the expert's pick) --------------------
check('standard party is not classified senior', isSeniorParty(baseInput('standard')) === false);
const recStd = cards.filter((c) => c.recommended);
check('exactly one card is recommended', recStd.length === 1, `count=${recStd.length}`);
check('for a standard party the recommended card is Balanced', recStd[0]?.id === 'balanced', recStd[0]?.id);

// ---- recommended: senior → Gentle -------------------------------------------
const resSenior = optimize(baseInput('senior'), deps);
const cardsSenior = resSenior.cards ?? [];
check('senior party is classified senior', isSeniorParty(baseInput('senior')) === true);
const recSenior = cardsSenior.filter((c) => c.recommended);
check('exactly one senior card is recommended', recSenior.length === 1, `count=${recSenior.length}`);
check('for a senior party the recommended card is Gentle', recSenior[0]?.id === 'gentle', recSenior[0]?.id);

// ---- plans[] still present + unchanged (loadFromOptimizer seam safe) ----------
check('plans[] is still present alongside cards', Array.isArray(res.plans) && res.plans.length >= 1, `plans=${res.plans?.length}`);
check('plans[0] is a full plan (sequence + days)', !!res.plans[0] && Array.isArray(res.plans[0].sequence) && res.plans[0].days.length > 0);
check('senior solve also keeps plans[] present', Array.isArray(resSenior.plans) && resSenior.plans.length >= 1);

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
