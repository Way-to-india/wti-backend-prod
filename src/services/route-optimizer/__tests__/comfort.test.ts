/**
 * Sprint 3 — increment 2 acceptance: PER-DAY COMFORT FIELDS (spec §7).
 *
 * Pure tests over projectComfort / rhythmHeadline + one live optimize() integration
 * proving exp.days carry fatigue/effort/comfortNote/marker and plan.rhythm.headline
 * names the party cap. Facts-only, additive.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/comfort.test.ts
 */

import { projectComfort, rhythmHeadline, dailyLoadCap, type DayLoad, type LedgerResult } from '../fatigue';
import { TOLERANCE } from '../physiology';
import { optimize } from '../optimize';
import type { CityNode, LegOption, OptimizeInput } from '../types';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`)); };

const elderly = TOLERANCE.elderly; // comfortableHrs 4.5, hardCap 5, ageFactor 1.35
const cap = dailyLoadCap(elderly);

console.log('\nSprint 3 / inc-2 — per-day comfort fields\n');

// ---- pure projection ------------------------------------------------------
const dayLoads: DayLoad[] = [
  { load: 0,           vehicleHrs: 0, hasTransit: false, label: 'Delhi' },                    // arrival / rest
  { load: 0.9 * cap,   vehicleHrs: 6, hasTransit: true,  label: 'Delhi→Jaipur' },             // heavy road (longest)
  { load: 1.4,         vehicleHrs: 0, hasTransit: true,  overnight: true, label: 'Jaipur→Varanasi' }, // overnight rail
  { load: 0.2 * cap,   vehicleHrs: 2, hasTransit: true,  label: 'Varanasi→Sarnath' },         // light hop
];
const days = [
  { city: 'Delhi', transit: null },
  { city: 'Jaipur', transit: { from: 'Delhi', to: 'Jaipur' } },
  { city: 'Varanasi', transit: { from: 'Jaipur', to: 'Varanasi' } },
  { city: 'Sarnath', transit: { from: 'Varanasi', to: 'Sarnath' } },
];
const c = projectComfort(dayLoads, days, elderly);

check('rest day → fatigue "easy" + marker "Rest day"', c[0].fatigue === 'easy' && c[0].marker === 'Rest day', JSON.stringify(c[0]));
check('heavy road day → fatigue "full"', c[1].fatigue === 'full', JSON.stringify(c[1]));
check('  heavy day effort is high (>80)', c[1].effort > 80, String(c[1].effort));
check('  the heavy road day is tagged the longest drive', /Longest drive/.test(c[1].marker ?? ''), c[1].marker);
check('overnight day → fatigue "easy" + marker "Overnight train"', c[2].fatigue === 'easy' && c[2].marker === 'Overnight train', JSON.stringify(c[2]));
check('  overnight comfortNote mentions sleeping / hotel night', /sleep|hotel night/.test(c[2].comfortNote), c[2].comfortNote);
check('light hop → fatigue "easy", low effort', c[3].fatigue === 'easy' && c[3].effort < 50, JSON.stringify(c[3]));

// ---- headline names the party cap ----------------------------------------
const okLedger: LedgerResult = { F: [1, 6, 3, 2], heavy: [false, true, false, false], violations: [], ok: true };
const hOk = rhythmHeadline(okLedger, elderly);
check('headline names the senior party AND its comfortable cap (4.5 h)', /senior/.test(hOk) && /4\.5 h/.test(hOk), hOk);

const badLedger: LedgerResult = { F: [1, 6, 11], heavy: [false, true, true], violations: [{ day: 3, kind: 'two_consecutive_heavy', detail: 'x' }], ok: false };
const hBad = rhythmHeadline(badLedger, elderly);
check('violation headline warns it runs past a comfortable senior pace', /past a comfortable senior pace/.test(hBad) && /4\.5 h/.test(hBad), hBad);

// ---- live integration through optimize() ----------------------------------
const nodes: CityNode[] = [
  { name: 'Delhi', coord: [28.6139, 77.2090], profile: {} },
  { name: 'Agra', coord: [27.1767, 78.0081], profile: {} },
  { name: 'Varanasi', coord: [25.3176, 82.9739], profile: {} },
];
const pool = new Map<string, LegOption[]>([
  ['Delhi||Agra', [{ from: 'Delhi', to: 'Agra', mode: 'ROAD', distanceKm: 233, durationMin: 210, operatingDays: 127, reliability: 5, source: 'osrm' }]],
  ['Agra||Varanasi', [
    { from: 'Agra', to: 'Varanasi', mode: 'RAIL', identifier: '12560 Shiv Ganga Exp', classes: ['2A'], distanceKm: 630, durationMin: 610, depTime: '20:25', arrTime: '06:40', arrDayOffset: 1, operatingDays: 127, reliability: 5, farePpMin: 1400, farePpMax: 1900, source: 'ir' },
  ]],
]);
const plan = optimize({ cities: [{ name: 'Delhi', nights: 1 }, { name: 'Agra', nights: 1 }, { name: 'Varanasi', nights: 2 }], start: 'Delhi', objective: 'EASE', pax: 2, profile: 'senior' } as OptimizeInput, { nodes, pool }).plans[0];

check('live: plan.rhythm.headline is populated and names the senior cap', !!plan.rhythm?.headline && /senior/.test(plan.rhythm!.headline!), plan.rhythm?.headline);
const transitDays = plan.days.filter((d) => d.transit);
check('live: every transit day carries a fatigue label', transitDays.length > 0 && transitDays.every((d) => d.fatigue === 'easy' || d.fatigue === 'full'),
  JSON.stringify(transitDays.map((d) => ({ city: d.city, fatigue: d.fatigue, effort: d.effort }))));
check('live: every day carries a plain-voice comfortNote', plan.days.every((d) => typeof d.comfortNote === 'string' && d.comfortNote.length > 0));
const overnightDay = plan.days.find((d) => d.marker === 'Overnight train');
check('live: the overnight leg surfaces an "Overnight train" marker', !!overnightDay, JSON.stringify(plan.days.map((d) => d.marker)));

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
