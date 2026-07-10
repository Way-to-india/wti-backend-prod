/**
 * Sprint 1 acceptance — "Body Truth & Honest Costs" (stories A1 + A2).
 *
 * Gate (a): elderly party, 220 km HILL leg → refused as a single road day (hour cap,
 *           not km).
 * Gate (b): 850 km leg, nearest airport ~250 km away → the same-day road+fly composite
 *           is REFUSED on honest grounds (chronotype/fatigue), AND a direct overnight
 *           train WINS on DDCV. No refusal is hardcoded.
 * Condition (2): if the corridor has NO overnight train, the leg must fail gracefully
 *           (infeasible / needs-negotiation) — NEVER fall back to a road+fly chain.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/sprint1.test.ts
 */

import {
  TOLERANCE, vehicleHours, roadDayHardCapExceeded,
  terrainSpeedKmh, derivedKmCap,
} from '../physiology';
import { ddcv, chooseByDDCV, weightsForObjective, airportViaNodeCtx, type LegCtx } from '../ddcv';
import type { LegOption } from '../types';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

const elderly = TOLERANCE.elderly;
const EASE = weightsForObjective('EASE');

console.log('\nSprint 1 acceptance test\n');

// ---- A1: hours-not-km + derived km cap --------------------------------------
console.log('A1 body-truth (hours, not km):');
check('terrain speed: hill (rqi2) slower than NH (rqi4)', terrainSpeedKmh(2) < terrainSpeedKmh(4));
check('monsoon slows a ghat road', terrainSpeedKmh(2, 7) < terrainSpeedKmh(2, 1));
const kmCapElderly = derivedKmCap(elderly);
check('350 km/day survives as a DERIVED case (elderly ~275 km on NH)', kmCapElderly >= 260 && kmCapElderly <= 290, `got ${kmCapElderly}`);

// gate (a): 220 km HILL leg for an elderly party
const hillLeg: LegOption = { from: 'Shimla', to: 'Sarahan', mode: 'ROAD', distanceKm: 220, durationMin: 420 };
const plainLeg: LegOption = { from: 'Delhi', to: 'Agra', mode: 'ROAD', distanceKm: 220, durationMin: 240 };
const hillHrs = vehicleHours(hillLeg);
check('220 km hill leg is ~7 vehicle-hours (not "220 km")', hillHrs >= 6.5, `got ${hillHrs}`);
check('gate (a): 220 km HILL leg REFUSED as a single elderly road day', roadDayHardCapExceeded(hillLeg, elderly).exceeded === true);
check('control: 220 km EXPRESSWAY leg (4 h) is allowed for elderly', roadDayHardCapExceeded(plainLeg, elderly).exceeded === false);
check('control: same 220 km hill leg is allowed for YOUNG (9 h cap)', roadDayHardCapExceeded(hillLeg, TOLERANCE.young).exceeded === false);
check('Ramayana compat: 213 km / 5.0 h senior drive stays feasible', roadDayHardCapExceeded({ from: 'a', to: 'b', mode: 'ROAD', distanceKm: 213, durationMin: 300 }, elderly).exceeded === false);

// ---- A2: DDCV honest far-airport case (gate b) ------------------------------
console.log('\nA2 DDCV — gate (b) 850 km, nearest airport ~250 km away:');
const baseCtx: LegCtx = { tol: elderly, pax: 2, month: 11 };

const roadOpt: LegOption = { from: 'A', to: 'B', mode: 'ROAD', distanceKm: 850, durationMin: 900, reliability: 4 };
const roadV = ddcv(roadOpt, baseCtx);
check('pure 850 km road is HARD-BLOCKED (over hour cap)', roadV.hardBlock === true, roadV.blockReasons.join('; '));

const flightOpt: LegOption = { from: 'A', to: 'B', mode: 'AIR', identifier: '6E 123', distanceKm: 850, durationMin: 95, depTime: '08:30', arrTime: '10:05', arrDayOffset: 0, operatingDays: 127, reliability: 4 };
const composite = ddcv(flightOpt, airportViaNodeCtx(baseCtx, 5.5, 1800));
check('gate (b): same-day road+fly composite is REFUSED on chronotype grounds', composite.hardBlock === true, composite.blockReasons.join('; '));
check('  ...refusal names the access-adjusted early start (honest, not hardcoded)', composite.blockReasons.some((r) => /07:30 floor|access-adjusted/.test(r)));

const overnightTrain: LegOption = { from: 'A', to: 'B', mode: 'RAIL', identifier: '12649 Sampark Kranti', distanceKm: 820, durationMin: 580, depTime: '21:00', arrTime: '06:40', arrDayOffset: 1, operatingDays: 127, classes: ['SL', '3A', '2A'], reliability: 5 };
const trainV = ddcv(overnightTrain, baseCtx);
check('overnight train is NOT blocked (2A meets elderly floor)', trainV.hardBlock === false, trainV.blockReasons.join('; '));
check('overnight train earns a q bonus (manufactured day)', trainV.q > 0.5, `q=${trainV.q}`);

const decision = chooseByDDCV([
  { opt: roadOpt, ctx: baseCtx },
  { opt: flightOpt, ctx: airportViaNodeCtx(baseCtx, 5.5, 1800) },
  { opt: overnightTrain, ctx: baseCtx },
], EASE);
check('gate (b): overnight TRAIN wins the leg on DDCV', decision.winner?.opt.mode === 'RAIL', `winner=${decision.winner?.opt.mode}`);
check('gate (b): leg is feasible because the train survives', decision.infeasible === false);

// ---- Condition (2): NO overnight train -> graceful failure ------------------
console.log('\nCondition (2) — corridor with NO overnight train fails gracefully:');
const decisionNoTrain = chooseByDDCV([
  { opt: roadOpt, ctx: baseCtx },
  { opt: flightOpt, ctx: airportViaNodeCtx(baseCtx, 5.5, 1800) },
], EASE);
check('all candidates blocked -> leg is INFEASIBLE (needs negotiation)', decisionNoTrain.infeasible === true);
check('infeasible surfaces reasons, does NOT emit road+fly', decisionNoTrain.winner === null && decisionNoTrain.blockReasons.length > 0, decisionNoTrain.blockReasons.join(' | '));

// ---- close-airport control --------------------------------------------------
console.log('\nControl — a legitimately close airport with civil hours survives:');
const closeFlight: LegOption = { from: 'A', to: 'B', mode: 'AIR', identifier: '6E 555', distanceKm: 850, durationMin: 95, depTime: '11:30', arrTime: '13:05', arrDayOffset: 0, operatingDays: 127, reliability: 4 };
const closeV = ddcv(closeFlight, airportViaNodeCtx(baseCtx, 1.0, 600));
check('close-airport civil-hours flight is NOT blocked', closeV.hardBlock === false, closeV.blockReasons.join('; '));

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
