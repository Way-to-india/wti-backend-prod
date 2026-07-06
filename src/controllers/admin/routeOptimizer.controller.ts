import prisma from '@/config/db';
import type { Request, Response } from 'express';
import { optimize } from '@/services/route-optimizer/optimize';
import { haversineKm, osrmDriving } from '@/services/route-optimizer/geo';
import type { CityNode, LegOption, OptimizeInput, InputCity, LatLng } from '@/services/route-optimizer/types';

/**
 * Route Optimizer — POST /api/admin/route-optimizer/optimize
 *
 * P1 (road-only): resolves each input city to coordinates (custom stops with
 * lat/lng self-register into world_cities, exactly like the route editor's "+"),
 * builds a road option pool from OSRM (cached in osm_leg_distance, NEVER called
 * inside the optimization loop), runs the engine, and logs the run.
 *
 * RAIL/AIR come from the curated transport_leg_options pool in P2; until then
 * every leg is road (or VERIFY when a corridor is unmapped) — zero fabrication.
 */

const PROFILE_MAX_KM: Record<string, number> = { senior: 300, family: 350, standard: 350 };

async function osrmCached(a: LatLng, b: LatLng, fromName: string, toName: string): Promise<{ km: number; min: number } | null> {
  // 1. cache read (osm_leg_distance is name-keyed, mirrors routeStops)
  try {
    const rows = await prisma.$queryRaw<{ km: number; durationMin: number | null }[]>`
      SELECT km, "durationMin" FROM osm_leg_distance
      WHERE lower("fromName") = lower(${fromName}) AND lower("toName") = lower(${toName}) LIMIT 1`;
    if (rows[0]?.km != null && rows[0]?.durationMin != null) return { km: Number(rows[0].km), min: Number(rows[0].durationMin) };
  } catch { /* table may not exist yet — fall through to OSRM */ }
  // 2. OSRM (build-time only)
  const r = await osrmDriving(a, b);
  if (!r) return null;
  const padded = { km: r.km, min: Math.round(r.min * 1.15) };
  try {
    await prisma.$executeRaw`
      INSERT INTO osm_leg_distance ("fromName", "toName", km, "durationMin")
      VALUES (${fromName}, ${toName}, ${padded.km}, ${padded.min})
      ON CONFLICT DO NOTHING`;
  } catch { /* best-effort cache write */ }
  return padded;
}

export class RouteOptimizerController {
  /** POST /route-optimizer/optimize */
  static async optimize(req: Request, res: Response) {
    try {
      const body = req.body || {};
      const cities: InputCity[] = Array.isArray(body.cities) ? body.cities : [];
      if (cities.length < 2) return res.deliver(400, false, undefined, 'Provide at least 2 cities.');

      // ---- Stage A: resolve coordinates -------------------------------------
      const names = cities.map((c) => String(c.name || '').trim()).filter(Boolean);
      const gazRows = await prisma.$queryRaw<{ name: string; latitude: number; longitude: number }[]>`
        SELECT name, latitude, longitude FROM world_cities
        WHERE lower(name) = ANY(${names.map((n) => n.toLowerCase())})`;
      const gaz = new Map<string, LatLng>();
      for (const r of gazRows) gaz.set(r.name.toLowerCase(), [Number(r.latitude), Number(r.longitude)]);

      const nodes: CityNode[] = [];
      const missing: string[] = [];
      const registered: string[] = [];
      for (const c of cities) {
        const nm = String(c.name || '').trim();
        if (!nm) continue;
        let coord: LatLng | undefined;
        if (c.lat != null && c.lng != null) {
          coord = [Number(c.lat), Number(c.lng)];
          // self-register custom stop into world_cities (reuse the route-editor "+" behaviour)
          const isIndia = coord[0] >= 6 && coord[0] <= 37.5 && coord[1] >= 68 && coord[1] <= 97.5;
          try {
            await prisma.$executeRaw`
              INSERT INTO world_cities (name, "asciiName", latitude, longitude, "countryCode", "countryName", population, "searchRank", source)
              SELECT ${nm}, ${nm}, ${coord[0]}, ${coord[1]}, ${isIndia ? 'IN' : null}, ${isIndia ? 'India' : null}, 0, 0, 'ADMIN'
              WHERE NOT EXISTS (SELECT 1 FROM world_cities WHERE lower(name) = lower(${nm}))`;
            registered.push(nm);
          } catch (e) { console.error('optimizer custom-city register failed:', e); }
        } else {
          coord = gaz.get(nm.toLowerCase());
        }
        if (!coord) { missing.push(nm); continue; }
        nodes.push({ name: nm, coord, profile: {} });
      }
      if (nodes.length < 2) {
        return res.deliver(400, false, { missing }, `Could not resolve coordinates for: ${missing.join(', ')}. Add them as custom stops with lat/lng.`);
      }

      // ---- Stage B: road option pool (pruned to nearest-12 for large sets) ---
      const pax = Number(body.pax) || 2;
      const pool = new Map<string, LegOption[]>();
      const idx = nodes.map((_, i) => i);
      for (let i = 0; i < nodes.length; i++) {
        // nearest-12 neighbours by haversine to cap OSRM calls
        const near = idx.filter((j) => j !== i)
          .sort((a, b) => haversineKm(nodes[i].coord, nodes[a].coord) - haversineKm(nodes[i].coord, nodes[b].coord))
          .slice(0, 12);
        for (const j of near) {
          const r = await osrmCached(nodes[i].coord, nodes[j].coord, nodes[i].name, nodes[j].name);
          const km = r?.km ?? Math.round(haversineKm(nodes[i].coord, nodes[j].coord) * 1.3);
          const min = r?.min ?? Math.round((km / 45) * 60);
          pool.set(`${nodes[i].name}||${nodes[j].name}`, [{
            from: nodes[i].name, to: nodes[j].name, mode: 'ROAD',
            distanceKm: km, durationMin: min, operatingDays: 127, reliability: 4,
            source: r ? 'osrm' : 'haversine', verifiedAt: new Date().toISOString(),
          }]);
        }
      }

      // ---- Stage C–F: run the engine ----------------------------------------
      const input: OptimizeInput = {
        cities: cities.filter((c) => nodes.some((n) => n.name.toLowerCase() === String(c.name).trim().toLowerCase())),
        start: body.start ?? null,
        end: body.end ?? null,
        objective: (['TIME', 'COST', 'EASE', 'BALANCED'].includes(body.objective) ? body.objective : 'BALANCED'),
        month: body.month, pax,
        profile: (['standard', 'family', 'senior'].includes(body.profile) ? body.profile : 'standard'),
        overnightTrains: body.overnightTrains !== false,
        maxRoadKmDay: Number(body.maxRoadKmDay) || PROFILE_MAX_KM[body.profile] || 350,
        startWeekday: body.startWeekday ?? null,
        pins: Array.isArray(body.pins) ? body.pins : [],
      };
      const result = optimize(input, { nodes, pool });

      // ---- audit log --------------------------------------------------------
      try {
        const uid = (req as any).admin?.id ?? (req as any).user?.id ?? null;
        await prisma.$executeRaw`
          INSERT INTO optimizer_runs (input, objective, plans, created_by)
          VALUES (${JSON.stringify(input)}::jsonb, ${input.objective}, ${JSON.stringify(result.plans)}::jsonb, ${uid})`;
      } catch (e) { console.error('optimizer_runs log failed (non-fatal):', e); }

      return res.deliver(200, true, { ...result, meta: { registered, missing } });
    } catch (e) {
      console.error('route optimize failed:', e);
      return res.deliver(500, false, undefined, 'Route optimization failed');
    }
  }
}
