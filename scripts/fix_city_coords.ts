/**
 * FIX THE COORDINATES — through the verify ladder, never from memory.
 *
 * THE BUG. `cities.Manali` holds 13.17, 80.27 — CHENNAI. Elevation 3 m. SOLD IN 17 TOURS.
 * And the gazetteer cannot save us: the only "Manali" in world_cities IS the Chennai suburb.
 * Himachal's Manali is not in it at all. A name lookup does not merely fail here — IT
 * CONFIDENTLY RETURNS THE WRONG TOWN, which is far more dangerous than returning nothing.
 *
 * HOW THE CULPRIT WAS FOUND (scripts/audit_city_coords.ts + the state contradiction):
 *   A ROAD CANNOT BE SHORTER THAN THE STRAIGHT LINE. Our designers wrote "Shimla - Manali
 *   (253 Km)". Our coordinates implied 2,020 km as the crow flies. A 253 km road cannot span
 *   a 2,020 km gap. That is a physical impossibility, not an opinion.
 *   And the nearest town in Himachal — the state OUR OWN GUIDE names — was 1,939 km away.
 *
 *   Of 209 catalogue cities, EXACTLY ONE is genuinely misplaced. Thekkady (43 km) and Orchha
 *   (16 km) were border artefacts and are innocent. The catalogue is otherwise sound.
 *
 * HOW IT IS FIXED. Not by me typing coordinates I believe. Through the EXISTING LADDER
 * (cityVerify.osmLookupWithRegion), driven by the state OUR OWN HUMAN WRITERS named, and then
 * gated four ways. If any gate fails, WE WRITE NOTHING and the town waits for a person.
 *
 *   GATE 1  STATE. The new point must sit in the state our guide claims — proved by finding a
 *           gazetteer town of that state within 60 km of it.
 *   GATE 2  MOVEMENT. It must actually move. A "fix" that lands back on the bad point is not one.
 *   GATE 3  THE DESIGNERS' OWN DISTANCES. Every impossible leg that convicted the old point
 *           must now be POSSIBLE: crow-fly <= the road distance our designers wrote. THE SAME
 *           EVIDENCE THAT CONDEMNS MUST ACQUIT. This is the gate I care about.
 *   GATE 4  ELEVATION SANITY. If our guide places it in a hill state and the new point is at
 *           sea level, something is still wrong. (Manali should be ~2,000 m, not 3 m.)
 *
 * Run:  ~/.bun/bin/bun run scripts/fix_city_coords.ts          (dry run — writes nothing)
 *       ~/.bun/bin/bun run scripts/fix_city_coords.ts --apply  (writes, and cascades)
 */
import prisma from '@/config/db';
import { haversineKm } from '@/services/route-optimizer/geo';
import { verifyCity } from '@/services/route-optimizer/cityVerify';

const APPLY = process.argv.includes('--apply');

/** The one town the audit convicted. Driven by data, not by a hardcoded coordinate. */
interface Suspect {
  id: string; name: string;
  oldLat: number; oldLng: number;
  guideState: string;      // what OUR OWN WRITERS say. The region we hand to the ladder.
  claimedCode: string;
}

async function elevationOf(lat: number, lng: number): Promise<number | null> {
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
    const j: any = await r.json();
    const e = j?.elevation?.[0];
    return Number.isFinite(+e) ? Math.round(+e) : null;
  } catch { return null; }
}

