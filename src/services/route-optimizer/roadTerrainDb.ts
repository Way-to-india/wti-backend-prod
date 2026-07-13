/**
 * US-803d — MEASURE THE ROAD. The DB/network half; the model itself is pure (terrain.ts).
 *
 * For a road leg we take the REAL route geometry from OSRM, sample it, ask the earth how
 * high each sample is (Open-Meteo), and compute CLIMB PER KILOMETRE — the statistic that
 * actually predicts driving speed. The result is cached forever in `road_leg_terrain`,
 * because a mountain does not move.
 *
 *     OSRM says 61-73 km/h for Delhi->Agra, Shillong->Kaziranga, Guwahati->Shillong AND
 *     Gangtok->Darjeeling alike. IT CANNOT TELL A MOUNTAIN FROM A MOTORWAY. The real
 *     speeds are 54, 41, 31 and 24.
 *
 * ABSENT-SAFE. If OSRM or Open-Meteo does not answer, we return null and the caller keeps
 * the router's number. A missing measurement leaves the plan no worse than yesterday's. An
 * INVENTED measurement would be a lie with a body gate behind it.
 */
import prisma from '@/config/db';
import { osrmRouteGeometry, haversineKm } from './geo';
import { terrainFromProfile, type RoadTerrain } from './terrain';
import type { LatLng } from './types';

const SAMPLES = 60;          // enough to see a ghat; few enough for one elevation call
const CACHE_TTL_DAYS = 3650; // a mountain does not move

// ---- US-800a — THE MEASUREMENT ------------------------------------------------------
//
// OFF BY DEFAULT. Set GOOGLE_DIRECTIONS=on in .env once the Directions API is allowed on
// GOOGLE_PLACES_API_KEY. While it is off, EVERY LEG BEHAVES EXACTLY AS IT DID YESTERDAY:
// the climb model floors OSRM, and physiology.vehicleHours() keeps its full tightening.
// Nothing about this file can loosen a body gate while the flag is off.
const GOOGLE_DIRECTIONS_ON = String(process.env.GOOGLE_DIRECTIONS || '').toLowerCase() === 'on';

/** Beyond this, the measurement and our model do not merely differ — they DISAGREE. We
 *  trust the measurement (it drove the road) but we REFUSE TO DO SO SILENTLY: the leg is
 *  flagged, because a model that is 40% out on a road is telling us something about the
 *  model, and a model we stop listening to is a model we stop learning from. */
const DISAGREE_FLAG = 0.40;

/**
 * GOOGLE DRIVING MINUTES — A ROAD SOMEBODY HAS ACTUALLY DRIVEN.
 *
 * WE NEVER SEND `departure_time`. That single parameter flips this call from Directions
 * ESSENTIALS to Directions ADVANCED: double the price, half the free tier — and it buys us
 * live traffic, which we do not want. A plan made today is travelled in three months. The
 * page adds its own buffer, and ROAD_TIME_DISCLAIMER already says the day will vary.
 *
 * Free tier: 10,000 calls a month. Our entire backfill of every road on the site is 62
 * calls, and each is cached forever, because a road does not move.
 *
 * ABSENT-SAFE. Any doubt at all -> null -> the caller keeps the climb model, exactly as it
 * does today. A MISSING MEASUREMENT IS SAFE. AN INVENTED ONE IS A LIE WITH A BODY GATE
 * BEHIND IT.
 */
async function googleDrivingMinutes(a: LatLng, b: LatLng): Promise<number | null> {
  if (!GOOGLE_DIRECTIONS_ON) return null;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;
  try {
    const url = 'https://maps.googleapis.com/maps/api/directions/json'
      + `?origin=${a[0]},${a[1]}&destination=${b[0]},${b[1]}`
      + '&mode=driving&region=in'          // NO departure_time. DELIBERATE. See above.
      + `&key=${apiKey}`;
    const r = await fetch(url);
    const j: any = await r.json();
    if (j?.status !== 'OK') {
      if (j?.status && j.status !== 'ZERO_RESULTS') {
        console.warn(`[directions] ${j.status} — falling back to the climb model.`);
      }
      return null;
    }
    const secs = j?.routes?.[0]?.legs?.[0]?.duration?.value;
    return Number.isFinite(+secs) && +secs > 0 ? Math.round(+secs / 60) : null;
  } catch {
    return null;   // the network did not answer. We say nothing rather than guess.
  }
}

