/**
 * L2b — THE ORDEAL FUNCTION. Sprint 7 / US-605. Pure + dependency-light.
 *
 * THE-CONSULTANTS-LAW.md, Law 2: "The mode is not the point. The comfort of the journey is."
 *
 *   "No trains" does NOT mean "no road". Bengaluru → Mysuru → Coorg by car is short,
 *   scenic and chauffeur-driven — THAT IS THE LUXURY. A nine-hour train arriving at 03:50
 *   is not. What the traveller is really refusing is THE ORDEAL, not the rolling stock.
 *
 * So the engine cannot dial on `mode`. It must dial on:
 *   - how long the journey is,
 *   - what hour it deposits him,
 *   - and whether he is being driven, or is enduring.
 *
 * This module is that dial: one number per candidate leg, in comfort-cost points.
 *
 *   ordeal(leg, party) = [ E_dur × endure + E_clock + E_break + E_xfer ] × partyFactor
 *
 * HONESTY ABOUT THE NUMBERS (the brief demanded it): the SHAPES are principled — convexity,
 * the chauffeur discount, the circadian trough, the weakest-member rule. The exact
 * BREAKPOINTS AND SLOPES ARE TUNED BY US, and are marked [T] below. They are pinned by the
 * founder's own verdicts in ordeal.test.ts, which is the only warrant they have. Do not
 * quietly re-tune them; a test will tell you what you broke, and it will be right.
 *
 * This function does NOT block anything. It produces a number. The gates that use it live
 * in the contract (intent.ts ceilings) and are enforced in consultantChoose (US-606).
 */

import type { LegOption, Mode } from './types';
import type { PhysioClass } from './physiology';
import type { BudgetStance, Tightening } from './intent';
import { toMin, isTrueOvernight } from './constraints';

// ---- who is enduring ---------------------------------------------------------

export interface OrdealParty {
  /** the WEAKEST member's class — same doctrine as physiology.ts. The party travels at
   *  the pace of the person who finds it hardest, always. */
  cls: PhysioClass;
  /** what money means to this traveller. It changes what a berth IS: the same overnight
   *  is a fair bargain to one mind and an ordeal to another. */
  budgetStance?: BudgetStance | null;
}

const isComfortFirst = (p: OrdealParty) => p.budgetStance === 'comfort_first' || p.budgetStance === 'money_no_object';

// ---- 1. the duration curve — convex, because hour seven hurts more than hour two ----

/**
 * Fatigue does not accumulate in a straight line. The sixth hour in a vehicle costs more
 * than the second; the ninth costs more than the sixth. A model that is linear in hours
 * says a 9-hour journey is exactly three 3-hour journeys, and no traveller who has ever
 * done one believes that.
 *
 * PRINCIPLED: the convexity. [T] TUNED: the breakpoints (3 h, 6 h) and the slopes.
 */
export function durationOrdeal(hrs: number): number {
  const h = Math.max(0, hrs);
  if (h <= 3) return 8 * h;                    // a morning's drive
  if (h <= 6) return 24 + 12 * (h - 3);        // it is now a Journey
  return 60 + 16 * (h - 6);                    // it is now an endurance test
}

// ---- 2. endurance — who is enduring, and in what seat --------------------------

/**
 * The chauffeur discount is the most important number in this file, and it is the one the
 * founder's ruling turns on. A man in the back of a car with a driver is not working: he
 * is looking out of the window at the Mysuru road. A man in a seat on a nine-hour train is
 * enduring it. Same "transport", different human experience — so ROAD is DISCOUNTED (0.55)
 * while a comfort-first overnight is PENALISED (1.5).
 *
 * Note the asymmetry on the overnight, which is P5 made flesh: to a price-first family the
 * sleeper is a fair deal they chose (0.8 — it genuinely IS their best answer). To a
 * comfort-first honeymooner, a night that is not spent in his hotel is itself the cost
 * (1.5). The same berth. Two different minds. One engine, honest to both.
 *
 * [T] every value in this table. PRINCIPLED: the chauffeur discount and the asymmetry.
 */
/**
 * TWO DIFFERENT QUESTIONS, AND THE ENGINE MUST NOT CONFUSE THEM.
 *
 *   isTrueOvernight(leg)      — a COMMERCIAL question: does this service save a hotel
 *                               night? (Boards 20:00–23:30, lands 05:30–09:30. The
 *                               "Sabarmati rule".)
 *   travelsThroughNight(leg)  — a PHYSIOLOGICAL question: is this traveller awake, or
 *                               half-awake, in a vehicle during the hours his body wants
 *                               to be asleep?
 *
 * Confusing the two is exactly the error that produced F4 — a money reward paid into the
 * comfort term. So the ordeal function, which is about a human being, asks the second
 * question only.
 *
 * The distinction is not academic. THE NETRAVATHI IS NOT A TRUE OVERNIGHT BY OUR OWN RULE:
 * nine hours ending at 03:50 means it boards at 18:50, well before the 20:00 window. It
 * never earned a hotel night. It is simply a night-wrecker — and the engine praised it for
 * saving one.
 */
