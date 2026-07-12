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

/** Read the cache. A mountain does not move, so a hit is as good as a fresh measurement. */
async function cached(from: string, to: string): Promise<RoadTerrain | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT km, climb_per_km, minutes, router_min FROM road_leg_terrain
        WHERE from_city = $1 AND to_city = $2
          AND computed_at > now() - interval '${CACHE_TTL_DAYS} days'`, key(from), key(to));
    if (!rows.length) return null;
    const r = rows[0];
    return {
      km: Number(r.km),
      climbPerKm: Number(r.climb_per_km),
      minutes: Number(r.minutes),
      routerMinutes: r.router_min == null ? null : Number(r.router_min),
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
  const hit = await cached(fromCity, toCity);
  if (hit) return hit;

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

  try {
    await ensureRoadTerrainTable();
    await prisma.$executeRawUnsafe(
      `INSERT INTO road_leg_terrain (from_city, to_city, km, climb_per_km, minutes, router_min, samples)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (from_city, to_city) DO UPDATE
         SET km = EXCLUDED.km, climb_per_km = EXCLUDED.climb_per_km, minutes = EXCLUDED.minutes,
             router_min = EXCLUDED.router_min, computed_at = now()`,
      key(fromCity), key(toCity), t.km, Number(t.climbPerKm.toFixed(2)), t.minutes, t.routerMinutes, pts.length);
  } catch (e) {
    console.error('road_leg_terrain cache write failed (non-fatal):', e);
  }
  return t;
}
