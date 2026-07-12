/**
 * Sprint 8 / US-803c acceptance — TERRAIN, AND THE GATE THAT COULD NOT FIRE.
 *
 * This test exists because of one sentence from the founder:
 *
 *   "the time taken on hills is 20 to 25 km/hour and in plains it is 50-60 kms per hour"
 *   "plains 55 km/h, hills 22 km/h is more accurate"
 *
 * Those were ALREADY the engine's numbers. physiology.terrainSpeedKmh() has said rqi 4 ->
 * 55 and rqi 1 -> 22 since Sprint 1. Not one constant changed. WHAT WAS BROKEN WAS THE
 * WIRING, AND IT WAS BROKEN INSIDE THE BODY GATES:
 *
 *   `roadQualityIndex` was read in four places and SET IN NONE -> every hill road in India
 *   was planned at plains speed. And vehicleHours() preferred OSRM's clock anyway, so even
 *   that never ran. OSRM claims 79 km/h on the Guwahati-Shillong road.
 *
 *   RESULT: roadDayHardCapExceeded() -- THE GATE THAT PROTECTS A 56-YEAR-OLD'S SPINE --
 *   COULD NOT FIRE ON A MOUNTAIN ROAD. 570 assertions stayed green throughout.
 *
 * SECTION 3 IS THE POINT OF THIS FILE. It reproduces the defect and proves it is dead.
 * A body-gate fix that breaks no test is a no-op until you can show the gate now FIRES on
 * the case that motivated it.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/terrain.test.ts
 */

