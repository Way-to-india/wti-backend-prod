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
//   3. AI existence — Claude Haiku is asked whether the place exists, with a
//                     STRICT contract: real:false unless certain; canonical
//                     spelling; lat/lng. We then apply hard sanity gates
//                     (coords in range, plausible confidence) BEFORE
//                     registering it into world_cities as source AI_VERIFIED.
//                     The model can only PROPOSE; the gates decide.
//
// Anything that fails all three is honestly rejected — the caller tells the
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
  /** how it was verified: db | fuzzy | ai. */
  matched?: 'db' | 'fuzzy' | 'ai';
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

    // genuinely new place: hard gates before it may enter the gazetteer
    if (!sane(j.lat, j.lng) || j.confidence !== 'high') return null;
    const isIndia = typeof j.country === 'string' && /india/i.test(j.country);
    if (isIndia && !(j.lat >= 6 && j.lat <= 37.5 && j.lng >= 68 && j.lng <= 97.5)) return null;
    try {
      await prisma.$executeRaw`
        INSERT INTO world_cities (name, "asciiName", latitude, longitude, "countryCode", "countryName", population, "searchRank", source)
        SELECT ${canonical}, ${canonical}, ${j.lat}, ${j.lng}, ${isIndia ? 'IN' : null}, ${typeof j.country === 'string' ? j.country : null}, 0, 0, 'AI_VERIFIED'
        WHERE NOT EXISTS (SELECT 1 FROM world_cities WHERE lower(name) = lower(${canonical}))`;
    } catch (e) { console.error('cityVerify register failed:', e); return null; }
    return {
      ok: true, name: canonical, lat: j.lat, lng: j.lng, matched: 'ai',
      note: canonical !== name ? `Verified and added as ${canonical}` : 'Verified and added',
    };
  } catch (e) {
    console.error('cityVerify AI gate failed:', e);
    return null;
  }
}

/** The full ladder: exact → fuzzy → AI-verified registration. */
export async function verifyCity(rawName: string): Promise<CityVerifyResult> {
  const name = String(rawName || '').trim();
  if (name.length < 2 || name.length > 80) return { ok: false };

  const exact = await dbExact(name);
  if (exact) {
    return { ok: true, name: exact.name, lat: Number(exact.latitude), lng: Number(exact.longitude), matched: 'db' };
  }

  const fuzzy = await dbFuzzy(name);
  if (fuzzy && fuzzy.sim >= 0.45) {
    return {
      ok: true, name: fuzzy.name, lat: Number(fuzzy.latitude), lng: Number(fuzzy.longitude),
      matched: 'fuzzy', note: fuzzy.name.toLowerCase() !== name.toLowerCase() ? `Corrected to ${fuzzy.name}` : undefined,
    };
  }

  const ai = await aiExistence(name);
  if (ai) return ai;

  return { ok: false };
}
