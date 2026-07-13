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
  /**
   * FOUNDER, 2026-07-13 — what a destination card is actually FOR:
   *   "just destination information, special things about that destination, what to eat,
   *    sightseeing places, what to buy, best season to visit"
   *
   * AND WHAT IT IS NOT FOR: tour operators and travel companies. We were printing our own
   * competitors on our own itinerary. The guides section is gone entirely.
   */
  whatToEat: { name: string; why?: string }[];
  whatToBuy: { name: string; why?: string }[];
  sources: string[];
  model: string | null;
}

async function readCache(city: string): Promise<CityContent | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT city, intro, attractions, itinerary_body, best_time, unique_facts,
             what_to_eat, what_to_buy, sources, model, fetched_at, ttl_days
      FROM city_content WHERE lower(city)=lower($1) LIMIT 1`, city);
    const r = rows[0];
    if (!r) return null;
    if (!isFresh(r.fetched_at, (Number(r.ttl_days) || CONTENT_TTL_DAYS) * 24)) return null;
    return { city: r.city, intro: r.intro,
      attractions: Array.isArray(r.attractions) ? r.attractions : [],
      itineraryBody: r.itinerary_body, bestTime: r.best_time,
      uniqueFacts: Array.isArray(r.unique_facts) ? r.unique_facts : [],
      whatToEat: Array.isArray(r.what_to_eat) ? r.what_to_eat : [],
      whatToBuy: Array.isArray(r.what_to_buy) ? r.what_to_buy : [],
      sources: Array.isArray(r.sources) ? r.sources : [], model: r.model };
  } catch { return null; }
}

async function writeCache(c: CityContent): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO city_content (city, intro, attractions, itinerary_body, best_time, unique_facts,
                                what_to_eat, what_to_buy, sources, model, confidence, ttl_days)
      VALUES ($1,$2,$3::jsonb,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12)
      ON CONFLICT (lower(city)) DO UPDATE SET
        intro=$2, attractions=$3::jsonb, itinerary_body=$4, best_time=$5,
        unique_facts=$6::jsonb, what_to_eat=$7::jsonb, what_to_buy=$8::jsonb,
        sources=$9::jsonb, model=$10, confidence=$11, fetched_at=now(), ttl_days=$12`,
      c.city, c.intro, JSON.stringify(c.attractions), c.itineraryBody, c.bestTime,
      JSON.stringify(c.uniqueFacts), JSON.stringify(c.whatToEat), JSON.stringify(c.whatToBuy),
      JSON.stringify(c.sources), c.model, 0.65, CONTENT_TTL_DAYS);
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

interface LiveContent { intro?: string; attractions?: { name: string; why?: string; hours?: string; source_url?: string }[]; itinerary_body?: string; best_time?: string; unique_facts?: string[]; what_to_eat?: { name: string; why?: string }[]; what_to_buy?: { name: string; why?: string }[] }

async function generate(city: string, timeoutMs: number): Promise<CityContent | null> {
  const seeds = await seedAttractions(city);
  const seedLine = seeds.length ? `Known verified sites here (include these where relevant, do not contradict): ${seeds.join('; ')}.` : '';
  // FOUNDER, 2026-07-13, on what a destination card is for:
  //   "just destination information, special things about that destination, what to eat,
  //    sightseeing places, what to buy, best season to visit"
  //
  // AND WHAT IT IS NOT FOR. We must NEVER name a tour operator, travel agency or travel
  // company here. THEY ARE OUR COMPETITION, and handing a traveller their name — on our page,
  // at the moment he is deciding to buy — is us paying for the lead and giving it away.
  //
  // WTI VOICE (the iron law): easy English, second person, written for Indian and NRI
  // travellers. No slang, no western idioms, no difficult words.
  const prompt = `Write destination information for ${city}, India, for a traveller reading our itinerary. ${seedLine}
Use web search to verify current details.

VOICE: speak directly to the traveller as "you", in EASY, simple English, short clear sentences. No slang, no difficult words. Our readers are Indian families and NRIs.

ABSOLUTE RULE: NEVER name a tour operator, travel agency, travel company, DMC or tour guide company. We are a tour operator ourselves and we will not advertise our competitors. Write about the PLACE, not about who sells it.

Return ONLY JSON:
{"intro":"<2-3 easy sentences about the place>",
 "attractions":[{"name":"...","why":"<one easy line about why you would go>","hours":"<if known>","source_url":"<url>"} (up to 6)],
 "itinerary_body":"<a tight 1-day sightseeing flow, 3-5 easy sentences, second person>",
 "best_time":"<the best months, and why, in one easy sentence>",
 "unique_facts":["<a verifiable fact that makes this place special>" (up to 4)],
 "what_to_eat":[{"name":"<a real local dish or sweet>","why":"<one easy line>"} (up to 5)],
 "what_to_buy":[{"name":"<a real local craft, fabric, tea, spice or handicraft>","why":"<one easy line>"} (up to 5)]}

Rules: only real, current information. Prefer the seeded sites. NO FABRICATION — if you do not know, return an empty list rather than invent. For what_to_eat name the DISH, never a restaurant or a chain. For what_to_buy name the THING or the market, never a shop brand.`;
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
    // A DISH, never a restaurant. A CRAFT, never a shop brand. If the model sends a business
    // anyway, the name filter below drops it — the same doctrine as the guides rule: a prompt
    // is a request, a filter is a rule.
    whatToEat: cleanList(d.what_to_eat),
    whatToBuy: cleanList(d.what_to_buy),
    sources: r.sources,
    model,
  };
}

/**
 * A DISH IS NOT A RESTAURANT. A CRAFT IS NOT A SHOP.
 *
 * The founder's rule is that we never name a travel company on our own page. The same logic
 * applies here in a quieter way: "eat at Hotel Paradise" is an advertisement, and it is one we
 * cannot stand behind. We name the THING — the pitha, the Assam silk — and let him find it.
 */
const BUSINESS_WORDS = /\b(pvt|ltd|limited|llp|inc|hotel|restaurant|cafe|caf\u00e9|resort|dhaba|chain|store|showroom|emporium\s+pvt|tours?|travels?|agency)\b/i;

function cleanList(v: unknown): { name: string; why?: string }[] {
  if (!Array.isArray(v)) return [];
  const out: { name: string; why?: string }[] = [];
  for (const raw of v) {
    const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
    if (!name || name.length > 80) continue;
    if (BUSINESS_WORDS.test(name)) {
      console.log(`[content] DROPPED "${name}" — that is a business, not a dish or a craft.`);
      continue;
    }
    out.push({ name, why: typeof raw?.why === 'string' && raw.why.trim() ? raw.why.trim() : undefined });
    if (out.length >= 5) break;
  }
  return out;
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
