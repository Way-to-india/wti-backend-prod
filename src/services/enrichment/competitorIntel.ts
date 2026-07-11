/**
 * competitor_intel store — per-destination SERP competitor espionage, cached with
 * the search date and refreshed on a TTL. Keyed by the marquee destination's
 * world_cities.id. Sits alongside city_enrichment; consumed by the Route Optimizer.
 *
 * Anti-hallucination iron rule (inherited from the enrichment layer): every
 * competitor and every price/hotel fact must carry a real source_url; nothing is
 * invented. The research pipeline (competitorResearch.ts) enforces it; this store
 * only persists what the pipeline verified.
 */
import prisma from '@/config/db';
import { resolveCityId } from './cityEnrichment';

export type CompStatus = 'pending' | 'researching' | 'ready' | 'empty_confirmed' | 'needs_review';
export const COMP_RETRY_CEILING = 3;
const TERMINAL = new Set<CompStatus>(['ready', 'empty_confirmed', 'needs_review']);

export function defaultKeyword(city: string): string { return `${(city || '').trim()} tour packages`; }

/** Marquee destination of a plan = the city with the most overnight stays (tie → later in the route,
 *  which is usually the deeper destination rather than the arrival gateway). */
export function pickMarquee(plan: any): { city: string; nights: number } | null {
  const nights = new Map<string, number>();
  const order: string[] = [];
  for (const d of (plan && Array.isArray(plan.days) ? plan.days : [])) {
    const c = d && d.city ? String(d.city) : '';
    if (!c) continue;
    if (!nights.has(c)) { nights.set(c, 0); order.push(c); }
    nights.set(c, (nights.get(c) || 0) + 1);
  }
  if (!order.length) return null;
  let best = order[0];
  for (const c of order) if ((nights.get(c) || 0) >= (nights.get(best) || 0)) best = c; // >= → last max
  return { city: best, nights: nights.get(best) || 1 };
}

function asObj(x: any): Record<string, any> { return (x && typeof x === 'object' && !Array.isArray(x)) ? x : {}; }
function asArr(x: any): any[] { return Array.isArray(x) ? x : []; }

async function readRow(cityId: number): Promise<any | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM competitor_intel WHERE city_id=$1 LIMIT 1`, cityId);
    return Array.isArray(rows) ? (rows[0] || null) : null;
  } catch { return null; }
}

export function isStale(row: any | null): boolean {
  if (!row) return true;
  if (row.status === 'researching') return false;           // already in flight
  if (row.status === 'needs_review') return (row.attempts || 0) < (row.max_attempts || COMP_RETRY_CEILING);
  if (!row.researched_at) return row.status !== 'empty_confirmed';
  const ageMs = Date.now() - new Date(row.researched_at).getTime();
  return ageMs > (Number(row.ttl_days) || 14) * 86400 * 1000;
}

export async function ensureRow(cityId: number, city: string, keyword: string): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO competitor_intel (city_id, city_name, keyword, status, progress_note)
         VALUES ($1,$2,$3,'pending',$4)
       ON CONFLICT (city_id) DO UPDATE
         SET city_name = COALESCE(competitor_intel.city_name, EXCLUDED.city_name),
             keyword   = COALESCE(NULLIF(EXCLUDED.keyword,''), competitor_intel.keyword)`,
      cityId, city, keyword, `${city}: competitor scan queued`);
  } catch (e) { console.error('competitor ensureRow failed:', e); }
}

export async function setProgress(cityId: number, status: CompStatus, note: string,
  opts: { attempts?: number; error?: string | null } = {}): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE competitor_intel SET status=$2, progress_note=$3,
         attempts=COALESCE($4, attempts), last_error=$5, updated_at=now() WHERE city_id=$1`,
      cityId, status, note, opts.attempts != null ? opts.attempts : null, opts.error ?? null);
  } catch (e) { console.error('competitor setProgress failed:', e); }
}

export async function writePartialCompetitors(cityId: number, competitors: any[], note: string): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE competitor_intel SET competitors=$2::jsonb, progress_note=$3, status='researching', updated_at=now() WHERE city_id=$1`,
      cityId, JSON.stringify(competitors || []), note);
  } catch (e) { console.error('competitor writePartial failed:', e); }
}

