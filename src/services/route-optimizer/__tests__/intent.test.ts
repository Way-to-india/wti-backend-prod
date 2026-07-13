/**
 * Sprint 7 / US-601 acceptance — THE EAR.
 *
 * The canonical failing request, verbatim from the founder's ruling:
 *
 *   "I along with my wife wish to go on a romantic honeymoon. We want a luxury tour,
 *    so no trains or long road journeys for us. We love mountains and sea."
 *
 * The old parser kept six fields and threw the rest away. This proves the new one keeps
 * all of it — AND that every fact carries the right receipt (spec Part 7.1, provenance
 * byte-exact). The load-bearing test is the last block: a fact the model INVENTED can
 * never be labelled as something he said.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/intent.test.ts
 */

import { intentFromRaw, verifyQuote, soundsLikeAGroup, withInferredOrigin, type RawIntent } from '../intent';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`)); };

console.log('\nSprint 7 / US-601 — parseIntent: the six-field ear becomes a listening one\n');

const TEXT = 'I along with my wife wish to go on a romantic honeymoon. We want a luxury tour, so no trains or long road journeys for us. We love mountains and sea.';

// Exactly what the model is asked to return — quotes and all. Nothing here is trusted
// until intentFromRaw has checked each quote against his actual sentence.
const RAW: RawIntent = {
  cities: [{ name: 'Coorg', nights: 3 }, { name: 'Goa', nights: 3 }],
  start: null,
  pax: 2,
  composition: 'couple',
  purpose: 'honeymoon',
  comfortTier: 'luxury',
  interests: ['mountains', 'sea'],
  month: null,
  modes: [
    { mode: 'rail', stance: 'refuse', qualifier: 'any', strength: 0.9 },
    { mode: 'road', stance: 'avoid', qualifier: 'long', strength: 0.8 },
  ],
  quotes: {
    purpose: 'romantic honeymoon',
    comfortTier: 'we want a luxury tour',
    mode_rail: 'no trains',
    mode_road: 'no trains or long road journeys',
    interests: 'we love mountains and sea',
    party: 'I along with my wife',
  },
};

const it = intentFromRaw(RAW, TEXT);
const rail = it.modeStances.find((m) => m.mode === 'RAIL')!;
const road = it.modeStances.find((m) => m.mode === 'ROAD')!;
const air = it.modeStances.find((m) => m.mode === 'AIR')!;

// ---- 1. the four things the old parser threw away ------------------------------
console.log('  -- the words that used to fall on the floor --');
check('purpose = honeymoon, and he said it', it.purpose.value === 'honeymoon' && it.purpose.provenance === 'he_said', JSON.stringify(it.purpose));
check('comfort tier = luxury, and he said it', it.comfortTier.value === 'luxury' && it.comfortTier.provenance === 'he_said');
check('interests = mountains + sea, and he said them', it.interests.map((i) => i.value).join(',') === 'mountains,sea' && it.interests.every((i) => i.provenance === 'he_said'));
check('"no trains" = RAIL refuse / qualifier ANY (a category refusal)', rail.stance === 'refuse' && rail.qualifier === 'any', JSON.stringify(rail));
check('"no LONG road journeys" = ROAD avoid / qualifier LONG (an ordeal refusal, not a ban)', road.stance === 'avoid' && road.qualifier === 'long', JSON.stringify(road));

// ---- 2. the two speech acts are NOT the same thing ------------------------------
// This is Law 2 in one assertion. Get this wrong and the engine either bans the scenic
// three-hour drive that IS the luxury, or lets the eight-hour one through.
check('the refusals compile differently — RAIL is unqualified, ROAD is qualified', rail.qualifier === 'any' && road.qualifier !== 'any');

// ---- 3. budget stance is inferred FROM luxury — and says so ---------------------
check('budget stance = comfort_first', it.budgetStance.value === 'comfort_first');
check('budget stance is labelled OUR inference, not his word', it.budgetStance.provenance === 'we_inferred' && it.budgetStance.basis === 'from "luxury"', JSON.stringify(it.budgetStance));

// ---- 4. "prefer to fly" is OUR reading of his two refusals ----------------------
check('AIR = prefer (we read it from what he refused)', air.stance === 'prefer');
check('the flight preference is labelled we_inferred — he never said "fly"', air.reading.provenance === 'we_inferred', JSON.stringify(air.reading));

// ---- 5. the party he plainly stated -----------------------------------------------
check('party = 2, couple — and he SAID it ("I along with my wife")', it.party.value?.pax === 2 && it.party.value?.composition === 'couple' && it.party.provenance === 'he_said', JSON.stringify(it.party));
check('a couple maps to the standard physiology profile', it.party.value?.profile === 'standard');

// ---- 6. the month: the one thing we genuinely need ---------------------------------
check('month is we_need_it (not silently guessed)', it.month.provenance === 'we_need_it' && it.month.value == null, JSON.stringify(it.month));
// TWO FACTS, TWO RECEIPTS. `timeInHand` was one Reading<{nights,month}> and it let the nights WE
// invented ride into the echo panel on the receipt he gave us for the month. It was split for that
// reason. This pins the split: neither may ever be able to speak for the other.
check('nights carries its OWN receipt, separate from the month', it.nights.provenance !== 'he_said' || !!it.nights.quote, JSON.stringify(it.nights));
check('the two are separate Readings — neither can vouch for the other', it.month !== (it.nights as unknown));
check('origin is we_need_it before the gateway step', it.origin.provenance === 'we_need_it');
const withOrigin = withInferredOrigin(it, 'Bengaluru', 'the gateway for Coorg and Goa');
check('the gateway origin comes back as we_inferred — never as his word', withOrigin.origin.value === 'Bengaluru' && withOrigin.origin.provenance === 'we_inferred');

// ---- 7. THE ANTI-FABRICATION LOCK ---------------------------------------------------
// A model that hands us a quote it composed rather than read must not be able to put
// words in the traveller's mouth. The fact survives; the receipt is downgraded to ours.
console.log('  -- the lock: an inference may never wear his words --');
const LIAR: RawIntent = { ...RAW, comfortTier: 'luxury', quotes: { comfortTier: 'I want the most expensive hotels you have' } };
const lied = intentFromRaw(LIAR, TEXT);
check('a quote that is NOT in his sentence cannot produce he_said', lied.comfortTier.provenance === 'we_inferred', JSON.stringify(lied.comfortTier));
check('...and the fact itself is not lost, only relabelled', lied.comfortTier.value === 'luxury');
check('verifyQuote accepts a real quote', verifyQuote('no trains', TEXT) === 'no trains');
check('verifyQuote rejects an invented one', verifyQuote('no helicopters', TEXT) === null);
check('every he_said reading carries a quote', [it.purpose, it.comfortTier, it.party, ...it.interests].every((r) => r.provenance !== 'he_said' || !!r.quote));
check('no we_inferred reading carries a quote (it carries a basis)', [it.budgetStance, air.reading].every((r) => r.provenance !== 'we_inferred' || (!r.quote && !!r.basis)));

// ---- 8. the party-size guard (kept from the shipped controller) ---------------------
check('soundsLikeAGroup sees "my wife"', soundsLikeAGroup(TEXT));
const shrunk = intentFromRaw({ ...RAW, pax: 1 }, TEXT);
check('a model saying "1 traveller" about a plainly plural sentence is discarded, not obeyed', shrunk.party.value?.pax !== 1, JSON.stringify(shrunk.party));

// ---- 9. an empty ask degrades honestly ----------------------------------------------
const empty = intentFromRaw(null, 'somewhere nice');
check('an unparseable ask yields we_need_it everywhere, and invents nothing', empty.purpose.provenance === 'we_need_it' && empty.modeStances.length === 0 && empty.interests.length === 0);

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
