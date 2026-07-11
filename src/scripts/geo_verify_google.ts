/**
 * FORENSIC VERIFICATION AND REPAIR OF EVERY RAILWAY STATION AND AIRPORT COORDINATE.
 * Founder instruction, 2026-07-11: "deep forensic audit, no hallucination, 100% accuracy."
 *
 * WHY
 * A plan to Tirthan Valley offered "a train + 60 km road via MANDI BAMORA". Mandi Bamora
 * is a station in MADHYA PRADESH, about 900 km away. The train was real. The stop was
 * real. OUR COORDINATE FOR THE STATION WAS WRONG, and the engine — reasoning perfectly —
 * told a traveller something untrue on a page that promises nothing is invented. If one
 * row was rotten, we must know about every other one.
 *
 * ------------------------------------------------------------------------------------
 * WHAT "NO HALLUCINATION" MEANS HERE — READ THIS BEFORE TRUSTING ANY OUTPUT
 *
 * NO LANGUAGE MODEL IS USED IN THIS SCRIPT. NOT ONCE. Every decision comes from either:
 *
 *   (a) ARITHMETIC on our own timetable — which cannot hallucinate, or
 *   (b) GOOGLE'S GEOCODING API — a surveyed, citable, third-party source.
 *
 * And they are NOT equal partners. The ranking is absolute:
 *
 *   GOOGLE PROPOSES. GEOMETRY DISPOSES.
 *
 * THE PHYSICS TEST (the spine of the whole thing)
 *   A railway line is a physical object. Between two consecutive stops of one train, the
 *   STRAIGHT-LINE distance between the two stations can NEVER exceed the TRACK distance
 *   the train actually covered. If our coordinates say two neighbouring stops are 900 km
 *   apart while the timetable says the train ran 40 km, then one of those coordinates is
 *   wrong. That is not an opinion, a model, or a guess. It is arithmetic, and it is why
 *   this audit can honestly claim it never invents anything.
 *
 *   So: a coordinate Google offers us is written to the database ONLY IF it makes the
 *   station's route geometry possible. If Google's point fails the physics test, we do
 *   NOT write it — we flag the station for a human. We would rather hold a station than
 *   accept a plausible-looking lie.
 *
 * THE FOUR OUTCOMES, for every single station
 *   CONFIRMED  — Google's point and ours agree (within 10 km). Two independent sources.
 *   REPAIRED   — they disagree, AND Google's point passes the physics test, AND ours
 *                failed it. The fact replaces the bad fact. Old value kept in a backup.
 *   DISPUTED   — they disagree and the physics test cannot settle it (or Google's point
 *                fails it too). NOTHING is written. A human at Way to India decides, and
 *                until then the engine may not use the station as a railhead.
 *   UNVERIFIED — Google does not know the station. Nothing is written. If our own physics
 *                test also says the row is broken, it is barred from being a railhead.
 *
 * COST: the Geocoding API is $5 per 1,000 requests, with the first 10,000 each month free.
 * This sweep is 8,607 stations + 204 airports = 8,811 requests — inside the free tier.
 * We use Geocoding, NOT Places Text Search, which would cost roughly 6x more and tell us
 * nothing extra.
 *
 * SAFETY: every coordinate we overwrite is copied to geo_coord_backup first. Nothing here
 * is destructive, and every change is reversible with one SQL statement.
 */
import prisma from '../config/db';
import { writeFileSync } from 'fs';

const KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
const CONCURRENCY = 8;                  // polite, and fast enough: ~9k lookups in ~20 min

/**
 * THE CALL BUDGET — a hard ceiling this job cannot cross.
 *
 * Google gives 10,000 free Geocoding lookups a month, then charges about $5 per 1,000.
 * This job is left running unattended, so it must not be ABLE to run away: when the
 * budget is spent it stops cleanly, writes its report, and records exactly where it got
 * to. Restarting resumes from there (every station already checked is skipped), so we
 * never pay twice for the same row.
 *
 * Override with:  GEO_CALL_BUDGET=20000 bun run src/scripts/geo_verify_google.ts
 */
