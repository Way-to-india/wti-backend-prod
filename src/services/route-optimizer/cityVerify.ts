// =============================================================================
// cityVerify.ts — "a place must be REAL before it enters a plan."
//
// Three gates, in order of trust (founder ruling 2026-07-11: verify existence
// as-you-type; spelling mistakes are okay; never silently drop a city, never
// plan around a place that does not exist):
//
//   1. DB exact     — world_cities case-insensitive match. Highest trust.
//   2. DB fuzzy     — pg_trgm similarity: catches spellings ("Khajurao" →
//                     "Khajuraho"). Returns the CANONICAL name. High trust —
//                     the place itself is already in the gazetteer.
//   3. OSM gazetteer — Nominatim (OpenStreetMap) knows millions of tiny
//                     villages and hamlets no city list carries. A hit here is
//                     a FACTUAL lookup with surveyed coordinates → registered
//                     as OSM_VERIFIED. India-preferred, then worldwide.
//   4. AI spelling   — Claude Haiku is the LAST resort, used mainly to repair
//                     a spelling into a canonical name which is then re-checked
//                     against the DB and OSM (so the facts still come from a
//                     gazetteer). Only if OSM has never heard of the place do
//                     we accept the model's own coords, and then only under
//                     hard gates (certain + high confidence + sane coords) —
//                     the model can only PROPOSE; the gates decide.
//
// Anything that fails all four is honestly rejected — the caller tells the
// user which name failed instead of planning around the remaining cities.
// =============================================================================
import prisma from '@/config/db';
import { anthropic, enrichmentEnabled } from '@/services/enrichment/core';

export interface CityVerifyResult {
  ok: boolean;
  /** canonical name to use in the plan (may differ from the input spelling). */
  name?: string;
  lat?: number;
  lng?: number;
  /** how it was verified: db | fuzzy | osm | ai. */
  matched?: 'db' | 'fuzzy' | 'osm' | 'ai';
  /** human note, e.g. "Verified and added (Banjar, Kullu, Himachal Pradesh)". */
  note?: string;
  /**
   * A SPELLING CORRECTION WE ARE NOT ALLOWED TO MAKE FOR HIM.
   * ok is FALSE when this is set. The traveller must accept it. This exists because
   * "Turturiya chattisgarh" was once silently rewritten to "Turtuk" in Ladakh and shown
   * with a verified tick. A guess is now a question, never a fact.
   */
  suggestion?: { name: string; region?: string | null; lat: number; lng: number };
  /** true when we simply do not know this place — the caller must offer the way out
   *  (tell us where it is: latitude and longitude, or a map pin). */
  needsLocation?: boolean;
}

// ---- THE TURTURIYA RULE -----------------------------------------------------
// A spelling correction may only be OFFERED, never applied, and only when it is a
// genuine typo. Two edits or fewer, highly similar, and starting the same way.
// "Turturiya" → "Turtuk" is five edits: it can never be offered again.
const MAX_TYPO_EDITS = 2;
const MIN_TYPO_SIMILARITY = 0.72;

/** Levenshtein edit distance, bounded — how many single-letter changes apart? */
export function editDistance(a: string, b: string): number {
  const s = a.toLowerCase(), t = b.toLowerCase();
  if (Math.abs(s.length - t.length) > MAX_TYPO_EDITS + 2) return 99;
  const prev = new Array(t.length + 1);
  const cur = new Array(t.length + 1);
  for (let j = 0; j <= t.length; j++) prev[j] = j;
  for (let i = 1; i <= s.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= t.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= t.length; j++) prev[j] = cur[j];
  }
  return prev[t.length];
}

/** Is this close enough to be an honest typo, rather than a different place? */
export function isGenuineTypo(typed: string, candidate: string, similarity: number): boolean {
  if (similarity < MIN_TYPO_SIMILARITY) return false;
  if (editDistance(typed, candidate) > MAX_TYPO_EDITS) return false;
  // a typo does not change how a word begins
  return typed.slice(0, 3).toLowerCase() === candidate.slice(0, 3).toLowerCase();
}

/** Indian states and union territories — so "Turturiya chattisgarh" searches Turturiya
 *  IN Chhattisgarh instead of throwing the state away, which is what lost the place. */
const REGIONS: string[] = [
  'andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh', 'chattisgarh',
  'goa', 'gujarat', 'haryana', 'himachal pradesh', 'himachal', 'jharkhand', 'karnataka',
  'kerala', 'madhya pradesh', 'maharashtra', 'manipur', 'meghalaya', 'mizoram', 'nagaland',
  'odisha', 'orissa', 'punjab', 'rajasthan', 'sikkim', 'tamil nadu', 'telangana', 'tripura',
  'uttar pradesh', 'uttarakhand', 'west bengal', 'delhi', 'jammu and kashmir', 'kashmir',
  'ladakh', 'puducherry', 'pondicherry', 'andaman and nicobar', 'andaman', 'lakshadweep',
  'chandigarh', 'dadra and nagar haveli', 'daman and diu',
];

