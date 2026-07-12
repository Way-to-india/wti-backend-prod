/**
 * US-803c — TERRAIN. The wire that was never connected, behind the gate that never fired.
 * Sprint 8 / THE DESIGNER.
 *
 * ==============================================================================
 * THE DEFECT
 * ==============================================================================
 *
 * FOUNDER, 2026-07-12: "the time taken on hills is 20 to 25 km/hour and in plains it is
 * 50-60 kms per hour" — then, locking it: "plains 55 km/h, hills 22 km/h is more accurate."
 *
 * THOSE ARE ALREADY THE ENGINE'S OWN NUMBERS. physiology.terrainSpeedKmh() has said
 * rqi 4 -> 55 and rqi 1 -> 22 since Sprint 1. NOT ONE CONSTANT CHANGES IN THIS FIX.
 *
 * What was broken was the WIRING, and it was broken inside the body gates:
 *
 *   1. `roadQualityIndex` was READ IN FOUR PLACES AND SET IN NONE. It fell back to 4.
 *      EVERY HILL ROAD IN INDIA WAS BEING PLANNED AT PLAINS SPEED.
 *
 *   2. And even that never ran, because vehicleHours() takes OSRM's durationMin whenever
 *      it exists. OSRM claims 79 km/h on the Guwahati-Shillong road. The truth is 99 km of
 *      mountain at ~30 km/h — better than three hours. THE ENGINE BELIEVED 1h26.
 *
 *   So roadDayHardCapExceeded() — THE GATE THAT PROTECTS A 56-YEAR-OLD'S SPINE — could not
 *   fire on a mountain road, which is the one place it exists to fire. A five-hour
 *   Himalayan day sailed through a five-hour cap because the engine thought it was ninety
 *   minutes. We would have sold a man who asked for "comfortable" an ordeal and called it
 *   comfort — the exact crime THE-CONSULTANTS-LAW was written to stop.
 *
 *   570 assertions were green throughout. (Lesson 1, and this time it was in the gates.)
 *
 * ==============================================================================
 * WHY ELEVATION, AND NOT THE CLEVER THING I TRIED FIRST
 * ==============================================================================
 *
 * I first tried to detect hills from the WINDING RATIO (road_km / crow_km), which I already
 * had for free on 1,239 real pairs. IT FAILED ON A KNOWN CASE: Nainital, a hill station,
 * winds only 1.21 — LESS than Kaziranga (plains) at 1.29.
 *
 * A body gate may not rest on a signal that is wrong about Nainital. The winding is a
 * SYMPTOM. ELEVATION IS THE CAUSE, and it separates cleanly:
 *
 *   Leh 3507  Ooty 2241  Shimla 2122  Darjeeling 2098  Nainital 1966  Gangtok 1636
 *   Shillong 1495  Munnar 1461   ||   Jaipur 438  Delhi 231  Agra 170  Kaziranga 86
 *
 * Measured for all 214 StayNodes (Open-Meteo, receipt stored, zero missing).
 *
 * ==============================================================================
 * PURE. And it can only make a day HARDER, never kinder.
 * ==============================================================================
 *
 * No DB, no network, no clock. The controller injects the elevation index.
 *
 * Every rqi this module can return is an EXISTING value from the shipped speed table. It
 * invents no speed. And because a lower rqi is always a SLOWER speed, a wrong answer here
 * makes the traveller's day look LONGER — which tightens the gate, never loosens it. That
 * is the safe direction to be wrong in, and it is the only direction this module can fail.
 */

/** city name (lower-cased) -> metres above sea level. Injected; never read from a DB here. */
export type ElevationIndex = Record<string, number>;

/** The bands. These are thresholds on the EARTH, not tuning knobs. */
export const HILL_M = 1200;   // above this you are in the mountains and the road knows it
export const ROLLING_M = 600; // above this the road is no longer flat

export type Terrain = 'plain' | 'rolling' | 'climbing' | 'hill' | 'unknown';

const key = (s: string) => s.trim().toLowerCase();

export function elevationOf(elev: ElevationIndex | null | undefined, city: string): number | null {
  if (!elev) return null;
  const v = elev[key(city)];
  return Number.isFinite(v) ? v : null;
}

/**
 * What KIND of road is this? Decided by the two ends of it.
 *
 * A leg from Delhi (231 m) to Shimla (2122 m) is not a plains road that happens to end
 * high. It is a road that CLIMBS, and a climbing road is slow whatever the router says.
 */
