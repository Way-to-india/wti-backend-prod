/**
 * Geometry + OSM routing helpers for the Route Optimizer.
 *
 * These mirror the production helpers in
 *   src/controllers/admin/routeStops.controller.ts
 * (osrmRoute / osrmDriving / osrmFoot / haversineKm) so the optimizer and the
 * existing verified-route authoring share ONE routing implementation and ONE
 * data source (free OSRM + OpenStreetMap, no Google, no API key).
 *
 * Refactor note R1: the controller should be updated to import these instead of
 * keeping its own copies. Until then they are byte-identical in behaviour.
 *
 * Everything here is pure/injectable: pass a `fetchImpl` (defaults to global
 * fetch) so unit tests can run fully offline with a stub router.
 */

import type { LatLng } from './types';

export type Fetch = typeof fetch;

export interface RouteResult { km: number; min: number }

const OSRM_DRIVING = 'https://router.project-osrm.org/route/v1/driving';
const OSRM_FOOT = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';

/** Great-circle distance in km (aerial modes: flight / helicopter / ferry). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)));
}

async function osrmRoute(profileUrl: string, a: LatLng, b: LatLng, fetchImpl: Fetch): Promise<RouteResult | null> {
  try {
    const url = `${profileUrl}/${a[1]},${a[0]};${b[1]},${b[0]}?overview=false`;
    const r = await fetchImpl(url);
    const j: any = await r.json();
    const rt = j?.routes?.[0];
    return rt ? { km: Math.round(rt.distance / 1000), min: Math.round(rt.duration / 60) } : null;
  } catch {
    return null;
  }
}

export const osrmDriving = (a: LatLng, b: LatLng, fetchImpl: Fetch = fetch) => osrmRoute(OSRM_DRIVING, a, b, fetchImpl);
export const osrmFoot = (a: LatLng, b: LatLng, fetchImpl: Fetch = fetch) => osrmRoute(OSRM_FOOT, a, b, fetchImpl);

/**
 * Road distance/time with graceful fallback. Tries OSRM; on failure falls back to
 * haversine × road-detour factor (1.30) for km and an assumed 45 km/h coach speed
 * for time, flagging the result estimated. NEVER guesses silently.
 */
export async function roadLeg(
  a: LatLng, b: LatLng, fetchImpl: Fetch = fetch,
): Promise<{ km: number; min: number; estimated: boolean }> {
  const osrm = await osrmDriving(a, b, fetchImpl);
  if (osrm) {
    // pad ×1.15 for real coach speed vs OSRM's optimistic profile (blueprint §2).
    return { km: osrm.km, min: Math.round(osrm.min * 1.15), estimated: false };
  }
  const km = Math.round(haversineKm(a, b) * 1.3);
  return { km, min: Math.round((km / 45) * 60), estimated: true };
}

export interface RouteGeometry { km: number; min: number; coords: LatLng[] }

/**
 * Full road geometry between two points (OSRM, GeoJSON). Used to (a) draw the
 * route following real roads on the map, and (b) place en-route overnight halts
 * at the correct distance along the actual road, not on a straight line.
 */
export async function osrmRouteGeometry(a: LatLng, b: LatLng, fetchImpl: Fetch = fetch): Promise<RouteGeometry | null> {
  try {
    const url = `${OSRM_DRIVING}/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`;
    const r = await fetchImpl(url);
    const j: any = await r.json();
    const rt = j?.routes?.[0];
    if (!rt) return null;
    const coords: LatLng[] = (rt.geometry?.coordinates || []).map((c: number[]) => [c[1], c[0]] as LatLng);
    return { km: Math.round(rt.distance / 1000), min: Math.round((rt.duration / 60) * 1.15), coords };
  } catch {
    return null;
  }
}

/**
 * Alternative road corridors between two points (OSRM alternatives). Returns up to
 * `max` physically distinct routes (different roads / towns en route), each with its
 * own distance, time and geometry — the basis for the "Route A vs Route B" corridor
 * comparison. The first element is always OSRM's primary (fastest) route.
 */
export async function osrmRouteAlternatives(a: LatLng, b: LatLng, max = 3, fetchImpl: Fetch = fetch): Promise<RouteGeometry[]> {
  try {
    const url = `${OSRM_DRIVING}/${a[1]},${a[0]};${b[1]},${b[0]}?alternatives=${max}&overview=full&geometries=geojson`;
    const r = await fetchImpl(url);
    const j: any = await r.json();
    const routes = Array.isArray(j?.routes) ? j.routes : [];
    return routes.map((rt: any) => ({
      km: Math.round(rt.distance / 1000),
      min: Math.round((rt.duration / 60) * 1.15),
      coords: (rt.geometry?.coordinates || []).map((c: number[]) => [c[1], c[0]] as LatLng),
    }));
  } catch {
    return [];
  }
}

/** The coordinate that lies `targetKm` along a polyline (linear interpolation on the nearest segment). */
export function pointAtKmAlong(coords: LatLng[], targetKm: number): LatLng | null {
  if (coords.length < 2) return coords[0] ?? null;
  let acc = 0;
  for (let i = 1; i < coords.length; i++) {
    const seg = haversineKm(coords[i - 1], coords[i]);
    if (acc + seg >= targetKm) {
      const f = seg > 0 ? (targetKm - acc) / seg : 0;
      return [coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * f, coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * f];
    }
    acc += seg;
  }
  return coords[coords.length - 1];
}

/** "2h 45m" from minutes (matches the map's timeText format). */
export function fmtDuration(min: number | null | undefined): string | null {
  if (min == null) return null;
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return `${h ? h + 'h ' : ''}${m ? m + 'm' : h ? '' : '0m'}`.trim();
}
