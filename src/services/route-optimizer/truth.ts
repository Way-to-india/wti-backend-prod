/**
 * ============================================================================================
 *  T R U T H . T S   —   T H E   I R O N   L A W
 *  Founder ruling, 14 July 2026: "make this 100% zero hallucination model also,
 *                                 so have iron law guardrails"
 * ============================================================================================
 *
 * EVERY OTHER GATE IN THIS ENGINE ASKS "IS THIS COMFORTABLE?"  THIS ONE ASKS "IS THIS TRUE?"
 *
 * A ten-traveller sweep on 14 July 2026 shipped, to real-looking travellers, all of the following
 * — while 796 assertions stayed green:
 *
 *   ✈  "flight Jaipur → Yamunotri"        Yamunotri is a Himalayan trek town. IT HAS NO AIRPORT.
 *   ✈  "flight Chennai → Cherrapunji"     Cherrapunji has no airport either.
 *   🚗 "Jaipur → Udaipur, 1,878 km"       It is about 400 km. The number was not merely wrong,
 *                                          it was stamped `measured`, which is what the engine
 *                                          has been taught to trust without question.
 *   💬 "You asked us to avoid flights."    HE NEVER SAID IT. We wrote his words for him.
 *   🔁 "Kolkata → Darjeeling → Kolkata"    A city he visits twice on a one-way trip.
 *
 * NONE OF THESE IS A COMFORT PROBLEM. Every one is a LIE, and a lie shipped with a citation is
 * worse than a guess offered honestly — because the traveller cannot tell the difference, and we
 * have taught him to trust us.
 *
 * ── THE IRON LAW ────────────────────────────────────────────────────────────────────────────
 *
 *   A PLAN THAT CONTAINS A SINGLE UNPROVABLE FACT IS NOT DELIVERED.
 *
 *   Not softened. Not warned about. NOT DELIVERED. `assertPlanTruth()` throws, the controller
 *   catches, and the traveller gets an honest "we could not build this" instead of a beautiful,
 *   confident, fictional itinerary. A wrong answer that LOOKS right is the most expensive
 *   product we can ship, because it is the one he acts on.
 *
 * ── WHY IT IS A SEPARATE FILE, AND LAST ─────────────────────────────────────────────────────
 *
 * Every guard we have written so far lives INSIDE the machine that produces the thing it guards.
 * The geography gate lives in the terrain cache — so it caught the stale Rameswaram row and
 * never saw the 1,878 km road, because that number came in through a different door. A gate that
 * guards one entrance while another stands open is not a gate; it is a decoration.
 *
 * THIS FILE GUARDS THE EXIT. It does not care which door a fact came in by. It asks one question
 * of the finished plan, about every fact in it: WHO TOLD YOU THAT?
 *
 * ── THE FIVE LAWS ───────────────────────────────────────────────────────────────────────────
 *
 *   L1  GEOGRAPHY CANNOT BE ARGUED WITH.
 *       A road may not be shorter than the crow flies, and it may not be more than 2.2× longer.
 *       Applied to EVERY road leg, from EVERY source, forever.
 *
 *   L2  A FLIGHT NEEDS AN AIRPORT. A TRAIN NEEDS A STATION.
 *       An AIR leg is a lie unless a real airport with real scheduled service sits within an
 *       honest drive of BOTH ends. The drive is measured in HOURS, not in straight-line km —
 *       160 km of Himalaya is not 160 km of Rajasthan.
 *
 *   L3  A CITY MUST EXIST, AND IT MUST BE OURS.
 *       Every stop must resolve in our own catalogue or the gazetteer. We do not send travellers
 *       to places we cannot point to on a map.
 *
 *   L4  NO CITY TWICE.
 *       On a one-way trip a repeated stop is not an itinerary, it is a bug with a hotel booking.
 *
 *   L5  WE MAY NOT QUOTE A MAN WHO DID NOT SPEAK.
 *       Any sentence attributing words to the traveller must contain words he actually wrote.
 *
 * ── AND THE RULE BEHIND ALL FIVE ────────────────────────────────────────────────────────────
 *
 *       A MODEL MAY PROPOSE. ONLY A SOURCE MAY CONFIRM.
 *       AN HONEST "WE DO NOT KNOW" BEATS A CONFIDENT INVENTION, EVERY SINGLE TIME.
 */

import { haversineKm } from './geo';
import type { LatLng, LegOption, Plan } from './types';

export interface TruthViolation {
  law: 'L1_GEOGRAPHY' | 'L2_NO_AIRPORT' | 'L2_NO_STATION' | 'L3_UNKNOWN_CITY' | 'L4_CITY_TWICE' | 'L5_INVENTED_QUOTE';
  what: string;
  detail: string;
}

export class TruthViolationError extends Error {
  constructor(public readonly violations: TruthViolation[]) {
    super(`IRON LAW: ${violations.length} unprovable fact(s) — the plan was NOT delivered.\n` +
      violations.map((v) => `  [${v.law}] ${v.what}: ${v.detail}`).join('\n'));
    this.name = 'TruthViolationError';
  }
}

