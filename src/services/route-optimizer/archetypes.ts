/**
 * L5 — MULTI-OBJECTIVE PRESENTATION: three named archetypes (spec §8). PURE.
 *
 * Collapses the objective space into Swift / Balanced / Gentle — each a COMPLETE,
 * feasible, scheduled plan solved under a fixed objective, then shaped into a
 * design-ready card. Users choose between PLANS, not sliders (§8.1):
 *
 *   Swift    ≈ TIME     flight-lean, fewest days, time-poor travellers
 *   Balanced ≈ BALANCED the expert's own pick; overnight trains exploited, ≤1 flight
 *   Gentle   ≈ EASE     elderly-default; more anchors, no early starts, min fatigue
 *
 * ADDITIVE: emitted as OptimizeResult.cards[]; plans[] stays present + unchanged so
 * the Itinerary Builder `loadFromOptimizer` seam (reads plans[0]) is untouched.
 *
 * FACTS-ONLY (anti-hallucination): every card field is read from the plan the engine
 * actually scheduled — nothing invented. `fatigue[]` comes STRAIGHT from inc-2's
 * per-day comfort projection (`plan.days[].fatigue`). No re-implementation of
 * sequencing: each archetype is a `solveForObjective()` pass under a fixed objective
 * (the same builder the main solve uses), so the founder-locked body gates,
 * open-jaw endpoints and VERIFY flags all carry through unchanged.
 */

import type { OptimizeInput, Plan, Objective, ArchetypeCard, ArchetypeId } from './types';
import { solveForObjective, type OptimizeDeps } from './optimize';
import { toleranceForProfile } from './physiology';

interface ArchSpec { id: ArchetypeId; label: string; objective: Objective }

/** The fixed triad. Order is stable so the UI always renders Swift → Balanced → Gentle. */
const ARCHETYPES: ArchSpec[] = [
  { id: 'swift',    label: 'Swift',    objective: 'TIME' },
  { id: 'balanced', label: 'Balanced', objective: 'BALANCED' },
  { id: 'gentle',   label: 'Gentle',   objective: 'EASE' },
];

/**
 * True when the party's BODY places it in the elderly / reduced-mobility band —
 * Gentle is the recommended default for them (spec §8.1, handoff §4). Derived from
 * the physiology class, not a UI label, so an explicit override reaches it too.
 */
export function isSeniorParty(input: OptimizeInput): boolean {
  if (input.profile === 'senior') return true;
  const cls = toleranceForProfile(input.profile).cls;
  return cls === 'elderly' || cls === 'reduced_mobility';
}

/** Shape one scheduled plan into its design-ready card (facts-only). */
function cardFromPlan(spec: ArchSpec, plan: Plan, recommended: boolean): ArchetypeCard {
  // fatigue[] straight from inc-2's per-day projection; default 'easy' if a day was
  // never projected (absent-safe — never invents a heavy day).
  const fatigue: ('easy' | 'full')[] = plan.days.map((d) => (d.fatigue === 'full' ? 'full' : 'easy'));
  const costPpBand = plan.totals.costPpBand ?? null;
  const easeScore = plan.totals.easeScore;
  return {
    id: spec.id,
    label: spec.label,
    recommended,
    days: plan.days.length,
    hotelNights: plan.totals.hotelNights,
    // §4 canonical nested shape …
    totals: { costPpBand, easeScore },
    // … plus flat mirrors for the design data.js binding (parent handoff §5).
    costPpBand,
    easeScore,
    sequence: plan.sequence.slice(),
    fatigue,
  };
}

/**
 * Build the Swift / Balanced / Gentle archetype cards for a request. Each is a full
 * solve under its objective (`solveForObjective`, which does NOT itself build cards —
 * so there is no recursion with `optimize()`).
 *
 * `recommended = Gentle` for an elderly / reduced-mobility party, else Balanced (the
 * expert's own pick, §8.1). Absent-safe: a solve that throws or yields no days is
 * skipped rather than crashing the main solve; if the preferred recommendation was
 * skipped, the recommendation falls back to a surviving card so exactly one card is
 * flagged whenever at least one exists.
 */
