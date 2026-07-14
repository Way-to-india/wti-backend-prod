/**
 * L2 — DOOR-TO-DOOR COST VECTOR (DDCV). Spec §4.1 (the vector), §4.5 (airport as a
 * via-node, not a teleport), q-term (clock-quality truth). Pure + dependency-free.
 *
 * Every mode comparison in the engine is DDCV vs DDCV; raw mode durations never
 * compete. A "2-hour flight" is access + 120 check-in + block + 45 egress + access,
 * so a far airport honestly loses to a direct overnight train — computed, never
 * hardcoded.
 *
 * WEIGHTS ARE A PER-SOLVE PARAMETER (spec §14.5): the scalarizer takes a weight
 * vector w = (w_T, w_M, w_Φ, w_Δ, w_ρ, w_q). Today it comes from the objective; in
 * Sprint 4 the TPP rescales it via w' = w ∘ M(TPP). Nothing else changes — one
 * brain, per-mind tuning. HARD GATES (physiology.ts) are applied here as a block
 * flag and can NEVER be bought off by any weight (spec §14.1 / §15.4).
 */

import type { LegOption, Objective } from './types';
import { toMin, isTrueOvernight } from './constraints';
import {
  type Tolerance, vehicleHours, comfortStopHours, legFatigue,
  roadDayHardCapExceeded, departsTooEarly, arrivesTooLate, arrivesInDeadHours, overnightClassOk,
} from './physiology';
import { tightened, type Tightening } from './intent';
import { RAIL_ORDEAL_REFUSE_HRS } from './ordeal';

// ---- weight vector -----------------------------------------------------------

export interface Weights { T: number; M: number; Phi: number; Delta: number; rho: number; q: number }

/** Objective → base weights (the physiology-class prior lives in the caller). */
export function weightsForObjective(obj: Objective): Weights {
  switch (obj) {
    case 'TIME':  return { T: 1.6, M: 0.4, Phi: 0.6, Delta: 0.8, rho: 0.6, q: 0.6 };
    case 'COST':  return { T: 0.3, M: 2.2, Phi: 0.4, Delta: 0.3, rho: 0.4, q: 0.4 };
    case 'EASE':  return { T: 0.7, M: 0.5, Phi: 1.5, Delta: 1.1, rho: 1.1, q: 1.3 };
    case 'BALANCED':
    default:      return { T: 1.0, M: 1.0, Phi: 1.0, Delta: 1.0, rho: 1.0, q: 1.0 };
  }
}

// unit-normalizing scales so the six axes are commensurable before weighting.
const SCALE = { M: 1200, Delta: 6, rho: 4, q: 4 } as const;

// ---- the vector --------------------------------------------------------------

export interface DDCV {
  T: number;      // door-to-door hours (hotel A → hotel B, all buffers)
  M: number;      // money, party total (₹)
  Phi: number;    // fatigue load for the weakest traveler
  Delta: number;  // day-damage ∈ [0,1] — usable daylight destroyed at both ends
  rho: number;    // risk ∈ [0,1]
  q: number;      // arrival-quality bonus (>0 good; may go negative = penalty)
  hardBlock: boolean;      // a body-truth gate failed — option is INFEASIBLE, not just costly
  blockReasons: string[];
}

export interface LegCtx {
  tol: Tolerance;
  pax: number;
  month?: number | null;
  roadQualityIndex?: number | null;
  /** door-to-door access: hotel→terminal (from) and terminal→hotel (to), in HOURS.
   *  0 for a pure road transfer. For AIR/RAIL the caller derives these from the
   *  city transport profile (airport/railhead transfer km ÷ city speed). This is
   *  the §4.5 airport-as-via-node hook: a 250 km access shows up here as ~5.5 h. */
  accessFromHrs?: number;
  accessToHrs?: number;
  /** per-person taxi cost for the access legs (₹). */
  accessCostPp?: number;
  /** indicative per-person fare when the option carries none. */
  fallbackFarePp?: number;
  /** US-603 — the traveller's contract, compiled from HIS OWN WORDS (intent.ts). It may
   *  only make this party's gates STRICTER (a comfort-first honeymooner refuses a 3:50
   *  a.m. arrival; the body already refused a 9-hour senior drive). It cannot make any
   *  gate kinder: `tightened()` clamps in one direction, and the type cannot express a
   *  loosening. Absent ⇒ today's behaviour, exactly. */
  tighten?: Tightening;
  /** US-606 — when false, the hotel-night reward below is NOT PAID AT ALL. Absent ⇒ paid,
   *  which is the right answer for the budget family it was written for. */
  rewardHotelNightSaving?: boolean;
  /** RAIL-ORDEAL RULING (founder, 15 Jul 2026) — true when the party is comfort-first
   *  (luxury/premium, or "money no object"). Drives the 30-hour rail refusal below. */
  comfortFirst?: boolean;
}

