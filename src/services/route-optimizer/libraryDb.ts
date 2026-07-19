/**
 * SPRINT C1 — THE LIBRARY (DB layer, runtime retrieval side).
 *
 * Loads BranchLite rows for the pure funnel in library.ts, maps a named-circuit alias hit
 * to its branch (STAGE 0 reuses the proven resolveNamedCircuit registry, bound to the
 * library by our_tour_id), and persists the PROOF OBJECT on every retrieval.
 *
 * Every function fails CLOSED and NON-FATAL: no library table, or a bad row, degrades the
 * planner to its pre-C1 behaviour (the named-circuit + theme shortlist), never a 500.
 * NO MODEL. NO EMBEDDING. Pure SQL.
 */
import prisma from '@/config/db';
import { normAlias } from './library';
import type { BranchLite, BodyClass, StopRole, ThemeTag, ProofObject } from './library';

/** Load every ours-branch with its ordered stops for the in-memory funnel. There are only
 *  a few hundred; loading all and filtering in code keeps STAGE 1 trivial and testable.
 *  (A states[]/chips[] GIN pre-filter can be pushed into SQL later — a ranking-speed
 *  concern, not a correctness one.) */
export async function loadBranches(): Promise<BranchLite[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT b.id, b.label, b.our_tour_id, b.entry_region, b.exit_region, b.states,
              b.nights_min, b.nights_max, b.chips, b.season_mask, b.body_class,
              b.evidence_count, b.reversible,
              COALESCE(
                json_agg(
                  json_build_object('name', sn.name, 'nights', bs.nights_min,
                                    'role', bs.role, 'themes', bs.themes)
                  ORDER BY bs.ord
                ) FILTER (WHERE bs.id IS NOT NULL), '[]'
              ) AS stops
         FROM branches b
         LEFT JOIN branch_stops bs ON bs.branch_id = b.id
         LEFT JOIN stay_nodes sn ON sn.id = bs.stay_node_id
        WHERE b.our_tour_id IS NOT NULL
        GROUP BY b.id`);
    return rows.map((r) => ({
      id: String(r.id),
      label: String(r.label),
      ourTourId: r.our_tour_id == null ? null : String(r.our_tour_id),
      entryRegion: r.entry_region == null ? null : String(r.entry_region),
      exitRegion: r.exit_region == null ? null : String(r.exit_region),
      states: Array.isArray(r.states) ? r.states.map(String) : [],
      nightsMin: Number(r.nights_min) || 0,
      nightsMax: Number(r.nights_max) || 0,
      chips: Array.isArray(r.chips) ? r.chips.map(String) : [],
      seasonMask: Number(r.season_mask) || 4095,
      bodyClass: String(r.body_class) as BodyClass,
      evidenceCount: Number(r.evidence_count) || 1,
      reversible: r.reversible !== false,
      stops: (Array.isArray(r.stops) ? r.stops : []).map((s: any) => ({
        name: String(s.name ?? ''),
        nights: Number(s.nights) || 1,
        role: String(s.role ?? 'SUPPORT') as StopRole,
        themes: (Array.isArray(s.themes) ? s.themes : []) as ThemeTag[],
      })),
    }));
  } catch (e) {
    console.error('loadBranches failed (non-fatal — planner falls back to pre-C1):', e);
    return [];
  }
}

/**
 * STAGE 0 — NAME MATCH against branch_aliases (the general case, beyond the four hard-coded
 * circuits). The traveller's sentence is normalised the same way the aliases were (lower,
 * non-alnum stripped, h-drift removed), and we return the branch whose LONGEST APPROVED
 * alias is contained in it. Only approved aliases bind (§5: the founder approves before an
 * alias goes live), so a raw tour-title alias never fires until it is blessed. "nav greh
 * temples" → the Navagraha branch; "9 devi darshan" → Nau Devi; etc.
 */
export async function aliasLookup(text: string | null | undefined): Promise<{ branchId: string; alias: string } | null> {
  try {
    const q = normAlias(text);
    if (q.length < 4) return null;
    // 1) EXACT: the alias is contained verbatim in the normalised sentence (precise, fast).
    const exact = await prisma.$queryRawUnsafe<any[]>(
      `SELECT branch_id, alias FROM branch_aliases
        WHERE approved = true AND length(norm_alias) >= 4 AND position(norm_alias IN $1) > 0
        ORDER BY length(norm_alias) DESC LIMIT 1`, q);
    if (exact[0]) return { branchId: String(exact[0].branch_id), alias: String(exact[0].alias) };
    // 2) FUZZY: spelling mistakes (navgreh / nvgrah / nau greh / naugrah …) via pg_trgm
    //    word_similarity — "how well does the alias match SOME window of his sentence".
    //
    //    THE 0.28 DISASTER, measured on production 2026-07-19. The old comment here claimed
    //    the gap between the right tour and any other was wide. That holds for short,
    //    alias-SHAPED input. It is FALSE for a free-text brief: normAlias strips every
    //    space, so a 190-character sentence arrives as ONE 149-character token with no word
    //    boundaries left for word_similarity to respect. It degrades into a sliding window
    //    over a blob, and the more he writes the more chances noise gets. Three of twelve
    //    realistic non-pilgrimage briefs false-fired:
    //
    //      "we love beaches"          -> alias Kandan    0.286 -> Arupadai Veedu Tour
    //      "Planning our honeymoon"   -> alias Planetary 0.400 -> Navagraha Temple Tour
    //      "trekking and adventure"   -> alias Kandan    0.286 -> Arupadai Veedu Tour
    //
    //    A man planning his honeymoon was being sold a planetary temple tour.
    //
    //    TWO FENCES, both measured, neither guessed:
    //      - threshold 0.60. The NOISE ceiling across those briefs is 0.400 and the genuine
    //        floor is 0.774 (the Nau Devi Yatra, nine Devi temples), so 0.60 sits in open
    //        water with margin on both sides. A sweep from 0.28 to 0.70 showed every value
    //        from 0.40 up gives zero false positives AND zero missed real asks.
    //      - length >= 8. All the damage came from short aliases: Kandan 6, Skanda 6,
    //        Muruga 6, Kumara 6, Nvgrah 5. Nothing genuine needs them HERE, because nine of
    //        ten real named-tour asks resolve on the EXACT path above, which is untouched
    //        and still matches from 4 characters. Fuzzy is for misspellings of LONG names.
    const fuzzy = await prisma.$queryRawUnsafe<any[]>(
      `SELECT branch_id, alias, word_similarity(norm_alias, $1) AS ws FROM branch_aliases
        WHERE approved = true AND length(norm_alias) >= 8 AND word_similarity(norm_alias, $1) > 0.60
        ORDER BY ws DESC, length(norm_alias) DESC LIMIT 1`, q);
    return fuzzy[0] ? { branchId: String(fuzzy[0].branch_id), alias: String(fuzzy[0].alias) } : null;
  } catch (e) {
    console.error('aliasLookup failed (non-fatal):', e);
    return null;
  }
}

/** STAGE 0 bridge: a famous-circuit alias hit carries our tourId; the branch is the row
 *  whose our_tour_id equals it. */
export async function branchIdByTour(tourId: string): Promise<string | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM branches WHERE our_tour_id = $1 LIMIT 1`, tourId);
    return rows[0] ? String(rows[0].id) : null;
  } catch (e) {
    console.error('branchIdByTour failed (non-fatal):', e);
    return null;
  }
}

/** PROOF OBJECTS stored on every retrieval (§10.3). Fire-and-forget; a failure here never
 *  touches the traveller's answer. */
export async function saveRetrievalProof(
  request: string, proof: ProofObject, served: string[], aliasHit: string | null,
): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO library_retrievals (request, alias_hit, served, proof)
       VALUES ($1, $2, $3, $4::jsonb)`,
      request.slice(0, 2000), aliasHit, served, JSON.stringify(proof));
  } catch (e) {
    console.error('saveRetrievalProof failed (non-fatal):', e);
  }
}
