import prisma from '@/config/db';
import cacheService from '@/services/common/cache.service';
import type { Request, Response } from 'express';

/**
 * Verified Route Map — admin authoring API.
 * The executive picks each stop from world_cities (coords included) or adds a
 * custom city with lat/lng, so every stop has VERIFIED coordinates by save time.
 * On save we (a) persist tour_route_stops (verified), (b) OSRM-route each ROAD
 * leg between the exact coords → real km/min into osm_leg_distance. No geocoding,
 * no ambiguity — this is the 100%-accurate path.
 */
type Mode = 'road' | 'flight' | 'train' | 'helicopter' | 'ferry';
interface StopIn { order: number; name: string; lat: number; lng: number; modeIn?: Mode | null; nights?: number | null }

async function resolveTour(idOrSlug: string): Promise<{ id: string; slug: string } | null> {
  const rows = await prisma.$queryRaw<{ id: string; slug: string }[]>`
    SELECT id, slug FROM tours WHERE id = ${idOrSlug} OR slug = ${idOrSlug} LIMIT 1`;
  return rows[0] || null;
}

async function osrm(a: [number, number], b: [number, number]): Promise<{ km: number; min: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=false`;
    const r = await fetch(url);
    const j: any = await r.json();
    const rt = j?.routes?.[0];
    return rt ? { km: Math.round(rt.distance / 1000), min: Math.round(rt.duration / 60) } : null;
  } catch {
    return null;
  }
}

export class RouteStopsController {
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

  /** GET /tours/:id/route-stops — load a tour's verified route stops for editing. */
  static async getRouteStops(req: Request, res: Response) {
    try {
      const tour = await resolveTour(req.params.id);
      if (!tour) return res.deliver(404, false, undefined, 'Tour not found');
      const stops = await prisma.$queryRaw<
        { order: number; name: string; latitude: number; longitude: number; modeIn: string | null; nights: number | null; verified: boolean }[]
      >`SELECT "order", name, latitude, longitude, "modeIn", nights, verified
        FROM tour_route_stops WHERE "tourId" = ${tour.id} ORDER BY "order"`;
      return res.deliver(200, true, {
        tourId: tour.id,
        slug: tour.slug,
        verified: stops.length >= 2 && stops.every((s) => s.verified),
        stops: stops.map((s) => ({
          order: s.order, name: s.name, lat: Number(s.latitude), lng: Number(s.longitude),
          modeIn: s.modeIn, nights: s.nights,
        })),
      });
    } catch (e) {
      console.error('getRouteStops failed:', e);
      return res.deliver(500, false, undefined, 'Failed to load route');
    }
  }

  /** POST /tours/:id/route-stops — save verified stops + OSRM-route the road legs. */
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
          modeIn: (i === 0 ? null : (s.modeIn || 'road')) as Mode | null,
          nights: s.nights != null ? Number(s.nights) : null,
        }));

      // persist stops (replace) in a transaction
      await prisma.$transaction([
        prisma.$executeRaw`DELETE FROM tour_route_stops WHERE "tourId" = ${tour.id}`,
        ...clean.map(
          (s) => prisma.$executeRaw`
            INSERT INTO tour_route_stops ("tourId","order",name,latitude,longitude,"modeIn",nights,verified,source,"updatedAt")
            VALUES (${tour.id},${s.order},${s.name},${s.lat},${s.lng},${s.modeIn},${s.nights},true,'ADMIN',now())`
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

      // OSRM-route each ROAD leg between the exact verified coords → osm_leg_distance
      let routed = 0;
      for (let i = 1; i < clean.length; i++) {
        const prev = clean[i - 1];
        const cur = clean[i];
        if ((cur.modeIn || 'road') !== 'road') continue;
        const d = await osrm([prev.lat, prev.lng], [cur.lat, cur.lng]);
        if (d) {
          await prisma.$executeRaw`
            INSERT INTO osm_leg_distance ("fromName","toName",km,"durationMin")
            VALUES (${prev.name},${cur.name},${d.km},${d.min})
            ON CONFLICT ("fromName","toName") DO UPDATE SET km = EXCLUDED.km, "durationMin" = EXCLUDED."durationMin"`;
          routed++;
        }
      }

      // publish: bust the public tour cache so the map goes live
      await cacheService.deletePattern('tour:detail:*').catch(() => {});
      // regenerate the public page (Next ISR) so the map appears immediately
      const rv = process.env.REVALIDATE_SECRET;
      if (rv) {
        await fetch('https://www.waytoindia.com/api/revalidate?secret=' + encodeURIComponent(rv) + '&path=/' + tour.slug, { method: 'POST' }).catch(() => {});
      }
      return res.deliver(200, true, { saved: clean.length, roadLegsRouted: routed, verified: clean.length >= 2 });
    } catch (e) {
      console.error('saveRouteStops failed:', e);
      return res.deliver(500, false, undefined, 'Failed to save route');
    }
  }
}
