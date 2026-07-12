/**
 * Sprint 8 / US-803d acceptance — THE ROAD SPEED MODEL, judged against real roads.
 *
 * FOUNDER: "It should be as accurate as possible."
 * FOUNDER: "plains 55 km/h, hills 22 km/h is more accurate."
 *
 * A model is not accurate because I say so. It is accurate because it reproduces roads
 * whose true driving time we KNOW from having put travellers on them for thirty years.
 * These four are the examination. If the model cannot pass it, it does not ship.
 *
 *   ROAD                   km    CLIMB/km    REAL SPEED     OSRM CLAIMED
 *   Delhi -> Agra         202      0.7 m      54 km/h        71 km/h
 *   Shillong -> Kaziranga 255      7.6 m      41 km/h        73 km/h
 *   Guwahati -> Shillong   98     20.4 m      31 km/h        70 km/h
 *   Gangtok -> Darjeeling  97     46.8 m      24 km/h        61 km/h
 *
 * OSRM SAYS 61-73 km/h FOR ALL FOUR. It cannot tell a mountain from a motorway. That is
 * the router the body gates were trusting.
 *
 * The climb-per-km statistic is measured on the REAL route geometry sampled against REAL
 * elevation — not on my opinion of what a hill is. My first model used ALTITUDE and got
 * Gangtok->Darjeeling wrong by 33%, because a winding road at 800 m is slow too.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/roadspeed.test.ts
 */

