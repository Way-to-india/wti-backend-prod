/**
 * ELIGIBILITY, the DB side. Same doctrine as spineDb/themePool: this file reads, the
 * controller injects, the engine stays pure and testable.
 *
 * 94 rows, each carrying its own sources, confidence and re-verify date. Rows the
 * researcher could not verify are stored with UNKNOWN fields rather than plausible guesses,
 * so an empty answer here means "not proven", never "no restriction".
 */
import prisma from '@/config/db';
import type { EligibilityFact } from './eligibility';

function altOf(extra: any): string | null {
  if (!extra || typeof extra !== 'object') return null;
  return extra.foreign_alternative
      ?? extra.viewing_alternatives_for_barred_guests
      ?? extra.rath_yatra_exception
      ?? null;
}

/** Facts for a set of place names. Matching is on lower(place) with a light contains
 *  fallback, because our stop is "Puri" while the record may read "Puri (Shreemandira)". */
export async function eligibilityForPlaces(names: string[]): Promise<EligibilityFact[]> {
  const clean = [...new Set(names.map((n) => (n ?? '').trim().toLowerCase()).filter(Boolean))];
  if (!clean.length) return [];
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT place, temple_name, entry_class, non_hindu_entry, enforcement_note, dress_code,
              age_or_medical_limits, registration_or_permit, foreign_tourist_suitable,
              oci_note, confidence, re_verify_by, extra
         FROM place_eligibility
        WHERE lower(place) = ANY($1::text[])
           OR EXISTS (SELECT 1 FROM unnest($1::text[]) q WHERE lower(place) LIKE q || '%')`,
      clean);
    return rows.map((r) => ({
      place: String(r.place),
      templeName: r.temple_name ?? null,
      entryClass: r.entry_class ?? null,
      nonHinduEntry: r.non_hindu_entry ?? null,
      enforcementNote: r.enforcement_note ?? null,
      dressCode: r.dress_code ?? null,
      ageOrMedical: r.age_or_medical_limits ?? null,
      registration: r.registration_or_permit ?? null,
      foreignSuitable: r.foreign_tourist_suitable ?? null,
      ociNote: r.oci_note ?? null,
      alternative: altOf(r.extra),
      confidence: r.confidence ?? null,
      reVerifyBy: r.re_verify_by ?? null,
    }));
  } catch (e) {
    console.error('eligibilityForPlaces failed (non-fatal):', e);
    return [];
  }
}

/** The stop names of a set of branches — the places a tour will actually take him to. */
export async function placesOfBranches(branchIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!branchIds.length) return out;
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT bs.branch_id, n.name
         FROM branch_stops bs JOIN stay_nodes n ON n.id = bs.stay_node_id
        WHERE bs.branch_id::text = ANY($1::text[]) ORDER BY bs.ord`, branchIds);
    for (const r of rows) {
      const k = String(r.branch_id);
      if (!out.has(k)) out.set(k, []);
      out.get(k)!.push(String(r.name));
    }
    return out;
  } catch (e) {
    console.error('placesOfBranches failed (non-fatal):', e);
    return out;
  }
}
