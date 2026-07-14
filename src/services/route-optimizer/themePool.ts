/**
 * US-840 — THE THEME POOL. The wire between the question and the answer.
 *
 * THE FAILURE THIS ENDS. The founder's own definition-of-done traveller —
 *
 *   "I am 56 and my wife is 49. We live in Lucknow. A comfortable pilgrimage. We would
 *    prefer flights wherever possible. Up to 8 days. Luxury hotels."
 *
 * — got `HTTP 400: "Tell us at least one place you would like to visit."` He named a THEME,
 * not a town. The 504-row theme index (`intent_place`, founder-ticked) existed and WAS
 * QUERIED BY NOTHING; the Designer existed and fired only on a REGION word. This module is
 * the missing candidate pool: chips → the places our own index says serve them.
 *
 * ------------------------------------------------------------------------------
 * THE POLLUTION LESSON — WHY THE MEMORY MUST BE SCOPED (proven on production, 2026-07-14):
 *
 *   Co-occurrence among Pilgrimage-chip towns over ALL tours:
 *       Delhi–Jaipur 41 · Jaipur–Agra 38 · Delhi–Agra 38      ← THE GOLDEN TRIANGLE
 *   The same, restricted to tours that THEMSELVES carry a pilgrimage theme (tour_themes):
 *       Delhi–Haridwar 9 · Madurai–Rameshwaram 5 · Haridwar–Guptkashi 5 · Haridwar–Kedarnath 3
 *
 * Delhi, Jaipur and Agra legitimately CARRY the Pilgrimage chip — as places, the index is
 * right. But their pairing comes from heritage tours, and an unscoped memory would sell the
 * Golden Triangle to a man who asked for a yatra. THE THEME OF THE TOUR, not only the chip
 * of the town, is the honest signal. `scopedDesignerMemory()` is that signal.
 *
 * DB layer — same doctrine as spineDb/anchorsDb: this file reads, the controller injects,
 * the engine (designer.ts, proposalGates.ts) stays pure.
 */
import prisma from '@/config/db';
import type { StayNode } from './spine';
import type { DesignerMemory, DesignerPair, TypicalNights } from './designerMemory';
import { loadDesignerMemory } from './designerMemoryDb';
import { haversineKm } from './geo';

/**
 * CHIP → THEME. The chips are the product vocabulary (the 8 the founder ticked, enforced by
 * the intent_place CHECK constraint); `themes.name` is the catalogue's marketing vocabulary.
 * EVERY mapping row below was verified against the live `themes` table on 2026-07-14 — the
 * theme names are copied from the database, not recalled. If a theme is renamed in the CMS,
 * the scope silently thins and the fallback (below) keeps the answer honest.
 */
export const CHIP_THEMES: Record<string, string[]> = {
  'Pilgrimage': ['Pilgrimage Tours', '12 Jyotirlinga Tour', 'Nepal Kailash Tours'],
  'Beaches': ['Beaches Tours', 'Goa Tours'],
  'Honeymoon & Romance': ['Honeymoon Tours', 'Couple Tour Packages In India'],
  'Culture & Festivals': ['Cultural Tour', 'Festival Tour'],
  'Heritage & Forts': ['Heritage Tour', 'Golden Triangle Tours', 'Taj Mahal Tours'],
  'Hill Stations & Mountains': ['Hill Station Tours', 'Himachal Tours', 'Kashmir Tours', 'Leh Ladakh Tours', 'Uttaranchal Tours'],
  'Trekking & Adventure': ['Trekking Tours In India', 'River Rafting Tours'],
  'Wildlife & Nature': ['Wildlife Tour'],
};

export function themesForChips(chips: string[]): string[] {
  const out = new Set<string>();
  for (const c of chips) for (const t of CHIP_THEMES[c] ?? []) out.add(t);
  return [...out];
}

/**
 * The candidate pool for a set of chips: every `role='core'` place the founder-ticked index
 * says serves them, joined to our own catalogue of towns.
 *
 * - `role='gateway'` rows are ACCESS data, not destinations; they never enter the pool.
 * - INTERIM pseudo-node fence: intent_place contains circuit rows ("Arupadai Veedu Temple
 *   Circuit") — a circuit is not a place to sleep. Excluded by name pattern until the
 *   founder's place-data sheet lands a `kind` column; the exclusion is logged so it cannot
 *   become invisible.
 * - `admin1Codes` fences the pool to a region when he named BOTH a theme and a region.
 */
