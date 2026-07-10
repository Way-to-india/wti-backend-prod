/**
 * Sprint 2 — Story 1 acceptance: JUNCTION-COMPOSED RAIL (spec §4.6 rung 1).
 *
 * Pure tests over composeJunction / composeRunningDays / junctionLayoverMin — no DB.
 *   - composes two trains through the SAME station into one LegOption;
 *   - rejects a different-station "change" (a cross-city dash, not an interchange);
 *   - rejects a layover < 45 min (impossible change) and > 3 h (dead wait);
 *   - the composed operating-days mask is the AND of both trains across the
 *     transfer day-offset (so a thrice-weekly leg composes correctly for Story 5);
 *   - a composed option is always VERIFY-flagged (source ir-timetable-junction).
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/railGraph.test.ts
 */

import {
  composeJunction, composeRunningDays, junctionLayoverMin,
  JUNCTION_MIN_LAYOVER_MIN, JUNCTION_MAX_LAYOVER_MIN, type RailHalf,
} from '../railGraph';
import { isTrueOvernight } from '../constraints';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

const DAILY = 127;
const mk = (o: Partial<RailHalf>): RailHalf => ({
  trainNo: 'T', runningDays: DAILY, depMin: 0, depDay: 0, arrMin: 0, arrDay: 0,
  kmFrom: 0, kmTo: 100, ...o,
});

console.log('\nSprint 2 / Story 1 — junction-composed rail\n');

// ---- layover helper ----------------------------------------------------------
console.log('layover clock math:');
check('same-day layover 14:00->15:30 = 90m', junctionLayoverMin(14 * 60, 15 * 60 + 30) === 90);
check('midnight-wrapping layover 23:30->00:45 = 75m', junctionLayoverMin(23 * 60 + 30, 45) === 75);

// ---- running-day composition -------------------------------------------------
console.log('\noperating-days AND across transfer offset:');
check('daily AND daily (shift 0) = daily', composeRunningDays(DAILY, DAILY, 0) === DAILY);
// train1 runs Mon(bit0); train2 must run on the SAME day it departs J. With shift 1,
// composed[s] set iff t1 runs s AND t2 runs s+1. t1=Mon only(1), t2=Tue only(2) -> Mon.
check('Mon-only + Tue-only, transferShift 1 -> Mon-only', composeRunningDays(0b0000001, 0b0000010, 1) === 0b0000001);
check('disjoint after shift -> never runs (0)', composeRunningDays(0b0000001, 0b0000010, 0) === 0);
// thrice-weekly (Mon/Wed/Fri = bits 0,2,4 = 21) both, shift 0 -> same thrice-weekly
check('thrice-weekly AND itself (shift 0) = thrice-weekly', composeRunningDays(0b0010101, 0b0010101, 0) === 0b0010101);

// ---- the happy path: two trains, same junction, clean layover ----------------
console.log('\ncomposition (same-station, good layover):');
// A -> J on train1: dep 22:00 (day0) -> arr J 04:00 (+1d). Change. J -> B on train2:
// dep 05:00 (day0 of train2) -> arr 09:30. Layover 60m.
const leg1: RailHalf = mk({ trainNo: '12345', depMin: 22 * 60, depDay: 0, arrMin: 4 * 60, arrDay: 1, kmFrom: 0, kmTo: 500, originName: 'AAA', destName: 'JJJ' });
const leg2: RailHalf = mk({ trainNo: '67890', depMin: 5 * 60, depDay: 0, arrMin: 9 * 60 + 30, arrDay: 0, kmFrom: 0, kmTo: 220, originName: 'JJJ', destName: 'BBB' });
const good = composeJunction('Aville', 'Bville', 'J', 'J', 'Junction Jn', leg1, leg2);
check('valid junction composes an option', good.opt !== null, good.reason);
if (good.opt) {
  const o = good.opt;
  check('identifier names both trains + the change', /12345\/67890 via Junction Jn \(change\)/.test(o.identifier || ''));
  check('distance = sum of both segments (720 km)', o.distanceKm === 720, String(o.distanceKm));
  check('departs 22:00, arrives 09:30', o.depTime === '22:00' && o.arrTime === '09:30', `${o.depTime}->${o.arrTime}`);
  // total = seg1 (6h) + layover (1h) + seg2 (4.5h) = 11.5h -> dep 22:00 + 11.5h = 09:30 next day
  check('duration = 11.5 h', Math.round((o.durationMin || 0) / 6) / 10 === 11.5, String(o.durationMin));
  check('arrDayOffset = 1 (crosses one midnight)', o.arrDayOffset === 1, String(o.arrDayOffset));
  check('class floor = intersection holds 2A', (o.classes || []).includes('2A'));
  check('VERIFY-flagged (source junction, verifiedAt null)', o.source === 'ir-timetable-junction' && o.verifiedAt === null);
  check('reliability shaved for the interchange (<=3 when daily)', (o.reliability ?? 5) <= 3);
}

// ---- rejections --------------------------------------------------------------
console.log('\nrejections (the rules that make it honest):');
const diffStation = composeJunction('A', 'B', 'J1', 'J2', 'Two Different Jns', leg1, leg2);
check('different interchange stations -> rejected', diffStation.opt === null && /differ/.test(diffStation.reason || ''));

const tight2 = mk({ trainNo: '67890', depMin: 4 * 60 + 20, arrMin: 9 * 60, kmFrom: 0, kmTo: 220 }); // layover 20m
const tight = composeJunction('A', 'B', 'J', 'J', 'J', leg1, tight2);
check(`layover 20m < ${JUNCTION_MIN_LAYOVER_MIN}m -> rejected`, tight.opt === null && /too tight/.test(tight.reason || ''));

const dead2 = mk({ trainNo: '67890', depMin: 8 * 60, arrMin: 12 * 60, kmFrom: 0, kmTo: 220 }); // layover 4h
const dead = composeJunction('A', 'B', 'J', 'J', 'J', leg1, dead2);
check(`layover 240m > ${JUNCTION_MAX_LAYOVER_MIN}m -> rejected (dead wait)`, dead.opt === null && /dead wait/.test(dead.reason || ''));

const sameTrain = composeJunction('A', 'B', 'J', 'J', 'J', leg1, mk({ trainNo: '12345', depMin: 5 * 60, arrMin: 9 * 60, kmFrom: 0, kmTo: 220 }));
check('same train on both halves -> rejected (that is a direct leg)', sameTrain.opt === null && /same train/.test(sameTrain.reason || ''));

const noProgress = composeJunction('A', 'B', 'J', 'J', 'J', leg1, mk({ trainNo: '67890', depMin: 5 * 60, arrMin: 9 * 60, kmFrom: 220, kmTo: 220 }));
check('zero-progress segment -> rejected', noProgress.opt === null && /forward progress/.test(noProgress.reason || ''));

// ---- overnight-shaped composition is recognised by the Sabarmati rule --------
console.log('\ninteraction with the true-overnight predicate:');
if (good.opt) check('composed 22:00->09:30(+1) reads as a true overnight', isTrueOvernight(good.opt) === true);

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