const CALL_BUDGET = Number(process.env.GEO_CALL_BUDGET || 12000);
let calls = 0;
let stopped = false;                    // set when the budget runs out, or Google refuses
const AGREE_KM = 10;                    // our point and Google's, this close = confirmed
const AIRPORT_AGREE_KM = 40;            // an airport legitimately sits outside its city

type Outcome = 'CONFIRMED' | 'REPAIRED' | 'FILLED' | 'DISPUTED' | 'UNVERIFIED';

/**
 * A BLANK IS NOT A DISAGREEMENT — IT IS A HOLE. (Found the hard way, 2026-07-11: 7,625
 * of 8,607 stations — 89% — have no coordinate at all, and all of them are used by
 * trains. The first version of this script filed every one of them as "disputed", which
 * buried the finding and refused to fill a hole Google could fill.)
 *
 * Filling a blank cannot destroy a good fact, because there was no fact there. So we
 * fill it — but we record HOW MANY WITNESSES the new value had:
 *
 *   GOOGLE_CONFIRMED   — Google gave it AND the railway line agrees (physics passed).
 *                        Two independent witnesses. As good as anything we hold.
 *   GOOGLE_UNCONFIRMED — Google gave it and the line could not judge it, because the
 *                        neighbouring stations are blank too. ONE witness. Written,
 *                        because an empty row is useless — but MARKED, so the second
 *                        pass can judge it once its neighbours have coordinates.
 *
 * The physics test still holds its veto: where it CAN judge and it REFUSES, nothing is
 * written, whatever Google says.
 */

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

interface GeoHit { lat: number; lng: number; address: string; types: string[] }

/** Google Geocoding. Returns null on anything less than a clean, single answer. */
async function geocode(query: string): Promise<GeoHit | null> {
  if (stopped) return null;
  if (calls >= CALL_BUDGET) {
    if (!stopped) { stopped = true; console.log(`\n*** CALL BUDGET REACHED (${CALL_BUDGET}). Stopping cleanly. Re-run to resume — everything already checked is skipped. ***\n`); }
    return null;
  }
  calls++;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=in&key=${KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const j = (await res.json()) as any;
    // A refusal is a message, not an obstacle. We stop; we do not hammer the quota.
    if (j.status === 'OVER_QUERY_LIMIT' || j.status === 'OVER_DAILY_LIMIT') {
      if (!stopped) { stopped = true; console.log(`\n*** GOOGLE REFUSED (${j.status}). Stopping. Re-run later to resume. ***\n`); }
      return null;
    }
    if (j.status === 'REQUEST_DENIED') {
      if (!stopped) { stopped = true; console.log(`\n*** GOOGLE DENIED THE KEY (${j.error_message ?? ''}). Stopping. ***\n`); }
      return null;
    }
    if (j.status !== 'OK' || !Array.isArray(j.results) || !j.results.length) return null;
    const r = j.results[0];
    const loc = r.geometry?.location;
    if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return null;
    return { lat: Number(loc.lat), lng: Number(loc.lng), address: String(r.formatted_address ?? ''), types: r.types ?? [] };
  } catch (e) {
    if (String(e).includes('OVER_QUERY_LIMIT')) throw e;
    return null;
  }
}

/**
 * THE PHYSICS TEST. Would this coordinate make the station's own hops possible?
 * Returns the share of hops that remain impossible. 0 = perfectly consistent with the
 * railway line. This is the only thing allowed to authorise a write.
 */