/** Split "Turturiya chattisgarh" into the place and the region the traveller gave us. */
export function splitRegion(raw: string): { place: string; region: string | null } {
  const t = raw.trim().replace(/\s+/g, ' ');
  const low = t.toLowerCase();
  for (const r of REGIONS) {
    // the region can arrive after a comma, or just after a space
    if (low.endsWith(' ' + r) || low.endsWith(', ' + r)) {
      const place = t.slice(0, t.length - r.length).replace(/[,\s]+$/, '').trim();
      if (place.length >= 2) return { place, region: r };
    }
  }
  return { place: t, region: null };
}

const sane = (lat: unknown, lng: unknown): boolean =>
  typeof lat === 'number' && typeof lng === 'number' &&
  Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= -60 && lat <= 75 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);

/**
 * THE STATE HE TYPED, TURNED INTO THE STATE OUR DATA SPEAKS.
 *
 * "Himachal Pradesh" / "himachal" / "HP" -> admin1Code '11'. Backed by `india_states`, in
 * which every code was VERIFIED on production against a witness city (see US-801/US-802b).
 * Returns null when we cannot map it — and then the caller must NOT pretend it had a region.
 */
async function regionToAdmin1(region: string | null): Promise<string | null> {
  if (!region) return null;
  const r = region.trim().toLowerCase();
  if (!r) return null;
  try {
    const rows = await prisma.$queryRaw<{ admin1_code: string }[]>`
      SELECT admin1_code FROM india_states
       WHERE lower(name) = ${r}
          OR lower(name) LIKE ${r + '%'}
          OR ${r} LIKE lower(name) || '%'
       ORDER BY length(name) ASC
       LIMIT 1`;
    return rows[0]?.admin1_code ?? null;
  } catch {
    return null;   // the table is absent => we simply have no region. We do not guess one.
  }
}

/**
 * OUR OWN WRITERS, DISAMBIGUATING FOR THE TRAVELLER.
 *
 * `travel_guide_cities` is 304 towns our staff have researched and published guides to, each
 * filed under a state BY A HUMAN. When a traveller types a bare "Manali", this is the company
 * answering "we mean the one in Himachal" — which is exactly what a consultant across a desk
 * would say, and exactly what a population count cannot.
 *
 * Absent-safe: no guide, no opinion, and the ladder behaves as before.
 */
async function ourGuidesSayTheStateIs(place: string): Promise<string | null> {
  try {
    const rows = await prisma.$queryRaw<{ state: string }[]>`
      SELECT "stateName" AS state FROM travel_guide_cities
       WHERE lower(name) = ${place.trim().toLowerCase()} AND "stateName" IS NOT NULL
       LIMIT 1`;
    return rows[0]?.state ?? null;
  } catch {
    return null;
  }
}

/**
 * THE HOLE THIS CLOSES, AND IT IS THE ONE THE FILE'S OWN COMMENT WARNED ABOUT.
 *
 * This function used to take a NAME and nothing else:
 *
 *     WHERE lower(name) = 'manali' ORDER BY population DESC LIMIT 1
 *
 * There are TWO Manalis. The only one in `world_cities` is A SUBURB OF CHENNAI. So
 * verifyCity('Manali, Himachal Pradesh') extracted "Himachal Pradesh", THREW IT AWAY here,
 * and returned Chennai — 1,939 km from Himachal — with `ok: true` and `matched: 'db'`.
 * FULL CONFIDENCE, COMPLETELY WRONG. It then short-circuited rung 2 (OSM), which is the one
 * rung that WAS region-aware.
 *
 * Four lines above, this file says: "Throwing the state away is what sent the founder to
 * Ladakh." Rung 1 was throwing it away.
 *
 * NOW: if he named a state, the row MUST BE IN THAT STATE. If our table holds no such row,
 * WE RETURN NOTHING and let the ladder fall through to OSM — which is exactly what should
 * have happened for Manali all along. A confident wrong answer is worse than no answer.
 */
