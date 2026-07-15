/**
 * US-853 — DB layer for named circuits. The registry (namedCircuits.ts) holds the NAME and
 * the RECEIPT (our own tourId); the towns and nights are read HERE, from the living
 * catalogue, at request time — so if a designer re-plans the Nau Devi tomorrow, the
 * planner says tomorrow's truth without a code change.
 *
 * The stays come from `tour_stays` joined DIRECTLY on stay_node ids — no name resolution,
 * so the name-is-not-a-key class of bug cannot enter here.
 */
import prisma from '@/config/db';

export interface CircuitStay {
  id: string;
  name: string;
  stateName: string | null;
  lat: number;
  lng: number;
  elevationM: number | null;
  nights: number;
  order: number;
}

export interface CircuitTourFacts {
  title: string;
  durationNights: number | null;
  bestTime: string | null;
}

export async function circuitStays(tourId: string): Promise<CircuitStay[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT s.id, s.name, s.state_name, s.lat, s.lng, s.elevation_m, ts.nights, ts."order"
         FROM tour_stays ts
         JOIN stay_nodes s ON s.id = ts."wtiCityId"
        WHERE ts."tourId" = $1
        ORDER BY ts."order"`, tourId);
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      stateName: r.state_name ?? null,
      lat: Number(r.lat),
      lng: Number(r.lng),
      elevationM: r.elevation_m == null ? null : Number(r.elevation_m),
      nights: Math.max(0, Number(r.nights) || 0),
      order: Number(r.order) || 0,
    }));
  } catch (e) {
    console.error('circuitStays failed:', e);
    return [];
  }
}

export async function circuitTourFacts(tourId: string): Promise<CircuitTourFacts | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT title, "durationNights", "bestTime" FROM tours WHERE id = $1`, tourId);
    if (!rows[0]) return null;
    return {
      title: String(rows[0].title),
      durationNights: rows[0].durationNights == null ? null : Number(rows[0].durationNights),
      bestTime: rows[0].bestTime && String(rows[0].bestTime).trim() && String(rows[0].bestTime) !== 'N/A'
        ? String(rows[0].bestTime) : null,
    };
  } catch (e) {
    console.error('circuitTourFacts failed:', e);
    return null;
  }
}

/** US-871 — the tour's own day-by-day text, verbatim from tour_itinerary. */
export async function circuitItinerary(tourId: string): Promise<import('./namedCircuits').TourDayText[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT day, title, description FROM tour_itinerary WHERE "tourId" = $1 ORDER BY day`, tourId);
    return rows.map((r) => ({
      day: Number(r.day) || 0,
      title: String(r.title ?? ''),
      description: r.description == null ? null : String(r.description),
    }));
  } catch (e) {
    console.error('circuitItinerary failed (non-fatal):', e);
    return [];
  }
}
