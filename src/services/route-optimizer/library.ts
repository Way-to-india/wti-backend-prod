/**
 * SPRINT C1 — THE LIBRARY (pure core).
 *
 * Ruling doc: THE-LIBRARY-ARCHITECTURE-2026-07-15.md. This file is the PURE half:
 * structural hashing (§10.4), chip derivation, stop ROLES + NIGHT CLASSES (§10.1),
 * season/body derivation, and the retrieval FUNNEL — STAGE 1 hard facets, STAGE 2.5
 * constraint-satisfaction scoring (100 minus NAMED penalties), and the PROOF OBJECT
 * (§10.3, ChatGPT's One Idea) recorded on every retrieval.
 *
 * NO DB. NO CLOCK. NO MODEL. NO EMBEDDINGS. Every function here is deterministic and
 * unit-testable, and nothing in C1 calls an LLM. The DB layer is libraryDb.ts; the
 * controller wires this as RUNG 2 of the resolution ladder.
 */

import { createHash } from 'crypto';

// The eight chips the founder approved — the SAME vocabulary as intent.ts CHIPS and the
// intent_place.chip column, so chip-overlap between his ask and a branch is exact.
export const CHIPS = [
  'Pilgrimage', 'Beaches', 'Honeymoon & Romance', 'Culture & Festivals',
  'Heritage & Forts', 'Hill Stations & Mountains', 'Trekking & Adventure', 'Wildlife & Nature',
] as const;
export type Chip = typeof CHIPS[number];

export type StopRole =
  | 'MANDATORY_GATE' | 'MANDATORY_TRANSFER' | 'ANCHOR' | 'SUPPORT'
  | 'OPTIONAL' | 'BUFFER' | 'RECOVERY';
export type NightClass = 'FIXED' | 'FLEXIBLE' | 'OPTIONAL';
export type BodyClass = 'standard' | 'moderate' | 'high_altitude' | 'strenuous';
export interface ThemeTag { chip: string; strength: 'anchor' | 'incidental'; }

// ---------------------------------------------------------------------------------------
// NORMALISATION — one function, used for aliases AND for the STAGE 0 lookup, so a stored
// alias and a live query normalise identically. Lower-case, strip non-alphanumerics, and
// remove the letter h (Dharamshala/Dharamsala, Rishikesh/Hrishikesh) — the standing
// h-drift rule from US-871's normTown, extended to keep digits ("9 devi" → "9devi").
// ---------------------------------------------------------------------------------------
export function normAlias(s: string | null | undefined): string {
  if (!s) return '';
  return s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/h/g, '');
}

// ---------------------------------------------------------------------------------------
// STRUCTURAL HASH (§10.4) — ordered stay_node ids + entry_region + exit_region ONLY.
// Nights are DELIBERATELY excluded: they live in bands, and hashing them would mint a
// false product for every one-night delta. Same hash ⇒ same branch ⇒ evidence++.
// ---------------------------------------------------------------------------------------
export function structHash(
  nodeIds: string[], entryRegion: string | null, exitRegion: string | null,
): string {
  const payload = `${entryRegion ?? '-'}|${exitRegion ?? '-'}|${nodeIds.join('>')}`;
  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

// ---------------------------------------------------------------------------------------
// SEASON MASK — parse a free-text bestTime ("October to March", "Sep-Nov, Feb") into a
// 12-bit month mask (Jan = bit 0). Unparseable or "all year" ⇒ 4095 (all months, no
// season constraint). This is a COARSE pre-filter only; the real per-stop season gate
// (place_seasons) still runs at STAGE 4.
// ---------------------------------------------------------------------------------------
const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8,
  oct: 9, nov: 10, dec: 11, january: 0, february: 1, march: 2, april: 3, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};
export const ALL_MONTHS = 4095;
export function seasonMaskFromBestTime(bestTime: string | null | undefined): number {
  if (!bestTime) return ALL_MONTHS;
  const t = bestTime.toLowerCase();
  if (/all\s*year|round\s*the\s*year|any\s*time|throughout/.test(t)) return ALL_MONTHS;
  const monthAt = (w: string): number | null => (w in MONTHS ? MONTHS[w] : null);
  let mask = 0;
  // ranges: "october to march", "oct - mar", "september-november"
  const range = /([a-z]+)\s*(?:to|[-–—])\s*([a-z]+)/g;
  let m: RegExpExecArray | null;
  let sawRange = false;
  while ((m = range.exec(t))) {
    const a = monthAt(m[1]); const b = monthAt(m[2]);
    if (a == null || b == null) continue;
    sawRange = true;
    for (let i = a; ; i = (i + 1) % 12) { mask |= 1 << i; if (i === b) break; }
  }
  // standalone months (also catches lists "march, april, may")
  const single = /\b([a-z]+)\b/g;
  while ((m = single.exec(t))) {
    const idx = monthAt(m[1]);
    if (idx != null) mask |= 1 << idx;
  }
  return mask === 0 ? ALL_MONTHS : mask;
}
export function monthInMask(monthIndex0: number | null | undefined, mask: number): boolean {
  if (monthIndex0 == null) return true;      // he named no month ⇒ season cannot refuse
  if (mask === ALL_MONTHS) return true;
  return (mask & (1 << (monthIndex0 % 12))) !== 0;
}

