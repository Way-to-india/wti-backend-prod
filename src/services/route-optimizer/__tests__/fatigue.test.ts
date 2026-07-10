/**
 * Sprint 2 — Story 4 acceptance: FATIGUE LEDGER + RHYTHM GATES (spec §3.3, §7).
 * This is demo gate (d): no plan may carry two consecutive heavy days, and the
 * streak-breaker rejects a "technically feasible, humanly miserable" 3-day window.
 *
 * Pure tests (no DB):
 *   - three back-to-back travel days trip the 3-day streak-breaker AND flag two
 *     consecutive heavy days;
 *   - a gentle travel/rest alternation passes clean;
 *   - a heavy day forces the next day to ≤ 2 vehicle-hours;
 *   - B2: a brutal ~10.5 h DAY train reads as HEAVY, while the same hours as an
 *     OVERNIGHT train do not (sleep) — the ledger folds day-ride length into Φ.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/fatigue.test.ts
 */

import {
  runFatigueLedger, dailyLoadCap, isHeavy, decayForDay,
  HEAVY_FRACTION, STREAK_FRACTION, type DayLoad,
} from '../fatigue';
import { TOLERANCE, legFatigue } from '../physiology';
import { isTrueOvernight } from '../constraints';
import type { LegOption } from '../types';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

const mid = TOLERANCE.midage; // cap = 7 (hardCap 7 × age 1.0)
const cap = dailyLoadCap(mid);
const heavyLoad = 0.72 * cap; // just over the 0.7 heavy line
const lightLoad = 0.2 * cap;

console.log('\nSprint 2 / Story 4 — fatigue ledger + rhythm gates (gate d)\n');
console.log(`daily load cap (mid-age) = ${cap} · heavy > ${(HEAVY_FRACTION * cap).toFixed(1)} · streak > ${(STREAK_FRACTION * cap).toFixed(1)}\n`);

// ---- (1) the miserable 3-day window ------------------------------------------
console.log('streak-breaker — three brutal days in a row:');
const brutal: DayLoad[] = [
  { load: heavyLoad, vehicleHrs: 6.5, hasTransit: true },
  { load: heavyLoad, vehicleHrs: 6.5, hasTransit: true },
  { load: heavyLoad, vehicleHrs: 6.5, hasTransit: true },
];
const rBrutal = runFatigueLedger(brutal, mid);
check('the 3-day streak-breaker fires', rBrutal.violations.some((v) => v.kind === 'three_day_streak'), rBrutal.violations.map((v) => v.kind).join(','));
check('two consecutive heavy days are flagged', rBrutal.violations.some((v) => v.kind === 'two_consecutive_heavy'));
check('the plan is rejected (ok=false)', rBrutal.ok === false);

// ---- (2) a gentle alternation passes -----------------------------------------
console.log('\ngentle travel/rest alternation:');
const gentle: DayLoad[] = [
  { load: heavyLoad, vehicleHrs: 6.5, hasTransit: true },
  { load: 0, vehicleHrs: 0, hasTransit: false },     // rest day at the city
  { load: heavyLoad, vehicleHrs: 6.5, hasTransit: true },
  { load: 0, vehicleHrs: 0, hasTransit: false },
];
const rGentle = runFatigueLedger(gentle, mid);
check('no two consecutive heavy days', !rGentle.violations.some((v) => v.kind === 'two_consecutive_heavy'));
check('no streak violation', !rGentle.violations.some((v) => v.kind === 'three_day_streak'));
check('the gentle plan passes clean (ok=true)', rGentle.ok === true, rGentle.violations.map((v) => v.kind).join(','));

// ---- (3) heavy day must be followed by a light one ---------------------------
console.log('\nheavy day → next day ≤ 2 vehicle-hours:');
const heavyThenHeavyDrive: DayLoad[] = [
  { load: heavyLoad, vehicleHrs: 6.5, hasTransit: true },
  { load: lightLoad, vehicleHrs: 5.0, hasTransit: true },   // 5 h drive after a heavy day
];
const rHTL = runFatigueLedger(heavyThenHeavyDrive, mid);
check('a 5 h drive after a heavy day is flagged', rHTL.violations.some((v) => v.kind === 'no_light_day_after_heavy'));
const heavyThenRest: DayLoad[] = [
  { load: heavyLoad, vehicleHrs: 6.5, hasTransit: true },
  { load: lightLoad, vehicleHrs: 1.5, hasTransit: true },   // ≤ 2 h — fine
];
check('a ≤ 2 h day after a heavy day is fine', !runFatigueLedger(heavyThenRest, mid).violations.some((v) => v.kind === 'no_light_day_after_heavy'));

// ---- (4) B2: day-train ride length folds into Φ ------------------------------
console.log('\nB2 — a brutal DAY train is heavy; the same hours OVERNIGHT are not:');
const dayTrain: LegOption = { from: 'A', to: 'B', mode: 'RAIL', identifier: '12x DAY', distanceKm: 620, durationMin: 630, depTime: '08:00', arrTime: '18:30', arrDayOffset: 0, operatingDays: 127, classes: ['2A'], reliability: 4 };
const nightTrain: LegOption = { from: 'A', to: 'B', mode: 'RAIL', identifier: '12y NIGHT', distanceKm: 620, durationMin: 630, depTime: '22:00', arrTime: '08:30', arrDayOffset: 1, operatingDays: 127, classes: ['2A'], reliability: 4 };
const dayLoadVal = legFatigue(dayTrain, mid, { overnight: isTrueOvernight(dayTrain), depMin: 480, arrMin: 1110 });
const nightLoadVal = legFatigue(nightTrain, mid, { overnight: isTrueOvernight(nightTrain), depMin: 1320, arrMin: 510 });
check('overnight predicate: day train is NOT overnight', isTrueOvernight(dayTrain) === false);
check('overnight predicate: night train IS overnight', isTrueOvernight(nightTrain) === true);
check('~10.5 h DAY train reads as HEAVY', isHeavy(dayLoadVal, mid) === true, `load ${dayLoadVal}`);
check('same hours OVERNIGHT is NOT heavy (sleep)', isHeavy(nightLoadVal, mid) === false, `load ${nightLoadVal}`);
check('day-train load > overnight load', dayLoadVal > nightLoadVal);

// ---- decay factors -----------------------------------------------------------
console.log('\ndecay factors by day type:');
check('rest day decays fatigue hardest (0.45)', decayForDay({ load: 0, vehicleHrs: 0, hasTransit: false }, mid) === 0.45);
check('travel day gives no decay benefit (1.0)', decayForDay({ load: heavyLoad, vehicleHrs: 6, hasTransit: true }, mid) === 1.0);
check('light day decays gently (0.75)', decayForDay({ load: lightLoad, vehicleHrs: 1, hasTransit: true }, mid) === 0.75);

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