async function dbExact(name: string, admin1?: string | null) {
  const n = name.toLowerCase();

  // US-823 — OUR OWN CATALOGUE ANSWERS FIRST. 251 towns our designers have physically taken
  // travellers to, with verified coordinates. If he named a state, the catalogue row must be
  // IN that state -- the state rule below is not weakened by this, only served earlier.
  const cat = await prisma.$queryRaw<{ name: string; latitude: number; longitude: number }[]>`
    SELECT s.name, s.lat AS latitude, s.lng AS longitude
      FROM stay_nodes s
     WHERE similarity(lower(s.name), ${n}) > 0.6
       AND (${admin1 ?? null}::text IS NULL OR s.admin1_code = ${admin1 ?? null})
     ORDER BY similarity(lower(s.name), ${n}) DESC, s.tour_count DESC NULLS LAST
     LIMIT 1`;
  if (cat[0]) return cat[0];
  if (admin1) {
    const rows = await prisma.$queryRaw<{ name: string; latitude: number; longitude: number }[]>`
      SELECT name, latitude, longitude FROM world_cities
      WHERE lower(name) = ${n} AND "countryCode" = 'IN' AND "admin1Code" = ${admin1}
      ORDER BY population DESC NULLS LAST LIMIT 1`;
    // NO FALLBACK. He told us the state. A row in the wrong state is not a match, it is a trap.
    return rows[0] ?? null;
  }
  // HE DID NOT NAME A STATE. Population used to decide -- and population is exactly what
  // sent every "Manali" to a SUBURB OF CHENNAI (pop 35,248) instead of the Himachal town our
  // designers have built SEVENTEEN tours to (pop 0 in our gazetteer, because it is a curated
  // row). The comment above this function already said this "is exactly what should have
  // happened for Manali all along" -- it was fixed only for the path where he names the state.
  //
  // OUR OWN CATALOGUE ANSWERS FIRST. If our designers have taken travellers to a town within
  // 25 km of this row, that IS the town he means. The join is on COORDINATE, not on name --
  // which is why it still works when the catalogue spells it "Rameshwaram" and he types
  // "Rameswaram". A name is not a key. A coordinate is a fact. (US-823)
  const rows = await prisma.$queryRaw<{ name: string; latitude: number; longitude: number }[]>`
    SELECT w.name, w.latitude, w.longitude FROM world_cities w
    WHERE lower(w.name) = ${n}
    ORDER BY (w."countryCode" = 'IN') DESC,
             (EXISTS (SELECT 1 FROM stay_nodes s
                       WHERE abs(s.lat - w.latitude) < 0.25
                         AND abs(s.lng - w.longitude) < 0.25
                         AND similarity(lower(s.name), lower(w.name)) > 0.45)) DESC,
             w.population DESC NULLS LAST
    LIMIT 1`;
  return rows[0] ?? null;
}

async function dbFuzzy(name: string) {
  try {
    const rows = await prisma.$queryRaw<{ name: string; latitude: number; longitude: number; sim: number }[]>`
      SELECT name, latitude, longitude, similarity(lower(name), ${name.toLowerCase()}) AS sim
      FROM world_cities
      WHERE similarity(lower(name), ${name.toLowerCase()}) > 0.45
      ORDER BY sim DESC, ("countryCode" = 'IN') DESC, population DESC NULLS LAST
      LIMIT 1`;
    return rows[0] ?? null;
  } catch {
    return null; // pg_trgm unavailable — skip the fuzzy gate, never crash
  }
}

// Settlement types Nominatim may return that are honest overnight stops.
const OSM_PLACE_TYPES = new Set([
  'city', 'town', 'village', 'hamlet', 'municipality', 'locality',
  'suburb', 'island', 'isolated_dwelling', 'administrative',
]);

/**
 * NATURAL AND PROTECTED PLACES TRAVELLERS ACTUALLY GO TO — and sleep in.
 *
 * Added 2026-07-11 after a real failure. "Tirthan Valley" is returned by OpenStreetMap
 * as a VALLEY, not a village, so the settlement-only filter above threw the surveyed
 * coordinate away — and the ladder fell through to the language model, which put the
 * valley 60-70 km from where it is, up near Manali. That wrong point was then written
 * into our own city table and every drive time computed from it was untrue.
 *
 * A place is not disqualified from being a stop because it is not a municipality. If
 * OpenStreetMap knows it, we take OpenStreetMap's coordinate — a surveyed fact always
 * beats a model's guess.
 */
const OSM_NATURAL_TYPES = new Set([
  'valley', 'beach', 'bay', 'peak', 'ridge', 'glacier', 'cape', 'volcano',
  'national_park', 'nature_reserve', 'protected_area', 'wetland', 'water', 'lake',
]);

interface OsmHit { name: string; lat: number; lng: number; country: string | null; region: string | null }

/** FACTUAL lookup: OpenStreetMap Nominatim, India first then worldwide.
 *  Registers nothing itself — the caller registers. Fail-safe: null on error. */
