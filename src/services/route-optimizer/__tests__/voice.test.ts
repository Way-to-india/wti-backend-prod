/**
 * Sprint 7 / US-608 acceptance — THE VOICE, and the sentence that started all of this.
 *
 *      "overnight — saves a hotel night."
 *
 * The engine wrote that to a man who had asked for a luxury honeymoon and no trains. It sold
 * him thrift AND CONGRATULATED ITSELF IN WRITING.
 *
 * It is not enough to stop CHOOSING the overnight for him. We must stop BOASTING to him about
 * a saving he never asked for — because that boast is precisely how he learns we were not
 * listening.
 *
 * THE ACCEPTANCE, and it is a grep: for a comfort-first party, NO string containing "hotel
 * night" may be reachable ANYWHERE in a rendered plan — not in the day list, not in the
 * comfort note, not in the decision record, not in the compared-options ledger.
 *
 * And the mirror: for the budget family, every one of those sentences is TRUE and welcome,
 * and they still see it.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/voice.test.ts
 */

import { solveForObjective, type OptimizeDeps } from '../optimize';
import { compileContract, intentFromRaw } from '../intent';
import { sayRejection, spokenDuration, spokenLabel, clockProblem } from '../explain';
import type { CityNode, LegOption, OptimizeInput } from '../types';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`)); };

console.log('\nSprint 7 / US-608 — the voice: stop selling him thrift and calling it a feature\n');

// ---- 1. the rejected line, exactly as the founder wrote it --------------------------
console.log('  -- Law 5: his reason, not ours --');
const NETRAVATHI: LegOption = {
  from: 'Coorg', to: 'Goa', mode: 'RAIL', identifier: '16346 Netravathi Exp',
  durationMin: 540, depTime: '18:50', arrTime: '03:50', arrDayOffset: 1, classes: ['2A'],
};
const line = sayRejection(NETRAVATHI, { kind: 'dead_hours' }, 540);
console.log(`     ✗ ${line}`);
check('THE LINE: "Netravathi Express — nine hours, and it puts you in Goa at 3:50 in the morning."',
  line === '16346 Netravathi Exp — nine hours, and it puts you in Goa at 3:50 in the morning.', line);

const DRIVE: LegOption = { from: 'Coorg', to: 'Goa', mode: 'ROAD', distanceKm: 380, durationMin: 480 };
const driveLine = sayRejection(DRIVE, { kind: 'ceiling', ceiling: 30, ordeal: 46, qualified: 'long' }, 480);
console.log(`     ✗ ${driveLine}`);
check('THE OTHER LINE: "Driving straight to Goa — eight hours on the road, which you asked us to avoid."',
  driveLine === 'Driving straight to Goa — eight hours on the road, which you asked us to avoid.', driveLine);

check('a number a traveller must decode is a number he does not feel: 540 → "nine hours"', spokenDuration(540) === 'nine hours');
check('...210 → "about three and a half hours"', spokenDuration(210) === 'about three and a half hours');
check('...and the clock is spoken, not stamped: "3:50 in the morning"', /3:50 in the morning/.test(clockProblem(NETRAVATHI) ?? ''));
check('no rejection line may ever carry a price', !/₹|rupee|fare|cheap|cost/i.test(line + driveLine));

// ---- 2. THE GREP. A full solve, and the sentence must be unreachable. ------------------
console.log('  -- the grep: is the boast reachable for a comfort-first party? --');

// A real overnight sleeper, on a leg where it is the only service. The engine WILL choose it
// (his contract here bans nothing) — so if the praise strings were still live, they would
// certainly fire. That is the point: we are not hiding the train, we are silencing the boast.
const SLEEPER: LegOption = {
  from: 'Delhi', to: 'Varanasi', mode: 'RAIL', identifier: '12560 Shiv Ganga Exp',
  distanceKm: 760, durationMin: 690, depTime: '20:10', arrTime: '07:40', arrDayOffset: 1,
  classes: ['2A', '3A'], operatingDays: 127, reliability: 4, farePpMin: 1200, farePpMax: 1900,
};
const nodes: CityNode[] = [
  { name: 'Delhi', coord: [28.61, 77.21] },
  { name: 'Varanasi', coord: [25.32, 82.97] },
];
const deps: OptimizeDeps = { nodes, pool: new Map([['Delhi||Varanasi', [SLEEPER]]]) };

const LUXURY = compileContract(intentFromRaw({ pax: 2, comfortTier: 'luxury', composition: 'couple' }, 'we want a luxury tour'));
const FAMILY = compileContract(intentFromRaw({ pax: 4, comfortTier: 'budget', composition: 'family_kids' }, 'family of four, cheapest way please'));

const input = (contract: any, profile: any): OptimizeInput => ({
  cities: [{ name: 'Delhi', nights: 0 }, { name: 'Varanasi', nights: 2 }],
  start: 'Delhi', end: 'Varanasi', objective: 'BALANCED', pax: 2, profile,
  contract, tpp: contract?.tpp,
} as OptimizeInput);

const luxPlan = solveForObjective(input(LUXURY, 'standard'), deps, 'BALANCED', 'lux');
const famPlan = solveForObjective(input(FAMILY, 'family'), deps, 'BALANCED', 'fam');

/** Every human-readable string the plan will ever show him. */
const allProse = (p: any): string => JSON.stringify([
  p.days.map((d: any) => [d.activity, d.comfortNote, d.marker]),
  p.legs.map((l: any) => [l.note, l.decisionRecord, (l.legOptions ?? []).map((o: any) => o.note)]),
  p.warnings, p.rhythm?.headline,
]);

const luxProse = allProse(luxPlan);
const famProse = allProse(famPlan);

check('the engine really did put them both on the sleeper (so the boast HAD its chance to fire)',
  luxPlan.legs[0]?.identifier === '12560 Shiv Ganga Exp' && famPlan.legs[0]?.identifier === '12560 Shiv Ganga Exp');

check('THE GREP: "hotel night" appears NOWHERE in a comfort-first traveller\'s plan', !/hotel night/i.test(luxProse), luxProse.match(/.{0,60}hotel night.{0,40}/i)?.[0]);
check('...not in the day list', !luxPlan.days.some((d: any) => /hotel night/i.test(d.activity ?? '')));
check('...not in the comfort note', !luxPlan.days.some((d: any) => /hotel night/i.test(d.comfortNote ?? '')));
check('...not in the decision record', !luxPlan.legs.some((l: any) => /hotel night/i.test(JSON.stringify(l.decisionRecord ?? {}))));
check('...and not in the compared-options ledger', !luxPlan.legs.some((l: any) => (l.legOptions ?? []).some((o: any) => /hotel night/i.test(o.note ?? ''))));

// The train is still DESCRIBED — we do not hide it, we simply do not praise it.
check('the overnight is still named and described honestly (we hide nothing)', /overnight/i.test(luxProse));

// ---- 3. THE MIRROR — for the family, the saving is real, and they hear about it ----------
console.log('  -- and for the family who wanted it, the saving is real, and we say so --');
check('the budget family DOES see "saves a hotel night" — it is true, and it is for them', /hotel night/i.test(famProse));
check('...in their day list', famPlan.days.some((d: any) => /saves a hotel night/i.test(d.activity ?? '')));
check('...and in their comfort note', famPlan.days.some((d: any) => /save a hotel night/i.test(d.comfortNote ?? '')));

// One engine. Two minds. The same true facts, and only the one who wanted the saving is
// congratulated on it.
check('THE WHOLE POINT: same train, same night, same engine — one is praised, one is not',
  /hotel night/i.test(famProse) && !/hotel night/i.test(luxProse));

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
