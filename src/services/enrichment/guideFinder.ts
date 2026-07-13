/**
 * guideFinder — government-recognised tour guides + contacts per city (cache-first).
 *
 * SENSITIVITY: guide phone numbers are personal data (PII) and some sources
 * (e.g. TripAdvisor) restrict scraping. We therefore:
 *   - prefer OFFICIAL sources (Ministry of Tourism Regional Level Guides, state
 *     tourism boards) and mark those `verified=true`;
 *   - store every row's source_url + confidence;
 *   - set `piiFlag=true` whenever a personal contact is captured so downstream
 *     handling can respect policy;
 *   - never fabricate a name or number.
 * Long TTL (~90 days).
 */
import prisma from '@/config/db';
import { webSearchJson, CONCERN_MODEL, isFresh } from './core';
import { validateGuide } from './guardrails';
import { enqueue } from './jobs';

const GUIDE_TTL_HOURS = 2160;

export interface GuideSuggestion {
  name: string;
  languages: string[];
  phone: string | null;
  email: string | null;
  recognition: string;      // 'MoT Regional Level Guide' | 'State Tourism' | 'unverified'
  rating: number | null;
  source: string;
  sourceUrl: string | null;
  verified: boolean;
  piiFlag: boolean;
}

/**
 * ===========================================================================================
 * THE COMPETITOR RULE. Founder, 2026-07-13. NOT A PREFERENCE — A RULE.
 * ===========================================================================================
 *
 *   "We do not want to mention the travel companies in the destination information cards.
 *    THEY ARE OUR COMPETITION. We strictly just provide names of tour guides."
 *
 * WE WERE PRINTING OUR COMPETITORS ON OUR OWN ITINERARY. Live, on the Guwahati card:
 *   Nexplore Travel        - TRIPADVISOR LISTING | TOUR OPERATOR
 *   Cozy Tours & Travels   - TOUR OPERATOR | ATTOI & TOAA MEMBER
 *   Meghalaya Shillong Tour & Travel (Manik Das) - TOUR OPERATOR
 *
 * A tour operator is a COMPANY THAT SELLS THE TRIP WE ARE SELLING. Handing a traveller their
 * name, on our page, at the moment he is deciding to buy, is not "helpful local information".
 * It is us paying for the lead and giving it away.
 *
 * A GUIDE IS A PERSON. He walks you round a temple for a morning. He is not competition, and
 * naming him is a kindness. THAT is what this card is for.
 *
 * TWO LAYERS, BECAUSE ONE IS NOT ENOUGH:
 *   1. The PROMPT no longer asks for operators (it used to ask for them BY NAME — see below).
 *   2. THIS FILTER, which runs on everything, from the model AND from the cache. A prompt is
 *      a request. A filter is a rule. Models drift; this does not.
 */

/** Words that mean "this is a company", not "this is a person". */
const COMPANY_WORDS = [
  'travel', 'travels', 'tours', 'tour', 'touring', 'holiday', 'holidays', 'trip', 'trips',
  'voyage', 'voyages', 'vacation', 'vacations', 'getaway', 'getaways', 'journey', 'journeys',
  'expedition', 'expeditions', 'adventure', 'adventures', 'safari', 'safaris', 'explore',
  'explorers', 'exploration', 'destination', 'destinations', 'agency', 'agencies', 'operator',
  'operators', 'dmc', 'pvt', 'private limited', 'ltd', 'limited', 'llp', 'inc', 'company',
  'co.', '& co', 'enterprises', 'services', 'solutions', 'hospitality', 'trekking co',
];

/** Trade bodies. Only a COMPANY joins these. A man with a guide licence does not. */
const TRADE_BODIES = ['attoi', 'toaa', 'iato', 'taai', 'adtoi', 'iaao', 'fhrai'];

/**
 * IS THIS A COMPANY? If we are not sure, WE LEAVE IT OUT.
 *
 * The asymmetry is deliberate and it is the whole point: leaving out a real guide costs a
 * traveller a little convenience. Printing a competitor costs us the booking. When the cost
 * of the two mistakes is that different, you do not sit on the fence.
 */
export function looksLikeACompany(name: string, recognition?: string | null): boolean {
  const n = ` ${String(name || '').toLowerCase()} `;
  const r = String(recognition || '').toLowerCase();

  // The recognition field says it outright.
  if (/tour operator|travel agent|travel agency|operator|dmc|agency/.test(r)) return true;
  if (TRADE_BODIES.some((t) => r.includes(t))) return true;

  // The NAME carries a company word. "Nexplore Travel", "Cozy Tours & Travels".
  if (COMPANY_WORDS.some((w) => n.includes(` ${w} `) || n.includes(`${w} `) || n.endsWith(` ${w}`))) {
    return true;
  }
  // "Meghalaya Shillong Tour & Travel (Manik Das)" — a company wearing a man's name in
  // brackets is still a company, and the brackets are not a disguise we are obliged to accept.
  if (/\b(pvt|ltd|llp|inc)\b/.test(n)) return true;

  return false;
}

/** Only individual, named human guides survive. Everything else is our competition. */
export function stripCompanies<T extends { name: string; recognition?: string | null }>(list: T[]): T[] {
  return list.filter((g) => {
    if (!g?.name) return false;
    if (looksLikeACompany(g.name, g.recognition ?? null)) {
      console.log(`[guides] DROPPED "${g.name}" — a tour company, not a guide. Founder rule 2026-07-13.`);
      return false;
    }
    return true;
  });
}