async function osmLookup(name: string, indiaOnly = false): Promise<OsmHit | null> {
  const ask = async (extra: string): Promise<OsmHit | null> => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=jsonv2&limit=3&accept-language=en${extra}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'WayToIndia-TripPlanner/1.0 (info@waytoindia.com)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const rows = (await res.json()) as Array<Record<string, unknown>>;
      for (const r of rows) {
        const type = String(r.type ?? '');
        const cls = String(r.class ?? '');
        const acceptable =
          OSM_PLACE_TYPES.has(type) || OSM_NATURAL_TYPES.has(type) ||
          cls === 'place' || cls === 'boundary' || cls === 'tourism' ||
          cls === 'natural' || cls === 'leisure' || cls === 'landuse';
        if (!acceptable) continue;
        const lat = Number(r.lat), lng = Number(r.lon);
        if (!sane(lat, lng)) continue;
        const display = String(r.display_name ?? '');
        const canonical = String(r.name ?? '').trim() || display.split(',')[0].trim();
        if (!canonical) continue;
        const parts = display.split(',').map((p) => p.trim());
        const country = parts.length ? parts[parts.length - 1] : null;
        // a short "where exactly" tail, e.g. "Chamoli, Uttarakhand, India"
        const region = parts.length > 1 ? parts.slice(-3).join(', ') : null;
        return { name: canonical, lat, lng, country, region };
      }
      return null;
    } catch { return null; }
  };
  // ---- THE FOURTH HOLE, found by the complete sanity sweep -------------------------
  //
  // This line used to read:
  //
  //     return (await ask('&countrycodes=in')) ?? (await ask(''));
  //
  // India-preferred, then WORLDWIDE. And the worldwide fallback is a loaded gun.
  //
  // We spell it "Nasik". OpenStreetMap spells it "Nashik". So the India search found
  // nothing, the fallback searched the whole planet — and returned -2.834, 107.417.
  // THAT IS AN ISLAND IN INDONESIA, 4,462 km from Maharashtra. `registerPlace` would then
  // have written it into our own gazetteer as a fact.
  //
  // WHEN WE KNOW THE PLACE IS IN INDIA, WE MAY NOT LEAVE INDIA. A miss is an honest answer;
  // a confident answer from the wrong hemisphere is not. The planner is India-first but not
  // India-only (Pokhara is a real stop), so the worldwide rung SURVIVES -- but only for a
  // bare name we have no Indian claim about.
  if (indiaOnly) return ask('&countrycodes=in');
  return (await ask('&countrycodes=in')) ?? (await ask(''));
}

/** Region-aware gazetteer lookup. "Turturiya" alone finds nothing; "Turturiya,
 *  Chhattisgarh, India" gives OpenStreetMap the district it needs. We ask in the most
 *  informative form FIRST, then fall back to the bare name. */
async function osmLookupWithRegion(place: string, region: string | null): Promise<OsmHit | null> {
  if (region) {
    // He (or our own travel guide) named an INDIAN STATE. So this place is in India, and we
    // do not go looking for it anywhere else -- not even if the Indian search comes back
    // empty. That is how "Nasik" became an island in Indonesia.
    const hit = await osmLookup(`${place}, ${region}, India`, true);
    if (hit) return hit;
    return osmLookup(place, true);
  }
  return osmLookup(place);
}

/**
 * THE SECOND HOLE. This used to refuse to insert anything whose NAME already existed:
 *
 *     WHERE NOT EXISTS (SELECT 1 FROM world_cities WHERE lower(name) = lower(:name))
 *
 * So even once OSM had correctly found HIMACHAL'S Manali, IT COULD NEVER BE STORED —
 * because Chennai's Manali already occupied the name. The gazetteer was structurally
 * incapable of holding two towns that share a name, which is a thing India has rather a
 * lot of. The bad row blocked the good one forever.
 *
 * NOW we de-duplicate on NAME **AND PLACE**: a row is a duplicate only if it carries the
 * same name AND sits within 25 km. Two Manalis 1,900 km apart are two towns, and we say so.
 *
 * We also STAMP THE STATE (admin1Code) from the coordinates, so the row we add can never
 * repeat the original sin of being un-placeable.
 */