export function buildArchetypes(input: OptimizeInput, deps: OptimizeDeps): ArchetypeCard[] {
  const built: { spec: ArchSpec; plan: Plan }[] = [];
  for (const spec of ARCHETYPES) {
    let plan: Plan | undefined;
    // US-610, RULE 1 — CONTRACT FIRST, ARCHETYPES SECOND. All three solves receive the SAME
    // PlanContract (it rides on `input`). A "Swift" card that puts a comfort-first honeymooner
    // on a train he refused is not a faster option; it is a breach wearing a rosette. The
    // archetypes may explore only the space his brief leaves open.
    try { plan = solveForObjective(input, deps, spec.objective, spec.label); } catch { plan = undefined; }
    if (plan && plan.days.length) built.push({ spec, plan });
  }
  if (!built.length) return [];

  const wantId: ArchetypeId = isSeniorParty(input) ? 'gentle' : 'balanced';
  const recId: ArchetypeId = built.some((b) => b.spec.id === wantId)
    ? wantId
    : built[built.length - 1].spec.id;

  const cards = built.map((b) => cardFromPlan(b.spec, b.plan, b.spec.id === recId));
  return dedupeCards(cards, built.map((b) => b.plan));
}

// =============================================================================
// US-610 — CARD HONESTY. Two doors into the same room is a lie.
//
// Measured on the failing request: Balanced and Gentle came back as THE IDENTICAL PLAN —
// same 6 days, same 4 nights, same sequence, ease 96 both. We were showing the traveller
// three doors, two of which opened into the same room, and inviting him to choose.
//
// Two rules, and one thing we must never do.
//
//   RULE 1. Contract first, archetypes second (above).
//   RULE 2. Dedupe by signature, AND SAY SO. A merged card is not a card we quietly deleted;
//           it is a finding we report: "these two turn out to be the same trip."
//
//   NEVER: manufacture difference. Forcing the second solve away from the first's legs — just
//   so the page has three cards on it — is the same lie in a mirror. If the traveller's own
//   brief leaves exactly one honourable plan, we show ONE CARD and say why. For a luxury
//   honeymoon that is not a failure state: it is a consultant with a firm recommendation,
//   which is what a man who says "just decide for me" is asking for anyway.
// =============================================================================

/** What makes two plans THE SAME TRIP: the same places, in the same order, by the same
 *  services, sleeping the same nights. Nothing else is identity. */
export function planSignature(p: Plan): string {
  const legs = p.legs.map((l) => `${l.mode}:${l.identifier ?? ''}`).join('>');
  const nights = p.days.map((d) => d.city).join('|');
  return `${p.sequence.join('>')}#${legs}#${nights}`;
}

/** Same route, same modes, and the same feel to within a hair. `easeScore` is the plan's own
 *  scheduled-comfort number — a fact we already computed, not one invented for this test. */
function near(a: Plan, b: Plan): boolean {
  const sameRoute = a.sequence.join('>') === b.sequence.join('>');
  const sameModes = a.legs.map((l) => l.mode).join('>') === b.legs.map((l) => l.mode).join('>');
  const sameFeel = Math.abs((a.totals.easeScore ?? 0) - (b.totals.easeScore ?? 0)) < 10;
  const sameDays = a.days.length === b.days.length;
  return sameRoute && sameModes && sameFeel && sameDays;
}

/** Gentler is better company when two plans are the same trip: we keep the kinder label. */
const GENTLENESS: Record<ArchetypeId, number> = { swift: 0, balanced: 1, gentle: 2 };

const SPOKEN: Record<ArchetypeId, string> = {
  swift: 'the quick plan',
  balanced: 'the balanced plan',
  gentle: 'the gentle plan',
};

export function dedupeCards(cards: ArchetypeCard[], plans: Plan[]): ArchetypeCard[] {
  const kept: { card: ArchetypeCard; plan: Plan; merged: ArchetypeId[] }[] = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i], plan = plans[i];
    const twin = kept.find((k) => planSignature(k.plan) === planSignature(plan) || near(k.plan, plan));
    if (!twin) { kept.push({ card, plan, merged: [] }); continue; }

    // They are the same trip. Keep the GENTLER label, and remember whom we merged.
    twin.merged.push(card.id, twin.card.id);
    if (GENTLENESS[card.id] > GENTLENESS[twin.card.id]) {
      const wasRecommended = twin.card.recommended || card.recommended;
      twin.card = { ...card, recommended: wasRecommended };
      twin.plan = plan;
    } else if (card.recommended) {
      twin.card = { ...twin.card, recommended: true };
    }
  }

  return kept.map(({ card, merged }) => {
    if (!merged.length) return card;
    const names = Array.from(new Set(merged)).sort((a, b) => GENTLENESS[a] - GENTLENESS[b]).map((id) => SPOKEN[id]);
    return {
      ...card,
      mergedFrom: Array.from(new Set(merged)),
      // We do not hide the merge. We report it — because a traveller who is shown two
      // identical plans and asked to choose learns something about us that we would rather
      // he did not learn.
      note: `For your trip, ${names.join(' and ')} turn out to be the same, so we show it once.`,
    };
  });
}
