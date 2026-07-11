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
  /** human note, e.g. the spelling correction. */
  note?: string;
}

const sane = (lat: unknown, lng: unknown): boolean =>
  typeof lat === 'number' && typeof lng === 'number' &&
  Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= -60 && lat <= 75 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);

async function dbExact(name: string) {
  const rows = await prisma.$queryRaw<{ name: string; latitude: number; longitude: number }[]>`
    SELECT name, latitude, longitude FROM world_cities
    WHERE lower(name) = ${name.toLowerCase()}
    ORDER BY ("countryCode" = 'IN') DESC, population DESC NULLS LAST LIMIT 1`;
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

// place types Nominatim may return that are honest overnight/visit stops
const OSM_PLACE_TYPES = new Set([
  'city', 'town', 'village', 'hamlet', 'municipality', 'locality',
  'suburb', 'island', 'isolated_dwelling', 'administrative',
]);

interface OsmHit { name: string; lat: number; lng: number; country: string | null; region: string | null }

/** FACTUAL lookup: OpenStreetMap Nominatim, India first then worldwide.
 *  Registers nothing itself — the caller registers. Fail-safe: null on error. */
async function osmLookup(name: string): Promise<OsmHit | null> {
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
        if (!OSM_PLACE_TYPES.has(type) && cls !== 'place' && cls !== 'boundary' && cls !== 'tourism') continue;
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
  // India-preferred, then worldwide (the planner is India-first but not India-only)
  return (await ask('&countrycodes=in')) ?? (await ask(''));
}

async function registerPlace(name: string, lat: number, lng: number, country: string | null, source: string): Promise<boolean> {
  const isIndia = country ? /india/i.test(country) : (lat >= 6 && lat <= 37.5 && lng >= 68 && lng <= 97.5);
  try {
    await prisma.$executeRaw`
      INSERT INTO world_cities (name, "asciiName", latitude, longitude, "countryCode", "countryName", population, "searchRank", source)
      SELECT ${name}, ${name}, ${lat}, ${lng}, ${isIndia ? 'IN' : null}, ${country ?? (isIndia ? 'India' : null)}, 0, 0, ${source}
      WHERE NOT EXISTS (SELECT 1 FROM world_cities WHERE lower(name) = lower(${name}))`;
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

/** The full ladder: exact → fuzzy → OSM gazetteer → AI spelling repair. */
export async function verifyCity(rawName: string): Promise<CityVerifyResult> {
  const name = String(rawName || '').trim();
  if (name.length < 2 || name.length > 80) return { ok: false };

  const exact = await dbExact(name);
  if (exact) {
    return { ok: true, name: exact.name, lat: Number(exact.latitude), lng: Number(exact.longitude), matched: 'db' };
  }

  // short names need a much closer match — "Mana" must not become "Maymana".
  // A marginal fuzzy hit defers to the factual gazetteer below.
  const fuzzy = await dbFuzzy(name);
  const fuzzyNeeded = name.length <= 5 ? 0.75 : name.length <= 8 ? 0.55 : 0.45;
  if (fuzzy && fuzzy.sim >= fuzzyNeeded) {
    return {
      ok: true, name: fuzzy.name, lat: Number(fuzzy.latitude), lng: Number(fuzzy.longitude),
      matched: 'fuzzy', note: fuzzy.name.toLowerCase() !== name.toLowerCase() ? `Corrected to ${fuzzy.name}` : undefined,
    };
  }

  // FACTUAL gazetteer before any model: tiny villages and hamlets live here
  const osm = await osmLookup(name);
  if (osm) {
    const registered = await registerPlace(osm.name, osm.lat, osm.lng, osm.country, 'OSM_VERIFIED');
    if (registered) {
      return {
        ok: true, name: osm.name, lat: osm.lat, lng: osm.lng, matched: 'osm',
        note: `Verified and added${osm.name.toLowerCase() !== name.toLowerCase() ? ` as ${osm.name}` : ''}${osm.region ? ` (${osm.region})` : ''}`,
      };
    }
  }

  const ai = await aiExistence(name);
  if (ai) return ai;

  return { ok: false };
}