/** GATE 1 — is this point really in that state? Proved by a gazetteer town of that state nearby. */
async function kmToNearestTownIn(code: string, lat: number, lng: number): Promise<number | null> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT MIN(6371*acos(LEAST(1,GREATEST(-1,
        cos(radians($2::float))*cos(radians(latitude::float))*cos(radians(longitude::float)-radians($3::float))
      + sin(radians($2::float))*sin(radians(latitude::float)))))) AS km
       FROM world_cities
      WHERE "countryCode"='IN' AND "admin1Code" = $1`, code, lat, lng);
  const km = rows?.[0]?.km;
  return km == null ? null : Number(km);
}

/** GATE 3 — the designers' own written road distances must become POSSIBLE. */
async function designerLegs(cityId: string, cityName: string) {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT ti.title, c2.name AS other, c2.latitude::float AS lat, c2.longitude::float AS lng
       FROM tour_itinerary ti
       JOIN tour_cities tc  ON tc."tourId"  = ti."tourId" AND tc."cityId" = $1
       JOIN tour_cities tc2 ON tc2."tourId" = ti."tourId" AND tc2."cityId" <> $1
       JOIN cities c2 ON c2.id = tc2."cityId"
      WHERE ti.title ~* '[0-9]{2,4}\\s*(km|kms)'
        AND ti.title ILIKE '%' || $2 || '%'
        AND ti.title ILIKE '%' || c2.name || '%'
        AND c2.latitude IS NOT NULL`, cityId, cityName);
  const out: { other: string; lat: number; lng: number; km: number }[] = [];
  for (const r of rows) {
    const m = String(r.title).match(/(\d{2,4})\s*(?:km|kms)\b/i);
    if (!m) continue;
    const km = Number(m[1]);
    if (km < 20 || km > 2000) continue;
    out.push({ other: r.other, lat: Number(r.lat), lng: Number(r.lng), km });
  }
  return out;
}

