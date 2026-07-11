/**
 * L0/L2 — Junction-composed rail (spec §4.6 rung 1). When no DIRECT train links a
 * railhead near A to one near B, an expert composes TWO trains via a shared
 * junction: A→J on train1, change at J, J→B on train2. This module does the
 * rail-graph search (DB) and the PURE composition/validation.
 *
 * Composition is legal only when (spec §4.6.1):
 *   - the interchange is the SAME station (no cross-city dash between trains),
 *   - the layover is 45 min – 3 h (long enough to change, short enough to not be a
 *     dead wait),
 *   - both segments make forward progress and hold the class floor,
 *   - the combined service only "runs" on the start-weekdays where BOTH trains run
 *     on their respective calendar days (bitmask composed across the transfer
 *     day-offset — this is what lets Story-5 phase-shift align a junction chain).
 *
 * Anti-hallucination (founder-locked): a composed option is ALWAYS emitted with
 * source 'ir-timetable-junction' and verifiedAt=null so the guardrail VERIFY list
 * flags it — two static-snapshot trains plus a same-station change MUST be
 * reconfirmed before booking.
 */
import prisma from '@/config/db';
import type { CityNode, LegOption } from './types';
import { fmtMin } from './constraints';

export const JUNCTION_MIN_LAYOVER_MIN = 45;
export const JUNCTION_MAX_LAYOVER_MIN = 180;
const BOX_RAIL = 0.4;          // ~44 km around a city to find its railheads
const SEG_MAX_KM = 1400;       // no single half longer than a premium overnight run
const DEFAULT_CLASSES = ['3A', '2A', 'SL']; // snapshot has no coach data => defaulted + VERIFY

/** One half of a composed journey as read from the timetable snapshot. */
export interface RailHalf {
  trainNo: string;
  trainName?: string | null;
  runningDays: number;    // Mon..Sun bitmask (bit0=Mon); 127 = daily
  depMin: number;         // board clock (minutes-of-day) at this half's origin
  depDay: number;         // train-internal day_offset at board
  arrMin: number;         // alight clock at this half's destination
  arrDay: number;         // train-internal day_offset at alight
  kmFrom: number;         // cum_km at board
  kmTo: number;           // cum_km at alight
  originName?: string | null;
  destName?: string | null;
  classes?: string[];
}

/** Rotate a Mon..Sun (bit0..bit6) mask so composed[s] = train1 runs on `s` AND
 *  train2 runs on `s + transferDayShift` (mod 7). Daily AND daily => daily (127). */
export function composeRunningDays(rd1: number, rd2: number, transferDayShift: number): number {
  const r1 = rd1 == null ? 127 : rd1;
  const r2 = rd2 == null ? 127 : rd2;
  let comp = 0;
  for (let s = 0; s < 7; s++) {
    const b1 = (r1 & (1 << s)) !== 0;
    const shifted = (((s + transferDayShift) % 7) + 7) % 7;
    const b2 = (r2 & (1 << shifted)) !== 0;
    if (b1 && b2) comp |= (1 << s);
  }
  return comp;
}

/** Clock layover at the junction, minutes, wrapping past midnight. */
export function junctionLayoverMin(arrAtJ: number, depFromJ: number): number {
  return (((depFromJ - arrAtJ) % 1440) + 1440) % 1440;
}

/**
 * PURE composition + validation (no DB — this is the unit-tested core). Returns a
 * composed LegOption, or `{ opt: null, reason }` when a rule fails.
 */
