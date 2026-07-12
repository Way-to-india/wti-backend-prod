/**
 * Sprint 7 / US-603 acceptance — THE DEAD HOURS. This is THE regression test of the
 * sprint, and it is named after the train that earned it.
 *
 * 16346 Netravathi Express. Nine hours. Arrives in Goa at 03:50. It was sold to a
 * honeymooner who had asked for a luxury tour and no trains, and the engine wrote him a
 * compliment about it: "overnight — saves a hotel night."
 *
 * It got through because of a hole between two gates (F3):
 *   arrivesTooLate(arrMin=230, latestArrival=1320)  →  230 > 1320  →  FALSE.
 * The gate looked at a 3:50 a.m. arrival and read it as a pleasantly early one. The window
 * [midnight → the civil start) on the ARRIVAL clock belonged to no gate at all.
 *
 * What is proved here:
 *   1. the hole was real (the old gate genuinely passes 03:50 — we assert it, we do not
 *      take it on trust);
 *   2. the new gate closes it for a comfort-first party — INADMISSIBLE, not expensive;
 *   3. it stays SHUT under a maximal comfort-buy TPP (a gate is not a price);
 *   4. it does NOT fire for the budget family who WANTS the cheap overnight train — the
 *      same engine, honest for a different mind;
 *   5. the refusal speaks HIS reason ("it puts you in Goa at 3:50 in the morning"),
 *      written at the moment of rejection.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/deadhours.test.ts
 */

