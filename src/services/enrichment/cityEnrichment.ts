/**
 * city_enrichment store (E-1) — the durable per-city enrichment aggregate + live
 * status that the Route Optimizer polls. Keyed by world_cities.id. Sits ON TOP of
 * the existing name-keyed caches (hotel_cache / guide_cache / city_content) and the
 * enrichment_jobs queue; it does not replace them, it makes their per-city outcome
 * durable, decisive and observable.
 *
 * Design invariants (spec §2):
 *  - City is the durable unit (enrich once, reuse forever).
 *  - Every city resolves to a terminal state; nothing spins forever (retry ceiling).
 *  - Human overlay (`manual`/`decision`) is authoritative and never clobbered here.
 *  - Tenant-agnostic signatures.
 */
import prisma from '@/config/db';

export type Dim = 'hotels' | 'guides' | 'content' | 'cost';
export type DimStatus = 'pending' | 'running' | 'ready' | 'empty_confirmed' | 'failed';
export type CityStatus =
  | 'pending' | 'enriching' | 'partial' | 'ready'
  | 'empty_confirmed' | 'needs_review' | 'needs_refresh'
  | 'manual' | 'dropped' | 'stopover';

const TERMINAL_DIM = new Set<DimStatus>(['ready', 'empty_confirmed', 'failed']);
const CITY_TERMINAL = new Set<CityStatus>(['ready', 'empty_confirmed', 'needs_review', 'manual', 'dropped', 'stopover']);
/** enrichment_jobs.claim() stops reclaiming at attempts >= 3, so 3 is the terminal ceiling. */
const RETRY_CEILING = 3;

// ---- name -> world_cities.id (deterministic so API + worker agree) -----------
const idCache = new Map<string, number | null>();
export async function resolveCityId(name: string): Promise<number | null> {
  const raw = (name || '').trim();
  if (!raw) return null;
  const k = raw.toLowerCase();
  if (idCache.has(k)) return idCache.get(k) as number | null;
  let id: number | null = null;
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM world_cities WHERE lower(name)=lower($1)
         ORDER BY ("countryCode" = 'IN') DESC, COALESCE(population,0) DESC, id ASC LIMIT 1`, raw);
    const r = Array.isArray(rows) ? rows[0] : null;
    id = r && r.id != null ? Number(r.id) : null;
  } catch (e) { id = null; }
  idCache.set(k, id);
  return id;
}

// ---- overall status derivation ----------------------------------------------
function overall(d: Record<Dim, DimStatus>, decision: string): CityStatus {
  if (decision === 'manual') return 'manual';
  if (decision === 'dropped') return 'dropped';
  if (decision === 'stopover') return 'stopover';
  const vals: DimStatus[] = [d.hotels, d.guides, d.content, d.cost];
  const allTerminal = vals.every((v) => TERMINAL_DIM.has(v));
  const anyFailed = vals.some((v) => v === 'failed');
  const anyReady = vals.some((v) => v === 'ready');
  if (allTerminal) {
    if (anyFailed) return 'needs_review';
    if (anyReady) return 'ready';          // all ready, or ready+empty mix → usable
    return 'empty_confirmed';              // every dim genuinely empty
  }
  if (vals.some((v) => v === 'ready' || v === 'empty_confirmed')) return 'partial';
  return 'enriching';
}

function noteFromDims(name: string, d: Record<Dim, DimStatus>): string {
  const order: Dim[] = ['hotels', 'guides', 'content'];
  const parts = order.map((k) => {
    const s = d[k];
    if (s === 'ready') return `${k} ✓`;
    if (s === 'empty_confirmed') return `no ${k} found`;
    if (s === 'failed') return `${k} failed`;
    if (s === 'running') return `finding ${k}…`;
    return `${k} queued`;
  });
  return `${name || 'city'}: ${parts.join(' · ')}`;
}

function asObj(x: any): Record<string, any> { return (x && typeof x === 'object' && !Array.isArray(x)) ? x : {}; }
function mergeJson(base: any, patch?: Record<string, any>): Record<string, any> {
  const b = asObj(base);
  if (!patch) return b;
  return { ...b, ...patch };
}

// ---- row lifecycle -----------------------------------------------------------
export async function ensureCity(cityId: number, name: string): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO city_enrichment (city_id, city_name, status, progress_note)
         VALUES ($1,$2,'pending',$3)
       ON CONFLICT (city_id) DO UPDATE
         SET city_name = COALESCE(city_enrichment.city_name, EXCLUDED.city_name)`,
      cityId, name, `${name}: queued`);
  } catch (e) { console.error('ensureCity failed:', e); }
}

