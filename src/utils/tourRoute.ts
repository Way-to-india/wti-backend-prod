/**
 * Tour route builder — derives an itinerary route (stops + typed legs) from the
 * authored day-by-day itinerary titles. The mode (road / flight / train /
 * helicopter / ferry) and the road distance + time are READ from the itinerary
 * text, never invented:
 *   "drive to Dwarka (2h 18m/141 km)"  -> road, 141 km, 2h 18m
 *   "Mumbai (By Air)"                  -> flight
 *   "Kedarnath (By helicopter)"        -> helicopter
 * Coordinates for the map come from the tour's already-loaded cities; stops we
 * can't geolocate still appear in the facts table (SEO), just not as map pins.
 * Pure + dependency-free so it can run inline in the tour-detail handler.
 */

export type LegMode = 'road' | 'flight' | 'train' | 'helicopter' | 'ferry';
export interface RouteLeg {
  day: number;
  from: string;
  to: string;
  mode: LegMode;
  km: number | null;
  timeText: string | null;
  /** true when km/time were computed by OSM routing (not authored) — UI shows "~". */
  estimated?: boolean;
}
export interface RouteStop {
  order: number;
  name: string;
  day: number;
  lat: number | null;
  lng: number | null;
}
export interface TourRoute {
  stops: RouteStop[];
  legs: RouteLeg[];
  roadTotalKm: number;
  modes: LegMode[];
}

interface ItinItem { day: number; title: string | null }
interface CityRef { city?: { name?: string | null; latitude?: number | null; longitude?: number | null } | null }

export const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z]/g, '').replace(/guptakashi/, 'guptkashi');

// Verified coordinates for well-known pilgrimage sites / helipads that are not
// in the `cities` gazetteer, so their map pins still plot. Keyed by norm(name).
// Extend as new pilgrimage tours surface new stops.
const FALLBACK_COORDS: Record<string, { lat: number; lng: number }> = {
  somnath: { lat: 20.888, lng: 70.4012 },
  trimbakeshwar: { lat: 19.932, lng: 73.53 },
  bhimashankar: { lat: 19.07, lng: 73.536 },
  shanishingnapur: { lat: 19.36, lng: 74.983 },
  shirdi: { lat: 19.766, lng: 74.477 },
  grishneshwar: { lat: 20.0257, lng: 75.179 },
  ujjain: { lat: 23.1793, lng: 75.7849 },
  omkareshwar: { lat: 22.242, lng: 76.15 },
  mallikarjun: { lat: 16.073, lng: 78.868 },
  phata: { lat: 30.627, lng: 78.956 },
  kedarnath: { lat: 30.7346, lng: 79.0669 },
  guptkashi: { lat: 30.53, lng: 79.08 },
  diu: { lat: 20.7144, lng: 70.9874 },
};

// A token is NOT a place if it carries numbers/time/logistics words — this is
// the junk-gate that stops "4 hours 30 minutes" from becoming a stop.
const BAD_PLACE =
  /\d|\bhours?\b|\bhrs?\b|\bmins?\b|\bminutes?\b|approximate|\bkm\b|sightsee|departure|onwards?|overnight|half\s*day|full\s*day|leisure|relax/i;

function extractTime(s: string): string | null {
  const h = s.match(/(\d+)\s*(?:h\b|hours?|hrs?)/i);
  const m = s.match(/(\d+)\s*(?:m\b|minutes?|mins?)/i);
  if (!h && !m) return null;
  return `${h ? h[1] + 'h ' : ''}${m ? m[1] + 'm' : ''}`.trim();
}
function extractKm(s: string): number | null {
  const m = s.match(/(?:approximately\s*)?([\d,]+(?:\.\d+)?)\s*km/i);
  return m ? parseFloat(m[1].replace(/,/g, '')) : null;
}
function modeFromText(s: string): LegMode | null {
  const p = s.toLowerCase();
  if (p.includes('helicop')) return 'helicopter';
  if (/\bby air\b|\bflight\b|\bfly\b|\bby plane\b/.test(p)) return 'flight';
  if (/\bby train\b|\brail\b|\bby rail\b/.test(p)) return 'train';
  if (/\bferry\b|\bby boat\b|\bcruise\b/.test(p)) return 'ferry';
  return null;
}
function cleanPlace(raw: string): string | null {
  let t = raw
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^\s*day\s*\d+\s*[:\-]?\s*/i, '')
    .replace(/\bvia\b.*$/i, '')
    .replace(/,.*$/, '')
    .replace(/\b(arrival in|arrive at|arrive in|arrival at|departure from|depart from|drive to|and drive to|transfer to|proceed to|back to|onward to|to)\b/gi, '|')
    .replace(/\b(local\s+sightseeing|sightseeing|departure|local|city\s*tour|excursion|halt|stay|overnight)\b/gi, ' ');
  // after splitting on movement verbs, take the last meaningful chunk
  const parts = t.split('|').map((x) => x.trim()).filter(Boolean);
  t = (parts[parts.length - 1] || '')
    .replace(/[^A-Za-z .&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t || t.length < 2 || t.length > 28 || BAD_PLACE.test(t)) return null;
  return t;
}

