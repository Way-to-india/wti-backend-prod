/**
 * US-835/836/837 — THE IRON LAW, INSTALLED.
 *
 * On 14 July 2026 truth.ts was written, committed with the words "a plan containing one
 * unprovable fact IS NOT DELIVERED", and CALLED FROM NOWHERE. It was dead code for a day.
 * These assertions exist so that can never be true again: they drive the real laws with the
 * real lies the 15 July sweep shipped to real-looking travellers.
 *
 *   bun run src/services/route-optimizer/__tests__/truth.test.ts
 */
import { checkPlanTruth, legKmBelowCrow, legSpeedIsImpossible, roadKmIsImpossible, honestOptions, MAX_AVG_KMH, ROAD_MAX_RATIO, ROAD_MAX_RATIO_MOUNTAIN, type TruthCtx } from '../truth';
import type { Plan, PlanLeg, LatLng } from '../types';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`)); };

console.log('\nUS-835/836/837 — THE IRON LAW\n');

const LUCKNOW: LatLng = [26.8467, 80.9462];
const TIRUPATI: LatLng = [13.6288, 79.4192];
const DELHI: LatLng = [28.61, 77.21];
const AGRA: LatLng = [27.18, 78.01];
const KOLKATA: LatLng = [22.5726, 88.3639];
const DARJEELING: LatLng = [27.0360, 88.2627];
const BODHGAYA: LatLng = [24.6961, 84.9869];

const ctx = (over: Partial<TruthCtx> = {}): TruthCtx => ({
  coords: new Map<string, LatLng>([
    ['lucknow', LUCKNOW], ['tirupati', TIRUPATI], ['delhi', DELHI], ['agra', AGRA],
    ['kolkata', KOLKATA], ['darjeeling', DARJEELING], ['bodh gaya', BODHGAYA],
  ]),
  known: new Set(['lucknow', 'tirupati', 'delhi', 'agra', 'kolkata', 'darjeeling', 'bodh gaya']),
  roundTrip: false,
  ...over,
});
const plan = (legs: PlanLeg[]): Plan => ({ sequence: [], weekdayLock: null, legs, days: [], totals: {} as any, warnings: [], verifyBeforeBooking: [], map: {} as any });

// ── L1 — THE CROW-FLY FLOOR BINDS EVERY MODE, NOT JUST THE ROAD ──────────────────────────────
console.log('L1 — geography cannot be argued with, whatever you are riding in');

// THE REAL LIE, 15 July 2026: sold to a 56-year-old man and his wife.
const railLie = plan([{ from: 'Lucknow', to: 'Tirupati', mode: 'RAIL', distanceKm: 460, durationMin: 635 }]);
const vRail = checkPlanTruth(railLie, ctx());
check('a 460 km RAIL leg across a 1,476 km gap is caught (it was not, and we shipped it)',
  vRail.some((v) => v.law === 'L1_GEOGRAPHY'), JSON.stringify(vRail));
check('...and the same lie is ALSO caught as an impossible speed (140 km/h by train)',
  vRail.some((v) => v.law === 'L6_IMPOSSIBLE_SPEED'));

check('an AIR leg shorter than the crow flies is caught too',
  checkPlanTruth(plan([{ from: 'Delhi', to: 'Tirupati' as any, mode: 'AIR', distanceKm: 100 }]),
    ctx({ coords: new Map<string, LatLng>([['delhi', DELHI], ['tirupati', TIRUPATI]]), known: new Set(['delhi', 'tirupati']) }))
    .some((v) => v.law === 'L1_GEOGRAPHY'));

check('legKmBelowCrow is pure geometry — it fires regardless of mode',
  legKmBelowCrow(460, LUCKNOW, TIRUPATI) !== null && legKmBelowCrow(1900, LUCKNOW, TIRUPATI) === null);

check('an HONEST rail distance is left alone (no false alarm)',
  checkPlanTruth(plan([{ from: 'Lucknow', to: 'Tirupati', mode: 'RAIL', distanceKm: 1900, durationMin: 1800 }]), ctx()).length === 0);

check('the founder-locked ROAD ceiling (2.2x) still stands',
  roadKmIsImpossible(1878, [26.9, 75.8], [24.6, 73.7]) !== null);

// ── L6 — A DURATION MUST BE POSSIBLE ────────────────────────────────────────────────────────
console.log('\nL6 — a false clock switches off every comfort gate he has');

check('30 hours of train may not be sold as 10h35 (the twenty-hour train in a costume)',
  legSpeedIsImpossible(1900, 635, LUCKNOW, TIRUPATI, 'RAIL') !== null);

check('an honest ~30 h for the same journey passes',
  legSpeedIsImpossible(1900, 1800, LUCKNOW, TIRUPATI, 'RAIL') === null);

check('a leg that UNDER-STATES distance AND time cannot conspire to look reasonable',
  // 460 km "in" 635 min looks like a sane 43 km/h — until you measure against the real gap.
  legSpeedIsImpossible(460, 635, LUCKNOW, TIRUPATI, 'RAIL') !== null);

check('a real Delhi-Agra drive (230 km, 4 h) is not molested',
  legSpeedIsImpossible(230, 240, DELHI, AGRA, 'ROAD') === null);

check('the ceilings are impossibility bounds, deliberately generous',
  MAX_AVG_KMH.RAIL === 110 && MAX_AVG_KMH.ROAD === 90 && MAX_AVG_KMH.AIR === 950);

// ── L4 — NO CITY TWICE, AND IT IS CHECKED BY POSITION ───────────────────────────────────────
console.log('\nL4 — a repeated stop is a bug with a hotel booking');

// THE REAL LIE: L4 was disarmed for EVERY traveller, because tripType defaults to 'roundtrip'.
const kolkataTwice = plan([
  { from: 'Kolkata', to: 'Darjeeling', mode: 'ROAD', distanceKm: 620, durationMin: 720 },
  { from: 'Darjeeling', to: 'Kolkata', mode: 'ROAD', distanceKm: 620, durationMin: 720 },
  { from: 'Kolkata', to: 'Bodh Gaya', mode: 'ROAD', distanceKm: 480, durationMin: 600 },
]);
check('Kolkata → Darjeeling → KOLKATA → Bodh Gaya is caught EVEN ON A ROUND TRIP',
  checkPlanTruth(kolkataTwice, ctx({ roundTrip: true })).some((v) => v.law === 'L4_CITY_TWICE'),
  'the old law switched itself off whenever roundTrip was set — which is ALWAYS, by default');

check('...and caught on a one-way trip too, obviously',
  checkPlanTruth(kolkataTwice, ctx({ roundTrip: false })).some((v) => v.law === 'L4_CITY_TWICE'));

// the ONE honourable repeat.
const genuineReturn = plan([
  { from: 'Delhi', to: 'Agra', mode: 'ROAD', distanceKm: 230, durationMin: 240 },
  { from: 'Agra', to: 'Delhi', mode: 'ROAD', distanceKm: 230, durationMin: 240 },
]);
check('a GENUINE round trip may end where it began — first stop and last, and nothing else',
  checkPlanTruth(genuineReturn, ctx({ roundTrip: true })).length === 0);

check('...but that same shape on a ONE-WAY trip is still a bug',
  checkPlanTruth(genuineReturn, ctx({ roundTrip: false })).some((v) => v.law === 'L4_CITY_TWICE'));

// ── L3 / L5 ─────────────────────────────────────────────────────────────────────────────────
console.log('\nL3 / L5 — we do not send him to a place we cannot point to, nor quote him words he never wrote');

check('a city we cannot point to on a map is caught',
  checkPlanTruth(plan([{ from: 'Delhi', to: 'Zorbabad', mode: 'ROAD', distanceKm: 200 }]), ctx())
    .some((v) => v.law === 'L3_UNKNOWN_CITY'));

const forged = plan([{ from: 'Delhi', to: 'Agra', mode: 'ROAD', distanceKm: 230, durationMin: 240 }]);
forged.warnings = ['You told us "we hate flying" so we kept you off the plane.'];
check('a quote he never wrote is a forgery, and is caught',
  checkPlanTruth(forged, ctx({ request: 'We want to see Agra. Two adults.' }))
    .some((v) => v.law === 'L5_INVENTED_QUOTE'));

const trueQuote = plan([{ from: 'Delhi', to: 'Agra', mode: 'ROAD', distanceKm: 230, durationMin: 240 }]);
trueQuote.warnings = ['You told us "we hate flying" so we kept you off the plane.'];
check('...and his REAL words are left alone',
  checkPlanTruth(trueQuote, ctx({ request: 'We want to see Agra but we hate flying.' }))
    .every((v) => v.law !== 'L5_INVENTED_QUOTE'));

// ── US-841 — THE CEILING STANDS DOWN IN THE MOUNTAINS ───────────────────────────────────────
console.log('\nUS-841 — the ceiling was a plains intuition, and in the Himalaya it manufactured a lie');

const GANGOTRI: LatLng = [30.9946, 78.9398];   // 3,056 m
const KEDARNATH: LatLng = [30.7346, 79.0669];  // 3,549 m
const JAIPUR: LatLng = [26.9196, 75.7878];     //   438 m
const UDAIPUR: LatLng = [24.5858, 73.7135];    //   567 m

// The road from Gangotri to Kedarnath runs all the way DOWN one valley to Rishikesh and all the
// way back UP the next. It is ~330 km across a 31 km gap — 10.5x — AND IT IS THE ONLY ROAD.
check('a REAL Himalayan road (Gangotri → Kedarnath, 327 km across 31 km) is no longer called a lie',
  roadKmIsImpossible(327, GANGOTRI, KEDARNATH, 3056, 3549) === null,
  'the old ceiling discarded it and substituted 40 km at 45 km/h — an hour, for a two-day drive');

check('Kedarnath → Badrinath, 217 km across 41 km, survives too',
  roadKmIsImpossible(217, KEDARNATH, [30.7433, 79.4938], 3549, 3127) === null);

// ...and the ceiling has NOT simply been switched off. On the plains it is exactly where the
// founder put it, and it still catches the lie it was built for.
check('THE PLAINS CEILING IS UNTOUCHED — Jaipur → Udaipur, 1,878 km across ~400 km, still caught',
  roadKmIsImpossible(1878, JAIPUR, UDAIPUR, 438, 567) !== null);

check('an honest Jaipur → Udaipur road (432 km) still passes',
  roadKmIsImpossible(432, JAIPUR, UDAIPUR, 438, 567) === null);

check('the floor still binds in the mountains — geometry is not negotiable at altitude',
  roadKmIsImpossible(20, GANGOTRI, KEDARNATH, 3056, 3549) !== null);

check('the mountain ceiling is deliberately absurd, and the plains ceiling is the founder\'s',
  ROAD_MAX_RATIO === 2.2 && ROAD_MAX_RATIO_MOUNTAIN === 12.0);

// ── US-842 — A LIE IS A PROPERTY OF AN OPTION, NOT OF A TRIP ────────────────────────────────
console.log('\nUS-842 — we decline the one service we cannot prove; we do not cancel his holiday');

// This is the real pool that made the Iron Law refuse the whole Golden Triangle.
const opts = [
  { mode: 'ROAD', identifier: null, distanceKm: 245, durationMin: 300 },        // honest
  { mode: 'RAIL', identifier: '12036 SHATABDI', distanceKm: 204, durationMin: 120 }, // 204 km across a 223 km gap
];
const { kept, dropped } = honestOptions(opts, JAIPUR, AGRA, 438, 169);
check('the impossible train is refused...', dropped.length === 1 && dropped[0].opt.mode === 'RAIL');
check('...the honest road survives, and he still gets his trip', kept.length === 1 && kept[0].mode === 'ROAD',
  'the exit gate killed the whole Golden Triangle over this one train');
check('and the reason names the geometry, in words', /CROW FLIES/.test(dropped[0].why));

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail) process.exit(1);