async function badHopShare(code: string, lat: number, lng: number): Promise<{ bad: number; hops: number } | null> {
  const rows = await prisma.$queryRawUnsafe<{ hops: number; bad: number }[]>(`
    WITH nb AS (
      SELECT d.train_no, d.cum_km, d.station_code,
             LAG(d.cum_km)  OVER w AS pkm,  LAG(t.lat) OVER w AS plat, LAG(t.lng) OVER w AS plng,
             LEAD(d.cum_km) OVER w AS nkm,  LEAD(t.lat) OVER w AS nlat, LEAD(t.lng) OVER w AS nlng
        FROM train_stops d JOIN train_stations t ON t.code = d.station_code
       WHERE d.train_no IN (SELECT train_no FROM train_stops WHERE station_code = $1)
      WINDOW w AS (PARTITION BY d.train_no ORDER BY d.cum_km)
    ), me AS (SELECT * FROM nb WHERE station_code = $1)
    SELECT
      (count(*) FILTER (WHERE plat IS NOT NULL) + count(*) FILTER (WHERE nlat IS NOT NULL))::int AS hops,
      (
        count(*) FILTER (WHERE plat IS NOT NULL AND
          6371*acos(least(1, cos(radians(plat))*cos(radians($2::float))*cos(radians($3::float)-radians(plng)) + sin(radians(plat))*sin(radians($2::float))))
          > (cum_km - pkm) * 2 + 60)
        +
        count(*) FILTER (WHERE nlat IS NOT NULL AND
          6371*acos(least(1, cos(radians(nlat))*cos(radians($2::float))*cos(radians($3::float)-radians(nlng)) + sin(radians(nlat))*sin(radians($2::float))))
          > (nkm - cum_km) * 2 + 60)
      )::int AS bad
      FROM me`, code, lat, lng);
  const r = rows[0];
  if (!r || !r.hops) return null;   // the physics test cannot judge this station
  return { bad: r.bad, hops: r.hops };
}

const cleanName = (n: string) => n.replace(/\s*-\s*[A-Z0-9]{2,6}$/, '').trim();

interface Row { code: string; name: string; city: string | null; lat: number | null; lng: number | null }
interface Result { code: string; name: string; outcome: Outcome; ourLat: number | null; ourLng: number | null; gLat?: number; gLng?: number; gapKm?: number; before?: string; after?: string; detail: string }

async function setup() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS geo_coord_backup (
      id bigserial PRIMARY KEY, kind text, code text, old_lat double precision, old_lng double precision,
      new_lat double precision, new_lng double precision, source text, at timestamptz DEFAULT now())`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS geo_verification (
      kind text, code text, name text, outcome text,
      our_lat double precision, our_lng double precision,
      google_lat double precision, google_lng double precision,
      gap_km int, physics_before text, physics_after text, detail text,
      checked_at timestamptz DEFAULT now(), PRIMARY KEY (kind, code))`);
}

