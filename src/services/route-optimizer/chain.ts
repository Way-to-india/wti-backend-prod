/**
 * US-827 — THE GROUND CHAIN GATE. The founder's own fix, and the stronger one.
 *
 * THE DEFECT, from the live payload on 14 July 2026:
 *
 *     Tirupati -> Kanyakumari,  12-hour flight day  ->  HARD-BLOCKED
 *     Tirupati -> Kanyakumari,  20-hour overnight   ->  ALLOWED. Not flagged at all.
 *
 * The train escapes the day-ordeal gate BECAUSE IT IS AN OVERNIGHT. physiology.vehicleHours()
 * multiplies an overnight rail leg by 0.35 — a berth is sleep, not endurance — and that is
 * RIGHT for a real overnight. It is wrong for this one. A FEASIBLE 20-hour train beats a
 * BLOCKED 12-hour flight, and no preference tilt can cross the blocked/feasible line. He said
 * "we would prefer flights wherever possible" and we put him on a train for the better part of
 * a day, and told him it was comfortable.
 *
 * THE-CONSULTANTS-LAW: "we are suggesting a 9 hour journey which is highly inconvenient."
 * IT IS TWENTY HOURS NOW, AND THE ENGINE BELIEVES IT IS COMFORTABLE.
 *
 * ---------------------------------------------------------------------------------------
 * THE FIX IS STRUCTURAL, NOT A WEIGHT. A weight can be outvoted by another weight; the
 * blocked/feasible line cannot be crossed by any tilt. So this is a GATE, at level 0, and it
 * ends in `continue`. The option never reaches the sort.
 *
 * AND IT INVENTS NO NUMBER. Every constant it uses already existed and is founder-locked:
 *
 *   DEAD_HOURS_FROM / DEAD_HOURS_TO   23:00 -> 07:00. This is what the engine already calls
 *                                     night. It is the only definition of sleep we have.
 *   TOLERANCE[cls].hardCapHrs         what ONE DAY of travel may ask of THIS body. 5.0 h for
 *                                     an elderly party; 7.0 h for a midage one.
 *
 * THE RULE, in one line:
 *
 *     AN OVERNIGHT IS HONEST ONLY WHEN IT IS MOSTLY NIGHT.
 *
 * A berth buys you the NIGHT. It does not buy you the DAY. So we credit the journey with the
 * hours that genuinely fall inside the sleep window, and the hours he spends AWAKE in the
 * vehicle must still fit inside one comfortable day for his body. That is LAW 2 made
 * structural: THE DIAL IS THE ORDEAL, NOT THE ROLLING STOCK.
 *
 *   a 12 h overnight, 20:00 -> 08:00   8 h asleep,  4 h awake   -> an elderly party: FINE
 *   a 20 h overnight, 17:00 -> 13:00   8 h asleep, 12 h awake   -> an elderly party: BLOCKED
 *   a 34 h road slog                   0 h asleep, 34 h awake   -> anybody:          BLOCKED
 *
 * The first is a proper Indian overnight and we would be fools to forbid it. The second is a
 * night AND a full waking day on a train. The third is not a journey, it is an endurance test.
 * The gate tells them apart WITHOUT KNOWING WHICH IS A TRAIN.
 *
 * IT ONLY EVER TIGHTENS. There is no argument to this function that can make a leg legal that
 * physiology.ts had refused. It is a second lock on the same door, and it can only be turned
 * one way.
 *
 * GROUND ONLY. A flight does not get chained across a night — it is measured, honestly, by the
 * gates that already exist. This gate exists to stop us laying TRACK between two towns that are
 * simply too far apart to be joined by track.
 */

import type { LegOption, Mode } from './types';
import { TOLERANCE, DEAD_HOURS_FROM, DEAD_HOURS_TO, type PhysioClass } from './physiology';
import type { OrdealParty } from './ordeal';

const GROUND: ReadonlySet<Mode> = new Set<Mode>(['ROAD', 'RAIL']);

export const isGround = (m: Mode): boolean => GROUND.has(m);

/** "HH:MM" -> minutes past midnight. null for anything we cannot read. */
export function toMin(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]), mm = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mm) || h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

/**
 * How many minutes of this journey fall inside the sleep window (23:00 -> 07:00)?
 *
 * Walked minute by minute, deliberately: a journey may cross the window twice (a 30-hour train
 * gets TWO nights) and any closed-form arithmetic here would quietly get that wrong. 1,440
 * iterations for a whole day is nothing, and being obviously right is worth more than being
 * cleverly fast.
 *
 * With no departure time we credit ZERO sleep. That is the strict reading, and strict is the
 * only safe direction: an unknown clock may never BUY comfort. It can only fail to prove it.
 */
export function sleepMinutes(depMin: number | null, durationMin: number): number {
  if (depMin == null || !Number.isFinite(durationMin) || durationMin <= 0) return 0;
  let slept = 0;
  for (let i = 0; i < Math.min(durationMin, 60 * 72); i++) {
    const m = (depMin + i) % 1440;
    if (m >= DEAD_HOURS_FROM || m < DEAD_HOURS_TO) slept++;
  }
  return slept;
}

/** The hours he spends AWAKE inside the vehicle. The berth buys the night, not the day. */
export function wakingHours(o: LegOption, doorToDoorHrs?: number | null): number {
  const durMin = Number.isFinite(doorToDoorHrs as number) && (doorToDoorHrs as number) > 0
    ? Math.round((doorToDoorHrs as number) * 60)
    : (o.durationMin ?? 0);
  if (!durMin) return 0;
  // A berth is only a bed if it IS a berth. A 20-hour bus through the night is not sleep, and
  // neither is a car. Only RAIL may claim the night, and only when it has real sleeping classes.
  const canSleep = o.mode === 'RAIL';
  const slept = canSleep ? sleepMinutes(toMin(o.depTime), durMin) : 0;
  return Math.max(0, (durMin - slept) / 60);
}

