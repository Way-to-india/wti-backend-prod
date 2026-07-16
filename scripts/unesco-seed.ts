/**
 * U1/U2 — UNESCO World Heritage Sites of India → verified data + geocode + branch marking.
 *
 * Source: en.wikipedia.org/wiki/List_of_World_Heritage_Sites_in_India (verified 2026, 44 sites:
 * 36 cultural / 7 natural / 1 mixed). NAMES/STATE/TYPE/YEAR are from the page; the nearest
 * town is the well-known access city. Coordinates are resolved from OUR gazetteer (stay_nodes
 * first, then world_cities) — A NAME IS NOT A KEY, so we geocode by name into our own data.
 *
 * A branch "traverses" a UNESCO site when any of its stops sits within TRAVERSE_KM of the site.
 * That distance rule is why the Navagraha tour (Kumbakonam) correctly picks up the Great Living
 * Chola Temples (Thanjavur/Darasuram/Gangaikonda), which no exact city-match would find.
 *
 * Idempotent. NO model call. Run: bun run scripts/unesco-seed.ts
 */
import prisma from '@/config/db';
import { haversineKm } from '@/services/route-optimizer/geo';

const TRAVERSE_KM = 65;   // a UNESCO site within a comfortable half-day of a stop is "on the route"

// [name, states, nearestTown, type, year]  — verified list.
const SITES: [string, string, string, 'Cultural' | 'Natural' | 'Mixed', number][] = [
  ['Ajanta Caves', 'Maharashtra', 'Aurangabad', 'Cultural', 1983],
  ['Ellora Caves', 'Maharashtra', 'Aurangabad', 'Cultural', 1983],
  ['Agra Fort', 'Uttar Pradesh', 'Agra', 'Cultural', 1983],
  ['Taj Mahal', 'Uttar Pradesh', 'Agra', 'Cultural', 1983],
  ['Sun Temple, Konark', 'Odisha', 'Konark', 'Cultural', 1984],
  ['Group of Monuments at Mahabalipuram', 'Tamil Nadu', 'Mahabalipuram', 'Cultural', 1984],
  ['Kaziranga National Park', 'Assam', 'Kaziranga', 'Natural', 1985],
  ['Manas Wildlife Sanctuary', 'Assam', 'Barpeta', 'Natural', 1985],
  ['Keoladeo National Park', 'Rajasthan', 'Bharatpur', 'Natural', 1985],
  ['Churches and Convents of Goa', 'Goa', 'Panaji', 'Cultural', 1986],
  ['Khajuraho Group of Monuments', 'Madhya Pradesh', 'Khajuraho', 'Cultural', 1986],
  ['Group of Monuments at Hampi', 'Karnataka', 'Hampi', 'Cultural', 1986],
  ['Fatehpur Sikri', 'Uttar Pradesh', 'Fatehpur Sikri', 'Cultural', 1986],
  ['Group of Monuments at Pattadakal', 'Karnataka', 'Badami', 'Cultural', 1987],
  ['Elephanta Caves', 'Maharashtra', 'Mumbai', 'Cultural', 1987],
  ['Great Living Chola Temples', 'Tamil Nadu', 'Thanjavur', 'Cultural', 1987],
  ['Sundarbans National Park', 'West Bengal', 'Canning', 'Natural', 1987],
  ['Nanda Devi and Valley of Flowers National Parks', 'Uttarakhand', 'Joshimath', 'Natural', 1988],
  ['Buddhist Monuments at Sanchi', 'Madhya Pradesh', 'Sanchi', 'Cultural', 1989],
  ["Humayun's Tomb, Delhi", 'Delhi', 'Delhi', 'Cultural', 1993],
  ['Qutb Minar and its Monuments, Delhi', 'Delhi', 'Delhi', 'Cultural', 1993],
  ['Mountain Railways of India', 'West Bengal', 'Darjeeling', 'Cultural', 1999],
  ['Mahabodhi Temple Complex at Bodh Gaya', 'Bihar', 'Bodh Gaya', 'Cultural', 2002],
  ['Rock Shelters of Bhimbetka', 'Madhya Pradesh', 'Bhimbetka', 'Cultural', 2003],
  ['Chhatrapati Shivaji Terminus', 'Maharashtra', 'Mumbai', 'Cultural', 2004],
  ['Champaner-Pavagadh Archaeological Park', 'Gujarat', 'Champaner', 'Cultural', 2004],
  ['Red Fort Complex', 'Delhi', 'Delhi', 'Cultural', 2007],
  ['The Jantar Mantar, Jaipur', 'Rajasthan', 'Jaipur', 'Cultural', 2010],
  ['Western Ghats', 'Kerala', 'Munnar', 'Natural', 2012],
  ['Hill Forts of Rajasthan', 'Rajasthan', 'Chittorgarh', 'Cultural', 2013],
  ["Rani-ki-Vav (the Queen's Stepwell) at Patan", 'Gujarat', 'Patan', 'Cultural', 2014],
  ['Great Himalayan National Park Conservation Area', 'Himachal Pradesh', 'Kullu', 'Natural', 2014],
  ['Archaeological Site of Nalanda Mahavihara', 'Bihar', 'Nalanda', 'Cultural', 2016],
  ['Khangchendzonga National Park', 'Sikkim', 'Yuksom', 'Mixed', 2016],
  ['The Architectural Work of Le Corbusier (Capitol Complex)', 'Chandigarh', 'Chandigarh', 'Cultural', 2016],
  ['Historic City of Ahmadabad', 'Gujarat', 'Ahmedabad', 'Cultural', 2017],
  ['Victorian Gothic and Art Deco Ensembles of Mumbai', 'Maharashtra', 'Mumbai', 'Cultural', 2018],
  ['Jaipur City, Rajasthan', 'Rajasthan', 'Jaipur', 'Cultural', 2019],
  ['Kakatiya Rudreshwara (Ramappa) Temple', 'Telangana', 'Warangal', 'Cultural', 2021],
  ['Dholavira: a Harappan City', 'Gujarat', 'Bhuj', 'Cultural', 2021],
  ['Santiniketan', 'West Bengal', 'Santiniketan', 'Cultural', 2023],
  ['Sacred Ensembles of the Hoysalas', 'Karnataka', 'Halebidu', 'Cultural', 2023],
  ['Moidams – the Mound-Burial system of the Ahom Dynasty', 'Assam', 'Sivasagar', 'Cultural', 2024],
  ['Maratha Military Landscapes of India', 'Maharashtra', 'Pune', 'Cultural', 2025],
];

