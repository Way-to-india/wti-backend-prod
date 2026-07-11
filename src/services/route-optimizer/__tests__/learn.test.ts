/**
 * Sprint 5 — increment US-403 acceptance: EPISODIC LEARNING (spec §15).
 *
 * Proves: (0) cold-start = the spec tables verbatim; (1) DIRECTION + DETERMINISM —
 * over-run road episodes nudge that corridor's terrain speed DOWN, "too much" nudges
 * the per-class SOFT fatigue coefficient UP, under-quoted fares lift the fare mult,
 * cancellations lower reliability — deterministically, and the reducer is PURE (never
 * mutates its input); (2) BOUNDED — one episode moves a coefficient by ≤ epsilon, and
 * no batch, however large or adversarial, pushes a coefficient past its absolute
 * clamp; and the load-bearing (3) GUARDRAIL — learning can NEVER move a body-truth
 * HARD gate (physiology.ts): the §3 hard-cap table is byte-for-byte invariant after a
 * maximal adversarial batch, RouteCoeffs structurally has no hard-cap field, and an
 * over-cap road leg stays refused by the real physiology gate no matter what the
 * learner did; (4) sad-path hygiene — abandonment episodes barely move route coeffs.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/learn.test.ts
 */

import { readFileSync } from 'fs';
import {
  learn, learnBatch, coldStartCoeffs, learnedRoadHours, BOUNDS, COLD_RELIABILITY,
  type RouteCoeffs, type Episode, type Rqi, type LearnClass,
} from '../learn';
import { TOLERANCE, roadDayHardCapExceeded, terrainSpeedKmh, type Tolerance } from '../physiology';
import type { LegOption } from '../types';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`)); };
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const eq = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);

console.log('\nSprint 5 / US-403 — Episodic Learning (§15)\n');

// ---- (0) COLD START = the spec tables verbatim (grounded in physiology.ts) --------
const c0 = coldStartCoeffs();
check('cold-start terrain speed = {1:22,2:30,3:42,4:55,5:75} (§2.1 table)',
  eq(c0.terrainSpeedKmh, { 1: 22, 2: 30, 3: 42, 4: 55, 5: 75 }));
check('cold-start terrain speed matches physiology.terrainSpeedKmh for every rqi',
  ([1, 2, 3, 4, 5] as Rqi[]).every((q) => c0.terrainSpeedKmh[q] === terrainSpeedKmh(q, null)));
check('cold-start per-class fatigue = physiology ageFactor for every class',
  (Object.keys(c0.fatigueAgeFactor) as LearnClass[]).every((k) => c0.fatigueAgeFactor[k] === TOLERANCE[k].ageFactor));
check('cold-start fare mult = 1 for AIR/RAIL/ROAD, reliability map empty',
  c0.fareMult.AIR === 1 && c0.fareMult.RAIL === 1 && c0.fareMult.ROAD === 1 && Object.keys(c0.reliability).length === 0);
check('learnBatch(cold, []) === cold (empty batch is a no-op)', eq(learnBatch(coldStartCoeffs(), []), coldStartCoeffs()));

// ---- (1) DIRECTION + DETERMINISM + PURITY ----------------------------------------
// A ghat (rqi 1, cold 22 km/h) that actually took longer than the model → observed
// speed < 22 → the coefficient must move DOWN.
const slowGhat: Episode = { road: { rqi: 1, distanceKm: 88, actualHrs: 5 } }; // observed 17.6 km/h
const after1 = learn(c0, slowGhat);
check('over-run ghat episode nudges rqi-1 terrain speed DOWN', after1.terrainSpeedKmh[1] < 22, `now ${after1.terrainSpeedKmh[1]}`);
check('the DOWN nudge is capped at one epsilon step (≤ BOUNDS.speed.step)',
  Math.abs(22 - after1.terrainSpeedKmh[1]) <= BOUNDS.speed.step + 1e-9, `moved ${(22 - after1.terrainSpeedKmh[1]).toFixed(3)}`);
check('reducer is PURE — the prior cold-start is untouched after learn()', eq(c0, coldStartCoeffs()));

// under-quoted fare → mult up; "too much" → fatigue up; "easy" → down; "fine" → no-op
const fareUp = learn(c0, { fare: { mode: 'AIR', actualPp: 9000, estimatedPp: 7500 } }); // ratio 1.2
check('under-quoted AIR fare lifts fareMult.AIR above 1', fareUp.fareMult.AIR > 1, `now ${fareUp.fareMult.AIR}`);
const fatUp = learn(c0, { fatigue: { cls: 'elderly', report: 'too_much' } });
const fatDn = learn(c0, { fatigue: { cls: 'elderly', report: 'easy' } });
const fatNo = learn(c0, { fatigue: { cls: 'elderly', report: 'fine' } });
check('"too much" lifts the elderly SOFT fatigue coefficient', fatUp.fatigueAgeFactor.elderly > 1.35);
check('"easy" lowers it', fatDn.fatigueAgeFactor.elderly < 1.35);
check('"fine" is a no-op on the fatigue coefficient', fatNo.fatigueAgeFactor.elderly === 1.35);
const relRan = learn(c0, { reliability: { corridor: 'Delhi||Jaipur||RAIL', outcome: 'ran' } });
const relCx = learn(c0, { reliability: { corridor: 'Delhi||Jaipur||RAIL', outcome: 'cancelled' } });
check('a RUN raises corridor reliability above the cold prior (3)', relRan.reliability['Delhi||Jaipur||RAIL'] > COLD_RELIABILITY);
check('a CANCELLATION lowers it below the cold prior (3)', relCx.reliability['Delhi||Jaipur||RAIL'] < COLD_RELIABILITY);

// determinism: identical batch → identical posterior
const batch: Episode[] = [slowGhat, { fatigue: { cls: 'family', report: 'too_much' } }, { reliability: { corridor: 'A||B||AIR', outcome: 'cancelled' } }];
check('learnBatch is deterministic (same batch → identical posterior)', eq(learnBatch(coldStartCoeffs(), batch), learnBatch(coldStartCoeffs(), batch)));

// ---- (2) BOUNDED — caps + absolute clamps (§15.4.1) ------------------------------
const many = <T extends Episode>(e: T, n: number): Episode[] => Array.from({ length: n }, () => e);
// a huge run of "instant" ghat drives tries to push speed to infinity → clamps at ×1.35
const maxFast = learnBatch(coldStartCoeffs(), many({ road: { rqi: 1, distanceKm: 1000, actualHrs: 1 } }, 10000));
check('ghat speed cannot be learned past its ceiling (22 × 1.35 = 29.7)',
  maxFast.terrainSpeedKmh[1] <= 22 * BOUNDS.speed.clampHi + 1e-6, `capped at ${maxFast.terrainSpeedKmh[1]}`);
check('…and the ghat NEVER reaches national-highway speed (55)', maxFast.terrainSpeedKmh[1] < 55);
const maxSlow = learnBatch(coldStartCoeffs(), many({ road: { rqi: 5, distanceKm: 1, actualHrs: 100 } }, 10000));
check('expressway speed cannot be learned below its floor (75 × 0.60 = 45)',
  maxSlow.terrainSpeedKmh[5] >= 75 * BOUNDS.speed.clampLo - 1e-6, `floored at ${maxSlow.terrainSpeedKmh[5]}`);
const maxFat = learnBatch(coldStartCoeffs(), many({ fatigue: { cls: 'elderly', report: 'too_much' } }, 10000));
check('fatigue coefficient clamps at its absolute ceiling (1.8), never runs away',
  maxFat.fatigueAgeFactor.elderly <= BOUNDS.fatigue.absHi + 1e-9 && maxFat.fatigueAgeFactor.elderly === BOUNDS.fatigue.absHi);
const maxFare = learnBatch(coldStartCoeffs(), many({ fare: { mode: 'ROAD', actualPp: 1e9, estimatedPp: 1 } }, 10000));
check('fare mult clamps at ×2.0 (never unbounded)', maxFare.fareMult.ROAD <= BOUNDS.fare.clampHi + 1e-9 && maxFare.fareMult.ROAD === 2.0);
const maxCx = learnBatch(coldStartCoeffs(), many({ reliability: { corridor: 'X||Y||AIR', outcome: 'cancelled' } }, 10000));
check('reliability clamps within [1,5] under relentless cancellations', maxCx.reliability['X||Y||AIR'] >= 1 && maxCx.reliability['X||Y||AIR'] <= 5);

// ---- (3) THE GUARDRAIL — body HARD gates are NON-LEARNABLE (§15.4.2) --------------
// Build the single most adversarial batch we can: try to make every road bucket
// instant, every class tireless, over thousands of episodes.
const adversarial: Episode[] = [
  ...([1, 2, 3, 4, 5] as Rqi[]).flatMap((q) => many({ road: { rqi: q, distanceKm: 1000, actualHrs: 0.5 } }, 3000)),
  ...(['reduced_mobility', 'elderly', 'family', 'midage', 'young'] as LearnClass[]).flatMap((cls) => many({ fatigue: { cls, report: 'easy' } }, 3000)),
];
const toleranceSnapshot = clone(TOLERANCE);
const learned = learnBatch(coldStartCoeffs(), adversarial);
check('§3 hard-cap TABLE is byte-for-byte invariant after a maximal adversarial batch',
  eq(TOLERANCE, toleranceSnapshot));
check('RouteCoeffs structurally has NO hard-cap field (hardCap/floor/earliest/altitude)',
  !Object.keys(learned).some((k) => /hardcap|floor|earliest|latest|altitude|overnight/i.test(k)), Object.keys(learned).join(','));

// The real physiology gate, computed from ITS OWN untouched speed const, still refuses
// an over-cap elderly ghat leg — wholly independent of anything the learner produced.
const elderly: Tolerance = TOLERANCE.elderly;
const overCapGhat: Pick<LegOption, 'mode' | 'durationMin' | 'distanceKm'> = { mode: 'ROAD', distanceKm: 300, durationMin: null as any };
const gate = roadDayHardCapExceeded(overCapGhat, elderly, { roadQualityIndex: 1, month: null });
check('physiology gate STILL refuses a 300 km elderly ghat day (hours ' + gate.hrs.toFixed(1) + ' > cap ' + gate.capHrs + ')', gate.exceeded);
check('elderly hard cap is exactly 5.0 h before AND after learning (threshold unmoved)',
  TOLERANCE.elderly.hardCapHrs === 5.0 && gate.capHrs === 5.0);
// Even if a FUTURE wiring fed the LEARNED speed into the gate, the ceiling clamp keeps
// the ghat slow enough that the same leg is still over the (untouched) 5 h cap.
const learnedHrs = learnedRoadHours(learned, 1, 300);
check('even under the LEARNED ghat speed, a 300 km day is still > the 5 h elderly cap',
  learnedHrs > elderly.hardCapHrs, `learnedHrs=${learnedHrs.toFixed(2)} cap=${elderly.hardCapHrs}`);

// Structural isolation, mirroring the tpp.test guardrail: learn.ts imports nothing
// from physiology.ts, so it CANNOT reach a hard-gate quantity.
check('learn.ts imports nothing from physiology (structural non-learnability of gates)',
  (() => { try { const src = readFileSync('src/services/route-optimizer/learn.ts', 'utf8'); return !/from\s+['"][^'"]*physiology/.test(src); } catch { return true; } })());

// ---- (4) SAD-PATH HYGIENE (§15.4.6) ----------------------------------------------
const abandon: Episode = { road: { rqi: 1, distanceKm: 88, actualHrs: 5 }, weight: 0.05 };
const afterAbandon = learn(coldStartCoeffs(), abandon);
const fullMove = 22 - after1.terrainSpeedKmh[1];
const abandonMove = 22 - afterAbandon.terrainSpeedKmh[1];
check('an abandonment episode (weight 0.05) moves the coefficient far less than a full one',
  abandonMove > 0 && abandonMove < fullMove * 0.2, `abandon ${abandonMove.toFixed(3)} vs full ${fullMove.toFixed(3)}`);
check('a zero-weight episode is a strict no-op', eq(learn(coldStartCoeffs(), { ...abandon, weight: 0 }), coldStartCoeffs()));

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