// ---------------------------------------------------------------------------------------
// BODY CLASS — from the highest stop elevation. A ranking/robustness fact only; the real
// physiology gate (ordeal caps, US-834 consent) still runs at STAGE 4.
// ---------------------------------------------------------------------------------------
export function bodyClassFor(maxElevationM: number | null | undefined): BodyClass {
  const e = maxElevationM ?? 0;
  if (e >= 3500) return 'strenuous';
  if (e >= 2500) return 'high_altitude';
  if (e >= 1500) return 'moderate';
  return 'standard';
}

// ---------------------------------------------------------------------------------------
// ROLES + NIGHT CLASSES (§10.1) — deterministic DEFAULTS, every one founder-reviewable at
// ingestion. The branch now knows WHY its sequence exists, so the Tailor (C2) may act only
// where the roles permit.
//   - first / last stop that anchors no theme and holds 1 night → a GATE (arrival/exit).
//   - a stop above 2500 m on the FIRST night of altitude → RECOVERY (acclimatisation).
//   - a stop whose themes include one of the branch's main chips at 'anchor' → ANCHOR.
//   - a 1-night stop that anchors nothing → SUPPORT (transit); the terminal one → BUFFER.
// Night class: ANCHOR + RECOVERY nights are FIXED (load-bearing); everything else FLEXIBLE.
// ---------------------------------------------------------------------------------------
export interface RawStop {
  nodeId: string;
  name: string;
  nights: number;
  elevationM: number | null;
  themes: ThemeTag[];
}
export interface AssignedStop { role: StopRole; nightClass: NightClass; }
export function assignRoles(stops: RawStop[], branchChips: string[]): AssignedStop[] {
  const chipSet = new Set(branchChips);
  const anchorsMain = (s: RawStop) =>
    s.themes.some((t) => t.strength === 'anchor' && chipSet.has(t.chip));
  let altitudeSeen = false;
  return stops.map((s, i) => {
    const first = i === 0;
    const last = i === stops.length - 1;
    let role: StopRole;
    let nightClass: NightClass;
    const highAltitude = (s.elevationM ?? 0) >= 2500;
    if (highAltitude && !altitudeSeen) {
      role = 'RECOVERY';
      altitudeSeen = true;
    } else if (anchorsMain(s)) {
      role = 'ANCHOR';
    } else if ((first || last) && s.nights <= 1 && s.themes.length === 0) {
      role = first ? 'MANDATORY_GATE' : 'BUFFER';
    } else if (s.nights <= 1 && !anchorsMain(s)) {
      role = last ? 'BUFFER' : 'SUPPORT';
    } else {
      role = 'SUPPORT';
    }
    if (highAltitude) altitudeSeen = true;
    nightClass = (role === 'ANCHOR' || role === 'RECOVERY') ? 'FIXED' : 'FLEXIBLE';
    return { role, nightClass };
  });
}

// ---------------------------------------------------------------------------------------
// CHIP DERIVATION — a branch's chips are the UNION of its stops' anchor themes. Themes
// live on STOPS, not tours (§4b), so "adventure + wildlife" is served by a branch where
// one stop anchors each. Incidental themes decorate but do not make a branch's coverage.
// ---------------------------------------------------------------------------------------
export function deriveBranchChips(stops: RawStop[]): string[] {
  const out = new Set<string>();
  for (const s of stops) for (const t of s.themes) if (t.strength === 'anchor') out.add(t.chip);
  // keep canonical chip order
  return CHIPS.filter((c) => out.has(c));
}

// =======================================================================================
// RETRIEVAL FUNNEL — STAGE 1 (hard facets) → STAGE 2.5 (constraint-satisfaction scoring)
// → proof object. STAGE 0 (alias) and STAGE 4 (the existing serve-time gates) live in the
// DB layer / controller; this module is the pure heart.
// =======================================================================================

