/**
 * FILL THE 61 — Google AND OpenStreetMap must agree, or we write nothing.
 *
 * FOUNDER: "why not run those 61 against google geolocation api and fill after double
 *           confirmation?"
 *
 * Exactly right, and it is our own standing rule wearing a new hat (spec §3.2): "a row is
 * unverified until a SECOND, INDEPENDENT SOURCE agrees." One geocoder is an opinion. Two
 * independent geocoders landing on the same point is a receipt.
 *
 * THE SWEEP FOUND: 61 of 209 active cities have NO COORDINATES AT ALL. They cannot be
 * routed, mapped, or priced. Some are sold heavily -- Fatehpur Sikri in 15 tours, Coimbatore
 * 11, Ajmer 10, Bhubaneshwar 10, New Delhi 9, Trivandrum 9, Kochi 8.
 *
 * ---------------------------------------------------------------------------------------
 * WHAT WE DO NOT GEOCODE, AND WHY IT MATTERS MORE THAN WHAT WE DO
 * ---------------------------------------------------------------------------------------
 *
 * Several of the 61 are not cities at all. They are BROKEN NAMES -- rows called "New", "Port",
 * "Sawai", "24", "Kumaon Village", "Kalra Caves". These are truncations and parse artefacts
 * ("New Delhi", "Port Blair", "Sawai Madhopur", "24 Parganas").
 *
 * GEOCODING A BROKEN NAME IS THE MOST DANGEROUS THING IN THIS FILE. Ask Google for "New" and
 * it will hand you back somewhere, confidently, with a lovely precise coordinate -- and we
 * would have manufactured a place. That is exactly how "Nasik" became an island in Indonesia.
 * They are REPORTED FOR A HUMAN and never sent to a geocoder.
 *
 * Pokhara is in NEPAL and is skipped by the India gate, correctly.
 *
 * ---------------------------------------------------------------------------------------
 * THE FOUR GATES. A row is written only if it clears all four.
 * ---------------------------------------------------------------------------------------
 *   GATE 1  BOTH SOURCES ANSWERED.  Google alone is not enough. OSM alone is not enough.
 *   GATE 2  THEY AGREE within 25 km. If two independent surveys of the earth disagree by
 *           more than that, they are describing different places and we do not get to pick.
 *   GATE 3  IN INDIA, and -- where our own writers named a state -- IN THAT STATE (a
 *           gazetteer town of that state within 60 km). This is the gate that stops the
 *           second Manali.
 *   GATE 4  THE DESIGNERS' OWN DISTANCES. Any road distance our designers WROTE for this
 *           town must become possible: crow-fly <= the km they drove. Our own thirty years
 *           gets the last word over both Google and OpenStreetMap.
 *
 * Anything that fails a gate is REPORTED, NOT WRITTEN. It waits for a person.
 *
 * Run:  ~/.bun/bin/bun run scripts/fill_missing_coords.ts           (dry run)
 *       ~/.bun/bin/bun run scripts/fill_missing_coords.ts --apply
 */
import prisma from '@/config/db';
import { haversineKm } from '@/services/route-optimizer/geo';

const APPLY = process.argv.includes('--apply');
const AGREE_KM = 25;
const STATE_KM = 60;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const KEY = process.env.GOOGLE_PLACES_API_KEY || '';

/** A name we refuse to send to a geocoder. A truncation geocoded is a place invented. */
function isBrokenName(n: string): boolean {
  const t = n.trim().toLowerCase();
  if (/^\d+$/.test(t)) return true;                    // "24" -- a truncated "24 Parganas"
  if (t.length < 4) return true;
  // Truncations and generic descriptors. My first version of this list had an '&&' bug that
  // let "Kumaon Village" through to the geocoder -- and Google, being Google, cheerfully
  // returned a precise coordinate for a phrase that is not a town. A geocoder will ALWAYS
  // give you an answer. That is exactly why the name has to be vetted before it is asked.
  const BROKEN = new Set([
    'new', 'port', 'sawai', 'old delhi', 'new delhi is fine',
    'kumaon village', 'kalra caves', 'bekal town',
  ]);
  if (BROKEN.has(t)) return true;
  // a bare descriptor with no proper noun in it
  if (/^(the )?(village|town|city|valley|hill station)$/.test(t)) return true;
  return false;
}

