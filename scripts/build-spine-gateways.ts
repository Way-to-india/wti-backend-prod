/**
 * US-803 PASS 2 — THE REAL DRIVE. Sprint 8 / THE DESIGNER.
 *
 * Founder ruling, Amendment 1: "An Attraction attaches to a StayNode by REAL DRIVE TIME,
 * not by administrative district." The same is true of a railhead and an airport — the
 * whole question a traveller is asking is "how long is the drive from the station?"
 *
 * PASS 1 (the SQL migration) shortlists gateway candidates on HAVERSINE, and it names the
 * column `straight_line_km` because that is what haversine is. IN THE HILLS A STRAIGHT
 * LINE IS A LIE ABOUT A DRIVE. Shillong to Guwahati is 70 km as the crow flies and about
 * three hours in a car. Nothing in this system is permitted to call one the other.
 *
 * THIS PASS asks OSRM for the real road distance and the real driving time, writes them,
 * and THEN — and only then — decides which gateway is `primary`.
 *
 *   THE RE-RANK IS THE POINT. The provisional shortlist was scored on a straight line.
 *   The decision the traveller is shown is made on a real road. If those two disagree,
 *   the road wins, every time.
 *
 * Ranking, on the REAL drive:
 *     score = ln(services) - 0.5 * (road_km / 100)
 *
 *   * SERVICES have sharply diminishing returns — 9 trains to 40 is the difference between
 *     a halt and a railhead; 146 to 154 is nothing.
 *   * THE DRIVE is a linear cost, and by THE-CONSULTANTS-LAW Law 2 it is the thing the
 *     traveller actually feels. The ordeal is the point, not the mode.
 *
 *   'primary' = the best on that score. 'nearest' = the shortest REAL drive.
 *   When they differ, the consultant has an honest choice to offer:
 *     "Furkating is closer, but Guwahati has ten times the trains."
 *
 * ANTI-FABRICATION: if OSRM does not answer for a candidate, road_km/road_min stay NULL.
 * A NULL is not a problem — it is the truth. Nothing downstream may present a
 * straight_line_km as a drive time, and a gateway with no real drive is never made
 * 'primary' unless nothing else can be.
 *
 * Run:  ~/.bun/bin/bun run scripts/build-spine-gateways.ts
 *       ~/.bun/bin/bun run scripts/build-spine-gateways.ts --attractions   (also backfill POIs)
 */
import prisma from '@/config/db';
import { osrmDriving } from '@/services/route-optimizer/geo';

const CONCURRENCY = 4;          // public OSRM. We are a guest on it; we behave like one.
const PAUSE_MS = 120;
const MAX_RANK = 3;             // only the candidates that could actually win the argument

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Row {
  stay_node_id: string; kind: string; rank: number;
  node_lat: number; node_lng: number;
  gateway_lat: number; gateway_lng: number;
  gateway_name: string; services: number;
}

/** Run `worker` over `items`, at most `n` at a time. */
async function pool<T>(items: T[], n: number, worker: (t: T, i: number) => Promise<void>) {
  let next = 0;
  const runners = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await worker(items[i], i);
      await sleep(PAUSE_MS);
    }
  });
  await Promise.all(runners);
}

