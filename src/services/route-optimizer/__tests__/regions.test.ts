/**
 * Sprint 8 / US-801 acceptance — THE REGION.
 *
 * Three things are proved here, and the second and third are the ones that matter:
 *
 *  1. RESOLUTION. "somewhere in north east India" becomes eight verified states —
 *     the sentence that got the traveller a form error now gets him a candidate pool.
 *
 *  2. THE SCOPE GUARD (this protects a SHIPPED test). Region resolution is a FALLBACK,
 *     never an override. A traveller who named Goa asked for Goa — Law 1, intent is the
 *     brief — and no region matcher may quietly convert him into a man who asked for a
 *     survey of three states. The shipped golden-honeymoon routes Bengaluru -> Coorg ->
 *     Goa. If this guard ever breaks, that goes red, and this test says so first.
 *
 *  3. THE RECEIPTS. Every state code carries the witness city that proved it on
 *     production. A code with no witness is an assertion, and assertions are banned.
 *     This test re-asserts the eight North-East codes by hand, so that a careless edit
 *     to the seed cannot silently reroute a traveller to the wrong half of India.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/regions.test.ts
 */

import {
  resolveRegion, regionIsUsable, statesOf, stateNamesOf, regionByKey, REGIONS,
} from '../regions';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`)); };

console.log('\nSprint 8 / US-801 — the region: the gate that turned him away\n');

// ---- 1. THE SENTENCE THAT EARNED THIS SPRINT ---------------------------------------

const NE_BRIEF =
  'I am 56 and my wife is 49. We are looking to go on a romantic comfortable trip somewhere in ' +
  'north east India. We do not wish to spend too much money on flights and would prefer trains ' +
  'wherever possible. Up to 10 days maximum. Good budget hotels or max 3 star. We are vegetarians ' +
  'and do not consume even eggs.';

const ne = resolveRegion(NE_BRIEF);
check('the North-East brief resolves to a region at all (it did not, and that was the bug)', ne !== null);
check('...and the region is the North East', ne?.region.key === 'north_east', ne?.region.key);
check('...and it quotes HIS words back, not our phrase list', /north east/i.test(ne?.quote ?? ''), ne?.quote);
check('...and the quote is a span he actually typed', NE_BRIEF.toLowerCase().includes((ne?.quote ?? 'X').toLowerCase()), ne?.quote);

// ---- 2. THE EIGHT SISTERS, BY CODE. Verified on production 2026-07-12. --------------
// Not from memory. Each was read back off world_cities by querying its witness city.

const codes = ne ? statesOf(ne).sort() : [];
check('the North East is EIGHT states, no more and no fewer', codes.length === 8, String(codes.length));
check('Assam is 03        (witness: Guwahati)',  codes.includes('03'));
check('Meghalaya is 18    (witness: Shillong)',  codes.includes('18'));
check('Sikkim is 29       (witness: Gangtok)',   codes.includes('29'));
check('Nagaland is 20     (witness: Kohima)',    codes.includes('20'));
check('Manipur is 17      (witness: Imphal)',    codes.includes('17'));
check('Mizoram is 31      (witness: Aizawl)',    codes.includes('31'));
check('Tripura is 26      (witness: Agartala)',  codes.includes('26'));
check('Arunachal is 30    (witness: Itanagar)',  codes.includes('30'));

const names = ne ? stateNamesOf(ne) : [];
check('we can name the states to his face — we never show him a code', names.includes('Assam') && names.includes('Meghalaya'));
check('EVERY state in EVERY region carries the witness city that proved its code',
  REGIONS.every((r) => r.states.every((s) => !!s.witness && !!s.name && /^[0-9]{2}$/.test(s.admin1Code))));

// ---- 3. THE SCOPE GUARD — the shipped product is protected here ----------------------
//
// This is the test that stops Sprint 8 from breaking Sprint 7.

const HONEYMOON =
  'I along with my wife wish to go on a romantic honeymoon. We want a luxury tour, so no trains ' +
  'or long road journeys for us. We love mountains and sea.';

check('the golden-honeymoon sentence matches NO region (it names cities, and cities are the brief)',
  resolveRegion(HONEYMOON) === null, JSON.stringify(resolveRegion(HONEYMOON)?.region.key));

check('the bare word "Goa" is NOT a region trigger — it is one of our most-sold destinations',
  resolveRegion('We want to go to Goa for a week') === null);

check('...but the Konkan coast IS a region, because nobody books a hotel in "the Konkan"',
  resolveRegion('a road trip down the konkan coast')?.region.key === 'goa_konkan');

// The guard itself. Even a REAL region match may not be acted on if he named a place.
const konkan = resolveRegion('a road trip down the konkan coast');
check('regionIsUsable = FALSE when he named a destination we could resolve (Law 1: intent is the brief)',
  regionIsUsable(konkan, 2) === false);
check('regionIsUsable = TRUE only when he gave us nowhere to go',
  regionIsUsable(konkan, 0) === true);
check('regionIsUsable = FALSE when there is no region at all',
  regionIsUsable(null, 0) === false);
check('a region word used as COLOUR does not survey five states when he named a city',
  regionIsUsable(resolveRegion('We love South India, book us Madurai and Thanjavur'), 2) === false);

// ---- 4. LONGEST PHRASE WINS — the bug that would have sent him to Kolkata ------------
//
// "north east" sits next to "the east"'s neighbourhood. If the shorter phrase could win,
// a man asking for Shillong would be handed West Bengal, Odisha, Bihar and Jharkhand.

check('"north east" beats "the east" — he asked for Shillong, not Kolkata',
  resolveRegion('somewhere in the north east')?.region.key === 'north_east');
check('"east india" still resolves to East India when that is what he actually said',
  resolveRegion('we want to see east india')?.region.key === 'east_india');
check('"leh ladakh" resolves to Ladakh, not to the Himalayas',
  resolveRegion('leh ladakh in september')?.region.key === 'ladakh');

// ---- 5. WORD BOUNDARIES — a region matcher must not embarrass itself ----------------

check('"the east" does not fire on "the eastern edge of Bengaluru"',
  resolveRegion('a hotel on the eastern edge of Bengaluru') === null,
  JSON.stringify(resolveRegion('a hotel on the eastern edge of Bengaluru')?.region.key));
check('a sentence with no region in it resolves to nothing, quietly',
  resolveRegion('Delhi and Agra, four nights, two adults') === null);
check('empty input is not an error, it is simply no region', resolveRegion('') === null && resolveRegion(null) === null);

// ---- 6. THE SPELLINGS HE WILL ACTUALLY TYPE ------------------------------------------

check('"North-East India" (hyphen)',   resolveRegion('North-East India')?.region.key === 'north_east');
check('"northeast" (one word)',        resolveRegion('northeast, 10 days')?.region.key === 'north_east');
check('"the seven sisters"',           resolveRegion('the seven sisters')?.region.key === 'north_east');
check('"Kerala backwaters"',           resolveRegion('Kerala backwaters')?.region.key === 'kerala');
check('"Golden Triangle"',             resolveRegion('the golden triangle please')?.region.key === 'golden_triangle');
check('"Rajasthan"',                   resolveRegion('somewhere in Rajasthan')?.region.key === 'rajasthan');
check('"the Himalayas"',               resolveRegion('the himalayas in may')?.region.key === 'himalayas');
check('"Andamans"',                    resolveRegion('andaman islands')?.region.key === 'andamans');

// ---- 7. THE GOLDEN TRIANGLE IS NOT A MARKETING PHRASE, IT IS OUR OWN CATALOGUE -------
// Jaipur pairs with Delhi 29 times and Agra 26 times in tour_cities. Recovered, not invented.

const gt = regionByKey('golden_triangle');
check('the Golden Triangle spans Delhi, Uttar Pradesh and Rajasthan — Delhi, Agra, Jaipur',
  !!gt && ['07', '36', '24'].every((c) => gt.states.some((s) => s.admin1Code === c)));

// ---- 8. NO REGION MAY BE EMPTY ------------------------------------------------------

check('every region has at least one state and at least one phrase',
  REGIONS.every((r) => r.states.length > 0 && r.phrases.length > 0));
check('every region has a label we could read aloud to him',
  REGIONS.every((r) => !!r.label && r.label.length > 2));
check('no two regions share a trigger phrase (an ambiguous phrase is a coin toss, not a plan)',
  (() => {
    const seen = new Set<string>();
    for (const r of REGIONS) for (const p of r.phrases) { if (seen.has(p)) return false; seen.add(p); }
    return true;
  })());

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
