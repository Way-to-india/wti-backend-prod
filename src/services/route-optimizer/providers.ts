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
import { terrainSpeedKmh } from './physiology';
import { AIRPORT_TRANSFER_MAX_HRS } from './truth';
import { fmtMin } from './constraints';
import { railJunctionOptions } from './railGraph';
import { railRoadHybridOptions } from './fallback';

const BOX_RAIL = 0.4;  // ~44 km around a city to find its railheads
// US-822. THIS BOX WAS 0.6 DEGREES (~66 km) AND IT PUT A PILGRIM ON AN 18-HOUR TRAIN.
// Kanyakumari sits at 77.54E. Trivandrum airport is at 76.92E -- 0.62 degrees away, OUTSIDE
// THE BOX BY 0.02 DEGREES, about two kilometres. So Kanyakumari "had no airport" and no flight
// was ever offered on that leg, to a man who had asked to fly.
//
// Indians drive to airports. The founder's own published itinerary drives 135 km from Chennai
// to Tirupati. The catchment is now a REAL DRIVE (AIRPORT_REACH_KM), measured properly by
// haversine rather than by a lat/lng box -- and the drive is CHARGED, at both ends, into the
// door-to-door clock. Widening the net without paying for the transfer would only be a newer,
// prettier lie.
const BOX_AIR = 1.6;              // the coarse SQL pre-filter (~175 km); the true test is below
const AIRPORT_REACH_KM = 160;     // how far a traveller will genuinely drive to a flight
const ACCESS_ROAD_KMH = 45;       // an honest average for an airport transfer

export interface FindCtx { month?: number; pax: number }

