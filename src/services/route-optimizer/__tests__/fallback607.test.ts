/**
 * Sprint 7 / US-607 acceptance — THE CONSULTANT'S FALLBACK. Law 4, as an algorithm.
 *
 *   "There is no airport within reach of Coorg. So I advise you to drive on to Mangalore
 *    — and fly from there. There is no direct flight, but you told me you would rather
 *    fly, and this is the way to do it."      — the founder's ruling
 *
 * The engine has just discovered (US-606) that the Coorg → Goa leg has NO honourable
 * single service. This is the moment it must stop optimising and start speaking.
 *
 * The thing being proved: the substitution is never silent, the alternative is built from
 * REAL services only, and each segment stands on its own feet (a 3.5 h drive and a 1 h
 * flight are two civilised half-days; welded into one 7-hour "leg" they are the ordeal
 * that breached his ceiling).
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/fallback607.test.ts
 */

import { consultantFallback, consultantChoose, type ConsultantCandidate, type GatewayCandidate } from '../consultant';
import { compileContract, intentFromRaw } from '../intent';
import { weightsForObjective, type LegCtx } from '../ddcv';
import { applyTPP } from '../tpp';
import { toleranceForProfile } from '../physiology';
import type { OrdealParty } from '../ordeal';
import type { LegOption } from '../types';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`)); };

console.log('\nSprint 7 / US-607 — the fallback: never a silent substitution\n');

const TEXT = 'I along with my wife wish to go on a romantic honeymoon. We want a luxury tour, so no trains or long road journeys for us. We love mountains and sea.';
const HONEYMOON = compileContract(intentFromRaw({
  pax: 2, composition: 'couple', purpose: 'honeymoon', comfortTier: 'luxury',
  modes: [
    { mode: 'rail', stance: 'refuse', qualifier: 'any', strength: 0.9 },
    { mode: 'road', stance: 'avoid', qualifier: 'long', strength: 0.8 },
  ],
  quotes: { comfortTier: 'we want a luxury tour', mode_rail: 'no trains', mode_road: 'no trains or long road journeys' },
}, TEXT));

const couple: OrdealParty = { cls: 'midage', budgetStance: 'comfort_first' };
const tol = toleranceForProfile('standard');
const w = applyTPP(weightsForObjective('BALANCED'), HONEYMOON.tpp);

// Access hours by mode — the same rule the solver uses (a flight is not a teleport).
const ctxFor = (o: LegOption): LegCtx => ({
  tol, pax: 2, month: 12,
  accessFromHrs: o.mode === 'AIR' ? 1.5 : o.mode === 'RAIL' ? 0.75 : 0,
  accessToHrs: o.mode === 'AIR' ? 1.0 : o.mode === 'RAIL' ? 0.75 : 0,
});

const NETRAVATHI: LegOption = { from: 'Coorg', to: 'Goa', mode: 'RAIL', identifier: '16346 Netravathi Exp', durationMin: 540, depTime: '18:50', arrTime: '03:50', arrDayOffset: 1, classes: ['2A', '3A'], operatingDays: 127, farePpMin: 900, farePpMax: 1400 };
const LONG_DRIVE: LegOption = { from: 'Coorg', to: 'Goa', mode: 'ROAD', distanceKm: 380, durationMin: 450, operatingDays: 127, farePpMin: 5000, farePpMax: 6000 };
const direct: ConsultantCandidate[] = [{ opt: NETRAVATHI, ctx: ctxFor(NETRAVATHI) }, { opt: LONG_DRIVE, ctx: ctxFor(LONG_DRIVE) }];

// THE REAL GATEWAY. The drive to Mangalore, and a REAL scheduled service out of it.
const DRIVE_TO_MNG: LegOption = { from: 'Coorg', to: 'Mangalore', mode: 'ROAD', distanceKm: 140, durationMin: 210, operatingDays: 127, farePpMin: 2200, farePpMax: 2800 };
const MNG_GOA_FLIGHT: LegOption = { from: 'Mangalore', to: 'Goa', mode: 'AIR', identifier: '6E 7431', durationMin: 60, depTime: '16:40', arrTime: '17:40', operatingDays: 127, reliability: 4, farePpMin: 3900, farePpMax: 4800 };
const MANGALORE: GatewayCandidate = { node: 'Mangalore', reach: DRIVE_TO_MNG, onward: [MNG_GOA_FLIGHT] };

// ---- 1. the composite is built, and it is the founder's own answer -------------------
console.log('  -- the way round the wall --');
const r = consultantFallback({ from: 'Coorg', to: 'Goa' }, direct, [MANGALORE], { contract: HONEYMOON, party: couple, weights: w, ctxFor });

check('a composite is built', r.kind === 'composite', r.kind);
check('...through Mangalore', r.composite?.gateway === 'Mangalore');
check('...reached by a drive of 3.5 h', r.composite?.reach.opt.identifier === undefined && r.composite?.reach.opt.mode === 'ROAD');
check('...and flown out on a REAL service, named', r.composite?.onward.opt.identifier === '6E 7431');

// EACH SEGMENT STANDS ON ITS OWN FEET. This is the whole reason the composite exists: as one
// welded 7-hour leg it breached his ceiling (US-606); as two honest half-days it does not.
const reachOrdeal = r.composite!.reach.ordeal.total;
const onwardOrdeal = r.composite!.onward.ordeal.total;
console.log(`     drive to Mangalore → ordeal ${reachOrdeal} (${r.composite!.reach.ordeal.band})`);
console.log(`     flight to Goa      → ordeal ${onwardOrdeal} (${r.composite!.onward.ordeal.band})`);
check('the drive is a pleasant half-day, well under his ceiling', r.composite!.reach.ordeal.band === 'pleasant');
check('the flight is comfortably within his ceiling too', onwardOrdeal <= 45);
check('neither segment is an ordeal — that is why it can be offered at all', reachOrdeal <= 45 && onwardOrdeal <= 45);

// ---- 2. THE PARAGRAPH — finding, reason, alternative. All three. ------------------------
console.log('  -- and it is SAID out loud --');
console.log(`\n     "${r.paragraph}"\n`);
check('it quotes HIS words back to him', /You told us "no trains"/.test(r.paragraph), r.paragraph);
check('1. THE FINDING — what we checked', /We checked every way to travel from Coorg to Goa/.test(r.paragraph));
check('2. THE REASON — why he cannot have what he asked for HERE', /Coorg has no airport/.test(r.paragraph));
check('3. THE ALTERNATIVE — named, concrete, real', /drive about three and a half hours to Mangalore/.test(r.paragraph) && /6E 7431/.test(r.paragraph));
check('4. THE HONOUR — it ties back to what he wanted', /you still fly, just as you preferred/.test(r.paragraph));
check('no adjective the data cannot prove — the road is not called "scenic" or "beautiful"', !/scenic|beautiful|stunning|breathtaking|charming/i.test(r.paragraph));
check('no price is ever quoted to him', !/₹|\brupee|\bfare\b|\bcost\b/i.test(r.paragraph));

// ---- 3. NOTHING IS INVENTED. No flight in the data ⇒ no flight in the plan. --------------
console.log('  -- and when the flight does not exist, we do NOT conjure one --');

// (a) the drive is long — longer than he wanted — but a body CAN do it. So we present it,
//     name its true length, name the thing he refused, and let him choose. 3.3(f).
const DRIVE_6H: LegOption = { from: 'Coorg', to: 'Goa', mode: 'ROAD', distanceKm: 330, durationMin: 390, operatingDays: 127, farePpMin: 4500, farePpMax: 5200 };
const directWithDoableDrive: ConsultantCandidate[] = [{ opt: NETRAVATHI, ctx: ctxFor(NETRAVATHI) }, { opt: DRIVE_6H, ctx: ctxFor(DRIVE_6H) }];
const NO_SERVICE: GatewayCandidate = { node: 'Mangalore', reach: DRIVE_TO_MNG, onward: [] };
const r2 = consultantFallback({ from: 'Coorg', to: 'Goa' }, directWithDoableDrive, [NO_SERVICE], { contract: HONEYMOON, party: couple, weights: w, ctxFor });
check('no scheduled service ⇒ NO composite is built (an airstrip is not a gateway)', r2.kind !== 'composite', r2.kind);
check('we present the honest alternative instead, and hand him the decision', r2.kind === 'his_call', r2.kind);
console.log(`\n     "${r2.paragraph}"\n`);
check('...and we SAY we could not do what he asked', /could not find one that keeps to what you asked for/.test(r2.paragraph));
check('...we name what is left, and how long it really is', /the drive, and it is/.test(r2.paragraph));
check('...and we say plainly that we would rather tell him than substitute in silence', /rather tell you that than quietly put you on something you asked us to avoid/.test(r2.paragraph));

// THE BUG THIS TEST CAUGHT, and it was a disgraceful one: an earlier draft relaxed the WHOLE
// contract on this path, and so it offered the man THE NETRAVATHI — the very train he had
// refused — inside a paragraph promising never to put him on something he asked us to avoid.
// A silent substitution wearing the costume of honesty is worse than the substitution alone.
// His refusal is not a ceiling to be negotiated. It is a WALL.
check('THE WALL: we offer him the DRIVE, never the train he refused', r2.hisCall?.opt.mode === 'ROAD', String(r2.hisCall?.opt.identifier));
check('...his word survives even the moment we cannot honour his preference', r2.hisCall?.opt.identifier !== '16346 Netravathi Exp');
check('...and we NAME the refused option, so that "his call" is a fully informed call', /16346 Netravathi Exp, which you asked us to avoid/.test(r2.paragraph));
// What we DID relax is only the ordeal CEILING — a matter of degree, which a consultant may
// honourably re-open ("the only drive is longer than you wanted; shall we?"). That is what
// negotiate.ts is for. The refusal is not a matter of degree.
check('what we relaxed was the CEILING (a matter of degree), not the refusal (a matter of word)', /longer than you wanted/.test(r2.paragraph));

// (b) and when even the drive is beyond what a body should do in one day, we do not lift the
//     BODY's cap either. We say so, and we offer the one honest remedy we actually have.
const r2b = consultantFallback({ from: 'Coorg', to: 'Goa' }, direct, [NO_SERVICE], { contract: HONEYMOON, party: couple, weights: w, ctxFor });
console.log(`\n     "${r2b.paragraph}"\n`);
check('a 7½ h drive is beyond the BODY cap, and the body is not ours to overrule', r2b.kind === 'none', r2b.kind);
check('...so we invent nothing, and we offer to break the journey with a night on the way', /break this journey with a night on the way/.test(r2b.paragraph));
check('...and even here, the train he refused is never quietly offered', r2b.hisCall === undefined);

// ---- 4. the composite is a CANDIDATE, not a decree ------------------------------------------
console.log('  -- a four-hour drive to an airport is not a solution, it is the same ordeal with a boarding pass --');
const FAR_DRIVE: LegOption = { from: 'Coorg', to: 'FarPort', mode: 'ROAD', distanceKm: 400, durationMin: 400, operatingDays: 127 };
const FAR_FLIGHT: LegOption = { from: 'FarPort', to: 'Goa', mode: 'AIR', identifier: '6E 999', durationMin: 55, depTime: '18:00', arrTime: '18:55', operatingDays: 127 };
const FAR: GatewayCandidate = { node: 'FarPort', reach: FAR_DRIVE, onward: [FAR_FLIGHT] };
const r3 = consultantFallback({ from: 'Coorg', to: 'Goa' }, direct, [FAR], { contract: HONEYMOON, party: couple, weights: w, ctxFor });
check('a 6½ h drive to a far airport is REFUSED by his own ceiling — no composite', r3.kind !== 'composite', r3.kind);

// And when both gateways are offered, the kinder one wins on ordeal — not on price.
const r4 = consultantFallback({ from: 'Coorg', to: 'Goa' }, direct, [FAR, MANGALORE], { contract: HONEYMOON, party: couple, weights: w, ctxFor });
check('offered both, it takes Mangalore — the honourable one, not merely the available one', r4.composite?.gateway === 'Mangalore');

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
