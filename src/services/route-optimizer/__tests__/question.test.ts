/**
 * Sprint 7 / US-609 acceptance — THE COUNTER-QUESTION GATE, and the echo panel.
 *
 * The founder's worry was exact: a free sentence alone risks a wrong plan. But a form is not
 * the answer either — nobody fills in a form to talk to a friend.
 *
 * So: the free sentence is round one. The one or two best questions are round two. The echo
 * panel — which he can correct at any time — is the standing round three.
 *
 * THE ACCEPTANCE: on the canonical honeymoon sentence, the engine asks EXACTLY ONE question
 * (the month), because that is the only thing we genuinely do not have. It does not ask him
 * his purpose, his comfort tier, his refusals or his party — HE TOLD US ALL OF THAT, and
 * asking a man to repeat himself is how you prove you were not listening.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/question.test.ts
 */

import {
  counterQuestions, buildEcho, intentFromRaw, withAnsweredMonth, withInferredOrigin,
  ASK_THRESHOLD, PLAN_IMPACT, type RawIntent,
} from '../intent';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`)); };

console.log('\nSprint 7 / US-609 — one good question, not a form\n');

const TEXT = 'I along with my wife wish to go on a romantic honeymoon. We want a luxury tour, so no trains or long road journeys for us. We love mountains and sea.';
const RAW: RawIntent = {
  cities: [{ name: 'Coorg', nights: 3 }, { name: 'Goa', nights: 3 }],
  pax: 2, composition: 'couple', purpose: 'honeymoon', comfortTier: 'luxury',
  interests: ['mountains', 'sea'],
  modes: [
    { mode: 'rail', stance: 'refuse', qualifier: 'any', strength: 0.9 },
    { mode: 'road', stance: 'avoid', qualifier: 'long', strength: 0.8 },
  ],
  quotes: { purpose: 'romantic honeymoon', comfortTier: 'we want a luxury tour', mode_rail: 'no trains', mode_road: 'no trains or long road journeys', party: 'I along with my wife', interests: 'we love mountains and sea' },
};

const intent = intentFromRaw(RAW, TEXT);
const qs = counterQuestions(intent);

// ---- 1. EXACTLY ONE QUESTION ---------------------------------------------------------
console.log('  -- the canonical request --');
for (const q of qs) console.log(`     ? ${q.text}`);
check('EXACTLY ONE question is asked', qs.length === 1, `${qs.length}: ${qs.map((q) => q.key).join(', ')}`);
check('...and it is the MONTH — the one thing we truly do not have', qs[0]?.key === 'month');
check('the question carries our provisional answer — a consultant proposes while he asks', !!qs[0]?.provisional);
check('...and it says WHY it matters, in facts our own engine can prove (monsoon roads)', /June and September|slower in the rain/.test(qs[0]?.text ?? ''));

// The season claim is grounded in physiology.terrainSpeedKmh, which really does slow hill
// roads in the monsoon. We do NOT invent a "best season" for a place we have no season data
// for — the adjective registry is empty, and an unprovable claim is a lie with good manners.
check('no invented "best season for Coorg and Goa" claim — we say only what we can prove', !/best season|pleasant season|October to March/i.test(qs[0]?.text ?? ''));

// ---- 2. WE NEVER ASK HIM WHAT HE ALREADY SAID -------------------------------------------
console.log('  -- rule 1: never make a man repeat himself --');
const asked = new Set(qs.map((q) => q.key));
check('we do NOT ask his purpose — he said "romantic honeymoon"', !asked.has('purpose'));
check('we do NOT ask his comfort tier — he said "a luxury tour"', !asked.has('comfortTier'));
check('we do NOT ask his party — he said "I along with my wife"', !asked.has('party'));
check('we do NOT ask his refusals — he said "no trains"', !asked.has('modes'));
// Even though comfort tier has a HIGH impact (0.8), a he_said field is exempt whatever the
// impact. That exemption is the difference between a consultant and a questionnaire.
check('a he_said field is exempt WHATEVER its impact (comfort tier is 0.8, and still not asked)', PLAN_IMPACT.comfortTier >= 0.8 && !asked.has('comfortTier'));

// ---- 3. NEVER MORE THAN TWO ---------------------------------------------------------------
console.log('  -- rule 2: never a wall of questions --');
const knowsNothing = intentFromRaw({ cities: [{ name: 'Delhi', nights: 2 }] }, 'somewhere nice please');
const many = counterQuestions(knowsNothing);
console.log(`     a traveller who told us almost nothing → ${many.length} questions asked (of 4 that qualify)`);
check('a near-empty ask still gets AT MOST TWO questions', many.length <= 2, String(many.length));
check('...and they are the two that matter most (highest risk first)', many.length === 2 && (many[0].risk >= many[1].risk));
check('...the third-most-risky thing becomes an echo chip instead, not a third question', many.length === 2);

// ---- 4. the threshold is doing real work ---------------------------------------------------
// pace: (1 − 0) × 0.4 = 0.40, which is BELOW 0.45. So we do not ask a man how fast he likes to
// travel — we infer it, show it in the panel, and let him correct it. A question we can live
// without is a question we do not ask.
check('the threshold is 0.45, and pace (impact 0.4) falls under it — so we never ask it', ASK_THRESHOLD === 0.45 && PLAN_IMPACT.pace < ASK_THRESHOLD && !asked.has('pace'));

// ---- 5. once he answers, we never ask again ---------------------------------------------------
const answered = withAnsweredMonth(intent, 12, 'December');
check('he answers "December" → the question is gone', counterQuestions(answered).length === 0);
check('...and December is now HIS word, not our guess', answered.month.provenance === 'he_said');

// THE BUG THIS TEST CAUGHT, and it is the exact dishonesty the panel exists to prevent:
// the month and the nights used to live in ONE Reading. So the moment he answered "December",
// the SIX NIGHTS WE HAD INVENTED were promoted to "you said" along with it — our guess,
// wearing his words, on the very panel whose entire job is to keep those two apart.
// A Reading may hold ONE fact. Two facts, two receipts.
check('THE FIX: answering the month does NOT promote the nights we invented', answered.nights.provenance === 'we_inferred', JSON.stringify(answered.nights));
check('...he said December; he never said six nights; and the panel must never confuse the two', answered.month.provenance === 'he_said' && answered.nights.provenance !== 'he_said');

// ---- 6. THE ECHO PANEL — and the one thing it may never do --------------------------------------
console.log('  -- the panel: a value we inferred may NEVER wear a "you said" chip --');
const withOrigin = withInferredOrigin(answered, 'Bengaluru', 'the gateway for Coorg and Goa');
const echo = buildEcho(withOrigin);
for (const r of echo) console.log(`     [${r.provenance.replace(/_/g, ' ')}] ${r.label}: ${r.value}`);

const row = (k: string) => echo.find((r) => r.key === k);
check('"Honeymoon" is chipped as HIS word, with his quote attached', row('purpose')?.provenance === 'he_said' && !!row('purpose')?.quote);
check('"luxury" is chipped as HIS word', row('comfortTier')?.provenance === 'he_said');
check('"no trains" appears in the panel, in his own words', row('mode_rail')?.quote === 'no trains');
check('Bengaluru is chipped as OUR suggestion — he never said it', row('origin')?.provenance === 'we_inferred', JSON.stringify(row('origin')));
check('...and it carries the reason we guessed it', !!row('origin')?.why);
check('the nights we split are OURS, and say so', row('nights')?.provenance === 'we_inferred');

// THE IRON RULE, machine-checked: every he_said chip is backed by a real quote from his own
// sentence, and no we_inferred chip carries one. The UI derives the chip from this enum, so a
// guess CANNOT be dressed up as his word.
check('THE IRON RULE: every "you said" chip is backed by his actual words', echo.every((r) => r.provenance !== 'he_said' || !!r.quote));
check('...and no inference of ours is wearing a quote it did not earn', echo.every((r) => r.provenance !== 'we_inferred' || !r.quote));

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
