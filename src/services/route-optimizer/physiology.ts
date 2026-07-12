/**
 * L1 — TRAVELER PHYSIOLOGY MODEL (Body Truth). Spec §2.1 (road speed model) + §3
 * (tolerance table, chronotype, fatigue). Pure + dependency-free; unit-testable
 * against fixtures with no DB or network.
 *
 * CENTRAL SHIFT (master prompt Sprint 1 / spec §13 step 1): every constraint is
 * expressed in terrain-adjusted VEHICLE-HOURS, not raw km. The legacy 350 km/day
 * rule survives ONLY as a DERIVED special case — on plains at ~55 km/h it
 * reproduces the same numbers (see derivedKmCap()).
 *
 * HARD/SOFT SPLIT (spec §14.1 + §15.4, enforced here): this module owns the HARD
 * GATES — per-day vehicle-hour caps, overnight class floors, chronotype windows,
 * altitude acclimatization. These are NON-LEARNABLE and can NEVER be relaxed by a
 * Traveler Psyche Profile. Soft comfort weights live in ddcv.ts and MAY be
 * modulated by TPP later. Keeping them in separate files makes that guarantee
 * structural, not a comment.
 */

import type { GroupProfile, LegOption } from './types';

// ---- physiology classes ------------------------------------------------------

export type PhysioClass = 'reduced_mobility' | 'elderly' | 'family' | 'midage' | 'young';

/** Weakest-first severity order (§3.1: the party constraint is the MINIMUM member). */
export const CLASS_SEVERITY: PhysioClass[] = ['reduced_mobility', 'elderly', 'family', 'midage', 'young'];

export interface Tolerance {
  cls: PhysioClass;
  /** soft cap — beyond this, fatigue accrues (ddcv q/Phi), but the day is still legal. */
  comfortableHrs: number;
  /** HARD cap — absolute terrain-adjusted in-vehicle hours/day. Strictly-greater = refused. */
  hardCapHrs: number;
  overnightTrainOk: boolean;
  /** minimum rail class for an overnight to be legal for this body (null = any, incl. SL). */
  overnightClassFloor: string | null;
  redEyeOk: boolean;
  /** no departure before this clock (minutes from midnight). */
  earliestStartMin: number;
  /** civil arrival ceiling (minutes from midnight). */
  latestArrivalMin: number;
  /** mandated comfort stops per road leg (COMFORT accounting only — NOT the hard gate). */
  comfortStopsPerLeg: number;
  /** F_cap for the fatigue ledger (§3.3) — used from Sprint 2, defined here for one source of truth. */
  fatigueCap: number;
  /** fatigue load multiplier (age_factor, §3.3). */
  ageFactor: number;
  /** elderly/reduced: no two consecutive travel days (§3.2 note). */
  noBackToBack: boolean;
}

/** §3.2 tolerance table, verbatim thresholds. */
export const TOLERANCE: Record<PhysioClass, Tolerance> = {
  reduced_mobility: { cls: 'reduced_mobility', comfortableHrs: 4.0, hardCapHrs: 4.5, overnightTrainOk: true, overnightClassFloor: '2A', redEyeOk: false, earliestStartMin: 8 * 60, latestArrivalMin: 20 * 60, comfortStopsPerLeg: 2, fatigueCap: 50, ageFactor: 1.45, noBackToBack: true },
  elderly:          { cls: 'elderly',          comfortableHrs: 4.5, hardCapHrs: 5.0, overnightTrainOk: true, overnightClassFloor: '2A', redEyeOk: false, earliestStartMin: 7 * 60 + 30, latestArrivalMin: 20 * 60, comfortStopsPerLeg: 2, fatigueCap: 55, ageFactor: 1.35, noBackToBack: true },
  family:           { cls: 'family',           comfortableHrs: 5.0, hardCapHrs: 6.0, overnightTrainOk: true, overnightClassFloor: '2A', redEyeOk: false, earliestStartMin: 7 * 60 + 30, latestArrivalMin: 19 * 60, comfortStopsPerLeg: 2, fatigueCap: 65, ageFactor: 1.10, noBackToBack: false },
  midage:           { cls: 'midage',           comfortableHrs: 6.0, hardCapHrs: 7.0, overnightTrainOk: true, overnightClassFloor: null, redEyeOk: true,  earliestStartMin: 6 * 60 + 30, latestArrivalMin: 22 * 60, comfortStopsPerLeg: 1, fatigueCap: 75, ageFactor: 1.00, noBackToBack: false },
  young:            { cls: 'young',            comfortableHrs: 8.0, hardCapHrs: 9.0, overnightTrainOk: true, overnightClassFloor: null, redEyeOk: true,  earliestStartMin: 5 * 60,      latestArrivalMin: 23 * 60, comfortStopsPerLeg: 0, fatigueCap: 90, ageFactor: 0.85, noBackToBack: false },
};