async function readRow(cityId: number): Promise<any | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM city_enrichment WHERE city_id=$1 LIMIT 1`, cityId);
    return Array.isArray(rows) ? (rows[0] || null) : null;
  } catch { return null; }
}

export interface DimUpdate {
  durable?: Record<string, any>;
  perishable?: Record<string, any>;
  provenance?: Record<string, any>;
  error?: string | null;
  attempts?: number;
  markRefreshed?: boolean;
}

/**
 * Authoritative per-dimension setter. Recomputes overall status + progress note.
 * Guards against downgrading a terminal/manual dim with a non-authoritative
 * pending/running write (so a fresh cache-miss never wipes a prior 'ready').
 */
export async function setDim(cityId: number, dim: Dim, status: DimStatus, upd: DimUpdate = {}): Promise<void> {
  const row = await readRow(cityId);
  if (!row) return;
  const dims: Record<Dim, DimStatus> = {
    hotels: row.dim_hotels, guides: row.dim_guides, content: row.dim_content, cost: row.dim_cost,
  };
  const cur = dims[dim];
  if ((status === 'pending' || status === 'running') && TERMINAL_DIM.has(cur)) return; // no downgrade
  dims[dim] = status;
  const decision = row.decision || 'none';
  const st = overall(dims, decision);
  const note = noteFromDims(row.city_name || '', dims);
  const durable = mergeJson(row.durable, upd.durable);
  const perishable = mergeJson(row.perishable, upd.perishable);
  const provenance = mergeJson(row.source_provenance, upd.provenance);
  const firstAt = row.first_enriched_at || (status === 'ready' ? new Date() : null);
  const attempts = upd.attempts != null ? upd.attempts : (row.attempts || 0);
  const lastErr = upd.error !== undefined ? upd.error : (row.last_error ?? null);
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE city_enrichment SET
         dim_hotels=$2, dim_guides=$3, dim_content=$4, dim_cost=$5,
         status=$6, progress_note=$7,
         durable=$8::jsonb, perishable=$9::jsonb, source_provenance=$10::jsonb,
         last_error=$11, attempts=$12, first_enriched_at=$13, updated_at=now()${upd.markRefreshed ? ', refreshed_at=now()' : ''}
       WHERE city_id=$1`,
      cityId, dims.hotels, dims.guides, dims.content, dims.cost,
      st, note,
      JSON.stringify(durable), JSON.stringify(perishable), JSON.stringify(provenance),
      lastErr, attempts, firstAt);
  } catch (e) { console.error('setDim failed:', e); }
}

/** Worker completion → maps job outcome to a dim status with the retry ceiling. */
export async function completeDimFromJob(
  cityId: number, dim: Dim, outcome: 'ready' | 'empty' | 'error', attempts: number,
  opts: { durable?: any; provenance?: any; error?: string } = {},
): Promise<void> {
  let status: DimStatus;
  if (outcome === 'ready') status = 'ready';
  else if (outcome === 'empty') status = attempts >= RETRY_CEILING ? 'empty_confirmed' : 'running';
  else status = attempts >= RETRY_CEILING ? 'failed' : 'running';
  await setDim(cityId, dim, status, {
    durable: opts.durable, provenance: opts.provenance,
    error: outcome === 'error' ? (opts.error || 'enrichment error') : null,
    attempts,
  });
}

// ---- durable payload mappers (mirror route-optimizer CityEnrichment shape) ---
export function hotelsToDurable(list: any[]): any[] {
  return (list || []).map((h) => ({
    name: h.name, rating: h.rating ?? null, reviewCount: h.reviewCount ?? null,
    pricePnMin: h.pricePnMin ?? null, pricePnMax: h.pricePnMax ?? null,
    source: h.source, sourceUrl: h.sourceUrl ?? null, blurb: h.blurb ?? null, rank: h.rank,
    ta_location_id: null, star: null,
  }));
}
export function guidesToDurable(list: any[]): any[] {
  return (list || []).map((g) => ({
    name: g.name, languages: g.languages || [], phone: g.phone ?? null, email: g.email ?? null,
    recognition: g.recognition, rating: g.rating ?? null, source: g.source,
    sourceUrl: g.sourceUrl ?? null, verified: !!g.verified, piiFlag: !!g.piiFlag,
  }));
}
export function contentToDurable(c: any): any {
  if (!c) return undefined;
  return {
    intro: c.intro ?? null, attractions: c.attractions || [],
    itineraryBody: c.itineraryBody ?? null, bestTime: c.bestTime ?? null,
    uniqueFacts: c.uniqueFacts || [], sources: c.sources || [],
  };
}

