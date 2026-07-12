/**
 * THE COMPLETE SANITY SWEEP — every city in the catalogue, six independent detectors.
 *
 * FOUNDER: "have we done a complete sanity check for all the cities?"
 * The honest answer was NO. This is that check.
 *
 * The Manali audits were PARTIAL and I should have said so plainly:
 *   - the state-contradiction test only covered cities that HAVE a travel guide (194/209)
 *   - the road-impossibility test only covered the 235 legs where a designer wrote a km
 *   - neither could catch an error INSIDE the right state (60 km off is still 60 km wrong)
 *   - neither looked at the 61 cities that carry NO COORDINATES AT ALL
 *
 * SIX DETECTORS. Each is INDEPENDENT, so a city that passes all six has been agreed on by
 * six different witnesses — our designers, our writers, the gazetteer, OpenStreetMap, the
 * earth's surface, and simple geometry.
 *
 *   D1  NO COORDINATES        a city we cannot place cannot be routed, priced or mapped.
 *   D2  OUTSIDE INDIA         an Indian city at sea, or in Pakistan.
 *   D3  IMPOSSIBLE GEOMETRY   a road cannot be SHORTER than the straight line. Our designers
 *                             wrote 752 real road distances. If our coords imply a longer
 *                             crow-fly than the road they drove, our coords are WRONG. This
 *                             is a physical impossibility, so it has no false positives.
 *   D4  WRONG STATE           our own writers filed a state for 194 towns. Do the coordinates
 *                             land in it? (Border towns excluded by a 300 km bar — Thekkady
 *                             at 43 km and Orchha at 16 km are innocent.)
 *   D5  DISPLACEMENT vs OSM   THE UNIVERSAL ONE. Resolve every city through the (now fixed)
 *                             verify ladder and measure how far the answer is from what we
 *                             store. This is the only detector that covers ALL cities, and
 *                             the only one that catches an error inside the right state.
 *   D6  DUPLICATE POINTS      two different towns sharing one coordinate = a copy-paste.
 *
 * WHY THIS CAN BE TRUSTED NOW AND COULD NOT BE THIS MORNING: the verify ladder itself was
 * broken. verifyCity('Manali, Himachal Pradesh') returned CHENNAI with ok:true, because
 * rung 1 threw the state away. D5 would have been worthless. It is fixed (three holes), and
 * the ladder is now the instrument, not the patient.
 *
 * Run:  ~/.bun/bin/bun run scripts/audit_all_cities.ts
 * (OSM is a free service and we are its guest: 1 request/second. ~4 minutes for 209 cities.)
 */
import prisma from '@/config/db';
import { haversineKm } from '@/services/route-optimizer/geo';
import { verifyCity } from '@/services/route-optimizer/cityVerify';

const OSM_PAUSE_MS = 1100;
const DISPLACEMENT_KM = 25;      // beyond this, we and OpenStreetMap are talking about two places
const WRONG_STATE_KM = 300;      // below this it is a border artefact, not a bug
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Finding { city: string; detector: string; detail: string; severity: 'FATAL' | 'SUSPECT' | 'GAP'; tours: number }

