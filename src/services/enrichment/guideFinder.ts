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

async function readCache(city: string): Promise<GuideSuggestion[] | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT name, languages, phone, email, recognition, rating, source, source_url, verified, pii_flag, fetched_at, ttl_hours
      FROM guide_cache WHERE lower(city)=lower($1)
      ORDER BY verified DESC, rating DESC NULLS LAST LIMIT 6`, city);
    if (!rows.length) return null;
    if (!isFresh(rows[0].fetched_at, Number(rows[0].ttl_hours) || GUIDE_TTL_HOURS)) return null;
    return rows.map((r) => ({ name: r.name, languages: Array.isArray(r.languages) ? r.languages : [],
      phone: r.phone, email: r.email, recognition: r.recognition || 'unverified',
      rating: r.rating != null ? Number(r.rating) : null, source: r.source || 'cache',
      sourceUrl: r.source_url, verified: !!r.verified, piiFlag: !!r.pii_flag }));
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
  const prompt = `Find licensed / professional tourist GUIDES or reputable guiding services for ${city}, India. `
    + `Include government-recognised guides (Ministry of Tourism "Regional Level Guide" / state tourism board) where you can find them, AND well-reviewed guides or guide services from TripAdvisor, Viator, GetYourGuide or local tour operators. `
    + `Return ONLY a JSON array of the guides you actually find on the pages you search:
[{"name":"...","languages":["English","Hindi"],"phone":"<ONLY if actually published, else null>","email":"<or null>","recognition":"MoT Regional Level Guide | State Tourism | TripAdvisor listing | tour operator","rating":<0-5|null>,"source_url":"<the page you used>","verified":<true only if an official govt/state list>,"confidence":<0..1>}]
Name is required and must be a real guide/service from the pages. For source_url give the page you used. NEVER invent a name, phone number or email — set phone to null unless it is actually shown. Return [] only if you truly find no guides.`;
  const r = await webSearchJson<LiveGuide[]>({ model: CONCERN_MODEL.guide(), prompt, maxSearches: 4, maxTokens: 1900, timeoutMs });
  const arr = Array.isArray(r.data) ? r.data : null;
  if (!arr || !arr.length) return null;
  // IRON RULES: real source required; phone must pass Indian-phone validation (never invented);
  // `verified` only when the source/recognition is an official govt/state list.
  const list: GuideSuggestion[] = [];
  for (const raw of arr) {
    const v = validateGuide(raw, r.sources);
    if (!v) continue;
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
