/**
 * Sprint 7 / US-606 acceptance — THE CONSULTANT'S COURT, AND LAW 3, MACHINE-CHECKED.
 *
 *   "A marginal saving may never buy a traveller's discomfort. Not by a rupee. Not ever."
 *
 * That sentence is on the wall. This file is what makes it a fact about the software.
 *
 * THE PROPERTY (the important test in this sprint, and possibly in the engine):
 *   take any set of candidates; find the winner for a comfort-first traveller; then make
 *   EVERY option in a worse ordeal band COMPLETELY FREE — fare zero, a gift — and solve
 *   again. THE WINNER MUST NOT CHANGE. Not once. Fuzzed thousands of times.
 *
 *   And the same mutation, for a price-first family, MUST sometimes change the winner —
 *   otherwise the test is vacuous and money never mattered to anyone.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/consultant.test.ts
 */

import { consultantChoose, isLegitimateOverride, isBetrayal, type ConsultantCandidate } from '../consultant';
import { compileContract, intentFromRaw } from '../intent';
import { ddcv, weightsForObjective, type LegCtx } from '../ddcv';
import { applyTPP } from '../tpp';
import { toleranceForProfile } from '../physiology';
import { ordeal, BAND_EPS, type OrdealParty } from '../ordeal';
import type { LegOption } from '../types';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`)); };

console.log('\nSprint 7 / US-606 — the lexicographic court: money goes last\n');

const TEXT = 'I along with my wife wish to go on a romantic honeymoon. We want a luxury tour, so no trains or long road journeys for us. We love mountains and sea.';
const HONEYMOON = compileContract(intentFromRaw({
  pax: 2, composition: 'couple', purpose: 'honeymoon', comfortTier: 'luxury',
  modes: [
    { mode: 'rail', stance: 'refuse', qualifier: 'any', strength: 0.9 },
    { mode: 'road', stance: 'avoid', qualifier: 'long', strength: 0.8 },
  ],
  quotes: { comfortTier: 'we want a luxury tour', mode_rail: 'no trains', mode_road: 'no trains or long road journeys' },
}, TEXT));
const BUDGET = compileContract(intentFromRaw({ pax: 4, composition: 'family_kids', comfortTier: 'budget' }, 'family of four, cheapest way please'));

const couple: OrdealParty = { cls: 'midage', budgetStance: 'comfort_first' };
const family: OrdealParty = { cls: 'family', budgetStance: 'price_first' };
const tolStd = toleranceForProfile('standard');
const tolFam = toleranceForProfile('family');

const ctxFor = (tol: any, pax: number): LegCtx => ({ tol, pax, month: 12 });

// ---- the real leg that produced the law: Coorg → Goa ------------------------------
const NETRAVATHI: LegOption = {
  from: 'Coorg', to: 'Goa', mode: 'RAIL', identifier: '16346 Netravathi Exp',
  durationMin: 540, depTime: '18:50', arrTime: '03:50', arrDayOffset: 1,
  classes: ['2A', '3A', 'SL'], operatingDays: 127, reliability: 4,
  farePpMin: 900, farePpMax: 1400,                 // cheap. That was its whole case.
};
const LONG_DRIVE: LegOption = {
  from: 'Coorg', to: 'Goa', mode: 'ROAD', distanceKm: 380, durationMin: 450,
  operatingDays: 127, farePpMin: 5000, farePpMax: 6000,
};
const FLY_VIA_MANGALORE: LegOption = {
  from: 'Coorg', to: 'Goa', mode: 'AIR', identifier: '6E MNG-GOI',
  durationMin: 60, depTime: '17:30', arrTime: '18:30', operatingDays: 127, reliability: 4,
  farePpMin: 4500, farePpMax: 5500,
};

const legCoorgGoa = (tol: any, pax: number): ConsultantCandidate[] => [
  { opt: NETRAVATHI, ctx: ctxFor(tol, pax) },
  { opt: LONG_DRIVE, ctx: ctxFor(tol, pax) },
  // the flight is reached by a 3.5 h drive to Mangalore — charged honestly as access
  { opt: FLY_VIA_MANGALORE, ctx: { ...ctxFor(tol, pax), accessFromHrs: 3.5, accessCostPp: 2500 } },
];

const wCouple = applyTPP(weightsForObjective('BALANCED'), HONEYMOON.tpp);
const wFamily = applyTPP(weightsForObjective('COST'), BUDGET.tpp);

// ---- 1. the honeymooner's leg, judged --------------------------------------------
console.log('  -- the leg that produced the law --');
const choice = consultantChoose(legCoorgGoa(tolStd, 2), { contract: HONEYMOON, party: couple, weights: wCouple });

// THE COURT'S ANSWER IS: "I CANNOT DO THIS LEG HONOURABLY IN ONE SERVICE." And that is the
// correct answer — it is the founder's own finding, reached by the procedure. Every single
// candidate on this leg is refused, each for its own reason:
//   - the train, by HIS WORD;
//   - the 7.5 h drive, by HIS BODY (the midage 7 h road cap) before his ceiling even applies;
//   - and "fly from Coorg", taken as ONE service, means a 3.5 h drive + check-in + the hop:
//     7.25 hours door to door, an ordeal of 60. It breaches the very comfort ceiling he set.
//
// So there IS no honourable single leg here. Coorg has no airport. That is not a bug: it is
// the exact moment the consultant must stop optimising and start SPEAKING — and it is what
// US-607 does, by splitting it into two honest segments (drive 17, flight 31), each of which
// sits comfortably inside his ceilings. The engine has to find the wall before it can go
// round it.
check('the court finds NO honourable single service on this leg — Coorg has no airport', choice.infeasible === true);
check('...and it does not invent one, and does not sneak the train back in', choice.winner === null);
check('every candidate is accounted for, with a reason (nothing vanishes in silence)', choice.rejected.length === 3, String(choice.rejected.length));

const netraRej = choice.rejected.find((r) => r.opt.identifier === '16346 Netravathi Exp');
const driveRej = choice.rejected.find((r) => r.opt.mode === 'ROAD');
const flyRej = choice.rejected.find((r) => r.opt.mode === 'AIR');
for (const r of choice.rejected) console.log(`     ✗ ${r.reason}`);

check('the train is rejected on HIS WORD, not on a score', netraRej?.cause.kind === 'refused_mode', JSON.stringify(netraRej?.cause));
check('THE BODY OUTRANKS THE BRIEF: the 7.5 h drive is stopped by the road cap (level 0), not by his ceiling (level 2)', driveRej?.cause.kind === 'body');
check('"flying from Coorg" as one service breaches the comfort ceiling HE set — 7¼ hours door to door', flyRej?.cause.kind === 'ceiling', JSON.stringify(flyRej?.cause));
check('NO rejection mentions money, a score, or a weight', choice.rejected.every((r) => !/₹|rupee|cost|cheaper|score|scalar|weight/i.test(r.reason)));

// ---- 1b. a leg where he CAN be served — and the dearest option wins ------------------
console.log('  -- and where an honourable option exists, the purse does not decide --');
// Goa → Bengaluru. A direct flight (dear, easy) against a cheap night train (his refusal
// aside, an ordeal). The flight costs four times as much. It wins anyway.
const HOME_FLIGHT: LegOption = {
  from: 'Goa', to: 'Bengaluru', mode: 'AIR', identifier: '6E GOI-BLR',
  durationMin: 75, depTime: '11:20', arrTime: '12:35', operatingDays: 127, reliability: 4,
  farePpMin: 4200, farePpMax: 5000,
};
const HOME_NIGHT_TRAIN: LegOption = {
  from: 'Goa', to: 'Bengaluru', mode: 'RAIL', identifier: '17310 Vasco Exp',
  durationMin: 870, depTime: '18:20', arrTime: '08:50', arrDayOffset: 1,
  classes: ['2A', '3A', 'SL'], operatingDays: 127, reliability: 4,
  farePpMin: 800, farePpMax: 1200,
};
// Judged WITHOUT any mode ban, so nothing but the ordering is doing the work.
const openContract = compileContract(intentFromRaw({ pax: 2, comfortTier: 'luxury' }, 'we want a luxury tour'));
const home = consultantChoose(
  [{ opt: HOME_FLIGHT, ctx: ctxFor(tolStd, 2) }, { opt: HOME_NIGHT_TRAIN, ctx: ctxFor(tolStd, 2) }],
  { contract: openContract, party: couple, weights: wCouple },
);
check('the flight wins for the honeymooner', home.winner?.opt.identifier === '6E GOI-BLR', String(home.winner?.opt.identifier));
check('...at roughly four times the fare of the train it beat', (home.winner?.farePp ?? 0) > 4000);
check('...and it wins on COMFORT, in a better ordeal band — not on price', (home.winner?.band ?? 99) < Math.floor(ordeal(HOME_NIGHT_TRAIN, couple, { doorToDoorHrs: ddcv(HOME_NIGHT_TRAIN, ctxFor(tolStd, 2)).T }).total / BAND_EPS));

// The same two services, for the family who asked for cheap. The train is now the RIGHT
// answer, and the engine says so. One engine. Two minds. Two honest answers.
const homeFamily = consultantChoose(
  [{ opt: HOME_FLIGHT, ctx: ctxFor(tolFam, 4) }, { opt: HOME_NIGHT_TRAIN, ctx: ctxFor(tolFam, 4) }],
  { contract: BUDGET, party: family, weights: wFamily },
);
check('for the budget family, the overnight train wins — and it is genuinely their best answer', homeFamily.winner?.opt.identifier === '17310 Vasco Exp', String(homeFamily.winner?.opt.identifier));

// ---- 2. LAW 3, MACHINE-CHECKED: a free ordeal still loses ------------------------------
console.log('  -- "not by a rupee, not ever" — fuzzed --');

const rnd = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

function randomLeg(i: number): LegOption {
  const mode = pick(['ROAD', 'AIR', 'RAIL'] as const);
  const dur = Math.round(rnd(45, 700));
  const depH = Math.floor(rnd(0, 24)), arrH = Math.floor(rnd(0, 24));
  return {
    from: 'A', to: 'B', mode, identifier: `${mode}-${i}`,
    durationMin: dur, distanceKm: Math.round(dur * rnd(0.8, 1.6)),
    depTime: `${String(depH).padStart(2, '0')}:00`,
    arrTime: `${String(arrH).padStart(2, '0')}:${pick(['00', '30', '50'])}`,
    arrDayOffset: Math.random() < 0.3 ? 1 : 0,
    classes: mode === 'RAIL' ? pick([['2A', '3A'], ['SL'], ['CC']]) : undefined,
    operatingDays: 127, reliability: 4,
    farePpMin: Math.round(rnd(300, 9000)), farePpMax: Math.round(rnd(300, 9000)),
  };
}

// A contract with NO mode bans, so that the ONLY thing standing between the traveller and
// a cheap ordeal is the lexicographic order itself. No filter to hide behind.
const PURE_COMFORT = compileContract(intentFromRaw({ pax: 2, comfortTier: 'luxury' }, 'we want a luxury tour'));
check('the fuzz contract bans no mode — the ordering must do ALL the work', PURE_COMFORT.filters.banModes.length === 0);
check('...and it demotes money to a tiebreak', PURE_COMFORT.moneyRule === 'tiebreak_only');

let trials = 0, changed = 0, bribeable = 0, deeplyBribeable = 0;
for (let t = 0; t < 4000; t++) {
  const cands: ConsultantCandidate[] = Array.from({ length: 2 + Math.floor(Math.random() * 4) }, (_, i) => ({
    opt: randomLeg(i), ctx: ctxFor(tolStd, 2),
  }));

  const before = consultantChoose(cands, { contract: PURE_COMFORT, party: couple, weights: wCouple });
  if (!before.winner) continue;
  trials++;

  // THE BRIBE. Every option in a WORSE ordeal band is made free — a gift, zero rupees.
  // If money can buy discomfort anywhere in this engine, it buys it here.
  const winnerBand = before.winner.band;
  const bribed: ConsultantCandidate[] = cands.map((c) => {
    const ord = ordeal(c.opt, couple, { doorToDoorHrs: ddcv(c.opt, c.ctx).T });
    const band = Math.floor(ord.total / BAND_EPS);
    if (band > winnerBand) { bribeable++; return { ...c, opt: { ...c.opt, farePpMin: 0, farePpMax: 0 } }; }
    return c;
  });

  const after = consultantChoose(bribed, { contract: PURE_COMFORT, party: couple, weights: wCouple });
  const same = after.winner?.opt.identifier === before.winner.opt.identifier;
  if (!same) changed++;
  if (bribeable > 0) deeplyBribeable++;
}
check(`fuzz ×${trials}: making every worse-comfort option FREE never changed the winner`, changed === 0, `${changed} betrayals`);
check('...and the fuzz was not vacuous — there were cheaper-but-worse options to be tempted by', bribeable > 0, `${bribeable} bribes offered`);

// The mirror image: for the family who ASKED for cheap, money must genuinely matter.
// Otherwise we have not demoted money — we have simply broken it.
let familyChanged = 0, familyTrials = 0;
for (let t = 0; t < 4000 && familyChanged === 0; t++) {
  const cands: ConsultantCandidate[] = Array.from({ length: 3 }, (_, i) => ({ opt: randomLeg(i), ctx: ctxFor(tolFam, 4) }));
  const before = consultantChoose(cands, { contract: BUDGET, party: family, weights: wFamily });
  if (!before.winner) continue;
  familyTrials++;
  const bribed = cands.map((c) => (c.opt.identifier === before.winner!.opt.identifier ? c : { ...c, opt: { ...c.opt, farePpMin: 0, farePpMax: 0 } }));
  const after = consultantChoose(bribed, { contract: BUDGET, party: family, weights: wFamily });
  if (after.winner?.opt.identifier !== before.winner.opt.identifier) familyChanged++;
}
check('for the price-first family, money DOES move the answer (we demoted it, we did not break it)', familyChanged > 0);

// ---- 3. the override asymmetry — the crux, as a function -----------------------------
console.log('  -- the crux: when may we overrule him? --');
// The founder's own case. The Mysuru road (ordeal 13) vs the air composite (ordeal ~48).
const road = { ordeal: 13, farePp: 4000 };
const air = { ordeal: 48, farePp: 6000 };
check('overriding "prefer to fly" with the Mysuru road is LEGITIMATE — it serves him MORE', isLegitimateOverride(road, air, false, true));
check('...but only if we ANNOUNCE it. In silence it is not an override, it is a switch.', !isLegitimateOverride(road, air, false, false));
check('...and never if it breaches a word he actually said', !isLegitimateOverride(road, air, true, true));
check('a whisker of comfort does not earn an override — it must be a whole band better', !isLegitimateOverride({ ordeal: 45, farePp: 1 }, air, false, true));

// The Netravathi, tested as the founder tested it.
const train = { ordeal: 214, farePp: 1150 };
const flight = { ordeal: 48, farePp: 5000 };
check('putting him on the Netravathi is a BETRAYAL — no kinder, only cheaper', isBetrayal(train, flight, 'tiebreak_only'));
check('...and for the budget family the very same swap is NOT a betrayal — it is the service they asked for', !isBetrayal(train, flight, 'normal'));

// ---- 4. the reward that wore a costume (F4) ---------------------------------------------
console.log('  -- F4: the hotel-night bonus, deleted rather than down-weighted --');
const SLEEPER: LegOption = { from: 'A', to: 'B', mode: 'RAIL', identifier: '17416 Haripriya', durationMin: 615, depTime: '22:00', arrTime: '08:15', arrDayOffset: 1, classes: ['2A'], operatingDays: 127 };
const qPaid = ddcv(SLEEPER, { tol: tolStd, pax: 2 }).q;
const qDeleted = ddcv(SLEEPER, { tol: tolStd, pax: 2, rewardHotelNightSaving: false }).q;
check('the overnight bonus is PAID by default (the budget family earns it)', qPaid >= 1.0);
check('...and DELETED for a comfort-first party — not scaled, deleted', qDeleted <= qPaid - 1.0, `${qPaid} → ${qDeleted}`);
check('the deletion is what stops the LUXURY dial amplifying a thrift reward by 1.3', qDeleted < qPaid);

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