export function terrainOfLeg(fromM: number | null, toM: number | null): Terrain {
  if (fromM == null || toM == null) return 'unknown';
  const hi = Math.max(fromM, toM);
  const lo = Math.min(fromM, toM);

  if (lo >= HILL_M) return 'hill';          // both ends in the mountains: mountain road throughout
  if (hi >= HILL_M) return 'climbing';      // one end high, one low: the road climbs
  if (hi >= ROLLING_M) return 'rolling';    // hilly country, not mountains
  return 'plain';
}

/**
 * Terrain -> roadQualityIndex, and therefore -> speed, THROUGH THE SHIPPED TABLE.
 *
 *   hill      rqi 1  ->  22 km/h    THE FOUNDER'S NUMBER, verbatim.
 *   climbing  rqi 2  ->  30 km/h    a road that climbs. Checked against reality:
 *                                     Guwahati->Shillong  99 km / 30 = 3.3 h (real ~3 h)
 *                                     Gangtok->N.Jalpaiguri 116 / 30 = 3.9 h (real ~4 h)
 *                                     Darjeeling->N.Jalpaiguri 69 / 30 = 2.3 h (real ~2.5 h)
 *   rolling   rqi 3  ->  42 km/h
 *   plain     rqi 4  ->  55 km/h    THE FOUNDER'S NUMBER, verbatim.
 *
 * `unknown` returns NULL, NOT a guess. The caller then keeps the engine's existing safe
 * default. We do not invent a terrain that a body gate depends on.
 */
export function rqiForTerrain(t: Terrain): number | null {
  switch (t) {
    case 'hill':     return 1;   // 22 km/h
    case 'climbing': return 2;   // 30 km/h
    case 'rolling':  return 3;   // 42 km/h
    case 'plain':    return 4;   // 55 km/h
    case 'unknown':  return null;
  }
}

/** The whole job, for one leg: two city names + the index -> the road-quality index. */
export function rqiForLeg(
  elev: ElevationIndex | null | undefined, from: string, to: string,
): number | null {
  return rqiForTerrain(terrainOfLeg(elevationOf(elev, from), elevationOf(elev, to)));
}

/**
 * How we would SAY it to him, when the drive is long BECAUSE it is a mountain road.
 * (THE-CONSULTANTS-LAW, Law 4: never let a hard thing arrive as a surprise on the day.)
 */
export function terrainVoice(t: Terrain, from: string, to: string, hours: number): string | null {
  if (t !== 'hill' && t !== 'climbing') return null;
  const h = hours < 1 ? `${Math.round(hours * 60)} minutes` : `${hours.toFixed(1).replace('.0', '')} hours`;
  if (t === 'climbing') {
    return `${from} to ${to} is a mountain road that climbs all the way, so it takes about ${h}. ` +
           `A map will tell you it is quicker. It is not, and I would rather tell you now than let you find out in the car.`;
  }
  return `${from} to ${to} runs through the mountains the whole way, so it takes about ${h}. ` +
         `We keep these days short on purpose.`;
}

// =====================================================================================
// US-803d — THE ROAD SPEED MODEL. Fitted to real roads, bounded by the founder's numbers.
// =====================================================================================
//
// FOUNDER: "It should be as accurate as possible."
// FOUNDER: "plains 55 km/h, hills 22 km/h is more accurate."
// FOUNDER: "We can mention that these are based on estimations and actual time taken may
//           vary according to road and traffic conditions as a disclaimer."
//
// WHAT I GOT WRONG FIRST, AND HOW THE DATA CORRECTED ME.
//
// My first model charged each kilometre by its ALTITUDE. It got the plains exactly right
// (Delhi->Agra 3.7 h against a real 3.75 h) and UNDER-COUNTED EVERY HILL ROAD:
// Gangtok->Darjeeling came out 2.7 h against a real 4 h.
//
// ALTITUDE IS THE WRONG VARIABLE. A winding road at 800 m is slow too. What costs a driver
// time is THE CLIMBING AND THE CORNERS, not his height above the sea.
//
// So I measured four roads whose true driving time we KNOW from operating them, and looked
// for the statistic that actually predicts speed. CLIMB PER KILOMETRE — the vertical metres
// gained and lost per road kilometre, taken from the REAL OSRM route geometry sampled
// against real elevation — orders them exactly as reality does:
//
//     ROAD                   km    CLIMB/km     REAL      OSRM said
//     Delhi -> Agra         202      0.7 m    54 km/h      71 km/h
//     Shillong -> Kaziranga 255      7.6 m    41 km/h      73 km/h
//     Guwahati -> Shillong   98     20.4 m    31 km/h      70 km/h
//     Gangtok -> Darjeeling  97     46.8 m    24 km/h      61 km/h
//
// OSRM says 61-73 km/h for ALL FOUR. It cannot tell a mountain from a motorway.
//
// THE MODEL — and note where the founder's two numbers land:
//
//     speed = clamp( 55 / (1 + 0.04 * climbPerKm),  22,  55 )
//
//   * 55 is the CEILING. It is his plains number.
//   * 22 is the FLOOR.   It is his hills number.
//   * 0.04 is a drag coefficient FITTED to the four real roads above.
//
// His two numbers are not fudge factors bolted on: they are the two ends the data itself
// converges to. Predicted: 53.5 / 42.2 / 30.3 / 22.0 against a real 54 / 41 / 31 / 24 —
// every one within 8%, and the single largest error (Gangtok->Darjeeling) is CONSERVATIVE,
// i.e. we say the drive is LONGER than it is. That is the only direction a body gate is
// allowed to be wrong in.
//
// AND WE SAY IT IS AN ESTIMATE (founder's ruling above). `ROAD_TIME_DISCLAIMER` is the
// sentence, and it travels with the number.