/** Map the engine's coarse GroupProfile onto a physiology class. An explicit
 *  override (from a party editor, later) wins — that is how 'young' / 'reduced_mobility'
 *  become reachable without breaking the existing 3-value contract. */
export function classForProfile(profile: GroupProfile | undefined, override?: PhysioClass): PhysioClass {
  if (override) return override;
  switch (profile) {
    case 'senior': return 'elderly';
    case 'family': return 'family';
    default: return 'midage';
  }
}

/** Party tolerance = the weakest member (§3.1). Given ≥1 class, pick the most limiting. */
export function partyTolerance(classes: PhysioClass[]): Tolerance {
  if (!classes.length) return TOLERANCE.midage;
  let weakest = classes[0];
  for (const c of classes) if (CLASS_SEVERITY.indexOf(c) < CLASS_SEVERITY.indexOf(weakest)) weakest = c;
  return TOLERANCE[weakest];
}

export function toleranceForProfile(profile: GroupProfile | undefined, override?: PhysioClass): Tolerance {
  return TOLERANCE[classForProfile(profile, override)];
}

// ---- §2.1 road speed model ---------------------------------------------------

/** roadQualityIndex: 5 trunk/expressway … 1 ghat/LWE/high-altitude. Unknown ⇒ 4 (NH). */
export function terrainSpeedKmh(roadQualityIndex?: number | null, month?: number | null): number {
  const rqi = roadQualityIndex == null ? 4 : Math.max(1, Math.min(5, Math.round(roadQualityIndex)));
  const base = rqi >= 5 ? 75 : rqi === 4 ? 55 : rqi === 3 ? 42 : rqi === 2 ? 30 : 22;
  const monsoon = month != null && month >= 6 && month <= 9;
  if (monsoon && rqi <= 2) return Math.round(base * 0.75); // ghat/hill wash-outs
  if (monsoon && rqi === 3) return Math.round(base * 0.9);
  return base;
}

export interface HoursCtx { roadQualityIndex?: number | null; month?: number | null }

/**
 * Terrain-adjusted IN-VEHICLE hours for a leg (the fatigue-relevant clock).
 *  - if the option carries a real durationMin (OSRM ×1.15 already terrain-real), use it;
 *  - else derive from km ÷ terrainSpeed (the pure §2.1 model).
 * Comfort stops are deliberately NOT added here — see hardCapExceeded(): stops are a
 * COMFORT quantity, not a feasibility breach, so they must not tip the hard gate.
 */
export function vehicleHours(leg: Pick<LegOption, 'mode' | 'durationMin' | 'distanceKm'>, ctx: HoursCtx = {}): number {
  if (leg.durationMin != null) return leg.durationMin / 60;
  if (leg.distanceKm != null) return leg.distanceKm / terrainSpeedKmh(ctx.roadQualityIndex, ctx.month);
  return 0;
}

/** Comfort-stop hours added on top of drive time for THIS body (display / fatigue only). */
export function comfortStopHours(baseHrs: number, tol: Tolerance): number {
  const stops = Math.min(tol.comfortStopsPerLeg, Math.floor(baseHrs / 2));
  return stops * (20 / 60);
}

/**
 * THE HARD GATE (gate a): a single ROAD day whose terrain-adjusted in-vehicle time
 * exceeds the party's hard cap is refused. Strictly-greater so a leg exactly at the
 * cap stays legal (matches the Ramayana ground-truth 213 km / 5.0 h senior drive).
 */
export function roadDayHardCapExceeded(
  leg: Pick<LegOption, 'mode' | 'durationMin' | 'distanceKm'>, tol: Tolerance, ctx: HoursCtx = {},
): { exceeded: boolean; hrs: number; capHrs: number } {
  const hrs = vehicleHours(leg, ctx);
  const exceeded = leg.mode === 'ROAD' && hrs > tol.hardCapHrs + 1e-9;
  return { exceeded, hrs, capHrs: tol.hardCapHrs };
}

/** The legacy km/day figure, DERIVED from the hour cap on plains (NH ~55 km/h). */
export function derivedKmCap(tol: Tolerance, month?: number | null): number {
  return Math.round(tol.hardCapHrs * terrainSpeedKmh(4, month));
}

// ---- chronotype gates (§3.5) -------------------------------------------------

export function departsTooEarly(depMin: number | null | undefined, tol: Tolerance): boolean {
  return depMin != null && depMin < tol.earliestStartMin;
}
export function arrivesTooLate(arrMin: number | null | undefined, tol: Tolerance): boolean {
  return arrMin != null && arrMin > tol.latestArrivalMin;
}

// ---- US-603: the dead hours — the gate that was missing -----------------------