async function registerPlace(name: string, lat: number, lng: number, country: string | null, source: string): Promise<boolean> {
  const isIndia = country ? /india/i.test(country) : (lat >= 6 && lat <= 37.5 && lng >= 68 && lng <= 97.5);
  try {
    // which state does this point actually sit in? (nearest gazetteer row, <=60 km)
    let admin1: string | null = null;
    if (isIndia) {
      const rows = await prisma.$queryRaw<{ a1: string; km: number }[]>`
        SELECT "admin1Code" AS a1,
               (6371*acos(LEAST(1,GREATEST(-1,
                  cos(radians(${lat}::float))*cos(radians(latitude::float))
                * cos(radians(longitude::float)-radians(${lng}::float))
                + sin(radians(${lat}::float))*sin(radians(latitude::float)))))) AS km
          FROM world_cities
         WHERE "countryCode"='IN' AND "admin1Code" ~ '^[0-9]{2}$'
           AND latitude BETWEEN ${lat}::float - 0.6 AND ${lat}::float + 0.6
           AND longitude BETWEEN ${lng}::float - 0.6 AND ${lng}::float + 0.6
         ORDER BY km ASC LIMIT 1`;
      if (rows[0] && Number(rows[0].km) <= 60) admin1 = rows[0].a1;
    }

    await prisma.$executeRaw`
      INSERT INTO world_cities (name, "asciiName", latitude, longitude, "countryCode", "countryName", "admin1Code", population, "searchRank", source)
      SELECT ${name}, ${name}, ${lat}, ${lng}, ${isIndia ? 'IN' : null}, ${country ?? (isIndia ? 'India' : null)}, ${admin1}, 0, 0, ${source}
      WHERE NOT EXISTS (
        SELECT 1 FROM world_cities
         WHERE lower(name) = lower(${name})
           AND (6371*acos(LEAST(1,GREATEST(-1,
                  cos(radians(${lat}::float))*cos(radians(latitude::float))
                * cos(radians(longitude::float)-radians(${lng}::float))
                + sin(radians(${lat}::float))*sin(radians(latitude::float)))))) <= 25)`;
    return true;
  } catch (e) { console.error('cityVerify register failed:', e); return false; }
}

async function aiExistence(name: string): Promise<CityVerifyResult | null> {
  if (!enrichmentEnabled()) return null;
  try {
    const resp = await anthropic().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system:
        'You verify whether a place exists. Reply with ONLY JSON: ' +
        '{"real":boolean,"canonicalName":string|null,"country":string|null,' +
        '"lat":number|null,"lng":number|null,"confidence":"high"|"medium"|"low"}. ' +
        'STRICT RULES: real=true ONLY if you are certain this is an actual city, town, ' +
        'village or named tourist place. A misspelling of a real place counts as real — ' +
        'give the correct canonicalName. A fictional, garbled or unknown name = real:false. ' +
        'Never guess coordinates: if unsure of location, set lat/lng null and confidence low.',
      messages: [{ role: 'user', content: name.slice(0, 120) }],
    });
    const raw = resp.content?.[0]?.type === 'text' ? resp.content[0].text : '';
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    if (j.real !== true || j.confidence === 'low') return null;
    const canonical = typeof j.canonicalName === 'string' && j.canonicalName.trim()
      ? j.canonicalName.trim() : null;
    if (!canonical) return null;

    // the model may have simply fixed the spelling to a place we already know
    const known = await dbExact(canonical);
    if (known) {
      return {
        ok: true, name: known.name, lat: Number(known.latitude), lng: Number(known.longitude),
        matched: 'fuzzy', note: canonical !== name ? `Corrected to ${known.name}` : undefined,
      };
    }

    // fixed spelling → re-check the FACTUAL gazetteer with the canonical name
    const osm = await osmLookup(canonical);
    if (osm) {
      const registered = await registerPlace(osm.name, osm.lat, osm.lng, osm.country, 'OSM_VERIFIED');
      if (registered) {
        return {
          ok: true, name: osm.name, lat: osm.lat, lng: osm.lng, matched: 'osm',
          note: `Verified and added${osm.name.toLowerCase() !== name.toLowerCase() ? ` as ${osm.name}` : ''}${osm.region ? ` (${osm.region})` : ''}`,
        };
      }
    }

    // LAST resort — the model's own coords, only under hard gates
    if (!sane(j.lat, j.lng) || j.confidence !== 'high') return null;
    const isIndia = typeof j.country === 'string' && /india/i.test(j.country);
    if (isIndia && !(j.lat >= 6 && j.lat <= 37.5 && j.lng >= 68 && j.lng <= 97.5)) return null;
    const registered = await registerPlace(canonical, j.lat, j.lng, typeof j.country === 'string' ? j.country : null, 'AI_VERIFIED');
    if (!registered) return null;
    return {
      ok: true, name: canonical, lat: j.lat, lng: j.lng, matched: 'ai',
      note: canonical !== name ? `Verified and added as ${canonical}` : 'Verified and added',
    };
  } catch (e) {
    console.error('cityVerify AI gate failed:', e);
    return null;
  }
}