// Verified coordinates for sites whose access town is not in our gazetteer by exact name.
const MANUAL: Record<string, [number, number]> = {
  Champaner: [22.4869, 73.5370],     // Champaner-Pavagadh, Gujarat
  Patan: [23.8587, 72.1017],         // Rani-ki-Vav, Patan, Gujarat
  Santiniketan: [23.6790, 87.6830],  // West Bengal
  Halebidu: [13.2124, 75.9940],      // Hoysala ensembles (Belur/Halebidu), Karnataka
  Sivasagar: [26.9840, 94.6380],     // Moidams, Charaideo, Assam
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
  console.log('UNESCO seed — creating schema ...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS unesco_sites (
      id serial PRIMARY KEY,
      name text NOT NULL UNIQUE,
      state text NOT NULL,
      nearest_town text NOT NULL,
      category varchar(10) NOT NULL CHECK (category IN ('Cultural','Natural','Mixed')),
      year_inscribed smallint NOT NULL,
      lat double precision, lng double precision,
      geocoded_from text,
      blurb text,                          -- write-once, founder-reviewed (U4); NULL for now
      source_url text NOT NULL DEFAULT 'https://en.wikipedia.org/wiki/List_of_World_Heritage_Sites_in_India',
      verified boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS unesco_geo_idx ON unesco_sites(lat, lng)`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS branch_unesco (
      branch_id text NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      unesco_id integer NOT NULL REFERENCES unesco_sites(id) ON DELETE CASCADE,
      via_stay_node_id text NOT NULL,
      km numeric(6,1) NOT NULL,
      PRIMARY KEY (branch_id, unesco_id)
    )`);

  console.log(`geocoding + inserting ${SITES.length} sites ...`);
  let geocoded = 0;
  for (const [name, state, town, category, year] of SITES) {
    const c = await geocode(town);
    if (c) geocoded++;
    await prisma.$executeRawUnsafe(
      `INSERT INTO unesco_sites (name, state, nearest_town, category, year_inscribed, lat, lng, geocoded_from)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (name) DO UPDATE SET state=EXCLUDED.state, nearest_town=EXCLUDED.nearest_town,
         category=EXCLUDED.category, year_inscribed=EXCLUDED.year_inscribed, lat=EXCLUDED.lat,
         lng=EXCLUDED.lng, geocoded_from=EXCLUDED.geocoded_from`,
      name, state, town, category, year, c ? c[0] : null, c ? c[1] : null, c ? town : null);
  }
  console.log(`  geocoded ${geocoded}/${SITES.length} (rest need manual coords — founder review)`);

  // ---- mark branches that traverse a UNESCO site (stop within TRAVERSE_KM) ----------------
  console.log('marking branches that traverse a UNESCO site ...');
  await prisma.$executeRawUnsafe(`TRUNCATE branch_unesco`);
  const sites = await prisma.$queryRawUnsafe<any[]>(`SELECT id, name, lat, lng FROM unesco_sites WHERE lat IS NOT NULL`);
  const stops = await prisma.$queryRawUnsafe<any[]>(
    `SELECT bs.branch_id, bs.stay_node_id, sn.name, sn.lat, sn.lng
       FROM branch_stops bs JOIN stay_nodes sn ON sn.id = bs.stay_node_id`);
  let links = 0;
  const seen = new Set<string>();
  for (const st of stops) {
    for (const site of sites) {
      const km = haversineKm([Number(st.lat), Number(st.lng)], [Number(site.lat), Number(site.lng)]);
      if (km <= TRAVERSE_KM) {
        const key = `${st.branch_id}|${site.id}`;
        if (seen.has(key)) continue; seen.add(key);
        await prisma.$executeRawUnsafe(
          `INSERT INTO branch_unesco (branch_id, unesco_id, via_stay_node_id, km) VALUES ($1,$2,$3,$4)
           ON CONFLICT (branch_id, unesco_id) DO NOTHING`,
          st.branch_id, site.id, st.stay_node_id, Math.round(km * 10) / 10);
        links++;
      }
    }
  }
  const branchesWithUnesco = await prisma.$queryRawUnsafe<any[]>(
    `SELECT count(DISTINCT branch_id)::int n FROM branch_unesco`);
  console.log(`  ${links} branch↔UNESCO links; ${branchesWithUnesco[0].n} of our branches traverse at least one UNESCO site`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
