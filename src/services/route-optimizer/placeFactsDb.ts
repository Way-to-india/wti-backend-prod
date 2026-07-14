/**
 * US-840 — the curated place facts the four gates read: SEASONS (verified closures and
 * yatra windows — never an invented "best time") and ACCESS (the trek/steps/climb it takes
 * to actually reach a shrine — the body gate's evidence).
 *
 * Both tables are SEEDS, not surveys — the regions.ts doctrine: hand-curated, every row
 * carrying its evidence, founder-tickable (`approved_by`). The absence of a row means
 * "we do not know", which gates NOTHING. Built by migrations/US-840-place-facts.sql.
 *
 * DB layer; proposalGates.ts stays pure and is handed these rows by the controller.
 */
import prisma from '@/config/db';
import type { SeasonFact, AccessFact } from './proposalGates';

export async function loadSeasonFacts(placeNames: string[]): Promise<SeasonFact[]> {
  const names = placeNames.map((n) => n.trim().toLowerCase()).filter(Boolean);
  if (!names.length) return [];
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT place_name, kind, months, note FROM place_seasons
        WHERE lower(place_name) = ANY($1::text[])`, names);
    return rows.map((r) => ({
      place: String(r.place_name),
      kind: String(r.kind) as SeasonFact['kind'],
      months: (r.months ?? []).map((m: unknown) => Number(m)),
      note: String(r.note),
    }));
  } catch (e) {
    console.error('loadSeasonFacts failed (non-fatal — no season gates):', e);
    return [];
  }
}

export async function loadAccessFacts(placeNames: string[]): Promise<AccessFact[]> {
  const names = placeNames.map((n) => n.trim().toLowerCase()).filter(Boolean);
  if (!names.length) return [];
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT place_name, access, magnitude, note FROM place_access
        WHERE lower(place_name) = ANY($1::text[])`, names);
    return rows.map((r) => ({
      place: String(r.place_name),
      access: String(r.access) as AccessFact['access'],
      magnitude: r.magnitude == null ? null : String(r.magnitude),
      note: String(r.note),
    }));
  } catch (e) {
    console.error('loadAccessFacts failed (non-fatal — no body-access gates):', e);
    return [];
  }
}