/**
 * THE HOLE, and why a nine-hour train was allowed to put a honeymooner in Goa at 03:50.
 *
 * `arrivesTooLate` asks `arrMin > latestArrivalMin`. Arrival is minutes since midnight
 * OF THE ARRIVAL DAY. The Netravathi lands at 03:50, so arrMin = 230, and the ceiling is
 * about 22:00 = 1320. **230 > 1320 is false.** The gate looked at a 3:50 a.m. arrival and
 * read it as a pleasantly early one. `departsTooEarly` guards departures only. So the
 * window [midnight → the earliest civil start) ON THE ARRIVAL CLOCK belonged to no gate
 * at all, and every overnight service landing between 00:00 and ~07:00 sailed straight
 * through it.
 *
 * This closes it. The window is TWO-SIDED and wraps midnight: 23:00 → 07:00.
 *
 * Note on `arrDayOffset`: it deliberately does NOT enter this predicate. 03:50 is 03:50
 * whether the train left yesterday or this morning — the traveller's body is standing on
 * a platform in the dark either way. The offset costs him a broken night, and THAT is
 * priced in the ordeal function (E_break), not here.
 *
 * This is a PREDICATE, not a policy. It blocks nothing on its own: it becomes a hard gate
 * only where the traveller's contract asks for it (PlanContract.tighten.deadHoursArrival),
 * and for a mind that WANTS the cheap overnight train, it never fires at all.
 */
export const DEAD_HOURS_FROM = 23 * 60;  // 23:00
export const DEAD_HOURS_TO = 7 * 60;     // 07:00

export function arrivesInDeadHours(arrMin: number | null | undefined): boolean {
  if (arrMin == null) return false;
  const m = ((arrMin % 1440) + 1440) % 1440;   // normalise, whatever the caller hands us
  return m >= DEAD_HOURS_FROM || m < DEAD_HOURS_TO;
}

/** Overnight rail class floor (§3.2): elderly/family/reduced need ≥ 2A; mid/young any (SL ok). */
export function overnightClassOk(classes: string[] | undefined, tol: Tolerance): boolean {
  if (!tol.overnightClassFloor) return true;
  if (!classes || !classes.length) return false; // unknown coach data ⇒ cannot assert the floor is met
  const RANK: Record<string, number> = { '1A': 4, '2A': 3, '3A': 2, 'CC': 2, 'SL': 1, 'EC': 3 };
  const floor = RANK[tol.overnightClassFloor] ?? 3;
  return classes.some((c) => (RANK[c.toUpperCase()] ?? 0) >= floor);
}

// ---- §3.4 altitude module (gate stub; full acclimatization DP in Sprint 2) ----

/** Entry to ≥3000 m requires a mandatory 2-night acclimatization with a near-zero Day-1. */
export function altitudeAcclimatizationRequired(altitudeM?: number | null): boolean {
  return altitudeM != null && altitudeM >= 3000;
}

// ---- lite fatigue load (§3.3) — a Sprint-1 subset; full ledger lands Sprint 2 --

const MODE_FACTOR: Record<string, number> = { ROAD: 1.0, RAIL: 0.6, AIR: 0.8, FERRY: 0.9 };

/** Terrain factor from road quality (ghat harder). Neutral for non-road. */
function terrainFactor(mode: string, rqi?: number | null): number {
  if (mode !== 'ROAD') return 1;
  const q = rqi == null ? 4 : rqi;
  return q >= 5 ? 0.9 : q === 4 ? 1.0 : q === 3 ? 1.15 : q === 2 ? 1.35 : 1.5;
}

/**
 * Fatigue LOAD contribution of one leg for the weakest traveler (§3.3 load()).
 * Overnight rail is deliberately gentle (sleep) and earns a NEGATIVE-ish load via a
 * low mode factor; early starts and late arrivals add penalties. Returns a number in
 * roughly [0..~15]; the accumulating ledger (decay/streaks) is Sprint 2.
 */
export function legFatigue(
  leg: Pick<LegOption, 'mode' | 'durationMin' | 'distanceKm' | 'depTime' | 'arrTime'>,
  tol: Tolerance,
  ctx: HoursCtx & { depMin?: number | null; arrMin?: number | null; overnight?: boolean } = {},
): number {
  const hrs = vehicleHours(leg, ctx) + (leg.mode === 'ROAD' ? comfortStopHours(vehicleHours(leg, ctx), tol) : 0);
  const mode = (leg.mode as string) || 'ROAD';
  const modeF = ctx.overnight && mode === 'RAIL' ? 0.35 : (MODE_FACTOR[mode] ?? 1);
  let load = hrs * terrainFactor(mode, ctx.roadQualityIndex) * modeF * tol.ageFactor;
  if (departsTooEarly(ctx.depMin, tol)) load += 3;
  if (arrivesTooLate(ctx.arrMin, tol)) load += 2.5;
  return Math.round(load * 100) / 100;
}
