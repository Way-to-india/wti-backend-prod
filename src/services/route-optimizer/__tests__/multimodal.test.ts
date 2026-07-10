/**
 * Multimodal engine test — proves the optimizer picks a flight/train over a long
 * drive when the pool offers them (this is the Hyderabad→Vizag fix). No DB: the
 * pool is supplied directly, exactly as the providers would produce it.
 *   npx tsx src/services/route-optimizer/__tests__/multimodal.test.ts
 */
import { optimize } from '../optimize';
import type { CityNode, LegOption, OptimizeInput } from '../types';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n} ${d}`)); };

const nodes: CityNode[] = [
  { name: 'Hyderabad', coord: [17.385, 78.4867], profile: {} },
  { name: 'Visakhapatnam', coord: [17.6868, 83.2185], profile: {} },
];
const pool = new Map<string, LegOption[]>([
  ['Hyderabad||Visakhapatnam', [
    { from: 'Hyderabad', to: 'Visakhapatnam', mode: 'ROAD', distanceKm: 620, durationMin: 600, operatingDays: 127, reliability: 4, source: 'osrm' },
    { from: 'Hyderabad', to: 'Visakhapatnam', mode: 'AIR', identifier: '6E 409', distanceKm: 500, durationMin: 75, depTime: '13:10', arrTime: '14:25', operatingDays: 127, reliability: 4, source: 'dgca' },
    { from: 'Hyderabad', to: 'Visakhapatnam', mode: 'RAIL', identifier: '12728 Godavari Exp', distanceKm: 709, durationMin: 770, depTime: '17:05', arrTime: '05:55', arrDayOffset: 1, operatingDays: 127, reliability: 5, source: 'ir' },
  ]],
]);

console.log('\nMultimodal engine test\n');

// TIME objective → flight should win the 620 km leg
const timePlan = optimize({ cities: [{ name: 'Hyderabad', nights: 1 }, { name: 'Visakhapatnam', nights: 1 }], start: 'Hyderabad', objective: 'TIME', pax: 2, profile: 'standard' } as OptimizeInput, { nodes, pool });
const tLeg = timePlan.plans[0].legs.find((l) => l.to === 'Visakhapatnam');
check('TIME picks the flight over the 10 h drive', tLeg?.mode === 'AIR', `got ${tLeg?.mode}`);
check('flight carries its real identifier', tLeg?.identifier === '6E 409');
check('day activity says "Fly"', timePlan.plans[0].days.some((d) => /Fly .*Visakhapatnam/.test(d.activity)));

// COST objective → the (cheaper) train should win over the flight for budget clients
const costPlan = optimize({ cities: [{ name: 'Hyderabad', nights: 1 }, { name: 'Visakhapatnam', nights: 1 }], start: 'Hyderabad', objective: 'COST', pax: 2, profile: 'standard' } as OptimizeInput, { nodes, pool });
const cLeg = costPlan.plans[0].legs.find((l) => l.to === 'Visakhapatnam');
check('COST picks the train, not the flight (budget)', cLeg?.mode === 'RAIL', `got ${cLeg?.mode}`);

// overnightTrains respected: if flights excluded conceptually, rail overnight is a valid pick under EASE
const easePlan = optimize({ cities: [{ name: 'Hyderabad', nights: 1 }, { name: 'Visakhapatnam', nights: 1 }], start: 'Hyderabad', objective: 'EASE', pax: 2, profile: 'senior' } as OptimizeInput, { nodes, pool });
const eLeg = easePlan.plans[0].legs.find((l) => l.to === 'Visakhapatnam');
check('EASE avoids the 620 km drive (picks air or rail)', eLeg?.mode === 'AIR' || eLeg?.mode === 'RAIL', `got ${eLeg?.mode}`);

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail) process.exit(1);
