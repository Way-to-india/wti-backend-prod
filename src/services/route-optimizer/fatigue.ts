/**
 * L4b — FATIGUE LEDGER + RHYTHM GATES (spec §3.3, §7). PURE + dependency-free.
 *
 * A trip is a melody, not a sum (§0 truth 5). Fatigue accumulates and decays; two
 * brutal days in a row ruin the third even if each was individually "feasible."
 * This ledger walks the scheduled days and enforces the rhythm:
 *
 *   F(t+1) = F(t)·decay(day_type) + load(day)          decay 0.45 rest / 0.75 light / 1.0 travel
 *
 * Hard rhythm gates:
 *   (1) F ≤ ceiling every day                          (accumulated-fatigue ceiling)
 *   (2) no two consecutive days with load > 0.7·cap    (alternation)
 *   (3) a heavy day → next day ≤ 2 vehicle-hours       (§7.1 / §3.3)
 *   (4) any 3-day window with Σ load > 2.0·cap rejected (§7.5 streak-breaker — the
 *       constraint that catches "technically feasible, humanly miserable" plans)
 *
 * `cap` is the per-class DAILY load reference = hardCapHrs × ageFactor (the load of
 * a day driven right at the body's hard cap). Everything is derived from the §3
 * Tolerance so the ledger stays consistent with the physiology model and inherits
 * B2: a long DAY-train ride enters `load` via legFatigue (rail hours × 0.6), so a
 * brutal 11 h day train reads as heavy — while an overnight (× 0.35) does not.
 */
import type { LegOption } from './types';
import { type Tolerance, legFatigue, vehicleHours } from './physiology';
import { isTrueOvernight, toMin } from './constraints';

export const HEAVY_FRACTION = 0.7;   // heavy day = load > 0.7 · cap
export const STREAK_FRACTION = 2.0;  // 3-day window rejected above 2.0 · cap
export const CEILING_FRACTION = 2.5; // accumulated-F ceiling = 2.5 · cap
export const LIGHT_DAY_MAX_VEH_HRS = 2; // the day after a heavy one must be ≤ 2 vehicle-hours

/** Per-class daily load reference (§3.3): the load of a day at the hard cap. */
export function dailyLoadCap(tol: Tolerance): number {
  return tol.hardCapHrs * tol.ageFactor;
}

export interface DayLoad {
  load: number;        // fatigue load contributed by this day (0 for a full rest day)
  vehicleHrs: number;  // terrain-adjusted in-vehicle hours this day
  hasTransit: boolean; // false = a full day at a city (rest/light)
  label?: string;
}

/** Decay applied to the CARRIED fatigue on entering this day. */
export function decayForDay(dl: DayLoad, tol: Tolerance): number {
  const cap = dailyLoadCap(tol);
  if (!dl.hasTransit && dl.load < 0.5) return 0.45;   // true rest / anchor day
  if (dl.load <= 0.4 * cap) return 0.75;              // light day (short hop / half day)
  return 1.0;                                         // travel day (no decay benefit)
}

export function isHeavy(load: number, tol: Tolerance): boolean {
  return load > HEAVY_FRACTION * dailyLoadCap(tol) + 1e-9;
}

export type RhythmKind = 'over_fatigue_ceiling' | 'two_consecutive_heavy' | 'no_light_day_after_heavy' | 'three_day_streak';
export interface RhythmViolation { day: number; kind: RhythmKind; detail: string }

export interface LedgerResult {
  F: number[];
  heavy: boolean[];
  violations: RhythmViolation[];
  ok: boolean;
}

/** Walk the day loads, accumulate fatigue with decay, and collect rhythm violations. */
export function runFatigueLedger(days: DayLoad[], tol: Tolerance): LedgerResult {
  const cap = dailyLoadCap(tol);
  const heavyT = HEAVY_FRACTION * cap;
  const ceiling = CEILING_FRACTION * cap;
  const streak = STREAK_FRACTION * cap;
  const F: number[] = [];
  const heavy: boolean[] = [];
  const violations: RhythmViolation[] = [];

  for (let i = 0; i < days.length; i++) {
    const dl = days[i];
    const decay = i > 0 ? decayForDay(dl, tol) : 1;
    const prev = i > 0 ? F[i - 1] : 0;
    const f = Math.round((prev * decay + dl.load) * 100) / 100;
    F.push(f);
    heavy.push(dl.load > heavyT + 1e-9);

    if (f > ceiling + 1e-9) {
      violations.push({ day: i + 1, kind: 'over_fatigue_ceiling', detail: `accumulated fatigue ${f.toFixed(1)} exceeds the ${ceiling.toFixed(1)} ceiling — insert a rest day` });
    }
    if (i > 0 && heavy[i] && heavy[i - 1]) {
      violations.push({ day: i + 1, kind: 'two_consecutive_heavy', detail: `days ${i} and ${i + 1} are both heavy (load > ${heavyT.toFixed(1)}) — alternate a lighter day` });
    }
    if (i > 0 && heavy[i - 1] && dl.vehicleHrs > LIGHT_DAY_MAX_VEH_HRS + 1e-9) {
      violations.push({ day: i + 1, kind: 'no_light_day_after_heavy', detail: `day ${i} was heavy so day ${i + 1} must be ≤ ${LIGHT_DAY_MAX_VEH_HRS} vehicle-hours (is ${dl.vehicleHrs.toFixed(1)})` });
    }
    if (i >= 2) {
      const s = days[i - 2].load + days[i - 1].load + dl.load;
      if (s > streak + 1e-9) {
        violations.push({ day: i + 1, kind: 'three_day_streak', detail: `days ${i - 1}–${i + 1} accumulate ${s.toFixed(1)} load (> ${streak.toFixed(1)}) — technically feasible but humanly miserable; reflow` });
      }
    }
  }
  return { F, heavy, violations, ok: violations.length === 0 };
}

/**
 * Bridge from the dayExpand output (DayItem[] + the chosen option per leg) to the
 * per-day loads the ledger needs. A day with a transit gets legFatigue + vehicle
 * hours for that leg; a full day at a city is a rest/light day (load 0).
 */
export function dayLoadsFromDays(
  days: { transit?: { from: string; to: string } | null; city?: string }[],
  chosen: Map<string, LegOption>,
  tol: Tolerance,
  month?: number,
): DayLoad[] {
  const legKey = (a: string, b: string) => `${a}||${b}`;
  return days.map((d) => {
    if (!d.transit) return { load: 0, vehicleHrs: 0, hasTransit: false, label: d.city };
    const opt = chosen.get(legKey(d.transit.from, d.transit.to));
    if (!opt) return { load: 0, vehicleHrs: 0, hasTransit: true, label: `${d.transit.from}→${d.transit.to}` };
    const overnight = isTrueOvernight(opt);
    const vh = vehicleHours(opt, { month });
    const load = legFatigue(opt, tol, {
      month, overnight,
      depMin: toMin(opt.depTime ?? null), arrMin: toMin(opt.arrTime ?? null),
    });
    return { load, vehicleHrs: overnight ? 0 : vh, hasTransit: true, label: `${d.transit.from}→${d.transit.to}` };
  });
}