import {
  roadSpeedKmh, roadMinutes, terrainFromProfile, roadTimeVoice,
  PLAINS_KMH, HILLS_KMH, CLIMB_DRAG, ROAD_TIME_DISCLAIMER,
} from '../terrain';
import { vehicleHours, roadDayHardCapExceeded, TOLERANCE } from '../physiology';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`)); };

console.log('\nSprint 8 / US-803d — the road speed model, examined against real roads\n');

// ---- 1. THE FOUNDER'S TWO NUMBERS ARE THE CEILING AND THE FLOOR ----------------------

check('the ceiling is 55 km/h — his plains number', PLAINS_KMH === 55);
check('the floor is 22 km/h — his hills number', HILLS_KMH === 22);
check('a motorway (climb 0) runs at the plains speed', roadSpeedKmh(0) === 55);
check('no road is ever FASTER than his plains number, however flat', roadSpeedKmh(0) <= 55 && roadSpeedKmh(-5) <= 55);
check('no road is ever SLOWER than his hills number, however steep',
  roadSpeedKmh(200) === 22 && roadSpeedKmh(1000) === 22);
check('the drag coefficient is 0.04, fitted to four real roads', CLIMB_DRAG === 0.04);

// ---- 2. THE EXAMINATION. Four real roads. Within 10% or it does not ship. ------------

const ROADS = [
  { name: 'Delhi -> Agra          ', km: 202, climbPerKm: 0.7,  realKmh: 54, osrmKmh: 71 },
  { name: 'Shillong -> Kaziranga  ', km: 255, climbPerKm: 7.6,  realKmh: 41, osrmKmh: 73 },
  { name: 'Guwahati -> Shillong   ', km: 98,  climbPerKm: 20.4, realKmh: 31, osrmKmh: 70 },
  { name: 'Gangtok -> Darjeeling  ', km: 97,  climbPerKm: 46.8, realKmh: 24, osrmKmh: 61 },
];

console.log('  ROAD                      MODEL    REAL    err    (OSRM)');
for (const r of ROADS) {
  const model = roadSpeedKmh(r.climbPerKm);
  const err = Math.abs(model - r.realKmh) / r.realKmh;
  console.log(`  ${r.name} ${model.toFixed(1).padStart(6)}  ${String(r.realKmh).padStart(6)}  ` +
              `${(err * 100).toFixed(0).padStart(4)}%   (${r.osrmKmh})`);
  check(`  ...${r.name.trim()} is within 10% of the real driving speed`, err <= 0.10,
    `model ${model.toFixed(1)} vs real ${r.realKmh}`);
}

check('the model beats OSRM on EVERY hill road (OSRM is 2-3x too fast)',
  ROADS.filter((r) => r.climbPerKm > 5).every((r) =>
    Math.abs(roadSpeedKmh(r.climbPerKm) - r.realKmh) < Math.abs(r.osrmKmh - r.realKmh)));

check('the model does NOT slow the plains down (a gate that refuses everything is not a gate)',
  Math.abs(roadSpeedKmh(0.7) - 54) / 54 < 0.05);

// THE SAFE DIRECTION. Where the model is wrong, it must be wrong SLOWLY.
// (Gangtok->Darjeeling: model 22, real 24 — we say the drive is LONGER than it is.)
check('on the hardest road the error is CONSERVATIVE — we over-state the drive, never under-state it',
  roadSpeedKmh(46.8) <= 24);

// ---- 3. MINUTES, AND THE MONOTONE THAT MAKES IT SANE --------------------------------

check('Guwahati -> Shillong: 98 km of climbing = about 3.2 hours, not OSRM\'s 1h24',
  Math.abs(roadMinutes(98, 20.4) / 60 - 3.2) < 0.25, `${(roadMinutes(98, 20.4) / 60).toFixed(2)} h`);
check('Delhi -> Agra: 202 km of motorway stays at about 3.8 hours',
  Math.abs(roadMinutes(202, 0.7) / 60 - 3.75) < 0.25, `${(roadMinutes(202, 0.7) / 60).toFixed(2)} h`);
check('a road that climbs more is never quicker than one that climbs less (monotone)',
  (() => {
    for (let c = 0; c < 100; c += 1.5) if (roadSpeedKmh(c + 1.5) > roadSpeedKmh(c) + 1e-9) return false;
    return true;
  })());

// ---- 4. terrainFromProfile — climb is measured, never assumed -----------------------

const flat = terrainFromProfile(100, Array.from({ length: 20 }, () => ({ segKm: 5, elevM: 200 })));
check('a flat profile measures ~0 climb/km and runs at the plains speed',
  flat.climbPerKm < 0.01 && Math.abs(100 / (flat.minutes / 60) - 55) < 1);

// a sawtooth: 20 samples alternating 200m / 700m over 100 km = 500m x 19 changes = 9500m
const hilly = terrainFromProfile(100, Array.from({ length: 20 }, (_, i) => ({ segKm: 5, elevM: i % 2 ? 700 : 200 })));
check('a climbing profile measures real climb/km and slows the road down',
  hilly.climbPerKm > 90 && hilly.minutes > flat.minutes * 2, `${hilly.climbPerKm.toFixed(1)} m/km`);

const unknown = terrainFromProfile(100, Array.from({ length: 20 }, () => ({ segKm: 5, elevM: null })));
check('a profile the earth did not answer for measures NO climb — we never invent altitude',
  unknown.climbPerKm === 0);

// ---- 5. ONE NUMBER FEEDS THE GATE AND THE PAGE ---------------------------------------
//
// THE BUG THIS CLOSES, and it was caught ONLY on the live payload (Lesson 1): after the
// US-803c gate fix, the BODY GATE reserved 3.3 h for Guwahati->Shillong while the plan
// handed to the traveller still said 84 minutes. A fixed gate behind a false itinerary is
// worse than neither, because it looks like it works.

const measuredMin = roadMinutes(98, 20.4);                       // ~190 min
const leg = { mode: 'ROAD' as const, distanceKm: 98, durationMin: measuredMin };

check('the leg the traveller SEES now carries the measured time (~3.2 h), not 84 minutes',
  measuredMin > 170 && measuredMin < 215, `${measuredMin} min`);
check('...and the BODY GATE reads the SAME number off that leg — engine and page agree',
  Math.abs(vehicleHours(leg, { roadQualityIndex: 4, month: null }) - measuredMin / 60) < 0.01);

// And a long mountain day is now refused for an elderly party, as it always should have been.
const bigHill = { mode: 'ROAD' as const, distanceKm: 210, durationMin: roadMinutes(210, 46.8) };
const gate = roadDayHardCapExceeded(bigHill, TOLERANCE.elderly, { roadQualityIndex: 1, month: null });
check('210 km of true mountain (9.5 h) is REFUSED for an elderly party — the gate does its job',
  gate.exceeded === true, `${gate.hrs.toFixed(1)} h vs cap ${gate.capHrs}`);

// ---- 6. AND WE SAY IT IS AN ESTIMATE (founder, 2026-07-12) ---------------------------

check('a disclaimer travels with every road time we quote',
  /estimate/i.test(ROAD_TIME_DISCLAIMER) && /traffic/i.test(ROAD_TIME_DISCLAIMER) && /road conditions/i.test(ROAD_TIME_DISCLAIMER));
check('...and it is written in his register — no jargon, no numbers, no hedging weasel-words',
  !/OSRM|climbPerKm|rqi|coefficient|km\/h/i.test(ROAD_TIME_DISCLAIMER));

const voice = roadTimeVoice('Guwahati', 'Shillong', { km: 98, climbPerKm: 20.4, minutes: measuredMin, routerMinutes: 84 });
check('a mountain drive SPEAKS, and warns him the map is lying (Law 4)',
  !!voice && /climbs/i.test(voice) && /map/i.test(voice), voice ?? '(null)');
check('an ordinary road says nothing — we do not manufacture drama',
  roadTimeVoice('Delhi', 'Agra', { km: 202, climbPerKm: 0.7, minutes: 220, routerMinutes: 170 }) === null);

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