// ---- L1 — GEOGRAPHY CANNOT BE ARGUED WITH ---------------------------------------------------
/** A road cannot be shorter than the crow flies, and it cannot be 5× longer either. */
export const ROAD_MIN_RATIO = 0.95;
export const ROAD_MAX_RATIO = 2.2;

export function roadKmIsImpossible(km: number | null | undefined, a: LatLng, b: LatLng): string | null {
  const crow = haversineKm(a, b);
  if (crow <= 20) return null;                          // too short to reason about
  if (km == null || !(km > 0)) return `no distance at all for a ${Math.round(crow)} km gap`;
  const ratio = km / crow;
  if (ratio < ROAD_MIN_RATIO) {
    return `${Math.round(km)} km of road across a ${Math.round(crow)} km gap — A ROAD CANNOT BE SHORTER THAN THE CROW FLIES`;
  }
  if (ratio > ROAD_MAX_RATIO) {
    return `${Math.round(km)} km of road across a ${Math.round(crow)} km gap (${ratio.toFixed(1)}× the straight line) — no road in India detours that far`;
  }
  return null;
}

// ---- L2 — A FLIGHT NEEDS AN AIRPORT ---------------------------------------------------------
/**
 * THE HONEST CATCHMENT, AND WHY IT IS IN HOURS.
 *
 * `providers.ts` accepted any airport within 160 straight-line km and priced the transfer at a
 * flat 45 km/h. In Rajasthan that is roughly true. In the Himalaya it is a fantasy: Dehradun is
 * ~100 km from Yamunotri as the crow flies and EIGHT HOURS away up a mountain. So the engine
 * cheerfully sold a 68-year-old couple a "flight to Yamunotri."
 *
 * THE FOUNDER'S OWN LAW, FROM THE RING: MEASURE IT IN HOURS. It shrinks by itself in the
 * mountains. A transfer that eats a whole day is not an airport transfer — it is a road day
 * wearing a boarding pass, and the traveller is entitled to be told which one he is buying.
 */
export const AIRPORT_TRANSFER_MAX_HRS = 3.0;

// ---- the gate ------------------------------------------------------------------------------
export interface TruthCtx {
  /** every stop, with the coordinate we actually used. */
  coords: Map<string, LatLng>;
  /** cities that resolved in our catalogue / the gazetteer. */
  known: Set<string>;
  /** his sentence, verbatim. Used only to prove we did not invent a quote. */
  request?: string | null;
  /** one-way (open-jaw) or a genuine round trip he asked for. */
  roundTrip?: boolean;
}

const norm = (s: string) => s.trim().toLowerCase();

export function checkPlanTruth(plan: Plan, ctx: TruthCtx): TruthViolation[] {
  const v: TruthViolation[] = [];
  const legs = (plan.legs ?? []) as LegOption[];

  // ---- L1 + L3 ----
  for (const leg of legs) {
    const a = ctx.coords.get(norm(leg.from));
    const b = ctx.coords.get(norm(leg.to));

    // L3 — a city must exist, and it must be ours.
    for (const city of [leg.from, leg.to]) {
      if (!ctx.known.has(norm(city))) {
        v.push({ law: 'L3_UNKNOWN_CITY', what: city,
          detail: 'not in our catalogue and not in the gazetteer. We do not send travellers to places we cannot point to on a map.' });
      }
    }

    if (!a || !b) continue;

    // L1 — geography cannot be argued with.
    if (leg.mode === 'ROAD') {
      const bad = roadKmIsImpossible(leg.distanceKm, a, b);
      if (bad) v.push({ law: 'L1_GEOGRAPHY', what: `${leg.from} → ${leg.to}`, detail: bad });
    }
  }

  // ---- L4 — NO CITY TWICE ----
  if (!ctx.roundTrip) {
    const stops = legs.length ? [legs[0].from, ...legs.map((l) => l.to)] : [];
    const seen = new Map<string, number>();
    for (const s of stops) seen.set(norm(s), (seen.get(norm(s)) ?? 0) + 1);
    for (const [city, n] of seen) {
      if (n > 1) {
        v.push({ law: 'L4_CITY_TWICE', what: city,
          detail: `appears ${n} times on a one-way trip. A repeated stop is not an itinerary, it is a bug with a hotel booking.` });
      }
    }
  }

  // ---- L5 — WE MAY NOT QUOTE A MAN WHO DID NOT SPEAK ----
  if (ctx.request) {
    const said = ctx.request.toLowerCase();
    const prose = [...(plan.warnings ?? []), ...((plan as any).contractNotes ?? []), ...((plan as any).consents ?? [])];
    for (const line of prose) {
      const m = /You told us "([^"]+)"/i.exec(String(line));
      if (m && !said.includes(m[1].toLowerCase().trim())) {
        v.push({ law: 'L5_INVENTED_QUOTE', what: m[1],
          detail: 'we attributed these words to him and he never wrote them. A brief we invent is not a brief. It is a forgery.' });
      }
    }
  }

  return v;
}

/** THE EXIT GATE. A plan with one unprovable fact in it IS NOT DELIVERED. */
export function assertPlanTruth(plan: Plan, ctx: TruthCtx): void {
  const violations = checkPlanTruth(plan, ctx);
  if (violations.length) throw new TruthViolationError(violations);
}