const DAY_START = 6 * 60, DAY_END = 18 * 60, DAY_LEN = DAY_END - DAY_START; // useful daylight window

function overlapMin(lo: number, hi: number, wLo: number, wHi: number): number {
  return Math.max(0, Math.min(hi, wHi) - Math.max(lo, wLo));
}

/** Build the DDCV for one concrete option under a party/leg context. */
export function ddcv(o: LegOption, ctx: LegCtx): DDCV {
  // The party's body, made STRICTER by what the traveller himself asked for. One
  // direction only: `tightened()` can lower a cap, never raise one (intent.ts).
  const tol = tightened(ctx.tol, ctx.tighten);
  const overnight = isTrueOvernight(o);
  const inVeh = vehicleHours(o, { roadQualityIndex: ctx.roadQualityIndex, month: ctx.month });
  const accFrom = ctx.accessFromHrs ?? 0;
  const accTo = ctx.accessToHrs ?? 0;

  // ---- T: honest door-to-door hours ----
  let T: number;
  if (o.mode === 'AIR') T = accFrom + 2.0 /*check-in*/ + inVeh + 0.75 /*egress+bags*/ + accTo;
  else if (o.mode === 'RAIL') T = accFrom + 0.5 /*platform buffer*/ + inVeh + accTo;
  else T = inVeh + comfortStopHours(inVeh, tol) + accFrom + accTo; // road: stops count, access usually 0

  // ---- M: party money ----
  const farePp = (o.farePpMin != null && o.farePpMax != null) ? (o.farePpMin + o.farePpMax) / 2 : (ctx.fallbackFarePp ?? indicativeFarePp(o));
  const M = Math.round((farePp + (ctx.accessCostPp ?? 0)) * Math.max(1, ctx.pax));

  // ---- Φ: fatigue load for the weakest traveler ----
  const depMin = toMin(o.depTime ?? null);
  const arrMin = toMin(o.arrTime ?? null);
  // effective wake accounts for the road access BEFORE a flight/train (far-airport reality).
  const effectiveDepMin = depMin != null ? depMin - Math.round(accFrom * 60) : null;
  const Phi = legFatigue(o, tol, { roadQualityIndex: ctx.roadQualityIndex, month: ctx.month, depMin: effectiveDepMin, arrMin, overnight });

  // ---- Δ: day-damage — daylight destroyed at both ends (envelope incl. access) ----
  let Delta = 0;
  if (!overnight && depMin != null && arrMin != null) {
    const lo = depMin - Math.round(accFrom * 60);
    const hi = arrMin + Math.round(accTo * 60);
    const consumed = overlapMin(lo, hi, DAY_START, DAY_END);
    Delta = Math.max(0, Math.min(1, consumed / DAY_LEN));
    if (lo <= 11 * 60 && hi >= 15 * 60) Delta = Math.max(Delta, 0.9); // straddles the whole day
  }

  // ---- ρ: risk ----
  let rho = (5 - (o.reliability ?? 3)) / 4;
  if (o.seasonal) rho += 0.2;
  rho = Math.max(0, Math.min(1, rho));

  // ---- q: arrival-quality bonus (clock-quality truth) ----
  let q = 0;
  // F4 — THE MONEY REWARD WEARING A CONVENIENCE COSTUME.
  //
  // This line used to read `if (overnight) q += 1.0`, unconditionally. The hotel-night
  // saving — a MONEY reward — was being paid into q, the ARRIVAL-QUALITY term. And q is
  // exactly what a comfort-first TPP multiplies by 1.3. So the luxury dial, had we simply
  // wired it up, would have made the engine love the overnight train MORE. Law 3's "money
  // reward in a convenience costume" is not a metaphor; it was this line.
  //
  // For a comfort-first traveller it is now DELETED, not down-weighted. Down-weighting
  // cannot fix a mislabelled reward: the costume still walks. Only removal does.
  // (`ctx.rewardHotelNightSaving === false` ⇒ never paid. Absent ⇒ paid, as before.)
  if (overnight && ctx.rewardHotelNightSaving !== false) q += 1.0;   // manufactured day + hotel night saved
  if (arrMin != null && arrMin >= 5 * 60 + 30 && arrMin <= 9 * 60) q += 0.3;
  if (departsTooEarly(effectiveDepMin, tol)) q -= 0.6;
  if (arrivesTooLate(arrMin, tol)) q -= 0.6;

  // ---- HARD GATES (never relaxable) ----
  const blockReasons: string[] = [];
  const roadCap = roadDayHardCapExceeded(o, tol, { roadQualityIndex: ctx.roadQualityIndex, month: ctx.month });
  if (roadCap.exceeded) blockReasons.push(`road day ${roadCap.hrs.toFixed(1)} h exceeds the ${roadCap.capHrs} h cap for a ${tol.cls} party — split or use rail/air`);
  // chronotype: effective wake before the party's earliest civil start (§3.5)
  if (departsTooEarly(effectiveDepMin, tol) && !tol.redEyeOk) {
    blockReasons.push(`effective start ${fmtClock(effectiveDepMin!)} is before the ${fmtClock(tol.earliestStartMin)} floor for a ${tol.cls} party (access-adjusted)`);
  }
  // red-eye flight for a body that must avoid it
  if (o.mode === 'AIR' && depMin != null && depMin < 5 * 60 && !tol.redEyeOk) {
    blockReasons.push(`red-eye ${o.identifier ?? 'flight'} dep ${fmtClock(depMin)} — avoid for a ${tol.cls} party`);
  }
  // ---- THE RAIL-ORDEAL RULING (founder, 15 July 2026). US-860 organ 3. ------------------
  // The gate refused a 41-hour ROAD by name and passed a 43-hour TRAIN for a 56-year-old
  // luxury couple: the road had an hour cap, rail had none. His ruling: a 30-hour-plus
  // train is NEVER sold to a senior or comfort-first party. T here is the honest
  // door-to-door clock, so a train cannot shrink itself by hiding its access.
  if (o.mode === 'RAIL' && T >= RAIL_ORDEAL_REFUSE_HRS
      && (ctx.comfortFirst || tol.cls === 'elderly' || tol.cls === 'reduced_mobility')) {
    blockReasons.push(`${Math.round(T)} hours on a train is not a journey we will sell to ${ctx.comfortFirst ? 'a comfort-first party' : `a ${tol.cls} party`} — the ceiling is ${RAIL_ORDEAL_REFUSE_HRS} h (founder ruling, 15 Jul 2026)`);
  }
  // overnight used but coach class below the body floor
  if (overnight && !overnightClassOk(o.classes, tol)) {
    blockReasons.push(`overnight ${o.identifier ?? 'train'} class ${(o.classes ?? []).join('/') || '?'} below the ${tol.overnightClassFloor} floor for a ${tol.cls} party`);
  }
  // late civil arrival is a soft penalty already in q; a gross breach (>23:30) blocks for elderly/family
  if (!overnight && arrMin != null && arrMin > 23 * 60 + 30 && tol.noBackToBack) {
    blockReasons.push(`arrival ${fmtClock(arrMin)} past the civil ceiling for a ${tol.cls} party`);
  }
  // ---- US-603: THE DEAD HOURS (Law 5 — his reason, written at the moment of refusal) --
  // The gate that did not exist. A 03:50 arrival is not "cheap", it is not "a manufactured
  // day", and it is not a saving: it is a broken night and a ruined next day, which on a
  // six-night holiday is about a sixth of the whole trip. Where the traveller's contract
  // asks for it, this is INADMISSIBLE — not expensive. A price could be outvoted; a gate
  // cannot.
  //
  // The reason is written HERE, where the knowledge lives, in HIS words and not ours. It
  // must never be reconstructed downstream as "rejected — higher cost score".
  if (ctx.tighten?.deadHoursArrival && arrivesInDeadHours(arrMin)) {
    blockReasons.push(`it puts you in ${o.to} at ${spokenClock(arrMin!)} in the morning`);
  }

  return { T: round1(T), M, Phi, Delta: round2(Delta), rho: round2(rho), q: round2(q), hardBlock: blockReasons.length > 0, blockReasons };
}

