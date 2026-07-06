import { optimize } from '../optimize';
import type { CityNode, LegOption, OptimizeInput } from '../types';

const node = (name: string, lat: number, lng: number): CityNode => ({ name, coord: [lat, lng], profile: {} });
const road = (from: string, to: string, km: number, min: number): LegOption => ({ from, to, mode: 'ROAD', distanceKm: km, durationMin: min, operatingDays: 127, source: 'osrm', verifiedAt: new Date().toISOString() });

const nodes = [node('Delhi', 28.61, 77.23), node('Agra', 27.18, 78.02), node('Jaipur', 26.91, 75.79), node('Delhi2', 28.61, 77.23)].slice(0, 3);
const pool = new Map<string, LegOption[]>();
const pairs: [string, string, number, number][] = [
  ['Delhi', 'Agra', 233, 240], ['Agra', 'Delhi', 233, 240],
  ['Delhi', 'Jaipur', 281, 300], ['Jaipur', 'Delhi', 281, 300],
  ['Agra', 'Jaipur', 240, 260], ['Jaipur', 'Agra', 240, 260],
];
for (const [a, b, km, min] of pairs) pool.set(`${a}||${b}`, [road(a, b, km, min)]);

const input: OptimizeInput = {
  cities: [{ name: 'Delhi', nights: 1 }, { name: 'Agra', nights: 1 }, { name: 'Jaipur', nights: 2 }],
  start: 'Delhi', objective: 'BALANCED', pax: 4, profile: 'family',
};

const res = optimize(input, { nodes, pool });
console.log('plans:', res.plans.length);
const p = res.plans[0];
console.log('sequence:', p.sequence.join(' → '));
console.log('weekdayLock:', p.weekdayLock);
console.log('totals:', JSON.stringify(p.totals));
console.log('days:', p.days.length, '| legs:', p.legs.length, '| map.stops:', p.map.stops.length, '| map.legs:', p.map.legs.length);
console.log('map.modes:', p.map.modes.join(','));
if (p.sequence[0] !== 'Delhi') { console.log('FAIL: start not honoured'); process.exit(1); }
if (!p.map.stops.every((s) => s.lat != null)) { console.log('FAIL: missing coords'); process.exit(1); }
console.log('\nSMOKE OK');
