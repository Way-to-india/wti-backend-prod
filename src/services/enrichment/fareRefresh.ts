/**
 * fareRefresh — live fares (flight/train) with a rolling NON-SEASON learning avg.
 *
 * Resolution order for a leg (mode, origin, dest, month):
 *   1. fresh fare_cache row for that month           → serve (real)
 *   2. live web search (Haiku)                        → serve + write cache
 *                                                       + update fare_learning
 *   3. learned non-season average (fare_learning)     → serve (learned fallback)
 *   4. null                                           → caller keeps estCostPp
 *
 * "Search each time" for dynamic fares is honoured by a short cache TTL (48h) and
 * a live search on miss; "save average non-season fare over time" is the
 * fare_learning incremental mean, updated only from NON-PEAK observations.
 */
import prisma from '@/config/db';
import { webSearchJson, CONCERN_MODEL, isPeakMonth, currentMonthIST, isFresh } from './core';
import { validateFare } from './guardrails';
import { enqueue } from './jobs';

const FARE_TTL_HOURS = 720;   // 30 days (approximate fares acceptable) [cost-audit]

export interface FareResult {
  min: number;
  max: number;
  currency: string;
  serviceId?: string | null;
  source: string;
  sourceUrl?: string | null;
  confidence: number;
  origin: 'cache' | 'live' | 'learned';
}

// ---- reads -------------------------------------------------------------------
async function readCache(mode: string, origin: string, dest: string, month: number): Promise<FareResult | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT fare_pp_min, fare_pp_max, currency, service_id, source, source_url, confidence, fetched_at, ttl_hours
      FROM fare_cache
      WHERE mode=$1 AND lower(origin_city)=lower($2) AND lower(dest_city)=lower($3) AND travel_month=$4
      ORDER BY fetched_at DESC LIMIT 1`, mode, origin, dest, month);
    const r = rows[0];
    if (!r || r.fare_pp_min == null) return null;
    if (!isFresh(r.fetched_at, Number(r.ttl_hours) || FARE_TTL_HOURS)) return null;
    return { min: Number(r.fare_pp_min), max: Number(r.fare_pp_max), currency: r.currency || 'INR',
      serviceId: r.service_id, source: r.source || 'cache', sourceUrl: r.source_url,
      confidence: Number(r.confidence) || 0.5, origin: 'cache' };
  } catch { return null; }
}

async function readLearned(mode: string, origin: string, dest: string): Promise<FareResult | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT avg_pp_min, avg_pp_max, currency, samples FROM fare_learning
      WHERE mode=$1 AND lower(origin_city)=lower($2) AND lower(dest_city)=lower($3) AND cabin='DEFAULT'
      LIMIT 1`, mode, origin, dest);
    const r = rows[0];
    if (!r || r.avg_pp_min == null || Number(r.samples) < 1) return null;
    return { min: Math.round(Number(r.avg_pp_min)), max: Math.round(Number(r.avg_pp_max)), currency: r.currency || 'INR',
      source: `learned-avg(n=${r.samples})`, sourceUrl: null, confidence: Math.min(0.6, 0.3 + Number(r.samples) * 0.05), origin: 'learned' };
  } catch { return null; }
}

// ---- writes ------------------------------------------------------------------
async function writeCache(mode: string, origin: string, dest: string, month: number, f: FareResult): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO fare_cache (mode, origin_city, dest_city, service_id, travel_month, is_peak, fare_pp_min, fare_pp_max, currency, source, source_url, confidence, ttl_hours)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      mode, origin, dest, f.serviceId ?? null, month, isPeakMonth(month), f.min, f.max, f.currency, f.source, f.sourceUrl ?? null, f.confidence, FARE_TTL_HOURS);
  } catch (e) { console.error('fare_cache write failed:', e); }
}

