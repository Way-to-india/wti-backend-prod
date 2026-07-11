/**
 * L2 — The 500–700 km NO-FLIGHT fallback ladder (spec §4.6). When a corridor has
 * no qualifying airport pair and no DIRECT train, an expert does not surrender to a
 * 12-hour road day; they climb a ladder of honest alternatives:
 *
 *   rung 1  broken-rail composition (junction) ......... railGraph.ts (Story 1)
 *   rung 2  rail+road hybrid ........................... THIS FILE
 *           overnight/day train to the nearest railhead within 150 km of B, then a
 *           Band-A morning road transfer to B.
 *   rung 3  split-road via an anchor .................. anchors.ts (Story 3)
 *   rung 4  re-sequencing / phase-shift escape ........ optimize.ts (Story 5)
 *   rung 5  young-only single long road day ........... falls out of the §3 hard cap
 *           (young hardCap = 9 h) — this file only NAMES the predicate for the
 *           explanation engine; the fatigue ledger (Story 4) mandates the light day
 *           that must follow.
 *   rung 6  L6 negotiation ............................ Sprint 3.
 *
 * CRITICAL (spec §4.6 tail): the ladder is for candidate GENERATION and
 * explanation, not blind precedence. Every surviving rung is turned into a concrete
 * LegOption and DDCV-scored against the others — the cost model, not the ladder
 * order, picks the winner.
 *
 * Anti-hallucination (founder-locked): a hybrid is emitted with a '-hybrid' source
 * and verifiedAt=null so the guardrail VERIFY list flags it.
 */
import prisma from '@/config/db';
import type { CityNode, LegOption } from './types';
import { haversineKm } from './geo';
import { fmtMin } from './constraints';
import { terrainSpeedKmh, type Tolerance } from './physiology';

export const HYBRID_DROP_MAX_KM = 150;   // §4.6 rung 2: railhead within 150 km of B
export const HYBRID_RAIL_MIN_KM = 250;   // the rail half must be a real long haul
const BOX_RAIL_A = 0.4;                  // ~44 km around A to find its railheads
const BOX_DROP = 1.5;                    // ~165 km around B to find candidate drop railheads
const ONWARD_ROAD_RATE_PP = 4;           // indicative ₹/km per person for the onward taxi share

// ---- pure helpers (unit-tested, no DB) --------------------------------------

/** Onward road transfer from the drop railhead to city B, terrain-adjusted. */
export function onwardRoadHours(km: number, roadQualityIndex?: number | null, month?: number | null): number {
  return km / terrainSpeedKmh(roadQualityIndex ?? 4, month);
}

/**
 * Rung 5 predicate — a single long ROAD day is admissible only for a party whose
 * hard cap actually allows it (young: 9 h). This never RELAXES the §3 gate (that is
 * enforced in physiology.ts); it just lets the explanation engine say WHY a long
 * road day was or was not offered. Returns true only when terrain hours ≤ hard cap.
 */
export function youngLongRoadAdmissible(terrainHrs: number, tol: Tolerance): boolean {
  return terrainHrs <= tol.hardCapHrs + 1e-9 && tol.hardCapHrs >= 8; // only the young class clears an 8h+ day
}

/**
 * PURE wrap — turn a RAIL option that reaches a drop railhead R into a rail+road
 * hybrid to city B. The onward road is NOT a separate mode here; it is folded into
 * the option so the DDCV charges it as terminal→hotel access (§4.5, symmetric for
 * railheads). optimize.legCtx() reads onwardRoadMin and adds it to accessToHrs, so
 * a far drop railhead honestly loses daylight and money — exactly like a far
 * airport does. Returns null if the onward road is too long to be a Band-A hop.
 */
export function wrapRailRoadHybrid(
  railToDrop: LegOption,
  cityB: string,
  dropStationName: string,
  onwardKm: number,
  onwardMin: number,
): LegOption | null {
  if (onwardKm > HYBRID_DROP_MAX_KM) return null;
  if ((railToDrop.distanceKm ?? 0) < HYBRID_RAIL_MIN_KM) return null;
  return {
    ...railToDrop,
    to: cityB,
    toNode: dropStationName,
    identifier: `${railToDrop.identifier ?? 'train'} + ${Math.round(onwardKm)} km road to ${cityB} via ${dropStationName}`,
    onwardRoadKm: Math.round(onwardKm),
    onwardRoadMin: Math.round(onwardMin),
    viaNode: dropStationName,
    reliability: Math.min(railToDrop.reliability ?? 3, 3), // a change of mode shaves reliability
    source: `${railToDrop.source ?? 'ir-timetable'}-hybrid`,
    verifiedAt: null,
  };
}

// ---- DB generator ------------------------------------------------------------

/**
 * Rung 2 — rail+road hybrids for a city pair. One bounded query finds trains from a
 * railhead near A to any station in a wide box around B; TS keeps only those whose
 * drop station is within 150 km road of B and whose rail half is a real long haul,
 * preferring overnight-shaped or morning arrivals so the onward drive lands in
 * daylight. Lazy: call only on a direct-rail miss.
 */
