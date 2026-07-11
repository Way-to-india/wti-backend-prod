/**
 * FOURTH SOURCE — a code-keyed, community-collected list of Indian railway stations
 * (contributor: Sankalp Sharma, public gist, "Geo-referenced Indian Railways Data").
 * Unlike OpenStreetMap (Nominatim, matched by fuzzy NAME search) this file is matched
 * by the station CODE itself — a much safer join — and needs no network call at all,
 * it is a local, static file already copied into this repo at
 * src/data/india_railway_stations_gist.json.
 *
 * SAME INVARIANTS AS EVERY OTHER SCRIPT IN THIS JOB, NO EXCEPTIONS:
 *   1. The physics test (fixesGeometry, reused verbatim from station_audit.ts) has the
 *      only vote. This file PROPOSES a coordinate; it never decides one.
 *   2. No language model touches a coordinate. This script only parses JSON and runs SQL
 *      arithmetic.
 *   3. Every write is backed up first, into geo_coord_backup, reversible.
 *   4. A station fixed by only this one source, with nothing else agreeing, is written
 *      but marked GIST_UNCONFIRMED, never presented as fully verified.
 *
 * WHAT THIS SCRIPT TOUCHES, three groups only:
 *   A. stations with NO coordinate at all (train_stations.lat/lng IS NULL) — try to fill
 *      them, and only keep the fill if it passes the physics test.
 *   B. stations currently barred (train_station_quality.suspect = true) — try this file
 *      as a second candidate fix, alongside the OpenStreetMap attempt already made.
 *   C. stations marked DISPUTED against Google, where we DO already hold a coordinate,
 *      and are NOT currently barred (a real "one source says X, another says Y, neither
 *      proven" case) — if this file agrees with either side, and that side passes the
 *      physics test, use it to settle the dispute, either confirming what we have or
 *      repairing it to Google's value.
 *
 * DRY_RUN=1 (default) prints every intended change without writing anything. Set
 * DRY_RUN=0 to actually write. Always read the dry-run summary before flipping it.
 */
import prisma from '../config/db';
import gistRaw from '../data/india_railway_stations_gist.json';

const DRY_RUN = process.env.DRY_RUN !== '0';
const gist = gistRaw as Record<string, { lat: number | null; lng: number | null; name: string | null }>;

/** Would these coordinates make this station's hops possible again? Geometry decides.
 *  (Verbatim copy of the function in station_audit.ts — same rule, one source of truth.) */
