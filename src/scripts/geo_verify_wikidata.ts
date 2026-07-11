/**
 * FIFTH SOURCE — Wikidata (P625 coordinate claim on the station's own article, matched by
 * name via wbsearchentities, no language model involved in reading it). Tested against
 * the 4 barred + 45 disputed stations that were still open after four sources. Results of
 * that test run are hard-coded below (already produced and reviewed, see
 * docs/route-optimizer/WIKIDATA-PASS-2026-07-11.md for the full table). This script ONLY
 * applies the ones that already passed the real hop-arithmetic test — it does not repeat
 * the network calls that produced these numbers, and it does not touch anything the
 * physics test did not already clear.
 *
 * SAME INVARIANTS, NO EXCEPTIONS:
 *   1. Physics test has the only vote — every write below already passed fixesGeometry.
 *   2. No language model touches a coordinate.
 *   3. Every write backed up first.
 *   4. Single-witness rows are still marked as such (here: WIKIDATA_UNCONFIRMED never used,
 *      because every write below is backed by physics PLUS at least one prior source
 *      already on file — see the note text written into each row).
 */
import prisma from '../config/db';

const DRY_RUN = process.env.DRY_RUN !== '0';

async function backupAndWrite(code: string, oldLat: number | null, oldLng: number | null, newLat: number, newLng: number, source: string) {
  console.log(`  WRITE  ${code}  ${oldLat},${oldLng} -> ${newLat},${newLng}  (${source})`);
  if (!DRY_RUN) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO geo_coord_backup (kind, code, old_lat, old_lng, new_lat, new_lng, source) VALUES ('STATION',$1,$2,$3,$4,$5,$6)`,
      code, oldLat, oldLng, newLat, newLng, source);
    await prisma.$executeRawUnsafe(`UPDATE train_stations SET lat = $2, lng = $3 WHERE code = $1`, code, newLat, newLng);
  }
}

async function main() {
  console.log(`MODE: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);

  // ---- ANDN: barred, wrong-city coordinate (Gujarat instead of the real Anandnagar
  // Junction in Uttar Pradesh, near the Nepal border). Wikidata's coordinate for this
  // station passed the hop-arithmetic test cleanly: 13 of 13 hops agree, 0 bad. ----
  await backupAndWrite('ANDN', 22.55251, 72.9552, 27.099575, 83.269808, 'wikidata-repair-physics-confirmed');
  if (!DRY_RUN) {
    await prisma.$executeRawUnsafe(
      `UPDATE train_station_quality SET suspect = false, fixed_at = now(), note = $2 WHERE code = $1`,
      'ANDN', 'Re-located via Wikidata (station article coordinate, P625). Old value was for Anand, Gujarat; correct location is Anandnagar Junction, Uttar Pradesh. Confirmed: 13/13 hops agree, 0 bad.');
  }

  // ---- NZT and SVV: barred, but Wikidata confirms the coordinate we already hold
  // (within 0.6km and 1.0km). Re-testing that SAME existing coordinate against today's
  // now-corrected neighbouring stations shows it now passes cleanly (24/24 and 22/22
  // hops agree). Their own location was never the problem — a neighbour's coordinate was,
  // and that neighbour has since been fixed by the earlier gist-source pass today. No
  // coordinate change needed, only the suspect flag clears. ----
  for (const [code, hops] of [['NZT', '24/24'], ['SVV', '22/22']] as const) {
    console.log(`  UNBAR  ${code}  (no coordinate change — confirmed correct by Wikidata + real hop arithmetic, ${hops} hops agree)`);
    if (!DRY_RUN) {
      await prisma.$executeRawUnsafe(
        `UPDATE train_station_quality SET suspect = false, fixed_at = now(), note = $2 WHERE code = $1`,
        code, `Re-verified, no coordinate change. Wikidata confirms this station's own coordinate (within ~1km). Re-run of the hop-arithmetic test now passes (${hops} hops agree) because a neighbouring station's coordinate, not this one, was the actual source of the earlier failure, and that neighbour was corrected earlier today by the station-code-gist pass.`);
    }
  }

  // ---- OSA: disputed, our value and Google's value are both within about 15-17km of
  // Wikidata's point (a genuinely low-precision case, all three sources cluster in the
  // same small area), and BOTH our value and Google's value independently pass the
  // hop-arithmetic test (1 of 4 hops bad, well under the 40% failure threshold). Settle
  // as confirmed, keep our existing value, no material change needed. ----
  console.log(`  SETTLE OSA  keep existing value — three sources cluster together, physics passes either way`);
  if (!DRY_RUN) {
    await prisma.$executeRawUnsafe(
      `UPDATE geo_verification SET outcome = 'CONFIRMED', detail = $2 WHERE kind = 'STATION' AND code = $1`,
      'OSA', 'Wikidata sits within about 15-17 km of both our value and Google\'s value (a low-precision case, not a wrong-city case). Both candidate values independently pass the hop-arithmetic test. Kept our existing value; no material change needed.');
  }

  // ---- 10 stations where Wikidata agrees closely with Google, but the hop-arithmetic
  // test could not confirm Google's value (either no neighbouring hop exists to judge
  // against yet, or the candidate actively fails). Per invariant 1, physics has the only
  // vote — two sources agreeing is not enough on its own. Leave these open, but record
  // that a third source has weighed in, so the next person picking this up does not
  // re-ask the same question. ----
  const stillOpen: { code: string; note: string }[] = [
    { code: 'ASKR', note: 'Wikidata agrees with Google (0.0 km) but there is no neighbouring hop yet to test the candidate against. Left open.' },
    { code: 'BELT', note: 'Wikidata agrees with Google (0.2 km) but the one available hop test fails against Google\'s value (1 of 1 hops bad). Left open.' },
    { code: 'FTC',  note: 'Wikidata agrees with Google (5.3 km) but there is no neighbouring hop yet to test the candidate against. Left open.' },
    { code: 'KGE',  note: 'Wikidata agrees with Google (0.0 km) but there is no neighbouring hop yet to test the candidate against. Left open.' },
    { code: 'KQZ',  note: 'Wikidata agrees with Google (0.1 km) but there is no neighbouring hop yet to test the candidate against. Left open.' },
    { code: 'KXK',  note: 'Wikidata agrees with Google (0.5 km) but there is no neighbouring hop yet to test the candidate against. Left open.' },
    { code: 'PPH',  note: 'Wikidata agrees with Google (1.7 km) but there is no neighbouring hop yet to test the candidate against. Left open.' },
    { code: 'PQD',  note: 'Wikidata agrees with Google (0.1 km) but there is no neighbouring hop yet to test the candidate against. Left open.' },
    { code: 'PYK',  note: 'Wikidata agrees with Google (3.3 km) but there is no neighbouring hop yet to test the candidate against. Left open.' },
    { code: 'WDN',  note: 'Wikidata agrees with Google (0.1 km) but the available hop test fails against Google\'s value (9 of 9 hops bad). Left open.' },
  ];
  for (const s of stillOpen) {
    console.log(`  NOTE   ${s.code}  still DISPUTED, physics could not confirm despite two-source agreement`);
    if (!DRY_RUN) {
      await prisma.$executeRawUnsafe(
        `UPDATE geo_verification SET detail = $2 WHERE kind = 'STATION' AND code = $1`,
        s.code, s.note);
    }
  }

  console.log('\nDone.');
  process.exit(0);
}
main();
