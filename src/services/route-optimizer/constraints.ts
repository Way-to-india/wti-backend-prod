/**
 * Constraint engine — the part of the optimizer that encodes the Ramayana audit's
 * hard failure modes. Everything here is pure and independently testable.
 *
 *  - isTrueOvernight()   → the "Sabarmati rule": a rail leg only earns an overnight
 *                          hotel-credit if it boards late AND arrives early. 03:25
 *                          boardings and daytime rides are day-consumers, not
 *                          overnights (rejects 19165 as an overnight).
 *  - gateArrivalFeasible → the "Mannanur gate rule": a leg that crosses a gated
 *                          corridor must arrive ≥ MIN_GATE_SLACK before the gate
 *                          closes (rejects fly-JGB-land-17:55 + drive-213km-to-
 *                          Srisailam same day).
 *  - resolveWeekdayLock  → the "Friday lock": some legs run only on certain
 *                          weekdays (operating_days bitmask). Given the day index
 *                          of each constrained leg, find the Day-1 weekday(s) that
 *                          satisfy them all and surface the lock.
 *
 * Time is handled in minutes-from-midnight. Legs that cross midnight carry an
 * arrDayOffset so arrivals land on the correct calendar day.
 */

import type { LegOption, Weekday, GateWindow } from './types';
import { WEEKDAY_NAMES } from './types';

export const MIN_GATE_SLACK_MIN = 60; // ≥ 60 min before a gate/permit window (blueprint §4 principle 7)

// ---- time helpers ------------------------------------------------------------

