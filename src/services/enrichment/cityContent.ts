/**
 * cityContent — sightseeing narrative + best-time + unique-facts per city.
 * Sonnet (quality is the product), cache-first, long TTL (~4 months). Seeded and
 * verified against asi_sites + poi_monuments so the model augments rather than
 * fabricates the attraction list.
 */
import prisma from '@/config/db';
import { webSearchJson, CONCERN_MODEL, isFresh } from './core';
import { validateAttraction } from './guardrails';
import { enqueue } from './jobs';

const CONTENT_TTL_DAYS = 120;

export interface CityContent {
  city: string;
  intro: string | null;
  attractions: { name: string; why?: string; hours?: string; sourceUrl?: string }[];
  itineraryBody: string | null;
  bestTime: string | null;
  uniqueFacts: string[];
  sources: string[];
  model: string | null;
}

async function readCache(city: string): Promise<CityContent | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT city, intro, attractions, itinerary_body, best_time, unique_facts, sources, model, fetched_at, ttl_days
      FROM city_content WHERE lower(city)=lower($1) LIMIT 1`, city);
    const r = rows[0];
    if (!r) return null;
    if (!isFresh(r.fetched_at, (Number(r.ttl_days) || CONTENT_TTL_DAYS) * 24)) return null;
    return { city: r.city, intro: r.intro,
      attractions: Array.isArray(r.attractions) ? r.attractions : [],
      itineraryBody: r.itinerary_body, bestTime: r.best_time,
      uniqueFacts: Array.isArray(r.unique_facts) ? r.unique_facts : [],
      sources: Array.isArray(r.sources) ? r.sources : [], model: r.model };
  } catch { return null; }
}

async function writeCache(c: CityContent): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO city_content (city, intro, attractions, itinerary_body, best_time, unique_facts, sources, model, confidence, ttl_days)
      VALUES ($1,$2,$3::jsonb,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10)
      ON CONFLICT (lower(city)) DO UPDATE SET
        intro=$2, attractions=$3::jsonb, itinerary_body=$4, best_time=$5,
        unique_facts=$6::jsonb, sources=$7::jsonb, model=$8, confidence=$9, fetched_at=now(), ttl_days=$10`,
      c.city, c.intro, JSON.stringify(c.attractions), c.itineraryBody, c.bestTime,
      JSON.stringify(c.uniqueFacts), JSON.stringify(c.sources), c.model, 0.65, CONTENT_TTL_DAYS);
  } catch (e) { console.error('city_content write failed:', e); }
}

/** Seed attraction names from asi_sites + poi_monuments near/at the city. */
async function seedAttractions(city: string): Promise<string[]> {
  const names = new Set<string>();
  try {
    const asi = await prisma.$queryRawUnsafe<any[]>(`
      SELECT name FROM asi_sites WHERE lower(location)=lower($1) OR lower(district)=lower($1) LIMIT 15`, city);
    for (const r of asi) if (r.name) names.add(String(r.name).trim());
  } catch { /* table optional — seed is best-effort */ }
  return [...names].slice(0, 15);
}

interface LiveContent { intro?: string; attractions?: { name: string; why?: string; hours?: string; source_url?: string }[]; itinerary_body?: string; best_time?: string; unique_facts?: string[] }

async function generate(city: string, timeoutMs: number): Promise<CityContent | null> {
  const seeds = await seedAttractions(city);
  const seedLine = seeds.length ? `Known verified sites here (include these where relevant, do not contradict): ${seeds.join('; ')}.` : '';
  const prompt = `Write concise, accurate sightseeing content for ${city}, India, for a tour operator's itinerary. ${seedLine}
Use web search to verify current details. Return ONLY JSON:
{"intro":"<2-3 sentences>","attractions":[{"name":"...","why":"<one line>","hours":"<if known>","source_url":"<url>"} (up to 6)],"itinerary_body":"<a tight 1-day sightseeing flow, 3-5 sentences>","best_time":"<months + why>","unique_facts":["<verifiable fact>" (up to 4)]}
Rules: only include real, current information; prefer the seeded sites; every attraction should have a source_url where possible; no fabrication.`;
  const model = CONCERN_MODEL.content();
  const r = await webSearchJson<LiveContent>({ model, prompt, maxSearches: 4, maxTokens: 4000, timeoutMs });
  const d = r.data;
  if (!d || (!d.intro && !(d.attractions && d.attractions.length))) return null;
  const attractions = Array.isArray(d.attractions)
    ? d.attractions.map((a) => validateAttraction(a, r.sources)).filter(Boolean).slice(0, 10) as { name: string; why?: string; hours?: string; sourceUrl?: string }[]
    : [];
  return {
    city,
    intro: d.intro || null,
    attractions,
    itineraryBody: d.itinerary_body || null,
    bestTime: d.best_time || null,
    uniqueFacts: Array.isArray(d.unique_facts) ? d.unique_facts.filter(Boolean).slice(0, 6).map(String) : [],
    sources: r.sources,
    model,
  };
}

export interface ContentOpts { allowLive?: boolean; timeoutMs?: number }

export async function findCityContent(city: string, opts: ContentOpts = {}): Promise<CityContent | null> {
  const cached = await readCache(city);
  if (cached) return cached;
  if (opts.allowLive !== false) {
    const live = await generate(city, opts.timeoutMs ?? 35000);
    if (live) { await writeCache(live); return live; }
  }
  await enqueue('content', { city });
  return null;
}

export async function runContentJob(key: { city: string }): Promise<boolean> {
  const c = await findCityContent(key.city, { allowLive: true, timeoutMs: 40000 });
  return !!c;
}