/**
 * THE LADDER — facts first, guesses last, and a guess is never applied on its own.
 *
 *   1. our own city table (exact)
 *   2. OpenStreetMap, region-aware — a surveyed gazetteer
 *   3. the language model, hard-gated, and it must agree with the region he typed
 *   4. a spelling correction — OFFERED as a question, never applied (the Turturiya rule)
 *   5. not found — say so, and ask him where the place is
 */
export async function verifyCity(rawName: string): Promise<CityVerifyResult> {
  const raw = String(rawName || '').trim();
  if (raw.length < 2 || raw.length > 80) return { ok: false };

  // "Turturiya chattisgarh" → place: "Turturiya", region: "chattisgarh".
  // Throwing the state away is what sent the founder to Ladakh.
  const { place, region } = splitRegion(raw);

  // 1 — our own table, exactly — AND IN THE STATE HE NAMED.
  //
  // This line used to read `dbExact(place)`, with the region discarded. There are two
  // Manalis; the only one in our gazetteer is a suburb of CHENNAI. So "Manali, Himachal
  // Pradesh" returned Chennai, 1,939 km away, with ok:true — and short-circuited rung 2,
  // the one rung that knew about regions. A confident wrong answer, from the module whose
  // entire job is to prevent confident wrong answers.
  //
  // Now: if he named a state, the row must be IN that state, or rung 1 stands aside.
  //
  // AND IF HE NAMED NO STATE, OUR OWN WRITERS NAME ONE FOR HIM.
  //
  // Almost nobody types "Manali, Himachal Pradesh". They type "Manali" — and they mean the
  // hill station, not the suburb of Chennai. With no region, this used to fall back to
  // "whichever namesake has the larger population", which is a coin toss decided by a census.
  //
  // But we are not short of an opinion about which Manali we mean: OUR OWN STAFF WROTE A
  // TRAVEL GUIDE TO IT, and filed it under Himachal Pradesh. That is thirty years of this
  // company saying "when a traveller says Manali, this is the one." It is a better
  // disambiguator than population will ever be, and it costs us one query.
  //
  // (Only used when he did NOT name a state. If he names one, HE outranks us — always.)
  const typedRegion = region ?? (await ourGuidesSayTheStateIs(place));
  const admin1 = await regionToAdmin1(typedRegion);
  const exact = (await dbExact(place, admin1)) ?? (region && !admin1 ? await dbExact(raw) : null);
  if (exact) {
    return { ok: true, name: exact.name, lat: Number(exact.latitude), lng: Number(exact.longitude), matched: 'db' };
  }

  // 2 — the FACTUAL gazetteer, with the region (his, or the one our own guides supply)
  const osm = await osmLookupWithRegion(place, typedRegion);
  if (osm) {
    const registered = await registerPlace(osm.name, osm.lat, osm.lng, osm.country, 'OSM_VERIFIED');
    if (registered) {
      return {
        ok: true, name: osm.name, lat: osm.lat, lng: osm.lng, matched: 'osm',
        note: `Verified and added${osm.name.toLowerCase() !== place.toLowerCase() ? ` as ${osm.name}` : ''}${osm.region ? ` (${osm.region})` : ''}`,
      };
    }
  }

  // 3 — the model. It may PROPOSE; the gates decide. If he named a region, the model's
  //     answer must be in that region — this alone would have stopped Ladakh.
  const ai = await aiExistence(typedRegion ? `${place}, ${typedRegion}, India` : place);
  if (ai && ai.ok) {
    // THE THIRD HOLE. This block used to read, in full:
    //
    //     const coordsInRegion = true;  // trust but verify below
    //     void coordsInRegion;
    //
    // There was no "below". The comment above it promises "the model's answer must be in
    // that region — this alone would have stopped Ladakh", and the code did NOTHING. The
    // model was merely ASKED for the region and then believed.
    //
    // Now we CHECK. If he named a state, the model's coordinates must actually fall in it —
    // proved by a gazetteer town of that state within 60 km. If they do not, the answer is
    // discarded and the ladder falls through to the spelling question. A model may PROPOSE.
    // It may never REGISTER. (Spec §3.4.)
    if (admin1 && ai.lat != null && ai.lng != null) {
      const rows = await prisma.$queryRaw<{ km: number }[]>`
        SELECT MIN(6371*acos(LEAST(1,GREATEST(-1,
            cos(radians(${ai.lat}::float))*cos(radians(latitude::float))
          * cos(radians(longitude::float)-radians(${ai.lng}::float))
          + sin(radians(${ai.lat}::float))*sin(radians(latitude::float)))))) AS km
          FROM world_cities
         WHERE "countryCode"='IN' AND "admin1Code" = ${admin1}`;
      const km = rows[0]?.km == null ? null : Number(rows[0].km);
      if (km == null || km > 60) {
        console.error(`cityVerify: model put "${place}" outside ${typedRegion} (${km?.toFixed(0) ?? '?'} km from it). REJECTED.`);
        return { ok: false, note: `We could not place ${place} in ${typedRegion}. Could you tell us the nearest large town?` };
      }
    }
    return ai;
  }

  // 4 — a spelling correction, OFFERED, never applied. THE TURTURIYA RULE.
  const fuzzy = await dbFuzzy(place);
  if (fuzzy && isGenuineTypo(place, fuzzy.name, Number(fuzzy.sim))) {
    return {
      ok: false,
      needsLocation: false,
      suggestion: {
        name: fuzzy.name,
        lat: Number(fuzzy.latitude),
        lng: Number(fuzzy.longitude),
        region: null,
      },
      note: `We could not find "${raw}". Did you mean ${fuzzy.name}?`,
    };
  }

  // 5 — we do not know this place. SAY SO, and open the door: tell us where it is.
  return {
    ok: false,
    needsLocation: true,
    note: `We could not find "${raw}". If it is a small place, tell us where it is and we will add it.`,
  };
}

