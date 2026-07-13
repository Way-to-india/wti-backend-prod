/**
 * DB layer for the Sprint-8 spine — StayNodes, gateways, attractions, and the ELEVATIONS
 * that the body gates were missing. Kept SEPARATE from the pure spine.ts / terrain.ts so
 * the engine core stays dependency-free (same doctrine as anchors.ts / anchorsDb.ts).
 *
 * Built by:
 *   migrations/US-802-803-spine.sql      the spine, the gateways, the ASI attractions
 *   migrations/US-802b-own-guides.sql    OUR OWN travel guides (the source I walked past)
 *   scripts/build-spine-gateways.ts      the REAL road drive, from OSRM
 *   scripts/build-elevation.ts           the elevation, from Open-Meteo (214/214, 0 missing)
 */
import prisma from '@/config/db';
import type { ElevationIndex } from './terrain';
import type { StayNode, Gateway, Attraction } from './spine';

/**
 * THE WIRE THE BODY GATES WERE MISSING.
 *
 * `roadQualityIndex` has been read in ddcv.ts, fallback.ts and anchors.ts since Sprint 1 —
 * and SET NOWHERE. It fell back to 4, so EVERY HILL ROAD IN INDIA WAS PLANNED AT PLAINS
 * SPEED (55 km/h) while the traveller was actually crawling up a mountain at 22.
 *
 * physiology.terrainSpeedKmh() already knew the truth (rqi 4 -> 55, rqi 1 -> 22 — exactly
 * the founder's numbers). It was simply never asked. This function is the asking.
 *
 * Absent-safe: if the read fails we return {} and the engine keeps its existing safe
 * default. A missing elevation makes a plan no worse than it was yesterday. A GUESSED
 * elevation would make it a lie with a body gate behind it.
 */
export async function loadElevations(cityNames: string[]): Promise<ElevationIndex> {
  const names = cityNames.map((n) => n.trim().toLowerCase()).filter(Boolean);
  if (!names.length) return {};
  try {
    const rows = await prisma.$queryRawUnsafe<{ name: string; elevation_m: number }[]>(
      `SELECT name, elevation_m FROM stay_nodes
        WHERE elevation_m IS NOT NULL AND lower(name) = ANY($1::text[])`, names);
    const idx: ElevationIndex = {};
    for (const r of rows) idx[String(r.name).trim().toLowerCase()] = Number(r.elevation_m);
    return idx;
  } catch (e) {
    console.error('loadElevations failed (non-fatal — engine keeps its safe default):', e);
    return {};
  }
}

/** Every StayNode in a set of states. The Designer's candidate pool for a region. */
export async function stayNodesInStates(admin1Codes: string[]): Promise<StayNode[]> {
  if (!admin1Codes.length) return [];
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT n.id, n.name, n.lat, n.lng, n.admin1_code, n.state_name, n.district,
              n.tour_count, n.source_kind, n.elevation_m,
              g.source_url AS guide_url, COALESCE(g.has_food, false) AS has_food
         FROM stay_nodes n
         LEFT JOIN stay_node_guides g ON g.stay_node_id = n.id
        WHERE n.admin1_code = ANY($1::text[])
        ORDER BY n.tour_count DESC, n.name`, admin1Codes);
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      lat: Number(r.lat),
      lng: Number(r.lng),
      admin1Code: r.admin1_code ?? null,
      stateName: r.state_name ?? null,
      district: r.district ?? null,
      tourCount: Number(r.tour_count) || 0,
      source: String(r.source_kind) as StayNode['source'],
      guideUrl: r.guide_url ?? null,
      hasOwnFoodNotes: r.has_food === true,
    }));
  } catch (e) {
    console.error('stayNodesInStates failed:', e);
    return [];
  }
}

/**
 * The gateways for a set of StayNodes. Only `primary` and `nearest` — the shortlist ranks
 * are working notes, not answers.
 *
 * EVERY ROW CARRIES ITS PROOF OF SERVICE. A station with fewer than 20 real train stops is
 * not in this table; an airport with no scheduled sector is not in this table. Tezpur has a
 * runway, a name and coordinates, and no aeroplanes — and it appears nowhere.
 */
export async function gatewaysFor(stayNodeIds: string[]): Promise<Map<string, Gateway[]>> {
  const out = new Map<string, Gateway[]>();
  if (!stayNodeIds.length) return out;
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT stay_node_id, kind, role, code, gateway_name, services,
              straight_line_km, road_km, road_min
         FROM stay_node_gateways
        WHERE stay_node_id = ANY($1::text[]) AND role IS NOT NULL
        ORDER BY stay_node_id, kind, role`, stayNodeIds);
    for (const r of rows) {
      const g: Gateway = {
        kind: r.kind === 'air' ? 'air' : 'rail',
        role: r.role === 'primary' ? 'primary' : 'nearest',
        code: r.code ?? null,
        name: String(r.gateway_name),
        services: Number(r.services) || 0,
        straightLineKm: Number(r.straight_line_km),
        // NULL stays NULL. Nothing may present a straight line as a drive time.
        roadKm: r.road_km == null ? null : Number(r.road_km),
        roadMin: r.road_min == null ? null : Number(r.road_min),
      };
      const k = String(r.stay_node_id);
      out.set(k, [...(out.get(k) ?? []), g]);
    }
  } catch (e) {
    console.error('gatewaysFor failed:', e);
  }
  return out;
}

