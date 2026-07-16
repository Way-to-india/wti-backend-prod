/**
 * S1 — SACRED TEMPLE CIRCUITS → verified sites + geocode + tour traversal marking.
 *
 * The SAME engine as the UNESCO layer (scripts/unesco-seed.ts + unesco-tour-map.ts), pointed
 * at India's great pilgrimage circuits: the 12 Jyotirlingas, Char Dham + Chota Char Dham,
 * Arupadai Veedu (six abodes of Lord Murugan), the Navagraha temples, the Shakti Peethas and
 * the Divya Desams.
 *
 * ANTI-HALLUCINATION (founder iron law): we do NOT invent coordinates. Every temple is
 * geocoded from OUR OWN gazetteer — stay_nodes first, then world_cities — because a name is
 * not a key. A short MANUAL map holds only a handful of famous temples whose town is unambiguous
 * and not in the gazetteer. Any temple that still cannot be placed is left with NULL coordinates
 * and reported for founder-verified coordinates (a small, careful expansion — exactly like the
 * UNESCO sites that awaited review). Circuits with rich, well-known members map fully today; the
 * long Shakti-Peetha (51) and Divya-Desam (108) lists are seeded with their resolvable, famous
 * members now and grown under founder review.
 *
 * A tour "reaches" a temple when a stop it SLEEPS at is within a distance tier of the temple:
 *   in_city <= 12 km, short_drive <= 35 km, day_trip <= 65 km  (measured from tour_stays -> cities).
 *
 * Idempotent (upsert sites; truncate+rebuild tour_sacred). NO model call. Run:
 *   bun run scripts/sacred-seed.ts
 */
import prisma from '@/config/db';
import { haversineKm } from '@/services/route-optimizer/geo';

const IN_CITY_KM = 12, SHORT_DRIVE_KM = 35, DAY_TRIP_KM = 65;
function tierFor(km: number): 'in_city' | 'short_drive' | 'day_trip' | null {
  if (km <= IN_CITY_KM) return 'in_city';
  if (km <= SHORT_DRIVE_KM) return 'short_drive';
  if (km <= DAY_TRIP_KM) return 'day_trip';
  return null;
}

