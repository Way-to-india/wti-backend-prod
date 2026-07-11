/**
 * Phase B seed — loads the curated multimodal transport pool.
 *
 * Usage (on the server, where the DB + data files live):
 *   bun run scripts/seed-transport.ts <RAIL_DIR> <FLIGHT_CSV>
 *   e.g. bun run scripts/seed-transport.ts /home/ubuntu/transport-data /home/ubuntu/transport-data/flights.csv
 *
 * RAIL_DIR must contain SF-TRAINS.json, EXP-TRAINS.json, PASS-TRAINS.json.
 * FLIGHT_CSV = DGCA airline-wise-domestic-flight-schedule.csv.
 *
 * Stations/airports are geocoded by matching their city name to world_cities
 * (India rows, highest population wins). Rows that cannot be geocoded are still
 * stored but won't be routable until coordinates exist.
 */
import prisma from '@/config/db';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const DOW = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const toMin = (t?: string | null): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec((t || '').trim());
  return m ? +m[1] * 60 + +m[2] : null;
};
const kmOf = (s?: string | null): number | null => { const m = /(\d+)/.exec(s || ''); return m ? +m[1] : null; };
// DGCA dates are DD-MM-YYYY → ISO YYYY-MM-DD (or null)
const toIso = (s?: string | null): string | null => { const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec((s || '').trim()); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const esc = (v: any): string => v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

async function batchInsert(table: string, cols: string[], rows: (any[])[], size = 1000) {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size).map((r) => `(${r.map(esc).join(',')})`).join(',');
    await prisma.$executeRawUnsafe(`INSERT INTO ${table} (${cols.join(',')}) VALUES ${chunk}`);
  }
}

// tiny CSV line splitter (handles quoted fields)
function splitCsv(line: string): string[] {
  const out: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else { if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; }
  }
  out.push(cur); return out;
}

