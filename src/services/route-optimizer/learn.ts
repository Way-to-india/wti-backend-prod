/**
 * L8 — EPISODIC LEARNING (spec §15). The "living algorithm" layer: every executed
 * trip writes back — actual segment times nudge terrain-speed curves, actual fares
 * nudge fare curves, post-trip "the Day-4 drive was too much" nudges the per-class
 * SOFT fatigue coefficient, and cancellations nudge corridor reliability. Cold-start
 * uses this spec's tables; after ~200 trips/region the posterior coefficients are the
 * proprietary moat (§15.5) — they exist only in operation and cannot be re-derived
 * from the spec.
 *
 * PURE + DB-FREE (the engine stays DB-free, §15.2 / handoff): this module is a pure
 * reducer `(priorCoeffs, episode) -> posteriorCoeffs`. The controller distils a raw
 * §15.1 episode tuple into the small numeric `Episode` observation below, folds a
 * batch through `learnBatch`, and injects the posterior `RouteCoeffs` the SAME way it
 * injects the verified pool. No import from any DB layer; unit-testable with no DB.
 *
 * STRUCTURAL BODY-GATE GUARANTEE (spec §15.4.2 — "body gates are not learnable"):
 *   - `RouteCoeffs` holds ONLY soft / calibratable coefficients. It has NO field for
 *     any §3 hard-cap column (hardCapHrs, overnightClassFloor, earliest/latest clock,
 *     altitude). The reducer can therefore not even ADDRESS a hard gate — the type
 *     system forbids it, exactly as tpp.ts cannot address a gate because it only
 *     scales Weights. This module imports NOTHING from physiology.ts (it re-declares
 *     its own class union) so the guarantee is structural, not a comment.
 *   - Every nudge is doubly bounded (§15.4.1 "no single episode moves a coefficient
 *     > epsilon"): a small per-episode STEP cap, then an absolute [floor, ceiling]
 *     clamp. The terrain-speed ceiling is the anti-back-door: a ghat (rqi 1) can
 *     never learn its way up to expressway speed, so it can never shrink an over-cap
 *     road leg's HOURS below the (untouched) hard cap. `learn.test.ts` proves this at
 *     the coefficient level AND by re-running the physiology hard gate after a
 *     maximal adversarial batch.
 *
 * ANTI-HALLUCINATION (§2 / §15.4.5): learning only calibrates coefficients over the
 * verified supply the engine already reasons about; it never invents a service. The
 * reliability coefficient can only DEGRADE trust on a cancellation — it never
 * fabricates a running service.
 */

// Own class union — deliberately NOT imported from physiology.ts, so this module is
// structurally unable to reference a hard-gate field (mirrors tpp.ts's isolation).
export type LearnClass = 'reduced_mobility' | 'elderly' | 'family' | 'midage' | 'young';
const CLASSES: LearnClass[] = ['reduced_mobility', 'elderly', 'family', 'midage', 'young'];

/** road-quality bucket, 5 trunk/expressway … 1 ghat/LWE/high-altitude (§2.1). */
export type Rqi = 1 | 2 | 3 | 4 | 5;
export type FareMode = 'AIR' | 'RAIL' | 'ROAD';

/**
 * The LEARNABLE coefficient bundle — the ONLY quantities episodic learning may move.
 * Note what is absent by design: no hard-cap hours, no class floor, no chronotype
 * clock, no altitude threshold. Those live in physiology.ts and are non-learnable.
 */
export interface RouteCoeffs {
  /** §2.1 terrain base speed (km/h) by road-quality bucket. Cold-start = the spec table. */
  terrainSpeedKmh: Record<Rqi, number>;
  /** §11 fare curve: a multiplier on the cold-start fare estimate, per mode (1 = cold-start). */
  fareMult: Record<FareMode, number>;
  /** §3.3 per-class SOFT fatigue-load multiplier (the ddcv ageFactor). NOT a hard gate. */
  fatigueAgeFactor: Record<LearnClass, number>;
  /** §5.5 corridor reliability prior 1..5, keyed 'FROM||TO||MODE'. Absent ⇒ COLD_RELIABILITY. */
  reliability: Record<string, number>;
}