export interface BranchLite {
  id: string;
  label: string;
  ourTourId: string | null;
  entryRegion: string | null;
  exitRegion: string | null;
  states: string[];
  nightsMin: number;
  nightsMax: number;
  chips: string[];
  seasonMask: number;
  bodyClass: BodyClass;
  evidenceCount: number;
  reversible: boolean;
  stops: { name: string; nights: number; role: StopRole; themes: ThemeTag[] }[];
}

export interface QueryFacets {
  chips: string[];                       // his main motivations (chipsOf)
  regionStates: string[] | null;         // stateNamesOf(hisRegion), or null if none
  regionKey: string | null;
  measuredFrom: string | null;           // his entry gate / start (for ease scoring, later)
  monthIndex0: number | null;            // 0..11, or null
  saidNights: number | null;             // a number HE gave, or null
  profile: 'standard' | 'family' | 'senior';
}

export interface HardResult { pass: boolean; fails: string[]; }

/** STAGE 1 — EXACTNESS lives here. Region overlap (when he named one), season admission
 *  (when he named a month), and a loose duration-band overlap. Body and the honest
 *  reachability refusals are STAGE 4's job, not this pre-filter's. */
export function hardFacets(b: BranchLite, q: QueryFacets): HardResult {
  const fails: string[] = [];
  // entry-region reachable: the branch must TOUCH the region he named.
  if (q.regionStates && q.regionStates.length) {
    const bs = new Set(b.states.map((s) => s.toLowerCase()));
    const overlap = q.regionStates.some((s) => bs.has(s.toLowerCase()));
    if (!overlap) fails.push(`outside ${q.regionKey ?? 'the region you named'}`);
  }
  // MAIN-MOTIVATION COVERAGE as a gate (§4b.2): when he named interests, a branch that
  // anchors NONE of them is not an answer to HIS ask — a pilgrimage circuit is not a
  // wildlife trip, however popular. (A branch that covers some is kept and scored.)
  if (q.chips.length) {
    const branchChips = new Set(b.chips);
    if (!q.chips.some((c) => branchChips.has(c))) {
      fails.push(`covers none of your interests (${q.chips.join(', ')})`);
    }
  }
  // season window admits his month
  if (!monthInMask(q.monthIndex0, b.seasonMask)) {
    fails.push('the season does not admit your month');
  }
  // duration band overlap — lenient. His single number becomes a ±3 band; a branch far
  // longer than he allows with no tailor yet is filtered, far shorter is kept (it under-
  // fills, which STAGE 2.5 penalises rather than refuses).
  if (q.saidNights != null) {
    if (b.nightsMin > q.saidNights + 1) fails.push(`needs ${b.nightsMin} nights, longer than your ${q.saidNights}`);
  }
  return { pass: fails.length === 0, fails };
}

export interface Penalty { reason: string; points: number; }
export interface ScoredBranch {
  branch: BranchLite;
  score: number;
  matchedChips: string[];
  missingChips: string[];
  penalties: Penalty[];
}

/** STAGE 2.5 — CONSTRAINT SATISFACTION: 100 minus NAMED penalties (§10.3), never an
 *  additive soup. Every deduction is a sentence we can speak. */
export function scoreBranch(b: BranchLite, q: QueryFacets): ScoredBranch {
  const penalties: Penalty[] = [];
  const his = new Set(q.chips);
  const branchChips = new Set(b.chips);
  const matchedChips = q.chips.filter((c) => branchChips.has(c));
  const missingChips = q.chips.filter((c) => !branchChips.has(c));
  // COVERAGE requirement (§4b.2): every MAIN motivation must be anchored, or the branch is
  // a weak answer. Heavy named penalty per uncovered chip.
  for (const c of missingChips) penalties.push({ reason: `does not cover ${c}`, points: 22 });
  // a branch carrying chips he did NOT ask for is fine (bonus breadth), no penalty.
  // night-fit closeness — how far the branch's typical length sits from his number.
  if (q.saidNights != null) {
    const mid = Math.round((b.nightsMin + b.nightsMax) / 2);
    const gap = Math.abs(mid - q.saidNights);
    if (gap > 0) penalties.push({ reason: `${mid} nights vs your ${q.saidNights}`, points: Math.min(20, gap * 4) });
  }
  // region-fit: a branch entirely inside his region beats one that only clips it.
  if (q.regionStates && q.regionStates.length) {
    const rs = new Set(q.regionStates.map((s) => s.toLowerCase()));
    const inside = b.states.filter((s) => rs.has(s.toLowerCase())).length;
    if (inside < b.states.length) {
      penalties.push({ reason: 'part of this journey leaves the region you named', points: 6 });
    }
  }
  let score = 100 - penalties.reduce((s, p) => s + p.points, 0);
  // evidence tie-break ONLY (never opens a gate): a fraction of a point per corroboration.
  score += Math.min(3, (b.evidenceCount - 1) * 0.5);
  return { branch: b, score, matchedChips, missingChips, penalties };
}

