/**
 * ============================================================================
 * SPRINT 7 — THE GOLDEN TEST. US-611.
 *
 * One sentence, typed by a real traveller, in his own words:
 *
 *   "I along with my wife wish to go on a romantic honeymoon. We want a luxury tour,
 *    so no trains or long road journeys for us. We love mountains and sea."
 *
 * WHAT THE ENGINE DID TO HIM, measured on production:
 *   - it kept six fields and threw the rest away — honeymoon, luxury, "no trains",
 *     "no long road journeys": all discarded. It did not even keep the party size he
 *     had plainly stated;
 *   - it then planned EVERY LEG BY TRAIN, including a nine-hour overnight (16346
 *     Netravathi Express) landing him in Goa at 03:50 in the morning;
 *   - and it congratulated itself in writing: "overnight — saves a hotel night."
 *
 *   It sold thrift to a man who had asked for luxury, and it called that a feature.
 *
 * WHAT A SEASONED CONSULTANT WOULD HAVE SAID (the founder's ruling, verbatim):
 *
 *   "Sir, I do understand that you would prefer a flight over long distance trains or
 *    road transport. I have done due diligence on this and found that the destinations
 *    we have selected for you are best covered by road from Bangalore to Mysore and from
 *    Mysore to Coorg. Once you have already reached Coorg, then instead of coming back to
 *    Bangalore, it is my advice that you drive further to Mangalore Airport and take a
 *    flight to Goa. There are no direct flights to Goa but since it is your preference, I
 *    suggest you this option. I am not suggesting you train 16346 Netravathi Express
 *    because it takes almost 9 hours and reaches Goa early morning at 3:50 am, which is
 *    inconvenient."
 *
 * THIS TEST ASKS ONE QUESTION: does the engine now reach the founder's answer BY ITSELF —
 * from the sentence, through the procedure, with nothing hard-coded and nothing invented?
 *
 * Runnable standalone:
 *   bun run src/services/route-optimizer/__tests__/golden-honeymoon.test.ts
 * ============================================================================
 */

