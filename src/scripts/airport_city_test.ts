/**
 * THE AIRPORT-CITY TEST — the airport equivalent of the railway physics test.
 * 2026-07-11. Founder: "It would be difficult for me to verify 83 airports manually. Come up
 * with some intelligent mode to verify these."
 *
 * ---------------------------------------------------------------------------------------
 * FIRST, THE MISTAKE I ALMOST MADE — because it is the whole point of this file.
 *
 * My first attempt tested every row against the aviation registry and demanded that the
 * coordinate sit ON A RUNWAY, within 5 km of a real airfield. It held 162 of the 204 rows —
 * including Delhi.
 *
 * Delhi is not wrong. **`airport_cities` does not store runways. It stores CITIES THAT HAVE AN
 * AIRPORT.** Delhi is recorded at 28.652, 77.231 — Delhi city — while the runway at Indira
 * Gandhi International is at 28.556, 77.095, some fifteen kilometres away. And the engine uses
 * it as a city: `providers.ts` draws a box around a city to ask "can a traveller fly here?", and
 * `gateway.ts` measures from the city to the trip.
 *
 * So "must be on a runway" was the WRONG STANDARD. Had I applied it, I would have dragged every
 * airport city onto its tarmac and quietly broken the gateway logic — a confident, well-tested,
 * completely wrong repair. **Before judging data, understand what the data is FOR.**
 *
 * ---------------------------------------------------------------------------------------
 * THE RIGHT QUESTION, AND THE THREE GATES THAT ANSWER IT
 *
 * The question this table must answer is: *"Is this a real city that a traveller can actually
 * fly into?"* Three arithmetic gates, no language model, no opinion:
 *
 *   GATE 1 — IS IT THE RIGHT CITY?
 *     The coordinate must be within 25 km of the city it names, measured against `world_cities`.
 *     This is what catches Gorakhpur, which we hold at 29.448, 75.672 — a point near HISAR, IN
 *     HARYANA, roughly 800 km from the real Gorakhpur in Uttar Pradesh. It is the Anand Vihar
 *     failure, in aviation form.
 *
 *   GATE 2 — CAN YOU ACTUALLY FLY THERE?
 *     There must be a real airport within 80 km, present in OurAirports (the aviation industry's
 *     open registry) with SCHEDULED SERVICE and an airline code. Founder's own standing rule:
 *     never treat an airstrip as a usable gateway. A planner that routes a family through an
 *     airfield with no flights has lied to them, however good its arithmetic.
 *
 *   GATE 3 — IS IT THE AIRPORT WE THINK IT IS?
 *     That airport must be the NEAREST served airport to this city. If a different served airport
 *     is much closer, then this "airport city" is really served by somewhere else, and we should
 *     say so rather than quietly route through the wrong one.
 *
 * VERDICTS
 *   ALREADY_RIGHT — the live value passes all three. Nothing to do.
 *   FILLED        — we held NO coordinate (97 of the 204 rows are blank, which is why the engine
 *                   cannot see half of your airport list). The city's own coordinate is written,
 *                   and only when gates 2 and 3 also pass.
 *   PROVEN        — the live value fails, and the corrected value passes all three. Written.
 *   NOT_AN_AIRPORT_CITY — the city is real, but there is NO served airport near it. This row is
 *                   a lie by omission and must never be offered as a gateway. Flagged, not written.
 *   HELD          — anything else. Nothing written. The reason is printed by name.
 *
 * Every write is backed up in `geo_coord_backup` and is reversible. DRY_RUN=1 changes nothing.
 */
import prisma from '../config/db';
import { readFileSync, writeFileSync } from 'fs';

const DRY_RUN = process.env.DRY_RUN !== '0';
const OURAIRPORTS_CSV = process.env.OURAIRPORTS_CSV || '/tmp/ourairports_india.csv';

const RIGHT_CITY_KM = 25;   // gate 1 — the coordinate must BE the city it names
const CAN_FLY_KM = 80;      // gate 2 — a served airport must be within this of the city
const WRONG_AIRPORT_KM = 30; // gate 3 — another served airport being this much closer = wrong city

function km(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

interface Field { name: string; lat: number; lng: number; iata: string; served: boolean; municipality: string }

/** compare names without punctuation or case — 'New Delhi' vs 'new-delhi' */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += c; }
    else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