export interface ProofExcluded { branchId: string; label: string; stage: string; reason: string; }
export interface ProofObject {
  version: 1;
  query: QueryFacets;
  aliasHit: string | null;
  stage1_in: number;
  stage1_survivors: number;
  ranked: { branchId: string; label: string; score: number; matched: string[]; missing: string[]; penalties: Penalty[] }[];
  excluded: ProofExcluded[];
  served: string[];
  reason: string;
}

export interface RetrieveResult {
  offered: ScoredBranch[];
  proof: ProofObject;
}

/**
 * The C1 retrieval: STAGE 1 filter → STAGE 2.5 score → top offers, and a machine-readable
 * PROOF OBJECT recording constraints matched, filters passed, ranking reasons, and EVERY
 * excluded candidate WITH ITS REASON. Never shown raw — it feeds the Golden Fifty, the
 * Nightly Judge, founder audits, and the support answer to "why not X?".
 *
 * `aliasBranchId` short-circuits STAGE 0: a named-circuit alias hit is served first and its
 * proof records the alias. STAGE 4 gates run in the controller on `offered`.
 */
export function retrieve(
  branches: BranchLite[], q: QueryFacets,
  opts: { aliasBranchId?: string | null; aliasQuote?: string | null; maxOffers?: number; scoreFloor?: number } = {},
): RetrieveResult {
  const maxOffers = opts.maxOffers ?? 4;
  const scoreFloor = opts.scoreFloor ?? 45;
  const excluded: ProofExcluded[] = [];

  // STAGE 0 — a named alias is a lookup, not a search. Served first, alone.
  if (opts.aliasBranchId) {
    const hit = branches.find((b) => b.id === opts.aliasBranchId);
    if (hit) {
      const scored = scoreBranch(hit, q);
      const proof: ProofObject = {
        version: 1, query: q, aliasHit: opts.aliasQuote ?? hit.label,
        stage1_in: branches.length, stage1_survivors: 1,
        ranked: [{ branchId: hit.id, label: hit.label, score: scored.score, matched: scored.matchedChips, missing: scored.missingChips, penalties: scored.penalties }],
        excluded: [], served: [hit.id],
        reason: `served by name match on "${opts.aliasQuote ?? hit.label}"`,
      };
      return { offered: [scored], proof };
    }
  }

  // STAGE 1 — hard facets.
  const survivors: BranchLite[] = [];
  for (const b of branches) {
    const hf = hardFacets(b, q);
    if (hf.pass) survivors.push(b);
    else excluded.push({ branchId: b.id, label: b.label, stage: 'facets', reason: hf.fails.join('; ') });
  }

  // STAGE 2.5 — constraint-satisfaction scoring; keep the ones above the floor.
  const scored = survivors.map((b) => scoreBranch(b, q)).sort((a, b) => b.score - a.score);
  const offered: ScoredBranch[] = [];
  for (const s of scored) {
    if (offered.length >= maxOffers) { excluded.push({ branchId: s.branch.id, label: s.branch.label, stage: 'rank', reason: `ranked below the top ${maxOffers}` }); continue; }
    if (s.score < scoreFloor) { excluded.push({ branchId: s.branch.id, label: s.branch.label, stage: 'score', reason: `score ${Math.round(s.score)} below floor ${scoreFloor}: ${s.penalties.map((p) => p.reason).join(', ') || 'no strong match'}` }); continue; }
    offered.push(s);
  }

  const proof: ProofObject = {
    version: 1, query: q, aliasHit: null,
    stage1_in: branches.length, stage1_survivors: survivors.length,
    ranked: scored.map((s) => ({ branchId: s.branch.id, label: s.branch.label, score: Math.round(s.score * 10) / 10, matched: s.matchedChips, missing: s.missingChips, penalties: s.penalties })),
    excluded, served: offered.map((s) => s.branch.id),
    reason: offered.length
      ? `${offered.length} branch(es) served from ${survivors.length} facet survivors of ${branches.length}`
      : `no branch cleared the facets/score floor (${survivors.length} survivors of ${branches.length})`,
  };
  return { offered, proof };
}
