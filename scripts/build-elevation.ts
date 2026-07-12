/**
 * US-803c — ELEVATION. The signal the body gates were missing.
 *
 * FOUNDER, 2026-07-12: "the time taken on hills is 20 to 25 km/hour and in plains it is
 * 50-60 kms per hour" — then, locking it: "plains 55 km/h, hills 22 km/h is more accurate."
 *
 * THOSE ARE ALREADY THE ENGINE'S OWN NUMBERS. physiology.terrainSpeedKmh() says rqi 4 ->
 * 55 km/h and rqi 1 -> 22 km/h. THE TABLE WAS RIGHT ALL ALONG. Not one constant changes.
 *
 * WHAT WAS WRONG WAS THE WIRING, AND IT WAS WRONG INSIDE THE BODY GATES.
 *
 *   1. `roadQualityIndex` is READ IN FOUR PLACES AND SET IN NONE. It falls back to 4.
 *      EVERY HILL ROAD IN INDIA WAS BEING PLANNED AT PLAINS SPEED.
 *
 *   2. Worse: vehicleHours() takes OSRM's durationMin whenever it exists, so even the
 *      plains default never ran. OSRM claims 79 km/h on the Guwahati-Shillong road. The
 *      truth is 99 km at 22 km/h — about four and a half hours. The engine believed 1h26.
 *
 *   THEREFORE roadDayHardCapExceeded() — THE GATE THAT PROTECTS A 56-YEAR-OLD'S SPINE —
 *   COULD NOT FIRE ON A MOUNTAIN ROAD, which is the one place it exists to fire. A
 *   five-hour Himalayan day sails through a five-hour cap because the engine thinks it is
 *   ninety minutes. We would have sold a man who asked for "comfortable" an ordeal and
 *   called it comfort. That is the exact crime THE-CONSULTANTS-LAW was written to stop,
 *   and 570 green assertions never saw it. (Lesson 1, again, and this time in the gates.)
 *
 * WHY ELEVATION AND NOT THE WINDING RATIO.
 *
 *   I first tried to detect hills from road_km / crow_km, which I already had for free.
 *   IT FAILED ON A KNOWN CASE: Nainital, a hill station, winds only 1.21 — LESS than
 *   Kaziranga (plains) at 1.29. A body gate may not rest on a signal that is wrong about
 *   Nainital. The winding is only a symptom. ELEVATION IS THE CAUSE.
 *
 *     Shillong 1496m  Gangtok 1650m  Darjeeling 2042m  Ooty 2240m  Nainital 2084m
 *     Kaziranga  80m  Khajuraho 240m  Bharatpur 180m   Agra  170m
 *
 *   Clean separation. And it is a fact about the earth, not a fact about a router's
 *   opinion of a road.
 *
 * THE RECEIPT (spec 3.1). Elevation comes from Open-Meteo's elevation API — free, no key.
 * Every row stores `elevation_source` and `elevation_fetched_at`. A number with no receipt
 * does not exist. Where the API does not answer, the elevation stays NULL and the terrain
 * falls back to the SAFE default — we never invent an altitude that a body gate depends on.
 *
 * Run:  ~/.bun/bin/bun run scripts/build-elevation.ts
 */
import prisma from '@/config/db';

