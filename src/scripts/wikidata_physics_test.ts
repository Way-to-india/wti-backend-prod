/**
 * FIFTH SOURCE CHECK — Wikidata (wbsearchentities + P625 coordinate claim), tested here
 * ONLY as a candidate proposal. As with every other script in this job, the physics test
 * has the only vote. This script writes NOTHING — it is a dry-run report, printing
 * pass/fail for each candidate so a human decides which writes to actually make with the
 * existing, already-reviewed backupAndWrite path in geo_verify_gist.ts / a small follow-up.
 */
import prisma from '../config/db';

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

const candidates: { code: string; lat: number; lng: number; label: string }[] = [
  { code: 'ASKR', lat: 22.8266536, lng: 88.6285543, label: 'google (wikidata backs google)' },
  { code: 'BELT', lat: 24.9798763, lng: 84.9813587, label: 'google (wikidata backs google)' },
  { code: 'FTC',  lat: 26.7969292, lng: 80.2711588, label: 'google (wikidata backs google)' },
  { code: 'KGE',  lat: 21.7656672, lng: 79.8098221, label: 'google (wikidata backs google)' },
  { code: 'KQZ',  lat: 13.1239804, lng: 78.1329217, label: 'google (wikidata backs google)' },
  { code: 'KXK',  lat: 28.8382736, lng: 77.7398211, label: 'google (wikidata backs google)' },
  { code: 'PPH',  lat: 25.8677554, lng: 83.4888675, label: 'google (wikidata backs google)' },
  { code: 'PQD',  lat: 25.4617374, lng: 87.7047708, label: 'google (wikidata backs google)' },
  { code: 'PYK',  lat: 10.1245143, lng: 78.9033627, label: 'google (wikidata backs google)' },
  { code: 'WDN',  lat: 18.7423915, lng: 73.6369067, label: 'google (wikidata backs google)' },
  { code: 'OSA',  lat: 18.3605451, lng: 76.5539273, label: 'google (borderline, wikidata ~15-17km from both)' },
  { code: 'OSA',  lat: 18.24728,   lng: 76.4993,    label: 'ours (borderline, wikidata ~15-17km from both)' },
  { code: 'ANDN', lat: 27.099575,  lng: 83.269808,  label: 'wikidata (barred station, our value looks like wrong city)' },
  { code: 'NZT',  lat: 8.56102,    lng: 77.97214,   label: 'ours, retested (wikidata confirms this within 0.6km, is it still barred now that neighbours were fixed?)' },
  { code: 'SVV',  lat: 8.62931,    lng: 77.91281,   label: 'ours, retested (wikidata confirms this within 1.0km, is it still barred now that neighbours were fixed?)' },
];

async function main() {
  for (const c of candidates) {
    const r = await fixesGeometry(c.code, c.lat, c.lng);
    console.log(`${c.code.padEnd(6)} ${c.lat.toFixed(5)},${c.lng.toFixed(5).padEnd(11)} hops=${String(r.hops).padEnd(4)} bad=${String(r.bad).padEnd(4)} -> ${r.ok ? 'PASSES' : 'FAILS '}   ${c.label}`);
  }
  process.exit(0);
}
main();