export async function ensureRoadTerrainTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS road_leg_terrain (
      from_city    text NOT NULL,
      to_city      text NOT NULL,
      km           numeric(7,1) NOT NULL,
      climb_per_km numeric(6,2) NOT NULL,
      minutes      integer NOT NULL,
      router_min   integer,
      samples      smallint NOT NULL,
      source       text NOT NULL DEFAULT 'osrm+open-meteo',
      computed_at  timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (from_city, to_city)
    )`);
  // US-800a — provenance. Additive, idempotent, and safe on the live table.
  await prisma.$executeRawUnsafe(
    `ALTER TABLE road_leg_terrain ADD COLUMN IF NOT EXISTS duration_source text NOT NULL DEFAULT 'routed'`);
  await prisma.$executeRawUnsafe(
    `ALTER TABLE road_leg_terrain ADD COLUMN IF NOT EXISTS model_min integer`);
}

const key = (s: string) => s.trim().toLowerCase();

/** Thin the polyline to N evenly-spaced points. */
function sampleLine(coords: LatLng[], n: number): LatLng[] {
  if (coords.length <= n) return coords;
  const out: LatLng[] = [];
  for (let i = 0; i < n; i++) out.push(coords[Math.round((i * (coords.length - 1)) / (n - 1))]);
  return out;
}

async function elevationsOf(pts: LatLng[]): Promise<(number | null)[]> {
  const lat = pts.map((p) => p[0].toFixed(4)).join(',');
  const lng = pts.map((p) => p[1].toFixed(4)).join(',');
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
    const j: any = await r.json();
    return Array.isArray(j?.elevation) && j.elevation.length === pts.length
      ? j.elevation.map((e: any) => (Number.isFinite(+e) ? Math.round(+e) : null))
      : pts.map(() => null);
  } catch {
    return pts.map(() => null);   // we do not know. We do not guess.
  }
}

/**
 * THE GEOGRAPHY GATE. A cached leg is only a measurement of THIS leg if it could physically be
 * the road between THESE two points.
 *
 * A ROAD CANNOT BE SHORTER THAN THE CROW FLIES. And a road 2.2x longer than the straight line is
 * not a detour, it is a different journey. Across our 63 genuinely-cached legs the detour factor
 * has a median of 1.41 and healthy legs sit inside [1.0, 2.2]. The rows that had been silently
 * poisoned by a gazetteer correction sat at 0.40 and 4.34, and both were stamped `measured`.
 *
 * Returns true when the cached distance is impossible for these endpoints -- in which case the
 * row is about somewhere else, and we throw it away and go and drive it again.
 */
export function geographyDisagrees(cachedKm: number, a: LatLng, b: LatLng): boolean {
  const crow = haversineKm(a, b);
  if (!(crow > 20)) return false;          // too short to reason about; leave it alone
  if (!(cachedKm > 0)) return true;
  const detour = cachedKm / crow;
  return detour < 0.95 || detour > 2.2;
}

/**
 * Read the cache.
 *
 * The comment here used to read: "A mountain does not move, so a hit is as good as a fresh
 * measurement." The mountain does not move. THE MEANING OF THE NAME DOES -- and the primary key
 * of this table is a pair of NAMES. When the gazetteer was corrected, "Rameswaram" moved 600 km
 * and every row here kept the old geography, stamped `measured`.
 */
async function cached(from: string, to: string, a?: LatLng, b?: LatLng): Promise<RoadTerrain | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT km, climb_per_km, minutes, router_min, duration_source, model_min FROM road_leg_terrain
        WHERE from_city = $1 AND to_city = $2
          AND computed_at > now() - interval '${CACHE_TTL_DAYS} days'`, key(from), key(to));
    if (!rows.length) return null;
    const r = rows[0];

    // THE GEOGRAPHY GATE. If the row cannot be the road between these two points, it is not
    // this leg's row. Discard it -- a stale MEASUREMENT is more dangerous than no measurement,
    // because `measured` is exactly what the engine has been taught to trust without question.
    if (a && b && geographyDisagrees(Number(r.km), a, b)) {
      console.error(
        `[ROUTE-MIND] STALE LEG DISCARDED — ${key(from)} -> ${key(to)}: cached ${Number(r.km)} km, ` +
        `but the crow flies ${Math.round(haversineKm(a, b))} km. The name now means somewhere else.`,
      );
      return null;
    }

    return {
      km: Number(r.km),
      climbPerKm: Number(r.climb_per_km),
      minutes: Number(r.minutes),
      routerMinutes: r.router_min == null ? null : Number(r.router_min),
      source: (r.duration_source === 'measured' ? 'measured' : 'routed'),
      modelMinutes: r.model_min == null ? undefined : Number(r.model_min),
    };
  } catch { return null; }
}

