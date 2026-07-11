/**
 * Enrichment queue worker — drains enrichment_jobs, filling/refreshing caches so
 * repeat plans are complete and instant. Run as a PM2 process or a cron tick.
 *   bun run src/scripts/enrichment-worker.ts          # continuous
 *   bun run src/scripts/enrichment-worker.ts --once    # single drain (cron)
 *
 * E-1: after each job it also records the outcome into city_enrichment (the durable
 * per-city aggregate the optimizer polls), so the UI goes live without a reload and
 * every city reaches a terminal state (retry ceiling → empty_confirmed / needs_review).
 */
import { claim, complete, type Job } from './jobs';
import { runFareJob } from './fareRefresh';
import { runHotelJob, findHotels } from './hotelFinder';
import { runGuideJob, findGuides } from './guideFinder';
import { runContentJob, findCityContent } from './cityContent';
import { enrichmentEnabled } from './core';
import { runCompetitorJob } from './competitorResearch';
import {
  resolveCityId, ensureCity, completeDimFromJob,
  hotelsToDurable, guidesToDurable, contentToDurable, type Dim,
} from './cityEnrichment';

async function handle(job: Job): Promise<boolean> {
  const k = job.job_key || {};
  switch (job.kind) {
    case 'fare':    return runFareJob({ mode: k.mode, origin: k.origin, dest: k.dest, month: k.month });
    case 'hotel':   return runHotelJob({ city: k.city, category: k.category || 'standard' });
    case 'guide':   return runGuideJob({ city: k.city });
    case 'content': return runContentJob({ city: k.city });
    case 'competitor': return runCompetitorJob({ cityId: k.cityId, city: k.city, keyword: k.keyword }, job.attempts);
    default: return false;
  }
}

const JOB_DIM: Record<string, Dim> = { hotel: 'hotels', guide: 'guides', content: 'content' };

/** Reflect a finished job into city_enrichment. Fare jobs are leg-level → skipped. */
async function recordJobToCity(job: Job, ok: boolean, attempts: number, error: string | null): Promise<void> {
  try {
    const dim = JOB_DIM[job.kind];
    if (!dim) return;
    const city = (job.job_key && job.job_key.city) ? String(job.job_key.city) : '';
    if (!city) return;
    const cityId = await resolveCityId(city);
    if (cityId == null) return;
    await ensureCity(cityId, city);
    if (error) { await completeDimFromJob(cityId, dim, 'error', attempts, { error }); return; }
    if (!ok)   { await completeDimFromJob(cityId, dim, 'empty', attempts); return; }
    // success → pull the just-filled durable payload from the cache the job wrote.
    let durable: any = undefined;
    if (dim === 'hotels') {
      const cat = (job.job_key && job.job_key.category) ? job.job_key.category : 'standard';
      const h = await findHotels(city, cat, { allowLive: false });
      if (h) durable = { hotels: hotelsToDurable(h) };
    } else if (dim === 'guides') {
      const g = await findGuides(city, { allowLive: false });
      if (g) durable = { guides: guidesToDurable(g) };
    } else if (dim === 'content') {
      const c = await findCityContent(city, { allowLive: false });
      if (c) durable = { content: contentToDurable(c) };
    }
    await completeDimFromJob(cityId, dim, 'ready', attempts, { durable, provenance: { [dim]: 'worker' } });
  } catch (e) { console.error('recordJobToCity failed (non-fatal):', e); }
}

/** Drain up to `limit` jobs once. Returns how many were processed. */
export async function drainOnce(limit = 5): Promise<number> {
  if (!enrichmentEnabled()) return 0;
  const jobs = await claim(limit);
  for (const job of jobs) {
    const t0 = Date.now();
    try {
      const ok = await handle(job);
      await complete(job.id, ok, ok ? undefined : 'no result / no source');
      await recordJobToCity(job, ok, job.attempts, null);
      console.log(`[enrichment-worker] ${job.kind} ${JSON.stringify(job.job_key)} → ${ok ? 'done' : 'empty'} (${Date.now() - t0}ms, attempt ${job.attempts})`);
    } catch (e: any) {
      await complete(job.id, false, e?.message || String(e));
      await recordJobToCity(job, false, job.attempts, e?.message || String(e));
      console.log(`[enrichment-worker] ${job.kind} ${JSON.stringify(job.job_key)} → ERROR ${e?.message || e} (${Date.now() - t0}ms)`);
    }
  }
  return jobs.length;
}

/** Continuous loop with idle backoff. */
export async function runWorker(): Promise<void> {
  console.log('[enrichment-worker] started');
  let idle = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const n = await drainOnce(4);
    if (n === 0) { idle = Math.min(idle + 1, 6); await sleep(2000 * idle + 3000); }
    else { idle = 0; await sleep(500); }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