// [name, circuits[], deity, nearestTown, state]  — verified circuits + canonical pilgrimage town.
const SITES: [string, string[], string, string, string][] = [
  // ---- 12 Jyotirlingas (Lord Shiva) ----
  ['Somnath Jyotirlinga', ['Jyotirlinga'], 'Shiva', 'Veraval', 'Gujarat'],
  ['Mallikarjuna Jyotirlinga', ['Jyotirlinga'], 'Shiva', 'Srisailam', 'Andhra Pradesh'],
  ['Mahakaleshwar Jyotirlinga', ['Jyotirlinga'], 'Shiva', 'Ujjain', 'Madhya Pradesh'],
  ['Omkareshwar Jyotirlinga', ['Jyotirlinga'], 'Shiva', 'Omkareshwar', 'Madhya Pradesh'],
  ['Kedarnath Jyotirlinga', ['Jyotirlinga', 'Chota Char Dham'], 'Shiva', 'Kedarnath', 'Uttarakhand'],
  ['Bhimashankar Jyotirlinga', ['Jyotirlinga'], 'Shiva', 'Bhimashankar', 'Maharashtra'],
  ['Kashi Vishwanath Jyotirlinga', ['Jyotirlinga'], 'Shiva', 'Varanasi', 'Uttar Pradesh'],
  ['Trimbakeshwar Jyotirlinga', ['Jyotirlinga'], 'Shiva', 'Trimbakeshwar', 'Maharashtra'],
  ['Vaidyanath (Baidyanath) Jyotirlinga', ['Jyotirlinga'], 'Shiva', 'Deoghar', 'Jharkhand'],
  ['Nageshwar Jyotirlinga', ['Jyotirlinga'], 'Shiva', 'Dwarka', 'Gujarat'],
  ['Ramanathaswamy Jyotirlinga', ['Jyotirlinga', 'Char Dham'], 'Shiva', 'Rameshwaram', 'Tamil Nadu'],
  ['Grishneshwar Jyotirlinga', ['Jyotirlinga'], 'Shiva', 'Aurangabad', 'Maharashtra'],

  // ---- Char Dham (the four national dhams) ----
  ['Badrinath Dham', ['Char Dham', 'Chota Char Dham'], 'Vishnu', 'Badrinath', 'Uttarakhand'],
  ['Dwarkadhish (Dwarka Dham)', ['Char Dham'], 'Krishna', 'Dwarka', 'Gujarat'],
  ['Jagannath Puri Dham', ['Char Dham'], 'Jagannath', 'Puri', 'Odisha'],

  // ---- Chota Char Dham (Uttarakhand) ----
  ['Yamunotri Dham', ['Chota Char Dham'], 'Yamuna', 'Yamunotri', 'Uttarakhand'],
  ['Gangotri Dham', ['Chota Char Dham'], 'Ganga', 'Gangotri', 'Uttarakhand'],

  // ---- Arupadai Veedu (six abodes of Lord Murugan) ----
  ['Palani Murugan Temple', ['Arupadai Veedu'], 'Murugan', 'Palani', 'Tamil Nadu'],
  ['Swamimalai Murugan Temple', ['Arupadai Veedu'], 'Murugan', 'Swamimalai', 'Tamil Nadu'],
  ['Thiruchendur Murugan Temple', ['Arupadai Veedu'], 'Murugan', 'Thiruchendur', 'Tamil Nadu'],
  ['Thiruparankundram Murugan Temple', ['Arupadai Veedu'], 'Murugan', 'Thiruparankundram', 'Tamil Nadu'],
  ['Pazhamudircholai Murugan Temple', ['Arupadai Veedu'], 'Murugan', 'Pazhamudircholai', 'Tamil Nadu'],
  ['Thiruthani Murugan Temple', ['Arupadai Veedu'], 'Murugan', 'Thiruthani', 'Tamil Nadu'],

  // ---- Navagraha (the nine-planet temples of the Cauvery delta) ----
  // The nine temples ring Kumbakonam. Rather than assert nine village coordinates from memory,
  // we anchor the yatra at its pilgrimage hub, Kumbakonam, honestly (pilgrims base here).
  ['Navagraha Temples (around Kumbakonam)', ['Navagraha'], 'Navagraha', 'Kumbakonam', 'Tamil Nadu'],

  // ---- Shakti Peethas (seeded famous, gazetteer-resolvable members; grown under review) ----
  ['Kamakhya Shakti Peetha', ['Shakti Peetha'], 'Shakti', 'Guwahati', 'Assam'],
  ['Kalighat Shakti Peetha', ['Shakti Peetha'], 'Shakti', 'Kolkata', 'West Bengal'],
  ['Vishalakshi Shakti Peetha', ['Shakti Peetha'], 'Shakti', 'Varanasi', 'Uttar Pradesh'],
  ['Vindhyavasini Shakti Peetha', ['Shakti Peetha'], 'Shakti', 'Vindhyachal', 'Uttar Pradesh'],
  ['Mahakali (Ujjaini) Shakti Peetha', ['Shakti Peetha'], 'Shakti', 'Ujjain', 'Madhya Pradesh'],
  ['Bhagavathy Amman (Kanyakumari) Shakti Peetha', ['Shakti Peetha'], 'Shakti', 'Kanyakumari', 'Tamil Nadu'],

  // ---- Divya Desams (seeded prominent, gazetteer-resolvable members; grown under review) ----
  ['Sri Ranganathaswamy (Srirangam) Divya Desam', ['Divya Desam'], 'Vishnu', 'Tiruchirappalli', 'Tamil Nadu'],
  ['Tirumala Venkateswara Divya Desam', ['Divya Desam'], 'Vishnu', 'Tirupati', 'Andhra Pradesh'],
  ['Varadaraja Perumal (Kanchipuram) Divya Desam', ['Divya Desam'], 'Vishnu', 'Kanchipuram', 'Tamil Nadu'],
  ['Sri Padmanabhaswamy (Thiruvananthapuram) Divya Desam', ['Divya Desam'], 'Vishnu', 'Thiruvananthapuram', 'Kerala'],
  ['Sarangapani (Kumbakonam) Divya Desam', ['Divya Desam'], 'Vishnu', 'Kumbakonam', 'Tamil Nadu'],
];

// Verified coordinates ONLY for famous temples whose town is unambiguous and absent from our
// gazetteer. Small and hand-checked; everything else is resolved from our own data.
const MANUAL: Record<string, [number, number]> = {
  Trimbakeshwar: [19.9317, 73.5310],       // Trimbakeshwar, Nashik dist., Maharashtra
  Thiruchendur: [8.4959, 78.1195],          // Thiruchendur Murugan Temple, Tamil Nadu
  Thiruparankundram: [9.8797, 78.0730],     // Thiruparankundram, Madurai, Tamil Nadu
  Pazhamudircholai: [10.0800, 78.1600],     // Pazhamudircholai (Alagar hills), near Madurai
};

async function geocode(town: string): Promise<[number, number] | null> {
  if (MANUAL[town]) return MANUAL[town];
  try {
    const sn = await prisma.$queryRawUnsafe<any[]>(
      `SELECT lat, lng FROM stay_nodes WHERE lower(name) = lower($1) LIMIT 1`, town);
    if (sn[0]) return [Number(sn[0].lat), Number(sn[0].lng)];
    const wc = await prisma.$queryRawUnsafe<any[]>(
      `SELECT latitude, longitude FROM world_cities WHERE lower(name) = lower($1)
        ORDER BY ("countryCode" = 'IN') DESC, population DESC NULLS LAST LIMIT 1`, town);
    if (wc[0]) return [Number(wc[0].latitude), Number(wc[0].longitude)];
  } catch (e) { console.error('geocode failed', town, e); }
  return null;
}