/**
 * THE HONEST DRIVING TIME for one road leg. Cached; measured on first sight.
 *
 * Returns null when we could not measure it — and then the caller keeps the router's
 * number, exactly as before. Never a guess.
 */
export async function roadTerrainFor(
  fromCity: string, toCity: string, a: LatLng, b: LatLng,
): Promise<RoadTerrain | null> {
  const hit = await cached(fromCity, toCity, a, b);
  // A cached GUESS is not good enough once we can MEASURE. If Google is now switched on and
  // this row was only ever routed, we go and drive it. (Once. Then it is cached as a fact.)
  if (hit && !(GOOGLE_DIRECTIONS_ON && hit.source !== 'measured')) return hit;

  const geom = await osrmRouteGeometry(a, b);
  if (!geom || !geom.coords?.length || !(geom.km > 0)) return null;

  const pts = sampleLine(geom.coords, SAMPLES);
  const els = await elevationsOf(pts);
  if (els.every((e) => e == null)) return null;   // the earth did not answer. We say nothing.

  // scale the sampled polyline back up to OSRM's true road distance
  let sampled = 0;
  for (let i = 0; i < pts.length - 1; i++) sampled += haversineKm(pts[i], pts[i + 1]);
  const scale = sampled > 0 ? geom.km / sampled : 1;

  const samples = pts.map((p, i) => ({
    segKm: i === 0 ? 0 : haversineKm(pts[i - 1], p) * scale,
    elevM: els[i],
  }));

  const t = terrainFromProfile(geom.km, samples, geom.min);

  // ---- US-800a — TRUST A MEASUREMENT; FLOOR A GUESS --------------------------------
  //
  // We keep the climb model EVEN WHEN GOOGLE ANSWERS. Two reasons, both load-bearing:
  //   1. `climbPerKm` feeds roadQualityIndex -> terrainSpeedKmh -> the body gates, and it is
  //      a real measurement of the earth. Google's clock does not replace it.
  //   2. The model is our CROSS-CHECK. When it and the measurement disagree by more than
  //      DISAGREE_FLAG we trust the measurement, but we FLAG the leg. We do not trust
  //      either one silently.
  const googleMin = await googleDrivingMinutes(a, b);
  let out: RoadTerrain;
  if (googleMin != null && googleMin > 0) {
    const gap = t.minutes > 0 ? Math.abs(googleMin - t.minutes) / t.minutes : 0;
    out = {
      ...t,
      minutes: googleMin,          // THE FACT. Not floored. Not averaged. Not second-guessed.
      source: 'measured',
      modelMinutes: t.minutes,
      disagreementPct: t.minutes > 0 ? Number(gap.toFixed(3)) : null,
      needsHuman: gap > DISAGREE_FLAG,
    };
    if (out.needsHuman) {
      console.warn(
        `[road_leg_terrain] MEASUREMENT vs MODEL DISAGREE by ${Math.round(gap * 100)}% on ` +
        `${fromCity} -> ${toCity}: Google ${googleMin}m, our model ${t.minutes}m (climb/km ` +
        `${t.climbPerKm.toFixed(1)}). Trusting the measurement. FLAGGED FOR A HUMAN.`);
    }
  } else {
    out = { ...t, source: 'routed', modelMinutes: t.minutes };
  }

  try {
    await ensureRoadTerrainTable();
    await prisma.$executeRawUnsafe(
      `INSERT INTO road_leg_terrain (from_city, to_city, km, climb_per_km, minutes, router_min, samples, duration_source, model_min)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (from_city, to_city) DO UPDATE
         SET km = EXCLUDED.km, climb_per_km = EXCLUDED.climb_per_km, minutes = EXCLUDED.minutes,
             router_min = EXCLUDED.router_min, duration_source = EXCLUDED.duration_source,
             model_min = EXCLUDED.model_min, computed_at = now()`,
      key(fromCity), key(toCity), out.km, Number(out.climbPerKm.toFixed(2)), out.minutes,
      out.routerMinutes, pts.length, out.source ?? 'routed', out.modelMinutes ?? null);
  } catch (e) {
    console.error('road_leg_terrain cache write failed (non-fatal):', e);
  }
  return out;
}
