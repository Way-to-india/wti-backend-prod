/**
 * Sprint 7 / US-602 acceptance — THE PLAN CONTRACT.
 *
 * Two things are proved here, and the second is load-bearing for the whole sprint:
 *
 *  1. COMPILATION (Law 2). A refusal's QUALIFIER decides its machinery. "No trains" is a
 *     filter — the mode leaves the pool. "No LONG road journeys" is a CEILING — it bans
 *     the eight-hour drive and blesses the three-hour one through Mysuru, because what
 *     the traveller refused was the ordeal, not the rolling stock.
 *
 *  2. NON-RELAXABILITY (Law 2's guardrail). `tightened()` is fuzzed against random body
 *     tolerances and random — including HOSTILE — tightenings. It must NEVER return a
 *     tolerance looser than the body's own, on any field, ever. Intent may make the
 *     traveller's day harder. It can never make it kinder.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/contract.test.ts
 */

import { readFileSync } from 'fs';
import {
  compileContract, tightened, intentFromRaw, buildEcho, CEILING,
  type Tightening, type TravellerIntent, type RawIntent,
} from '../intent';
import { TOLERANCE, type Tolerance } from '../physiology';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`)); };

console.log('\nSprint 7 / US-602 — the contract: his words, compiled\n');

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
const honeymoon = intentFromRaw(RAW, TEXT);
const C = compileContract(honeymoon);

// ---- 1. the two speech acts compile to two different machines -------------------
console.log('  -- Law 2: the mode is not the point, the ordeal is --');
check('"no trains" → a FILTER: RAIL leaves the candidate pool', C.filters.banModes.includes('RAIL'), JSON.stringify(C.filters));
check('"no long road journeys" → NOT a filter: ROAD stays in the pool', !C.filters.banModes.includes('ROAD'));
check('...it becomes a CEILING on the ROAD ordeal instead', C.tighten.perModeOrdealCeiling?.ROAD === CEILING.LONG_REFUSED, JSON.stringify(C.tighten));
check('a rail refusal also kills the overnight (the flag that used to lie)', C.filters.banOvernightRail);

// ---- 2. the comfort-first surgery (Law 3) -----------------------------------------
console.log('  -- Law 3: a marginal saving may never buy his discomfort --');
check('the hotel-night reward is DELETED for a luxury party (not down-weighted)', C.rewardSwitches.hotelNightSaving === false);
check('money is demoted to a tiebreak', C.moneyRule === 'tiebreak_only');
check('the dead-hours gate is switched ON', C.tighten.deadHoursArrival === true);
check('no single leg may be an ordeal (leg ceiling 45)', C.tighten.legOrdealCeiling === CEILING.COMFORT_FIRST_LEG);
check('the comfort dial P5 is finally turned (it was built and wired to nothing)', (C.tpp.P5 ?? 0) >= 0.9 - 1e-9);
check('honeymoon compiles to solitude over crowds (P4 < 0)', (C.tpp.P4 ?? 0) < 0);
check('we will address him as a person: "you and your wife"', C.voice.partyWords === 'you and your wife', C.voice.partyWords);

// A price-first family is the SAME engine, honest for a different mind.
const budget = intentFromRaw({ pax: 4, composition: 'family_kids', comfortTier: 'budget', profile: 'family' }, 'we are a family of four on a tight budget');
const B = compileContract(budget);
check('a BUDGET family keeps the hotel-night reward — the overnight train is genuinely right for them', B.rewardSwitches.hotelNightSaving === true);
check('...and money stays a normal term in their objective', B.moneyRule === 'normal');
check('...and no dead-hours gate is imposed on a mind that did not ask for it', B.tighten.deadHoursArrival === undefined);
check('...and their money weight is lifted (P5 < 0)', (B.tpp.P5 ?? 0) < 0);

// ---- 3. THE GUARDRAIL: loosening is not expressible, and not reachable --------------
console.log('  -- the lock: intent may tighten the body. It may never loosen it. --');

// (a) the type itself. `deadHoursArrival` is the literal `true` — the line below is the
//     wish "switch the gate off for this rich customer", and it does not compile:
//        const evil: Tightening = { deadHoursArrival: false };
//     There is no `hardCapHrsRaise` field either. The wish has no home in the type.
const src = readFileSync(new URL('../intent.ts', import.meta.url), 'utf8');
check('intent.ts imports NOTHING from physiology.ts (structural, like tpp.ts)', !/from '\.\/physiology'/.test(src));
check('deadHoursArrival is the literal true — "false" is not a value it can hold', /deadHoursArrival\?: true;/.test(src));

// (b) the merge. Fuzz it with hostile values: 99-hour driving days, 4 a.m. arrival
//     ceilings, midnight starts. The body must win every single time.
const BODIES: Tolerance[] = Object.values(TOLERANCE);
const rnd = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
let looser = 0, tried = 0, tightenedSomething = 0;
for (let i = 0; i < 20000; i++) {
  const base = BODIES[i % BODIES.length];
  // deliberately hostile: mostly values that WOULD loosen the gate if the merge let them
  const t: Tightening = {
    ...(Math.random() < 0.8 ? { hardCapHrs: rnd(-50, 99) } : {}),
    ...(Math.random() < 0.8 ? { latestArrivalMin: rnd(-600, 2880) } : {}),
    ...(Math.random() < 0.8 ? { earliestStartMin: rnd(-600, 1440) } : {}),
    ...(Math.random() < 0.3 ? { deadHoursArrival: true as const } : {}),
  };
  const out = tightened(base, t);
  tried++;
  // "looser" = the body would allow LESS than the merged tolerance does.
  if (out.hardCapHrs > base.hardCapHrs + 1e-9) looser++;
  if (out.latestArrivalMin > base.latestArrivalMin + 1e-9) looser++;
  if (out.earliestStartMin < base.earliestStartMin - 1e-9) looser++;
  if (out.hardCapHrs < base.hardCapHrs || out.latestArrivalMin < base.latestArrivalMin || out.earliestStartMin > base.earliestStartMin) tightenedSomething++;
}
check(`fuzz ×${tried}: a tightening NEVER returns a looser tolerance, on any field`, looser === 0, `${looser} breaches`);
check('...and the merge is not simply inert — it does tighten when asked to', tightenedSomething > 0);
check('an absent tightening returns the body untouched', tightened(TOLERANCE.elderly, undefined) === TOLERANCE.elderly);
check('a 99-hour driving day request gives back the elderly 5.0 h cap, unmoved', tightened(TOLERANCE.elderly, { hardCapHrs: 99 }).hardCapHrs === TOLERANCE.elderly.hardCapHrs);
check('a "you may arrive at 4 a.m." request cannot raise the arrival ceiling', tightened(TOLERANCE.family, { latestArrivalMin: 4 * 60 }).latestArrivalMin === 4 * 60);
check('...because it can only CLAMP DOWN — 4 a.m. is stricter than 19:00, so it is honoured', tightened(TOLERANCE.family, { latestArrivalMin: 4 * 60 }).latestArrivalMin < TOLERANCE.family.latestArrivalMin);

// ---- 4. the echo panel cannot put words in his mouth ---------------------------------
const echo = buildEcho(honeymoon);
const byKey = (k: string) => echo.find((r) => r.key === k);
check('the echo panel carries his purpose as "you said", with his quote', byKey('purpose')?.provenance === 'he_said' && !!byKey('purpose')?.quote);
check('the month is shown as "we need it", not guessed', byKey('month')?.provenance === 'we_need_it', JSON.stringify(byKey('month')));
check('every echo row labelled he_said carries the quote that earns the label', echo.every((r) => r.provenance !== 'he_said' || !!r.quote));
check('the refusals appear in the panel, in his own words', !!byKey('mode_rail')?.quote);

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