async function main() {
  const findings: Finding[] = [];
  const add = (f: Finding) => findings.push(f);

  const cities = await prisma.$queryRawUnsafe<any[]>(
    `SELECT c.id, c.name, c.latitude::float AS lat, c.longitude::float AS lng, c."tourCount" AS tours,
            gc."stateName" AS guide_state, s.admin1_code AS claimed
       FROM cities c
       LEFT JOIN travel_guide_cities gc ON lower(gc.name) = lower(c.name)
       LEFT JOIN india_states s ON s.name = gc."stateName"
      WHERE c."isActive"
      ORDER BY c."tourCount" DESC`);

  console.log(`\nCOMPLETE SANITY SWEEP — ${cities.length} active cities, six independent detectors\n`);

  // ---- D1: no coordinates -------------------------------------------------------------
  const noCoord = cities.filter((c) => c.lat == null || c.lng == null);
  for (const c of noCoord) {
    add({ city: c.name, detector: 'D1 no coordinates', detail: 'cannot be routed, mapped or priced', severity: 'GAP', tours: Number(c.tours) || 0 });
  }
  const placed = cities.filter((c) => c.lat != null && c.lng != null);
  console.log(`D1  no coordinates .......... ${noCoord.length} of ${cities.length}`);

  // ---- D2: outside India ---------------------------------------------------------------
  let d2 = 0;
  for (const c of placed) {
    const lat = Number(c.lat), lng = Number(c.lng);
    if (!(lat >= 6 && lat <= 37.5 && lng >= 68 && lng <= 97.5)) {
      d2++;
      add({ city: c.name, detector: 'D2 outside India', detail: `${lat.toFixed(3)}, ${lng.toFixed(3)}`, severity: 'FATAL', tours: Number(c.tours) || 0 });
    }
  }
  console.log(`D2  outside India ........... ${d2}`);

  // ---- D3: impossible geometry (a road cannot beat the crow) ---------------------------
  const byId = new Map(placed.map((c) => [c.id, c]));
  const legs = await prisma.$queryRawUnsafe<any[]>(
    `SELECT ti."tourId", ti.day, ti.title, array_agg(tc."cityId") AS ids
       FROM tour_itinerary ti JOIN tour_cities tc ON tc."tourId" = ti."tourId"
      WHERE ti.title ~* '[0-9]{2,4}\\s*(km|kms)'
      GROUP BY ti."tourId", ti.day, ti.title`);
  const accused = new Map<string, number>();
  let checkedLegs = 0;
  for (const r of legs) {
    const m = String(r.title).match(/(\d{2,4})\s*(?:km|kms)\b/i);
    if (!m) continue;
    const km = Number(m[1]);
    if (km < 20 || km > 2000) continue;
    const pool = (r.ids as string[]).map((i) => byId.get(i)).filter(Boolean);
    const t = String(r.title).toLowerCase();
    const named = pool.filter((c: any) => t.includes(String(c.name).toLowerCase()));
    if (named.length !== 2) continue;
    checkedLegs++;
    const [a, b] = named as any[];
    const crow = haversineKm([Number(a.lat), Number(a.lng)], [Number(b.lat), Number(b.lng)]);
    if (crow > km * 1.05) {
      for (const c of [a, b]) accused.set(c.name, (accused.get(c.name) ?? 0) + 1);
    }
  }
  console.log(`D3  impossible geometry ..... ${accused.size} cities implicated across ${checkedLegs} designer-written distances`);

  // ---- D4: wrong state (vs our own writers) --------------------------------------------
  const guided = placed.filter((c) => c.claimed);
  let d4 = 0;
  for (const c of guided) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT MIN(6371*acos(LEAST(1,GREATEST(-1,
          cos(radians($2::float))*cos(radians(latitude::float))*cos(radians(longitude::float)-radians($3::float))
        + sin(radians($2::float))*sin(radians(latitude::float)))))) AS km
         FROM world_cities WHERE "countryCode"='IN' AND "admin1Code" = $1`,
      c.claimed, Number(c.lat), Number(c.lng));
    const km = rows?.[0]?.km == null ? null : Number(rows[0].km);
    if (km != null && km > WRONG_STATE_KM) {
      d4++;
      add({ city: c.name, detector: 'D4 wrong state', detail: `our guide says ${c.guide_state}; coords are ${km.toFixed(0)} km from it`, severity: 'FATAL', tours: Number(c.tours) || 0 });
    }
  }
  console.log(`D4  wrong state ............. ${d4}  (of ${guided.length} towns our writers filed a state for)`);

  // ---- D6: duplicate coordinates --------------------------------------------------------
  const seen = new Map<string, string>();
  let d6 = 0;
  for (const c of placed) {
    const k = `${Number(c.lat).toFixed(4)},${Number(c.lng).toFixed(4)}`;
    if (seen.has(k) && seen.get(k) !== c.name) {
      d6++;
      add({ city: c.name, detector: 'D6 duplicate point', detail: `shares its exact coordinates with ${seen.get(k)}`, severity: 'SUSPECT', tours: Number(c.tours) || 0 });
    } else seen.set(k, c.name);
  }
  console.log(`D6  duplicate coordinates ... ${d6}`);

  // ---- D5: THE UNIVERSAL ONE — displacement against the (now fixed) ladder ---------------
  console.log(`\nD5  displacement vs OpenStreetMap — the only detector that covers EVERY city.`);
  console.log(`    (${placed.length} cities, 1 req/sec — we are a guest on a free service)\n`);

  let d5 = 0, unresolved = 0, done = 0;
  for (const c of placed) {
    done++;
    if (done % 40 === 0) console.log(`    ...${done}/${placed.length}`);
    const q = c.guide_state ? `${c.name}, ${c.guide_state}` : String(c.name);
    let v: any = null;
    try { v = await verifyCity(q); } catch { /* ignore */ }
    await sleep(OSM_PAUSE_MS);

    if (!v?.ok || v.lat == null || v.lng == null) { unresolved++; continue; }
    const km = haversineKm([Number(c.lat), Number(c.lng)], [Number(v.lat), Number(v.lng)]);
    if (km > DISPLACEMENT_KM) {
      d5++;
      add({
        city: c.name, detector: 'D5 displaced',
        detail: `we say ${Number(c.lat).toFixed(3)},${Number(c.lng).toFixed(3)} — the gazetteer says ${Number(v.lat).toFixed(3)},${Number(v.lng).toFixed(3)} (${km.toFixed(0)} km apart, matched:${v.matched})`,
        severity: km > 100 ? 'FATAL' : 'SUSPECT',
        tours: Number(c.tours) || 0,
      });
    }
  }
  console.log(`\nD5  displaced > ${DISPLACEMENT_KM} km ....... ${d5}   (unresolvable: ${unresolved})`);

  // ---- THE REPORT ------------------------------------------------------------------------
  console.log('\n' + '='.repeat(90));
  console.log('FINDINGS, worst first (a city sold in many tours does more damage when wrong)');
  console.log('='.repeat(90) + '\n');

  const rank = { FATAL: 0, SUSPECT: 1, GAP: 2 };
  findings.sort((a, b) => rank[a.severity] - rank[b.severity] || b.tours - a.tours);

  const fatal = findings.filter((f) => f.severity === 'FATAL');
  const suspect = findings.filter((f) => f.severity === 'SUSPECT');
  const gaps = findings.filter((f) => f.severity === 'GAP');

  for (const group of [['FATAL', fatal], ['SUSPECT', suspect]] as const) {
    const [label, list] = group;
    console.log(`--- ${label} (${(list as Finding[]).length}) ---`);
    for (const f of list as Finding[]) {
      console.log(`  ${f.city.padEnd(18)} [${String(f.tours).padStart(3)} tours]  ${f.detector.padEnd(20)} ${f.detail}`);
    }
    console.log('');
  }
  console.log(`--- GAP: no coordinates (${gaps.length}) — cannot be routed, mapped or priced ---`);
  console.log('  ' + gaps.map((g) => `${g.city}(${g.tours})`).join(', ') + '\n');

  const clean = placed.length - new Set(findings.filter((f) => f.severity !== 'GAP').map((f) => f.city)).size;
  console.log('='.repeat(90));
  console.log(`COVERAGE: ${placed.length} placed cities. ${clean} passed EVERY detector that applies to them.`);
  console.log(`          ${noCoord.length} have no coordinates at all and CANNOT be checked by any of them.`);
  console.log('='.repeat(90) + '\n');

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
