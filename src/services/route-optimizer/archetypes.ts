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
    try { plan = solveForObjective(input, deps, spec.objective, spec.label); } catch { plan = undefined; }
    if (plan && plan.days.length) built.push({ spec, plan });
  }
  if (!built.length) return [];

  const wantId: ArchetypeId = isSeniorParty(input) ? 'gentle' : 'balanced';
  const recId: ArchetypeId = built.some((b) => b.spec.id === wantId)
    ? wantId
    : built[built.length - 1].spec.id;

  return built.map((b) => cardFromPlan(b.spec, b.plan, b.spec.id === recId));
}