async function main() {
  console.log('S1 sacred circuits — creating schema ...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sacred_sites (
      id serial PRIMARY KEY,
      name text NOT NULL UNIQUE,
      circuits text[] NOT NULL DEFAULT '{}',
      deity text,
      state text NOT NULL,
      nearest_town text NOT NULL,
      lat double precision, lng double precision,
      geocoded_from text,
      blurb text,
      verified boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS sacred_geo_idx ON sacred_sites(lat, lng)`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS sacred_circuits_gin ON sacred_sites USING gin(circuits)`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tour_sacred (
      tour_id    text    NOT NULL,
      sacred_id  integer NOT NULL REFERENCES sacred_sites(id) ON DELETE CASCADE,
      tier       varchar(12) NOT NULL CHECK (tier IN ('in_city','short_drive','day_trip')),
      via_city   text    NOT NULL,
      km         numeric(6,1) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (tour_id, sacred_id)
    )`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS tour_sacred_sacred_idx ON tour_sacred(sacred_id)`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS tour_sacred_tour_idx   ON tour_sacred(tour_id)`);

  console.log(`geocoding + inserting ${SITES.length} temples ...`);
  let geocoded = 0; const missing: string[] = [];
  for (const [name, circuits, deity, town, state] of SITES) {
    const c = await geocode(town);
    if (c) geocoded++; else missing.push(`${name} (${town})`);
    await prisma.$executeRawUnsafe(
      `INSERT INTO sacred_sites (name, circuits, deity, state, nearest_town, lat, lng, geocoded_from)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (name) DO UPDATE SET circuits=EXCLUDED.circuits, deity=EXCLUDED.deity,
         state=EXCLUDED.state, nearest_town=EXCLUDED.nearest_town, lat=EXCLUDED.lat,
         lng=EXCLUDED.lng, geocoded_from=EXCLUDED.geocoded_from`,
      name, circuits, deity, state, town, c ? c[0] : null, c ? c[1] : null, c ? town : null);
  }
  console.log(`  geocoded ${geocoded}/${SITES.length}` +
    (missing.length ? `; NEED founder-verified coords: ${missing.join(', ')}` : ''));

  // ---- map tours that reach a temple (tour_stays stop within a tier) ----
  const sites = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, name, lat, lng FROM sacred_sites WHERE lat IS NOT NULL`);
  const stops = await prisma.$queryRawUnsafe<any[]>(
    `SELECT ts."tourId" AS tour_id, c.name AS city, c.latitude AS lat, c.longitude AS lng
       FROM tour_stays ts JOIN cities c ON c.id = ts."wtiCityId"
      WHERE c.latitude IS NOT NULL AND c.longitude IS NOT NULL`);
  type Best = { km: number; city: string };
  const best = new Map<string, Best>();
  for (const st of stops) {
    const p: [number, number] = [Number(st.lat), Number(st.lng)];
    for (const site of sites) {
      const km = haversineKm(p, [Number(site.lat), Number(site.lng)]);
      if (km > DAY_TRIP_KM) continue;
      const key = `${st.tour_id}|${site.id}`;
      const cur = best.get(key);
      if (!cur || km < cur.km) best.set(key, { km, city: String(st.city) });
    }
  }
  console.log('rebuilding tour_sacred ...');
  await prisma.$executeRawUnsafe(`TRUNCATE tour_sacred`);
  let links = 0; const tc = { in_city: 0, short_drive: 0, day_trip: 0 };
  for (const [key, b] of best) {
    const [tourId, sacredId] = key.split('|');
    const tier = tierFor(b.km); if (!tier) continue;
    await prisma.$executeRawUnsafe(
      `INSERT INTO tour_sacred (tour_id, sacred_id, tier, via_city, km) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (tour_id, sacred_id) DO UPDATE SET tier=EXCLUDED.tier, via_city=EXCLUDED.via_city, km=EXCLUDED.km`,
      tourId, Number(sacredId), tier, b.city, Math.round(b.km * 10) / 10);
    links++; tc[tier]++;
  }
  const tours = await prisma.$queryRawUnsafe<any[]>(`SELECT count(DISTINCT tour_id)::int n FROM tour_sacred`);
  const perCircuit = await prisma.$queryRawUnsafe<any[]>(
    `SELECT unnest(circuits) circuit, count(*) n FROM sacred_sites WHERE lat IS NOT NULL GROUP BY 1 ORDER BY 1`);
  console.log(`  ${links} tour<->temple links (in_city ${tc.in_city}, short_drive ${tc.short_drive}, day_trip ${tc.day_trip})`);
  console.log(`  ${tours[0].n} tours reach at least one temple`);
  console.log('  circuits (geocoded members): ' + perCircuit.map((r) => `${r.circuit}=${r.n}`).join(', '));
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