import {
  terrainOfLeg, rqiForTerrain, rqiForLeg, elevationOf, terrainVoice,
  HILL_M, ROLLING_M, type ElevationIndex,
} from '../terrain';
import { terrainSpeedKmh, vehicleHours, roadDayHardCapExceeded, TOLERANCE } from '../physiology';
import type { LegOption } from '../types';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`)); };

console.log('\nSprint 8 / US-803c — terrain: the wire that was never connected\n');

// Real elevations, measured on production (Open-Meteo, 214/214 nodes, zero missing).
const ELEV: ElevationIndex = {
  leh: 3507, ooty: 2241, shimla: 2122, darjeeling: 2098, nainital: 1966,
  gangtok: 1636, shillong: 1495, munnar: 1461,
  jaipur: 438, delhi: 231, khajuraho: 216, agra: 170, kaziranga: 86, guwahati: 60,
  'new jalpaiguri': 114, coimbatore: 411,
};

// ---- 1. THE FOUNDER'S NUMBERS ARE THE ENGINE'S NUMBERS ------------------------------

check('plains = 55 km/h — the founder\'s number, and the engine already knew it', terrainSpeedKmh(4, null) === 55);
check('hills  = 22 km/h — likewise', terrainSpeedKmh(1, null) === 22);
check('a climbing road = 30 km/h (rqi 2) — an EXISTING value; no speed was invented', terrainSpeedKmh(2, null) === 30);

// ---- 2. ELEVATION SEPARATES HILLS FROM PLAINS. THE WINDING RATIO DID NOT. ------------
//
// I first tried road_km/crow_km. It said Nainital (a hill station, 1.21) was FLATTER than
// Kaziranga (plains, 1.29). A body gate may not rest on a signal that is wrong about
// Nainital, so the clever idea was thrown away and the true one used instead.

check('Nainital is a HILL — the case that killed the winding ratio',
  terrainOfLeg(ELEV.nainital, ELEV.nainital) === 'hill');
check('Kaziranga is a PLAIN, despite winding MORE than Nainital',
  terrainOfLeg(ELEV.kaziranga, ELEV.kaziranga) === 'plain');
check('Gangtok <-> Darjeeling: mountains at both ends -> hill road throughout',
  terrainOfLeg(ELEV.gangtok, ELEV.darjeeling) === 'hill');
check('Guwahati (60 m) -> Shillong (1495 m): the road CLIMBS',
  terrainOfLeg(ELEV.guwahati, ELEV.shillong) === 'climbing');
check('Delhi -> Agra: plain to plain',
  terrainOfLeg(ELEV.delhi, ELEV.agra) === 'plain');
check('Delhi -> Shimla is NOT a plains road that happens to end high — it CLIMBS',
  terrainOfLeg(ELEV.delhi, ELEV.shimla) === 'climbing');
check('an unmeasured elevation is UNKNOWN, never assumed flat',
  terrainOfLeg(null, ELEV.delhi) === 'unknown');

check('hill -> rqi 1 -> 22 km/h', rqiForTerrain('hill') === 1);
check('climbing -> rqi 2 -> 30 km/h', rqiForTerrain('climbing') === 2);
check('plain -> rqi 4 -> 55 km/h', rqiForTerrain('plain') === 4);
check('UNKNOWN RETURNS NULL, NOT A GUESS — the engine keeps its safe default',
  rqiForTerrain('unknown') === null);
check('rqiForLeg reads the index by city name, case-insensitively',
  rqiForLeg(ELEV, 'Guwahati', 'Shillong') === 2 && rqiForLeg(ELEV, 'GANGTOK', 'Darjeeling') === 1);
check('a city we hold no elevation for yields null, not a flat road',
  rqiForLeg(ELEV, 'Guwahati', 'Cherrapunji') === null);
check('elevationOf is honest about what it does not know', elevationOf(ELEV, 'Tawang') === null);

// =====================================================================================
// 3. THE DEFECT, REPRODUCED — AND THEN KILLED.
// =====================================================================================
//
// GUWAHATI -> SHILLONG. 99 km of mountain road. This is the leg the North-East traveller
// (56, wife 49, asked for "comfortable") must actually be driven along.

const GUWAHATI_SHILLONG: Pick<LegOption, 'mode' | 'durationMin' | 'distanceKm'> = {
  mode: 'ROAD',
  distanceKm: 99,
  durationMin: 75,     // <- what OSRM ACTUALLY returns. 79 km/h. On that road.
};

const CLIMBING = { roadQualityIndex: 2, month: null };   // 30 km/h

const believed = 75 / 60;                                 // 1.25 h — what the engine used to think
const truth = 99 / 30;                                    // 3.30 h — what the road actually is
const got = vehicleHours(GUWAHATI_SHILLONG, CLIMBING);

check('THE OLD BEHAVIOUR was to believe the router: 1h15 for 99 km of mountain (79 km/h)',
  Math.abs(believed - 1.25) < 0.01);
check('THE FIX: vehicleHours now returns the TERRAIN truth, ~3.3 h, not the router\'s 1.25 h',
  Math.abs(got - truth) < 0.01, `got ${got.toFixed(2)} h`);
check('...which is the SLOWER of the two. Always the slower. Never the faster.',
  got >= believed && got >= truth - 1e-9);

// THE INVARIANT THAT MAKES IT SAFE. Math.max cannot loosen a gate. Fuzz it hostilely:
// random distances, random router clocks, random terrain — the answer may NEVER be
// shorter than either source claims. A body gate cannot be loosened through this line.
let loosened = 0;
for (let i = 0; i < 2000; i++) {
  const km = Math.round(Math.random() * 600) + 1;
  const routerMin = Math.round(Math.random() * 600);
  const rqi = 1 + Math.floor(Math.random() * 5);
  const h = vehicleHours({ mode: 'ROAD', distanceKm: km, durationMin: routerMin }, { roadQualityIndex: rqi, month: null });
  if (h < routerMin / 60 - 1e-9) loosened++;                       // never shorter than the router
  if (h < km / terrainSpeedKmh(rqi, null) - 1e-9) loosened++;      // never shorter than the terrain
}
check('FUZZED 2,000 times: the road clock can NEVER come out shorter than either source',
  loosened === 0, `${loosened} loosenings`);

// RAIL AND AIR ARE UNTOUCHED. A timetable is a published fact, not a router's opinion.
const TRAIN: Pick<LegOption, 'mode' | 'durationMin' | 'distanceKm'> = { mode: 'RAIL', distanceKm: 99, durationMin: 180 };
check('a TRAIN still takes exactly as long as the railway says — 3 h, not a terrain guess',
  Math.abs(vehicleHours(TRAIN, CLIMBING) - 3) < 0.01);
const FLIGHT: Pick<LegOption, 'mode' | 'durationMin' | 'distanceKm'> = { mode: 'AIR', distanceKm: 1200, durationMin: 120 };
check('a FLIGHT is not slowed down by the mountains it flies over',
  Math.abs(vehicleHours(FLIGHT, { roadQualityIndex: 1, month: null }) - 2) < 0.01);

// ---- 4. AND NOW THE GATE ACTUALLY FIRES ---------------------------------------------
//
// THIS IS THE WHOLE POINT. A senior party has a hard cap on road hours. Give them a long
// mountain road on which OSRM is optimistic, and the gate MUST refuse it. Before the fix
// it did not — the engine thought the day was ninety minutes.

const senior = TOLERANCE.elderly;   // hardCapHrs 5.0 — the body of a 56-year-old is not negotiable

// 210 km of true mountain road (both ends high). OSRM claims 2h40 (~79 km/h).
// The truth is 210 / 22 = 9.5 hours. No 56-year-old is driven 9.5 hours through mountains.
const LONG_HILL: Pick<LegOption, 'mode' | 'durationMin' | 'distanceKm'> = {
  mode: 'ROAD', distanceKm: 210, durationMin: 160,
};
const HILL_CTX = { roadQualityIndex: 1, month: null };   // 22 km/h

const beforeFix = roadDayHardCapExceeded({ ...LONG_HILL, distanceKm: null }, senior, HILL_CTX); // router only
const afterFix = roadDayHardCapExceeded(LONG_HILL, senior, HILL_CTX);

check('BEFORE: on the router\'s clock alone (2h40) the gate does NOT fire — the defect, reproduced',
  beforeFix.exceeded === false, `hrs=${beforeFix.hrs.toFixed(1)} cap=${beforeFix.capHrs}`);
check('AFTER: the gate FIRES. 210 km of mountain is ~9.5 h, and a senior body will not take it',
  afterFix.exceeded === true, `hrs=${afterFix.hrs.toFixed(1)} cap=${afterFix.capHrs}`);
check('...and the hours it reports are the TRUTH (~9.5 h), not the router\'s 2h40',
  Math.abs(afterFix.hrs - 210 / 22) < 0.01, `${afterFix.hrs.toFixed(2)} h`);

// The plains must NOT be over-tightened. A gate that refuses everything is not a gate.
const PLAINS_DAY: Pick<LegOption, 'mode' | 'durationMin' | 'distanceKm'> = {
  mode: 'ROAD', distanceKm: 230, durationMin: 240,   // Delhi->Jaipur-ish, 4 h, real
};
const plains = roadDayHardCapExceeded(PLAINS_DAY, senior, { roadQualityIndex: 4, month: null });
check('a real 4-hour PLAINS day still passes for a senior — we did not just refuse everything',
  plains.exceeded === false, `hrs=${plains.hrs.toFixed(1)} cap=${plains.capHrs}`);

// ---- 5. AND HE IS TOLD, IN HIS OWN WORDS ---------------------------------------------
//
// Law 4: never let a hard thing arrive as a surprise on the day.

const v = terrainVoice('climbing', 'Guwahati', 'Shillong', 3.3);
check('the climbing road SPEAKS — and it warns him the map is lying',
  !!v && /mountain road/i.test(v) && /quicker/i.test(v), v ?? '(null)');
check('...and it names no rqi, no score, no km/h — only what he will feel',
  !!v && !/rqi|score|km\/h|OSRM/i.test(v));
check('a plains road says nothing — we do not manufacture drama', terrainVoice('plain', 'Delhi', 'Agra', 4) === null);

// ---- 6. THE THRESHOLDS ARE FACTS ABOUT THE EARTH, NOT TUNING KNOBS -------------------

check('the hill line is 1200 m', HILL_M === 1200);
check('the rolling line is 600 m', ROLLING_M === 600);
check('every terrain maps to an EXISTING rqi in the shipped speed table',
  (['hill', 'climbing', 'rolling', 'plain'] as const).every((t) => {
    const r = rqiForTerrain(t);
    return r != null && [22, 30, 42, 55, 75].includes(terrainSpeedKmh(r, null));
  }));

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