/** Trains from a railhead near A to a later railhead near B. */
export async function railOptions(a: CityNode, b: CityNode, _ctx: FindCtx): Promise<LegOption[]> {
  const [aLat, aLng] = a.coord, [bLat, bLng] = b.coord;
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      WITH a_st AS (SELECT code FROM train_stations WHERE lat BETWEEN ${aLat - BOX_RAIL} AND ${aLat + BOX_RAIL} AND lng BETWEEN ${aLng - BOX_RAIL} AND ${aLng + BOX_RAIL} AND code NOT IN (SELECT code FROM train_station_quality WHERE suspect = true)),
           b_st AS (SELECT code FROM train_stations WHERE lat BETWEEN ${bLat - BOX_RAIL} AND ${bLat + BOX_RAIL} AND lng BETWEEN ${bLng - BOX_RAIL} AND ${bLng + BOX_RAIL} AND code NOT IN (SELECT code FROM train_station_quality WHERE suspect = true))
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

/** Domestic flights between the cities' airports (DGCA schedule), with the drive to and from
 *  the airport measured and CHARGED. See the note on BOX_AIR above. */
export async function airOptions(a: CityNode, b: CityNode, _ctx: FindCtx): Promise<LegOption[]> {
  const [aLat, aLng] = a.coord, [bLat, bLng] = b.coord;
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      WITH a_ap AS (SELECT city, lat, lng FROM airport_cities WHERE lat BETWEEN ${aLat - BOX_AIR} AND ${aLat + BOX_AIR} AND lng BETWEEN ${aLng - BOX_AIR} AND ${aLng + BOX_AIR}),
           b_ap AS (SELECT city, lat, lng FROM airport_cities WHERE lat BETWEEN ${bLat - BOX_AIR} AND ${bLat + BOX_AIR} AND lng BETWEEN ${bLng - BOX_AIR} AND ${bLng + BOX_AIR})
      SELECT f.origin_city, f.dest_city, f.flight_no, f.airline, f.dep_min, f.arr_min, f.dur_min,
             f.day_offset, f.operating_days, f.aircraft,
             oa.lat AS o_lat, oa.lng AS o_lng, da.lat AS d_lat, da.lng AS d_lng
      FROM flight_sectors f
      JOIN a_ap oa ON f.origin_city = oa.city
      JOIN b_ap da ON f.dest_city  = da.city
      ORDER BY f.dur_min ASC NULLS LAST
      LIMIT 60`);

    const dist = haversineKm(a.coord, b.coord);
    const seen = new Set<string>();
    const opts: LegOption[] = [];

    for (const r of rows) {
      // ⚠️ IRON LAW L2 — A FLIGHT NEEDS AN AIRPORT, AND THE DRIVE TO IT IS MEASURED IN HOURS.
      //
      // THE BUG, shipped to a real-looking traveller on 14 July 2026:
      //     "flight Jaipur → YAMUNOTRI"      Yamunotri is a Himalayan trek town. IT HAS NO AIRPORT.
      //     "flight Chennai → CHERRAPUNJI"   Nor does Cherrapunji.
      //
      // The catchment test was a STRAIGHT LINE — 160 km, priced at a flat 45 km/h. In Rajasthan
      // that is roughly true. In the Himalaya it is a fantasy: Dehradun is about 100 km from
      // Yamunotri as the crow flies and the best part of a DAY away up a mountain road. So the
      // engine sold a 68-year-old couple a flight to a village with no runway, and the number it
      // used to justify it was a straight line drawn across the Garhwal Himalaya.
      //
      // THE FOUNDER'S OWN LAW, FROM THE RING: MEASURE IT IN HOURS. Then it shrinks by itself in
      // the mountains and holds its value on the plains, and nobody has to remember to think.
      // The speed comes from terrainSpeedKmh(), the same founder-locked model the body gates use.
      //
      // A TRANSFER THAT EATS A DAY IS NOT AN AIRPORT TRANSFER. It is a road day wearing a
      // boarding pass, and the traveller is entitled to know which one he is buying.
      const fromKm = haversineKm(a.coord, [Number(r.o_lat), Number(r.o_lng)]) * 1.25;
      const toKm   = haversineKm([Number(r.d_lat), Number(r.d_lng)], b.coord) * 1.25;

      // The terrain each transfer actually crosses. An airport in the hills is not an airport
      // next door. Where we have no elevation we assume a normal highway — never a better one.
      const aHigh = (a.elevationM ?? 0) > 1200 || (b.elevationM ?? 0) > 1200;
      const accessKmh = terrainSpeedKmh(aHigh ? 2 : 4, null);   // ghat/hill = 30 km/h; NH = 55
      const fromHrs = fromKm / accessKmh;
      const toHrs   = toKm / accessKmh;
      if (fromHrs > AIRPORT_TRANSFER_MAX_HRS || toHrs > AIRPORT_TRANSFER_MAX_HRS) {
        // NOT a flight to this town. Not by any honest reading of the map.
        continue;
      }
      if (fromKm > AIRPORT_REACH_KM || toKm > AIRPORT_REACH_KM) continue;

      const key = `${r.flight_no}|${r.dep_min}`;
      if (seen.has(key)) continue; seen.add(key);

      // ...and the transfer is CHARGED at the honest speed too, not at a flat 45 km/h. A clock
      // the engine trusts must not be a clock we flattered.
      const fromMin = Math.round(fromHrs * 60);
      const toMin   = Math.round(toHrs * 60);
      const sameCityFrom = fromKm < 25, sameCityTo = toKm < 25;

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
        // the drive to the plane, paid for in the door-to-door clock (optimize.legCtx)
        accessFromKm: sameCityFrom ? 0 : Math.round(fromKm),
        accessFromMin: sameCityFrom ? 0 : fromMin,
        accessToKm: sameCityTo ? 0 : Math.round(toKm),
        accessToMin: sameCityTo ? 0 : toMin,
        fromAirportCity: sameCityFrom ? null : String(r.origin_city),
        toAirportCity: sameCityTo ? null : String(r.dest_city),
      });
      if (opts.length >= 5) break;
    }

    // ---- US-847 / US-860 -- THE ONE-STOP VIA-NODE. THE POOL MUST BE ABLE TO KEEP THE CARD'S
    // PROMISE. ---------------------------------------------------------------------------
    //
    // THE BUG, founder-found on the live page, 14 July 2026: the card promised a luxury couple
    // "You fly in -- Lucknow -> Kochi is flyable with one change of plane" -- and the BUILT plan
    // opened with a 43-hour train, because the leg pool for Lucknow -> Malampuzha held no AIR
    // option at all. No direct sector reaches any airport near Malampuzha from Lucknow, so the
    // loop above produced nothing, and the prefer-flights tilt had NOTHING TO TILT TOWARD. The
    // shortlist checked flightOneStopExists() and promised accordingly; the builder never held
    // the option the promise described. A promise the builder cannot keep is a lie with a
    // one-screen delay.
    //
    // So when NO direct sector survives, we compose the one-stop the shortlist already swears
    // by: two REAL scheduled sectors meeting at the same hub, operating-day intersection
    // non-empty. Existence-checked, never time-checked -- the clock we claim is the two flight
    // times plus a minimum connection, the arrival time is NOT asserted, and the option carries
    // verifyFlag (reliability 2) so every rendering of it says "confirm at booking". The drive
    // to and from the airports is charged exactly as for a direct flight. A model proposes; only
    // flight_sectors confirms.
    if (opts.length === 0) {
      const MIN_CONNECT_MIN = 90;
      const oneStop = await prisma.$queryRawUnsafe<any[]>(`
        WITH a_ap AS (SELECT city, lat, lng FROM airport_cities WHERE lat BETWEEN ${aLat - BOX_AIR} AND ${aLat + BOX_AIR} AND lng BETWEEN ${aLng - BOX_AIR} AND ${aLng + BOX_AIR}),
             b_ap AS (SELECT city, lat, lng FROM airport_cities WHERE lat BETWEEN ${bLat - BOX_AIR} AND ${bLat + BOX_AIR} AND lng BETWEEN ${bLng - BOX_AIR} AND ${bLng + BOX_AIR})
        SELECT f1.origin_city, f1.dest_city AS hub, f2.dest_city,
               f1.flight_no AS fno1, f2.flight_no AS fno2, f1.airline,
               f1.dep_min, f1.dur_min AS dur1, f2.dur_min AS dur2,
               f1.operating_days AS days1, f2.operating_days AS days2,
               oa.lat AS o_lat, oa.lng AS o_lng, da.lat AS d_lat, da.lng AS d_lng,
               h.lat AS h_lat, h.lng AS h_lng
        FROM flight_sectors f1
        JOIN flight_sectors f2 ON lower(f2.origin_city) = lower(f1.dest_city)
        JOIN a_ap oa ON f1.origin_city = oa.city
        JOIN b_ap da ON f2.dest_city  = da.city
        JOIN airport_cities h ON h.city = f1.dest_city
        WHERE lower(f1.origin_city) <> lower(f2.dest_city)
          AND f1.dur_min IS NOT NULL AND f2.dur_min IS NOT NULL
        ORDER BY (f1.dur_min + f2.dur_min) ASC
        LIMIT 120`);
      // ---- THE FIRST LIVE RUN OF THIS CODE FOUND TWO LANDMINES, BOTH PAID FOR HERE. -------
      // (1) flight_sectors carries rows like "Mumbai → Thiruvananthapuram, 15 minutes" —
      //     ~1,150 km at 4,600 km/h. L6 in miniature: A DURATION MUST BE POSSIBLE, and it
      //     must be possible PER HOP — a lie averaged into a plausible total is still a lie.
      // (2) deduping by HUB ALONE let that bogus 15-minute row (smallest total) shadow the
      //     REAL Mumbai → Kochi sector under the same hub — and its far airport then failed
      //     the reach test, so the traveller got NO flight at all. The key is hub + both
      //     endpoints; the CHOICE among survivors prefers the airport nearest his door.
      const hopIsPossible = (km: number, min: number) =>
        min >= 30 && (km / (min / 60)) <= 950;
      const cands: any[] = [];
      const seenVia = new Set<string>();
      for (const r of oneStop) {
        const days = (Number(r.days1) || 0) & (Number(r.days2) || 0);
        if (!days) continue;   // no shared operating day = a fiction with a hotel bill in it
        const hub: [number, number] = [Number(r.h_lat), Number(r.h_lng)];
        const hop1Km = haversineKm([Number(r.o_lat), Number(r.o_lng)], hub);
        const hop2Km = haversineKm(hub, [Number(r.d_lat), Number(r.d_lng)]);
        if (!hopIsPossible(hop1Km, Number(r.dur1)) || !hopIsPossible(hop2Km, Number(r.dur2))) continue;
        const key = `${String(r.origin_city).toLowerCase()}|${String(r.hub).toLowerCase()}|${String(r.dest_city).toLowerCase()}`;
        if (seenVia.has(key)) continue; seenVia.add(key);
        const toKmRaw = haversineKm([Number(r.d_lat), Number(r.d_lng)], b.coord);
        cands.push({ ...r, _tot: Number(r.dur1) + Number(r.dur2), _days: days, _toKmRaw: toKmRaw });
      }
      // nearest landing airport to HIS town first, then the shortest pairing
      cands.sort((x, y) => (x._toKmRaw - y._toKmRaw) || (x._tot - y._tot));
      for (const r of cands) {
        const fromKm = haversineKm(a.coord, [Number(r.o_lat), Number(r.o_lng)]) * 1.25;
        const toKm   = haversineKm([Number(r.d_lat), Number(r.d_lng)], b.coord) * 1.25;
        const aHigh = (a.elevationM ?? 0) > 1200 || (b.elevationM ?? 0) > 1200;
        const accessKmh = terrainSpeedKmh(aHigh ? 2 : 4, null);
        const fromHrs = fromKm / accessKmh, toHrs = toKm / accessKmh;
        if (fromHrs > AIRPORT_TRANSFER_MAX_HRS || toHrs > AIRPORT_TRANSFER_MAX_HRS) continue;
        if (fromKm > AIRPORT_REACH_KM || toKm > AIRPORT_REACH_KM) continue;
        const fromMin = Math.round(fromHrs * 60), toMin2 = Math.round(toHrs * 60);
        const sameCityFrom = fromKm < 25, sameCityTo = toKm < 25;
        opts.push({
          from: a.name, to: b.name, mode: 'AIR',
          identifier: `${String(r.fno1).trim()} + ${String(r.fno2).trim()} (change at ${r.hub})`,
          fromNode: r.origin_city, toNode: r.dest_city,
          distanceKm: dist,
          durationMin: Number(r.dur1) + MIN_CONNECT_MIN + Number(r.dur2),
          depTime: r.dep_min != null ? fmtMin(Number(r.dep_min)) : null,
          arrTime: null,            // we cannot prove the pairing's clock; we do not claim one
          arrDayOffset: 0,
          operatingDays: r._days,
          classes: ['ECONOMY'],
          reliability: 2,           // => verifyFlag downstream: "confirm the connection at booking"
          source: 'dgca-schedule-onestop', verifiedAt: null,
          viaHub: String(r.hub),
          accessFromKm: sameCityFrom ? 0 : Math.round(fromKm),
          accessFromMin: sameCityFrom ? 0 : fromMin,
          accessToKm: sameCityTo ? 0 : Math.round(toKm),
          accessToMin: sameCityTo ? 0 : toMin2,
          fromAirportCity: sameCityFrom ? null : String(r.origin_city),
          toAirportCity: sameCityTo ? null : String(r.dest_city),
        });
        if (opts.length >= 2) break;
      }
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
    // rung 2: still no clean rail path => overnight/day train to a railhead within
    // 150 km of B + a morning road transfer. Generated on a bigger corridor only.
    if (d > 300 && !out.some((o) => o.mode === 'RAIL')) {
      const hyb = await railRoadHybridOptions(a, b, ctx);
      out = out.concat(hyb);
    }
  }
  return out;
}