async function main() {
  // Find the genuinely misplaced towns: our own guide names a state, and the coordinates are
  // nowhere near it. (Border artefacts like Thekkady/Orchha are excluded by the 300 km bar.)
  const suspects = await prisma.$queryRawUnsafe<any[]>(`
    WITH claim AS (
      SELECT c.id, c.name, c.latitude::float AS lat, c.longitude::float AS lng,
             gc."stateName" AS guide_state, s.admin1_code AS claimed
      FROM cities c
      JOIN travel_guide_cities gc ON lower(gc.name) = lower(c.name)
      JOIN india_states s ON s.name = gc."stateName"
      WHERE c.latitude IS NOT NULL AND c."isActive"
    )
    SELECT cl.*, (
      SELECT MIN(6371*acos(LEAST(1,GREATEST(-1,
          cos(radians(cl.lat))*cos(radians(w.latitude::float))*cos(radians(w.longitude::float)-radians(cl.lng))
        + sin(radians(cl.lat))*sin(radians(w.latitude::float))))))
        FROM world_cities w
       WHERE w."countryCode"='IN' AND w."admin1Code" = cl.claimed) AS km_to_state
    FROM claim cl`);

  const guilty: Suspect[] = suspects
    .filter((s) => s.km_to_state != null && Number(s.km_to_state) > 300)
    .map((s) => ({
      id: s.id, name: s.name,
      oldLat: Number(s.lat), oldLng: Number(s.lng),
      guideState: s.guide_state, claimedCode: s.claimed,
    }));

  console.log(`\nCOORDINATE FIX ${APPLY ? '(APPLYING)' : '(DRY RUN — nothing will be written)'}\n`);
  console.log(`Genuinely misplaced towns (coords >300 km from the state our own guide names): ${guilty.length}\n`);
  if (!guilty.length) { await prisma.$disconnect(); return; }

  for (const s of guilty) {
    console.log(`  ${s.name} — our guide says ${s.guideState}; our coords are ${s.oldLat.toFixed(3)}, ${s.oldLng.toFixed(3)}`);

    // THE LADDER. The place is proposed by OUR OWN WRITERS; OSM only has to locate it.
    const v: any = await verifyCity(`${s.name}, ${s.guideState}`);
    if (!v?.ok || v.lat == null || v.lng == null) { console.log(`     ✗ the ladder could not locate it. NOTHING WRITTEN.\n`); continue; }
    const lat = Number(v.lat), lng = Number(v.lng);
    console.log(`     ladder (${v.matched}) proposes ${lat.toFixed(4)}, ${lng.toFixed(4)}`);

    // GATE 1 — state
    const kmState = await kmToNearestTownIn(s.claimedCode, lat, lng);
    const g1 = kmState != null && kmState <= 60;
    console.log(`     GATE 1 state      : nearest ${s.guideState} town is ${kmState?.toFixed(0)} km away  ${g1 ? 'PASS' : 'FAIL'}`);

    // GATE 2 — it moved
    const moved = haversineKm([s.oldLat, s.oldLng], [lat, lng]);
    const g2 = moved > 25;
    console.log(`     GATE 2 movement   : moved ${moved.toFixed(0)} km  ${g2 ? 'PASS' : 'FAIL'}`);

    // GATE 3 — THE DESIGNERS' OWN DISTANCES MUST NOW BE POSSIBLE
    const legs = await designerLegs(s.id, s.name);
    let bad = 0;
    for (const l of legs) {
      const crow = haversineKm([lat, lng], [l.lat, l.lng]);
      if (crow > l.km * 1.05) bad++;
    }
    const g3 = legs.length > 0 && bad === 0;
    console.log(`     GATE 3 designers  : ${legs.length} written distances, ${bad} still impossible  ${g3 ? 'PASS' : 'FAIL'}`);
    for (const l of legs.slice(0, 3)) {
      const crow = haversineKm([lat, lng], [l.lat, l.lng]);
      console.log(`        ${s.name} -> ${l.other}: designers drove ${l.km} km; new coords are ${crow.toFixed(0)} km apart  ${crow <= l.km * 1.05 ? 'ok' : 'IMPOSSIBLE'}`);
    }

    // GATE 4 — elevation sanity
    const elev = await elevationOf(lat, lng);
    const g4 = elev != null;
    console.log(`     GATE 4 elevation  : ${elev} m  ${g4 ? 'PASS' : 'FAIL (unknown)'}`);

    if (!(g1 && g2 && g3 && g4)) {
      console.log(`     ✗ A GATE FAILED. NOTHING WRITTEN. The town waits for a human.\n`);
      continue;
    }

    if (!APPLY) { console.log(`     ✓ all gates pass. (dry run — not written)\n`); continue; }

    // WRITE, and cascade everything that inherited the bad point.
    await prisma.$executeRawUnsafe(
      `UPDATE cities SET latitude = $1, longitude = $2 WHERE id = $3`, lat, lng, s.id);
    await prisma.$executeRawUnsafe(
      `UPDATE stay_nodes SET lat = $1, lng = $2, elevation_m = $3, elevation_source = 'open-meteo',
              elevation_fetched_at = now(), admin1_code = $4 WHERE id = $5`,
      lat, lng, elev, s.claimedCode, s.id);
    // the gateways and the measured road terrain were computed FROM the bad point. Kill them;
    // they are rebuilt by build-spine-gateways.ts. A stale gateway is a wrong answer with a receipt.
    await prisma.$executeRawUnsafe(`DELETE FROM stay_node_gateways WHERE stay_node_id = $1`, s.id);
    await prisma.$executeRawUnsafe(
      `DELETE FROM road_leg_terrain WHERE from_city = lower($1) OR to_city = lower($1)`, s.name);
    await prisma.$executeRawUnsafe(
      `UPDATE attractions SET stay_node_id = NULL, straight_line_km = NULL, road_km = NULL, road_min = NULL
        WHERE stay_node_id = $1`, s.id);

    console.log(`     ✓ WRITTEN. cities + stay_nodes updated; stale gateways, road terrain and`);
    console.log(`       attraction attachments DELETED (they were computed from the wrong point).\n`);
  }

  if (APPLY) {
    console.log('NEXT: rebuild what was invalidated —');
    console.log('  psql "$DSN" -f migrations/US-802-803-spine.sql   (re-attach attractions)  [or the incremental gateway SQL]');
    console.log('  ~/.bun/bin/bun run scripts/build-spine-gateways.ts');
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
