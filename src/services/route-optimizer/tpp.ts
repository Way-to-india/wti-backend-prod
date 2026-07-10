/**
 * L1b — TRAVELER PSYCHE PROFILE (TPP), spec §14. The SAME brain, tuned per mind.
 *
 * §3 models the traveller's BODY (the hard gates); this models the MIND. The two
 * are deliberately separate because they modulate different things (§14.1):
 *
 *   > Psyche modulates WEIGHTS and soft constraints. It may NEVER override a
 *   > body-truth hard gate. An adventurous 72-year-old still gets the elderly
 *   > fatigue cap and altitude rules; what changes is how the engine spends the
 *   > comfort budget those gates leave open.
 *
 * Mechanically the TPP rescales the DDCV SOFT weight vector w = (w_T,w_M,w_Φ,w_Δ,
 * w_ρ,w_q) via `w' = w ∘ M(TPP)` (§14.5). Nothing else in the pipeline changes —
 * one brain, per-mind tuning.
 *
 * STRUCTURAL GUARANTEE (why no TPP can breach a body gate):
 *   - this module imports NOTHING from physiology.ts and only MULTIPLIES the six
 *     Weights fields by strictly-positive, bounded factors;
 *   - the hard-gate block lives in ddcv() (`hardBlock`), and ddcvScalar() returns
 *     +∞ for a blocked option REGARDLESS of the weight vector. A finite multiplier
 *     on a +∞ scalar is still +∞ — the option stays infeasible.
 *   Hence no TPP value can make a body-blocked option competitive. The guardrail
 *   test in tpp.test.ts proves this at both the scalar and the solve level.
 *
 * ABSENT / NEUTRAL TPP => `applyTPP` returns the input weights UNCHANGED, so a
 * fully-skipped questionnaire yields exactly the v1.0 engine (§14.3 rule 3): the
 * questionnaire is pure upside, zero degradation.
 */

import type { Weights } from './ddcv';
import type { TPP } from './types';

/** clamp a psyche dimension to its [−1,+1] domain (default 0 = physiology prior). */
const clampDim = (x: number | undefined): number =>
  Math.max(-1, Math.min(1, Number.isFinite(x as number) ? (x as number) : 0));

/** keep every weight multiplier strictly positive and bounded — a soft weight can
 *  be dialled down but never zeroed or flipped (and, being finite, can never turn a
 *  +∞ hard-blocked scalar finite). */
const clampMult = (m: number): number => Math.max(0.3, Math.min(2.0, m));

/** True when a TPP carries no signal (undefined, or every dimension 0) — the
 *  identity case where applyTPP must return the weights numerically unchanged. */
export function isNeutralTPP(tpp?: TPP): boolean {
  if (!tpp) return true;
  return (['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'] as const)
    .every((k) => clampDim(tpp[k]) === 0);
}

/**
 * §14.5 modulation vector M(TPP): a per-axis MULTIPLIER (>0) on the DDCV soft
 * weights. Only P1/P2/P5/P6 touch the weight vector (§14.2 — the dimensions that
 * modulate the DDCV weights); P3 (structure), P4 (crowd), P7 (control) and P8
 * (anchoring) modulate SOFT RULES / UI / clustering, not this weight vector, so
 * they are intentionally NOT multipliers here. Monotone, bounded, facts-only:
 *   - P1 Pace  (+packer):   ↑w_T (values speed), slight ↓w_Φ (tolerates fatigue)
 *   - P2 Novelty(+adventure):↓w_ρ (tolerates risk / thin services)
 *   - P5 Budget (−price-first):↑w_M ;  (+comfort-first): ↑w_Φ, ↑w_q, ↓w_M
 *   - P6 Transit(+experience):↓w_Δ (cares less about daylight spent in transit)
 */
export function modulation(tpp?: TPP): Weights {
  const p1 = clampDim(tpp?.P1), p2 = clampDim(tpp?.P2), p5 = clampDim(tpp?.P5), p6 = clampDim(tpp?.P6);
  return {
    T:     clampMult(1 + 0.30 * p1),                 // packer values speed
    M:     clampMult(1 - 0.40 * p5),                 // price-first (P5<0) lifts the money weight
    Phi:   clampMult(1 - 0.15 * p1 + 0.30 * p5),     // packer tolerates fatigue; comfort-first guards it
    Delta: clampMult(1 - 0.30 * p6),                 // transit=experience cares less about lost daylight
    rho:   clampMult(1 - 0.30 * p2),                 // adventure tolerates risk / thin services
    q:     clampMult(1 + 0.30 * p5),                 // comfort-first values manufactured days / arrival quality
  };
}

/**
 * Apply a TPP to a base (objective-derived) weight vector: `w' = w ∘ M(TPP)`. Pure.
 * Absent / neutral TPP returns the SAME weights (numerically unchanged), so the
 * engine is identical to v1.0 when no questionnaire was taken. Hard gates are NOT
 * touched here — they are enforced in ddcv() AFTER weighting and cannot be relaxed
 * by any value this function can produce.
 */
export function applyTPP(w: Weights, tpp?: TPP): Weights {
  if (isNeutralTPP(tpp)) return w;
  const m = modulation(tpp);
  return {
    T: w.T * m.T,
    M: w.M * m.M,
    Phi: w.Phi * m.Phi,
    Delta: w.Delta * m.Delta,
    rho: w.rho * m.rho,
    q: w.q * m.q,
  };
}