import { ddcv, ddcvScalar, chooseByDDCV, weightsForObjective, type LegCtx } from '../ddcv';
import { applyTPP } from '../tpp';
import {
  arrivesInDeadHours, arrivesTooLate, toleranceForProfile, TOLERANCE,
} from '../physiology';
import { compileContract, intentFromRaw, type Tightening } from '../intent';
import type { LegOption, TPP } from '../types';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`)); };

console.log('\nSprint 7 / US-603 — the dead hours: the gate that was not there\n');

// The train itself. Real service, real times — nothing invented.
const NETRAVATHI: LegOption = {
  from: 'Coorg', to: 'Goa', mode: 'RAIL', identifier: '16346 Netravathi Exp',
  distanceKm: 340, durationMin: 540,          // nine hours
  depTime: '18:50', arrTime: '03:50', arrDayOffset: 1,
  classes: ['2A', '3A', 'SL'], operatingDays: 127, reliability: 4,
};
// The alternative that costs more and treats him like a human being.
const FLIGHT: LegOption = {
  from: 'Mangalore', to: 'Goa', mode: 'AIR', identifier: '6E MNG-GOI',
  distanceKm: 300, durationMin: 60, depTime: '17:30', arrTime: '18:30',
  operatingDays: 127, reliability: 4, farePpMin: 4200, farePpMax: 5200,
};

const tol = toleranceForProfile('standard');   // midage: the honeymooning couple
const base = (t?: Tightening): LegCtx => ({ tol, pax: 2, month: 12, tighten: t });

// ---- 1. THE HOLE WAS REAL ---------------------------------------------------------
console.log('  -- the hole, asserted rather than assumed --');
check('the OLD gate passes a 3:50 a.m. arrival (230 > 1320 is false — this is the bug)', arrivesTooLate(230, tol) === false);
check('...and it would have passed it for an ELDERLY party too', arrivesTooLate(230, TOLERANCE.elderly) === false);
check('the NEW gate sees it', arrivesInDeadHours(230) === true);
check('the dead-hours window wraps midnight: 23:30 is in it', arrivesInDeadHours(23 * 60 + 30) === true);
check('06:59 is still the dead hours', arrivesInDeadHours(6 * 60 + 59) === true);
check('07:00 is morning — the gate lets go', arrivesInDeadHours(7 * 60) === false);
check('a civilised 18:30 arrival is untouched', arrivesInDeadHours(18 * 60 + 30) === false);

// ---- 2. THE COMFORT-FIRST PARTY: INADMISSIBLE, NOT EXPENSIVE -----------------------
console.log('  -- the honeymooner: the train is now refused, not priced --');
const TEXT = 'I along with my wife wish to go on a romantic honeymoon. We want a luxury tour, so no trains or long road journeys for us. We love mountains and sea.';
const contract = compileContract(intentFromRaw({
  pax: 2, composition: 'couple', purpose: 'honeymoon', comfortTier: 'luxury',
  modes: [{ mode: 'rail', stance: 'refuse', qualifier: 'any', strength: 0.9 }],
  quotes: { comfortTier: 'we want a luxury tour', mode_rail: 'no trains' },
}, TEXT));

const vBefore = ddcv(NETRAVATHI, base());                    // no contract = today's engine
const vAfter = ddcv(NETRAVATHI, base(contract.tighten));     // his contract applied

check('BEFORE: the engine finds the 03:50 train perfectly usable', vBefore.hardBlock === false, vBefore.blockReasons.join('; '));
check('AFTER: it is HARD-BLOCKED for a comfort-first party', vAfter.hardBlock === true, JSON.stringify(vAfter.blockReasons));
check('the blocked scalar is +Infinity — no weight can buy it back', !Number.isFinite(ddcvScalar(vAfter, weightsForObjective('COST'))));

// A gate is not a price. Turn every comfort dial to the maximum and try to buy it off.
const maxComfort: TPP = { P1: 1, P2: 1, P3: 1, P4: 1, P5: 1, P6: 1, P7: 1 };
const bought = ddcvScalar(vAfter, applyTPP(weightsForObjective('EASE'), maxComfort));
check('a maximal comfort-buy TPP still cannot make it finite (gate, not weight)', !Number.isFinite(bought));

// ---- 3. HIS REASON, NOT OURS (Law 5) ------------------------------------------------
console.log('  -- Law 5: he gets HIS reason, at the moment of refusal --');
const reason = vAfter.blockReasons.find((r) => /3:50/.test(r));
check('the refusal names the hour, in his words: "it puts you in Goa at 3:50 in the morning"', reason === 'it puts you in Goa at 3:50 in the morning', JSON.stringify(vAfter.blockReasons));
check('the reason speaks of HIM, not of scores — no "cost", no "scalar", no "weight"', !!reason && !/cost|scalar|weight|score|penalt/i.test(reason));

// ---- 4. THE BUDGET FAMILY: THE SAME ENGINE, HONEST FOR A DIFFERENT MIND ---------------
console.log('  -- and for the mind that WANTS the overnight train, nothing changed --');
const budget = compileContract(intentFromRaw({ pax: 4, composition: 'family_kids', comfortTier: 'budget' }, 'family of four, tight budget, cheapest way please'));
const vBudget = ddcv(NETRAVATHI, { ...base(budget.tighten), tol: toleranceForProfile('family') });
check('no dead-hours gate is imposed on a party that never asked for one', budget.tighten.deadHoursArrival === undefined);
check('the overnight train stays ADMISSIBLE for them (it is genuinely their best answer)', vBudget.hardBlock === false, vBudget.blockReasons.join('; '));

// ---- 5. THE CHOICE THE TRAVELLER ACTUALLY GETS ----------------------------------------
console.log('  -- the leg, solved both ways --');
const cands = (t?: Tightening) => [
  { opt: NETRAVATHI, ctx: base(t) },
  { opt: FLIGHT, ctx: { ...base(t), accessFromHrs: 3.5, accessCostPp: 2500 } },  // the drive to Mangalore
];
// COST weights are the hardest possible test: they are the weights that loved the train.
const cheapWeights = weightsForObjective('COST');
const before = chooseByDDCV(cands(), cheapWeights);
const after = chooseByDDCV(cands(contract.tighten), cheapWeights);
check('BEFORE: on cost weights the engine picks the 03:50 train (the failure, reproduced)', before.winner?.opt.identifier === '16346 Netravathi Exp', String(before.winner?.opt.identifier));
check('AFTER: the same cost weights can no longer reach it — the flight wins', after.winner?.opt.identifier === '6E MNG-GOI', String(after.winner?.opt.identifier));
check('...and the train is still listed, so we can tell him WHY we set it aside', after.ranked.some((r) => r.opt.identifier === '16346 Netravathi Exp' && r.v.hardBlock));

// ---- 6. THE BODY'S OWN GATES ARE UNTOUCHED ---------------------------------------------
check('the body gates still refuse what they always refused (over-cap senior road day)', ddcv(
  { from: 'A', to: 'B', mode: 'ROAD', distanceKm: 600, durationMin: 660 },
  { tol: TOLERANCE.elderly, pax: 2 },
).hardBlock === true);

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