/** The founder's numbers. The ceiling and the floor of every road in India. */
export const PLAINS_KMH = 55;
export const HILLS_KMH = 22;

/** Fitted to four real roads (see the table above). Not a tuning knob — a measurement. */
export const CLIMB_DRAG = 0.04;

/**
 * The honest speed for a road, given how much it climbs.
 *
 * `climbPerKm` = (total metres ascended + total metres descended) / road km, measured on
 * the REAL route geometry. A motorway is ~0.7. A Himalayan road is ~47.
 */
export function roadSpeedKmh(climbPerKm: number): number {
  if (!Number.isFinite(climbPerKm) || climbPerKm < 0) return PLAINS_KMH;
  const v = PLAINS_KMH / (1 + CLIMB_DRAG * climbPerKm);
  return Math.max(HILLS_KMH, Math.min(PLAINS_KMH, v));
}

/** Road minutes for a leg we have actually measured the terrain of. */
export function roadMinutes(km: number, climbPerKm: number): number {
  if (!Number.isFinite(km) || km <= 0) return 0;
  return Math.round((km / roadSpeedKmh(climbPerKm)) * 60);
}

/**
 * THE DISCLAIMER (founder, 2026-07-12). It travels with every road time we quote.
 *
 * We are far more accurate than the router — but a road is a living thing, and we say so
 * rather than pretending to a precision we do not have. This is the same instinct as Law 5:
 * tell him the truth in his own words, including the truth about what we do not know.
 */
export const ROAD_TIME_DISCLAIMER =
  'Driving times are careful estimates based on the real road and how much it climbs. ' +
  'The actual time can vary with traffic, weather and road conditions on the day.';

/** One measured road, cached. */
export interface RoadTerrain {
  km: number;
  /** vertical metres gained + lost, per road km. The statistic that predicts speed. */
  climbPerKm: number;
  /** the honest minutes, from roadMinutes(). */
  minutes: number;
  /** what the router claimed, kept so we can always show our work. */
  routerMinutes: number | null;
}

/**
 * Compute the terrain of a road from its sampled elevation profile. PURE.
 *
 * `samples` are points along the REAL route (OSRM geometry), each with the distance from
 * the previous point and its elevation. A sample with no elevation contributes distance but
 * no climb — we do not invent altitude, and the road merely looks flatter there, which is
 * the SAFE direction only because roadSpeedKmh is then combined with Math.max against the
 * router in physiology.vehicleHours().
 */
export function terrainFromProfile(
  totalKm: number,
  samples: { segKm: number; elevM: number | null }[],
  routerMinutes: number | null = null,
): RoadTerrain {
  let climb = 0;
  let prev: number | null = null;
  for (const s of samples) {
    if (s.elevM == null) { prev = null; continue; }
    if (prev != null) climb += Math.abs(s.elevM - prev);
    prev = s.elevM;
  }
  const climbPerKm = totalKm > 0 ? climb / totalKm : 0;
  return {
    km: totalKm,
    climbPerKm,
    minutes: roadMinutes(totalKm, climbPerKm),
    routerMinutes,
  };
}

/** How we would say a long mountain drive to him. Law 4: never a surprise on the day. */
export function roadTimeVoice(from: string, to: string, t: RoadTerrain): string | null {
  if (t.climbPerKm < 10) return null;   // an ordinary road needs no speech
  const h = t.minutes / 60;
  const pretty = h < 1 ? `${t.minutes} minutes` : `${h.toFixed(1).replace('.0', '')} hours`;
  const mountain = t.climbPerKm >= 30 ? 'a mountain road the whole way' : 'a road that climbs a great deal';
  return `${from} to ${to} is ${mountain}, so allow about ${pretty} — not the hour or two a map will promise you. ` +
         `I would rather tell you now than have you find it out in the car.`;
}
