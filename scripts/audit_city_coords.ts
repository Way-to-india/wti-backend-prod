/**
 * COORDINATE AUDIT — our own designers catch our own bad data.
 *
 * THE BUG THAT EARNED THIS. `cities.Manali` holds 13.17, 80.27 — that is CHENNAI. Elevation
 * 3 m. It is SOLD IN 17 TOURS. The gazetteer cannot help: the only "Manali" in world_cities
 * IS the Chennai suburb; Himachal's Manali is not in it at all. So a name lookup does not
 * merely fail — IT CONFIDENTLY RETURNS THE WRONG TOWN.
 *
 * THE TEST, AND IT IS NOT A JUDGEMENT CALL:
 *
 *     A ROAD CAN NEVER BE SHORTER THAN THE STRAIGHT LINE BETWEEN ITS TWO ENDS.
 *
 * Our designers wrote real road distances into 752 itinerary titles — "Shimla - Manali
 * (253 Km / 6 hr.)", "Delhi - Manali by Volvo coach (550 Km)". If OUR COORDINATES imply a
 * crow-fly distance LONGER than the road our own designers drove, then our coordinates are
 * WRONG. Not "suspicious". Wrong. It is a physical impossibility, so there are no false
 * positives to argue about.
 *
 *     Delhi -> Manali:  our coords imply ~1,760 km as the crow flies.
 *                       Our designers wrote 550 km by road.
 *                       A 550 km road cannot span a 1,760 km gap.
 *
 * This is the same discipline as US-804: OUR OWN HUMAN RECORD IS THE INDEPENDENT SOURCE
 * THAT AUDITS THE MACHINE DATA. We never had to buy a thing.
 *
 * Run:  ~/.bun/bin/bun run scripts/audit_city_coords.ts
 */
import prisma from '@/config/db';
import { haversineKm } from '@/services/route-optimizer/geo';

/** A road is never shorter than the crow. Allow 5% for rounding and imprecise coordinates. */
const IMPOSSIBLE = 1.05;

interface City { id: string; name: string; lat: number; lng: number; tours: number }

/** "Day 3: Shimla – Manali (253 Km / 6 hr.)" -> the km our designer actually wrote. */
function kmFromTitle(title: string): number | null {
  // the FIRST number followed by km/kms. (Guards against "(3640 m., 13 km.)" picking the altitude.)
  const m = title.match(/(\d{2,4})\s*(?:km|kms)\b/i);
  if (!m) return null;
  const km = Number(m[1]);
  return km >= 20 && km <= 2000 ? km : null;   // a 5 km transfer and a 3,000 km typo are both noise
}

async function main() {
  const cities = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, name, latitude::float AS lat, longitude::float AS lng, "tourCount" AS tours
       FROM cities WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND "isActive"`);
  const byId = new Map<string, City>(cities.map((c) => [c.id, {
    id: c.id, name: c.name, lat: Number(c.lat), lng: Number(c.lng), tours: Number(c.tours) || 0,
  }]));

  // Every itinerary line, with the set of cities that tour actually visits. Constraining the
  // name search to THIS TOUR'S cities is what makes the parse safe: "Delhi" in a Himachal
  // tour is the Delhi that tour sells, not a guess.
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT ti."tourId", ti.day, ti.title,
            array_agg(tc."cityId") AS city_ids
       FROM tour_itinerary ti
       JOIN tour_cities tc ON tc."tourId" = ti."tourId"
      WHERE ti.title ~* '[0-9]{2,4}\\s*(km|kms)'
      GROUP BY ti."tourId", ti.day, ti.title`);

  // city -> the accusations against it
  const accused = new Map<string, { city: City; cases: string[]; worst: number }>();
  let checked = 0;

  for (const r of rows) {
    const km = kmFromTitle(String(r.title));
    if (!km) continue;

    const pool: City[] = (r.city_ids as string[])
      .map((id) => byId.get(id)).filter(Boolean) as City[];
    if (pool.length < 2) continue;

    // which of this tour's cities are NAMED in this title?
    const t = String(r.title).toLowerCase();
    const named = pool.filter((c) => t.includes(c.name.toLowerCase()));
    if (named.length !== 2) continue;   // exactly two ends, or we cannot be sure what the km measures

    const [a, b] = named;
    const crow = haversineKm([a.lat, a.lng], [b.lat, b.lng]);
    checked++;

    if (crow > km * IMPOSSIBLE) {
      const ratio = crow / km;
      const note = `${a.name} -> ${b.name}: our coords say ${Math.round(crow)} km as the crow flies, ` +
                   `but our designers drove it in ${km} km  [${r.tourId} day ${r.day}]`;
      for (const c of [a, b]) {
        const e = accused.get(c.id) ?? { city: c, cases: [], worst: 0 };
        e.cases.push(note);
        e.worst = Math.max(e.worst, ratio);
        accused.set(c.id, e);
      }
    }
  }

  console.log(`\nCOORDINATE AUDIT — a road cannot be shorter than the straight line.`);
  console.log(`Checked ${checked} designer-written distances across ${rows.length} itinerary lines.\n`);

  if (!accused.size) { console.log('  No impossible geometry found.\n'); await prisma.$disconnect(); return; }

  // A city named in MANY impossible legs is the guilty one; a city named in one alongside a
  // serial offender is probably just the innocent other end. Rank by how often it is accused.
  const ranked = [...accused.values()].sort((x, y) => y.cases.length - x.cases.length || y.worst - x.worst);

  console.log('  SUSPECT CITIES (ranked by how many impossible legs they appear in):\n');
  for (const s of ranked) {
    console.log(`  ${s.city.name.padEnd(16)} ${s.cases.length} impossible leg(s), worst ${s.worst.toFixed(1)}x` +
                `   coords ${s.city.lat.toFixed(3)}, ${s.city.lng.toFixed(3)}   sold in ${s.city.tours} tours`);
  }
  console.log('\n  THE EVIDENCE (top offender):\n');
  for (const c of ranked[0].cases.slice(0, 6)) console.log(`    ${c}`);

  console.log('');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