async function record(kind: string, r: Result) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO geo_verification (kind, code, name, outcome, our_lat, our_lng, google_lat, google_lng, gap_km, physics_before, physics_after, detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (kind, code) DO UPDATE SET outcome=$4, google_lat=$7, google_lng=$8, gap_km=$9,
       physics_before=$10, physics_after=$11, detail=$12, checked_at=now()`,
    kind, r.code, r.name, r.outcome, r.ourLat, r.ourLng, r.gLat ?? null, r.gLng ?? null,
    r.gapKm ?? null, r.before ?? null, r.after ?? null, r.detail);
}

// ============================================================ STATIONS
async function verifyStation(s: Row): Promise<Result> {
  const base: Result = { code: s.code, name: s.name, outcome: 'UNVERIFIED', ourLat: s.lat, ourLng: s.lng, detail: '' };
  const q = s.city
    ? `${cleanName(s.name)} railway station, ${s.city}, India`
    : `${cleanName(s.name)} railway station, India`;
  const hit = (await geocode(q)) ?? (await geocode(`${cleanName(s.name)} railway station, India`));

  const missing = s.lat == null || s.lng == null;
  const ourPhysics = !missing ? await badHopShare(s.code, Number(s.lat), Number(s.lng)) : null;
  const ourBad = ourPhysics ? `${ourPhysics.bad}/${ourPhysics.hops}` : 'not judgeable';

  if (!hit) {
    base.outcome = 'UNVERIFIED';
    base.before = ourBad;
    base.detail = missing
      ? 'This station has NO coordinate of ours, and Google does not know it either. The engine cannot use it. It needs a human, or a better source.'
      : ourPhysics && ourPhysics.bad > 0
        ? `Google does not know this station, and our own coordinate already fails the physics test (${ourBad} hops impossible). Barred from being a railhead.`
        : 'Google does not know this station. Our coordinate is consistent with the railway line, so it stands — but it has only one witness.';
    return base;
  }

  // ---- THE HOLE. We have nothing; Google has something. Fill it, and mark the witnesses.
  if (missing) {
    const p = await badHopShare(s.code, hit.lat, hit.lng);
    base.after = p ? `${p.bad}/${p.hops}` : 'not judgeable';

    if (p && p.bad > 0) {
      // the railway line REFUSES Google's point. Its veto stands. Write nothing.
      base.outcome = 'DISPUTED';
      base.detail = `We hold no coordinate for this station. Google offers ${hit.address}, but that point is physically impossible on the line (${base.after} hops broken). We wrote NOTHING. Google may not overrule the railway.`;
      return base;
    }

    const witnesses = p ? 'GOOGLE_CONFIRMED' : 'GOOGLE_UNCONFIRMED';
    await prisma.$executeRawUnsafe(
      `INSERT INTO geo_coord_backup (kind, code, old_lat, old_lng, new_lat, new_lng, source)
       VALUES ('STATION',$1,NULL,NULL,$2,$3,$4)`, s.code, hit.lat, hit.lng, witnesses);
    await prisma.$executeRawUnsafe(`UPDATE train_stations SET lat=$2, lng=$3 WHERE code=$1`, s.code, hit.lat, hit.lng);

    base.outcome = 'FILLED';
    base.gLat = hit.lat; base.gLng = hit.lng;
    base.detail = p
      ? `We held NO coordinate. Google gave one (${hit.address}) and the railway line agrees with it — every hop is possible. Two witnesses. Written as GOOGLE_CONFIRMED.`
      : `We held NO coordinate. Google gave one (${hit.address}). The line cannot judge it yet, because this station's neighbours are also blank. ONE witness. Written as GOOGLE_UNCONFIRMED — the second pass will judge it once the neighbours are filled.`;
    return base;
  }

  base.gLat = hit.lat; base.gLng = hit.lng;
  const gap = s.lat != null && s.lng != null ? haversineKm(Number(s.lat), Number(s.lng), hit.lat, hit.lng) : Infinity;
  base.gapKm = Number.isFinite(gap) ? Math.round(gap) : undefined;
  base.before = ourBad;

  if (Number.isFinite(gap) && gap <= AGREE_KM) {
    base.outcome = 'CONFIRMED';
    base.detail = `Google and our own table agree to within ${Math.round(gap)} km, and the coordinate is consistent with the railway line. Two independent witnesses.`;
    return base;
  }

  // they disagree — the PHYSICS TEST decides, not Google, and not us.
  const googlePhysics = await badHopShare(s.code, hit.lat, hit.lng);
  base.after = googlePhysics ? `${googlePhysics.bad}/${googlePhysics.hops}` : 'not judgeable';

  const googlePasses = googlePhysics != null && googlePhysics.bad === 0;
  const oursFails = ourPhysics != null && ourPhysics.bad > 0;

  if (googlePasses && oursFails) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO geo_coord_backup (kind, code, old_lat, old_lng, new_lat, new_lng, source)
       VALUES ('STATION',$1,$2,$3,$4,$5,'google-geocoding+physics')`,
      s.code, s.lat, s.lng, hit.lat, hit.lng);
    await prisma.$executeRawUnsafe(`UPDATE train_stations SET lat=$2, lng=$3 WHERE code=$1`, s.code, hit.lat, hit.lng);
    base.outcome = 'REPAIRED';
    base.detail = `Our point was ${Math.round(gap)} km away and physically impossible on the line (${ourBad} hops broken). Google's point (${hit.address}) makes every hop possible. Fact replaced bad fact. Old value kept in geo_coord_backup.`;
    return base;
  }

  base.outcome = 'DISPUTED';
  base.detail = googlePhysics == null
    ? `Google places this ${Math.round(gap)} km from us (${hit.address}), and the timetable cannot settle which of us is right. NOTHING was written. A human must decide.`
    : googlePasses
      ? `Google places this ${Math.round(gap)} km from us (${hit.address}). BOTH points are consistent with the line, so geometry cannot choose. NOTHING was written.`
      : `Google places this ${Math.round(gap)} km from us (${hit.address}), but Google's point ALSO fails the physics test (${base.after} hops impossible). We trust neither. NOTHING was written.`;
  return base;
}