// ---- cold-start tables (grounded in physiology.ts / providers.ts, verbatim) -----

const COLD_TERRAIN_SPEED: Record<Rqi, number> = { 1: 22, 2: 30, 3: 42, 4: 55, 5: 75 };
const COLD_FATIGUE_AGE: Record<LearnClass, number> = {
  reduced_mobility: 1.45, elderly: 1.35, family: 1.10, midage: 1.00, young: 0.85,
};
const COLD_FARE_MULT: Record<FareMode, number> = { AIR: 1, RAIL: 1, ROAD: 1 };
/** providers.ts default reliability when a service's running-days don't prove daily. */
export const COLD_RELIABILITY = 3;

/** A fresh cold-start bundle (a brand-new region inherits exactly the spec tables). */
export function coldStartCoeffs(): RouteCoeffs {
  return {
    terrainSpeedKmh: { ...COLD_TERRAIN_SPEED },
    fareMult: { ...COLD_FARE_MULT },
    fatigueAgeFactor: { ...COLD_FATIGUE_AGE },
    reliability: {},
  };
}

// ---- bounds (§15.4.1 learning-rate caps + absolute floors/ceilings) -------------
// STEP = the most one episode may move a coefficient (epsilon). CLAMP = the absolute
// band a coefficient may ever occupy, expressed as [×lo, ×hi] of its cold-start value.
export const BOUNDS = {
  speed:   { step: 1.5,  clampLo: 0.60, clampHi: 1.35 }, // ghat 22 ⇒ [13.2, 29.7]: never reaches NH 55
  fare:    { step: 0.04, clampLo: 0.50, clampHi: 2.00 },
  fatigue: { step: 0.03, absLo: 0.60,   absHi: 1.80 },   // absolute band (not a ×cold-start)
  reliability: { alpha: 0.15, lo: 1, hi: 5 },            // EMA toward the observed outcome
} as const;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
/** move `prior` toward `target` by at most `step` (a bounded, monotone nudge). */
const nudge = (prior: number, target: number, step: number): number => {
  const d = target - prior;
  return prior + Math.sign(d) * Math.min(Math.abs(d), step);
};
const round4 = (x: number) => Math.round(x * 1e4) / 1e4;

/**
 * A distilled, PURE observation (the controller reduces a raw §15.1 episode tuple to
 * this before calling the reducer — so learn.ts never sees a DB row). Every field is
 * optional; an episode carries whichever signals it actually observed.
 */
export interface Episode {
  /** actual road segment: real in-vehicle hours vs the km, at a road-quality bucket. */
  road?: { rqi: Rqi; distanceKm: number; actualHrs: number };
  /** actual fare paid vs the cold-start estimate for that mode. */
  fare?: { mode: FareMode; actualPp: number; estimatedPp: number };
  /** post-trip fatigue report for the weakest class: was the pace too much, fine, or easy. */
  fatigue?: { cls: LearnClass; report: 'too_much' | 'fine' | 'easy' };
  /** a verified corridor service actually RAN or was CANCELLED (§5.5 reliability). */
  reliability?: { corridor: string; outcome: 'ran' | 'cancelled' };
  /** §15.4.6 sad-path hygiene: abandonment episodes teach UX, not routes — pass a small
   *  weight (≈0.05) so they barely move route coefficients. Default 1. */
  weight?: number;
}

/**
 * THE REDUCER — pure `(prior, episode) -> posterior`. Deterministic, bounded, and
 * incapable of touching a hard gate (see the structural guarantee in the header).
 * Returns a NEW bundle; never mutates `prior`.
 */