type Hop = { day: number; place: string; mode: LegMode | null; km: number | null; time: string | null };

// Parse one day title into ordered hops, handling BOTH itinerary formats:
//  A) "Dwarka - Somnath (3h 59m /237 km) - Mumbai (By Air)"  (dash + parenthetical)
//  B) "Day 3: Delhi to Agra, approximately 225 km, about 4 hours 30 minutes" (prose)
function parseDay(day: number, rawTitle: string): Hop[] {
  const title = rawTitle.replace(/[–—]/g, '-').trim();
  const body = title.replace(/^\s*day\s*\d+\s*[:\-]?\s*/i, '');
  const hops: Hop[] = [];

  // FORMAT B — prose "X to Y ..." carrying km/time or a mode
  if (/\bto\b/i.test(body) && (/\d\s*km|hours?|minutes?|\bby (air|train|road|flight)\b/i.test(body))) {
    const m = body.match(/^(.+?)\s+to\s+(.+?)(?=,|\s+approximately|\s+about|\s+via|\s+by\b|$)/i);
    if (m) {
      const from = cleanPlace(m[1]);
      const to = cleanPlace(m[2]);
      const mode = modeFromText(body) || 'road';
      const km = mode === 'road' ? extractKm(body) : null;
      const time = mode === 'road' ? extractTime(body) : null;
      if (from) hops.push({ day, place: from, mode: null, km: null, time: null });
      if (to) hops.push({ day, place: to, mode, km, time });
      if (hops.length) return hops;
    }
  }

  // FORMAT A — dash-delimited tokens with parentheticals
  if (body.includes('(') || / - /.test(body)) {
    for (const tok of body.split(/\s*-\s*/)) {
      const paren = tok.match(/\(([^)]*)\)/);
      const place = cleanPlace(tok);
      if (!place) continue;
      if (paren) {
        const inner = paren[1];
        const mode = modeFromText(inner) || 'road';
        hops.push({
          day,
          place,
          mode,
          km: mode === 'road' ? extractKm(inner) : null,
          time: mode === 'road' ? extractTime(inner) : null,
        });
      } else {
        hops.push({ day, place, mode: null, km: null, time: null });
      }
    }
    if (hops.length) return hops;
  }

  // Single place (arrival / sightseeing day)
  const single = cleanPlace(body);
  if (single) hops.push({ day, place: single, mode: null, km: null, time: null });
  return hops;
}

export function buildTourRoute(itinerary: ItinItem[] | undefined, cities: CityRef[] | undefined): TourRoute | null {
  if (!itinerary || itinerary.length === 0) return null;

  const coords = new Map<string, { lat: number | null; lng: number | null }>();
  (cities || []).forEach((c) => {
    const n = c.city?.name;
    if (n && c.city?.latitude != null && c.city?.longitude != null)
      coords.set(norm(n), { lat: Number(c.city.latitude), lng: Number(c.city.longitude) });
  });

  const seq: Hop[] = [];
  for (const item of [...itinerary].sort((a, b) => a.day - b.day)) {
    if (!item.title) continue;
    for (const h of parseDay(item.day, item.title)) seq.push(h);
  }

  const stops: RouteStop[] = [];
  const legs: RouteLeg[] = [];
  let prev: string | null = null;
  let order = 0;
  for (const s of seq) {
    if (!prev || norm(s.place) !== norm(prev)) {
      const co = coords.get(norm(s.place)) || FALLBACK_COORDS[norm(s.place)] || { lat: null, lng: null };
      stops.push({ order: ++order, name: s.place, day: s.day, lat: co.lat, lng: co.lng });
      if (prev) legs.push({ day: s.day, from: prev, to: s.place, mode: s.mode || 'road', km: s.km, timeText: s.time });
      prev = s.place;
    }
  }

  // Junk-suppression: a real route needs at least two distinct, valid stops and
  // at least one leg. Otherwise emit nothing rather than a misleading fragment.
  if (stops.length < 2 || legs.length < 1) return null;

  const roadTotalKm = Math.round(legs.filter((l) => l.mode === 'road' && l.km).reduce((a, l) => a + (l.km || 0), 0));
  const modes = Array.from(new Set(legs.map((l) => l.mode)));
  return { stops, legs, roadTotalKm, modes };
}