/** "HH:MM" → minutes from midnight, or null. */
export function toMin(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = +m[1], mm = +m[2];
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

const inWindow = (v: number, lo: number, hi: number) => v >= lo && v <= hi;

// ---- true-overnight predicate (the Sabarmati rule) ---------------------------

/**
 * A rail leg qualifies as a TRUE overnight (saves a hotel night, earns the only
 * positive ease term) ONLY if it boards 20:00–23:30 AND arrives 05:30–09:30 on
 * the following day. Anything else consumes a day.
 *
 *   Haripriya 17416   dep 22:00 → arr 08:15 (+1d)  → TRUE overnight  ✓
 *   Sabarmati 19165   dep 03:25 → arr 19:25 ( 0d)  → NOT overnight   ✗ (day-consumer)
 */
export function isTrueOvernight(opt: Pick<LegOption, 'mode' | 'depTime' | 'arrTime' | 'arrDayOffset'>): boolean {
  if (opt.mode !== 'RAIL') return false;
  const dep = toMin(opt.depTime), arr = toMin(opt.arrTime);
  if (dep == null || arr == null) return false;
  const crossesMidnight = (opt.arrDayOffset ?? 0) >= 1;
  return crossesMidnight && inWindow(dep, 20 * 60, 23 * 60 + 30) && inWindow(arr, 5 * 60 + 30, 9 * 60 + 30);
}

// ---- gate feasibility (the Mannanur gate rule) -------------------------------

/** Parse "21:00-06:00" → { start, end } in minutes (may wrap past midnight). */
export function parseWindow(closed: string): { start: number; end: number } | null {
  const m = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(closed.trim());
  if (!m) return null;
  const start = toMin(m[1]), end = toMin(m[2]);
  if (start == null || end == null) return null;
  return { start, end };
}

/** Is clock-minute `t` inside a (possibly midnight-wrapping) closed window? */
export function isClosedAt(t: number, w: { start: number; end: number }): boolean {
  return w.start <= w.end ? t >= w.start && t < w.end : t >= w.start || t < w.end;
}

/**
 * Given the clock time the group would ARRIVE at a gated corridor, decide whether
 * the crossing is feasible. Feasible only if arrival is at least MIN_GATE_SLACK
 * minutes BEFORE the closing window begins (and not already inside it).
 */
export function gateArrivalFeasible(arrivalMin: number, gate: GateWindow): { ok: boolean; reason?: string } {
  const w = parseWindow(gate.closed);
  if (!w) return { ok: true };
  if (isClosedAt(arrivalMin, w)) {
    return { ok: false, reason: `${gate.name}: arrival ${fmtMin(arrivalMin)} is inside the closed window ${gate.closed}` };
  }
  // minutes until the gate starts closing (handle wrap)
  const until = (w.start - arrivalMin + 1440) % 1440;
  if (until < MIN_GATE_SLACK_MIN) {
    return { ok: false, reason: `${gate.name}: arrival ${fmtMin(arrivalMin)} leaves only ${until} min before the ${gate.closed} gate closes (need ≥ ${MIN_GATE_SLACK_MIN})` };
  }
  return { ok: true };
}

export function fmtMin(t: number): string {
  const h = Math.floor((t % 1440) / 60), m = (t % 1440) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Clock time the group reaches the gate on a leg = flight/rail arrival at the
 * gateway city + onward road drive to the gate. Returns minutes (may exceed 1440;
 * caller mods by 1440 for clock, keeps overflow for "next day").
 */
export function gateReachMin(arrivalAtGatewayMin: number, onwardDriveMin: number): number {
  return arrivalAtGatewayMin + onwardDriveMin;
}

// ---- weekday helpers ---------------------------------------------------------

/** operating_days bit for a weekday. Mon=bit0 … Sun=bit6. 127 = daily. */
export function runsOn(operatingDays: number | undefined, wd: Weekday): boolean {
  if (operatingDays == null) return true; // unknown ⇒ assume daily (road/flex)
  return (operatingDays & (1 << wd)) !== 0;
}

export interface WeekdayConstrainedLeg {
  /** which day of the tour this leg departs on (Day-1 = 0). */
  dayIndex: number;
  operatingDays: number;
  identifier?: string | null;
}

/**
 * Find every Day-1 weekday that satisfies ALL weekday-limited legs, then report a
 * lock. If a fixedStart is supplied (client already has a date), validate it.
 *
 *   Tulsi 22129 at Prayagraj runs Wed  (dayIndex 5)   → Day1 ≡ Wed-5 ≡ FRI
 *   Sabarmati 19165 at Ayodhya runs Fri (dayIndex 7)  → Day1 ≡ FRI
 *   ⇒ feasible = {FRIDAY}  → weekdayLock = "FRIDAY"
 */
export function resolveWeekdayLock(
  legs: WeekdayConstrainedLeg[],
  fixedStart?: Weekday | null,
): { lock: string | null; feasibleStarts: Weekday[]; conflicts: string[] } {
  const constrained = legs.filter((l) => l.operatingDays != null && l.operatingDays !== 127);
  const feasible: Weekday[] = [];
  for (let start = 0 as Weekday; start <= 6; start = (start + 1) as Weekday) {
    if (constrained.every((l) => runsOn(l.operatingDays, ((start + l.dayIndex) % 7) as Weekday))) feasible.push(start);
  }
  const conflicts: string[] = [];
  if (constrained.length && feasible.length === 0) {
    conflicts.push('No single Day-1 weekday satisfies all weekday-limited legs; split one leg to road and re-solve.');
  }
  if (fixedStart != null) {
    const ok = constrained.every((l) => runsOn(l.operatingDays, ((fixedStart + l.dayIndex) % 7) as Weekday));
    if (!ok) conflicts.push(`Chosen Day-1 = ${WEEKDAY_NAMES[fixedStart]} does not satisfy all weekday-limited legs.`);
    return { lock: WEEKDAY_NAMES[fixedStart], feasibleStarts: feasible, conflicts };
  }
  // A lock exists only when the weekday-limited legs pin the start (not all 7 work).
  const lock = constrained.length && feasible.length > 0 && feasible.length < 7 ? WEEKDAY_NAMES[feasible[0]] : null;
  return { lock, feasibleStarts: feasible, conflicts };
}