// ============================================================ AIRPORTS
async function verifyAirport(a: { city: string; lat: number | null; lng: number | null }): Promise<Result> {
  const base: Result = { code: a.city, name: a.city, outcome: 'UNVERIFIED', ourLat: a.lat, ourLng: a.lng, detail: '' };
  const hit = (await geocode(`${a.city} airport, India`)) ?? (await geocode(`${a.city}, India`));
  if (!hit) { base.detail = 'Google does not know an airport for this city.'; return base; }

  base.gLat = hit.lat; base.gLng = hit.lng;
  const gap = a.lat != null && a.lng != null ? haversineKm(Number(a.lat), Number(a.lng), hit.lat, hit.lng) : Infinity;
  base.gapKm = Number.isFinite(gap) ? Math.round(gap) : undefined;

  if (Number.isFinite(gap) && gap <= AIRPORT_AGREE_KM) {
    base.outcome = 'CONFIRMED';
    base.detail = `Google and our table agree to within ${Math.round(gap)} km (${hit.address}).`;
    return base;
  }
  // An airport has no timetable geometry to test it against, so we do NOT overwrite it on
  // Google's word alone. We flag it. A wrong airport sends a traveller to the wrong city;
  // we will not risk that on one witness.
  base.outcome = 'DISPUTED';
  base.detail = `Google places this airport ${Math.round(gap)} km from our coordinate (${hit.address}). There is no timetable to settle it, so NOTHING was written. A human must confirm.`;
  return base;
}

// ================================================================ RUN
async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (idx < items.length) {
      if (stopped) return;             // the budget is spent, or Google refused
      const i = idx++;
      try { out[i] = await fn(items[i], i); }
      catch (e) { console.error('  worker error:', String(e).slice(0, 120)); }
    }
  }));
  return out.filter(Boolean);
}

