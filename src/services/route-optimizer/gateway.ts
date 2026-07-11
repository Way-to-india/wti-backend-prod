/**
 * THE STARTING CITY (founder ruling, 2026-07-11).
 *
 * THE FLAW THIS FIXES
 * The planner never asked where the journey begins. It asked only where it goes. So
 * "I along with few friends are planning to visit Tirthan valley" — the most ordinary
 * request a travel company ever receives — was met with a red error page telling the
 * traveller to name a second place. The traveller was not wrong. The product was.
 *
 * A trip needs TWO nodes. An origin is a node. Delhi → Tirthan Valley → Delhi is a
 * complete, plannable, sellable trip.
 *
 * THE LAW
 *   The planner must ALWAYS HAVE a starting city, and must NEVER BLOCK on one.
 *
 * Which means: decide it, then SAY IT OUT LOUD, and let it be changed in one tap —
 * exactly what a senior tour designer does across a desk. He does not interrogate.
 * He also does not pretend. Every value this file returns carries a `source` so the
 * traveller is told, in plain words, whether he said it or we assumed it.
 *
 * THE LADDER (in order — we stop at the first rung that answers)
 *   1. HE SAID IT      — "from Mumbai". Already extracted; we simply stopped throwing it away.
 *   2. HE TAPPED IT    — the "Starting from" chip on the confirm screen.
 *   3. WE INFER IT     — the nearest MAJOR gateway city to where he is going. This is
 *                        the tour operator's own answer ("we'll start you from Delhi"),
 *                        and it is stated as an assumption, never as a fact he gave us.
 *   4. WE ASK          — only if even that fails. One question. Never an error page.
 *
 * ANTI-HALLUCINATION: a gateway is only ever a REAL city that we hold coordinates for
 * and that we know has an airport (`airport_cities`). We never invent a place name.
 */

import prisma from '@/config/db';
import { haversineKm } from './geo';
import type { LatLng } from './types';

export type StartSource = 'you_said' | 'we_guessed' | 'we_need_it';

export interface GatewayResult {
  /** the city we will start from — always a real, coordinate-backed place, or null. */
  city: string | null;
  coord: LatLng | null;
  source: StartSource;
  /** plain English, shown to the traveller. "the usual gateway for Tirthan Valley" */
  why: string;
  /** how far the traveller must travel from the gateway to the first stop. */
  distanceKm?: number;
}

/** A city big enough that people actually fly into it. Below this we still allow it,
 *  but only if there is nothing larger within reach — a traveller does not "start
 *  from" a hamlet with an airstrip. */
const MAJOR_POPULATION = 500_000;

/** Beyond this the gateway is too far to be a sensible start — we would rather ask. */
const MAX_GATEWAY_KM = 600;

interface AirportCity { city: string; lat: number; lng: number; population: number }

/** Every airport city we hold, with its size. One query, cached per process. */
let airportCache: AirportCity[] | null = null;
async function airportCities(): Promise<AirportCity[]> {
  if (airportCache) return airportCache;
  try {
    const rows = await prisma.$queryRaw<{ city: string; lat: number; lng: number; population: number | null }[]>`
      SELECT ac.city, ac.lat, ac.lng, COALESCE(wc.population, 0)::bigint AS population
        FROM airport_cities ac
        LEFT JOIN world_cities wc ON lower(wc.name) = lower(ac.city)
       WHERE ac.lat IS NOT NULL AND ac.lng IS NOT NULL`;
    airportCache = rows.map((r) => ({
      city: r.city, lat: Number(r.lat), lng: Number(r.lng), population: Number(r.population || 0),
    }));
  } catch (e) {
    console.error('gateway: airport_cities read failed (non-fatal):', e);
    airportCache = [];
  }
  return airportCache;
}

/** The middle of where the traveller is going. */
function centroid(coords: LatLng[]): LatLng | null {
  const pts = coords.filter((c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]));
  if (!pts.length) return null;
  const lat = pts.reduce((s, c) => s + c[0], 0) / pts.length;
  const lng = pts.reduce((s, c) => s + c[1], 0) / pts.length;
  return [lat, lng];
}

/**
 * Infer the starting city for a set of destinations.
 *
 * The rule a tour designer actually uses: start the traveller at the nearest city he
 * can REACH — meaning a real gateway with an airport, big enough to fly into. Not the
 * nearest airstrip. So we take every airport city within reach of the trip, and prefer
 * a MAJOR one; a small airfield only wins if it is dramatically closer AND nothing
 * major is anywhere near.
 *
 * If one of the destinations is itself a major gateway (Delhi on a Golden Triangle),
 * that wins outright — the traveller is already starting there.
 */
export async function inferGateway(
  destinations: { name: string; coord: LatLng }[],
): Promise<GatewayResult> {
  const none: GatewayResult = { city: null, coord: null, source: 'we_need_it', why: 'We could not work out a sensible starting city for this trip.' };
  if (!destinations.length) return none;

  const airports = await airportCities();
  if (!airports.length) return none;

  const mid = centroid(destinations.map((d) => d.coord));
  if (!mid) return none;

  const first = destinations[0];
  const destNames = new Set(destinations.map((d) => d.name.trim().toLowerCase()));

  // (a) a destination that is ITSELF a major gateway — he is already starting there
  const selfGateway = airports
    .filter((a) => destNames.has(a.city.trim().toLowerCase()) && a.population >= MAJOR_POPULATION)
    .sort((a, b) => b.population - a.population)[0];
  if (selfGateway) {
    return {
      city: selfGateway.city,
      coord: [selfGateway.lat, selfGateway.lng],
      source: 'we_guessed',
      why: `${selfGateway.city} is on your list and is the natural place to begin`,
      distanceKm: 0,
    };
  }

  // (b) the nearest MAJOR gateway to the middle of the trip
  const scored = airports
    .map((a) => ({ a, km: haversineKm(mid, [a.lat, a.lng]) }))
    .filter((x) => Number.isFinite(x.km))
    .sort((x, y) => x.km - y.km);

  const major = scored.find((x) => x.a.population >= MAJOR_POPULATION && x.km <= MAX_GATEWAY_KM);
  const nearest = scored.find((x) => x.km <= MAX_GATEWAY_KM);

  const pick = major ?? nearest;
  if (!pick) return none;

  const kmToFirst = Math.round(haversineKm([pick.a.lat, pick.a.lng], first.coord));
  return {
    city: pick.a.city,
    coord: [pick.a.lat, pick.a.lng],
    source: 'we_guessed',
    why: `${pick.a.city} is the usual gateway for ${first.name}${kmToFirst > 0 ? ` — about ${kmToFirst} km away` : ''}`,
    distanceKm: kmToFirst,
  };
}

/** Test seam — drop the cached airport list. */
export function _resetGatewayCache(): void { airportCache = null; }