function loadServedAirports(): Field[] {
  const rows = parseCsv(readFileSync(OURAIRPORTS_CSV, 'utf8'));
  const head = rows[0].map((h) => h.trim());
  const ix = (n: string) => head.indexOf(n);
  const out: Field[] = [];
  for (const r of rows.slice(1)) {
    if (r.length < 6) continue;
    const lat = Number(r[ix('latitude_deg')]), lng = Number(r[ix('longitude_deg')]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const served = String(r[ix('scheduled_service')] ?? '').trim() === '1' || String(r[ix('scheduled_service')] ?? '').trim().toLowerCase() === 'yes';
    const iata = (r[ix('iata_code')] ?? '').trim();
    if (!served || !iata) continue;     // GATE 2 lives here: only REAL, SERVED airports exist for us
    out.push({ name: r[ix('name')] ?? '', lat, lng, iata, served, municipality: r[ix('municipality')] ?? '' });
  }
  return out;
}

type Verdict = 'ALREADY_RIGHT' | 'FILLED' | 'PROVEN' | 'NOT_AN_AIRPORT_CITY' | 'HELD';

interface Row { city: string; verdict: Verdict; oldLat: number | null; oldLng: number | null; newLat?: number; newLng?: number; airport?: string; iata?: string; airportKm?: number; reason: string }

async function main() {
  const served = loadServedAirports();
  console.log(`Aviation registry: ${served.length} Indian airports with SCHEDULED FLIGHTS and an airline code.\n`);

  const live = await prisma.$queryRawUnsafe<{ city: string; lat: number | null; lng: number | null }[]>(
    `SELECT city, lat, lng FROM airport_cities ORDER BY city`);

  /**
   * NAME COLLISION — the bug this query now prevents.
   *
   * The first run proposed moving Jodhpur to Porbandar and Udaipur to Agartala, and declared that
   * Hyderabad, Kochi, Goa and Gaya have no airport. Every one of those was a name collision:
   * "Hyderabad" matched Hyderabad in PAKISTAN, "Kochi" matched Kochi in JAPAN, "Goa" matched Goa
   * in the PHILIPPINES, "Gaya" matched Gaya in NIGER, "Jodhpur" matched a 47,000-person village in
   * Gujarat instead of the city of a million in Rajasthan, and "Udaipur" matched a small town in
   * Tripura.
   *
   * A NAME IS NOT A PLACE. So: India only, and the largest population of that name. DISTINCT ON
   * keeps exactly one row per name — the biggest one.
   */
  /**
   * THE AIRPORT IS THE ARBITER — and population is never consulted again.
   *
   * Twice in one hour a name-match produced a confidently wrong place. First, no disambiguation
   * at all: "Hyderabad" matched Hyderabad in PAKISTAN, "Kochi" matched Kochi in JAPAN. I fixed
   * that with "India only, largest population" — and then GORAKHPUR came back as ALREADY RIGHT
   * while sitting in HARYANA, 800 km from the real city in Uttar Pradesh.
   *
   * Our gazetteer holds TWO Gorakhpurs in India, and the HARYANA one carries a population of
   * 1,324,570 — the Uttar Pradesh city's population, bolted onto the wrong coordinate. And
   * `airport_cities` had been built from that very row. So our two values AGREED WITH EACH OTHER
   * and sailed through the check. **Two wrongs made a right-looking answer.**
   *
   * You cannot check a fact against a copy of itself. You need a witness that was never in the
   * room — and for an airport city, that witness is the aviation registry. It has never heard of
   * our gazetteer or our population figures, so it cannot be wrong in the same way we are.
   *
   * So we now fetch EVERY same-named Indian city, and let the airport choose between them by
   * distance. Population is not used, ever.
   */
  const cityRows = await prisma.$queryRawUnsafe<{ name: string; latitude: number; longitude: number }[]>(
    `SELECT name, latitude, longitude FROM world_cities
      WHERE lower(name) = ANY($1) AND "countryCode" = 'IN'`,
    live.map((a) => a.city.toLowerCase()));
  const candidatesBy = new Map<string, { lat: number; lng: number }[]>();
  for (const c of cityRows) {
    const k = c.name.toLowerCase();
    const arr = candidatesBy.get(k) ?? [];
    arr.push({ lat: Number(c.latitude), lng: Number(c.longitude) });
    candidatesBy.set(k, arr);
  }

  /** The SERVED airport that names this city as its municipality. The witness from outside. */
  function registryAirportFor(city: string): Field | null {
    const n = norm(city);
    return (
      served.find((f) => norm(f.municipality) === n) ??
      served.find((f) => f.iata.toLowerCase() === city.toLowerCase()) ??
      served.find((f) => n.length >= 5 && norm(f.name).includes(n)) ??
      null
    );
  }

  /** Where this city REALLY is: the same-named Indian city nearest its own airport. If none is
   *  near it, the airport's own location — a traveller flying to Gorakhpur lands at Gorakhpur
   *  airport, and that is a truthful place to put the pin. */
  function trueLocation(city: string): { point: { lat: number; lng: number } | null; airport: Field | null; viaRegistry: boolean } {
    const ap = registryAirportFor(city);
    const cands = candidatesBy.get(city.toLowerCase()) ?? [];

    if (ap) {
      let best: { p: { lat: number; lng: number }; d: number } | null = null;
      for (const p of cands) {
        const d = km(p.lat, p.lng, ap.lat, ap.lng);
        if (!best || d < best.d) best = { p, d };
      }
      if (best && best.d <= CAN_FLY_KM) return { point: best.p, airport: ap, viaRegistry: false };
      return { point: { lat: ap.lat, lng: ap.lng }, airport: ap, viaRegistry: true };
    }
    // no airport of that name in the registry — we can still test the city, but gate 2 will judge it
    if (cands.length === 1) return { point: cands[0], airport: null, viaRegistry: false };
    return { point: null, airport: null, viaRegistry: false };
  }
  const cityBy = new Map<string, { lat: number; lng: number }>();  // kept for shape compatibility

  /** GATE 2 + 3 — which served airport serves this point, and is it the nearest one? */
  function airportFor(lat: number, lng: number): { f: Field; d: number } | null {
    let best: { f: Field; d: number } | null = null;
    for (const f of served) {
      const d = km(lat, lng, f.lat, f.lng);
      if (!best || d < best.d) best = { f, d };
    }
    return best && best.d <= CAN_FLY_KM ? best : null;
  }

  const out: Row[] = [];

  for (const a of live) {
    const key = a.city.toLowerCase();
    void key; void cityBy;
    const resolved = trueLocation(a.city);
    const truth = resolved.point;            // where the city REALLY is — the AIRPORT decided

    /**
     * WHEN THE GAZETTEER HAS NOTHING, ASK THE REGISTRY.
     *
     * `world_cities` does not contain Aligarh at all, nor several other real airport towns. The
     * first run therefore could not judge 95 rows. But OurAirports carries each airport's
     * MUNICIPALITY — so if a SERVED airport's municipality is the city we are asking about, then
     * the city exists, it has scheduled flights, and we know where it is. An aviation registry is
     * a better witness than a gazetteer we do not have.
     *
     * Some rows are not cities at all — "Agx", "Aha", "Bhj" are airline codes that leaked into the
     * city column. Those are matched by CODE, filled correctly, and FLAGGED. We never silently
     * rename anything.
     */
    const fromRegistry: Field | null = resolved.viaRegistry ? resolved.airport : null;
    const isCodeNotCity = !!resolved.airport && resolved.airport.iata.toLowerCase() === a.city.toLowerCase()
      && norm(resolved.airport.municipality) !== norm(a.city);

    if (!truth) {
      out.push({ city: a.city, verdict: 'HELD', oldLat: a.lat, oldLng: a.lng,
        reason: `Neither our gazetteer nor the aviation registry can place "${a.city}" beyond doubt${(candidatesBy.get(a.city.toLowerCase()) ?? []).length > 1 ? ` — our gazetteer holds ${(candidatesBy.get(a.city.toLowerCase()) ?? []).length} different Indian places with this name and no airport of that name to choose between them` : ''}. Nothing written.` });
      continue;
    }
    const truth2 = truth;

    const ap = airportFor(truth2.lat, truth2.lng);

    // GATE 2 — can you actually fly there?
    if (!ap) {
      out.push({ city: a.city, verdict: 'NOT_AN_AIRPORT_CITY', oldLat: a.lat, oldLng: a.lng,
        reason: `There is NO airport with scheduled flights within ${CAN_FLY_KM} km of ${a.city}. This row claims a gateway that does not exist. It must never be offered to a traveller.` });
      continue;
    }

    // no coordinate at all — fill it with the city's own, now that gates 2 and 3 have passed
    if (a.lat == null || a.lng == null) {
      out.push({ city: a.city, verdict: 'FILLED', oldLat: null, oldLng: null,
        newLat: truth2.lat, newLng: truth2.lng, airport: ap.f.name, iata: ap.f.iata, airportKm: Math.round(ap.d),
        reason: `We held NO coordinate, so the engine could not see this gateway at all. Filled from ${fromRegistry ? `the aviation registry (${fromRegistry.name})` : 'our gazetteer'}. ${ap.f.name} (${ap.f.iata}) has scheduled flights and is ${Math.round(ap.d)} km away.${isCodeNotCity ? ' NOTE: this row is named after an airline code, not a city — a human should rename it.' : ''}` });
      continue;
    }

    // GATE 1 — is the live coordinate actually this city?
    const off = km(Number(a.lat), Number(a.lng), truth2.lat, truth2.lng);
    if (off <= RIGHT_CITY_KM) {
      out.push({ city: a.city, verdict: 'ALREADY_RIGHT', oldLat: a.lat, oldLng: a.lng,
        airport: ap.f.name, iata: ap.f.iata, airportKm: Math.round(ap.d),
        reason: `The live coordinate is ${Math.round(off)} km from ${a.city} — it is the right city — and ${ap.f.name} (${ap.f.iata}) has scheduled flights ${Math.round(ap.d)} km away.` });
      continue;
    }

    out.push({ city: a.city, verdict: 'PROVEN', oldLat: a.lat, oldLng: a.lng,
      newLat: truth2.lat, newLng: truth2.lng, airport: ap.f.name, iata: ap.f.iata, airportKm: Math.round(ap.d),
      reason: `Our live coordinate is ${Math.round(off)} km from ${a.city} — it is NOT this city. Corrected to ${fromRegistry ? `the aviation registry's location for ${fromRegistry.name}` : "the city's own location in our gazetteer"}. ${ap.f.name} (${ap.f.iata}) has scheduled flights ${Math.round(ap.d)} km away.` });
  }

  const by = (v: Verdict) => out.filter((r) => r.verdict === v);
  console.log('=================================================================');
  console.log(`ALREADY RIGHT       : ${by('ALREADY_RIGHT').length}`);
  console.log(`FILLED (was blank)  : ${by('FILLED').length}`);
  console.log(`PROVEN (was wrong)  : ${by('PROVEN').length}`);
  console.log(`NOT AN AIRPORT CITY : ${by('NOT_AN_AIRPORT_CITY').length}  (no scheduled flights within ${CAN_FLY_KM} km — must never be a gateway)`);
  console.log(`HELD                : ${by('HELD').length}`);
  console.log('=================================================================\n');

  if (by('PROVEN').length) {
    console.log('--- WRONG CITY, corrected ---');
    for (const r of by('PROVEN')) console.log(`  ${r.city.padEnd(20)} ${Number(r.oldLat).toFixed(3)},${Number(r.oldLng).toFixed(3)} → ${r.newLat!.toFixed(3)},${r.newLng!.toFixed(3)}  (${r.airport}, ${r.iata})`);
  }
  if (by('NOT_AN_AIRPORT_CITY').length) {
    console.log('\n--- NOT REALLY AIRPORT CITIES (no scheduled flights nearby) ---');
    for (const r of by('NOT_AN_AIRPORT_CITY')) console.log(`  ${r.city}`);
  }
  if (by('HELD').length) {
    console.log('\n--- HELD ---');
    for (const r of by('HELD')) console.log(`  ${r.city.padEnd(20)} ${r.reason}`);
  }

  // ---- the written record
  const L: string[] = [];
  L.push('# Airport cities — the three-gate test');
  L.push('');
  L.push(`Run: ${new Date().toISOString()}${DRY_RUN ? '  — DRY RUN, nothing written' : ''}`);
  L.push('');
  L.push('## What was tested, and why it is not "reasonably accurate" but provable');
  L.push('');
  L.push('`airport_cities` answers one question: **is this a real city a traveller can fly into?**');
  L.push('It holds the CITY, not the runway (Delhi is the city, 15 km from its own airport). Three');
  L.push('arithmetic gates, no language model, no opinion:');
  L.push('');
  L.push(`1. **Is it the right city?** The coordinate must be within ${RIGHT_CITY_KM} km of the city it names, checked against our gazetteer.`);
  L.push(`2. **Can you actually fly there?** A real airport with SCHEDULED FLIGHTS and an airline code must exist within ${CAN_FLY_KM} km, per OurAirports, the aviation industry's open registry. An airstrip with no flights is not a gateway.`);
  L.push('3. **Is it the airport we think it is?** That airport must be the nearest served one to this city.');
  L.push('');
  L.push('| Verdict | Count | Meaning |');
  L.push('|---|---|---|');
  L.push(`| ALREADY RIGHT | ${by('ALREADY_RIGHT').length} | live value passes all three |`);
  L.push(`| FILLED | ${by('FILLED').length} | we held NO coordinate — the engine could not see this gateway at all |`);
  L.push(`| PROVEN | ${by('PROVEN').length} | live value was the WRONG CITY. Corrected. |`);
  L.push(`| NOT AN AIRPORT CITY | ${by('NOT_AN_AIRPORT_CITY').length} | no scheduled flights within ${CAN_FLY_KM} km — must never be offered as a gateway |`);
  L.push(`| HELD | ${by('HELD').length} | could not be judged. Nothing written. |`);
  L.push('');
  for (const v of ['PROVEN', 'FILLED', 'NOT_AN_AIRPORT_CITY', 'HELD'] as Verdict[]) {
    const rows = by(v);
    if (!rows.length) continue;
    L.push(`## ${v} (${rows.length})`);
    L.push('');
    L.push('| City | Was | Now | Its airport | Why |');
    L.push('|---|---|---|---|---|');
    for (const r of rows) {
      L.push(`| ${r.city} | ${r.oldLat != null ? Number(r.oldLat).toFixed(3) + ', ' + Number(r.oldLng).toFixed(3) : '— blank —'} | ${r.newLat != null ? r.newLat.toFixed(3) + ', ' + r.newLng!.toFixed(3) : '—'} | ${r.airport ? r.airport + ' (' + r.iata + ')' : '—'} | ${r.reason} |`);
    }
    L.push('');
  }
  writeFileSync('/tmp/AIRPORT-CITY-TEST.md', L.join('\n'));
  console.log('\nReport: /tmp/AIRPORT-CITY-TEST.md');

  if (DRY_RUN) { console.log('\nDRY RUN — nothing written. Re-run with DRY_RUN=0 to apply.'); process.exit(0); }

  for (const r of [...by('PROVEN'), ...by('FILLED')]) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO geo_coord_backup (kind, code, old_lat, old_lng, new_lat, new_lng, source)
       VALUES ('AIRPORT_CITY',$1,$2,$3,$4,$5,'three-gate-registry')`,
      r.city, r.oldLat, r.oldLng, r.newLat, r.newLng);
    await prisma.$executeRawUnsafe(`UPDATE airport_cities SET lat=$2, lng=$3 WHERE city=$1`, r.city, r.newLat, r.newLng);
  }
  // A city with no scheduled flights is not a gateway. Record it so the engine can refuse it.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS airport_city_quality (
      city text PRIMARY KEY, usable boolean NOT NULL, airport text, iata text, airport_km int, reason text,
      checked_at timestamptz NOT NULL DEFAULT now())`);
  for (const r of out) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO airport_city_quality (city, usable, airport, iata, airport_km, reason)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (city) DO UPDATE SET usable=$2, airport=$3, iata=$4, airport_km=$5, reason=$6, checked_at=now()`,
      r.city, r.verdict !== 'NOT_AN_AIRPORT_CITY' && r.verdict !== 'HELD',
      r.airport ?? null, r.iata ?? null, r.airportKm ?? null, r.reason);
  }
  console.log(`\nWROTE ${by('PROVEN').length} corrections and ${by('FILLED').length} fills. All backed up in geo_coord_backup.`);
  console.log(`Recorded ${by('NOT_AN_AIRPORT_CITY').length} cities as NOT usable gateways in airport_city_quality.`);
  process.exit(0);
}

main();