import { intentFromRaw, compileContract, counterQuestions, buildEcho, withAnsweredMonth, withInferredOrigin, type RawIntent } from '../intent';
import { consultantChoose, consultantFallback, type ConsultantCandidate, type GatewayCandidate } from '../consultant';
import { ordeal, type OrdealParty } from '../ordeal';
import { weightsForObjective, type LegCtx } from '../ddcv';
import { applyTPP } from '../tpp';
import { toleranceForProfile } from '../physiology';
import { solveForObjective, type OptimizeDeps } from '../optimize';
import type { CityNode, LegOption, OptimizeInput } from '../types';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`)); };

console.log('\n' + '='.repeat(78));
console.log('  THE GOLDEN TEST — the honeymoon, from his sentence to his itinerary');
console.log('='.repeat(78) + '\n');

const HIS_WORDS = 'I along with my wife wish to go on a romantic honeymoon. We want a luxury tour, so no trains or long road journeys for us. We love mountains and sea.';
console.log(`  He typed:\n    "${HIS_WORDS}"\n`);

// ---------------------------------------------------------------------------
// STEP 1 — THE EAR. What the model returns, and what we are willing to believe.
// ---------------------------------------------------------------------------
console.log('  ── 1. what we heard ──');

const RAW: RawIntent = {
  cities: [{ name: 'Coorg', nights: 3 }, { name: 'Goa', nights: 3 }],
  pax: 2, composition: 'couple', purpose: 'honeymoon', comfortTier: 'luxury',
  interests: ['mountains', 'sea'], month: null,
  modes: [
    { mode: 'rail', stance: 'refuse', qualifier: 'any', strength: 0.9 },
    { mode: 'road', stance: 'avoid', qualifier: 'long', strength: 0.8 },
  ],
  quotes: {
    purpose: 'romantic honeymoon', comfortTier: 'We want a luxury tour',
    mode_rail: 'no trains', mode_road: 'no trains or long road journeys',
    party: 'I along with my wife', interests: 'We love mountains and sea',
  },
};

let intent = intentFromRaw(RAW, HIS_WORDS);
check('honeymoon — HE SAID IT (it used to be discarded)', intent.purpose.value === 'honeymoon' && intent.purpose.provenance === 'he_said');
check('luxury — HE SAID IT (it used to be discarded)', intent.comfortTier.value === 'luxury' && intent.comfortTier.provenance === 'he_said');
check('no trains — HE SAID IT (it used to be discarded)', intent.modeStances.some((m) => m.mode === 'RAIL' && m.stance === 'refuse' && m.qualifier === 'any'));
check('no LONG road journeys — a different speech act, and we keep the difference', intent.modeStances.some((m) => m.mode === 'ROAD' && m.qualifier === 'long'));
check('two travellers — HE SAID IT ("I along with my wife"); it used to be a guess', intent.party.value?.pax === 2 && intent.party.provenance === 'he_said');
check('mountains and sea — HE SAID IT', intent.interests.map((i) => i.value).join(',') === 'mountains,sea');

// ---------------------------------------------------------------------------
// STEP 2 — THE ONE QUESTION. Not a form.
// ---------------------------------------------------------------------------
console.log('\n  ── 2. the one question we ask ──');
const questions = counterQuestions(intent);
for (const q of questions) console.log(`     ? ${q.text}`);
// US-831 — THIS ASSERTION USED TO SAY "EXACTLY ONE", AND IT WAS BLESSING A BUG.
//
// Read the sin table at the top of THE-CONSULTANTS-LAW.md again. Line one:
//
//     | Starting from | Bengaluru | we guessed |
//
// The law INDICTS that row. This test was asserting we should keep it. We asked him the month
// and quietly invented his home city, and the invented home city is the fact the whole route
// hangs off -- every airport, every train, every leg, every rejection. On the South India
// pilgrimage that same silence began the trip at RAMESWARAM, a town with no airport, which no
// traveller can start a holiday from.
//
// FOUNDER, 13 July 2026: "THE BASIC FLAW IS NOT ASKING FROM WHERE THE PERSON WISHES TO START
// HIS JOURNEY." So now we ask. TWO questions, not one -- and still not a form.
check('EXACTLY TWO questions — the two things we genuinely do not have', questions.length === 2, `${questions.length}`);
check('...and the FIRST is where he starts from — the most trip-shaping fact there is', questions[0]?.key === 'origin');
check('...and the second is the month', questions[1]?.key === 'month');
check('the origin question offers NO provisional — a provisional origin IS the bug',
      questions[0]?.key === 'origin' && questions[0]?.provisional === undefined);

// he answers. December.
intent = withAnsweredMonth(intent, 12, 'December');
intent = withInferredOrigin(intent, 'Bengaluru', 'the gateway for Coorg and Goa');

// ---------------------------------------------------------------------------
// STEP 3 — THE CONTRACT. His words, compiled into machinery.
// ---------------------------------------------------------------------------
console.log('\n  ── 3. what his words compile to ──');
const C = compileContract(intent);
console.log(`     ban modes ......... ${JSON.stringify(C.filters.banModes)}`);
console.log(`     road ordeal ceiling ${C.tighten.perModeOrdealCeiling?.ROAD}`);
console.log(`     dead-hours gate ... ${C.tighten.deadHoursArrival === true}`);
console.log(`     hotel-night reward  ${C.rewardSwitches.hotelNightSaving}`);
console.log(`     money rule ........ ${C.moneyRule}`);
console.log(`     comfort dial P5 ... ${C.tpp.P5}`);
check('"no trains" became a FILTER', C.filters.banModes.includes('RAIL'));
check('"no long road journeys" became a CEILING, not a ban', !C.filters.banModes.includes('ROAD') && C.tighten.perModeOrdealCeiling?.ROAD === 30);
check('the dead-hours gate is ON', C.tighten.deadHoursArrival === true);
check('the hotel-night reward is DELETED', C.rewardSwitches.hotelNightSaving === false);
check('money is demoted to a tiebreak', C.moneyRule === 'tiebreak_only');
check('the luxury dial is finally turned', (C.tpp.P5 ?? 0) >= 0.9);

// ---------------------------------------------------------------------------
// THE DATA. Real services only. Nothing here is invented.
// ---------------------------------------------------------------------------
const couple: OrdealParty = { cls: 'midage', budgetStance: 'comfort_first' };
const tol = toleranceForProfile('standard');
const w = applyTPP(weightsForObjective('BALANCED'), C.tpp);
const ctxFor = (o: LegOption): LegCtx => ({
  tol, pax: 2, month: 12,
  accessFromHrs: o.mode === 'AIR' ? 1.5 : o.mode === 'RAIL' ? 0.75 : 0,
  accessToHrs: o.mode === 'AIR' ? 1.0 : o.mode === 'RAIL' ? 0.75 : 0,
});

const BLR_MYSURU = { from: 'Bengaluru', to: 'Mysuru', mode: 'ROAD', distanceKm: 145, durationMin: 180, operatingDays: 127, farePpMin: 2400, farePpMax: 3000 } as LegOption;
const MYSURU_COORG = { from: 'Mysuru', to: 'Coorg', mode: 'ROAD', distanceKm: 120, durationMin: 165, operatingDays: 127, farePpMin: 2200, farePpMax: 2600 } as LegOption;
const BLR_COORG_DIRECT = { from: 'Bengaluru', to: 'Coorg', mode: 'ROAD', distanceKm: 265, durationMin: 330, operatingDays: 127, farePpMin: 4200, farePpMax: 5000 } as LegOption;

// The leg that produced the law.
const NETRAVATHI = {
  from: 'Coorg', to: 'Goa', mode: 'RAIL', identifier: '16346 Netravathi Exp',
  distanceKm: 340, durationMin: 540, depTime: '18:50', arrTime: '03:50', arrDayOffset: 1,
  classes: ['2A', '3A', 'SL'], operatingDays: 127, reliability: 4, farePpMin: 900, farePpMax: 1400,
} as LegOption;
const COORG_GOA_ROAD = { from: 'Coorg', to: 'Goa', mode: 'ROAD', distanceKm: 380, durationMin: 450, operatingDays: 127, farePpMin: 6000, farePpMax: 7000 } as LegOption;
const COORG_MANGALORE = { from: 'Coorg', to: 'Mangalore', mode: 'ROAD', distanceKm: 140, durationMin: 210, operatingDays: 127, farePpMin: 2400, farePpMax: 2900 } as LegOption;
const MANGALORE_GOA = {
  from: 'Mangalore', to: 'Goa', mode: 'AIR', identifier: '6E 7431',
  distanceKm: 300, durationMin: 60, depTime: '16:40', arrTime: '17:40',
  operatingDays: 127, reliability: 4, farePpMin: 3900, farePpMax: 4800,
} as LegOption;

// ---------------------------------------------------------------------------
// STEP 4 — BENGALURU → COORG. The founder said: by road, via Mysuru.
// ---------------------------------------------------------------------------
console.log('\n  ── 4. Bengaluru → Coorg ──');
const oMysuru = ordeal(BLR_MYSURU, couple, { doorToDoorHrs: 3 });
const oOnward = ordeal(MYSURU_COORG, couple, { doorToDoorHrs: 2.75 });
const oDirect = ordeal(BLR_COORG_DIRECT, couple, { doorToDoorHrs: 5.5 });
console.log(`     via Mysuru: ${oMysuru.total} + ${oOnward.total} (both ${oMysuru.band})`);
console.log(`     straight through: ${oDirect.total} (${oDirect.band})`);
check('the drive to Mysuru is a PLEASURE, not an ordeal — this is the luxury', oMysuru.band === 'pleasant');
check('...and so is the run on to Coorg', oOnward.band === 'pleasant');
check('both legs sit inside the ceiling he set for road journeys', oMysuru.total <= 30 && oOnward.total <= 30);
check('the straight drive is measurably harder than the two-stage one', oDirect.total > oMysuru.total && oDirect.total > oOnward.total);

// ---------------------------------------------------------------------------
// STEP 5 — COORG → GOA. The leg that produced the ruling.
// ---------------------------------------------------------------------------
console.log('\n  ── 5. Coorg → Goa — the leg that produced the ruling ──');

const direct: ConsultantCandidate[] = [
  { opt: NETRAVATHI, ctx: ctxFor(NETRAVATHI) },
  { opt: COORG_GOA_ROAD, ctx: ctxFor(COORG_GOA_ROAD) },
];
const judged = consultantChoose(direct, { contract: C, party: couple, weights: w });

check('there is NO honourable single service on this leg', judged.infeasible === true);
check('...and the engine does not invent one', judged.winner === null);
for (const r of judged.rejected) console.log(`     ✗ ${r.reason}`);

const netraLine = judged.rejected.find((r) => r.opt.identifier === '16346 Netravathi Exp')?.reason ?? '';
const roadLine = judged.rejected.find((r) => r.opt.mode === 'ROAD')?.reason ?? '';
check('THE TRAIN IS REFUSED — on his word, not on a score', /you asked us not to travel by train/.test(netraLine), netraLine);
check('THE STRAIGHT DRIVE IS REFUSED — and in his own words', /longer than a day at the wheel should be/.test(roadLine), roadLine);
// "eight hours" — because the honest door-to-door figure includes the comfort stops a real
// party actually takes. Which is, word for word, what the founder himself said: "about eight
// hours on the road". The engine reached his phrasing from the data.
check('...and it tells him the true DOOR-TO-DOOR length, spoken as a person speaks', /eight hours on the road/.test(roadLine), roadLine);
check('...and reminds him it is longer than he asked for — his brief, honoured out loud', /longer than you asked for/.test(roadLine), roadLine);
// Not one word of the gate's own language survives into what he reads:
check('NO gate language reaches the traveller ("cap", "midage", "rail/air")', !/cap|midage|rail\/air|exceeds/i.test(roadLine), roadLine);
check('NO rejection mentions a price, a score, or a weight', judged.rejected.every((r) => !/₹|rupee|cost|cheap|score|weight|scalar/i.test(r.reason)));

// And the ordeal of the train, computed rather than remembered:
const netraOrdeal = ordeal(NETRAVATHI, couple, { doorToDoorHrs: 9 });
console.log(`     (the Netravathi scores ${netraOrdeal.total} — ${netraOrdeal.band})`);
check('the nine-hour overnight scores as an ORDEAL, from first principles', netraOrdeal.band === 'ordeal');

// THE FALLBACK — the founder's own answer.
const gateways: GatewayCandidate[] = [{ node: 'Mangalore', reach: COORG_MANGALORE, onward: [MANGALORE_GOA] }];
const advice = consultantFallback({ from: 'Coorg', to: 'Goa' }, direct, gateways, { contract: C, party: couple, weights: w, ctxFor });

check('the engine builds the MANGALORE composite', advice.kind === 'composite' && advice.composite?.gateway === 'Mangalore');
check('...reached by road', advice.composite?.reach.opt.mode === 'ROAD');
check('...and flown out on a REAL, NAMED service', advice.composite?.onward.opt.identifier === '6E 7431');
check('each half is comfortable on its own — that is why it may be offered', (advice.composite?.reach.ordeal.total ?? 99) <= 30 && (advice.composite?.onward.ordeal.total ?? 99) <= 45);

// ---------------------------------------------------------------------------
// STEP 6 — WHAT HE READS.
// ---------------------------------------------------------------------------
console.log('\n' + '─'.repeat(78));
console.log('  WHAT THE TRAVELLER FINALLY READS');
console.log('─'.repeat(78) + '\n');

console.log('  What we understood:');
for (const r of buildEcho(intent)) {
  const chip = r.provenance === 'he_said' ? 'you said' : r.provenance === 'we_inferred' ? 'our suggestion — tap to change' : 'we need it';
  console.log(`    • ${r.label}: ${r.value}  (${chip})`);
}

console.log('\n  Your route:  Bengaluru → Mysuru → Coorg → Mangalore → Goa\n');
console.log(`  ${advice.paragraph}\n`);
console.log('  Options we looked at and set aside:');
for (const r of judged.rejected) console.log(`    ✗ ${r.reason}`);
console.log('');

// ---------------------------------------------------------------------------
// THE VERDICT — is this the founder's answer?
// ---------------------------------------------------------------------------
console.log('─'.repeat(78));
console.log('  THE VERDICT');
console.log('─'.repeat(78) + '\n');

const p = advice.paragraph;
check('1. ROAD to Mysuru, and on to Coorg — the short, driven legs ARE the luxury', oMysuru.band === 'pleasant' && oOnward.band === 'pleasant');
check('2. DRIVE ON to Mangalore rather than doubling back to Bengaluru', /drive .* to Mangalore/i.test(p), p);
check('3. FLY Mangalore → Goa, on a service that really exists', /6E 7431/.test(p));
check('4. THE NETRAVATHI IS REJECTED, and for the reason HE would give', /you asked us not to travel by train/.test(netraLine));
check('5. THE SUBSTITUTION IS ANNOUNCED — finding, reason, alternative', /We checked every way/.test(p) && /has no airport/.test(p) && /So here is our advice/.test(p));
check('6. It ties back to what he wanted: "just as you preferred"', /just as you preferred/.test(p));
check('7. TWO questions were asked — where he starts, and when. Not a form.',
      questions.length === 2 && questions[0].key === 'origin' && questions[1].key === 'month');
check('8. NOT ONE WORD about saving a hotel night — anywhere', !/hotel night/i.test(p + netraLine + roadLine + JSON.stringify(buildEcho(intent))));
check('9. NO price is quoted to him', !/₹|rupee/i.test(p + netraLine + roadLine));
check('10. NO adjective the data cannot prove ("scenic", "beautiful")', !/scenic|beautiful|stunning|breathtaking/i.test(p));

// And the thing the whole sprint exists for.
console.log('');
check('THE RULING, DELIVERED: he asked for luxury, and luxury is what the engine planned',
  advice.kind === 'composite'
  && !/hotel night/i.test(p)
  && /you asked us not to travel by train/.test(netraLine)
  && oMysuru.band === 'pleasant');

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