async function readCache(city: string): Promise<GuideSuggestion[] | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT name, languages, phone, email, recognition, rating, source, source_url, verified, pii_flag, fetched_at, ttl_hours
      FROM guide_cache WHERE lower(city)=lower($1)
      ORDER BY verified DESC, rating DESC NULLS LAST LIMIT 6`, city);
    if (!rows.length) return null;
    if (!isFresh(rows[0].fetched_at, Number(rows[0].ttl_hours) || GUIDE_TTL_HOURS)) return null;
    // THE CACHE IS ALREADY POISONED — it holds the operators we should never have asked for.
    // So the rule runs HERE too, on the way out. A filter that only guards the front door is
    // not a rule, it is a hope.
    return stripCompanies(rows.map((r) => ({ name: r.name, languages: Array.isArray(r.languages) ? r.languages : [],
      phone: r.phone, email: r.email, recognition: r.recognition || 'unverified',
      rating: r.rating != null ? Number(r.rating) : null, source: r.source || 'cache',
      sourceUrl: r.source_url, verified: !!r.verified, piiFlag: !!r.pii_flag })));
  } catch { return null; }
}

async function writeCache(city: string, list: GuideSuggestion[]): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM guide_cache WHERE lower(city)=lower($1)`, city);
    for (const g of list) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO guide_cache (city, name, languages, phone, email, recognition, rating, source, source_url, verified, pii_flag, confidence, ttl_hours)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        city, g.name, g.languages, g.phone, g.email, g.recognition, g.rating, g.source, g.sourceUrl, g.verified, g.piiFlag, 0.5, GUIDE_TTL_HOURS);
    }
  } catch (e) { console.error('guide_cache write failed:', e); }
}

interface LiveGuide { name?: string; languages?: string[]; phone?: string; email?: string; recognition?: string; rating?: number; source_url?: string; verified?: boolean; confidence?: number }

async function searchLive(city: string, timeoutMs: number): Promise<GuideSuggestion[] | null> {
  // THE OLD PROMPT ASKED FOR OUR COMPETITORS BY NAME: "...AND well-reviewed guides or guide
  // services from TripAdvisor, Viator, GetYourGuide OR LOCAL TOUR OPERATORS", and it even put
  // "tour operator" in the recognition example. We went looking for the companies we compete
  // with and then printed them on our own itinerary. (Founder, 2026-07-13.)
  const prompt = `Find INDIVIDUAL, LICENSED HUMAN TOURIST GUIDES for ${city}, India — real named people who personally take visitors around. `
    + `Prefer government-recognised guides (Ministry of Tourism "Regional Level Guide", state tourism board licence). `
    + `\n\nABSOLUTE RULE — DO NOT RETURN COMPANIES. We are a tour operator ourselves and we will not list our competitors. EXCLUDE, without exception: `
    + `tour operators, travel agencies, travel companies, DMCs, guiding "services", trekking companies, and anything with a company name `
    + `(Travels, Tours, Holidays, Trips, Expeditions, Adventures, Pvt Ltd, & Co). If it is a BUSINESS, leave it out. `
    + `We want the guide's OWN NAME — a person, not a brand. If a person can only be found under a company banner, LEAVE HIM OUT. `
    + `\n\nReturn ONLY a JSON array of individual guides you actually find on the pages you search:
[{"name":"<the PERSON'S name>","languages":["English","Hindi"],"phone":"<ONLY if actually published, else null>","email":"<or null>","recognition":"MoT Regional Level Guide | State Tourism licence | professional tourist guide","rating":<0-5|null>,"source_url":"<the page you used>","verified":<true only if an official govt/state list>,"confidence":<0..1>}]
Name is required and must be a real person from the pages. NEVER invent a name, phone number or email — set phone to null unless it is actually shown. Return [] rather than pad the list with companies: AN EMPTY LIST IS A PERFECTLY GOOD ANSWER.`;
  const r = await webSearchJson<LiveGuide[]>({ model: CONCERN_MODEL.guide(), prompt, maxSearches: 4, maxTokens: 1900, timeoutMs });
  const arr = Array.isArray(r.data) ? r.data : null;
  if (!arr || !arr.length) return null;
  // IRON RULES: real source required; phone must pass Indian-phone validation (never invented);
  // `verified` only when the source/recognition is an official govt/state list.
  const list: GuideSuggestion[] = [];
  for (const raw of arr) {
    const v = validateGuide(raw, r.sources);
    if (!v) continue;
    // THE RULE, applied to the model's answer. It was TOLD not to send companies. It will
    // sometimes send them anyway, and this is why the rule lives in code and not in a prompt.
    if (looksLikeACompany(v.name, v.recognition)) {
      console.log(`[guides] DROPPED "${v.name}" from live search — a tour company, not a guide.`);
      continue;
    }
    list.push({ name: v.name, languages: v.languages, phone: v.phone, email: v.email,
      recognition: v.recognition, rating: v.rating, source: 'web:anthropic',
      sourceUrl: v.sourceUrl, verified: v.verified, piiFlag: v.piiFlag });
    if (list.length >= 5) break;
  }
  return list.length ? list : null;
}

export interface GuideOpts { allowLive?: boolean; timeoutMs?: number }

export async function findGuides(city: string, opts: GuideOpts = {}): Promise<GuideSuggestion[] | null> {
  const cached = await readCache(city);
  if (cached) return cached;
  if (opts.allowLive !== false) {
    const live = await searchLive(city, opts.timeoutMs ?? 28000);
    if (live) { await writeCache(city, live); return live; }
  }
  await enqueue('guide', { city });
  return null;
}

export async function runGuideJob(key: { city: string }): Promise<boolean> {
  const g = await findGuides(key.city, { allowLive: true, timeoutMs: 32000 });
  return !!(g && g.length);
}
