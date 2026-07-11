/**
 * hotelFinder — top user-rated hotels per overnight city (cache-first).
 * On miss: Haiku + web search (TripAdvisor & similar) → top-N by rating, each
 * carrying a source_url. Long TTL (~3 weeks) — hotels are near-static.
 */
import prisma from '@/config/db';
import { webSearchJson, CONCERN_MODEL, isFresh } from './core';
import { validateHotel } from './guardrails';
import { enqueue } from './jobs';

const HOTEL_TTL_HOURS = 504;

export type HotelCategory = 'budget' | 'standard' | 'premium' | 'luxury';

export interface HotelSuggestion {
  name: string;
  rating: number | null;
  reviewCount: number | null;
  pricePnMin: number | null;
  pricePnMax: number | null;
  source: string;
  sourceUrl: string | null;
  blurb: string | null;
  rank: number;
}

async function readCache(city: string, category: HotelCategory): Promise<HotelSuggestion[] | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT name, rating, review_count, price_pn_min, price_pn_max, source, source_url, blurb, rank, fetched_at, ttl_hours
      FROM hotel_cache WHERE lower(city)=lower($1) AND category=$2
      ORDER BY rank ASC LIMIT 6`, city, category);
    if (!rows.length) return null;
    if (!isFresh(rows[0].fetched_at, Number(rows[0].ttl_hours) || HOTEL_TTL_HOURS)) return null;
    return rows.map((r) => ({ name: r.name, rating: r.rating != null ? Number(r.rating) : null,
      reviewCount: r.review_count != null ? Number(r.review_count) : null,
      pricePnMin: r.price_pn_min != null ? Number(r.price_pn_min) : null,
      pricePnMax: r.price_pn_max != null ? Number(r.price_pn_max) : null,
      source: r.source || 'cache', sourceUrl: r.source_url, blurb: r.blurb, rank: Number(r.rank) }));
  } catch { return null; }
}

async function writeCache(city: string, category: HotelCategory, list: HotelSuggestion[]): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM hotel_cache WHERE lower(city)=lower($1) AND category=$2`, city, category);
    for (const h of list) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO hotel_cache (city, category, name, rating, review_count, price_pn_min, price_pn_max, source, source_url, blurb, rank, confidence, ttl_hours)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        city, category, h.name, h.rating, h.reviewCount, h.pricePnMin, h.pricePnMax, h.source, h.sourceUrl, h.blurb, h.rank, 0.6, HOTEL_TTL_HOURS);
    }
  } catch (e) { console.error('hotel_cache write failed:', e); }
}

interface LiveHotel { name?: string; rating?: number; review_count?: number; price_pn_min?: number; price_pn_max?: number; source_url?: string; blurb?: string; confidence?: number }

async function searchLive(city: string, category: HotelCategory, timeoutMs: number): Promise<HotelSuggestion[] | null> {
  const catWord = category === 'budget' ? 'well-rated budget' : category === 'premium' ? '4-star premium' : category === 'luxury' ? '5-star luxury' : 'comfortable 3-star';
  const prompt = `Search TripAdvisor / Google / Booking for the highest-rated ${catWord} hotels in ${city}, India. From the pages you find, extract the top 4 real hotels by traveller rating. `
    + `Return ONLY a JSON array of those 4 hotels:
[{"name":"...","rating":<0-5>,"review_count":<int|null>,"price_pn_min":<INR/night per room|null>,"price_pn_max":<int|null>,"source_url":"<the TripAdvisor/Google/Booking page you used>","blurb":"<one line why>","confidence":<0..1>}]
These are real hotels that exist and appear on the pages you searched, so you WILL find them — do not return an empty array unless the city genuinely has no hotels. For source_url, give the ranking/listing page you took each from. Never invent a hotel name or rating.`;
  const r = await webSearchJson<LiveHotel[]>({ model: CONCERN_MODEL.hotel(), prompt, maxSearches: 3, maxTokens: 1800, timeoutMs });
  const arr = Array.isArray(r.data) ? r.data : null;
  if (!arr || !arr.length) return null;
  // IRON RULES: drop any hotel without a real (really-searched) source_url; sanity-check rating/price.
  const list: HotelSuggestion[] = [];
  for (const raw of arr) {
    const v = validateHotel(raw, r.sources);
    if (!v) continue;
    list.push({ name: v.name, rating: v.rating, reviewCount: v.reviewCount, pricePnMin: v.pricePnMin,
      pricePnMax: v.pricePnMax, source: 'web:anthropic', sourceUrl: v.sourceUrl, blurb: v.blurb, rank: list.length + 1 });
    if (list.length >= 4) break;
  }
  return list.length ? list : null;
}

export interface HotelOpts { allowLive?: boolean; timeoutMs?: number }

export async function findHotels(city: string, category: HotelCategory, opts: HotelOpts = {}): Promise<HotelSuggestion[] | null> {
  const cached = await readCache(city, category);
  if (cached) return cached;
  if (opts.allowLive !== false) {
    const live = await searchLive(city, category, opts.timeoutMs ?? 25000);
    if (live) { await writeCache(city, category, live); return live; }
  }
  await enqueue('hotel', { city, category });
  return null;
}

export async function runHotelJob(key: { city: string; category: HotelCategory }): Promise<boolean> {
  const h = await findHotels(key.city, key.category, { allowLive: true, timeoutMs: 30000 });
  return !!(h && h.length);
}