export function travelsThroughNight(o: LegOption): boolean {
  if ((o.arrDayOffset ?? 0) >= 1) return true;
  const inNight = (m: number | null) => m != null && (m >= DEAD_FROM || m < DEAD_TO);
  return inNight(toMin(o.depTime ?? null)) || inNight(toMin(o.arrTime ?? null));
}

const hasBerth = (o: LegOption) => (o.classes ?? []).some((c) => ['1A', '2A', '3A'].includes(c.toUpperCase()));

// ---- THE RAIL-ORDEAL RULING (founder, 15 July 2026) -------------------------------------
//
// THE HOLE IT CLOSES: the body gate refused a 41-hour ROAD by name -- and passed a 43-hour
// TRAIN for a 56-year-old luxury couple who had written "prefer flights wherever possible"
// (US-860, found by the founder himself on the live page). The road had an hour cap; rail
// had NONE. A gate that weighs one mode's hours and not another's is a decoration.
//
// THE RULING, his word: an advisory for EVERYONE at 24 hours and above; a HARD REFUSAL for
// a senior or comfort-first (luxury/premium) party at 30 hours and above. The refusal is a
// body-truth gate: BLOCKED, not merely expensive -- and like every refusal it must arrive
// with an honest alternative or an honest apology, never in silence.
export const RAIL_ORDEAL_ADVISORY_HRS = 24;
export const RAIL_ORDEAL_REFUSE_HRS = 30;

export function endurance(o: LegOption, party: OrdealParty): number {
  switch (o.mode) {
    case 'ROAD':
      return 0.55;                       // chauffeur-driven — the WTI product. Half-rest.
    case 'AIR':
      return 0.75;                       // fast, but airports are labour
    case 'FERRY':
      return 1.0;
    case 'RAIL': {
      const night = travelsThroughNight(o);
      if (!night) return 0.9;            // a day train is a civilised way to travel
      // A night not spent in his hotel is ITSELF the cost. He asked for comfort.
      if (isComfortFirst(party)) return 1.5;
      // He chose this, the berth is a real bed, AND the service actually gives him a
      // night's sleep. That is a fair bargain, and the engine should say so.
      if (isTrueOvernight(o) && hasBerth(o)) return 0.8;
      // Everything else that runs through the night: a seat instead of a bed, or a "sleeper"
      // that tips him onto a platform at 3:50 a.m. Cheap is not the same as kind, and we do
      // not pretend otherwise even for the traveller who asked for cheap.
      return 1.1;
    }
    default:
      return 1.0;
  }
}

// ---- 3. the clock — the circadian term that catches 03:50 ----------------------

const DEAD_FROM = 23 * 60;   // 23:00
const DEAD_TO = 7 * 60;      // 07:00

/**
 * THE TERM THAT SHOULD HAVE REFUSED THE NETRAVATHI.
 *
 * A 03:50 arrival is not "early". It lands the traveller in the 02:00–05:00 circadian
 * trough — the hours in which the human body is least able to do anything at all — and it
 * destroys the following day. On a six-night holiday that is about a sixth of the trip,
 * bought for the price of one hotel night.
 *
 * PRINCIPLED: the trough (textbook sleep science) and the shape — worst in the small
 * hours, easing towards a normal morning. [T] TUNED: the point values.
 */
export function clockOrdeal(depMin: number | null, arrMin: number | null): number {
  let e = 0;

  // departures: the pre-dawn start is its own small cruelty
  if (depMin != null) {
    if (depMin < 5 * 60) e += 14;                              // before 05:00
    else if (depMin < 7 * 60) e += 6;                          // 05:00–07:00
  }

  if (arrMin != null) {
    const m = ((arrMin % 1440) + 1440) % 1440;
    if (m > 21 * 60 && m < DEAD_FROM) e += 8;                  // a late, tired arrival (21:00–22:59)
    if (m >= DEAD_FROM || m < DEAD_TO) {
      // minutes into the night, counting from 23:00 (wraps midnight)
      const n = ((m - DEAD_FROM + 1440) % 1440);
      if (n < 180) e += 20 + (20 * n) / 180;                   // 23:00 → 02:00 : 20 → 40
      else if (n < 360) e += 40;                               // 02:00 → 05:00 : the trough
      else e += 40 - (28 * (n - 360)) / 120;                   // 05:00 → 07:00 : 40 → 12
    }
  }
  return e;
}

// ---- 4. the broken night, and the changes of vehicle ---------------------------

/**
 * A journey that lands on a different calendar day costs a night — not a hotel night, a
 * SLEEP. It is waived only when the traveller genuinely chose the overnight and the berth
 * meets his class floor: his night, his choice, his saving. It is never waived for a mind
 * that asked for comfort.
 */