async function main() {
  const railDir = process.argv[2];
  const flightCsv = process.argv[3];
  if (!railDir || !flightCsv) { console.error('usage: bun run scripts/seed-transport.ts <RAIL_DIR> <FLIGHT_CSV>'); process.exit(1); }

  // ---- geocoder from world_cities (India, highest population wins) ----
  console.log('loading world_cities gazetteer…');
  const wc = await prisma.$queryRaw<{ name: string; latitude: number; longitude: number }[]>`
    SELECT name, latitude, longitude FROM world_cities WHERE "countryCode" = 'IN' ORDER BY population DESC NULLS LAST`;
  const geo = new Map<string, [number, number]>();
  for (const r of wc) { const k = norm(r.name); if (!geo.has(k)) geo.set(k, [Number(r.latitude), Number(r.longitude)]); }
  const locate = (city: string): [number, number] | null => {
    const k = norm(city);
    return geo.get(k) || geo.get(k.split(' ')[0]) || null;
  };

  // ---- RAIL ----
  console.log('parsing rail…');
  const schedules: any[][] = [];
  const stops: any[][] = [];
  const stations = new Map<string, { name: string; city: string }>();
  for (const f of readdirSync(railDir).filter((x) => /TRAINS\.json$/i.test(x))) {
    const arr = JSON.parse(readFileSync(join(railDir, f), 'utf8'));
    for (const t of arr) {
      const bits = DOW.reduce((b, d, i) => b | (t.runningDays?.[d] ? (1 << i) : 0), 0);
      schedules.push([t.trainNumber, t.trainName, bits]);
      let seq = 0;
      for (const s of t.trainRoute || []) {
        const nm: string = s.stationName || '';
        const code = nm.includes(' - ') ? nm.slice(nm.lastIndexOf(' - ') + 3).trim() : nm.trim();
        const city = (nm.includes(' - ') ? nm.slice(0, nm.lastIndexOf(' - ')) : nm).replace(/\b(JN|CANTT|CITY|TERMINUS|TERMINAL|HALT)\b/gi, '').trim();
        const dayOff = Math.max(0, (parseInt(s.day) || 1) - 1);
        stops.push([t.trainNumber, ++seq, code, nm, toMin(s.arrives === 'Source' ? null : s.arrives), toMin(s.departs), dayOff, kmOf(s.distance)]);
        if (code && !stations.has(code)) stations.set(code, { name: nm, city });
      }
    }
  }
  const stationRows = [...stations.entries()].map(([code, v]) => {
    const c = locate(v.city); return [code, v.name, v.city, c ? c[0] : null, c ? c[1] : null];
  });
  console.log(`rail: ${schedules.length} trains, ${stops.length} stops, ${stationRows.length} stations (${stationRows.filter((r) => r[3] != null).length} geocoded)`);

  // ---- AIR ----
  console.log('parsing flights…');
  const lines = readFileSync(flightCsv, 'utf8').split(/\r?\n/).filter(Boolean);
  const header = splitCsv(lines[0]);
  const col = (r: string[], k: string) => r[header.indexOf(k)] || '';
  const arrIdx = new Map<string, string>();
  const parsed = lines.slice(1).map(splitCsv);
  for (const r of parsed) {
    const from = col(r, 'arrival_from'), at = col(r, 'arrival_time');
    if (from && at) arrIdx.set(`${col(r, 'flight_no')}|${from}|${col(r, 'airport_city')}`, at);
  }
  const airportCities = new Set<string>();
  const sectors: any[][] = [];
  const fbits = (fr: string) => [...(fr || '')].reduce((b, d) => (+d >= 1 && +d <= 7 ? b | (1 << (+d - 1)) : b), 0);
  for (const r of parsed) {
    const o = col(r, 'airport_city'), d = col(r, 'departure_to'), dt = col(r, 'departure_time');
    if (!d || !dt) continue;
    airportCities.add(o); airportCities.add(d);
    const at = arrIdx.get(`${col(r, 'flight_no')}|${o}|${d}`);
    const dm = toMin(dt), am = at ? toMin(at) : null;
    let dur = dm != null && am != null ? ((am - dm) % 1440 + 1440) % 1440 : null;
    let dayOff = dur != null && am != null && am < dm! ? 1 : 0;
    if (dur != null && (dur < 20 || dur > 600)) { dur = null; dayOff = 0; } // drop multi-hop/mismatched joins
    sectors.push([o, d, col(r, 'flight_no'), col(r, 'airline'), dm, am, dur, dayOff, fbits(col(r, 'frequency')), col(r, 'aircraft_type'),
      toIso(col(r, 'effective_from')), toIso(col(r, 'effective_to'))]);
  }
  const airportRows = [...airportCities].map((c) => { const g = locate(c); return [c, g ? g[0] : null, g ? g[1] : null]; });
  console.log(`air: ${sectors.length} sectors, ${airportRows.length} airport cities (${airportRows.filter((r) => r[1] != null).length} geocoded)`);

  // ---- load ----
  console.log('truncating + inserting…');
  await prisma.$executeRawUnsafe('TRUNCATE train_schedules, train_stops, train_stations, flight_sectors, airport_cities RESTART IDENTITY');
  await batchInsert('train_schedules', ['train_no', 'train_name', 'running_days'], schedules);
  await batchInsert('train_stops', ['train_no', 'seq', 'station_code', 'station_name', 'arr_min', 'dep_min', 'day_offset', 'cum_km'], stops);
  await batchInsert('train_stations', ['code', 'name', 'city', 'lat', 'lng'], stationRows);
  await batchInsert('airport_cities', ['city', 'lat', 'lng'], airportRows);
  await batchInsert('flight_sectors', ['origin_city', 'dest_city', 'flight_no', 'airline', 'dep_min', 'arr_min', 'dur_min', 'day_offset', 'operating_days', 'aircraft', 'eff_from', 'eff_to'], sectors);
  console.log('✅ transport pool seeded.');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