export async function writeResult(cityId: number, payload: {
  competitors: any[]; synthesis: any; recommendation: any; sourceUrls: string[]; keyword?: string;
}): Promise<void> {
  const hasData = (payload.competitors || []).length > 0;
  const status: CompStatus = hasData ? 'ready' : 'empty_confirmed';
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE competitor_intel SET
         competitors=$2::jsonb, synthesis=$3::jsonb, recommendation=$4::jsonb, source_urls=$5::jsonb,
         status=$6, progress_note=$7, researched_at=now(), last_error=NULL, updated_at=now()
       WHERE city_id=$1`,
      cityId, JSON.stringify(payload.competitors || []), JSON.stringify(payload.synthesis || {}),
      JSON.stringify(payload.recommendation || {}), JSON.stringify(payload.sourceUrls || []),
      status, hasData ? `${payload.competitors.length} competitors analysed` : 'no ranking competitors found');
  } catch (e) { console.error('competitor writeResult failed:', e); }
}

/** Terminal failure after the retry ceiling. */
export async function markFailure(cityId: number, attempts: number, error: string): Promise<void> {
  const terminal = attempts >= COMP_RETRY_CEILING;
  await setProgress(cityId, terminal ? 'needs_review' : 'researching',
    terminal ? 'automatic scan failed — retry or check manually' : 'scan hit an error, will retry',
    { attempts, error });
}

// ---- snapshot for the poll endpoint -----------------------------------------
function shape(r: any): any {
  return {
    cityId: Number(r.city_id),
    city: r.city_name || null,
    keyword: r.keyword || null,
    status: r.status,
    progressNote: r.progress_note || null,
    competitors: asArr(r.competitors),
    synthesis: asObj(r.synthesis),
    recommendation: asObj(r.recommendation),
    sourceUrls: asArr(r.source_urls),
    researchedAt: r.researched_at ? new Date(r.researched_at).toISOString() : null,
    updatedMs: r.updated_ms != null ? Number(r.updated_ms) : null,
    terminal: TERMINAL.has(r.status),
  };
}

export async function snapshot(cityIds: number[]): Promise<any[]> {
  const ids = (cityIds || []).map((n) => Math.trunc(Number(n))).filter((n) => Number.isFinite(n) && n > 0);
  if (!ids.length) return [];
  const inList = Array.from(new Set(ids)).join(',');
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT city_id, city_name, keyword, status, progress_note, competitors, synthesis, recommendation,
              source_urls, researched_at, (extract(epoch from updated_at)*1000)::bigint AS updated_ms
         FROM competitor_intel WHERE city_id IN (${inList})`);
    return (Array.isArray(rows) ? rows : []).map(shape);
  } catch (e) { console.error('competitor snapshot failed:', e); return []; }
}

// ---- requisition from optimize ----------------------------------------------
import { enqueue } from './jobs';

/**
 * Called by the optimize controller. Picks the marquee destination per plan, stamps
 * `competitorTarget` (cityId + keyword) onto every plan, ensures the row, and enqueues
 * a background research job when the cache is absent/stale. Serves cache instantly meanwhile.
 */
export async function requisitionCompetitorIntel(plans: any[], overrideKeyword?: string): Promise<void> {
  // marquee is the same city set across A/B/alternates → resolve once
  let cityId: number | null = null;
  let marqueeCity = '';
  for (const p of (plans || [])) {
    const m = pickMarquee(p);
    if (m) { marqueeCity = m.city; break; }
  }
  if (!marqueeCity) return;
  try { cityId = await resolveCityId(marqueeCity); } catch { cityId = null; }
  const keyword = (overrideKeyword && overrideKeyword.trim()) || defaultKeyword(marqueeCity);
  for (const p of (plans || [])) p.competitorTarget = { cityId, city: marqueeCity, keyword };
  if (cityId == null) return;
  await ensureRow(cityId, marqueeCity, keyword);
  const row = await readRow(cityId);
  if (isStale(row)) {
    await enqueue('competitor', { cityId, city: marqueeCity, keyword });
    if (row && row.status !== 'researching') await setProgress(cityId, 'researching', `${marqueeCity}: scanning ranking competitors…`);
  }
}

/** Explicit exec-triggered research (force + custom keyword). */
export async function triggerResearch(cityId: number, city: string, keyword: string, force: boolean): Promise<void> {
  await ensureRow(cityId, city, keyword);
  const row = await readRow(cityId);
  if (force || isStale(row)) {
    await enqueue('competitor', { cityId, city, keyword });
    await setProgress(cityId, 'researching', `${city}: scanning ranking competitors…`);
  }
}
