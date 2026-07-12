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
