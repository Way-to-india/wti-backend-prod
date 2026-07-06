import prisma from '@/config/db';
import cacheService from '@/services/common/cache.service';
import type { Request, Response } from 'express';

/**
 * Verified Route Map — admin authoring API.
 * The executive picks each stop from world_cities (coords included) or adds a
 * custom city with lat/lng, so every stop has VERIFIED coordinates by save time.
 *
 * Travel modes are DB-driven (travel_modes table, admin-extensible). Each mode
 * carries a distanceStrategy that decides how the leg's km/time are computed:
 *   osrm-driving — real road routing (OSRM)                    e.g. road
 *   osrm-foot    — real walking-path routing (OSRM foot)       e.g. trek, pony
 *   aerial       — great-circle (haversine) distance           e.g. flight, heli, ropeway, ferry, boat
 *   none         — no auto distance (admin types it if wanted) e.g. train
 * The admin can always overwrite km/time manually per leg (legKmSource='manual').
 */
interface StopIn {
  order: number; name: string; lat: number; lng: number;
  modeIn?: string | null; nights?: number | null;
  legKm?: number | null; legMin?: number | null; legKmSource?: string | null;
  /** 'stop' (default) = part of the journey chain; 'landmark' = map-only pin
   *  (Mount Kailash, Mansarovar Lake…) excluded from legs and distances. */
  kind?: string | null;
}

const ICONS = ['car', 'plane', 'train', 'helicopter', 'ship', 'footprints', 'pony', 'cablecar', 'boat', 'bike', 'route'];
const STRATEGIES = ['osrm-driving', 'osrm-foot', 'aerial', 'none'];

async function resolveTour(idOrSlug: string): Promise<{ id: string; slug: string } | null> {
  const rows = await prisma.$queryRaw<{ id: string; slug: string }[]>`
    SELECT id, slug FROM tours WHERE id = ${idOrSlug} OR slug = ${idOrSlug} LIMIT 1`;
  return rows[0] || null;
}

async function osrmRoute(profileUrl: string, a: [number, number], b: [number, number]): Promise<{ km: number; min: number; geometry: string | null } | null> {
  try {
    // overview=full → encoded polyline of the REAL path (winding trail / highway),
    // stored per leg so maps draw the true route instead of a straight line.
    const url = `${profileUrl}/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=polyline`;
    const r = await fetch(url);
    const j: any = await r.json();
    const rt = j?.routes?.[0];
    return rt
      ? { km: Math.round(rt.distance / 1000), min: Math.round(rt.duration / 60), geometry: typeof rt.geometry === 'string' ? rt.geometry : null }
      : null;
  } catch {
    return null;
  }
}
const osrmDriving = (a: [number, number], b: [number, number]) =>
  osrmRoute('https://router.project-osrm.org/route/v1/driving', a, b);
const osrmFoot = (a: [number, number], b: [number, number]) =>
  osrmRoute('https://routing.openstreetmap.de/routed-foot/route/v1/foot', a, b);

/** Great-circle distance in km (for aerial modes: flight / helicopter / ropeway / water). */
function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)));
}

async function loadStrategies(): Promise<Map<string, string>> {
  try {
    const rows = await prisma.$queryRaw<{ key: string; distanceStrategy: string }[]>`
      SELECT key, "distanceStrategy" FROM travel_modes WHERE active = true`;
    return new Map(rows.map((r) => [r.key, r.distanceStrategy]));
  } catch {
    // table missing (pre-migration) — legacy behaviour: only road is routed
    return new Map([['road', 'osrm-driving']]);
  }
}

export class RouteStopsController {
  /** GET /tours/route/modes — active travel modes for the editor dropdown. */
  static async getModes(_req: Request, res: Response) {
    try {
      const rows = await prisma.$queryRaw<
        { key: string; label: string; icon: string; distanceStrategy: string; sortOrder: number }[]
      >`SELECT key, label, icon, "distanceStrategy", "sortOrder"
        FROM travel_modes WHERE active = true ORDER BY "sortOrder", key`;
      return res.deliver(200, true, rows);
    } catch (e) {
      console.error('getModes failed:', e);
      return res.deliver(500, false, undefined, 'Failed to load travel modes');
    }
  }