/** What happened when a human offered us a place and a location. */
export type PlaceAddOutcome = 'added' | 'held' | 'rejected';

export interface PlaceAddResult {
  outcome: PlaceAddOutcome;
  name?: string;
  lat?: number;
  lng?: number;
  /** what we found AT that point, in plain words: "Baloda Bazar, Chhattisgarh, India" */
  foundThere?: string | null;
  /** shown to the traveller, always in plain English. */
  message: string;
  /** HELD: the itinerary must not be built until a human at Way to India has looked. */
  hold?: boolean;
}

/** What does OpenStreetMap say is actually AT this point? A surveyed fact. */
async function reverseGeocode(lat: number, lng: number): Promise<{ area: string; country: string | null } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&accept-language=en&zoom=10`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'WayToIndia-TripPlanner/1.0 (info@waytoindia.com)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    const display = String(j.display_name ?? '').trim();
    if (!display) return null;
    const parts = display.split(',').map((p) => p.trim()).filter(Boolean);
    return {
      area: parts.slice(-4).join(', '),
      country: parts.length ? parts[parts.length - 1] : null,
    };
  } catch { return null; }
}

/** Park a place we could not confirm, so a human at Way to India can settle it. */
async function queueForHumanReview(name: string, lat: number, lng: number, region: string | null, why: string): Promise<void> {
  try {
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS place_review_queue (
        id           bigserial PRIMARY KEY,
        name         text NOT NULL,
        lat          double precision,
        lng          double precision,
        region       text,
        reason       text,
        status       text NOT NULL DEFAULT 'OPEN',
        created_at   timestamptz NOT NULL DEFAULT now()
      )`;
    await prisma.$executeRaw`
      INSERT INTO place_review_queue (name, lat, lng, region, reason)
      VALUES (${name}, ${lat}, ${lng}, ${region ?? null}, ${why})`;
  } catch (e) {
    console.error('place_review_queue insert failed (non-fatal):', e);
  }
}

/**
 * IGNORANCE IS NOT EVIDENCE.
 *
 * The model gets THREE answers, never two. It may CONTRADICT the human — but only when
 * it positively knows the place is somewhere else. If it has simply never heard of the
 * village, it must say so, and that counts for NOTHING. A model that does not know a
 * place is not a model that disagrees with you, and letting its ignorance block a true
 * coordinate would shut the door on exactly the obscure places this feature exists for.
 *
 * It cannot supply a coordinate. It cannot overrule the gazetteer. It can only object,
 * and only when it actually knows better.
 */
type PlaceVerdict = 'agrees' | 'contradicts' | 'unknown';