interface Hit { lat: number; lng: number; label: string }

async function google(q: string): Promise<Hit | null> {
  if (!KEY) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&components=country:IN&key=${KEY}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(9000) });
    const j: any = await r.json();
    if (j.status !== 'OK' || !j.results?.length) return null;
    const g = j.results[0];
    const loc = g.geometry?.location;
    if (!Number.isFinite(loc?.lat) || !Number.isFinite(loc?.lng)) return null;
    return { lat: Number(loc.lat), lng: Number(loc.lng), label: String(g.formatted_address ?? '') };
  } catch { return null; }
}

async function osm(q: string): Promise<Hit | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=1&countrycodes=in&accept-language=en`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'WayToIndia-TripPlanner/1.0 (info@waytoindia.com)' },
      signal: AbortSignal.timeout(9000),
    });
    const rows: any[] = await r.json();
    const h = rows?.[0];
    if (!h || !Number.isFinite(Number(h.lat))) return null;
    return { lat: Number(h.lat), lng: Number(h.lon), label: String(h.display_name ?? '') };
  } catch { return null; }
}

async function kmToState(code: string, lat: number, lng: number): Promise<number | null> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT MIN(6371*acos(LEAST(1,GREATEST(-1,
        cos(radians($2::float))*cos(radians(latitude::float))*cos(radians(longitude::float)-radians($3::float))
      + sin(radians($2::float))*sin(radians(latitude::float)))))) AS km
       FROM world_cities WHERE "countryCode"='IN' AND "admin1Code" = $1`, code, lat, lng);
  return rows?.[0]?.km == null ? null : Number(rows[0].km);
}

