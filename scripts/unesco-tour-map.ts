/**
 * U3 — TOUR-LEVEL UNESCO MAPPING (distance tiers).
 *
 * Rides on U1/U2 (scripts/unesco-seed.ts -> unesco_sites). Where U1/U2 marked the deduped
 * BRANCHES (one per struct_hash) within 65 km, this maps EVERY TOUR we sell so the tour
 * detail page and the /destinations collection can honestly say which World Heritage Sites
 * the route passes.
 *
 * Honest by distance. We measure from where the traveller STAYS (tour_stays -> cities lat/lng,
 * the same gazetteer coordinates the site geocoding used) to each site's access point:
 *   in_city     <= 12 km   (you are based at the gateway town — see it while you are here)
 *   short_drive <= 35 km   (a short drive from your stay)
 *   day_trip    <= 65 km   (an easy day trip from your stay)
 * A tour keeps the CLOSEST stay for each site (min km => the strongest honest claim).
 *
 * Idempotent (truncate + rebuild). NO model call. Pure arithmetic on verified coordinates.
 * Run: bun run scripts/unesco-tour-map.ts
 */
import prisma from '@/config/db';
import { haversineKm } from '@/services/route-optimizer/geo';

const IN_CITY_KM = 12;
const SHORT_DRIVE_KM = 35;
const DAY_TRIP_KM = 65;

function tierFor(km: number): 'in_city' | 'short_drive' | 'day_trip' | null {
  if (km <= IN_CITY_KM) return 'in_city';
  if (km <= SHORT_DRIVE_KM) return 'short_drive';
  if (km <= DAY_TRIP_KM) return 'day_trip';
  return null;
}

async function main() {
  console.log('U3 UNESCO tour-map — creating schema ...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS tour_unesco (
      tour_id    text    NOT NULL,
      unesco_id  integer NOT NULL REFERENCES unesco_sites(id) ON DELETE CASCADE,
      tier       varchar(12) NOT NULL CHECK (tier IN ('in_city','short_drive','day_trip')),
      via_city   text    NOT NULL,
      km         numeric(6,1) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (tour_id, unesco_id)
    )`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS tour_unesco_unesco_idx ON tour_unesco(unesco_id)`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS tour_unesco_tour_idx   ON tour_unesco(tour_id)`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS tour_unesco_tier_idx   ON tour_unesco(tier)`);

  const sites = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, name, lat, lng FROM unesco_sites WHERE lat IS NOT NULL`);
  // Every stop we KNOW the traveller sleeps at, with real coordinates. tour_stays.tourId is
  // tours.id; wtiCityId resolves to cities(lat/lng). 1002/1003 rows carry coordinates.
  const stops = await prisma.$queryRawUnsafe<any[]>(
    `SELECT ts."tourId" AS tour_id, c.name AS city, c.latitude AS lat, c.longitude AS lng
       FROM tour_stays ts JOIN cities c ON c.id = ts."wtiCityId"
      WHERE c.latitude IS NOT NULL AND c.longitude IS NOT NULL`);
  console.log(`  ${sites.length} geocoded sites x ${stops.length} geocoded stops`);

  // Keep the CLOSEST stay per (tour, site).
  type Best = { km: number; city: string };
  const best = new Map<string, Best>();       // key = tour_id|unesco_id
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

  console.log('  rebuilding tour_unesco ...');
  await prisma.$executeRawUnsafe(`TRUNCATE tour_unesco`);
  let links = 0;
  const tierCount = { in_city: 0, short_drive: 0, day_trip: 0 };
  for (const [key, b] of best) {
    const [tourId, unescoId] = key.split('|');
    const tier = tierFor(b.km);
    if (!tier) continue;
    await prisma.$executeRawUnsafe(
      `INSERT INTO tour_unesco (tour_id, unesco_id, tier, via_city, km)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (tour_id, unesco_id) DO UPDATE SET tier=EXCLUDED.tier,
         via_city=EXCLUDED.via_city, km=EXCLUDED.km`,
      tourId, Number(unescoId), tier, b.city, Math.round(b.km * 10) / 10);
    links++; tierCount[tier]++;
  }
  const toursCovered = await prisma.$queryRawUnsafe<any[]>(
    `SELECT count(DISTINCT tour_id)::int n FROM tour_unesco`);
  const sitesWithTours = await prisma.$queryRawUnsafe<any[]>(
    `SELECT count(DISTINCT unesco_id)::int n FROM tour_unesco`);
  console.log(`  ${links} tour<->UNESCO links (in_city ${tierCount.in_city}, ` +
    `short_drive ${tierCount.short_drive}, day_trip ${tierCount.day_trip})`);
  console.log(`  ${toursCovered[0].n} tours cover at least one UNESCO site; ` +
    `${sitesWithTours[0].n} of ${sites.length} sites are reachable on a tour we sell`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