// ---- requisition from optimize (dedupe cities across A/B/alternate plans) -----
/**
 * Called once by the optimize controller after the enrichment pass. Resolves each
 * distinct overnight city to its world_cities.id, stamps `cityId` onto every plan's
 * CityEnrichment (so the client can poll), and writes the initial city_enrichment
 * row + per-dimension state from what the cache already served this run.
 */
export async function requisitionPlansEnrichment(plans: any[]): Promise<void> {
  const byCity = new Map<string, { name: string; refs: any[]; hotels?: any; guides?: any; content?: any; cost?: any }>();
  for (const p of (plans || [])) {
    const cost = p && p.enrichment ? p.enrichment.tripCost : null;
    const cities = (p && p.enrichment && Array.isArray(p.enrichment.cities)) ? p.enrichment.cities : [];
    for (const c of cities) {
      const key = String(c.city || '').trim().toLowerCase();
      if (!key) continue;
      let e = byCity.get(key);
      if (!e) { e = { name: c.city, refs: [] }; byCity.set(key, e); }
      e.refs.push(c);
      if (!e.hotels && c.hotels) e.hotels = c.hotels;
      if (!e.guides && c.guides) e.guides = c.guides;
      if (!e.content && c.content) e.content = c.content;
      if (!e.cost && cost) e.cost = cost;
    }
  }
  for (const e of byCity.values()) {
    let cityId: number | null = null;
    try { cityId = await resolveCityId(e.name); } catch { cityId = null; }
    for (const ref of e.refs) ref.cityId = cityId;   // FE poll key
    if (cityId == null) continue;
    await ensureCity(cityId, e.name);
    if (e.hotels) await setDim(cityId, 'hotels', 'ready', { durable: { hotels: hotelsToDurable(e.hotels) }, provenance: { hotels: 'cache' } });
    else await setDim(cityId, 'hotels', 'running');
    if (e.guides) await setDim(cityId, 'guides', 'ready', { durable: { guides: guidesToDurable(e.guides) }, provenance: { guides: 'cache' } });
    else await setDim(cityId, 'guides', 'running');
    if (e.content) await setDim(cityId, 'content', 'ready', { durable: { content: contentToDurable(e.content) }, provenance: { content: 'cache' } });
    else await setDim(cityId, 'content', 'running');
    if (e.cost) await setDim(cityId, 'cost', 'ready', { durable: { cost: {
      perPersonMin: e.cost.perPersonMin, perPersonMax: e.cost.perPersonMax, currency: e.cost.currency,
      tier: e.cost.tier, indicative: e.cost.indicative } }, provenance: { cost: 'model' } });
    else await setDim(cityId, 'cost', 'ready', { provenance: { cost: 'model' } });
  }
}

// ---- read for the poll endpoint (spec §8) -----------------------------------
function shapeCity(r: any): any {
  const durable = asObj(r.durable);
  const manual = asObj(r.manual);
  return {
    cityId: Number(r.city_id),
    city: r.city_name || null,
    status: r.status,
    dims: { hotels: r.dim_hotels, guides: r.dim_guides, content: r.dim_content, cost: r.dim_cost },
    progressNote: r.progress_note || null,
    decision: r.decision || 'none',
    updatedMs: r.updated_ms != null ? Number(r.updated_ms) : null,
    terminal: CITY_TERMINAL.has(r.status),
    // convenience mirrors of CityEnrichment for a trivial client merge
    hotels: Array.isArray(durable.hotels) ? durable.hotels : undefined,
    guides: Array.isArray(durable.guides) ? durable.guides : undefined,
    content: durable.content || undefined,
    tripCost: durable.cost || undefined,
    manual: Object.keys(manual).length ? manual : undefined,
  };
}

export async function snapshot(cityIds: number[]): Promise<any[]> {
  const ids = (cityIds || []).map((n) => Math.trunc(Number(n))).filter((n) => Number.isFinite(n) && n > 0);
  if (!ids.length) return [];
  const inList = Array.from(new Set(ids)).join(',');
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT city_id, city_name, status, dim_hotels, dim_guides, dim_content, dim_cost,
              progress_note, durable, perishable, manual, decision,
              (extract(epoch from updated_at)*1000)::bigint AS updated_ms
         FROM city_enrichment WHERE city_id IN (${inList})`);
    return (Array.isArray(rows) ? rows : []).map(shapeCity);
  } catch (e) { console.error('snapshot failed:', e); return []; }
}
