/**
 * US-869 — THE PERMANENT PARSE CACHE. One traveller's sentence is paid for once, EVER.
 *
 * Founder ruling, 15 Jul 2026: "we cannot endlessly spend money on AI tokens." The
 * in-memory cache (68c9be2) forgets on every deploy and every restart — so the same
 * sentence was paid for again the next morning. This is the disk under it: L1 stays the
 * in-memory map (fast, this process), L2 is this table (permanent, survives restarts).
 *
 * DOCTRINE (US-861): write-on-SUCCESS only. A failed or empty parse is never stored — a
 * model hiccup must retry on the next request, not become the sticky truth about a good
 * sentence forever. And ONLY MODEL parses are stored: a deterministic reading costs
 * nothing to recompute, and storing it would just be a copy of the code's own output.
 *
 * Additive DDL only (migrations/US-869-parse-cache.sql). Every call here is non-fatal
 * by construction: if the table does not exist yet, reads return null and writes log —
 * the planner never breaks on its own cache.
 */

import prisma from '@/config/db';
import { createHash } from 'node:crypto';

/** The sentence, normalised exactly as the in-memory L1 normalises it — the two layers
 *  MUST share one key or a sentence could live twice with two different parses. */
export function parseCacheKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 1000);
}

export function parseCacheHash(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export interface StoredParse<T> {
  parsed: T;
}

/** Read-through. Null = miss (or the table is not there yet — same answer, same cost). */
export async function readStoredParse<T>(hash: string): Promise<T | null> {
  try {
    const rows = await prisma.$queryRaw<{ parsed: T }[]>`
      SELECT parsed FROM planner_parse_cache WHERE sentence_hash = ${hash} LIMIT 1`;
    return rows[0]?.parsed ?? null;
  } catch {
    return null;
  }
}

/** Fire-and-forget: the hit counter is bookkeeping, never on the traveller's path. */
export function bumpParseHit(hash: string): void {
  void prisma.$executeRaw`
    UPDATE planner_parse_cache SET hits = hits + 1, last_hit_at = now()
     WHERE sentence_hash = ${hash}`.catch(() => { /* non-fatal by doctrine */ });
}

/** Write-on-success only — the CALLER enforces "success"; this just persists. */
export async function writeStoredParse(hash: string, sentence: string, parsed: unknown): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO planner_parse_cache (sentence_hash, sentence, parsed)
      VALUES (${hash}, ${sentence.slice(0, 1000)}, ${JSON.stringify(parsed)}::jsonb)
      ON CONFLICT (sentence_hash) DO NOTHING`;
  } catch (e) {
    console.error('US-869 parse cache write failed (non-fatal):', e);
  }
}