const BATCH = 90;                 // Open-Meteo takes ~100 coordinates per call
const PAUSE_MS = 400;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ask the earth how high it is. Null on any doubt — never a guess. */
async function elevations(points: { lat: number; lng: number }[]): Promise<(number | null)[]> {
  const lat = points.map((p) => p.lat).join(',');
  const lng = points.map((p) => p.lng).join(',');
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`;
  try {
    const r = await fetch(url);
    const j: any = await r.json();
    const arr = j?.elevation;
    if (!Array.isArray(arr) || arr.length !== points.length) return points.map(() => null);
    return arr.map((e: any) => (Number.isFinite(Number(e)) ? Math.round(Number(e)) : null));
  } catch {
    // We do not know. A null is the truth; a guess here has a body gate behind it.
    return points.map(() => null);
  }
}

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE stay_nodes
      ADD COLUMN IF NOT EXISTS elevation_m integer,
      ADD COLUMN IF NOT EXISTS elevation_source text,
      ADD COLUMN IF NOT EXISTS elevation_fetched_at timestamptz`);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE stay_node_gateways
      ADD COLUMN IF NOT EXISTS gateway_elevation_m integer`);

  // ---- 1. every StayNode ---------------------------------------------------------
  const nodes = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, name, lat, lng FROM stay_nodes WHERE elevation_m IS NULL ORDER BY id`);
  console.log(`elevation: ${nodes.length} stay nodes to measure`);

  for (let i = 0; i < nodes.length; i += BATCH) {
    const slice = nodes.slice(i, i + BATCH);
    const els = await elevations(slice.map((n) => ({ lat: Number(n.lat), lng: Number(n.lng) })));
    for (let k = 0; k < slice.length; k++) {
      if (els[k] == null) continue;   // stays NULL. We do not invent altitude.
      await prisma.$executeRawUnsafe(
        `UPDATE stay_nodes SET elevation_m=$1, elevation_source=$2, elevation_fetched_at=now() WHERE id=$3`,
        els[k], 'open-meteo', slice[k].id);
    }
    console.log(`  ${Math.min(i + BATCH, nodes.length)}/${nodes.length}`);
    await sleep(PAUSE_MS);
  }

  // ---- 2. every gateway (the OTHER end of the drive) ------------------------------
  const gws = await prisma.$queryRawUnsafe<any[]>(
    `SELECT DISTINCT gateway_lat AS lat, gateway_lng AS lng FROM stay_node_gateways
      WHERE gateway_elevation_m IS NULL`);
  console.log(`elevation: ${gws.length} distinct gateways to measure`);

  for (let i = 0; i < gws.length; i += BATCH) {
    const slice = gws.slice(i, i + BATCH);
    const els = await elevations(slice.map((g) => ({ lat: Number(g.lat), lng: Number(g.lng) })));
    for (let k = 0; k < slice.length; k++) {
      if (els[k] == null) continue;
      await prisma.$executeRawUnsafe(
        `UPDATE stay_node_gateways SET gateway_elevation_m=$1
          WHERE gateway_lat=$2 AND gateway_lng=$3`,
        els[k], Number(slice[k].lat), Number(slice[k].lng));
    }
    console.log(`  ${Math.min(i + BATCH, gws.length)}/${gws.length}`);
    await sleep(PAUSE_MS);
  }

  // ---- 3. SHOW ME. The hills must separate from the plains, or the signal is no good.
  const proof = await prisma.$queryRawUnsafe<any[]>(`
    SELECT name, elevation_m FROM stay_nodes
     WHERE name IN ('Shillong','Gangtok','Darjeeling','Ooty','Shimla','Munnar','Nainital','Leh',
                    'Kaziranga','Agra','Jaipur','Khajuraho','Bharatpur','Guwahati','Delhi')
     ORDER BY elevation_m DESC NULLS LAST`);
  console.log('\nELEVATION — and the founder\'s speeds, which the engine already knew:');
  for (const p of proof) {
    const band = p.elevation_m == null ? '?' : p.elevation_m >= 1200 ? 'HILL  22 km/h'
      : p.elevation_m >= 600 ? 'MID   42 km/h' : 'PLAIN 55 km/h';
    console.log(`  ${String(p.name).padEnd(12)} ${String(p.elevation_m ?? '-').padStart(5)} m   ${band}`);
  }

  const miss = await prisma.$queryRawUnsafe<any[]>(
    `SELECT count(*)::int AS n FROM stay_nodes WHERE elevation_m IS NULL`);
  console.log(`\nstay nodes with no elevation (they keep the SAFE default): ${miss[0].n}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