  /** POST /tours/route/modes — admin adds a new travel mode (idempotent by key). */
  static async addMode(req: Request, res: Response) {
    try {
      const label = String(req.body?.label || '').trim();
      const icon = ICONS.includes(String(req.body?.icon)) ? String(req.body.icon) : 'route';
      const strategy = STRATEGIES.includes(String(req.body?.distanceStrategy)) ? String(req.body.distanceStrategy) : 'none';
      if (label.length < 2 || label.length > 40) return res.deliver(400, false, undefined, 'Label must be 2–40 characters');
      const key = label.toLowerCase().replace(/^by\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
      if (!key) return res.deliver(400, false, undefined, 'Could not derive a key from label');
      await prisma.$executeRaw`
        INSERT INTO travel_modes (key, label, icon, "distanceStrategy", "sortOrder", source)
        VALUES (${key}, ${label}, ${icon}, ${strategy}, 50, 'ADMIN')
        ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, icon = EXCLUDED.icon,
          "distanceStrategy" = EXCLUDED."distanceStrategy", active = true`;
      return res.deliver(200, true, { key, label, icon, distanceStrategy: strategy });
    } catch (e) {
      console.error('addMode failed:', e);
      return res.deliver(500, false, undefined, 'Failed to add travel mode');
    }
  }

  /** GET /tours/route/city-search?q=  — world_cities autosuggest, India-preferred. */
  static async searchCities(req: Request, res: Response) {
    try {
      const q = String(req.query.q || '').trim();
      if (q.length < 2) return res.deliver(200, true, []);
      const rows = await prisma.$queryRaw<
        { name: string; latitude: number; longitude: number; countryName: string; admin1Code: string }[]
      >`SELECT name, latitude, longitude, "countryName", "admin1Code"
        FROM world_cities
        WHERE name ILIKE ${q + '%'}
        ORDER BY ("countryCode" = 'IN') DESC, population DESC NULLS LAST
        LIMIT 12`;
      return res.deliver(200, true, rows.map((c) => ({
        name: c.name,
        lat: Number(c.latitude),
        lng: Number(c.longitude),
        region: [c.admin1Code, c.countryName].filter(Boolean).join(', '),
      })));
    } catch (e) {
      console.error('city-search failed:', e);
      return res.deliver(500, false, undefined, 'City search failed');
    }
  }

  /** POST /tours/route/city — register a custom place into world_cities immediately
   *  (called by the admin route editor's "+" so the city is searchable right away,
   *  even before the route itself is saved). Idempotent by lower(name). */
  static async addCity(req: Request, res: Response) {
    try {
      const name = String(req.body?.name || '').trim();
      const lat = Number(req.body?.lat);
      const lng = Number(req.body?.lng);
      if (!name || isNaN(lat) || isNaN(lng)) return res.deliver(400, false, undefined, 'name, lat, lng required');
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return res.deliver(400, false, undefined, 'Invalid coordinates');
      const isIndia = lat >= 6 && lat <= 37.5 && lng >= 68 && lng <= 97.5;
      await prisma.$executeRaw`
        INSERT INTO world_cities (name, "asciiName", latitude, longitude, "countryCode", "countryName", population, "searchRank", source)
        SELECT ${name}, ${name}, ${lat}, ${lng},
               ${isIndia ? 'IN' : null}, ${isIndia ? 'India' : null}, 0, 0, 'ADMIN'
        WHERE NOT EXISTS (SELECT 1 FROM world_cities WHERE lower(name) = lower(${name}))`;
      return res.deliver(200, true, { name, lat, lng, registered: true });
    } catch (e) {
      console.error('addCity failed:', e);
      return res.deliver(500, false, undefined, 'Failed to register city');
    }
  }

  /** GET /tours/:id/route-stops — load a tour's verified route stops for editing. */
  static async getRouteStops(req: Request, res: Response) {
    try {
      const tour = await resolveTour(req.params.id);
      if (!tour) return res.deliver(404, false, undefined, 'Tour not found');
      const stops = await prisma.$queryRaw<
        { order: number; name: string; latitude: number; longitude: number; modeIn: string | null; nights: number | null; verified: boolean; legKm: number | null; legMin: number | null; legKmSource: string | null; legGeometry: string | null; kind: string | null }[]
      >`SELECT "order", name, latitude, longitude, "modeIn", nights, verified, "legKm", "legMin", "legKmSource", "legGeometry", kind
        FROM tour_route_stops WHERE "tourId" = ${tour.id} ORDER BY "order"`;
      return res.deliver(200, true, {
        tourId: tour.id,
        slug: tour.slug,
        verified: stops.length >= 2 && stops.every((s) => s.verified),
        stops: stops.map((s) => ({
          order: s.order, name: s.name, lat: Number(s.latitude), lng: Number(s.longitude),
          modeIn: s.modeIn, nights: s.nights,
          legKm: s.legKm != null ? Number(s.legKm) : null,
          legMin: s.legMin != null ? Number(s.legMin) : null,
          legKmSource: s.legKmSource,
          legGeometry: s.legGeometry,
          kind: s.kind || 'stop',
        })),
      });
    } catch (e) {
      console.error('getRouteStops failed:', e);
      return res.deliver(500, false, undefined, 'Failed to load route');
    }
  }

  /** POST /tours/:id/route-stops — save verified stops + route every leg by its
   *  mode's distance strategy (manual overrides win). */
  static async saveRouteStops(req: Request, res: Response) {
    try {
      const tour = await resolveTour(req.params.id);
      if (!tour) return res.deliver(404, false, undefined, 'Tour not found');
      const stops: StopIn[] = Array.isArray(req.body?.stops) ? req.body.stops : [];
      const clean = stops
        .filter((s) => s && s.name && s.lat != null && s.lng != null)
        .map((s, i) => ({
          order: i + 1,
          name: String(s.name).trim(),
          lat: Number(s.lat),
          lng: Number(s.lng),
          kind: s.kind === 'landmark' ? 'landmark' : 'stop',
          modeIn: s.kind === 'landmark' ? null : String(s.modeIn || 'road'),
          nights: s.kind === 'landmark' ? null : s.nights != null ? Number(s.nights) : null,
          legKm: s.legKm != null && !isNaN(Number(s.legKm)) ? Number(s.legKm) : null,
          legMin: s.legMin != null && !isNaN(Number(s.legMin)) ? Math.round(Number(s.legMin)) : null,
          legKmSource: s.legKmSource === 'manual' ? 'manual' : null,
          legGeometry: null as string | null,
        }));
      // the journey chain = travel stops only; landmarks are map-only pins
      const travel = clean.filter((s) => s.kind === 'stop');
      if (travel.length) { travel[0].modeIn = null; travel[0].legKm = null; travel[0].legMin = null; travel[0].legKmSource = null; }

      // Per-mode distance strategy (DB-driven). Manual entries are respected as-is.
      // OSRM legs also capture the real path geometry (encoded polyline).
      const strategies = await loadStrategies();
      let routed = 0;
      for (let i = 1; i < travel.length; i++) {
        const prev = travel[i - 1];
        const cur = travel[i];
        const strat = strategies.get(cur.modeIn || 'road') || 'none';
        const a: [number, number] = [prev.lat, prev.lng];
        const b: [number, number] = [cur.lat, cur.lng];
        if (cur.legKmSource === 'manual' && (cur.legKm != null || cur.legMin != null)) {
          // manual km/time stands, but still fetch geometry so the map draws the real path
          if (strat === 'osrm-driving') cur.legGeometry = (await osrmDriving(a, b))?.geometry ?? null;
          else if (strat === 'osrm-foot') cur.legGeometry = (await osrmFoot(a, b))?.geometry ?? null;
          routed++;
          continue;
        }
        let d: { km: number; min: number | null; geometry?: string | null } | null = null;
        if (strat === 'osrm-driving') d = await osrmDriving(a, b);
        else if (strat === 'osrm-foot') d = await osrmFoot(a, b);
        else if (strat === 'aerial') d = { km: haversineKm(a, b), min: null, geometry: null };
        if (d) {
          cur.legKm = d.km;
          cur.legMin = d.min;
          cur.legKmSource = 'auto';
          cur.legGeometry = d.geometry ?? null;
          routed++;
        } else {
          cur.legKm = null; cur.legMin = null; cur.legKmSource = null; cur.legGeometry = null;
        }
      }

      // persist stops (replace) in a transaction
      await prisma.$transaction([
        prisma.$executeRaw`DELETE FROM tour_route_stops WHERE "tourId" = ${tour.id}`,
        ...clean.map(
          (s) => prisma.$executeRaw`
            INSERT INTO tour_route_stops ("tourId","order",name,latitude,longitude,"modeIn",nights,"legKm","legMin","legKmSource","legGeometry",kind,verified,source,"updatedAt")
            VALUES (${tour.id},${s.order},${s.name},${s.lat},${s.lng},${s.modeIn},${s.nights},${s.legKm},${s.legMin},${s.legKmSource},${s.legGeometry},${s.kind},true,'ADMIN',now())`
        ),
      ]);

      // learn custom places: any stop not already in world_cities becomes
      // searchable in the autosuggest from now on (source='ADMIN')
      for (const s of clean) {
        try {
          const isIndia = s.lat >= 6 && s.lat <= 37.5 && s.lng >= 68 && s.lng <= 97.5;
          await prisma.$executeRaw`
            INSERT INTO world_cities (name, "asciiName", latitude, longitude, "countryCode", "countryName", population, "searchRank", source)
            SELECT ${s.name}, ${s.name}, ${s.lat}, ${s.lng},
                   ${isIndia ? 'IN' : null}, ${isIndia ? 'India' : null}, 0, 0, 'ADMIN'
            WHERE NOT EXISTS (SELECT 1 FROM world_cities WHERE lower(name) = lower(${s.name}))`;
        } catch (err) {
          console.error('world_cities learn-insert failed for', s.name, err);
        }
      }

      // back-compat: keep osm_leg_distance fresh for road legs (older readers)
      for (let i = 1; i < travel.length; i++) {
        const prev = travel[i - 1], cur = travel[i];
        if ((cur.modeIn || 'road') !== 'road' || cur.legKm == null) continue;
        try {
          await prisma.$executeRaw`
            INSERT INTO osm_leg_distance ("fromName","toName",km,"durationMin")
            VALUES (${prev.name},${cur.name},${cur.legKm},${cur.legMin ?? 0})
            ON CONFLICT ("fromName","toName") DO UPDATE SET km = EXCLUDED.km, "durationMin" = EXCLUDED."durationMin"`;
        } catch {}
      }

      // publish: bust the public tour cache so the map goes live
      await cacheService.deletePattern('tour:detail:*').catch(() => {});
      // regenerate the public page (Next ISR) so the map appears immediately
      const rv = process.env.REVALIDATE_SECRET;
      if (rv) {
        await fetch('https://www.waytoindia.com/api/revalidate?secret=' + encodeURIComponent(rv) + '&path=/' + tour.slug, { method: 'POST' }).catch(() => {});
      }
      return res.deliver(200, true, { saved: clean.length, legsRouted: routed, verified: clean.length >= 2 });
    } catch (e) {
      console.error('saveRouteStops failed:', e);
      return res.deliver(500, false, undefined, 'Failed to save route');
    }
  }
}