/** GATE 4 — the road distances OUR OWN DESIGNERS wrote for this town. */
async function designerLegs(cityId: string, name: string) {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT ti.title, c2.name AS other, c2.latitude::float AS lat, c2.longitude::float AS lng
       FROM tour_itinerary ti
       JOIN tour_cities tc  ON tc."tourId"  = ti."tourId" AND tc."cityId" = $1
       JOIN tour_cities tc2 ON tc2."tourId" = ti."tourId" AND tc2."cityId" <> $1
       JOIN cities c2 ON c2.id = tc2."cityId"
      WHERE ti.title ~* '[0-9]{2,4}\\s*(km|kms)'
        AND ti.title ILIKE '%' || $2 || '%' AND ti.title ILIKE '%' || c2.name || '%'
        AND c2.latitude IS NOT NULL`, cityId, name);
  const out: { other: string; lat: number; lng: number; km: number }[] = [];
  for (const r of rows) {
    const m = String(r.title).match(/(\d{2,4})\s*(?:km|kms)\b/i);
    if (!m) continue;
    const km = Number(m[1]);
    if (km >= 20 && km <= 2000) out.push({ other: r.other, lat: Number(r.lat), lng: Number(r.lng), km });
  }
  return out;
}

async function main() {
  if (!KEY) console.log('\n!! GOOGLE_PLACES_API_KEY not set — Google gate cannot run. Nothing will be written.\n');

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT c.id, c.name, c."tourCount" AS tours, gc."stateName" AS guide_state, s.admin1_code AS claimed
       FROM cities c
       LEFT JOIN travel_guide_cities gc ON lower(gc.name) = lower(c.name)
       LEFT JOIN india_states s ON s.name = gc."stateName"
      WHERE c."isActive" AND (c.latitude IS NULL OR c.longitude IS NULL)
      ORDER BY c."tourCount" DESC`);

  console.log(`\nFILL THE MISSING COORDINATES ${APPLY ? '(APPLYING)' : '(DRY RUN — nothing written)'}`);
  console.log(`${rows.length} cities carry no coordinates.\n`);

  const written: string[] = [];
  const refused: string[] = [];
  const broken: string[] = [];

  for (const c of rows) {
    const name = String(c.name);

    if (isBrokenName(name)) {
      broken.push(`${name} (${c.tours} tours)`);
      continue;   // NEVER geocode a truncation. That is how you invent a place.
    }

    const q = c.guide_state ? `${name}, ${c.guide_state}, India` : `${name}, India`;
    const g = await google(q);
    await sleep(120);
    const o = await osm(q);
    await sleep(1100);   // we are a guest on Nominatim

    // GATE 1 — both must answer
    if (!g || !o) {
      refused.push(`${name.padEnd(24)} GATE 1  only ${g ? 'Google' : o ? 'OSM' : 'neither'} answered — one source is an opinion, not a receipt`);
      continue;
    }

    // GATE 2 — they must agree
    const apart = haversineKm([g.lat, g.lng], [o.lat, o.lng]);
    if (apart > AGREE_KM) {
      refused.push(`${name.padEnd(24)} GATE 2  Google and OSM disagree by ${apart.toFixed(0)} km — they are describing different places`);
      continue;
    }
    const lat = (g.lat + o.lat) / 2, lng = (g.lng + o.lng) / 2;

    // GATE 3 — in India, and in the state our writers named
    if (!(lat >= 6 && lat <= 37.5 && lng >= 68 && lng <= 97.5)) {
      refused.push(`${name.padEnd(24)} GATE 3  outside India (${lat.toFixed(2)}, ${lng.toFixed(2)})`);
      continue;
    }
    if (c.claimed) {
      const km = await kmToState(c.claimed, lat, lng);
      if (km == null || km > STATE_KM) {
        refused.push(`${name.padEnd(24)} GATE 3  our guide says ${c.guide_state}, but this point is ${km?.toFixed(0) ?? '?'} km from it`);
        continue;
      }
    }

    // GATE 4 — our own designers get the last word
    const legs = await designerLegs(c.id, name);
    const impossible = legs.filter((l) => haversineKm([lat, lng], [l.lat, l.lng]) > l.km * 1.05);
    if (impossible.length) {
      const worst = impossible[0];
      refused.push(`${name.padEnd(24)} GATE 4  our designers drove ${name}->${worst.other} in ${worst.km} km; this point is ` +
                   `${haversineKm([lat, lng], [worst.lat, worst.lng]).toFixed(0)} km away as the crow flies`);
      continue;
    }

    written.push(`${name.padEnd(24)} ${lat.toFixed(4)}, ${lng.toFixed(4)}  [${c.tours} tours]  ` +
                 `Google & OSM agree to ${apart.toFixed(1)} km${legs.length ? `; ${legs.length} designer distances hold` : ''}`);

    if (APPLY) {
      await prisma.$executeRawUnsafe(
        `UPDATE cities SET latitude = $1, longitude = $2 WHERE id = $3`, lat, lng, c.id);
    }
  }

  console.log(`--- WRITTEN (${written.length}) — Google and OpenStreetMap both agree ---`);
  for (const w of written) console.log(`  ${w}`);
  console.log(`\n--- REFUSED (${refused.length}) — a gate failed. These wait for a person. ---`);
  for (const r of refused) console.log(`  ${r}`);
  console.log(`\n--- NOT A CITY (${broken.length}) — broken/truncated rows. NEVER sent to a geocoder. ---`);
  console.log(`  ${broken.join(', ')}`);
  console.log(`  These need a HUMAN to repair or delete the row. Geocoding "New" or "24" would`);
  console.log(`  manufacture a place, and manufacturing places is the one thing we do not do.\n`);

  if (!APPLY) console.log('DRY RUN — nothing was written. Re-run with --apply.\n');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