/** Scalarize a DDCV under a weight vector (lower = better). Blocked options are +∞. */
export function ddcvScalar(v: DDCV, w: Weights): number {
  if (v.hardBlock) return Number.POSITIVE_INFINITY;
  return w.T * v.T
    + w.M * (v.M / SCALE.M)
    + w.Phi * v.Phi
    + w.Delta * (v.Delta * SCALE.Delta)
    + w.rho * (v.rho * SCALE.rho)
    - w.q * (v.q * SCALE.q);
}

export interface RankedOption { opt: LegOption; v: DDCV; scalar: number }

/**
 * Choose the winning option for a leg on DDCV. Returns the full ranking (for
 * decision records in Sprint 3) and an infeasible flag when EVERY candidate is
 * hard-blocked. Condition-(2) guarantee: if the only survivors are blocked (e.g.
 * no overnight train on a 600 km corridor), this returns infeasible — the caller
 * must negotiate/flag; it must NEVER emit a same-day road+fly chain as a fallback.
 */
export function chooseByDDCV(
  cands: { opt: LegOption; ctx: LegCtx }[], w: Weights,
): { winner: RankedOption | null; ranked: RankedOption[]; infeasible: boolean; blockReasons: string[] } {
  const scored: RankedOption[] = cands.map(({ opt, ctx }) => {
    const v = ddcv(opt, ctx);
    return { opt, v, scalar: ddcvScalar(v, w) };
  });
  const feasible = scored.filter((s) => Number.isFinite(s.scalar)).sort((a, b) => a.scalar - b.scalar);
  const ranked = scored.slice().sort((a, b) => a.scalar - b.scalar);
  if (!feasible.length) {
    const reasons = Array.from(new Set(scored.flatMap((s) => s.v.blockReasons)));
    return { winner: null, ranked, infeasible: true, blockReasons: reasons };
  }
  return { winner: feasible[0], ranked, infeasible: false, blockReasons: [] };
}