export async function poolForChips(chips: string[], admin1Codes: string[] = []): Promise<StayNode[]> {
  if (!chips.length) return [];
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT DISTINCT ON (n.id)
              n.id, n.name, n.lat, n.lng, n.admin1_code, n.state_name, n.district,
              n.tour_count, n.source_kind, n.elevation_m,
              g.source_url AS guide_url, COALESCE(g.has_food, false) AS has_food
         FROM intent_place ip
         JOIN stay_nodes n ON n.id = ip.city_id
         LEFT JOIN stay_node_guides g ON g.stay_node_id = n.id
        WHERE ip.chip = ANY($1::text[])
          AND ip.role = 'core'
          AND ($2::text[] = '{}' OR n.admin1_code = ANY($2::text[]))
        ORDER BY n.id`, chips, admin1Codes);

    const out: StayNode[] = [];
    for (const r of rows) {
      if (/\b(circuit|temple circuit)\b/i.test(String(r.name))) {
        console.warn(`themePool: "${r.name}" looks like a circuit, not a town — excluded (interim fence, US-840).`);
        continue;
      }
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
    out.sort((a, b) => (b.tourCount - a.tourCount) || a.name.localeCompare(b.name));
    return out;
  } catch (e) {
    console.error('poolForChips failed:', e);
    return [];
  }
}

/** Fewer scoped pairs than this and the scope is too thin to lead — we fall back to the
 *  whole memory and let circuitVoice carry the honesty (it already distinguishes "built
 *  before" from "never built"). A judgement, written down as one. */
export const MIN_SCOPED_PAIRS = 5;

/**
 * The designers' memory, RESTRICTED to tours that themselves carry a theme matching his
 * chips. Pairs come from `tour_cities` (the designers' own hand — Tier 1); nights from
 * `tour_stays` (a verified parse — Tier 2). The `reconciled` flag is taken from the global
 * `designer_typical_nights` verification: a parse that failed reconciliation globally may
 * not sneak back in through a theme window.
 */
export async function scopedDesignerMemory(chips: string[]): Promise<{ memory: DesignerMemory; scoped: boolean }> {
  const themes = themesForChips(chips);
  if (!themes.length) return { memory: await loadDesignerMemory(), scoped: false };
  try {
    const [pairRows, nightRows] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `WITH ttours AS (
           SELECT DISTINCT tt."tourId" FROM tour_themes tt
             JOIN themes t ON t.id = tt."themeId"
            WHERE t.name = ANY($1::text[]))
         SELECT ca.name AS city, cb.name AS pairs_with, count(DISTINCT a."tourId")::int AS n
           FROM tour_cities a
           JOIN tour_cities b ON a."tourId" = b."tourId" AND a."cityId" <> b."cityId"
           JOIN cities ca ON ca.id = a."cityId"
           JOIN cities cb ON cb.id = b."cityId"
          WHERE a."tourId" IN (SELECT "tourId" FROM ttours)
          GROUP BY 1, 2
          ORDER BY n DESC`, themes),
      prisma.$queryRawUnsafe<any[]>(
        `WITH ttours AS (
           SELECT DISTINCT tt."tourId" FROM tour_themes tt
             JOIN themes t ON t.id = tt."themeId"
            WHERE t.name = ANY($1::text[]))
         SELECT s.name AS city,
                avg(ts.nights)::float AS nights,
                count(DISTINCT ts."tourId")::int AS times,
                COALESCE(dtn.reconciled, false) AS reconciled,
                dtn.agreement_rate
           FROM tour_stays ts
           JOIN stay_nodes s ON s.id = ts."wtiCityId"
           LEFT JOIN designer_typical_nights dtn ON lower(dtn.city) = lower(s.name)
          WHERE ts."tourId" IN (SELECT "tourId" FROM ttours)
          GROUP BY s.name, dtn.reconciled, dtn.agreement_rate`, themes),
    ]);

    // Distinct unordered pairs (each direction is a row; count once).
    const distinctPairs = new Set(pairRows.map((r) => [String(r.city), String(r.pairs_with)].sort().join('|'))).size;
    if (distinctPairs < MIN_SCOPED_PAIRS) {
      console.warn(`scopedDesignerMemory: only ${distinctPairs} scoped pairs for [${chips.join(', ')}] — falling back to the whole memory.`);
      return { memory: await loadDesignerMemory(), scoped: false };
    }

    const pairs: DesignerPair[] = pairRows.map((r) => ({
      city: String(r.city),
      pairsWith: String(r.pairs_with),
      designedTogether: Number(r.n) || 0,
      tier: 'designer_catalogue',
    }));
    const nights: TypicalNights[] = nightRows.map((r) => ({
      city: String(r.city),
      nights: Number(r.nights) || 0,
      timesDesigned: Number(r.times) || 0,
      tier: 'catalogue_ai_parsed',
      reconciled: r.reconciled === true,
      agreementRate: r.agreement_rate == null ? null : Number(r.agreement_rate),
    }));
    return { memory: { pairs, nights }, scoped: true };
  } catch (e) {
    console.error('scopedDesignerMemory failed — falling back to the whole memory:', e);
    return { memory: await loadDesignerMemory(), scoped: false };
  }
}

// ---- the origin's side of the story --------------------------------------------------------

export interface OriginFacts {
  name: string;
  coord: [number, number];
  /** the nearest airport city WITH real scheduled service, if one is within reach. */
  nearestAirport: { city: string; km: number } | null;
}

/** Catalogue-first coordinate resolution for the ORIGIN (same ladder as the engine: our own
 *  towns outrank the world gazetteer, India outranks a namesake). Null when nothing resolves
 *  — and then the caller must ask, not guess. */
export async function originFactsFor(name: string): Promise<OriginFacts | null> {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  try {
    let coord: [number, number] | null = null;
    const cat = await prisma.$queryRawUnsafe<any[]>(
      `SELECT lat, lng FROM stay_nodes WHERE similarity(lower(name), $1) > 0.6
        ORDER BY similarity(lower(name), $1) DESC, tour_count DESC NULLS LAST LIMIT 1`, n);
    if (cat[0]) coord = [Number(cat[0].lat), Number(cat[0].lng)];
    if (!coord) {
      const gaz = await prisma.$queryRawUnsafe<any[]>(
        `SELECT latitude, longitude FROM world_cities WHERE lower(name) = $1
          ORDER BY ("countryCode" = 'IN') DESC, population DESC NULLS LAST LIMIT 1`, n);
      if (gaz[0]) coord = [Number(gaz[0].latitude), Number(gaz[0].longitude)];
    }
    if (!coord) return null;

    const airports = await prisma.$queryRawUnsafe<any[]>(
      `SELECT city, lat, lng FROM airport_cities`);
    let nearest: { city: string; km: number } | null = null;
    for (const a of airports) {
      const km = haversineKm(coord, [Number(a.lat), Number(a.lng)]);
      if (!nearest || km < nearest.km) nearest = { city: String(a.city), km };
    }
    // 200 straight-line km is a generous "within reach of his front door" for the ORIGIN
    // side (Samastipur rule: the carriage to a gateway is OUR job, costed in his days).
    return { name, coord, nearestAirport: nearest && nearest.km <= 200 ? nearest : null };
  } catch (e) {
    console.error('originFactsFor failed:', e);
    return null;
  }
}

/** Does ANY real scheduled sector connect these two airport cities? Existence only —
 *  no times, no flight numbers. A model may propose; only this table may confirm. */
export async function flightSectorExists(a: string, b: string): Promise<boolean> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT 1 FROM flight_sectors
        WHERE lower(origin_city) = lower($1) AND lower(dest_city) = lower($2) LIMIT 1`, a, b);
    return rows.length > 0;
  } catch { return false; }
}

