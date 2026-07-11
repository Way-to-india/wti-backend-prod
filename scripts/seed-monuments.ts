/**
 * Seed ASI monuments → asi_sites.
 *   bun run scripts/seed-monuments.ts <MONUMENTS_CSV>
 *
 * Geocodes each monument's `location` (town) against world_cities (India rows).
 * Rows whose town can't be geocoded are still stored (lat/lng null) so counts by
 * location still work; geocoded ones drive the spatial halt ranking.
 */
import prisma from '@/config/db';
import { readFileSync } from 'fs';

const esc = (v: any): string => v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
function splitCsv(line: string): string[] {
  const out: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else { if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; }
  }
  out.push(cur); return out;
}
async function batchInsert(table: string, cols: string[], rows: any[][], size = 1000) {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size).map((r) => `(${r.map(esc).join(',')})`).join(',');
    await prisma.$executeRawUnsafe(`INSERT INTO ${table} (${cols.join(',')}) VALUES ${chunk}`);
  }
}

async function main() {
  const csv = process.argv[2];
  if (!csv) { console.error('usage: bun run scripts/seed-monuments.ts <MONUMENTS_CSV>'); process.exit(1); }

  console.log('loading world_cities gazetteer…');
  const wc = await prisma.$queryRaw<{ name: string; latitude: number; longitude: number }[]>`
    SELECT name, latitude, longitude FROM world_cities WHERE "countryCode" = 'IN' ORDER BY population DESC NULLS LAST`;
  const geo = new Map<string, [number, number]>();
  for (const r of wc) { const k = norm(r.name); if (!geo.has(k)) geo.set(k, [Number(r.latitude), Number(r.longitude)]); }
  const locate = (town: string, district?: string): [number, number] | null => {
    const k = norm(town || '');
    return geo.get(k) || (district ? geo.get(norm(district)) : null) || null;
  };

  const raw = readFileSync(csv, 'utf8').replace(/^﻿/, '');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const header = splitCsv(lines[0]).map((h) => h.trim());
  const idx = (k: string) => header.indexOf(k);
  const rows: any[][] = [];
  let geocoded = 0;
  for (const line of lines.slice(1)) {
    const r = splitCsv(line);
    const location = (r[idx('location')] || '').trim();
    const name = (r[idx('name_of_the_monument_or_site')] || '').trim();
    const district = (r[idx('district_as_per_lgd')] || r[idx('district_as_per_source')] || '').trim();
    const state = (r[idx('state')] || '').trim();
    const g = locate(location, district);
    if (g) geocoded++;
    rows.push([location, name, district, state, g ? g[0] : null, g ? g[1] : null]);
  }
  console.log(`monuments: ${rows.length} sites (${geocoded} geocoded)`);
  await prisma.$executeRawUnsafe('TRUNCATE asi_sites RESTART IDENTITY');
  await batchInsert('asi_sites', ['location', 'name', 'district', 'state', 'lat', 'lng'], rows);
  console.log('✅ ASI monuments seeded.');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
