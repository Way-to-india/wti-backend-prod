/**
 * Sprint 3 — Story A6 acceptance: DECISION RECORDS + legOptions (spec §10).
 *
 * Pure tests over buildLegExplain (no DB). The candidate set is ranked with the SAME
 * DDCV scalar the sequencer uses, so the tests prove BOTH:
 *   (1) the engine genuinely ranks the overnight train ahead of the flight on a
 *       far-airport corridor (door-to-door truth, §4.1/§4.5) — not just asserted; and
 *   (2) the renderer names winner + runner-up + a factual margin, and every option
 *       becomes a legOptions row with the chosen flag set.
 * Anti-hallucination: every emitted string is derived from the options' own fields.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/explain.test.ts
 */

import { buildLegExplain, optionLabel } from '../explain';
import { ddcv, ddcvScalar, weightsForObjective, type LegCtx } from '../ddcv';
import { TOLERANCE } from '../physiology';
import type { LegOption } from '../types';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

const midage = TOLERANCE.midage; // 7 h cap, red-eye tolerable

// door-to-door access per mode — a FAR airport (2.5 h in / 1.5 h out) is the whole point.
function ctxOf(o: LegOption): LegCtx {
  const a = o.mode === 'RAIL' ? { from: 0.75, to: 0.75 }
    : o.mode === 'AIR' ? { from: 2.5, to: 1.5 }
    : { from: 0, to: 0 };
  return { tol: midage, pax: 2, accessFromHrs: a.from, accessToHrs: a.to };
}

console.log('\nSprint 3 / Story A6 — decision records + legOptions\n');

// ---------------------------------------------------------------------------
// 1) Overnight train BEATS the flight on a far-airport 790 km corridor.
// ---------------------------------------------------------------------------
const train: LegOption = {
  from: 'Delhi', to: 'Varanasi', mode: 'RAIL', identifier: '12559 Shiv Ganga Exp',
  depTime: '20:30', arrTime: '06:30', arrDayOffset: 1, operatingDays: 127,
  classes: ['2A'], distanceKm: 790, durationMin: 600, farePpMin: 1400, farePpMax: 1900, reliability: 4,
};
const flight: LegOption = {
  from: 'Delhi', to: 'Varanasi', mode: 'AIR', identifier: '6E 2043',
  depTime: '11:30', arrTime: '13:00', operatingDays: 127,
  distanceKm: 790, durationMin: 90, farePpMin: 5200, farePpMax: 6800, reliability: 4,
};
const roadLong: LegOption = {
  from: 'Delhi', to: 'Varanasi', mode: 'ROAD', identifier: null,
  distanceKm: 820, durationMin: 840, operatingDays: 127, reliability: 5, // ~14 h → over the 7 h cap
};

const w = weightsForObjective('EASE');
const cands = [flight, roadLong, train];
const ranked = cands.slice().sort((a, b) => ddcvScalar(ddcv(a, ctxOf(a)), w) - ddcvScalar(ddcv(b, ctxOf(b)), w));

check('DDCV ranks the overnight train FIRST on the far-airport corridor', ranked[0] === train,
  `ranked[0]=${optionLabel(ranked[0])}`);
check('the flight is the runner-up (beats the over-cap road drive)', ranked[1] === flight,
  `ranked[1]=${optionLabel(ranked[1])}`);

const ex = buildLegExplain(ranked, ctxOf, w);
const dr = ex.decisionRecord!;
check('a decisionRecord is emitted', !!dr);
check('  winner names the overnight train + its number', /Overnight train/.test(dr.winner) && /12559/.test(dr.winner), dr.winner);
check('  runnerUp names the flight it beat', /Flight/.test(dr.runnerUp ?? '') && /6E 2043/.test(dr.runnerUp ?? ''), String(dr.runnerUp));
check('  marginText mentions the saved hotel night', /hotel night/.test(dr.marginText), dr.marginText);
check('  marginText carries the honest ₹/person margin', /₹4,350|per person cheaper|\/person cheaper/.test(dr.marginText), dr.marginText);
check('  why is the plain-voice overnight reason (sleep, no daylight lost)', /sleep|overnight|daylight/i.test(dr.why), dr.why);

check('legOptions ledger carries all three compared services', ex.legOptions.length === 3, String(ex.legOptions.length));
const chosenRows = ex.legOptions.filter((r) => r.chosen);
check('  exactly one option is flagged chosen', chosenRows.length === 1, String(chosenRows.length));
check('  the chosen row is the overnight train (freq daily, door-to-door dur, fare set)',
  chosenRows[0].chosen && chosenRows[0].freq === 'daily' && (chosenRows[0].dur ?? 0) > 0 && (chosenRows[0].fare ?? 0) > 0,
  JSON.stringify(chosenRows[0]));
const roadRow = ex.legOptions.find((r) => r.id.toString().includes('ROAD') || r.note?.includes('not usable'));
check('  the over-cap road drive is noted "not usable for this party"', !!roadRow && /not usable/.test(roadRow!.note ?? ''),
  JSON.stringify(roadRow));

// ---------------------------------------------------------------------------
// 2) A ground option BEATS a flight on door-to-door truth (short far-airport leg).
// ---------------------------------------------------------------------------
const road2: LegOption = {
  from: 'Agra', to: 'Jaipur', mode: 'ROAD', identifier: null,
  distanceKm: 240, durationMin: 300, operatingDays: 127, reliability: 5,
};
const flight2: LegOption = {
  from: 'Agra', to: 'Jaipur', mode: 'AIR', identifier: '6E 111',
  depTime: '10:00', arrTime: '11:00', operatingDays: 127,
  distanceKm: 240, durationMin: 60, farePpMin: 4000, farePpMax: 5000, reliability: 4,
};
const wB = weightsForObjective('BALANCED');
const ranked2 = [flight2, road2].slice().sort((a, b) => ddcvScalar(ddcv(a, ctxOf(a)), wB) - ddcvScalar(ddcv(b, ctxOf(b)), wB));
check('door-to-door truth ranks the 5 h road ahead of the far-airport flight', ranked2[0] === road2,
  `ranked2[0]=${optionLabel(ranked2[0])}`);
const ex2 = buildLegExplain(ranked2, ctxOf, wB);
check('  marginText states the road is quicker door-to-door', /quicker door-to-door/.test(ex2.decisionRecord!.marginText),
  ex2.decisionRecord!.marginText);
check('  why explains airport access made the flight slower', /airport/i.test(ex2.decisionRecord!.why), ex2.decisionRecord!.why);

// ---------------------------------------------------------------------------
// 3) Absent-safe: single option → runnerUp null; empty → no record.
// ---------------------------------------------------------------------------
const solo: LegOption = {
  from: 'Kochi', to: 'Munnar', mode: 'ROAD', identifier: null,
  distanceKm: 130, durationMin: 240, operatingDays: 127, reliability: 4,
};
const exSolo = buildLegExplain([solo], ctxOf, wB);
check('single-candidate leg still gets a decisionRecord', !!exSolo.decisionRecord);
check('  runnerUp is null when nothing else was compared', exSolo.decisionRecord!.runnerUp === null);
check('  marginText says "Only viable service"', /Only viable service/.test(exSolo.decisionRecord!.marginText),
  exSolo.decisionRecord!.marginText);
check('  legOptions has the one option, flagged chosen', exSolo.legOptions.length === 1 && exSolo.legOptions[0].chosen);

const exEmpty = buildLegExplain([], ctxOf, wB);
check('empty candidate set is absent-safe (no record, empty ledger)',
  exEmpty.decisionRecord === undefined && exEmpty.legOptions.length === 0);

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