/**
 * §4.5 helper — build the airport-as-via-node context for a flight whose origin
 * airport is a road hop from city A. Folds the access drive into accessFromHrs so
 * the DDCV charges the real wake time and daylight loss. Sprint-1 provides the
 * COST HONESTY; full F2 "airport-day pattern" re-sequencing is Sprint 2 (§4.6).
 */
export function airportViaNodeCtx(base: LegCtx, roadAccessHrs: number, roadAccessCostPp = 0): LegCtx {
  return { ...base, accessFromHrs: (base.accessFromHrs ?? 0) + roadAccessHrs, accessCostPp: (base.accessCostPp ?? 0) + roadAccessCostPp };
}

// ---- helpers -----------------------------------------------------------------

/** Indicative per-person fare (₹) when the option has none (mirrors optimize.estCostPp). */
export function indicativeFarePp(o: LegOption): number {
  if (o.farePpMin != null && o.farePpMax != null) return (o.farePpMin + o.farePpMax) / 2;
  const km = o.distanceKm ?? 400;
  switch (o.mode) {
    case 'AIR': return Math.max(2500, Math.round(km * 5));
    case 'RAIL': return Math.round(km * 1.2) + 150;
    case 'FERRY': return Math.round(km * 3);
    default: return Math.round(km * 4);
  }
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;
function fmtClock(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** The clock as a person says it out loud: 230 → "3:50". Not "03:50", and never "230". */
export function spokenClock(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m % 60).padStart(2, '0')}`;
}