export async function railRoadHybridOptions(
  a: CityNode,
  b: CityNode,
  ctx: { month?: number; pax: number; roadQualityIndex?: number | null },
  limit = 3,
): Promise<LegOption[]> {
  const [aLat, aLng] = a.coord, [bLat, bLng] = b.coord;
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      WITH a_st AS (SELECT code FROM train_stations WHERE lat BETWEEN ${aLat - BOX_RAIL_A} AND ${aLat + BOX_RAIL_A} AND lng BETWEEN ${aLng - BOX_RAIL_A} AND ${aLng + BOX_RAIL_A} AND code NOT IN (SELECT code FROM train_station_quality WHERE suspect = true)),
           drop_st AS (SELECT code, name, lat, lng FROM train_stations WHERE lat BETWEEN ${bLat - BOX_DROP} AND ${bLat + BOX_DROP} AND lng BETWEEN ${bLng - BOX_DROP} AND ${bLng + BOX_DROP} AND code NOT IN (SELECT code FROM train_station_quality WHERE suspect = true))
      SELECT da.train_no, sch.train_name, sch.running_days,
             da.dep_min AS a_dep, da.day_offset AS a_day, da.cum_km AS a_km, da.station_name AS a_station,
             dd.arr_min AS d_arr, dd.day_offset AS d_day, dd.cum_km AS d_km,
             ds.name AS d_name, ds.lat AS d_lat, ds.lng AS d_lng
      FROM train_stops da
      JOIN train_stops dd ON dd.train_no = da.train_no AND dd.seq > da.seq
      JOIN drop_st ds ON ds.code = dd.station_code
      JOIN train_schedules sch ON sch.train_no = da.train_no
      WHERE da.station_code IN (SELECT code FROM a_st)
        AND da.dep_min IS NOT NULL AND dd.arr_min IS NOT NULL
        AND (dd.cum_km - da.cum_km) BETWEEN ${HYBRID_RAIL_MIN_KM} AND 1600
      ORDER BY (dd.cum_km - da.cum_km) ASC
      LIMIT 200`);

    const out: { opt: LegOption; score: number }[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const dropCoord: [number, number] = [Number(r.d_lat), Number(r.d_lng)];
      if (!Number.isFinite(dropCoord[0]) || !Number.isFinite(dropCoord[1])) continue;
      const onwardKm = haversineKm(dropCoord, b.coord) * 1.25; // road ≈ 1.25× crow-fly
      if (onwardKm > HYBRID_DROP_MAX_KM) continue;
      const railKm = (Number(r.d_km) || 0) - (Number(r.a_km) || 0);
      if (railKm < HYBRID_RAIL_MIN_KM) continue;
      const dayOff = Math.max(0, (Number(r.d_day) || 0) - (Number(r.a_day) || 0));
      const durBase = Number(r.d_arr) - Number(r.a_dep) + dayOff * 1440;
      if (durBase <= 0) continue;
      const arrClock = Number(r.d_arr) % 1440;
      const overnightShaped = dayOff >= 1 && Number(r.a_dep) >= 20 * 60;
      const morningDrop = arrClock >= 5 * 60 && arrClock <= 12 * 60;
      if (!overnightShaped && !morningDrop) continue; // onward drive must land in daylight

      const railToDrop: LegOption = {
        from: a.name, to: String(r.d_name), mode: 'RAIL',
        identifier: `${r.train_no} ${String(r.train_name || '').trim()}`.trim(),
        fromNode: r.a_station, toNode: String(r.d_name),
        distanceKm: railKm, durationMin: durBase,
        depTime: fmtMin(Number(r.a_dep)), arrTime: fmtMin(arrClock), arrDayOffset: dayOff,
        operatingDays: Number(r.running_days) || 127,
        classes: ['3A', '2A', 'SL'], reliability: (Number(r.running_days) === 127) ? 5 : 3,
        source: 'ir-timetable', verifiedAt: null,
      };
      const onwardMin = onwardRoadHours(onwardKm, ctx.roadQualityIndex ?? 4, ctx.month) * 60;
      const hybrid = wrapRailRoadHybrid(railToDrop, b.name, String(r.d_name), onwardKm, onwardMin);
      if (!hybrid) continue;
      const key = `${r.train_no}|${r.d_name}`;
      if (seen.has(key)) continue; seen.add(key);
      let sc = 0;
      if (overnightShaped) sc += 5;
      if ((hybrid.operatingDays ?? 127) === 127) sc += 3;
      sc -= onwardKm / 50;               // shorter onward road is better
      sc -= (durBase / 120);
      out.push({ opt: hybrid, score: sc });
    }
    return out.sort((x, y) => y.score - x.score).slice(0, limit).map((v) => v.opt);
  } catch (e) {
    console.error('railRoadHybridOptions failed:', e);
    return [];
  }
}

/** Access hours the onward road adds to a hybrid option (read by optimize.legCtx). */
export function hybridAccessHours(o: LegOption): { hrs: number; costPp: number } {
  if (o.onwardRoadMin == null) return { hrs: 0, costPp: 0 };
  return { hrs: o.onwardRoadMin / 60, costPp: (o.onwardRoadKm ?? 0) * ONWARD_ROAD_RATE_PP };
}
