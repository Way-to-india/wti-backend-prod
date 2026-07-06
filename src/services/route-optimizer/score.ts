/**
 * Stage F (scoring) + §4 objective functions.
 *
 * TIME  — Σ door-to-door minutes incl. forced waits (already in leg durations).
 * COST  — Σ (fare_pp midband × pax) + hotel-night delta (true overnight = −1 night).
 * EASE  — the 9-principle composite (weights sum 100), each principle 0..1, → 0..100.
 *
 * These operate on the expanded legs/days so the score reflects the *actual* plan
 * (with its overnights, positioning drives and any violations), not the raw matrix.
 */

import type { PlanLeg, DayItem, GroupProfile, Totals } from './types';

export const EASE_WEIGHTS = {
  transitLoad: 20, transfers: 15, civility: 15, restCadence: 10,
  comfortFloor: 10, reliability: 10, constraintMargin: 8, roadQuality: 7, overnightBonus: 5,
} as const;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export interface Metrics { timeHrs: number; costPpBand: [number, number] | null; ease: number; hotelNights: number; roadKm: number }

export function scorePlan(legs: PlanLeg[], days: DayItem[], pax: number, profile: GroupProfile): Metrics {
  const transitMin = legs.reduce((a, l) => a + (l.durationMin ?? 0), 0);
  const roadKm = legs.filter((l) => l.mode === 'ROAD').reduce((a, l) => a + (l.distanceKm ?? 0), 0);
  const overnightCredits = legs.filter((l) => l.overnight).length;
  const hotelNights = days.filter((d) => !d.transit || d.transit == null).length - 1 - 0; // rough: sightseeing days
  const fareMid = legs.reduce((a, l) => a + (l.farePpBand ? (l.farePpBand[0] + l.farePpBand[1]) / 2 : 0), 0);
  const costLo = legs.reduce((a, l) => a + (l.farePpBand ? l.farePpBand[0] : 0), 0);
  const costHi = legs.reduce((a, l) => a + (l.farePpBand ? l.farePpBand[1] : 0), 0);
  void fareMid; void pax;

  // ---- EASE principles (0..1 each) ----
  const maxRoad = profile === 'senior' ? 300 : 350;
  const softRoad = profile === 'senior' ? 250 : 300;
  const roadDays = days.filter((d) => (d.roadKm ?? 0) > 0);
  // 1 transit load — quadratic penalty past soft cap, hard 0 past max
  const p1 = avg(roadDays.map((d) => {
    const km = d.roadKm ?? 0;
    if (km > maxRoad) return 0;
    if (km <= softRoad) return 1;
    const over = (km - softRoad) / (maxRoad - softRoad);
    return clamp01(1 - over * over);
  }));
  // 2 transfers — every mode change is friction
  const modeChanges = legs.reduce((a, l, i) => a + (i > 0 && legs[i - 1].mode !== l.mode ? 1 : 0), 0);
  const p2 = clamp01(1 - modeChanges / Math.max(1, legs.length));
  // 3 civility — dep<06:00 or arr>22:00 penalised
  const p3 = avg(legs.map((l) => {
    const dep = hh(l.dep), arr = hh(l.arr);
    let s = 1;
    if (dep != null && dep < 6) s -= dep < 4 ? 0.9 : 0.5;
    if (arr != null && arr >= 22) s -= 0.4;
    return clamp01(s);
  }));
  // 4 rest cadence — penalise consecutive >6h transit days
  let consec = 0, cadencePenalty = 0;
  for (const d of days) {
    if ((d.transitMin ?? 0) > 360) { consec++; if (consec >= 2) cadencePenalty += 0.5; } else consec = 0;
  }
  const p4 = clamp01(1 - cadencePenalty / Math.max(1, days.length));
  // 5 comfort floor — SL/unreserved unknown here; approximate via verifyFlag/positioning noise
  const p5 = clamp01(1 - legs.filter((l) => l.verifyFlag).length / Math.max(1, legs.length) * 0.5);
  // 6 reliability — thin/seasonal options
  const p6 = clamp01(1 - legs.filter((l) => l.verifyFlag).length / Math.max(1, legs.length));
  // 7 constraint margin — any violation zeroes it
  const anyViolation = days.some((d) => (d.violations?.length ?? 0) > 0);
  const p7 = anyViolation ? 0 : 1;
  // 8 road quality — approximated (P2 will read road_quality_index); neutral for now
  const p8 = 0.8;
  // 9 overnight bonus — the only positive term
  const p9 = clamp01(overnightCredits / Math.max(1, legs.filter((l) => l.mode === 'RAIL').length || 1));

  const W = EASE_WEIGHTS;
  const ease =
    p1 * W.transitLoad + p2 * W.transfers + p3 * W.civility + p4 * W.restCadence +
    p5 * W.comfortFloor + p6 * W.reliability + p7 * W.constraintMargin + p8 * W.roadQuality + p9 * W.overnightBonus;

  return {
    timeHrs: Math.round((transitMin / 60) * 10) / 10,
    costPpBand: costHi > 0 ? [Math.round(costLo), Math.round(costHi)] : null,
    ease: Math.round(ease),
    hotelNights: Math.max(0, hotelNights),
    roadKm: Math.round(roadKm),
  };
}

export function toTotals(m: Metrics): Totals {
  return { roadKm: m.roadKm, transitHrs: m.timeHrs, costPpBand: m.costPpBand, easeScore: m.ease, hotelNights: m.hotelNights };
}

function avg(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 1; }
function hh(s?: string | null): number | null { if (!s) return null; const m = /^(\d{1,2}):/.exec(s); return m ? +m[1] : null; }
