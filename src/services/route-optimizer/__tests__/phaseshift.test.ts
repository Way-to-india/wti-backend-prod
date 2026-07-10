/**
 * Sprint 2 — Story 5 acceptance: WHOLE-TRIP PHASE SHIFT ±3 days (spec §6.1).
 * This is demo gate (c): a thrice-weekly-train corridor is fixed by STARTING the
 * trip on the weekday that makes the train run — not by failing or rerouting.
 *
 * Pure tests (no DB) over phaseShift():
 *   - a thrice-weekly (Mon/Wed/Fri) train + a desired Tuesday start → shift +1 day
 *     to Wednesday (the minimal slide that aligns it);
 *   - a start that already aligns → shift 0;
 *   - no weekday-limited legs → any start, shift 0;
 *   - nothing within the window aligns → aligned=false (climb the physical ladder).
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/phaseshift.test.ts
 */

import { phaseShift, type WeekdayConstrainedLeg } from '../constraints';
import { WEEKDAY_NAMES, type Weekday } from '../types';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

const MON = 0, TUE = 1, WED = 2, THU = 3, FRI = 4, SAT = 5, SUN = 6;
// Mon/Wed/Fri thrice-weekly bitmask (bit0=Mon): 1 + 4 + 16 = 21.
const MWF = 0b0010101;
// A single weekday-limited leg that DEPARTS on Day 1 (dayIndex 0).
const legDay1 = (bits: number): WeekdayConstrainedLeg[] => [{ dayIndex: 0, operatingDays: bits, identifier: 'TWICE/THRICE-weekly Exp' }];

console.log('\nSprint 2 / Story 5 — whole-trip phase shift (gate c)\n');

console.log('thrice-weekly (Mon/Wed/Fri) train, various desired starts:');
const tue = phaseShift(TUE as Weekday, legDay1(MWF), 3);
check('desired Tuesday → shift +1 day to Wednesday', tue.aligned && tue.shiftDays === 1 && tue.startWeekday === WED, `${tue.shiftDays} → ${tue.startWeekday != null ? WEEKDAY_NAMES[tue.startWeekday] : 'none'}`);
check('  the reason explains the slide', /later/.test(tue.reason) && /WEDNESDAY/.test(tue.reason));

const sun = phaseShift(SUN as Weekday, legDay1(MWF), 3);
check('desired Sunday → shift +1 day to Monday', sun.aligned && sun.shiftDays === 1 && sun.startWeekday === MON);

const wed = phaseShift(WED as Weekday, legDay1(MWF), 3);
check('desired Wednesday already aligns → shift 0', wed.aligned && wed.shiftDays === 0 && wed.startWeekday === WED);

console.log('\nminimal slide picks the nearest aligning day:');
const thu = phaseShift(THU as Weekday, legDay1(MWF), 3);
check('desired Thursday → shift +1 to Friday (not -2 to Tuesday)', thu.aligned && thu.shiftDays === 1 && thu.startWeekday === FRI, `${thu.shiftDays}`);

console.log('\nno weekday-limited legs → any start:');
const anyStart = phaseShift(TUE as Weekday, [{ dayIndex: 0, operatingDays: 127 }], 3);
check('daily-only legs → aligned, shift 0', anyStart.aligned && anyStart.shiftDays === 0);

console.log('\nnothing within the window aligns → climb the physical ladder:');
// Monday-only train (bit0), desired Friday, window ±2: reachable weekdays are
// Wed,Thu,Sat,Sun — none is Monday → not aligned.
const monOnly = phaseShift(FRI as Weekday, legDay1(0b0000001), 2);
check('Monday-only train, desired Friday, window ±2 → NOT aligned', monOnly.aligned === false && monOnly.startWeekday === null, monOnly.reason);
check('  but window ±3 DOES align (Fri → Mon is +3)', phaseShift(FRI as Weekday, legDay1(0b0000001), 3).aligned === true);

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
