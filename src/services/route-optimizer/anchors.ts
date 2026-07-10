/**
 * L2 — Pearl-on-the-string split (spec §4.4). PURE + dependency-free (no DB), so
 * the day-expander can consume it without pulling Postgres into the engine core.
 *
 * An expert never halts a long drive at a meaningless dhaba town. When a road leg
 * exceeds the party hour cap it MUST be split at an anchor X that satisfies, all
 * three, §4.4:
 *
 *     anchor_value(X) ≥ ½ day of genuine experience
 *   AND detour(X)     ≤ 15 % of the straight leg distance
 *   AND both sub-legs ≤ party hard cap (terrain-adjusted hours)
 *
 * If no candidate clears all three, the split is a `dead_halt` — the optimizer
 * should prefer to RE-SEQUENCE the trip to avoid the leg (handed to L3/Story 5),
 * rather than dump the travellers in a junction town. This converts a transport
 * problem into product value: the pearl split IMPROVES the itinerary.
 */
import { haversineKm } from './geo';
import { terrainSpeedKmh, type Tolerance } from './physiology';

export const MIN_ANCHOR_VALUE_DAYS = 0.5; // ≥ half a day of genuine experience
export const MAX_DETOUR_PCT = 0.15;       // ≤ 15 % detour vs the straight leg
const ROAD_CROWFLY_FACTOR = 1.25;         // road km ≈ 1.25 × crow-fly

export interface AnchorCandidate {
  name: string;
  coord: readonly [number, number];
  /** half-day = 0.5, full day = 1.0 … (curated value, or derived from WTI counts). */
  valueDays: number;
  why?: string | null;
  /** 'curated' (en_route_anchors) or 'generic' (tourist-town finder). */
  source?: string;
}

export interface SubLeg { km: number; hrs: number }

export interface AnchorEvaluation {
  ok: boolean;
  detourPct: number;
  subLegs: [SubLeg, SubLeg];
  reasons: string[];
}

/** Derive an anchor value (in days) from WTI popularity/monument signals for a
 *  GENERIC (non-curated) candidate. Monotone + capped; refined later by the content
 *  knowledge base (B3). Curated anchors carry their own value and skip this. */
export function anchorValueFromCounts(tourCount = 0, monuments = 0): number {
  const v = 0.2 * tourCount + 0.15 * monuments; // rough experience-hours proxy → days
  return Math.max(0, Math.min(1.5, Math.round(v * 4) / 4)); // quantize to ¼-day steps
}

function roadKm(a: readonly [number, number], b: readonly [number, number]): number {
  return haversineKm(a as [number, number], b as [number, number]) * ROAD_CROWFLY_FACTOR;
}

/** Evaluate ONE candidate against the §4.4 three-part rule. */
export function evaluateAnchor(
  fromCoord: readonly [number, number],
  toCoord: readonly [number, number],
  cand: AnchorCandidate,
  tol: Tolerance,
  opts: { month?: number | null; roadQualityIndex?: number | null } = {},
): AnchorEvaluation {
  const speed = terrainSpeedKmh(opts.roadQualityIndex ?? 4, opts.month ?? null);
  const directKm = roadKm(fromCoord, toCoord);
  const leg1Km = roadKm(fromCoord, cand.coord);
  const leg2Km = roadKm(cand.coord, toCoord);
  const detourPct = directKm > 0 ? (leg1Km + leg2Km - directKm) / directKm : Infinity;
  const sub: [SubLeg, SubLeg] = [
    { km: Math.round(leg1Km), hrs: Math.round((leg1Km / speed) * 100) / 100 },
    { km: Math.round(leg2Km), hrs: Math.round((leg2Km / speed) * 100) / 100 },
  ];
  const reasons: string[] = [];
  if (cand.valueDays < MIN_ANCHOR_VALUE_DAYS) reasons.push(`value ${cand.valueDays}d < ${MIN_ANCHOR_VALUE_DAYS}d (not worth a halt)`);
  if (detourPct > MAX_DETOUR_PCT + 1e-9) reasons.push(`detour ${(detourPct * 100).toFixed(0)}% > ${MAX_DETOUR_PCT * 100}%`);
  if (sub[0].hrs > tol.hardCapHrs + 1e-9) reasons.push(`sub-leg 1 ${sub[0].hrs} h exceeds the ${tol.hardCapHrs} h cap`);
  if (sub[1].hrs > tol.hardCapHrs + 1e-9) reasons.push(`sub-leg 2 ${sub[1].hrs} h exceeds the ${tol.hardCapHrs} h cap`);
  return { ok: reasons.length === 0, detourPct: Math.round(detourPct * 1000) / 1000, subLegs: sub, reasons };
}

export interface AnchorChoice {
  anchor: AnchorCandidate | null;
  detourPct: number;
  subLegs: [SubLeg, SubLeg] | null;
  deadHalt: boolean;   // no candidate cleared §4.4 → prefer re-sequencing (L3/Story 5)
  reason: string;
}

/**
 * Choose the best pearl for an over-cap road leg. Among candidates that clear all
 * three §4.4 gates, prefer the highest experience value, then the smallest detour.
 * Returns `deadHalt:true` (anchor null) when nothing qualifies.
 */
export function chooseAnchor(
  fromCoord: readonly [number, number],
  toCoord: readonly [number, number],
  cands: AnchorCandidate[],
  tol: Tolerance,
  opts: { month?: number | null; roadQualityIndex?: number | null } = {},
): AnchorChoice {
  const scored = cands
    .map((c) => ({ c, e: evaluateAnchor(fromCoord, toCoord, c, tol, opts) }))
    .filter((x) => x.e.ok)
    .sort((a, b) => (b.c.valueDays - a.c.valueDays) || (a.e.detourPct - b.e.detourPct));
  if (!scored.length) {
    return { anchor: null, detourPct: 0, subLegs: null, deadHalt: true, reason: 'no en-route anchor clears value ≥ ½ day + detour ≤ 15% + both sub-legs within the hour cap — re-sequence to avoid this leg' };
  }
  const best = scored[0];
  return {
    anchor: best.c,
    detourPct: best.e.detourPct,
    subLegs: best.e.subLegs,
    deadHalt: false,
    reason: `split at ${best.c.name} (${best.c.valueDays}-day stop, ${(best.e.detourPct * 100).toFixed(0)}% detour): ${best.e.subLegs[0].hrs} h + ${best.e.subLegs[1].hrs} h`,
  };
}