/**
 * US-805 — THE BORDER NEIGHBOUR. Founder ruling, 2026-07-13.
 *
 * Our designers do not respect state lines, and they are right not to. They build GANGTOK
 * with DARJEELING -- and Darjeeling is West Bengal, which is not one of the eight sister
 * states. So a strict region query would drop the very town our own catalogue says belongs
 * in the trip.
 *
 * The ruling: PROPOSE the neighbour, NAME ITS STATE, and let him strike it out. The REGION
 * itself stays strict -- a border town may be proposed, never anchored.
 *
 * A NAME IS NOT A KEY. There are two Manalis. If a name resolves to MORE THAN ONE StayNode
 * we cannot know which one our designer meant, so WE DROP IT rather than pick the wrong
 * twin. Today `stay_nodes` has no duplicate names at all -- this guard is here for the day
 * it does, because that day will arrive quietly.
 */
export async function stayNodesByNames(names: string[]): Promise<StayNode[]> {
  const wanted = names.map((n) => n.trim().toLowerCase()).filter(Boolean);
  if (!wanted.length) return [];
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT n.id, n.name, n.lat, n.lng, n.admin1_code, n.state_name, n.district,
              n.tour_count, n.source_kind,
              g.source_url AS guide_url, COALESCE(g.has_food, false) AS has_food
         FROM stay_nodes n
         LEFT JOIN stay_node_guides g ON g.stay_node_id = n.id
        WHERE lower(n.name) = ANY($1::text[])`, wanted);

    // THE TWIN GUARD. Two rows with one name is not a fact we may act on.
    const byName = new Map<string, any[]>();
    for (const r of rows) {
      const k = String(r.name).trim().toLowerCase();
      byName.set(k, [...(byName.get(k) ?? []), r]);
    }
    const out: StayNode[] = [];
    for (const [k, group] of byName) {
      if (group.length > 1) {
        console.warn(`stayNodesByNames: "${k}" matches ${group.length} StayNodes - dropped. ` +
                     'A name is not a key, and we will not guess which twin our designer meant.');
        continue;
      }
      const r = group[0];
      out.push({
        id: String(r.id),
        name: String(r.name),
        lat: Number(r.lat),
        lng: Number(r.lng),
        admin1Code: r.admin1_code ?? null,
        stateName: r.state_name ?? null,
        district: r.district ?? null,
        tourCount: Number(r.tour_count) || 0,
        source: String(r.source_kind) as StayNode['source'],
        guideUrl: r.guide_url ?? null,
        hasOwnFoodNotes: r.has_food === true,
      });
    }
    return out;
  } catch (e) {
    console.error('stayNodesByNames failed:', e);
    return [];
  }
}

/** Attractions hanging off a set of StayNodes. Unverified rows are NEVER returned. */
export async function attractionsFor(stayNodeIds: string[]): Promise<Attraction[]> {
  if (!stayNodeIds.length) return [];
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, name, lat, lng, district, state_name, stay_node_id,
              straight_line_km, road_km, road_min, source_kind, source_url, verified_at
         FROM attractions
        WHERE stay_node_id = ANY($1::text[])
          AND verified_at IS NOT NULL          -- spec 3.2: nothing unverified reaches a traveller
        ORDER BY stay_node_id, COALESCE(road_km, straight_line_km) ASC`, stayNodeIds);
    return rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      lat: Number(r.lat),
      lng: Number(r.lng),
      district: r.district ?? null,
      stateName: r.state_name ?? null,
      stayNodeId: r.stay_node_id ?? null,
      straightLineKm: r.straight_line_km == null ? null : Number(r.straight_line_km),
      roadKm: r.road_km == null ? null : Number(r.road_km),
      roadMin: r.road_min == null ? null : Number(r.road_min),
      sourceKind: String(r.source_kind) as Attraction['sourceKind'],
      sourceUrl: r.source_url ?? null,
      verifiedAt: r.verified_at ? new Date(r.verified_at).toISOString() : null,
    }));
  } catch (e) {
    console.error('attractionsFor failed:', e);
    return [];
  }
}
