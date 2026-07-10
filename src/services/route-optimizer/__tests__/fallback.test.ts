/**
 * Sprint 2 — Story 2 acceptance: 500–700 km NO-FLIGHT ladder (spec §4.6).
 *
 * Pure tests (no DB) over the rung-2 rail+road hybrid + the DDCV chooser:
 *   - a 600 km corridor with NO direct train and NO viable single road day: the
 *     rail+road hybrid (overnight train to a nearby railhead + morning road) is the
 *     ONLY feasible option and the DDCV picks it — the ladder generates, the cost
 *     model decides;
 *   - the onward road is charged as door-to-door access (a far drop railhead loses);
 *   - wrapRailRoadHybrid rejects an onward hop > 150 km and a rail half < 250 km;
 *   - the young-long-road rung (rung 5) is admissible ONLY for a party whose §3 hard
 *     cap clears the day — it never relaxes the gate;
 *   - a hybrid is always VERIFY-flagged.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/fallback.test.ts
 */

import { TOLERANCE } from '../physiology';
import { ddcv, chooseByDDCV, weightsForObjective, type LegCtx } from '../ddcv';
import {
  wrapRailRoadHybrid, hybridAccessHours, youngLongRoadAdmissible,
  onwardRoadHours, HYBRID_DROP_MAX_KM,
} from '../fallback';
import type { LegOption } from '../types';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

const midage = TOLERANCE.midage;
const young = TOLERANCE.young;
const elderly = TOLERANCE.elderly;
const BAL = weightsForObjective('BALANCED');

console.log('\nSprint 2 / Story 2 — 500–700 km no-flight ladder\n');

// ---- build the rung-2 hybrid: 540 km overnight train + 80 km morning road -----
const railToDrop: LegOption = {
  from: 'Aville', to: 'Rail Jn', mode: 'RAIL', identifier: '12708 Intercity',
  distanceKm: 540, durationMin: 570, depTime: '21:00', arrTime: '06:30', arrDayOffset: 1,
  operatingDays: 127, classes: ['3A', '2A', 'SL'], reliability: 5, source: 'ir-timetable', verifiedAt: null,
};
const onwardKm = 80;
const hybrid = wrapRailRoadHybrid(railToDrop, 'Bville', 'Rail Jn', onwardKm, Math.round(onwardRoadHours(onwardKm) * 60));

console.log('rung 2 — rail+road hybrid construction:');
check('hybrid composes', hybrid !== null);
if (hybrid) {
  check('carries onward road (80 km)', hybrid.onwardRoadKm === 80, String(hybrid.onwardRoadKm));
  check('destination is the CITY, not the railhead', hybrid.to === 'Bville');
  check('VERIFY-flagged (source -hybrid, verifiedAt null)', /-hybrid$/.test(hybrid.source || '') && hybrid.verifiedAt === null);
  const acc = hybridAccessHours(hybrid);
  check('onward road becomes ~1.45 h of access', acc.hrs > 1.3 && acc.hrs < 1.6, String(acc.hrs));
  check('onward road carries a taxi cost', acc.costPp > 0);
}

// ---- the corridor: no direct/junction train; a single road day is impossible --
const longRoad: LegOption = {
  from: 'Aville', to: 'Bville', mode: 'ROAD', identifier: null,
  distanceKm: 600, durationMin: null, operatingDays: 127, reliability: 4,
};

function ctxFor(o: LegOption, tol = midage): LegCtx {
  const h = hybridAccessHours(o);
  const railAccess = o.mode === 'RAIL' ? 0.75 : 0;
  return { tol, pax: 2, month: 1, accessFromHrs: railAccess, accessToHrs: railAccess + h.hrs, accessCostPp: h.costPp };
}

console.log('\nthe DDCV chooser on a direct-less 600 km corridor (mid-age party):');
check('600 km single road day is HARD-BLOCKED (10.9 h > 7 h cap)', ddcv(longRoad, ctxFor(longRoad)).hardBlock === true);
if (hybrid) check('rail+road hybrid is FEASIBLE (not blocked)', ddcv(hybrid, ctxFor(hybrid)).hardBlock === false, ddcv(hybrid, ctxFor(hybrid)).blockReasons.join('; '));

if (hybrid) {
  const decision = chooseByDDCV([
    { opt: longRoad, ctx: ctxFor(longRoad) },
    { opt: hybrid, ctx: ctxFor(hybrid) },
  ], BAL);
  check('ladder is not infeasible — the hybrid survives', decision.infeasible === false);
  check('the DDCV PICKS the rail+road hybrid over the long road', decision.winner?.opt === hybrid);
}

// ---- rung-5 young-long-road admissibility (names the gate, never relaxes it) ---
console.log('\nrung 5 — young-only long road day (predicate only; §3 gate still binds):');
check('young party clears an 8.5 h road day', youngLongRoadAdmissible(8.5, young) === true);
check('elderly party never clears an 8.5 h road day', youngLongRoadAdmissible(8.5, elderly) === false);
check('even young is refused above its 9 h hard cap', youngLongRoadAdmissible(9.6, young) === false);

// ---- wrap rejections ---------------------------------------------------------
console.log('\nhybrid wrap rejections:');
check(`onward hop > ${HYBRID_DROP_MAX_KM} km -> rejected`, wrapRailRoadHybrid(railToDrop, 'B', 'R', 220, 300) === null);
const shortRail: LegOption = { ...railToDrop, distanceKm: 120 };
check('rail half < 250 km -> not a hybrid (too short to be a long haul)', wrapRailRoadHybrid(shortRail, 'B', 'R', 60, 90) === null);

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
