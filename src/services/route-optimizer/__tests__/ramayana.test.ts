/**
 * Ramayana Yatra acceptance test — the definition of done for the optimizer engine.
 *
 * Ground truth: docs/audits/ramayana-yatra-v2-feasible-itinerary.md (+ the forensic
 * audit). A correct engine must:
 *   (a) REFUSE fly-JGB-land-17:55 + drive-213km-to-Srisailam same day (Mannanur gate).
 *   (b) REJECT train 19165 (Sabarmati, dep 03:25) as an "overnight".
 *   (c) SURFACE the Friday Day-1 weekday-lock (Tulsi Wed + Sabarmati Fri).
 *   (d) SURFACE the Nashik→Pune 210 km positioning drive explicitly.
 *
 * Runnable standalone:  npx tsx src/services/route-optimizer/__tests__/ramayana.test.ts
 */

import { isTrueOvernight, resolveWeekdayLock } from '../constraints';
import { expandDays } from '../dayExpand';
import type { CityNode, LegOption } from '../types';

// ---- tiny assert harness -----------------------------------------------------
let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

// ---- fixtures ----------------------------------------------------------------
const SABARMATI: LegOption = {
  from: 'Ayodhya', to: 'Darbhanga', mode: 'RAIL', identifier: '19165 Sabarmati Exp',
  depTime: '03:25', arrTime: '19:25', arrDayOffset: 0, operatingDays: (1 << 1) | (1 << 4) | (1 << 6), // Tue/Fri/Sun
  classes: ['3A'], reliability: 3, verifiedAt: new Date().toISOString(),
};
const HARIPRIYA: LegOption = {
  from: 'Hosapete', to: 'Tirupati', mode: 'RAIL', identifier: '17416 Haripriya Exp',
  depTime: '22:00', arrTime: '08:15', arrDayOffset: 1, operatingDays: 127,
  classes: ['3A', '2A'], reliability: 5, verifiedAt: new Date().toISOString(),
};
const TULSI: LegOption = {
  from: 'Prayagraj', to: 'Ayodhya', mode: 'RAIL', identifier: '22129 Tulsi SF',
  depTime: '09:00', arrTime: '12:15', arrDayOffset: 0, operatingDays: (1 << 0) | (1 << 2), // Mon/Wed
  classes: ['3A'], reliability: 4, verifiedAt: new Date().toISOString(),
};

const srisailam: CityNode = {
  name: 'Srisailam', coord: [16.073, 78.868],
  profile: { constraints: [{ kind: 'gate', name: 'Mannanur–Domalapenta (Amrabad)', closed: '21:00-06:00', onCorridorTo: 'Srisailam' }] },
};
const hyderabad: CityNode = { name: 'Hyderabad', coord: [17.385, 78.4867], profile: {} };
const nashik: CityNode = { name: 'Nashik', coord: [19.9975, 73.7898], profile: {} };
const pune: CityNode = { name: 'Pune', coord: [18.5204, 73.8567], profile: { nearestAirportIata: 'PNQ' } };
const hampi: CityNode = { name: 'Hampi', coord: [15.335, 76.46], profile: {} };

console.log('\nRamayana Yatra acceptance test\n');

// (b) overnight predicate ------------------------------------------------------
console.log('(b) true-overnight predicate:');
check('19165 Sabarmati is NOT an overnight (03:25 boarding)', isTrueOvernight(SABARMATI) === false);
check('17416 Haripriya IS a true overnight (22:00 → 08:15)', isTrueOvernight(HARIPRIYA) === true);

// (a) gate infeasibility -------------------------------------------------------
console.log('\n(a) Mannanur gate feasibility:');
const trap = expandDays({
  sequence: ['Hyderabad', 'Srisailam'],
  nights: new Map([['Hyderabad', 1], ['Srisailam', 1]]),
  nodes: new Map([['Hyderabad', hyderabad], ['Srisailam', srisailam]]),
  // same-day after JGB flight lands 17:55 (+60 transfer) → road departs 18:55, 213 km ≈ 300 min
  chosen: new Map([['Hyderabad||Srisailam', { from: 'Hyderabad', to: 'Srisailam', mode: 'ROAD', distanceKm: 213, durationMin: 300, depTime: '18:55' } as LegOption]]),
  profile: 'senior',
});
check('same-day flight-then-drive to Srisailam is REFUSED (gate)', trap.infeasible === true, JSON.stringify(trap.days.find((d) => d.violations)?.violations));

const feasible = expandDays({
  sequence: ['Hyderabad', 'Srisailam'],
  nights: new Map([['Hyderabad', 1], ['Srisailam', 1]]),
  nodes: new Map([['Hyderabad', hyderabad], ['Srisailam', srisailam]]),
  chosen: new Map([['Hyderabad||Srisailam', { from: 'Hyderabad', to: 'Srisailam', mode: 'ROAD', distanceKm: 213, durationMin: 300, depTime: '07:00' } as LegOption]]),
  profile: 'senior',
});
check('morning 07:00 drive to Srisailam is FEASIBLE (control)', feasible.infeasible === false);

// (c) Friday weekday-lock ------------------------------------------------------
console.log('\n(c) Friday weekday-lock:');
// real audit spacing: Tulsi at Day 6 (index 5), Sabarmati at Day 8 (index 7)
const lock = resolveWeekdayLock([
  { dayIndex: 5, operatingDays: TULSI.operatingDays!, identifier: TULSI.identifier },
  { dayIndex: 7, operatingDays: SABARMATI.operatingDays!, identifier: SABARMATI.identifier },
]);
check('weekday lock resolves to FRIDAY', lock.lock === 'FRIDAY', `got ${lock.lock}; feasibleStarts=${lock.feasibleStarts}`);
check('only one feasible Day-1 weekday', lock.feasibleStarts.length === 1);

// (d) Nashik→Pune positioning drive -------------------------------------------
console.log('\n(d) positioning-drive disclosure:');
const pos = expandDays({
  sequence: ['Nashik', 'Pune', 'Hampi'],
  nights: new Map([['Nashik', 1], ['Pune', 0], ['Hampi', 1]]),
  nodes: new Map([['Nashik', nashik], ['Pune', pune], ['Hampi', hampi]]),
  chosen: new Map<string, LegOption>([
    ['Nashik||Pune', { from: 'Nashik', to: 'Pune', mode: 'ROAD', distanceKm: 210, durationMin: 270, depTime: '06:30' }],
    ['Pune||Hampi', { from: 'Pune', to: 'Hampi', mode: 'AIR', identifier: '6E PNQ-HBX', distanceKm: 430, durationMin: 90, depTime: '13:00', arrTime: '14:30' }],
  ]),
  profile: 'senior',
});
const nashikPune = pos.legs.find((l) => l.from === 'Nashik' && l.to === 'Pune');
check('Nashik→Pune flagged as a positioning drive', nashikPune?.positioning === true);
check('positioning drive surfaced in warnings', pos.warnings.some((w) => /positioning/i.test(w) && /Nashik/.test(w)));
check('Nashik→Pune 210 km is disclosed with its distance', (nashikPune?.distanceKm ?? 0) === 210);

// ---- result ------------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
