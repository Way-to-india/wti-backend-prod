/**
 * DB layer for US-804 — the designers' memory. Kept SEPARATE from the pure
 * designerMemory.ts so the engine core stays dependency-free (same doctrine as
 * anchors.ts / anchorsDb.ts).
 *
 * The two tables are BUILT BY SQL FROM THE LIVING CATALOGUE, not imported from a CSV.
 * The committed CSVs are a snapshot; they go stale the moment a designer publishes a
 * tour. tour_cities is the source of truth, and it keeps growing. (The derivation was
 * proved correct by reproducing the CSV exactly: Agra-Delhi 37, Delhi-Jaipur 29,
 * Agra-Jaipur 26 — 504 pairs across 111 cities.)
 *
 * Rebuild:  psql "$DSN" -f migrations/US-804-designer-memory.sql
 *
 * A NOTE ON THE TWO TIERS, because they are not the same grade of evidence:
 *   designer_cooccurrence   — our designers' own hand (tour_cities). Tier 1.
 *   designer_typical_nights — a MODEL'S PARSE of their itineraries (tour_stays is 100%
 *                             `ai_backfill`). Verified against the human day count
 *                             (98.9% within one night), but a parse all the same.
 */
import prisma from '@/config/db';
import type { DesignerMemory, DesignerPair, TypicalNights } from './designerMemory';
import { EMPTY_MEMORY } from './designerMemory';

/**
 * Load the whole memory. It is small — 504 pairs, 157 towns — so we take it in one
 * read and hand it to the pure engine, rather than letting the engine query per city.
 */
export async function loadDesignerMemory(): Promise<DesignerMemory> {
  try {
    const [pairRows, nightRows] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT city, pairs_with, designed_together
           FROM designer_cooccurrence
          ORDER BY designed_together DESC`),
      prisma.$queryRawUnsafe<any[]>(
        `SELECT city, typical_nights, times_designed, reconciled, agreement_rate
           FROM designer_typical_nights`),
    ]);

    const pairs: DesignerPair[] = pairRows.map((r) => ({
      city: String(r.city),
      pairsWith: String(r.pairs_with),
      designedTogether: Number(r.designed_together) || 0,
      tier: 'designer_catalogue',
    }));

    const nights: TypicalNights[] = nightRows.map((r) => ({
      city: String(r.city),
      nights: Number(r.typical_nights) || 0,
      timesDesigned: Number(r.times_designed) || 0,
      tier: 'catalogue_ai_parsed',
      // The verification flag travels WITH the fact. A consumer cannot accidentally use
      // an unreconciled night count without having been handed the reason not to.
      reconciled: r.reconciled === true,
      agreementRate: r.agreement_rate == null ? null : Number(r.agreement_rate),
    }));

    return { pairs, nights };
  } catch (e) {
    // A missing memory is a THINNER plan, never a wrong one. The Designer falls to
    // Tier 2 (transport + attraction density), which works everywhere — including where
    // we have never sold — and it says so out loud.
    console.error('loadDesignerMemory failed:', e);
    return EMPTY_MEMORY;
  }
}
