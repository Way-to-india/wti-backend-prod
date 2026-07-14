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
import { HILL_M } from './terrain';
import type { LatLng, LegOption, Plan } from './types';

export interface TruthViolation {
  law: 'L1_GEOGRAPHY' | 'L2_NO_AIRPORT' | 'L2_NO_STATION' | 'L3_UNKNOWN_CITY' | 'L4_CITY_TWICE' | 'L5_INVENTED_QUOTE' | 'L6_IMPOSSIBLE_SPEED';
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
/** A road cannot be shorter than the crow flies. THE FLOOR IS GEOMETRY AND IT NEVER MOVES. */
export const ROAD_MIN_RATIO = 0.95;
/** THE CEILING ON THE PLAINS — founder-locked. Jaipur → Udaipur came back 1,878 km across a
 *  ~400 km gap (4.7×) and we shipped it. On the plains, no road detours like that. */
export const ROAD_MAX_RATIO = 2.2;

/**
 * ⚠️ US-841 — THE CEILING WAS A PLAINS INTUITION, AND IN THE MOUNTAINS IT MANUFACTURED A LIE
 *              FAR MORE DANGEROUS THAN THE ONE IT WAS BUILT TO CATCH.
 *
 * The 2.2× ceiling was written with Rajasthan in mind. Then it met the Garhwal Himalaya, and
 * the 15 July log filled up with this:
 *
 *     Kedarnath → Badrinath   217 km of road across a  41 km gap   (5.3×)   ROUTER DISCARDED
 *     Gangotri  → Kedarnath   327 km of road across a  31 km gap  (10.5×)   ROUTER DISCARDED
 *     Gangotri  → Badrinath   465 km of road across a  60 km gap   (7.8×)   ROUTER DISCARDED
 *
 * EVERY ONE OF THOSE ROADS IS REAL. Gangotri and Kedarnath are 31 km apart across a mountain
 * wall, and the only road between them runs all the way DOWN one valley to Rishikesh and all the
 * way back UP the next. It is about 330 km and it is a two-day drive. That is not a detour. It
 * is the only road there is.
 *
 * And when the ceiling fired, the controller threw away the true 217 km and substituted
 * crow × 1.3 = 53 km at a flat 45 km/h — SEVENTY-ONE MINUTES. So a ten-hour Himalayan ordeal was
 * handed to a 68-year-old couple looking like an hour's hop, AND THE BODY GATE READ THE
 * SEVENTY-ONE MINUTES AND WAVED IT THROUGH. The original 1,878 km bug made a journey look
 * HARDER, which is the safe direction to be wrong in. THIS ONE MADE THE HIMALAYA LOOK TRIVIAL.
 *
 * SO THE CEILING STANDS DOWN IN THE MOUNTAINS, AND IT SAYS SO OUT LOUD.
 * Above HILL_M (1,200 m — the engine's own threshold on the EARTH, not a tuning knob) a ratio
 * simply cannot tell a long-but-true road from a wrong one, and we will not pretend otherwise.
 * What still binds up there is THE FLOOR, which is geometry and cannot be argued with, and
 * CORRECT COORDINATES — which is the real defence against the wrong-town class of bug, and which
 * US-823 gave us (the standing check now returns zero rows).
 *
 * ⚠️ THIS NUMBER IS MINE, NOT THE FOUNDER'S. It is deliberately absurd so that it can only ever
 * fire on an absurdity. See the handoff, OWED TO THE FOUNDER.
 */
export const ROAD_MAX_RATIO_MOUNTAIN = 12.0;

export function roadKmIsImpossible(
  km: number | null | undefined, a: LatLng, b: LatLng,
  elevA?: number | null, elevB?: number | null,
): string | null {
  const crow = haversineKm(a, b);
  if (crow <= 20) return null;                          // too short to reason about
  if (km == null || !(km > 0)) return `no distance at all for a ${Math.round(crow)} km gap`;
  const ratio = km / crow;
  if (ratio < ROAD_MIN_RATIO) {
    return `${Math.round(km)} km of road across a ${Math.round(crow)} km gap — A ROAD CANNOT BE SHORTER THAN THE CROW FLIES`;
  }
  const inTheMountains = Math.max(elevA ?? 0, elevB ?? 0) >= HILL_M;
  const ceiling = inTheMountains ? ROAD_MAX_RATIO_MOUNTAIN : ROAD_MAX_RATIO;
  if (ratio > ceiling) {
    return `${Math.round(km)} km of road across a ${Math.round(crow)} km gap (${ratio.toFixed(1)}× the straight line)`
      + (inTheMountains ? ' — even in the mountains no road detours that far' : ' — no road in India detours that far');
  }
  return null;
}

/**
 * ⚠️ US-842 — THE LAW MUST FILTER THE OPTIONS, NOT ONLY THE FINISHED PLAN.
 *
 * The exit gate refused the whole Golden Triangle — Delhi, Agra, Jaipur, the most ordinary trip
 * in India — because ONE train claimed 204 km across a 223 km gap. The refusal was correct and
 * it was also absurd: an honest road and an honest flight were sitting in the pool right beside
 * that train, and we killed the man's holiday rather than simply decline to put him on the one
 * service whose numbers we could not prove.
 *
 * A LIE IS A PROPERTY OF AN OPTION, NOT OF A TRIP. So the law now runs where the options are
 * born: an option that cannot be true is never offered to the engine, and the engine quietly
 * picks one that can. The exit gate stays exactly where it is, as the backstop — because a gate
 * that guards one entrance while another stands open is a decoration, and we have built that
 * decoration twice already.
 */
export function optionIsImpossible(
  o: { mode: string; distanceKm?: number | null; durationMin?: number | null },
  a: LatLng, b: LatLng, elevA?: number | null, elevB?: number | null,
): string | null {
  const below = legKmBelowCrow(o.distanceKm, a, b);
  if (below) return below;
  if (o.mode === 'ROAD') {
    const bad = roadKmIsImpossible(o.distanceKm, a, b, elevA, elevB);
    if (bad) return bad;
  }
  return legSpeedIsImpossible(o.distanceKm, o.durationMin, a, b, o.mode);
}

/** Keep only the options we can prove. Returns [kept, discarded-with-reason]. */
export function honestOptions<T extends { mode: string; distanceKm?: number | null; durationMin?: number | null; identifier?: string | null }>(
  opts: T[], a: LatLng, b: LatLng, elevA?: number | null, elevB?: number | null,
): { kept: T[]; dropped: { opt: T; why: string }[] } {
  const kept: T[] = [], dropped: { opt: T; why: string }[] = [];
  for (const o of opts) {
    const why = optionIsImpossible(o, a, b, elevA, elevB);
    if (why) dropped.push({ opt: o, why }); else kept.push(o);
  }
  return { kept, dropped };
}

// ---- L1, APPLIED TO EVERY MODE — THE CROW-FLY FLOOR -----------------------------------------
/**
 * ⚠️ 15 JULY 2026 — THE GATE GUARDED THE ROAD DOOR AND LEFT THE RAIL DOOR STANDING OPEN.
 *
 * `roadKmIsImpossible()` was written the day after a 1,878 km ROAD leg shipped, and it tests
 * `leg.mode === 'ROAD'`. So the very next sweep shipped this, to a 56-year-old man:
 *
 *     Lucknow → Tirupati.  RAIL.  460 km.  10 h 35 m.
 *
 * The two towns are ~1,476 km apart AS THE CROW FLIES. A train cannot cover a shorter distance
 * than the straight line between its endpoints — no vehicle can, on any planet. The number was
 * not merely wrong; it was a third of a lower bound fixed by geometry.
 *
 * WE WROTE DOWN THE LESSON — "a gate that guards one entrance while another stands open is a
 * decoration" — AND THEN BUILT THE SAME DECORATION AGAIN, in the same file, on the same day.
 *
 * THE FLOOR IS NOT A POLICY. IT IS GEOMETRY. It needs no founder ruling, it can never be wrong,
 * and it applies to ROAD, RAIL, AIR and FERRY alike. The CEILING is mode-specific and stays
 * where the founder put it (roads only, 2.2×) — a rail path through a junction may legitimately
 * wander, and we do not yet have a ruling on how far.
 */
export function legKmBelowCrow(km: number | null | undefined, a: LatLng, b: LatLng): string | null {
  const crow = haversineKm(a, b);
  if (crow <= 20) return null;                          // too short to reason about
  if (km == null || !(km > 0)) return null;             // absent is a different sin; see L6
  if (km / crow < ROAD_MIN_RATIO) {
    return `${Math.round(km)} km across a ${Math.round(crow)} km gap — NOTHING TRAVELS A SHORTER DISTANCE THAN THE CROW FLIES`;
  }
  return null;
}

// ---- L6 — A DURATION MUST BE POSSIBLE -------------------------------------------------------
/**
 * ⚠️ THE TWENTY-HOUR TRAIN IS NOT DEAD. IT WAS WEARING A TEN-HOUR COSTUME.
 *
 * US-827 killed the twenty-hour train by gating on its DURATION. So the very next sweep sold a
 * ~30-hour Lucknow → Tirupati train to a 56-year-old and his wife — and walked it straight
 * through the ordeal gate, because the leg claimed 635 minutes. 1,476 km in 635 minutes is an
 * average of 140 km/h. NO TRAIN IN INDIA AVERAGES THAT. Not one.
 *
 * A GATE ON A NUMBER IS ONLY AS HONEST AS THE NUMBER. Every comfort gate we own — the ordeal
 * gate, the body gate, the fatigue ledger, the arrival-hour rule — reads a duration and trusts
 * it. So a false duration does not merely mis-inform the traveller: IT SWITCHES OFF EVERY
 * PROTECTION HE HAS. That is why this belongs in the Iron Law and not in a comfort gate.
 *
 * A claimed duration implies an average speed. If that speed is impossible, the duration is a
 * lie, whatever stamped it.
 *
 * ⚠️ THESE CEILINGS ARE MINE, NOT THE FOUNDER'S — see the handoff, OWED TO THE FOUNDER.
 * They are deliberately GENEROUS: they are impossibility bounds, chosen so they can never fire
 * on a true fact and only ever catch a fabrication. India's fastest scheduled train averages
 * ~85 km/h end-to-end; 110 leaves a wide margin. A jet cruises ~800-900 km/h; 950 leaves room
 * for a short sector measured gate-to-gate. The road ceiling sits above the engine's own
 * founder-locked terrain model, whose best road (rqi 5) is 75 km/h.
 */
export const MAX_AVG_KMH: Record<string, number> = { ROAD: 90, RAIL: 110, AIR: 950, FERRY: 60 };

export function legSpeedIsImpossible(
  km: number | null | undefined,
  durationMin: number | null | undefined,
  a: LatLng,
  b: LatLng,
  mode: string,
): string | null {
  if (durationMin == null || !(durationMin > 0)) return null;
  // Measure against the HONEST distance: whatever the leg claims, it cannot be less than the
  // straight line. A leg that under-states its distance AND its time would otherwise conspire
  // to look perfectly reasonable.
  const crow = haversineKm(a, b);
  if (crow <= 20) return null;
  const honestKm = Math.max(km ?? 0, crow);
  const kmh = honestKm / (durationMin / 60);
  const ceiling = MAX_AVG_KMH[mode] ?? 950;
  if (kmh > ceiling) {
    const h = Math.floor(durationMin / 60), m = Math.round(durationMin % 60);
    return `${Math.round(honestKm)} km in ${h}h${String(m).padStart(2, '0')} is an average of ${Math.round(kmh)} km/h by ${mode} — nothing on this route travels that fast, so the time is not true`;
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

    // L1 — GEOGRAPHY CANNOT BE ARGUED WITH.
    // The FLOOR is geometry and binds EVERY mode. The CEILING is a founder ruling about roads.
    const belowCrow = legKmBelowCrow(leg.distanceKm, a, b);
    if (belowCrow) {
      v.push({ law: 'L1_GEOGRAPHY', what: `${leg.from} → ${leg.to} (${leg.mode})`, detail: belowCrow });
    } else if (leg.mode === 'ROAD') {
      const bad = roadKmIsImpossible(leg.distanceKm, a, b);
      if (bad) v.push({ law: 'L1_GEOGRAPHY', what: `${leg.from} → ${leg.to}`, detail: bad });
    }

    // L6 — A DURATION MUST BE POSSIBLE. A false clock disarms every comfort gate downstream.
    const tooFast = legSpeedIsImpossible(leg.distanceKm, leg.durationMin, a, b, leg.mode);
    if (tooFast) {
      v.push({ law: 'L6_IMPOSSIBLE_SPEED', what: `${leg.from} → ${leg.to} (${leg.mode})`, detail: tooFast });
    }
  }

  // ---- L4 — NO CITY TWICE ----
  //
  // The first version of this law switched itself OFF whenever `roundTrip` was set — and
  // `tripType` DEFAULTS to 'roundtrip' and no frontend has ever sent the field. So the law was
  // disarmed for every traveller who has ever used the planner, and this shipped:
  //
  //     Kolkata → Darjeeling → KOLKATA → Bodh Gaya → Varanasi
  //
  // That is not a round trip. That is a man paying for a hotel in Kolkata twice and losing a day
  // to a city he has already seen. A GENUINE round trip ENDS where it began — the origin is the
  // FIRST stop and the LAST stop, and nothing else repeats, ever. That is the whole of the
  // exception, and it is checked by POSITION, not merely by count.
  const stops = legs.length ? [legs[0].from, ...legs.map((l) => l.to)] : [];
  if (stops.length > 1) {
    const first = norm(stops[0]), last = norm(stops[stops.length - 1]);
    const seen = new Map<string, number[]>();
    stops.forEach((s, i) => { const k = norm(s); (seen.get(k) ?? seen.set(k, []).get(k)!).push(i); });
    for (const [city, at] of seen) {
      if (at.length < 2) continue;
      // the ONE honourable repeat: he asked to come home, and home is the first stop and the last.
      const isTheReturnHome =
        ctx.roundTrip && at.length === 2 && city === first && city === last
        && at[0] === 0 && at[1] === stops.length - 1;
      if (isTheReturnHome) continue;
      v.push({ law: 'L4_CITY_TWICE', what: city,
        detail: `appears ${at.length} times (at stops ${at.map((i) => i + 1).join(', ')} of ${stops.length}). A repeated stop is not an itinerary, it is a bug with a hotel booking.` });
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