/** Incremental mean update — ONLY for non-peak observations (the learning core). */
async function updateLearning(mode: string, origin: string, dest: string, month: number, min: number, max: number, currency: string): Promise<void> {
  if (isPeakMonth(month)) return; // learning average excludes peak-season fares
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO fare_learning (mode, origin_city, dest_city, cabin, samples, avg_pp_min, avg_pp_max, last_pp_min, last_pp_max, currency)
      VALUES ($1,$2,$3,'DEFAULT',1,$4,$5,$4,$5,$6)
      ON CONFLICT (mode, lower(origin_city), lower(dest_city), cabin) DO UPDATE SET
        avg_pp_min = (fare_learning.avg_pp_min * fare_learning.samples + $4) / (fare_learning.samples + 1),
        avg_pp_max = (fare_learning.avg_pp_max * fare_learning.samples + $5) / (fare_learning.samples + 1),
        samples    = fare_learning.samples + 1,
        last_pp_min = $4, last_pp_max = $5, updated_at = now()`,
      mode, origin, dest, min, max, currency);
  } catch (e) { console.error('fare_learning update failed:', e); }
}

// ---- live search -------------------------------------------------------------
interface LiveFare { fare_pp_min?: number; fare_pp_max?: number; currency?: string; service_id?: string; source_url?: string; confidence?: number }

async function searchLive(mode: string, origin: string, dest: string, month: number, pax: number, timeoutMs: number): Promise<FareResult | null> {
  const monthName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month - 1];
  const modeWord = mode === 'AIR' ? 'economy-class flight' : 'AC (3A/2A) train';
  const prompt = `Find the current typical PER-PERSON one-way ${modeWord} fare from ${origin} to ${dest}, India, for travel in ${monthName}. `
    + `Search live sources (airline/IRCTC/aggregator pages). Return ONLY JSON:
{"fare_pp_min": <int INR>, "fare_pp_max": <int INR>, "currency": "INR", "service_id": "<flight or train no if seen, else null>", "source_url": "<the page you used>", "confidence": <0..1>}
Rules: numbers are INR per person; if you cannot find a real quote, return {"fare_pp_min":null}. Do not guess.`;
  const r = await webSearchJson<LiveFare>({ model: CONCERN_MODEL.fare(), prompt, maxSearches: 3, maxTokens: 900, timeoutMs });
  // IRON RULES: source mandatory + must be a really-searched URL + numeric sanity.
  const v = validateFare(mode as 'AIR' | 'RAIL', (r.data || {}) as any, r.sources);
  if (!v) return null; // failed validation → caller uses learned avg / estCostPp
  return { min: v.min, max: v.max, currency: v.currency, serviceId: v.serviceId,
    source: 'web:anthropic', sourceUrl: v.sourceUrl, confidence: v.confidence, origin: 'live' };
}

// ---- public: resolve one leg's fare -----------------------------------------
export interface ResolveOpts { month?: number; pax?: number; allowLive?: boolean; timeoutMs?: number }

export async function resolveFare(mode: 'AIR' | 'RAIL', origin: string, dest: string, opts: ResolveOpts = {}): Promise<FareResult | null> {
  const month = opts.month && opts.month >= 1 && opts.month <= 12 ? opts.month : currentMonthIST();
  const pax = opts.pax ?? 2;

  const cached = await readCache(mode, origin, dest, month);
  if (cached) return cached;

  if (opts.allowLive !== false) {
    const live = await searchLive(mode, origin, dest, month, pax, opts.timeoutMs ?? 25000);
    if (live) {
      await writeCache(mode, origin, dest, month, live);
      await updateLearning(mode, origin, dest, month, live.min, live.max, live.currency);
      return live;
    }
  }

  const learned = await readLearned(mode, origin, dest);
  if (learned) return learned;

  // couldn't serve fresh → enqueue a background fill and let caller use estCostPp
  await enqueue('fare', { mode, origin, dest, month });
  return null;
}

/** Worker entry: fill a fare job (always allows live). A cached/learned hit is a
 *  legitimate fill too — only a total miss is a failure. */
export async function runFareJob(key: { mode: 'AIR' | 'RAIL'; origin: string; dest: string; month?: number }): Promise<boolean> {
  const f = await resolveFare(key.mode, key.origin, key.dest, { month: key.month, allowLive: true, timeoutMs: 30000 });
  return !!f;
}
