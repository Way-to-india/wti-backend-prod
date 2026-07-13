/**
 * US-820 acceptance — THE NO-REPEAT INVARIANT, and the trip that does not have to come back.
 *
 * The tour we actually served a real pilgrim of 56, on 13 July 2026:
 *
 *     Madurai -> Kanyakumari -> Tirupati -> Rameswaram -> TIRUPATI -> Madurai
 *
 * Two bugs, stacked. Fixing either one alone HIDES the other, so both are pinned here:
 *
 *   1. THE REPEAT.  A TSP that visits a node twice is not a poor tour. It is a broken one.
 *      Note carefully: the round trip does NOT explain it. Even as a closed loop the right
 *      answer is Madurai -> Rameswaram -> Kanyakumari -> Tirupati -> Madurai -- a clean
 *      circle, no city twice. So `closingOrigin` must forgive the origin AND NOTHING ELSE.
 *
 *   2. THE ASSUMPTION.  He never asked to come home. He was taken home by a default.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/noRepeat.test.ts
 */

import { repeatedCities, sequence } from '../sequence';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`)); };

console.log('\nUS-820 — no city twice, and the trip does not have to come back\n');

// ---- 1. THE TOUR WE ACTUALLY SHIPPED -------------------------------------------------
console.log('  -- the tour we served a 56-year-old pilgrim --');
const SHIPPED = ['Madurai', 'Kanyakumari', 'Tirupati', 'Rameswaram', 'Tirupati', 'Madurai'];

check('the shipped tour is caught as BROKEN — Tirupati is visited twice',
  repeatedCities(SHIPPED, { closingOrigin: true }).some((c) => c.toLowerCase() === 'tirupati'),
  JSON.stringify(repeatedCities(SHIPPED, { closingOrigin: true })));

// THE TRAP THE HANDOFF WARNED ABOUT, PINNED. If someone "fixes" the round trip and stops
// there, `closingOrigin` forgives the Madurai — and Tirupati is STILL there. This assertion
// is what makes fixing one bug unable to hide the other.
check('...and forgiving the closing Madurai does NOT forgive Tirupati (the two bugs are separate)',
  repeatedCities(SHIPPED, { closingOrigin: true }).length === 1);

check('with no round trip claimed, BOTH repeats are reported',
  repeatedCities(SHIPPED).length === 2, JSON.stringify(repeatedCities(SHIPPED)));

// ---- 2. THE ONE LEGAL REPEAT ---------------------------------------------------------
console.log('  -- the one repeat that is allowed, and only when he asked for it --');
const CIRCLE = ['Madurai', 'Rameswaram', 'Kanyakumari', 'Tirupati', 'Madurai'];

check('a clean circle he ASKED for is legal — the origin closes the loop',
  repeatedCities(CIRCLE, { closingOrigin: true }).length === 0);

check('...but the SAME circle is a breach when he never asked to come back',
  repeatedCities(CIRCLE).length === 1 && repeatedCities(CIRCLE)[0] === 'Madurai');

check('an open-jaw tour is clean',
  repeatedCities(['Chennai', 'Tirupati', 'Madurai', 'Rameswaram', 'Kanyakumari']).length === 0);

check('only the CLOSING node is forgiven — an origin revisited mid-tour is still a breach',
  repeatedCities(['Delhi', 'Agra', 'Delhi', 'Jaipur'], { closingOrigin: true }).length === 1);

check('a gateway is NOT forgiven — "the gateway may legitimately recur" was the bug',
  repeatedCities(['Guwahati', 'Shillong', 'Guwahati', 'Kaziranga'], { closingOrigin: true })
    .some((c) => c === 'Guwahati'));

// ---- 3. IT DOES NOT INVENT A BREACH --------------------------------------------------
console.log('  -- and it never cries wolf --');
check('a normal open path is clean', repeatedCities(['Delhi', 'Agra', 'Jaipur']).length === 0);
check('case and padding do not create a phantom repeat',
  repeatedCities([' Delhi ', 'Agra', 'JAIPUR']).length === 0);
check('case DIFFERENCES do not hide a real one ("delhi" is Delhi)',
  repeatedCities(['Delhi', 'Agra', 'delhi', 'Jaipur']).length === 1);
check('a single city is clean', repeatedCities(['Delhi']).length === 0);
check('an empty tour is clean', repeatedCities([]).length === 0);
check('a two-node round trip closes legally', repeatedCities(['Delhi', 'Delhi'], { closingOrigin: true }).length === 0);

// ---- 4. THE SOLVER ITSELF NEVER BREAKS IT --------------------------------------------
// This is the load-bearing point. The sequencer is INNOCENT, and proving that is what tells
// the next engineer to look ABOVE the engine when a repeat shows up on a page.
console.log('  -- the solver is innocent: the repeat is always injected from above --');
const cost = [
  [0, 100, 700, 300],
  [100, 0, 650, 250],
  [700, 650, 0, 500],
  [300, 250, 500, 0],
];
const names = ['Madurai', 'Rameswaram', 'Tirupati', 'Kanyakumari'];
const { order } = sequence(cost, { start: 0 });
const solved = order.map((i) => names[i]);
check('Held-Karp visits every city exactly once, by construction',
  repeatedCities(solved).length === 0, solved.join(' -> '));
check('...and it visits ALL of them (nobody is dropped to dodge the invariant)',
  new Set(solved.map((s) => s.toLowerCase())).size === names.length, solved.join(' -> '));

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