export function composeJunction(
  fromCity: string,
  toCity: string,
  jCode1: string,
  jCode2: string,
  jName: string,
  leg1: RailHalf,
  leg2: RailHalf,
): { opt: LegOption | null; reason?: string } {
  if (jCode1 !== jCode2) return { opt: null, reason: `interchange stations differ (${jCode1} != ${jCode2}) — not a same-station change` };
  if (leg1.trainNo === leg2.trainNo) return { opt: null, reason: 'same train — that is a direct leg, not a junction' };

  const seg1Km = leg1.kmTo - leg1.kmFrom;
  const seg2Km = leg2.kmTo - leg2.kmFrom;
  if (seg1Km <= 0 || seg2Km <= 0) return { opt: null, reason: 'a segment makes no forward progress' };
  if (seg1Km > SEG_MAX_KM || seg2Km > SEG_MAX_KM) return { opt: null, reason: 'a segment is implausibly long' };

  const layover = junctionLayoverMin(leg1.arrMin, leg2.depMin);
  if (layover < JUNCTION_MIN_LAYOVER_MIN) return { opt: null, reason: `layover ${layover}m < ${JUNCTION_MIN_LAYOVER_MIN}m (too tight to change trains)` };
  if (layover > JUNCTION_MAX_LAYOVER_MIN) return { opt: null, reason: `layover ${layover}m > ${JUNCTION_MAX_LAYOVER_MIN}m (a dead wait, not a change)` };

  const seg1Min = (leg1.arrMin + leg1.arrDay * 1440) - (leg1.depMin + leg1.depDay * 1440);
  const seg2Min = (leg2.arrMin + leg2.arrDay * 1440) - (leg2.depMin + leg2.depDay * 1440);
  if (seg1Min <= 0 || seg2Min <= 0) return { opt: null, reason: 'a segment has non-positive duration' };
  const totalMin = seg1Min + layover + seg2Min;

  // transfer day shift from A-departure to train2's J-departure (for running-day compose)
  const seg1Days = leg1.arrDay - leg1.depDay;
  const layoverCrossesMidnight = leg2.depMin < leg1.arrMin ? 1 : 0;
  const transferDayShift = seg1Days + layoverCrossesMidnight;
  const operatingDays = composeRunningDays(leg1.runningDays, leg2.runningDays, transferDayShift);

  const depTime = fmtMin(leg1.depMin);
  const arrTime = fmtMin(leg2.arrMin % 1440);
  const arrDayOffset = Math.floor((leg1.depMin + totalMin) / 1440);

  // class floor = intersection of both trains' (defaulted) class lists
  const c1 = leg1.classes && leg1.classes.length ? leg1.classes : DEFAULT_CLASSES;
  const c2 = leg2.classes && leg2.classes.length ? leg2.classes : DEFAULT_CLASSES;
  const classes = c1.filter((c) => c2.includes(c));

  const daily = operatingDays === 127;
  const opt: LegOption = {
    from: fromCity,
    to: toCity,
    mode: 'RAIL',
    identifier: `${leg1.trainNo}/${leg2.trainNo} via ${jName} (change)`,
    fromNode: leg1.originName ?? null,
    toNode: leg2.destName ?? null,
    distanceKm: seg1Km + seg2Km,
    durationMin: totalMin,
    depTime,
    arrTime,
    arrDayOffset,
    operatingDays,
    classes: classes.length ? classes : ['2A'],
    reliability: Math.max(2, (daily ? 4 : 3) - 1), // the interchange shaves a reliability point
    seasonal: false,
    source: 'ir-timetable-junction',
    verifiedAt: null, // two-train change on a static snapshot => guardrail flags VERIFY
  };
  return { opt };
}

/**
 * DB search — compose up to `limit` junction options for a city pair. Bounded and
 * lazy by design (called only when direct rail is thin, so the heavy join stays
 * rare on the 2 GB box). Same-station + layover filters are pushed into SQL to
 * shrink the result set before TS composition.
 */