export function breakOfDayOrdeal(o: LegOption, party: OrdealParty): number {
  if ((o.arrDayOffset ?? 0) < 1) return 0;
  // Waived ONLY when he genuinely chose the overnight, the berth is a real bed, and the
  // service actually gives him a night's sleep (isTrueOvernight — boards late, lands after
  // dawn). A train that decants him at 03:50 has taken his night and given him nothing back,
  // and it is charged for that whoever is on board.
  const wantsIt = !isComfortFirst(party) && isTrueOvernight(o) && hasBerth(o);
  return wantsIt ? 0 : 12;   // [T]
}

/** Every change of vehicle is a small tax on the traveller's patience. [T] (Sprint 8 —
 *  US-612 — replaces these with the transport-economics numbers: a flat ~15 in-vehicle
 *  minutes per transfer, and waiting time at 1.5×.) */
export function transferOrdeal(transfers = 0, minConnectionMin?: number | null): number {
  let e = 6 * Math.max(0, transfers);
  if (transfers > 0 && minConnectionMin != null && minConnectionMin < 45) e += 4;
  return e;
}

// ---- 5. the party factor — the weakest member, always --------------------------

/** [T] values; PRINCIPLED: the weakest-member doctrine, straight from physiology.ts. */
export const PARTY_FACTOR: Record<PhysioClass, number> = {
  reduced_mobility: 1.5,
  elderly: 1.35,
  family: 1.2,
  midage: 1.0,
  young: 0.9,
};

// ---- the function ---------------------------------------------------------------

export interface OrdealCtx {
  /** HONEST door-to-door hours (hotel A → hotel B, all buffers). The caller passes the
   *  DDCV's T, which already folds in airport access, check-in and egress — so a "2-hour
   *  flight" from a far airport is correctly counted as the five-hour day it really is.
   *  Absent ⇒ we fall back to the leg's own duration, which is honest but narrower. */
  doorToDoorHrs?: number | null;
  transfers?: number;
  minConnectionMin?: number | null;
}

export interface Ordeal {
  total: number;
  band: OrdealBand;
  parts: { duration: number; endurance: number; clock: number; breakOfDay: number; transfers: number; party: number };
}

export type OrdealBand = 'pleasant' | 'fine' | 'heavy' | 'ordeal';

/** 0–25 pleasant · 25–45 fine · 45–70 heavy · ≥70 ordeal. */
export function bandOf(total: number): OrdealBand {
  if (total < 25) return 'pleasant';
  if (total < 45) return 'fine';
  if (total < 70) return 'heavy';
  return 'ordeal';
}

/** The width of an ordeal band for lexicographic ranking (US-606): inside ε, two journeys
 *  are "the same comfort", and only then may anything else — including money — separate
 *  them. This is the number that makes Law 3 provable. */
export const BAND_EPS = 8;

export function ordeal(o: LegOption, party: OrdealParty, ctx: OrdealCtx = {}): Ordeal {
  const hrs = ctx.doorToDoorHrs != null && Number.isFinite(ctx.doorToDoorHrs)
    ? ctx.doorToDoorHrs
    : (o.durationMin ?? 0) / 60;

  const eDur = durationOrdeal(hrs);
  const end = endurance(o, party);
  const eClock = clockOrdeal(toMin(o.depTime ?? null), toMin(o.arrTime ?? null));
  const eBreak = breakOfDayOrdeal(o, party);
  const eXfer = transferOrdeal(ctx.transfers ?? 0, ctx.minConnectionMin ?? null);
  const pf = PARTY_FACTOR[party.cls] ?? 1.0;

  const total = (eDur * end + eClock + eBreak + eXfer) * pf;
  const rounded = Math.round(total * 10) / 10;
  return {
    total: rounded,
    band: bandOf(rounded),
    parts: { duration: eDur, endurance: end, clock: eClock, breakOfDay: eBreak, transfers: eXfer, party: pf },
  };
}

// ---- the ceilings — where his words become a gate --------------------------------

export interface CeilingBreach {
  ceiling: number;
  kind: 'mode' | 'leg';
  mode: Mode;
}

/**
 * Did this leg exceed a ceiling the TRAVELLER HIMSELF set? "No long road journeys" is not
 * a preference to be outvoted by a cheaper fare — it is a number now (ROAD ≤ 30), and a
 * leg above it leaves the candidate set and goes to the rejected list WITH ITS HUMAN
 * REASON (Law 5).
 *
 * A breach is not the end of the conversation. It can be offered back through the existing
 * negotiation machinery ("a longer drive would save you a flight connection — say yes if
 * you want it"). Offered. Never taken in silence.
 */
export function ceilingBreach(o: LegOption, value: number, t?: Tightening): CeilingBreach | null {
  if (!t) return null;
  const modeCeiling = t.perModeOrdealCeiling?.[o.mode];
  if (modeCeiling != null && value > modeCeiling) return { ceiling: modeCeiling, kind: 'mode', mode: o.mode };
  if (t.legOrdealCeiling != null && value > t.legOrdealCeiling) return { ceiling: t.legOrdealCeiling, kind: 'leg', mode: o.mode };
  return null;
}
