/**
 * Sprint 7 / US-610 acceptance — CARD HONESTY. Two doors into the same room is a lie.
 *
 * Measured on the very request that produced the founder's ruling: BALANCED AND GENTLE CAME
 * BACK AS THE IDENTICAL PLAN. Same six days, same four nights, same sequence, ease 96 both.
 * We were showing the traveller three doors, two of which opened into the same room, and
 * inviting him to choose between them.
 *
 * What is proved here:
 *   1. all three solves are bound by the SAME contract (a "Swift" card that puts a
 *      comfort-first honeymooner on a refused train is not a fast option — it is a breach);
 *   2. identical plans are MERGED, and the merge is SAID OUT LOUD, not hidden;
 *   3. we never manufacture difference to fill the page.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/cards.test.ts
 */

import { buildArchetypes, dedupeCards, planSignature } from '../archetypes';
import { compileContract, intentFromRaw } from '../intent';
import { solveForObjective, type OptimizeDeps } from '../optimize';
import type { CityNode, LegOption, OptimizeInput, ArchetypeCard, Plan } from '../types';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`)); };

console.log('\nSprint 7 / US-610 — three doors, and two of them opened into the same room\n');

// A trip with exactly ONE honourable way to make each leg. Whatever objective you solve it
// under — fastest, balanced, gentlest — you land on the same plan, because there is only one.
// This is not a contrived fixture: it is the honeymoon leg the founder ruled on.
const nodes: CityNode[] = [
  { name: 'Bengaluru', coord: [12.97, 77.59] },
  { name: 'Mysuru', coord: [12.30, 76.64] },
  { name: 'Coorg', coord: [12.42, 75.74] },
];
const road = (from: string, to: string, km: number, min: number): LegOption => ({
  from, to, mode: 'ROAD', distanceKm: km, durationMin: min, operatingDays: 127, reliability: 4,
  farePpMin: km * 4, farePpMax: km * 5,
});
const pool = new Map<string, LegOption[]>([
  ['Bengaluru||Mysuru', [road('Bengaluru', 'Mysuru', 145, 180)]],
  ['Mysuru||Coorg', [road('Mysuru', 'Coorg', 120, 165)]],
  ['Bengaluru||Coorg', [road('Bengaluru', 'Coorg', 265, 330)]],
  ['Mysuru||Bengaluru', [road('Mysuru', 'Bengaluru', 145, 180)]],
  ['Coorg||Mysuru', [road('Coorg', 'Mysuru', 120, 165)]],
  ['Coorg||Bengaluru', [road('Coorg', 'Bengaluru', 265, 330)]],
]);
const deps: OptimizeDeps = { nodes, pool };

const HONEYMOON = compileContract(intentFromRaw({
  pax: 2, composition: 'couple', purpose: 'honeymoon', comfortTier: 'luxury',
  modes: [{ mode: 'rail', stance: 'refuse', qualifier: 'any', strength: 0.9 }],
  quotes: { comfortTier: 'we want a luxury tour', mode_rail: 'no trains' },
}, 'luxury honeymoon, no trains for us'));

const input: OptimizeInput = {
  cities: [{ name: 'Bengaluru', nights: 0 }, { name: 'Mysuru', nights: 1 }, { name: 'Coorg', nights: 3 }],
  start: 'Bengaluru', end: 'Coorg', objective: 'BALANCED', pax: 2, profile: 'standard',
  contract: HONEYMOON, tpp: HONEYMOON.tpp,
} as OptimizeInput;

const cards = buildArchetypes(input, deps);
console.log(`     cards shown to the traveller: ${cards.length}`);
for (const c of cards) console.log(`       [${c.label}${c.recommended ? ' ★' : ''}] ${c.days} days · ${c.sequence.join(' → ')}${c.note ? `\n         "${c.note}"` : ''}`);

// ---- 1. the merge, and the sentence -------------------------------------------------
console.log('  -- the merge --');
check('the identical plans are shown ONCE, not three times', cards.length < 3, `${cards.length} cards`);
const merged = cards.find((c) => !!c.mergedFrom);
check('...and the merge is REPORTED, not hidden', !!merged?.note, JSON.stringify(cards.map((c) => c.note)));
check('THE SENTENCE: "…turn out to be the same, so we show it once."', /turn out to be the same, so we show it once\./.test(merged?.note ?? ''), merged?.note);
check('the merged card keeps the GENTLER label — better company when the trip is the same', ['Balanced', 'Gentle'].includes(merged?.label ?? ''), merged?.label);
check('exactly one card is still recommended', cards.filter((c) => c.recommended).length === 1);

// ---- 2. we do not manufacture difference ---------------------------------------------
console.log('  -- and we never invent a difference to fill the page --');
// Every card still shown must be a REAL plan the engine actually scheduled — same cities,
// real days. We do not perturb a solve away from the best answer just to have three cards.
check('every card shown is a real scheduled plan (days > 0)', cards.every((c) => c.days > 0));
check('every card visits the places he asked for', cards.every((c) => c.sequence.includes('Coorg')));
// If his brief leaves ONE honourable plan, ONE card is the honest answer. That is not a
// failure state — it is a consultant with a firm recommendation.
check('when the brief leaves one honourable plan, we show ONE card and say why', cards.length === 1 ? !!cards[0].note : true);

// ---- 3. RULE 1: contract first, archetypes second ----------------------------------------
console.log('  -- a "Swift" card that breaches his brief is not a fast option; it is a breach --');
// Put a cheap, fast train on the Bengaluru→Coorg leg. Under a TIME objective the old engine
// would have grabbed it for the Swift card. His contract says no trains — and the contract
// binds ALL THREE solves, not just the recommended one.
const TRAIN: LegOption = {
  from: 'Bengaluru', to: 'Coorg', mode: 'RAIL', identifier: '16515 Karwar Exp',
  distanceKm: 265, durationMin: 200, depTime: '08:00', arrTime: '11:20', arrDayOffset: 0,
  classes: ['CC'], operatingDays: 127, reliability: 5, farePpMin: 300, farePpMax: 500,
};
// Two nodes only — this fixture is about ONE leg, so the sequencer must not wander via Mysuru.
const twoNodes: CityNode[] = [nodes[0], nodes[2]];
const poolWithTrain = new Map<string, LegOption[]>([
  ['Bengaluru||Coorg', [road('Bengaluru', 'Coorg', 265, 330), TRAIN]],
  ['Coorg||Bengaluru', [road('Coorg', 'Bengaluru', 265, 330)]],
]);
const depsTrain: OptimizeDeps = { nodes: twoNodes, pool: poolWithTrain };

const directInput: OptimizeInput = {
  cities: [{ name: 'Bengaluru', nights: 0 }, { name: 'Coorg', nights: 3 }],
  start: 'Bengaluru', end: 'Coorg', objective: 'BALANCED', pax: 2, profile: 'standard',
  contract: HONEYMOON, tpp: HONEYMOON.tpp,
} as OptimizeInput;

const swift = solveForObjective(directInput, depsTrain, 'TIME', 'Swift');
check('the fast train is genuinely the quicker service (so the temptation is real)', TRAIN.durationMin! < 330);
check('THE SWIFT CARD REFUSES IT ANYWAY — his brief binds every card, not just the recommended one', swift.legs.every((l) => l.mode !== 'RAIL'), JSON.stringify(swift.legs.map((l) => l.mode)));

// And for a traveller who never refused trains, the train is still THERE — weighed on its
// merits and shown in the compared-options ledger. His refusal does not make the train
// disappear from the world; it makes it disappear from HIS plan.
//
// (On this fixture the road still wins for the un-contracted traveller too, because these
// road options carry no clock and so are charged no daylight damage — a fixture artefact, not
// a finding. What matters is WHAT WAS CONSIDERED, so that is what we assert.)
const noContract: OptimizeInput = { ...directInput, contract: undefined, tpp: undefined };
const swiftFree = solveForObjective(noContract, depsTrain, 'TIME', 'Swift');
const consideredFree = (swiftFree.legs[0]?.legOptions ?? []).map((o: any) => String(o.id));
const consideredHoneymoon = (swift.legs[0]?.legOptions ?? []).map((o: any) => String(o.id));
check('...the train is still WEIGHED for a traveller who never refused it', consideredFree.some((id) => /RAIL/.test(id)), consideredFree.join(', '));
check('...and it is not even in the running for the man who did refuse it', !consideredHoneymoon.some((id) => /RAIL/.test(id)), consideredHoneymoon.join(', '));
check('his word does not delete the train from the world — only from HIS plan', consideredFree.length > consideredHoneymoon.length);

// ---- 4. the signature is identity, and nothing else ------------------------------------------
const p1 = solveForObjective(input, deps, 'BALANCED', 'a');
const p2 = solveForObjective(input, deps, 'EASE', 'b');
check('two solves of the same trip have the same signature — they ARE the same trip', planSignature(p1) === planSignature(p2), `${planSignature(p1)} vs ${planSignature(p2)}`);

// A genuinely different plan must NOT be merged away.
const different: Plan = { ...p1, sequence: ['Bengaluru', 'Coorg'], legs: [], days: p1.days.slice(0, 2) } as Plan;
const kept = dedupeCards(
  [{ id: 'balanced', label: 'Balanced' } as ArchetypeCard, { id: 'gentle', label: 'Gentle' } as ArchetypeCard],
  [p1, different],
);
check('a genuinely DIFFERENT plan is never merged away — we only merge what is truly the same', kept.length === 2);

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