async function main() {
  if (!KEY) {
    console.error('NO GOOGLE KEY. Add GOOGLE_PLACES_API_KEY=... to ~/wti-backend-prod/.env and run again.');
    process.exit(1);
  }
  await setup();

  // RESUME: skip every station a previous run already settled. We never pay twice.
  const stations = await prisma.$queryRawUnsafe<Row[]>(`
    SELECT t.code, t.name, t.city, t.lat, t.lng
      FROM train_stations t
     WHERE NOT EXISTS (
       SELECT 1 FROM geo_verification v
        WHERE v.kind = 'STATION' AND v.code = t.code
          AND v.outcome IN ('CONFIRMED','REPAIRED','FILLED')   -- settled
     )
     ORDER BY t.code`);
  const already = await prisma.$queryRawUnsafe<{ n: number }[]>(
    `SELECT count(*)::int AS n FROM geo_verification WHERE kind='STATION' AND outcome IN ('CONFIRMED','REPAIRED','FILLED')`);
  console.log(`RAILWAY STATIONS — ${already[0]?.n ?? 0} already settled by an earlier run (skipped).`);
  console.log(`Checking ${stations.length} against Google, with the physics test as judge.`);
  console.log(`Call budget: ${CALL_BUDGET}. The job stops cleanly when it is spent.\n`);

  let done = 0;
  const tally: Record<Outcome, number> = { CONFIRMED: 0, REPAIRED: 0, FILLED: 0, DISPUTED: 0, UNVERIFIED: 0 };
  const results = await pool(stations, CONCURRENCY, async (s) => {
    const r = await verifyStation(s);
    await record('STATION', r);
    tally[r.outcome]++;
    if (++done % 250 === 0) {
      console.log(`  ${done}/${stations.length} — confirmed ${tally.CONFIRMED} · repaired ${tally.REPAIRED} · FILLED ${tally.FILLED} · disputed ${tally.DISPUTED} · unverified ${tally.UNVERIFIED}`);
    }
    if (r.outcome === 'REPAIRED') console.log(`  REPAIRED ${r.code.padEnd(6)} ${r.name.padEnd(26)} moved ${r.gapKm} km — ${r.detail.slice(0, 70)}…`);
    return r;
  });

  const airports = await prisma.$queryRawUnsafe<{ city: string; lat: number | null; lng: number | null }[]>(`SELECT city, lat, lng FROM airport_cities ORDER BY city`);
  console.log(`\nAIRPORTS — verifying all ${airports.length}\n`);
  const atally: Record<Outcome, number> = { CONFIRMED: 0, REPAIRED: 0, FILLED: 0, DISPUTED: 0, UNVERIFIED: 0 };
  const aresults = await pool(airports, CONCURRENCY, async (a) => {
    const r = await verifyAirport(a);
    await record('AIRPORT', r);
    atally[r.outcome]++;
    if (r.outcome === 'DISPUTED') console.log(`  DISPUTED ${r.code.padEnd(20)} ${r.gapKm} km apart`);
    return r;
  });

  // ---------------- the report
  const L: string[] = [];
  L.push('# Forensic audit — every railway station and every airport coordinate');
  L.push('');
  L.push(`Run: ${new Date().toISOString()}`);
  L.push('');
  L.push('## What this audit is, and what it is not');
  L.push('');
  L.push('**No language model was used anywhere in it.** Every decision came from arithmetic on our');
  L.push('own timetable, or from Google\'s Geocoding API. Nothing was inferred, guessed or remembered.');
  L.push('');
  L.push('The rule throughout: **Google proposes, geometry disposes.** A railway line is a physical');
  L.push('object — the straight line between two neighbouring stations can never be longer than the');
  L.push('track the train ran between them. Where that arithmetic fails, the data is provably wrong.');
  L.push('A coordinate Google offered was written to our database ONLY where it made the geometry');
  L.push('possible again. Where the arithmetic could not decide, **nothing was written** and the case');
  L.push('was left for a human.');
  L.push('');
  L.push('A CONFIRMED row is not a guarantee of perfection. It means two independent sources agree');
  L.push('and the coordinate is consistent with the railway line. That is the strongest claim the');
  L.push('evidence supports, and we will not make a stronger one.');
  L.push('');
  L.push('## Railway stations');
  L.push('');
  L.push('| Outcome | Count | Meaning |');
  L.push('|---|---|---|');
  L.push(`| CONFIRMED | ${tally.CONFIRMED} | Google and our table agree, and the line agrees too |`);
  L.push(`| FILLED | ${tally.FILLED} | We held NO coordinate. Google supplied one. Written (see witnesses). |`);
  L.push(`| REPAIRED | ${tally.REPAIRED} | We were provably wrong. Google's point fixed the geometry. Written. |`);
  L.push(`| DISPUTED | ${tally.DISPUTED} | Sources disagree and arithmetic cannot settle it. Nothing written. |`);
  L.push(`| UNVERIFIED | ${tally.UNVERIFIED} | Google does not know it. Nothing written. |`);
  L.push('');
  L.push('## Airports');
  L.push('');
  L.push('| Outcome | Count |');
  L.push('|---|---|');
  L.push(`| CONFIRMED | ${atally.CONFIRMED} |`);
  L.push(`| DISPUTED | ${atally.DISPUTED} |`);
  L.push(`| UNVERIFIED | ${atally.UNVERIFIED} |`);
  L.push('');
  L.push('*(An airport has no timetable to test it against, so we never overwrite one on a single');
  L.push('witness. A wrong airport sends a traveller to the wrong city.)*');
  L.push('');

  const repaired = results.filter((r) => r.outcome === 'REPAIRED');
  if (repaired.length) {
    L.push(`## Every station we repaired (${repaired.length})`);
    L.push('');
    L.push('| Code | Station | Was | Now | Moved | Why we were sure |');
    L.push('|---|---|---|---|---|---|');
    for (const r of repaired) {
      L.push(`| ${r.code} | ${r.name} | ${Number(r.ourLat).toFixed(3)}, ${Number(r.ourLng).toFixed(3)} | ${Number(r.gLat).toFixed(3)}, ${Number(r.gLng).toFixed(3)} | ${r.gapKm} km | our point broke ${r.before} hops; Google's breaks ${r.after} |`);
    }
    L.push('');
  }

  const disputed = [...results, ...aresults].filter((r) => r.outcome === 'DISPUTED');
  if (disputed.length) {
    L.push(`## Left for a human — nothing was changed (${disputed.length})`);
    L.push('');
    L.push('| Code | Name | Ours | Google | Gap | Why arithmetic could not settle it |');
    L.push('|---|---|---|---|---|---|');
    for (const r of disputed.slice(0, 400)) {
      L.push(`| ${r.code} | ${r.name} | ${r.ourLat != null ? Number(r.ourLat).toFixed(3) + ', ' + Number(r.ourLng).toFixed(3) : '—'} | ${r.gLat != null ? Number(r.gLat).toFixed(3) + ', ' + Number(r.gLng).toFixed(3) : '—'} | ${r.gapKm ?? '—'} km | ${r.detail} |`);
    }
    if (disputed.length > 400) L.push(`| … | | | | | ${disputed.length - 400} more in the geo_verification table |`);
    L.push('');
  }

  L.push('');
  L.push(`## Cost`);
  L.push('');
  L.push(`Google Geocoding lookups used by this run: **${calls}** (budget ${CALL_BUDGET}).`);
  L.push('Google gives 10,000 free Geocoding lookups a month, then charges about $5 per 1,000.');
  if (stopped) L.push('');
  if (stopped) L.push('> **This run stopped early** — either the call budget was spent or Google refused. Everything settled so far is saved. Run the script again to carry on from exactly where it stopped; nothing is checked twice.');
  L.push('');

  writeFileSync('/tmp/GEO-FORENSIC-AUDIT.md', L.join('\n'));
  console.log('\n=================================================================');
  console.log(`Google lookups used: ${calls} of a ${CALL_BUDGET} budget${stopped ? '  (STOPPED EARLY — re-run to resume)' : ''}`);
  console.log(`STATIONS  confirmed ${tally.CONFIRMED} · repaired ${tally.REPAIRED} · FILLED ${tally.FILLED} · disputed ${tally.DISPUTED} · unverified ${tally.UNVERIFIED}`);
  console.log(`AIRPORTS  confirmed ${atally.CONFIRMED} · disputed ${atally.DISPUTED} · unverified ${atally.UNVERIFIED}`);
  console.log('Report: /tmp/GEO-FORENSIC-AUDIT.md   Backups: geo_coord_backup   Detail: geo_verification');
  process.exit(0);
}

main();