async function aiPlaceVerdict(name: string, foundThere: string): Promise<{ verdict: PlaceVerdict; why: string } | null> {
  if (!enrichmentEnabled()) return null;
  try {
    const resp = await anthropic().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system:
        'You check whether a named place lies in a given area. Reply with ONLY JSON: ' +
        '{"verdict":"agrees"|"contradicts"|"unknown","reason":string}. ' +
        'You are given (a) a place name a traveller typed, and (b) the area a map gazetteer ' +
        'reports at the coordinates the traveller supplied. Choose EXACTLY one: ' +
        '"agrees" — you know this place and it does lie in that area (same district, or a ' +
        'neighbouring one, in the same state and country). ' +
        '"contradicts" — you KNOW this place and it is definitely somewhere else, e.g. a ' +
        'different state or a distant part of the country. ' +
        '"unknown" — you have never heard of this place, or you are not sure. ' +
        'THIS IS IMPORTANT: if you simply do not know the place, you MUST answer "unknown". ' +
        'Do NOT answer "contradicts" merely because the place is unfamiliar to you. Small ' +
        'villages, temples and valleys that you have never heard of are real places. ' +
        'Never invent coordinates. Keep the reason under 20 words, plain English.',
      messages: [{ role: 'user', content: `Place typed: "${name.slice(0, 80)}". Gazetteer reports at those coordinates: "${foundThere.slice(0, 160)}". Does the place lie in that area?` }],
    });
    const raw = resp.content?.[0]?.type === 'text' ? resp.content[0].text : '';
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    const v = String(j.verdict || '').toLowerCase();
    if (v !== 'agrees' && v !== 'contradicts' && v !== 'unknown') return null;
    return { verdict: v as PlaceVerdict, why: typeof j.reason === 'string' ? j.reason : '' };
  } catch (e) {
    console.error('aiPlaceVerdict failed:', e);
    return null;
  }
}

/**
 * A HUMAN TELLS US WHERE A PLACE IS — and we check it before we believe it.
 * See the header of this patch for the three outcomes and the order of the checks.
 */
export async function addPlaceByCoords(
  rawName: string, lat: number, lng: number, region?: string | null,
): Promise<PlaceAddResult> {
  const name = String(rawName || '').trim();
  if (name.length < 2 || name.length > 80) {
    return { outcome: 'rejected', message: 'Please give the place a name.' };
  }

  // 1 — are these coordinates at all?
  if (!sane(lat, lng)) {
    return {
      outcome: 'rejected',
      message: 'Those coordinates do not look right. Latitude must be between -90 and 90, and longitude between -180 and 180.',
    };
  }

  // 2 — what is actually at that point? (a surveyed fact)
  const there = await reverseGeocode(lat, lng);
  if (!there) {
    await queueForHumanReview(name, lat, lng, region ?? null, 'No gazetteer result at those coordinates');
    return {
      outcome: 'held', hold: true, name, lat, lng, foundThere: null,
      message: `We could not confirm that ${name} is at the location you gave us, so we have not added it. Please contact us and we will check it ourselves and add it for you. We have kept your request.`,
    };
  }

  // 3 — REGION AGREEMENT. The rule that would have stopped Ladakh.
  if (region) {
    const wanted = String(region).toLowerCase().replace(/\s+/g, ' ').trim();
    const got = there.area.toLowerCase();
    const normalised = wanted.replace('chattisgarh', 'chhattisgarh').replace('orissa', 'odisha').replace('pondicherry', 'puducherry');
    if (!got.includes(wanted) && !got.includes(normalised)) {
      await queueForHumanReview(name, lat, lng, region, `Traveller said ${region}; the coordinates fall in ${there.area}`);
      return {
        outcome: 'held', hold: true, name, lat, lng, foundThere: there.area,
        message: `You told us ${name} is in ${region}, but the location you gave us falls in ${there.area}. We have not added it, and we have not built your plan around it. Please contact us — we will check the place ourselves and add it for you.`,
      };
    }
  }

  // 4 — the model, last, and ONLY to object when it actually knows better.
  //     "I have never heard of this village" is not an objection. See the note above.
  const verdict = await aiPlaceVerdict(name, there.area);
  if (verdict && verdict.verdict === 'contradicts') {
    await queueForHumanReview(name, lat, lng, region ?? null, `Contradicted: ${verdict.why} (coordinates fall in ${there.area})`);
    return {
      outcome: 'held', hold: true, name, lat, lng, foundThere: there.area,
      message: `We could not satisfy ourselves that ${name} is at the location you gave us — that point falls in ${there.area}. We have not added it, and we will not build your plan around a place we cannot stand behind. Please contact us and we will check it and add it for you.`,
    };
  }

  // ADDED — a human who has been there, and a surveyed map that agrees on the region.
  // Two good witnesses. The model's ignorance is not a third.
  const ok = await registerPlace(name, lat, lng, there.country, 'HUMAN_VERIFIED');
  if (!ok) {
    return { outcome: 'rejected', message: 'We could not add that place just now. Please try once more.' };
  }
  return {
    outcome: 'added', name, lat, lng, foundThere: there.area,
    message: `Added ${name} (${there.area}) at the location you gave us. Thank you — it is now in our list for everyone.`,
  };
}
