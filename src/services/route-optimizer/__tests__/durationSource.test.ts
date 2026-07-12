/**
 * SPRINT 8 / US-800a — TRUST A MEASUREMENT; FLOOR A GUESS.
 *
 * THE DEFECT THIS CLOSES. On 2026-07-12 we made the climb-per-km model the FLOOR under a
 * road leg: `durationMin = max(osrm x 1.15, climbModel)`. That was right, and IT MUST STAY,
 * because OSRM cannot tell a mountain from a motorway — it claims 79 km/h on the
 * Guwahati->Shillong road, which is 31 — and the body gate that protects a 56-year-old's
 * spine could not fire on a mountain road because of it.
 *
 * BUT THE MODEL KNOWS TERRAIN AND NOT ROAD CLASS. Measured against Google the same day:
 *
 *   leg                            climb/km   our model      the truth
 *   Guwahati -> Shillong (hills)      22.4    3h23  (29)     ~3-3.5h    RIGHT
 *   Murud -> Dapoli (coastal)         18.3    4h13  (32)     4-5.5h     RIGHT
 *   Ratnagiri -> Malvan (NH66)        12.3    4h40  (37)     3h22 (50)  AN HOUR TOO SLOW
 *
 * AND IT CANNOT BE RE-TUNED OUT. Fit the coefficient to NH66 and the model then returns
 * 47 km/h for Guwahati->Shillong, which is 31 — WRONG, AND IN THE DANGEROUS DIRECTION. One
 * coefficient cannot represent road class. No ratio guard separates them either: on the real
 * cached legs, 2.42x is correct and 1.83x is wrong.
 *
 * SO THERE IS EXACTLY ONE WAY OUT. When a routing service has DRIVEN the road, its clock is
 * a FACT, and our curve is a fit to four roads. A FITTED MODEL MAY NEVER BE THE AUTHORITY
 * OVER A MEASUREMENT. Every road nobody has driven keeps the full conservative floor.
 *
 * These tests hold BOTH halves. The last section holds it STRUCTURALLY: it reads the source
 * of every file in the engine and fails if anything but the Google adapter can ever write
 * 'measured'. Made unrepresentable, not merely forbidden.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/durationSource.test.ts
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { vehicleHours, roadDayHardCapExceeded, TOLERANCE } from '../physiology';
import { terrainFromProfile } from '../terrain';
import type { LegOption } from '../types';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`)); };
const near = (a: number, b: number, tol = 0.02) => Math.abs(a - b) <= tol;

console.log('\nSprint 8 / US-800a — a measurement is not floored by a guess\n');

// THE REAL ROAD THAT PROVED IT. NH66, Ratnagiri -> Malvan: 168 km of national highway.
// OSRM x1.15 said 153 min. OUR CLIMB MODEL SAID 280 min, and won the Math.max.
// GOOGLE DROVE IT IN 202 min.
const NH66 = { from: 'Ratnagiri', to: 'Malvan', mode: 'ROAD' as const, distanceKm: 168 };
const MODEL_MIN = 280;     // what our climb model floored it to — an hour and a quarter out
const GOOGLE_MIN = 202;    // what the road actually takes
const RQI = 4;             // an NH: terrainSpeedKmh(4) = 55 -> 3.05 h. Below both.

console.log('-- 1. AN UNLABELLED LEG IS UNCHANGED. Byte for byte. Nothing regresses. --');

const unlabelled: LegOption = { ...NH66, durationMin: MODEL_MIN };
check("an unlabelled ROAD leg still takes the SLOWER of router and terrain (yesterday's law)",
  near(vehicleHours(unlabelled, { roadQualityIndex: RQI }), MODEL_MIN / 60),
  `${(vehicleHours(unlabelled, { roadQualityIndex: RQI }) * 60).toFixed(0)}m`);
check('...and it can never be SHORTER than what the router already claimed — a tightening',
  vehicleHours(unlabelled, { roadQualityIndex: RQI }) >= 153 / 60);

console.log('\n-- 2. A GUESS IS FLOORED. The US-803c tightening stays, in full. --');

const routed: LegOption = { ...NH66, durationMin: MODEL_MIN, durationSource: 'routed' };
check("a 'routed' clock is floored exactly as before — an OPINION does not outrank the earth",
  near(vehicleHours(routed, { roadQualityIndex: RQI }), MODEL_MIN / 60));

// 160 km of ghat road. OSRM says 2h10. The terrain says 7.3 hours. It is the terrain.
const ghat: LegOption = { from: 'Manali', to: 'Keylong', mode: 'ROAD', distanceKm: 160, durationMin: 130, durationSource: 'routed' };
const ghatHrs = vehicleHours(ghat, { roadQualityIndex: 1 });
check("OSRM's 2h10 on a 160 km ghat road is overruled — it becomes 7.3 hours",
  near(ghatHrs, 160 / 22, 0.05), `${ghatHrs.toFixed(2)}h`);
check('...and THE BODY GATE FIRES on it for a 56-year-old (hard cap 5.0 h)',
  roadDayHardCapExceeded(ghat, TOLERANCE.elderly, { roadQualityIndex: 1 }).exceeded);
check("...where the router's own clock would have sailed straight through that same cap",
  130 / 60 < TOLERANCE.elderly.hardCapHrs);

console.log('\n-- 3. A MEASUREMENT IS TRUSTED. Not floored, not averaged, not second-guessed. --');

const measured: LegOption = { ...NH66, durationMin: GOOGLE_MIN, durationSource: 'measured' };
const measuredHrs = vehicleHours(measured, { roadQualityIndex: RQI });
check('Google drove NH66 in 202 minutes, and we take 202 minutes',
  near(measuredHrs, GOOGLE_MIN / 60), `${(measuredHrs * 60).toFixed(0)}m`);
check("...it is NOT raised to the model's 4h40 — a curve fitted to four roads does not " +
      'outrank the road itself',
  measuredHrs < MODEL_MIN / 60);
check('...and the hour and a quarter we were wrong by is gone',
  near(MODEL_MIN / 60 - measuredHrs, 1.3, 0.05),
  `${((MODEL_MIN / 60 - measuredHrs) * 60).toFixed(0)}m recovered`);

// THE SAFETY HALF, AND IT MATTERS MORE THAN THE OTHER ONE. A measurement is trusted UPWARDS
// too. It is a FACT, not an optimisation — we are not reaching for the smaller number.
const measuredSlow: LegOption = {
  from: 'Gangtok', to: 'Darjeeling', mode: 'ROAD', distanceKm: 200, durationMin: 330, durationSource: 'measured',
};
check('a measurement SLOWER than our model is taken too — we are not shopping for the short one',
  near(vehicleHours(measuredSlow, { roadQualityIndex: 4 }), 330 / 60));
check('...so a measured 5h30 drive STILL trips the 5-hour gate for a 56-year-old',
  roadDayHardCapExceeded(measuredSlow, TOLERANCE.elderly, { roadQualityIndex: 4 }).exceeded);

console.log('\n-- 4. THE LABEL CANNOT REACH ANYTHING IT HAS NO BUSINESS WITH. --');

// Typed, not inline: vehicleHours() takes only the CLOCK, never the endpoints, so a bare
// literal carrying from/to is an excess property. Naming the leg says what it is anyway.
const railDelhiAgra: LegOption = { from: 'Delhi', to: 'Agra', mode: 'RAIL', distanceKm: 233, durationMin: 110, durationSource: 'measured' };
const airDelhiGoa: LegOption = { from: 'Delhi', to: 'Goa', mode: 'AIR', durationMin: 150, durationSource: 'measured' };
check('RAIL is untouched: a published timetable was never floored, and still is not',
  near(vehicleHours(railDelhiAgra), 110 / 60));
check('AIR is untouched too', near(vehicleHours(airDelhiGoa), 150 / 60));
check("a road labelled 'measured' with NO clock cannot invent one — it falls back to the model",
  near(vehicleHours({ ...NH66, durationSource: 'measured' }, { roadQualityIndex: RQI }), 168 / 55));

console.log('\n-- 5. THE MODEL LABELS ITSELF HONESTLY. A pure function cannot drive a road. --');

const t = terrainFromProfile(98, [
  { segKm: 0, elevM: 55 }, { segKm: 49, elevM: 1100 }, { segKm: 49, elevM: 1500 },
], 84);
check("terrainFromProfile() returns source:'routed' — it is a MODEL, and it says so",
  t.source === 'routed', String(t.source));
check('...and it keeps modelMinutes, so a measurement always has a cross-check to answer to',
  t.modelMinutes === t.minutes && (t.modelMinutes ?? 0) > 0);

console.log("\n-- 6. THE STRUCTURAL GUARD. Only the Google adapter may write 'measured'. --");

const dir = join(__dirname, '..');
const writers: string[] = [];
for (const f of readdirSync(dir)) {
  if (!f.endsWith('.ts') || f.endsWith('.e1bak')) continue;
  const src = readFileSync(join(dir, f), 'utf8');
  if (/(?:durationSource|source)\s*:\s*'measured'/.test(src)) writers.push(f);
}
check("exactly ONE file in the engine can promote a leg to 'measured' — roadTerrainDb.ts",
  writers.length === 1 && writers[0] === 'roadTerrainDb.ts',
  `writers: ${writers.join(', ') || '(none)'}`);

const physio = readFileSync(join(dir, 'physiology.ts'), 'utf8');
check('physiology.ts still holds the Math.max floor — THE TIGHTENING WAS NOT REMOVED',
  /Math\.max\(routerHrs, terrainHrs\)/.test(physio));
check("...and it skips that floor ONLY when the leg says 'measured'",
  /leg\.durationSource === 'measured'/.test(physio));

const rtdb = readFileSync(join(dir, 'roadTerrainDb.ts'), 'utf8');
check('the Google call NEVER sends departure_time (it would double the price for traffic ' +
      'we do not want)', !/departure_time/.test(rtdb.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')));
check('...and Google is OFF unless GOOGLE_DIRECTIONS=on, so today nothing changes at all',
  /GOOGLE_DIRECTIONS_ON\s*=\s*String\(process\.env\.GOOGLE_DIRECTIONS/.test(rtdb));

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
