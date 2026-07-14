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
  /** 'curated' (en_route_anchors) | 'generic' (tourist-town finder) | 'intent' (US-833). */
  source?: string;
  /** US-833 — THIS TOWN SERVES WHAT HE CAME FOR.
   *
   *  FOUNDER, 14 July 2026: "that halt should have something which comes close to his intent."
   *
   *  An anchor used to be chosen by FAME — tourCount and monument_count. So a pilgrim breaking
   *  a long drive was halted at whichever town was most photographed, and the engine had no way
   *  even to ASK whether the place meant anything to him. The table it needed did not exist.
   *  It exists now: `intent_place`, 504 rows, every one with its receipt, ticked by the founder.
   *
   *  A pilgrim halts at a temple town. A man on a wildlife trip halts at a park. THE HALT IS NOT
   *  A DELAY WE APOLOGISE FOR — IT IS A PLACE HE WANTED TO GO, AND WE FOUND IT ON HIS ROAD. */
  servesIntent?: boolean;
  /** the chip it serves, so the prose can say WHY, in his own words. */
  chip?: string | null;
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
  // ---- US-833 — THE FOUNDER'S HALT SEARCH, 14 July 2026, in his own order ----------------
  //
  //   "(a) every city that comes close to the intent (first choice) and is closest to mid
  //        distance / max 350 km
  //    (b) no intent match but comfortable stay, and is closest to mid distance / max 350 km"
  //
  // So the keys are, in this order and no other:
  //
  //   1. DOES IT SERVE WHAT HE CAME FOR?  A half-day at a temple he travelled 1,500 km to see
  //      is worth more to him than a full day at a town that merely photographs well. This
  //      outranks fame, and it outranks the detour. It is the first key because it is the
  //      first question a consultant asks.
  //   2. HOW CLOSE TO THE MIDDLE IS IT?  The whole point of the halt is to HALVE the drive.
  //      A halt 60 km along the road halves nothing; it just adds a hotel bill.
  //   3. only then, how much there is to do there.
  //
  // The 350 km ceiling is not a separate rule — evaluateAnchor already refuses any anchor whose
  // sub-legs breach this body's hour cap, and that is the SAME rule expressed in the honest
  // unit. 350 km on a plain is a comfortable day; 350 km in the hills is not, and the hour cap
  // knows the difference. The founder's number holds on flat land and shrinks by itself in the
  // mountains, exactly as it should.
  // FOUNDER, 14 July 2026: "(a) is tried FIRST and ONLY when (a) is not available, (b) is
  // suggested."
  //
  // SO (a) IS A GATE, NOT A PREFERENCE. It is a two-pass structure, not a sort key — because a
  // sort key is a weight, and a weight can be outvoted by another weight. If ONE town on this
  // road serves what he came for, then no town that does not serve it is even a candidate,
  // however famous, however perfectly placed. A structure cannot be outvoted. A weight can.
  const mid: readonly [number, number] = [(fromCoord[0] + toCoord[0]) / 2, (fromCoord[1] + toCoord[1]) / 2];
  const fromMid = (c: AnchorCandidate) => haversineKm(mid, c.coord);
  const viable = cands
    .map((c) => ({ c, e: evaluateAnchor(fromCoord, toCoord, c, tol, opts) }))
    .filter((x) => x.e.ok);

  // (a) EVERY CITY THAT COMES CLOSE TO THE INTENT. (b) is not consulted while (a) has anything.
  const servesIntent = viable.filter((x) => x.c.servesIntent);
  const pool = servesIntent.length ? servesIntent : viable;

  // ...and within the pool, CLOSEST TO MID-DISTANCE, because the point of the halt is to HALVE
  // the drive. A halt 60 km along the road halves nothing; it only adds a hotel bill.
  const scored = pool.sort((a, b) => (fromMid(a.c) - fromMid(b.c)) || (b.c.valueDays - a.c.valueDays));
  if (!scored.length) {
    return { anchor: null, detourPct: 0, subLegs: null, deadHalt: true, reason: 'no en-route anchor clears value ≥ ½ day + detour ≤ 15% + both sub-legs within the hour cap — re-sequence to avoid this leg' };
  }
  const best = scored[0];
  return {
    anchor: best.c,
    detourPct: best.e.detourPct,
    subLegs: best.e.subLegs,
    deadHalt: false,
    reason: best.c.servesIntent && best.c.chip
      ? `split at ${best.c.name} — and it is a ${best.c.chip} town, which is what he came for (${(best.e.detourPct * 100).toFixed(0)}% detour): ${best.e.subLegs[0].hrs} h + ${best.e.subLegs[1].hrs} h`
      : `split at ${best.c.name} (${best.c.valueDays}-day stop, ${(best.e.detourPct * 100).toFixed(0)}% detour): ${best.e.subLegs[0].hrs} h + ${best.e.subLegs[1].hrs} h`,
  };
}