async function main() {
  const alsoAttractions = process.argv.includes('--attractions');

  // ---- 1. THE GATEWAYS -----------------------------------------------------------
  const rows = await prisma.$queryRawUnsafe<Row[]>(`
    SELECT g.stay_node_id, g.kind, g.rank,
           n.lat AS node_lat, n.lng AS node_lng,
           g.gateway_lat, g.gateway_lng, g.gateway_name, g.services
      FROM stay_node_gateways g
      JOIN stay_nodes n ON n.id = g.stay_node_id
     WHERE g.rank <= ${MAX_RANK} AND g.road_km IS NULL
     ORDER BY g.stay_node_id, g.kind, g.rank`);

  console.log(`OSRM: asking for the real drive on ${rows.length} gateway candidates...`);

  let got = 0, missed = 0;
  await pool(rows, CONCURRENCY, async (r) => {
    const res = await osrmDriving(
      [Number(r.node_lat), Number(r.node_lng)],
      [Number(r.gateway_lat), Number(r.gateway_lng)],
    );
    if (!res) {
      // The truth is that we do not know. We write nothing rather than a straight line.
      missed++;
      return;
    }
    got++;
    await prisma.$executeRawUnsafe(
      `UPDATE stay_node_gateways SET road_km = $1, road_min = $2
        WHERE stay_node_id = $3 AND kind = $4 AND rank = $5`,
      res.km, res.min, r.stay_node_id, r.kind, r.rank);
  });
  console.log(`  real drives written: ${got}   OSRM had no answer: ${missed}`);

  // ---- 2. THE RE-RANK. Now, on the real road. ------------------------------------
  //
  // Everything above this line was a shortlist. THIS is the decision, and it is made on
  // a road that exists. A candidate with no real drive (road_km IS NULL) can only be
  // chosen if there is nothing else — we never promote a guess over a measurement.
  await prisma.$executeRawUnsafe(`UPDATE stay_node_gateways SET role = NULL`);

  await prisma.$executeRawUnsafe(`
    WITH best AS (
      SELECT DISTINCT ON (stay_node_id, kind) stay_node_id, kind, rank
        FROM stay_node_gateways
       WHERE rank <= ${MAX_RANK}
       ORDER BY stay_node_id, kind,
                (road_km IS NULL) ASC,                                  -- a measurement beats a guess
                (ln(GREATEST(services,1)::numeric)
                   - 0.5 * (COALESCE(road_km, straight_line_km) / 100)) DESC
    )
    UPDATE stay_node_gateways g SET role = 'primary'
      FROM best WHERE g.stay_node_id = best.stay_node_id
                  AND g.kind = best.kind AND g.rank = best.rank`);

  await prisma.$executeRawUnsafe(`
    WITH closest AS (
      SELECT DISTINCT ON (stay_node_id, kind) stay_node_id, kind, rank
        FROM stay_node_gateways
       WHERE rank <= ${MAX_RANK}
       ORDER BY stay_node_id, kind,
                (road_km IS NULL) ASC,
                COALESCE(road_km, straight_line_km) ASC
    )
    UPDATE stay_node_gateways g SET role = COALESCE(g.role, 'nearest')
      FROM closest WHERE g.stay_node_id = closest.stay_node_id
                     AND g.kind = closest.kind AND g.rank = closest.rank`);

  // ---- 3. THE ATTRACTIONS (opt-in; 1,800+ OSRM calls) ------------------------------
  if (alsoAttractions) {
    const atts = await prisma.$queryRawUnsafe<any[]>(`
      SELECT a.id, a.lat, a.lng, n.lat AS node_lat, n.lng AS node_lng
        FROM attractions a JOIN stay_nodes n ON n.id = a.stay_node_id
       WHERE a.stay_node_id IS NOT NULL AND a.road_min IS NULL`);
    console.log(`OSRM: real drive for ${atts.length} attractions...`);
    let a_got = 0;
    await pool(atts, CONCURRENCY, async (a) => {
      const res = await osrmDriving(
        [Number(a.node_lat), Number(a.node_lng)],
        [Number(a.lat), Number(a.lng)]);
      if (!res) return;   // stays NULL. We do not invent a drive.
      a_got++;
      await prisma.$executeRawUnsafe(
        `UPDATE attractions SET road_km = $1, road_min = $2 WHERE id = $3`,
        res.km, res.min, Number(a.id));
    });
    console.log(`  attraction drives written: ${a_got}`);
  }

  // ---- 4. SHOW ME -----------------------------------------------------------------
  const proof = await prisma.$queryRawUnsafe<any[]>(`
    SELECT n.name, g.kind, g.role, g.gateway_name, g.services,
           g.straight_line_km AS crow_km, g.road_km, g.road_min
      FROM stay_nodes n JOIN stay_node_gateways g ON g.stay_node_id = n.id
     WHERE n.name IN ('Guwahati','Shillong','Kaziranga','Gangtok','Darjeeling')
       AND g.role IS NOT NULL
     ORDER BY n.name, g.kind, g.role`);
  console.log('\nTHE NORTH EAST, ON REAL ROADS:');
  for (const p of proof) {
    const drive = p.road_min ? `${Math.floor(p.road_min / 60)}h${String(p.road_min % 60).padStart(2, '0')}` : 'no OSRM answer';
    console.log(`  ${p.name.padEnd(11)} ${p.kind.padEnd(5)} ${String(p.role).padEnd(8)} ${String(p.gateway_name).padEnd(24)} ` +
                `svc=${String(p.services).padStart(3)}  crow=${String(p.crow_km).padStart(6)}km  ROAD=${String(p.road_km ?? '-').padStart(5)}km ${drive}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
