/**
 * enrichment_jobs — background queue so optimize() can return immediately with
 * cached-or-deterministic data and enqueue the misses. A PM2 worker (worker.ts)
 * drains the queue to fill/refresh the caches (the "learning over time" loop).
 */
import prisma from '@/config/db';

export type JobKind = 'fare' | 'hotel' | 'guide' | 'content' | 'competitor';

export function dedupeKey(kind: JobKind, key: Record<string, any>): string {
  const norm = Object.keys(key).sort().map((k) => `${k}=${String(key[k]).toLowerCase().trim()}`).join('&');
  return `${kind}:${norm}`;
}

/** Idempotent enqueue (best-effort; never throws into the request path). */
export async function enqueue(kind: JobKind, key: Record<string, any>): Promise<void> {
  try {
    const dk = dedupeKey(kind, key);
    await prisma.$executeRaw`
      INSERT INTO enrichment_jobs (kind, job_key, dedupe_key, status)
      VALUES (${kind}, ${JSON.stringify(key)}::jsonb, ${dk}, 'pending')
      ON CONFLICT (dedupe_key) DO UPDATE
        SET status = CASE WHEN enrichment_jobs.status = 'done'
                          THEN enrichment_jobs.status ELSE 'pending' END,
            updated_at = now()`;
  } catch (e) { console.error('enqueue failed (non-fatal):', e); }
}

export interface Job { id: number; kind: JobKind; job_key: any; attempts: number }

/** Claim up to `n` pending jobs (simple: mark running). */
export async function claim(n: number): Promise<Job[]> {
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    UPDATE enrichment_jobs SET status='running', attempts=attempts+1, updated_at=now()
    WHERE id IN (
      SELECT id FROM enrichment_jobs
      WHERE status='pending' OR (status='error' AND attempts < 3)
      ORDER BY created_at ASC LIMIT ${Math.max(1, n)}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, kind, job_key, attempts`);
  return rows.map((r) => ({ id: Number(r.id), kind: r.kind, job_key: r.job_key, attempts: Number(r.attempts) }));
}

export async function complete(id: number, ok: boolean, err?: string): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE enrichment_jobs
      SET status=${ok ? 'done' : 'error'}, last_error=${err ?? null}, updated_at=now()
      WHERE id=${id}`;
  } catch (e) { console.error('job complete update failed:', e); }
}
