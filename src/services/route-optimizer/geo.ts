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

/** "2h 45m" from minutes (matches the map's timeText format). */
export function fmtDuration(min: number | null | undefined): string | null {
  if (min == null) return null;
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return `${h ? h + 'h ' : ''}${m ? m + 'm' : h ? '' : '0m'}`.trim();
}