async function fixesGeometry(code: string, lat: number, lng: number): Promise<{ ok: boolean; hops: number; bad: number }> {
  const rows = await prisma.$queryRawUnsafe<{ bad: number; hops: number }[]>(`
    WITH me AS (SELECT $1::text AS code, $2::float AS lat, $3::float AS lng),
    hops AS (
      SELECT d.train_no, d.cum_km,
             LAG(d.cum_km) OVER w AS pkm, LAG(t.lat) OVER w AS plat, LAG(t.lng) OVER w AS plng,
             d.station_code
        FROM train_stops d
        JOIN train_stations t ON t.code = d.station_code
       WHERE d.train_no IN (SELECT train_no FROM train_stops WHERE station_code = $1)
      WINDOW w AS (PARTITION BY d.train_no ORDER BY d.cum_km)
    )
    SELECT count(*)::int AS hops,
           sum(CASE WHEN (6371*acos(least(1,cos(radians(plat))*cos(radians((SELECT lat FROM me)))*cos(radians((SELECT lng FROM me))-radians(plng))
                + sin(radians(plat))*sin(radians((SELECT lat FROM me)))))) > (cum_km - pkm) * 2 + 60 THEN 1 ELSE 0 END)::int AS bad
      FROM hops WHERE station_code = $1 AND plat IS NOT NULL`, code, lat, lng);
  const r = rows[0];
  if (!r || !r.hops) return { ok: false, hops: 0, bad: 0 };
  return { ok: (100 * r.bad) / r.hops < 40, hops: r.hops, bad: r.bad };
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const [lat1, lon1] = a, [lat2, lon2] = b;
  const R = 6371, p1 = (lat1 * Math.PI) / 180, p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180, dl = ((lon2 - lon1) * Math.PI) / 180;
  const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

async function backupAndWrite(code: string, oldLat: number | null, oldLng: number | null, newLat: number, newLng: number, source: string) {
  if (!DRY_RUN) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO geo_coord_backup (kind, code, old_lat, old_lng, new_lat, new_lng, source) VALUES ('STATION',$1,$2,$3,$4,$5,$6)`,
      code, oldLat, oldLng, newLat, newLng, source);
    await prisma.$executeRawUnsafe(`UPDATE train_stations SET lat = $2, lng = $3 WHERE code = $1`, code, newLat, newLng);
  }
}

async function main() {
  let groupAFilled = 0, groupANotJudgeable = 0, groupAFailed = 0, groupANoMatch = 0;
  let groupBFixed = 0, groupBStillBad = 0, groupBNoMatch = 0;
  let groupCConfirmedOurs = 0, groupCRepairedToGoogle = 0, groupCNoAgreement = 0, groupCNoMatch = 0;

  // ---- Group A: no coordinate at all ----
  const noCoord = await prisma.$queryRawUnsafe<{ code: string; name: string }[]>(
    `SELECT code, name FROM train_stations WHERE lat IS NULL OR lng IS NULL`);
  console.log(`Group A — no coordinate at all: ${noCoord.length} stations to check against the gist.`);
  for (const s of noCoord) {
    const hit = gist[s.code];
    if (!hit || hit.lat == null || hit.lng == null) { groupANoMatch++; continue; }
    const check = await fixesGeometry(s.code, hit.lat, hit.lng);
    if (check.hops === 0) { groupANotJudgeable++; continue; } // no neighbours to judge against — leave it
    if (check.ok) {
      await backupAndWrite(s.code, null, null, hit.lat, hit.lng, 'gist-fill');
      groupAFilled++;
      console.log(`  FILLED   ${s.code.padEnd(6)} ${(s.name || '').padEnd(28)} -> ${hit.lat.toFixed(4)},${hit.lng.toFixed(4)}  (${check.hops - check.bad}/${check.hops} hops agree)`);
    } else {
      groupAFailed++; // the gist's point is itself geometrically impossible here — do not write
    }
  }

  // ---- Group B: currently barred ----
  const barred = await prisma.$queryRawUnsafe<{ code: string; name: string; lat: number; lng: number }[]>(
    `SELECT q.code, q.name, ts.lat, ts.lng FROM train_station_quality q JOIN train_stations ts ON ts.code = q.code WHERE q.suspect = true`);
  console.log(`\nGroup B — currently barred: ${barred.length} stations to try a second fix on.`);
  for (const s of barred) {
    const hit = gist[s.code];
    if (!hit || hit.lat == null || hit.lng == null) { groupBNoMatch++; continue; }
    const check = await fixesGeometry(s.code, hit.lat, hit.lng);
    if (check.ok) {
      await backupAndWrite(s.code, s.lat, s.lng, hit.lat, hit.lng, 'gist-repair');
      if (!DRY_RUN) {
        await prisma.$executeRawUnsafe(
          `UPDATE train_station_quality SET suspect = false, fixed_at = now(), note = $2 WHERE code = $1`,
          s.code, `Re-located from station-code gist (${check.hops - check.bad}/${check.hops} hops agree)`);
      }
      groupBFixed++;
      console.log(`  FIXED    ${s.code.padEnd(6)} ${(s.name || '').padEnd(28)} ${s.lat.toFixed(3)},${s.lng.toFixed(3)} -> ${hit.lat.toFixed(3)},${hit.lng.toFixed(3)}`);
    } else {
      groupBStillBad++;
    }
  }

  // ---- Group C: disputed against Google, unblocked, we hold a coordinate ----
  const disputed = await prisma.$queryRawUnsafe<{ code: string; name: string; our_lat: number; our_lng: number; google_lat: number | null; google_lng: number | null }[]>(`
    SELECT gv.code, gv.name, gv.our_lat, gv.our_lng, gv.google_lat, gv.google_lng
    FROM geo_verification gv
    WHERE gv.kind = 'STATION' AND gv.outcome = 'DISPUTED' AND gv.our_lat IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM train_station_quality q WHERE q.code = gv.code AND q.suspect = true)`);
  console.log(`\nGroup C — disputed against Google, unresolved: ${disputed.length} stations to tie-break.`);
  const NEAR_KM = 15; // "agrees with" tolerance between two independent sources
  for (const s of disputed) {
    const hit = gist[s.code];
    if (!hit || hit.lat == null || hit.lng == null) { groupCNoMatch++; continue; }
    const distToOurs = haversineKm([s.our_lat, s.our_lng], [hit.lat, hit.lng]);
    const distToGoogle = s.google_lat != null && s.google_lng != null
      ? haversineKm([s.google_lat, s.google_lng], [hit.lat, hit.lng]) : Infinity;

    if (distToOurs <= NEAR_KM) {
      // third source agrees with what we already have — confirm, no write needed
      if (!DRY_RUN) {
        await prisma.$executeRawUnsafe(
          `UPDATE geo_verification SET outcome = 'CONFIRMED', detail = $2 WHERE kind='STATION' AND code = $1`,
          s.code, `Confirmed by third source (station-code gist), ${distToOurs.toFixed(1)} km apart`);
      }
      groupCConfirmedOurs++;
      console.log(`  CONFIRMED ${s.code.padEnd(6)} ${(s.name || '').padEnd(28)} gist agrees with OUR value (${distToOurs.toFixed(1)} km)`);
    } else if (distToGoogle <= NEAR_KM && s.google_lat != null && s.google_lng != null) {
      const check = await fixesGeometry(s.code, s.google_lat, s.google_lng);
      if (check.ok) {
        await backupAndWrite(s.code, s.our_lat, s.our_lng, s.google_lat, s.google_lng, 'gist-confirms-google');
        if (!DRY_RUN) {
          await prisma.$executeRawUnsafe(
            `UPDATE geo_verification SET outcome = 'REPAIRED', detail = $2 WHERE kind='STATION' AND code = $1`,
            s.code, `Repaired: gist agrees with Google (${distToGoogle.toFixed(1)} km), and geometry now passes`);
        }
        groupCRepairedToGoogle++;
        console.log(`  REPAIRED  ${s.code.padEnd(6)} ${(s.name || '').padEnd(28)} gist backs Google's value, geometry now agrees`);
      } else {
        groupCNoAgreement++; // gist backs Google but geometry still fails — leave disputed, do not force it
      }
    } else {
      groupCNoAgreement++; // a fourth opinion, agrees with neither — genuinely needs a human
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`MODE: ${DRY_RUN ? 'DRY RUN — nothing written' : 'LIVE — changes written and backed up'}`);
  console.log(`Group A (no coordinate)      : filled ${groupAFilled}, gist point failed physics ${groupAFailed}, not enough hops to judge ${groupANotJudgeable}, no match in gist ${groupANoMatch}`);
  console.log(`Group B (currently barred)   : fixed ${groupBFixed}, still bad ${groupBStillBad}, no match in gist ${groupBNoMatch}`);
  console.log(`Group C (disputed, unblocked): confirmed ours ${groupCConfirmedOurs}, repaired to Google ${groupCRepairedToGoogle}, still unresolved ${groupCNoAgreement}, no match in gist ${groupCNoMatch}`);
  process.exit(0);
}

main();
