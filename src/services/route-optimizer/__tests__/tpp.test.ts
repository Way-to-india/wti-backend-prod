/**
 * Sprint 4 — increment US-402 acceptance: TRAVELER PSYCHE PROFILE (TPP, spec §14).
 *
 * Proves: (0) identity — absent/neutral TPP leaves the weights and the solve exactly
 * as v1.0; (1) the modulation matrix moves the right soft weights in the right
 * direction; (2) THE MECHANISM — a budget-anxious TPP makes the solver pick the
 * cheaper option where the neutral solve picked the faster one (scalar level, then
 * solve level); (3) a comfort-first TPP raises the chosen plan's easeScore; and the
 * load-bearing (4) GUARDRAIL — NO TPP can push a solve past a body-truth HARD gate
 * (physiology.ts), proven at both the DDCV-scalar level and the full-solve level.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/tpp.test.ts
 */

import { readFileSync } from 'fs';
import { applyTPP, modulation, isNeutralTPP } from '../tpp';
import { ddcv, ddcvScalar, weightsForObjective, type LegCtx } from '../ddcv';
import { toleranceForProfile } from '../physiology';
import { solveForObjective, type OptimizeDeps } from '../optimize';
import type { CityNode, LegOption, OptimizeInput, TPP } from '../types';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`)); };
const eqW = (a: any, b: any) => (['T', 'M', 'Phi', 'Delta', 'rho', 'q'] as const).every((k) => Math.abs(a[k] - b[k]) < 1e-9);

console.log('\nSprint 4 / US-402 — Traveler Psyche Profile (TPP)\n');

const w0 = weightsForObjective('BALANCED');

// ---- (0) IDENTITY — absent/neutral TPP => weights unchanged (v1.0) -----------
check('applyTPP(w, undefined) === w (no questionnaire = v1.0)', eqW(applyTPP(w0, undefined), w0));
check('applyTPP(w, {}) === w (all dims skipped)', eqW(applyTPP(w0, {}), w0));
check('applyTPP(w, {P1:0,P5:0}) === w (explicit zeros)', eqW(applyTPP(w0, { P1: 0, P5: 0 }), w0));
check('isNeutralTPP(undefined / {} / all-zero) is true', isNeutralTPP(undefined) && isNeutralTPP({}) && isNeutralTPP({ P1: 0, P2: 0, P5: 0 }));
check('isNeutralTPP({P5:-1}) is false', isNeutralTPP({ P5: -1 }) === false);

// ---- (1) MODULATION DIRECTIONS (spec §14.2) ---------------------------------
const mBudget = modulation({ P5: -1 });   // price-first
const mComfort = modulation({ P5: 1 });   // comfort-first
const mAdv = modulation({ P2: 1 });       // adventure
const mPacker = modulation({ P1: 1 });    // packer
const mTransit = modulation({ P6: 1 });   // transit=experience
check('budget-anxious (P5<0) lifts money weight (M>1) and eases comfort (Phi<1,q<1)', mBudget.M > 1 && mBudget.Phi < 1 && mBudget.q < 1, JSON.stringify(mBudget));
check('comfort-first (P5>0) lowers money weight (M<1) and lifts comfort (Phi>1,q>1)', mComfort.M < 1 && mComfort.Phi > 1 && mComfort.q > 1, JSON.stringify(mComfort));
check('adventure (P2>0) lowers risk weight (rho<1)', mAdv.rho < 1, JSON.stringify(mAdv));
check('packer (P1>0) lifts time weight (T>1) and eases fatigue (Phi<1)', mPacker.T > 1 && mPacker.Phi < 1, JSON.stringify(mPacker));
check('transit=experience (P6>0) lowers day-damage weight (Delta<1)', mTransit.Delta < 1, JSON.stringify(mTransit));
check('every multiplier stays strictly positive + bounded [0.3,2] (no soft weight zeroed/flipped)',
  (['P1', 'P2', 'P5', 'P6'] as const).every((k) => {
    const m = modulation({ [k]: 1 } as TPP), m2 = modulation({ [k]: -1 } as TPP);
    return (['T', 'M', 'Phi', 'Delta', 'rho', 'q'] as const).every((ax) => m[ax] >= 0.3 && m[ax] <= 2 && m2[ax] >= 0.3 && m2[ax] <= 2);
  }));

// ---- (2) THE MECHANISM at the DDCV scalar level ------------------------------
// A fast, pricey FLIGHT vs a cheap, slow DAY-TRAIN on one leg. Neutral BALANCED
// prefers the faster flight; a budget-anxious TPP (w_M up) flips the choice to the
// cheaper train. This is "the mechanism" the handoff names.
const tolStd = toleranceForProfile('standard');
const flight: LegOption = { from: 'Jaipur', to: 'Mumbai', mode: 'AIR', identifier: '6E 777', distanceKm: 1150, durationMin: 105, depTime: '10:00', arrTime: '11:45', operatingDays: 127, reliability: 4, farePpMin: 7500, farePpMax: 7500, source: 'air-sched' };
const dayTrain: LegOption = { from: 'Jaipur', to: 'Mumbai', mode: 'RAIL', identifier: '19708 Day Exp', classes: ['3A'], distanceKm: 1100, durationMin: 600, depTime: '07:30', arrTime: '17:30', operatingDays: 127, reliability: 4, farePpMin: 900, farePpMax: 900, source: 'ir' };
const ctxAir: LegCtx = { tol: tolStd, pax: 2, accessFromHrs: 1.5, accessToHrs: 1.0, accessCostPp: 0 };
const ctxRail: LegCtx = { tol: tolStd, pax: 2, accessFromHrs: 0.75, accessToHrs: 0.75, accessCostPp: 0 };
const vFlight = ddcv(flight, ctxAir), vTrain = ddcv(dayTrain, ctxRail);
const wBudget = applyTPP(w0, { P5: -1 });
const sFlightN = ddcvScalar(vFlight, w0), sTrainN = ddcvScalar(vTrain, w0);
const sFlightB = ddcvScalar(vFlight, wBudget), sTrainB = ddcvScalar(vTrain, wBudget);
console.log(`    scalars neutral: flight=${sFlightN.toFixed(2)} train=${sTrainN.toFixed(2)} | budget: flight=${sFlightB.toFixed(2)} train=${sTrainB.toFixed(2)}`);
check('neutral solve prefers the FASTER flight (lower scalar)', sFlightN < sTrainN, `flight=${sFlightN.toFixed(2)} train=${sTrainN.toFixed(2)}`);
check('budget-anxious TPP flips the choice to the CHEAPER train', sTrainB < sFlightB, `flight=${sFlightB.toFixed(2)} train=${sTrainB.toFixed(2)}`);
check('the flip is caused by the TPP, not the base weights (neutral != budget ordering)', (sFlightN < sTrainN) && (sTrainB < sFlightB));

// ---- solve-level fixture -----------------------------------------------------
const nodes: CityNode[] = [
  { name: 'Delhi', coord: [28.6139, 77.2090], profile: {} },
  { name: 'Jaipur', coord: [26.9124, 75.7873], profile: {} },
  { name: 'Mumbai', coord: [19.0760, 72.8777], profile: {} },
];
const pool = new Map<string, LegOption[]>([
  ['Delhi||Jaipur', [{ from: 'Delhi', to: 'Jaipur', mode: 'ROAD', distanceKm: 280, durationMin: 300, operatingDays: 127, reliability: 5, source: 'osrm' }]],
  ['Jaipur||Mumbai', [flight, dayTrain]],
]);
const deps: OptimizeDeps = { nodes, pool };
const baseInput = (objective: OptimizeInput['objective'], tpp?: TPP): OptimizeInput => ({
  cities: [{ name: 'Delhi', nights: 1 }, { name: 'Jaipur', nights: 1 }, { name: 'Mumbai', nights: 2 }],
  start: 'Delhi', end: 'Mumbai', objective, pax: 2, profile: 'standard', tpp,
} as OptimizeInput);
const longLeg = (p: any) => p.legs.find((l: any) => l.from === 'Jaipur' && l.to === 'Mumbai');

// (2b) THREADING — the SAME plumbing at the solve level: neutral BALANCED flies,
// budget TPP rails.
const solN = solveForObjective(baseInput('BALANCED'), deps, 'BALANCED', 'neutral');
const solB = solveForObjective(baseInput('BALANCED', { P5: -1 }), deps, 'BALANCED', 'budget');
console.log(`    solve modes  neutral=${longLeg(solN)?.mode} budget=${longLeg(solB)?.mode}  ease n=${solN.totals.easeScore} b=${solB.totals.easeScore}`);
check('solve: neutral BALANCED flies the long leg', longLeg(solN)?.mode === 'AIR', `mode=${longLeg(solN)?.mode}`);
check('solve: budget-anxious TPP rails the long leg (cheaper)', longLeg(solB)?.mode === 'RAIL', `mode=${longLeg(solB)?.mode}`);

// (3) COMFORT raises easeScore — a comfort-first TPP keeps the low-fatigue flight
// that the budget solve traded away for the punishing cheap day-train, so its plan
// is measurably EASIER (higher easeScore) than the budget plan, and no worse than
// the neutral plan.
const solComfort = solveForObjective(baseInput('BALANCED', { P5: 1 }), deps, 'BALANCED', 'comfort');
const peak = (p: any) => p.rhythm?.peakF ?? 0;
console.log(`    comfort mode=${longLeg(solComfort)?.mode} ease=${solComfort.totals.easeScore} peakF=${peak(solComfort)} | budget mode=${longLeg(solB)?.mode} ease=${solB.totals.easeScore} peakF=${peak(solB)}`);
check('comfort-first TPP keeps the low-fatigue flight', longLeg(solComfort)?.mode === 'AIR', `mode=${longLeg(solComfort)?.mode}`);
check('comfort-first plan easeScore is no worse than the budget plan', solComfort.totals.easeScore >= solB.totals.easeScore, `comfort=${solComfort.totals.easeScore} budget=${solB.totals.easeScore}`);
check('comfort-first plan has a STRICTLY LOWER fatigue peak than the budget plan (bodily easier)', peak(solComfort) < peak(solB), `comfort peakF=${peak(solComfort)} budget peakF=${peak(solB)}`);
check('comfort-first plan easeScore is no worse than neutral', solComfort.totals.easeScore >= solN.totals.easeScore, `comfort=${solComfort.totals.easeScore} neutral=${solN.totals.easeScore}`);

// ---- (4) GUARDRAIL — NO TPP can breach a body-truth HARD gate ----------------
// A 650 km single-day road leg for a SENIOR party is over the hard hour cap →
// ddcv.hardBlock. A maximal comfort/ease-buying TPP must NOT make it finite.
const tolSenior = toleranceForProfile('senior');
const overCapRoad: LegOption = { from: 'Delhi', to: 'FarTown', mode: 'ROAD', distanceKm: 650, durationMin: 900, operatingDays: 127, reliability: 4, source: 'osrm' };
const vBlock = ddcv(overCapRoad, { tol: tolSenior, pax: 2, accessFromHrs: 0, accessToHrs: 0 });
const maxTPP: TPP = { P1: -1, P2: 1, P5: 1, P6: 1 };   // every "buy comfort / ease" lever at max
const wMax = applyTPP(w0, maxTPP);
check('over-cap senior road leg is a HARD block (hardBlock=true)', vBlock.hardBlock === true, vBlock.blockReasons.join('; '));
check('blocked scalar is +Infinity under the base weights', ddcvScalar(vBlock, w0) === Number.POSITIVE_INFINITY);
check('blocked scalar STAYS +Infinity under a maximal comfort-buy TPP (gate not relaxable)', ddcvScalar(vBlock, wMax) === Number.POSITIVE_INFINITY);
check('tpp.ts imports nothing from physiology (structural: applyTPP only scales Weights)',
  (() => { try { const src = readFileSync('src/services/route-optimizer/tpp.ts', 'utf8'); return !/from\s+['"][^'"]*physiology/.test(src); } catch { return true; } })());

// (4b) SOLVE-LEVEL guardrail: senior party, a leg whose ONLY option is the over-cap
// road. The plan is flagged infeasible WITH and WITHOUT a maximal TPP — identically.
const gNodes: CityNode[] = [
  { name: 'Delhi', coord: [28.6139, 77.2090], profile: {} },
  { name: 'FarTown', coord: [23.2000, 79.9500], profile: {} },
];
const gPool = new Map<string, LegOption[]>([['Delhi||FarTown', [overCapRoad]]]);
const gDeps: OptimizeDeps = { nodes: gNodes, pool: gPool };
const gInput = (tpp?: TPP): OptimizeInput => ({ cities: [{ name: 'Delhi', nights: 1 }, { name: 'FarTown', nights: 1 }], start: 'Delhi', end: 'FarTown', objective: 'BALANCED', pax: 2, profile: 'senior', tpp } as OptimizeInput);
const hasCapViolation = (p: any) => p.warnings.some((w: string) => /cap|hard-constraint/i.test(w)) || p.days.some((d: any) => (d.violations || []).length > 0);
const gNeutral = solveForObjective(gInput(), gDeps, 'BALANCED', 'g-neutral');
const gMax = solveForObjective(gInput(maxTPP), gDeps, 'BALANCED', 'g-max');
check('senior over-cap leg is flagged infeasible on the neutral solve', hasCapViolation(gNeutral), gNeutral.warnings.join(' | '));
check('a maximal comfort-buy TPP does NOT clear the body gate (still flagged)', hasCapViolation(gMax), gMax.warnings.join(' | '));

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
