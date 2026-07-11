/**
 * THE MANDI BAMORA FAILURE (2026-07-11) — a dirty railway station made the engine lie.
 *
 * WHAT HAPPENED
 * A plan to Tirthan Valley offered: "12722 DAKSHIN EXPRESS + 60 km road to Tirthan Valley
 * via MANDI BAMORA". Mandi Bamora is a station in MADHYA PRADESH, near Vidisha — about
 * 900 km from Tirthan Valley, not 60. Our `train_stations` table had it at 31.71 N,
 * 76.93 E, in Himachal. The train is real. The stop is real. THE STATION'S COORDINATES
 * WERE WRONG, and the engine — reasoning perfectly — concluded that a Madhya Pradesh
 * station was a Himalayan railhead.
 *
 * The engine was not wrong. The data was. But the traveller cannot tell the difference,
 * and the page says "nothing invented".
 *
 * HOW WE FIND THEM — geometry cannot lie
 * A railway line is a physical thing. Between two consecutive stops of the same train,
 * the straight-line distance between the two stations can NEVER exceed the distance the
 * train actually travels. If our coordinates say two neighbouring stops are 900 km apart
 * but the timetable says the train covered 40 km between them, then one of those two
 * coordinates is wrong. No opinion is needed. No model is needed. It is arithmetic.
 *
 * A station is SUSPECT when most of its hops are impossible (>= 60% of at least 3).
 *
 * WHAT WE DO ABOUT THEM
 *   1. FIX: ask OpenStreetMap where the station actually is, and only accept the new
 *      point if it makes the geometry possible again. A fact replaces a bad fact.
 *   2. FLAG: anything we cannot fix stays marked suspect, and the engine is forbidden
 *      from using it as a railhead (see the guard in fallback.ts / railGraph.ts). It may
 *      still be a stop a train passes through; it may never be a place we send a traveller.
 */
import prisma from '../config/db';

const SLEEP_MS = 1100; // OpenStreetMap asks for one request a second. We obey.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Suspect { code: string; name: string; lat: number; lng: number; hops: number; bad: number }

async function audit(): Promise<Suspect[]> {
  return prisma.$queryRawUnsafe<Suspect[]>(`
    WITH hops AS (
      SELECT d.station_code, d.cum_km, t.lat, t.lng,
             LAG(d.cum_km) OVER w AS pkm, LAG(t.lat) OVER w AS plat, LAG(t.lng) OVER w AS plng
        FROM train_stops d JOIN train_stations t ON t.code = d.station_code
      WINDOW w AS (PARTITION BY d.train_no ORDER BY d.cum_km)
    ), scored AS (
      SELECT station_code,
             CASE WHEN (6371*acos(least(1,cos(radians(plat))*cos(radians(lat))*cos(radians(lng)-radians(plng))
                  + sin(radians(plat))*sin(radians(lat))))) > (cum_km - pkm) * 2 + 60 THEN 1 ELSE 0 END AS bad
        FROM hops WHERE plat IS NOT NULL
    )
    SELECT s.station_code AS code, ts.name, ts.lat, ts.lng,
           count(*)::int AS hops, sum(bad)::int AS bad
      FROM scored s JOIN train_stations ts ON ts.code = s.station_code
     GROUP BY 1,2,3,4
    HAVING count(*) >= 3 AND 100.0*sum(bad)/count(*) >= 60
     ORDER BY count(*) DESC`);
}

/** Ask OpenStreetMap where a railway station really is. */
async function osmStation(name: string): Promise<{ lat: number; lng: number; where: string } | null> {
  const clean = name.replace(/\s*-\s*[A-Z0-9]{2,6}$/, '').trim(); // "MANDI BAMORA - MABA" → "MANDI BAMORA"
  for (const q of [`${clean} railway station, India`, `${clean}, India`]) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=1&accept-language=en&countrycodes=in`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'WayToIndia-TripPlanner/1.0 (info@waytoindia.com)' },
        signal: AbortSignal.timeout(9000),
      });
      await sleep(SLEEP_MS);
      if (!res.ok) continue;
      const rows = (await res.json()) as Array<Record<string, unknown>>;
      const r = rows[0];
      if (!r) continue;
      const lat = Number(r.lat), lng = Number(r.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      return { lat, lng, where: String(r.display_name ?? '').split(',').slice(-3).join(',').trim() };
    } catch { /* try the next form */ }
  }
  return null;
}

/** Would the new coordinates make this station's hops possible again? Geometry decides. */
async function fixesGeometry(code: string, lat: number, lng: number): Promise<boolean> {
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
  if (!r || !r.hops) return false;
  return (100 * r.bad) / r.hops < 40; // the geometry must actually become possible
}

async function main() {
  const suspects = await audit();
  console.log(`AUDIT — ${suspects.length} stations whose coordinates disagree with the railway line itself.\n`);

  let fixed = 0, flagged = 0;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS train_station_quality (
      code       text PRIMARY KEY,
      name       text,
      hops       int,
      bad_hops   int,
      suspect    boolean NOT NULL DEFAULT true,
      old_lat    double precision,
      old_lng    double precision,
      fixed_at   timestamptz,
      note       text
    )`);

  for (const s of suspects) {
    const hit = await osmStation(s.name);
    if (hit && (await fixesGeometry(s.code, hit.lat, hit.lng))) {
      await prisma.$executeRawUnsafe(
        `UPDATE train_stations SET lat = $2, lng = $3 WHERE code = $1`, s.code, hit.lat, hit.lng);
      await prisma.$executeRawUnsafe(
        `INSERT INTO train_station_quality (code, name, hops, bad_hops, suspect, old_lat, old_lng, fixed_at, note)
         VALUES ($1,$2,$3,$4,false,$5,$6,now(),$7)
         ON CONFLICT (code) DO UPDATE SET suspect=false, old_lat=$5, old_lng=$6, fixed_at=now(), note=$7`,
        s.code, s.name, s.hops, s.bad, s.lat, s.lng, `Re-located from OpenStreetMap: ${hit.where}`);
      console.log(`  FIXED   ${s.code.padEnd(6)} ${s.name.padEnd(26)} ${s.lat.toFixed(3)},${s.lng.toFixed(3)} → ${hit.lat.toFixed(3)},${hit.lng.toFixed(3)}  (${hit.where})`);
      fixed++;
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO train_station_quality (code, name, hops, bad_hops, suspect, old_lat, old_lng, note)
         VALUES ($1,$2,$3,$4,true,$5,$6,$7)
         ON CONFLICT (code) DO UPDATE SET suspect=true, hops=$3, bad_hops=$4, note=$7`,
        s.code, s.name, s.hops, s.bad, s.lat, s.lng,
        hit ? 'OpenStreetMap point did not fix the geometry either' : 'OpenStreetMap does not know this station');
      console.log(`  FLAGGED ${s.code.padEnd(6)} ${s.name.padEnd(26)} — the engine may never use it as a railhead`);
      flagged++;
    }
  }
  console.log(`\n${fixed} stations repaired from the map. ${flagged} flagged and barred from being a railhead.`);
  process.exit(0);
}

main();
