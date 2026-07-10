/**
 * Sprint 2 — Story 3 acceptance: PEARL-ON-THE-STRING split (spec §4.4).
 *
 * Pure tests over chooseAnchor / evaluateAnchor (no DB) + one dayExpand integration:
 *   - a real, on-route, ≥½-day anchor is SELECTED to split an over-cap road leg;
 *   - an off-route candidate whose detour > 15 % is REJECTED even at higher value;
 *   - a < ½-day candidate is rejected (not worth a halt);
 *   - a corridor too long for any single-anchor split within the cap → DEAD HALT
 *     (prefer re-sequencing, never dump the travellers at a junction town);
 *   - dayExpand attaches leg.pearlSplit when anchor candidates are injected.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/anchors.test.ts
 */

import {
  chooseAnchor, evaluateAnchor, anchorValueFromCounts,
  MAX_DETOUR_PCT, MIN_ANCHOR_VALUE_DAYS, type AnchorCandidate,
} from '../anchors';
import { TOLERANCE } from '../physiology';
import { expandDays } from '../dayExpand';
import type { CityNode, LegOption } from '../types';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

const midage = TOLERANCE.midage;   // 7 h cap
const elderly = TOLERANCE.elderly; // 5 h cap

console.log('\nSprint 2 / Story 3 — pearl-on-the-string split\n');

// A west→east corridor (~374 km road, ~6.8 h): needs a split for most parties.
const A: readonly [number, number] = [26.0, 74.0];
const B: readonly [number, number] = [26.0, 77.0];

const onRoute: AnchorCandidate = { name: 'MidTown', coord: [26.0, 75.5], valueDays: 0.5, source: 'curated' };
const offRoute: AnchorCandidate = { name: 'NorthDetour', coord: [27.0, 75.5], valueDays: 1.0, source: 'curated' };
const lowValue: AnchorCandidate = { name: 'DhabaHalt', coord: [26.0, 75.5], valueDays: 0.25, source: 'generic' };

console.log('§4.4 three-part gate:');
const eOn = evaluateAnchor(A, B, onRoute, midage);
check('on-route ½-day anchor passes all three gates', eOn.ok, eOn.reasons.join('; '));
check('  its detour is ≤ 15%', eOn.detourPct <= MAX_DETOUR_PCT, `${(eOn.detourPct * 100).toFixed(0)}%`);
check('  both sub-legs within cap', eOn.subLegs[0].hrs <= midage.hardCapHrs && eOn.subLegs[1].hrs <= midage.hardCapHrs);

const eOff = evaluateAnchor(A, B, offRoute, midage);
check('off-route anchor detour > 15% → fails', !eOff.ok && eOff.detourPct > MAX_DETOUR_PCT, `${(eOff.detourPct * 100).toFixed(0)}%`);

const eLow = evaluateAnchor(A, B, lowValue, midage);
check(`< ${MIN_ANCHOR_VALUE_DAYS}-day candidate → fails on value`, !eLow.ok && eLow.reasons.some((r) => /value/.test(r)));

console.log('\nchooseAnchor picks the pearl, not the detour:');
const pick = chooseAnchor(A, B, [offRoute, onRoute, lowValue], midage);
check('a real anchor is chosen (not a dead halt)', pick.deadHalt === false && pick.anchor !== null);
check('the SELECTED anchor is the on-route MidTown, beating the higher-value detour', pick.anchor?.name === 'MidTown', pick.anchor?.name);

console.log('\ndead halt when no single anchor can split within the cap:');
// A very long corridor (~750 km road, ~13.6 h): even a perfect midpoint leaves each
// half ~6.8 h — over the elderly 5 h cap → dead halt, prefer re-sequencing.
const farB: readonly [number, number] = [26.0, 80.0];
const midOnly: AnchorCandidate = { name: 'HalfwayCity', coord: [26.0, 77.0], valueDays: 1.0, source: 'curated' };
const dead = chooseAnchor(A, farB, [midOnly], elderly);
check('over-long corridor for an elderly party → dead halt', dead.deadHalt === true && dead.anchor === null, dead.reason);

console.log('\nanchorValueFromCounts (generic value derivation):');
check('more tours/monuments → not-lower value (monotone)', anchorValueFromCounts(3, 2) >= anchorValueFromCounts(1, 0));
check('value is capped at 1.5 days', anchorValueFromCounts(50, 50) === 1.5);
check('quantized to ¼-day steps', (anchorValueFromCounts(1, 1) * 4) % 1 === 0);

// ---- dayExpand integration: pearlSplit attaches when anchors are injected -----
console.log('\ndayExpand attaches pearlSplit on an over-cap road leg:');
const nodes = new Map<string, CityNode>([
  ['A', { name: 'A', coord: [26.0, 74.0] }],
  ['B', { name: 'B', coord: [26.0, 77.0] }],
]);
const roadLeg: LegOption = { from: 'A', to: 'B', mode: 'ROAD', identifier: null, distanceKm: 374, durationMin: null, operatingDays: 127, reliability: 4 };
const chosen = new Map<string, LegOption>([['A||B', roadLeg]]);
const out = expandDays({
  sequence: ['A', 'B'],
  nights: new Map([['A', 1], ['B', 1]]),
  nodes,
  chosen,
  profile: 'senior', // 5 h cap → 374 km / ~6.8 h is over cap
  anchorsByLeg: new Map([['A||B', [onRoute]]]),
});
const bLeg = out.legs.find((l) => l.to === 'B');
check('the over-cap senior road leg carries a pearlSplit', !!bLeg?.pearlSplit, JSON.stringify(bLeg?.pearlSplit));
check('  pearlSplit names the on-route anchor', bLeg?.pearlSplit?.anchor === 'MidTown');
check('  a warning explains the split to the desk', out.warnings.some((w) => /MidTown/.test(w)));

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