export function learn(prior: RouteCoeffs, ep: Episode): RouteCoeffs {
  // deep-ish copy of the mutable maps (values are primitives)
  const next: RouteCoeffs = {
    terrainSpeedKmh: { ...prior.terrainSpeedKmh },
    fareMult: { ...prior.fareMult },
    fatigueAgeFactor: { ...prior.fatigueAgeFactor },
    reliability: { ...prior.reliability },
  };
  const w = ep.weight == null ? 1 : clamp(ep.weight, 0, 1);
  if (w === 0) return next; // a fully down-weighted (abandonment) episode teaches nothing here

  // (1) TERRAIN SPEED — actual hours reveal the real corridor speed (§2.1 / §15 L-slow).
  if (ep.road && ep.road.actualHrs > 0 && ep.road.distanceKm > 0) {
    const rqi = ep.road.rqi;
    const observed = ep.road.distanceKm / ep.road.actualHrs; // km/h actually achieved
    const moved = nudge(next.terrainSpeedKmh[rqi], observed, BOUNDS.speed.step * w);
    const lo = COLD_TERRAIN_SPEED[rqi] * BOUNDS.speed.clampLo;
    const hi = COLD_TERRAIN_SPEED[rqi] * BOUNDS.speed.clampHi;
    next.terrainSpeedKmh[rqi] = round4(clamp(moved, lo, hi));
  }

  // (2) FARE CURVE — actual/estimate ratio corrects the per-mode multiplier (§11).
  if (ep.fare && ep.fare.estimatedPp > 0 && ep.fare.actualPp > 0) {
    const ratio = ep.fare.actualPp / ep.fare.estimatedPp; // >1 ⇒ we under-quoted
    const moved = nudge(next.fareMult[ep.fare.mode], ratio, BOUNDS.fare.step * w);
    const lo = COLD_FARE_MULT[ep.fare.mode] * BOUNDS.fare.clampLo;
    const hi = COLD_FARE_MULT[ep.fare.mode] * BOUNDS.fare.clampHi;
    next.fareMult[ep.fare.mode] = round4(clamp(moved, lo, hi));
  }

  // (3) PER-CLASS SOFT FATIGUE — "too much" lifts the class's fatigue load; "easy"
  // relaxes it. This is the ddcv comfort coefficient, NOT a hard cap (§3.3 vs §3.2).
  if (ep.fatigue && ep.fatigue.report !== 'fine') {
    const dir = ep.fatigue.report === 'too_much' ? +1 : -1;
    const moved = next.fatigueAgeFactor[ep.fatigue.cls] + dir * BOUNDS.fatigue.step * w;
    next.fatigueAgeFactor[ep.fatigue.cls] = round4(clamp(moved, BOUNDS.fatigue.absLo, BOUNDS.fatigue.absHi));
  }

  // (4) RELIABILITY — a run raises trust toward 5, a cancellation lowers it toward 1
  // (EMA). Only ever calibrates an already-verified corridor; never invents one (§2).
  if (ep.reliability) {
    const cur = next.reliability[ep.reliability.corridor] ?? COLD_RELIABILITY;
    const target = ep.reliability.outcome === 'ran' ? BOUNDS.reliability.hi : BOUNDS.reliability.lo;
    const a = BOUNDS.reliability.alpha * w;
    const moved = cur + a * (target - cur);
    next.reliability[ep.reliability.corridor] = round4(clamp(moved, BOUNDS.reliability.lo, BOUNDS.reliability.hi));
  }

  return next;
}

/** Fold a batch of episodes deterministically (§15.2 L-slow weekly batch). Pure. */
export function learnBatch(prior: RouteCoeffs, episodes: Episode[]): RouteCoeffs {
  return episodes.reduce((c, e) => learn(c, e), prior);
}

/**
 * Convenience for the physiology gate proof / callers: the learned terrain-adjusted
 * hours for a road leg under a given coefficient bundle. Mirrors physiology.vehicleHours
 * (km ÷ speed) but reads the LEARNED speed — used by the guardrail test to show an
 * over-cap leg stays over-cap no matter what the learner did. Pure; no gate here.
 */
export function learnedRoadHours(coeffs: RouteCoeffs, rqi: Rqi, distanceKm: number): number {
  return distanceKm / coeffs.terrainSpeedKmh[rqi];
}
