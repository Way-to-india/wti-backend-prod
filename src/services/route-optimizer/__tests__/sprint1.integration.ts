// Sprint-1 integration smoke — drives the REAL optimize() path (what the controller
// calls) to prove the wiring, not just the pure modules. No DB.
import { optimize } from '../optimize';
import type { CityNode, LegOption, OptimizeInput } from '../types';

let fail = 0;
const check = (n: string, c: boolean, d = '') => { console.log(`  ${c ? '✓' : '✗'} ${n}${c ? '' : ' — ' + d}`); if (!c) fail++; };

// Elderly party; middle leg is a 220 km HILL road (7 h) → must be refused as one road day.
const nodes: CityNode[] = [
  { name: 'Shimla', coord: [31.104, 77.173], profile: {} },
  { name: 'Sarahan', coord: [31.52, 77.79], profile: {} },
  { name: 'Chandigarh', coord: [30.733, 76.779], profile: {} },
];
const pool = new Map<string, LegOption[]>([
  ['Shimla||Sarahan', [{ from: 'Shimla', to: 'Sarahan', mode: 'ROAD', distanceKm: 220, durationMin: 420, operatingDays: 127, reliability: 4, source: 'osrm' }]],
  ['Sarahan||Shimla', [{ from: 'Sarahan', to: 'Shimla', mode: 'ROAD', distanceKm: 220, durationMin: 420, operatingDays: 127, reliability: 4, source: 'osrm' }]],
  ['Shimla||Chandigarh', [{ from: 'Shimla', to: 'Chandigarh', mode: 'ROAD', distanceKm: 113, durationMin: 210, operatingDays: 127, reliability: 4, source: 'osrm' }]],
  ['Chandigarh||Shimla', [{ from: 'Chandigarh', to: 'Shimla', mode: 'ROAD', distanceKm: 113, durationMin: 210, operatingDays: 127, reliability: 4, source: 'osrm' }]],
  ['Sarahan||Chandigarh', [{ from: 'Sarahan', to: 'Chandigarh', mode: 'ROAD', distanceKm: 320, durationMin: 600, operatingDays: 127, reliability: 4, source: 'osrm' }]],
  ['Chandigarh||Sarahan', [{ from: 'Chandigarh', to: 'Sarahan', mode: 'ROAD', distanceKm: 320, durationMin: 600, operatingDays: 127, reliability: 4, source: 'osrm' }]],
]);
const input = { cities: [{ name: 'Shimla', nights: 1 }, { name: 'Sarahan', nights: 1 }, { name: 'Chandigarh', nights: 1 }], start: 'Shimla', objective: 'EASE', pax: 2, profile: 'senior', month: 5 } as OptimizeInput;
const r = optimize(input, { nodes, pool });
const p = r.plans[0];
console.log('  plan sequence:', p.sequence.join(' → '));
const hasHourViolation = p.days.some((d) => (d.violations || []).some((v) => /h\/day cap|in-vehicle exceeds/.test(v)));
check('gate (a) live: elderly hill leg surfaces an hour-cap violation in the plan', hasHourViolation, JSON.stringify(p.days.flatMap((d)=>d.violations||[])));
check('gate (a) live: plan warns it is infeasible/needs reroute', p.warnings.some((w)=>/hard-constraint|infeasible/i.test(w)) || hasHourViolation);

// Long corridor with an overnight train available → DDCV should choose RAIL over the blocked road.
const nodes2: CityNode[] = [
  { name: 'Delhi', coord: [28.61, 77.21], profile: {} },
  { name: 'Varanasi', coord: [25.32, 82.99], profile: {} },
];
const pool2 = new Map<string, LegOption[]>([
  ['Delhi||Varanasi', [
    { from: 'Delhi', to: 'Varanasi', mode: 'ROAD', distanceKm: 820, durationMin: 900, operatingDays: 127, reliability: 4, source: 'osrm' },
    { from: 'Delhi', to: 'Varanasi', mode: 'RAIL', identifier: '12560 Shiv Ganga Exp', distanceKm: 764, durationMin: 660, depTime: '20:10', arrTime: '07:10', arrDayOffset: 1, operatingDays: 127, classes: ['SL','3A','2A','1A'], reliability: 5, source: 'ir' },
  ]],
]);
const r2 = optimize({ cities: [{ name: 'Delhi', nights: 1 }, { name: 'Varanasi', nights: 1 }], start: 'Delhi', objective: 'EASE', pax: 2, profile: 'senior' } as OptimizeInput, { nodes: nodes2, pool: pool2 });
const leg2 = r2.plans[0].legs.find((l) => l.to === 'Varanasi');
check('gate (b) live: elderly 820 km corridor chooses the overnight TRAIN (not blocked road)', leg2?.mode === 'RAIL', `got ${leg2?.mode}`);
check('gate (b) live: chosen train flagged as a true overnight', leg2?.overnight === true);

console.log(fail ? `\n${fail} integration checks FAILED\n` : '\nintegration OK\n');
if (fail) process.exit(1);
