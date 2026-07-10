/**
 * DB layer for pearl-on-the-string anchors (spec §4.4). Kept SEPARATE from the pure
 * anchors.ts so the engine core stays dependency-free. The curated en_route_anchors
 * table is the authoritative source (matched in either direction); a generic
 * tourist-town query near the leg midpoint is the fallback.
 */
import prisma from '@/config/db';
import { haversineKm } from './geo';
import { type AnchorCandidate, anchorValueFromCounts } from './anchors';

/** Curated anchors for a corridor, unordered (A→B or B→A). */
export async function curatedAnchors(fromCity: string, toCity: string): Promise<AnchorCandidate[]> {
  const lf = fromCity.trim().toLowerCase(), lt = toCity.trim().toLowerCase();
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT anchor_name, anchor_lat, anchor_lng, anchor_value_days, why
       FROM en_route_anchors
       WHERE (lower(city_a)=$1 AND lower(city_b)=$2) OR (lower(city_a)=$2 AND lower(city_b)=$1)
       ORDER BY anchor_value_days DESC`, lf, lt);
    return rows.map((r) => ({
      name: String(r.anchor_name),
      coord: [Number(r.anchor_lat), Number(r.anchor_lng)] as [number, number],
      valueDays: Number(r.anchor_value_days) || 0.5,
      why: r.why ?? null,
      source: 'curated',
    }));
  } catch (e) { console.error('curatedAnchors failed:', e); return []; }
}

/** Generic tourist-town anchors near the straight-line midpoint (fallback). */
async function genericAnchors(fromCoord: [number, number], toCoord: [number, number], limit = 5): Promise<AnchorCandidate[]> {
  const mid: [number, number] = [(fromCoord[0] + toCoord[0]) / 2, (fromCoord[1] + toCoord[1]) / 2];
  const B = 0.7;
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT c.name, c.latitude AS lat, c.longitude AS lng, c."tourCount" AS tour, COALESCE(pc.monument_count,0) AS mon
       FROM cities c LEFT JOIN poi_cities pc ON lower(pc.name)=lower(c.name)
       WHERE c."isActive"=true AND c.latitude IS NOT NULL
         AND c.latitude BETWEEN ${mid[0] - B} AND ${mid[0] + B} AND c.longitude BETWEEN ${mid[1] - B} AND ${mid[1] + B}`);
    return rows
      .map((r) => ({
        name: String(r.name),
        coord: [Number(r.lat), Number(r.lng)] as [number, number],
        valueDays: anchorValueFromCounts(Number(r.tour) || 0, Number(r.mon) || 0),
        source: 'generic',
        _d: haversineKm(mid, [Number(r.lat), Number(r.lng)]),
      }))
      .filter((c) => Number.isFinite(c.coord[0]) && (c as any)._d <= 90 && c.valueDays >= 0.5)
      .sort((a, b) => (b.valueDays - a.valueDays) || ((a as any)._d - (b as any)._d))
      .slice(0, limit)
      .map(({ name, coord, valueDays, source }) => ({ name, coord, valueDays, source }));
  } catch (e) { console.error('genericAnchors failed:', e); return []; }
}

/** All anchor candidates for a leg: curated first, generic appended as fallback. */
export async function anchorCandidatesForLeg(
  fromCity: string, toCity: string,
  fromCoord: [number, number], toCoord: [number, number],
): Promise<AnchorCandidate[]> {
  const curated = await curatedAnchors(fromCity, toCity);
  if (curated.length) return curated.concat(await genericAnchors(fromCoord, toCoord, 3));
  return genericAnchors(fromCoord, toCoord, 5);
}
