/**
 * Transport providers — curated multimodal option sources (Phase B).
 *
 * Each provider turns a city pair into concrete LegOptions from the seeded pool
 * (train_stops / flight_sectors). They are DB-bound (unlike the pure engine) and
 * are called concurrently during option-pool build. Live TBO/Kiwi/IRCTC adapters
 * later implement the same shape and register alongside these.
 *
 *   RailProvider — trains linking a station near A to a later station near B;
 *                  overnight via day_offset, weekday lock via running_days.
 *   AirProvider  — DGCA domestic sectors between the cities' airports.
 */
import prisma from '@/config/db';
import type { CityNode, LegOption } from './types';
import { haversineKm } from './geo';
import { fmtMin } from './constraints';
import { railJunctionOptions } from './railGraph';

const BOX_RAIL = 0.4;  // ~44 km around a city to find its railheads
const BOX_AIR = 0.6;   // ~66 km around a city to find its airport

export interface FindCtx { month?: number; pax: number }

/** Trains from a railhead near A to a later railhead near B. */
export async function railOptions(a: CityNode, b: CityNode, _ctx: FindCtx): Promise<LegOption[]> {
  const [aLat, aLng] = a.coord, [bLat, bLng] = b.coord;
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      WITH a_st AS (SELECT code FROM train_stations WHERE lat BETWEEN ${aLat - BOX_RAIL} AND ${aLat + BOX_RAIL} AND lng BETWEEN ${aLng - BOX_RAIL} AND ${aLng + BOX_RAIL}),
           b_st AS (SELECT code FROM train_stations WHERE lat BETWEEN ${bLat - BOX_RAIL} AND ${bLat + BOX_RAIL} AND lng BETWEEN ${bLng - BOX_RAIL} AND ${bLng + BOX_RAIL})
      SELECT da.train_no, sch.train_name, sch.running_days,
             da.dep_min AS a_dep, da.day_offset AS a_day, da.cum_km AS a_km, da.station_name AS a_station,
             db.arr_min AS b_arr, db.day_offset AS b_day, db.cum_km AS b_km, db.station_name AS b_station
      FROM train_stops da
      JOIN train_stops db ON db.train_no = da.train_no AND db.seq > da.seq
      JOIN train_schedules sch ON sch.train_no = da.train_no
      WHERE da.station_code IN (SELECT code FROM a_st)
        AND db.station_code IN (SELECT code FROM b_st)
        AND da.dep_min IS NOT NULL AND db.arr_min IS NOT NULL
      ORDER BY (db.cum_km - da.cum_km) ASC
      LIMIT 60`);
    // dedupe by train, keep shortest A→B; then prefer overnight + daily
    const byTrain = new Map<string, any>();
    for (const r of rows) {
      const km = (Number(r.b_km) || 0) - (Number(r.a_km) || 0);
      if (km <= 0) continue;
      const prev = byTrain.get(r.train_no);
      if (!prev || km < prev._km) byTrain.set(r.train_no, { ...r, _km: km });
    }
    const opts: LegOption[] = [...byTrain.values()].map((r) => {
      const dayOff = Math.max(0, (Number(r.b_day) || 0) - (Number(r.a_day) || 0));
      const durBase = (Number(r.b_arr) - Number(r.a_dep) + dayOff * 1440);
      return {
        from: a.name, to: b.name, mode: 'RAIL' as const,
        identifier: `${r.train_no} ${String(r.train_name || '').trim()}`.trim(),
        fromNode: r.a_station, toNode: r.b_station,
        distanceKm: r._km, durationMin: durBase > 0 ? durBase : null,
        depTime: fmtMin(Number(r.a_dep)), arrTime: fmtMin(Number(r.b_arr) % 1440), arrDayOffset: dayOff,
        operatingDays: Number(r.running_days) || 127,
        classes: ['3A', '2A', 'SL'], // dataset has no coach data — defaulted, verify at booking
        reliability: (Number(r.running_days) === 127) ? 5 : 3,
        source: 'ir-timetable', verifiedAt: null, // static snapshot ⇒ verify list flags it
      };
    });
    // prefer overnight-window + daily, then shortest; cap 4
    opts.sort((x, y) => (score(y) - score(x)));
    return opts.slice(0, 4);
  } catch (e) { console.error('railOptions failed:', e); return []; }
}

function score(o: LegOption): number {
  let s = 0;
  const dep = o.depTime ? +o.depTime.slice(0, 2) : 12;
  if ((o.arrDayOffset ?? 0) >= 1 && dep >= 20) s += 5;        // true overnight
  if ((o.operatingDays ?? 127) === 127) s += 3;               // daily
  s -= (o.durationMin ?? 0) / 120;                            // shorter better
  return s;
}

/** Domestic flights between the cities' airports (DGCA schedule). */
export async function airOptions(a: CityNode, b: CityNode, _ctx: FindCtx): Promise<LegOption[]> {
  const [aLat, aLng] = a.coord, [bLat, bLng] = b.coord;
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      WITH a_ap AS (SELECT city FROM airport_cities WHERE lat BETWEEN ${aLat - BOX_AIR} AND ${aLat + BOX_AIR} AND lng BETWEEN ${aLng - BOX_AIR} AND ${aLng + BOX_AIR}),
           b_ap AS (SELECT city FROM airport_cities WHERE lat BETWEEN ${bLat - BOX_AIR} AND ${bLat + BOX_AIR} AND lng BETWEEN ${bLng - BOX_AIR} AND ${bLng + BOX_AIR})
      SELECT origin_city, dest_city, flight_no, airline, dep_min, arr_min, dur_min, day_offset, operating_days, aircraft
      FROM flight_sectors
      WHERE origin_city IN (SELECT city FROM a_ap) AND dest_city IN (SELECT city FROM b_ap)
      ORDER BY dur_min ASC NULLS LAST
      LIMIT 40`);
    const dist = haversineKm(a.coord, b.coord);
    const seen = new Set<string>();
    const opts: LegOption[] = [];
    for (const r of rows) {
      const key = `${r.flight_no}|${r.dep_min}`;
      if (seen.has(key)) continue; seen.add(key);
      opts.push({
        from: a.name, to: b.name, mode: 'AIR',
        identifier: String(r.flight_no || '').trim() || `${r.airline}`,
        fromNode: r.origin_city, toNode: r.dest_city,
        distanceKm: dist, durationMin: r.dur_min != null ? Number(r.dur_min) : null,
        depTime: r.dep_min != null ? fmtMin(Number(r.dep_min)) : null,
        arrTime: r.arr_min != null ? fmtMin(Number(r.arr_min) % 1440) : null,
        arrDayOffset: Number(r.day_offset) || 0,
        operatingDays: Number(r.operating_days) || 127,
        classes: ['ECONOMY'], reliability: 4, source: 'dgca-schedule', verifiedAt: null,
      });
      if (opts.length >= 5) break;
    }
    return opts;
  } catch (e) { console.error('airOptions failed:', e); return []; }
}

/** Concurrent multimodal options for a pair: rail (>200 km) + air (>350 km). Road is added by the caller. */
export async function multimodalOptions(a: CityNode, b: CityNode, ctx: FindCtx): Promise<LegOption[]> {
  const d = haversineKm(a.coord, b.coord);
  const jobs: Promise<LegOption[]>[] = [];
  if (d > 200) jobs.push(railOptions(a, b, ctx));
  if (d > 350) jobs.push(airOptions(a, b, ctx));
  if (!jobs.length) return [];
  const res = await Promise.all(jobs);
  let out = res.flat();
  // spec 4.6 rung 1: a rail-worthy corridor with NO direct train => try composing
  // two trains via a same-station junction. Lazy (only on a direct-rail miss) so the
  // heavier graph search stays rare on the 2 GB box.
  if (d > 200 && !out.some((o) => o.mode === 'RAIL')) {
    const junc = await railJunctionOptions(a, b, ctx);
    out = out.concat(junc);
  }
  return out;
}