/**
 * TWO LANES, AND THE TRAVELLER CHOOSES WHICH ONE HE IS IN. The same doctrine as
 * consultantChoose(), and for the same reason.
 *
 * THE COMFORT LANE — he said LUXURY. The TOTAL waking hours must fit inside one travel day.
 *   A man who asked for luxury does not spend six hours of his afternoon and six hours of his
 *   morning sitting on a train, however good the berth in between. LAW 3: a marginal saving may
 *   never buy a traveller's discomfort, not by a rupee, not ever.
 *
 * THE PURSE LANE — they said CHEAP. The waking hours on EACH CALENDAR DAY must fit.
 *   The night is genuinely free to them, and the 14-hour Goa -> Bengaluru overnight that leaves
 *   after dinner and arrives at breakfast costs them NO day at all and a fifth of the fare. It
 *   is their best answer and the engine says so. To force that family onto a flight they never
 *   asked for and cannot afford would be the SAME ARROGANCE IN THE OPPOSITE DIRECTION — and we
 *   would congratulate ourselves for their comfort while emptying their pocket.
 *
 * ONE ENGINE. TWO MINDS. TWO HONEST ANSWERS. The gate is structural in both lanes; what changes
 * is only WHAT COUNTS AS ONE DAY, and that is his call, not ours.
 */
const isComfortFirst = (p: OrdealParty): boolean =>
  p.budgetStance === 'comfort_first' || p.budgetStance === 'money_no_object';

/** The waking minutes that fall on the DEPARTURE side of the night, and on the ARRIVAL side. */
export function wakingSplit(depMin: number | null, durationMin: number, canSleep: boolean): { before: number; after: number } {
  if (depMin == null || !Number.isFinite(durationMin) || durationMin <= 0) {
    return { before: durationMin > 0 ? durationMin : 0, after: 0 };
  }
  let before = 0, after = 0, seenNight = false;
  for (let i = 0; i < Math.min(durationMin, 60 * 72); i++) {
    const m = (depMin + i) % 1440;
    const night = m >= DEAD_HOURS_FROM || m < DEAD_HOURS_TO;
    if (night && canSleep) { seenNight = true; continue; }
    if (seenNight) after++; else before++;
  }
  return { before, after };
}

export interface GroundChainBlock {
  blocked: boolean;
  wakingHrs: number;
  capHrs: number;
  sleptHrs: number;
  /** the engine's own words. explain.ts turns these into HIS words. */
  reason: string;
}

/**
 * THE GATE. Ground only. Returns blocked=true when the WAKING part of the journey is more than
 * one day should ask of this body.
 */
export function groundChainBlock(
  o: LegOption,
  party: OrdealParty | PhysioClass,
  doorToDoorHrs?: number | null,
): GroundChainBlock {
  const p: OrdealParty = typeof party === 'string' ? { cls: party } : party;
  const cap = TOLERANCE[p.cls].hardCapHrs;
  if (!isGround(o.mode)) {
    return { blocked: false, wakingHrs: 0, capHrs: cap, sleptHrs: 0, reason: '' };
  }
  const durMin = Number.isFinite(doorToDoorHrs as number) && (doorToDoorHrs as number) > 0
    ? Math.round((doorToDoorHrs as number) * 60)
    : (o.durationMin ?? 0);
  // Only RAIL may claim the night. A bus or a car through the darkness is not sleep.
  const canSleep = o.mode === 'RAIL';
  const slept = canSleep ? sleepMinutes(toMin(o.depTime), durMin) : 0;
  const waking = Math.max(0, (durMin - slept) / 60);
  const split = wakingSplit(toMin(o.depTime), durMin, canSleep);
  const beforeHrs = split.before / 60;
  const afterHrs = split.after / 60;

  const comfort = isComfortFirst(p);
  // THE COMFORT LANE: one travel day, in TOTAL. THE PURSE LANE: one travel day, PER DAY.
  const blocked = comfort
    ? waking > cap + 1e-9
    : (beforeHrs > cap + 1e-9 || afterHrs > cap + 1e-9);

  let reason = '';
  if (blocked) {
    const total = (durMin / 60).toFixed(1);
    if (comfort && slept > 0) {
      reason = `ground leg: ${total} h door to door, of which ${(slept / 60).toFixed(1)} h is a berth — that still leaves ${waking.toFixed(1)} h AWAKE in the vehicle, and he asked for comfort. One travel day for this party is ${cap} h.`;
    } else if (slept > 0) {
      reason = `ground leg: ${total} h — ${beforeHrs.toFixed(1)} h awake before the night and ${afterHrs.toFixed(1)} h awake after it. A berth buys the NIGHT, not the DAY. One travel day for this party is ${cap} h.`;
    } else {
      reason = `ground leg: ${waking.toFixed(1)} h awake in the vehicle, and one travel day for this party is ${cap} h.`;
    }
  }
  return { blocked, wakingHrs: waking, capHrs: cap, sleptHrs: slept / 60, reason };
}

/**
 * THE FOUNDER'S SENTENCE, made checkable: "two towns more than one comfortable day apart by
 * ground CANNOT BE CHAINED BY GROUND."
 *
 * Given every ground option we have for a pair of towns, are ANY of them chainable? If not,
 * these two towns are not neighbours on a road or a railway line, whatever the map says, and
 * the radar may not put them side by side in a chain. It must fly the gap, or reorder the trip
 * so the gap is never crossed.
 */
export function groundChainable(opts: LegOption[], party: OrdealParty | PhysioClass): boolean {
  return opts.some((o) => isGround(o.mode) && !groundChainBlock(o, party).blocked);
}