export async function railJunctionOptions(
  a: CityNode,
  b: CityNode,
  _ctx: { month?: number; pax: number },
  limit = 4,
): Promise<LegOption[]> {
  const [aLat, aLng] = a.coord, [bLat, bLng] = b.coord;
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      WITH a_st AS (SELECT code FROM train_stations WHERE lat BETWEEN ${aLat - BOX_RAIL} AND ${aLat + BOX_RAIL} AND lng BETWEEN ${aLng - BOX_RAIL} AND ${aLng + BOX_RAIL} AND code NOT IN (SELECT code FROM train_station_quality WHERE suspect = true)),
           b_st AS (SELECT code FROM train_stations WHERE lat BETWEEN ${bLat - BOX_RAIL} AND ${bLat + BOX_RAIL} AND lng BETWEEN ${bLng - BOX_RAIL} AND ${bLng + BOX_RAIL} AND code NOT IN (SELECT code FROM train_station_quality WHERE suspect = true)),
           leg1 AS (
             SELECT da.train_no t1, s1.running_days rd1,
                    da.dep_min a_dep, da.day_offset a_day, da.cum_km a_km, da.station_name a_name,
                    dj.station_code j, dj.station_name j_name, dj.arr_min j_arr, dj.day_offset j_day, dj.cum_km j_km1
             FROM train_stops da
             JOIN train_stops dj ON dj.train_no = da.train_no AND dj.seq > da.seq
             JOIN train_schedules s1 ON s1.train_no = da.train_no
             WHERE da.station_code IN (SELECT code FROM a_st)
               AND da.dep_min IS NOT NULL AND dj.arr_min IS NOT NULL
               AND (dj.cum_km - da.cum_km) BETWEEN 1 AND ${SEG_MAX_KM}
           ),
           leg2 AS (
             SELECT dj2.train_no t2, s2.running_days rd2,
                    dj2.station_code j, dj2.dep_min j_dep, dj2.day_offset j_day2, dj2.cum_km j_km2,
                    db.arr_min b_arr, db.day_offset b_day, db.cum_km b_km, db.station_name b_name
             FROM train_stops dj2
             JOIN train_stops db ON db.train_no = dj2.train_no AND db.seq > dj2.seq
             JOIN train_schedules s2 ON s2.train_no = dj2.train_no
             WHERE db.station_code IN (SELECT code FROM b_st)
               AND dj2.dep_min IS NOT NULL AND db.arr_min IS NOT NULL
               AND (db.cum_km - dj2.cum_km) BETWEEN 1 AND ${SEG_MAX_KM}
           )
      SELECT l1.t1, l1.rd1, l1.a_dep, l1.a_day, l1.a_km, l1.a_name,
             l1.j, l1.j_name, l1.j_arr, l1.j_day, l1.j_km1,
             l2.t2, l2.rd2, l2.j_dep, l2.j_day2, l2.j_km2, l2.b_arr, l2.b_day, l2.b_km, l2.b_name
      FROM leg1 l1
      JOIN leg2 l2 ON l2.j = l1.j AND l2.t2 <> l1.t1
      WHERE ((((l2.j_dep - l1.j_arr) % 1440) + 1440) % 1440) BETWEEN ${JUNCTION_MIN_LAYOVER_MIN} AND ${JUNCTION_MAX_LAYOVER_MIN}
      ORDER BY ((l1.j_km1 - l1.a_km) + (l2.b_km - l2.j_km2)) ASC
      LIMIT 120`);

    const byPair = new Map<string, { opt: LegOption; score: number }>();
    for (const r of rows) {
      const leg1: RailHalf = {
        trainNo: String(r.t1), runningDays: Number(r.rd1) || 127,
        depMin: Number(r.a_dep), depDay: Number(r.a_day) || 0,
        arrMin: Number(r.j_arr), arrDay: Number(r.j_day) || 0,
        kmFrom: Number(r.a_km) || 0, kmTo: Number(r.j_km1) || 0,
        originName: r.a_name, destName: r.j_name,
      };
      const leg2: RailHalf = {
        trainNo: String(r.t2), runningDays: Number(r.rd2) || 127,
        depMin: Number(r.j_dep), depDay: Number(r.j_day2) || 0,
        arrMin: Number(r.b_arr), arrDay: Number(r.b_day) || 0,
        kmFrom: Number(r.j_km2) || 0, kmTo: Number(r.b_km) || 0,
        originName: r.a_name, destName: r.b_name,
      };
      const { opt } = composeJunction(a.name, b.name, String(r.j), String(r.j), String(r.j_name || r.j), leg1, leg2);
      if (!opt) continue;
      const key = `${r.t1}|${r.t2}|${r.j}`;
      const dep = opt.depTime ? +opt.depTime.slice(0, 2) : 12;
      let sc = 0;
      if ((opt.arrDayOffset ?? 0) >= 1 && dep >= 20) sc += 5;   // overnight-shaped chain
      if ((opt.operatingDays ?? 127) === 127) sc += 3;          // daily
      sc -= (opt.durationMin ?? 0) / 120;
      const prev = byPair.get(key);
      if (!prev || sc > prev.score) byPair.set(key, { opt, score: sc });
    }
    return [...byPair.values()].sort((x, y) => y.score - x.score).slice(0, limit).map((v) => v.opt);
  } catch (e) {
    console.error('railJunctionOptions failed:', e);
    return [];
  }
}