/** One change of plane. Still an existence fact: both hops are real scheduled sectors that
 *  meet at the same city. (Whether the times CONNECT is step-5 work; this only answers
 *  "is this pair flyable at all", which is what the ORIGIN gate needs.) */
export async function flightOneStopExists(a: string, b: string): Promise<boolean> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT 1 FROM flight_sectors f1
         JOIN flight_sectors f2 ON lower(f1.dest_city) = lower(f2.origin_city)
        WHERE lower(f1.origin_city) = lower($1) AND lower(f2.dest_city) = lower($2) LIMIT 1`, a, b);
    return rows.length > 0;
  } catch { return false; }
}

/** The nearest airport city WITH real scheduled service to a coordinate. 163 rows — read
 *  once per call, filtered here. Null when nothing is within `maxKm` straight-line. */
export async function nearestAirportTo(coord: [number, number], maxKm = 150): Promise<{ city: string; km: number } | null> {
  try {
    const airports = await prisma.$queryRawUnsafe<any[]>(`SELECT city, lat, lng FROM airport_cities`);
    let nearest: { city: string; km: number } | null = null;
    for (const a of airports) {
      const km = haversineKm(coord, [Number(a.lat), Number(a.lng)]);
      if (!nearest || km < nearest.km) nearest = { city: String(a.city), km };
    }
    return nearest && nearest.km <= maxKm ? nearest : null;
  } catch (e) {
    console.error('nearestAirportTo failed:', e);
    return null;
  }
}
