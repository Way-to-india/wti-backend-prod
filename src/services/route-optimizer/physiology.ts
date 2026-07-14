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
export function vehicleHours(leg: Pick<LegOption, 'mode' | 'durationMin' | 'distanceKm' | 'durationSource'>, ctx: HoursCtx = {}): number {
  // ---- THE TIGHTENING (US-803c; founder ruling, 2026-07-12) -------------------------
  //
  // THE DEFECT THIS REPLACES. The old first line was:
  //
  //     if (leg.durationMin != null) return leg.durationMin / 60;
  //
  // and the comment above it claimed OSRM x1.15 was "already terrain-real". IT IS NOT.
  // OSRM claims 79 km/h on the Guwahati-Shillong road. That road is 99 km of mountain:
  // better than three hours. THE ENGINE BELIEVED 1h26.
  //
  // And because this function feeds roadDayHardCapExceeded(), THE GATE THAT PROTECTS A
  // 56-YEAR-OLD'S SPINE COULD NOT FIRE ON A MOUNTAIN ROAD -- the one place it exists to
  // fire. A five-hour Himalayan day sailed through a five-hour cap. We would have sold a
  // man who asked for "comfortable" an ordeal, and called it comfort. That is the exact
  // crime THE-CONSULTANTS-LAW was written to stop, and 570 green assertions never saw it.
  //
  // THE RULE. On a ROAD leg the router's clock is an OPINION; the terrain is a FACT. We
  // take the SLOWER of the two. Never the faster. A marginal optimism may not buy a
  // traveller's discomfort -- not by a minute, not ever. (Law 3.)
  //
  // Math.max IS A TIGHTENING, and it is structurally incapable of being anything else: it
  // can never return a shorter day than either source claims, so no body gate can be
  // loosened through this line, by anyone, ever. Same doctrine as intent.ts/Tightening --
  // made unrepresentable rather than merely forbidden.
  //
  // RAIL and AIR are untouched. Their durationMin is a PUBLISHED TIMETABLE, not a guess:
  // a train takes exactly as long as the railway says it takes.
  if (leg.mode === 'ROAD') {
    const routerHrs = leg.durationMin != null ? leg.durationMin / 60 : null;
    const terrainHrs = leg.distanceKm != null
      ? leg.distanceKm / terrainSpeedKmh(ctx.roadQualityIndex, ctx.month)
      : null;

    // ---- US-800a — A MEASUREMENT IS NEVER FLOORED BY A GUESS -------------------------
    //
    // Everything written above is right for a GUESS and WRONG FOR A FACT.
    //
    // The climb-per-km model knows TERRAIN. IT DOES NOT KNOW ROAD CLASS. A national highway
    // climbs and STAYS FAST; the model slows it down anyway. Measured against Google on
    // 2026-07-12: NH66 Ratnagiri->Malvan, our model said 4h40 (37 km/h), the truth is 3h22
    // (50 km/h) -- AN HOUR TOO SLOW. On the Guwahati->Shillong mountain road the same model
    // is exactly right.
    //
    // IT CANNOT BE RE-TUNED OUT. Fit the coefficient to NH66 and the model then returns
    // 47 km/h for Guwahati->Shillong, which is 31: WRONG, AND IN THE DANGEROUS DIRECTION.
    // One coefficient cannot represent road class. The model is STRUCTURALLY INCAPABLE of
    // this, and no ratio guard separates the cases either (2.42x is right, 1.83x is wrong).
    //
    // So there is exactly one way out, and this is it: WHEN A MEASUREMENT EXISTS, TRUST THE
    // MEASUREMENT. Fit a model only for the roads nobody has driven -- and label it.
    //
    // THIS IS NOT A WEAKENING OF THE TIGHTENING. Every unmeasured road still gets the full
    // floor below, and 'measured' can only be written by the Google Directions adapter.
    // A road we have not measured is treated today exactly as it was yesterday.
    if (leg.durationSource === 'measured' && routerHrs != null) return routerHrs;

    if (routerHrs != null && terrainHrs != null) return Math.max(routerHrs, terrainHrs);
    return routerHrs ?? terrainHrs ?? 0;
  }
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
/**
 * ⚠️ US-834 — THE FOUNDER'S CONSENTED ROAD DAY. Ruling of 14 July 2026, verbatim:
 *
 *   "Do not make 275 a break point. For an old couple also 350 km can be outer limit for one
 *    day road travel, BUT STRICTLY AFTER EDUCATING THEM AND TAKING THEIR CONSENT."
 *
 * THIS DOES NOT LOOSEN A BODY GATE, AND IT CANNOT. `hardCapHrs` is untouched, and a leg over it
 * is still refused BY DEFAULT. What changes is what we DO with the refusal.
 *
 * We were silently dropping the trip. A 5.0 h cap for an elderly party is about 275 km of good
 * road, so a 340 km day simply vanished — and a real consultant does not do that. He says:
 *
 *   "Sir, that day is 340 kilometres, about six and a quarter hours with stops for tea and
 *    lunch. It is longer than I would normally plan for you. If you are happy with it, we can do
 *    it and you keep the extra night at the temple. If not, we break the drive."
 *
 * THAT IS LAW 4: WHEN THE PREFERENCE CANNOT BE MET, SAY SO OUT LOUD, NEVER SUBSTITUTE IN
 * SILENCE. The traveller's INFORMED CONSENT is his own word, and his word is the brief (Law 1).
 * The doctrine that physiology may only be tightened exists to stop THE ENGINE loosening a gate
 * FOR ITS OWN CONVENIENCE -- to save a hotel night. It was never meant to stop a grown man
 * telling us what he is willing to do with his own day.
 *
 * AND IT IS EXPRESSED IN HOURS, NOT KILOMETRES, ON PURPOSE. 350 km on a plain is a long but
 * civil day. 350 km in the Himalaya is TWELVE HOURS and nobody should consent to it because
 * nobody is told what they are consenting to. So the founder's number is converted ONCE, at the
 * founder-locked good-road ceiling of 55 km/h, and the resulting HOUR ceiling is what the gate
 * uses. On flat land it yields his 350 km exactly. In the hills it yields far fewer km, all by
 * itself -- the same way his 300 km ring shrinks into the mountains.
 */
export const ROAD_DAY_CONSENT_KM = 350;          // FOUNDER-LOCKED, 14 Jul 2026
export const GOOD_ROAD_KMH = 55;                 // the founder-locked road ceiling (see terrainSpeedKmh)
export const ROAD_DAY_CONSENT_HRS = ROAD_DAY_CONSENT_KM / GOOD_ROAD_KMH;   // 6.36 h

/** The longest road day this body may be ASKED to accept — never the longest it is GIVEN. */
export function consentedRoadDayHrs(tol: Tolerance): number {
  return Math.max(tol.hardCapHrs, ROAD_DAY_CONSENT_HRS);
}

export type RoadDayVerdict = 'comfortable' | 'needs_consent' | 'refused';

/**
 * Three verdicts, not two. The middle one is the founder's, and it is the one that was missing.
 *   comfortable    — inside his body's own cap. Plan it and say nothing.
 *   needs_consent  — over the cap but within the consented ceiling. EDUCATE HIM AND ASK.
 *   refused        — beyond even that. It is not a day, it is an ordeal. Break it or fly it.
 */
export function roadDayVerdict(
  leg: Pick<LegOption, 'mode' | 'durationMin' | 'distanceKm' | 'durationSource'>,
  tol: Tolerance, ctx: HoursCtx = {},
): { verdict: RoadDayVerdict; hrs: number; km: number; capHrs: number; consentHrs: number } {
  const hrs = vehicleHours(leg, ctx);
  const km = Math.round(leg.distanceKm ?? 0);
  const capHrs = tol.hardCapHrs;
  const consentHrs = consentedRoadDayHrs(tol);
  const verdict: RoadDayVerdict =
    hrs <= capHrs + 1e-9 ? 'comfortable'
    : hrs <= consentHrs + 1e-9 ? 'needs_consent'
    : 'refused';
  return { verdict, hrs, km, capHrs, consentHrs };
}

export function roadDayHardCapExceeded(
  leg: Pick<LegOption, 'mode' | 'durationMin' | 'distanceKm' | 'durationSource'>, tol: Tolerance, ctx: HoursCtx = {},
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
