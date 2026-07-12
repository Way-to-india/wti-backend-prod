/**
 * DID I INTRODUCE A REGRESSION TODAY?
 *
 * physiology.vehicleHours() now takes max(router, terrain) on a ROAD leg. That was a
 * TIGHTENING, and tightenings are safe by construction -- they can only make a day look
 * longer, never shorter.
 *
 * BUT: the terrain model was then PROVED an hour too slow on NH66 (Ratnagiri -> Malvan:
 * model 4h40m, Google 3h22m). It knows terrain. It does not know ROAD CLASS.
 *
 * So the question is no longer "can it be loosened" (it cannot). It is:
 *
 *     CAN IT NOW REFUSE A LEG THAT IS PERFECTLY FINE?
 *
 * A gate that refuses good itineraries is not safe. It is broken in the other direction.
 */
import { vehicleHours, roadDayHardCapExceeded, TOLERANCE } from '@/services/route-optimizer/physiology';

const f = (h: number) => `${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

// Ratnagiri -> Malvan. 170 km of NH66. GOOGLE MEASURED IT AT 3h 22m (202 min).
const leg = { mode: 'ROAD' as const, distanceKm: 170, durationMin: 202 };

const CASES: [string, number][] = [
  ['plain    (rqi 4, 55 km/h)', 4],
  ['rolling  (rqi 3, 42 km/h)', 3],
  ['climbing (rqi 2, 30 km/h)', 2],
  ['hill     (rqi 1, 22 km/h)', 1],
];

console.log('\n  Ratnagiri -> Malvan: 170 km of NH66. GOOGLE MEASURED IT AT 3h 22m.\n');
console.log('  terrain the engine assigns        engine believes    elderly cap 5h');
for (const [name, rqi] of CASES) {
  const h = vehicleHours(leg, { roadQualityIndex: rqi, month: null });
  const g = roadDayHardCapExceeded(leg, TOLERANCE.elderly, { roadQualityIndex: rqi, month: null });
  console.log(`  ${name.padEnd(30)} ${f(h).padStart(7)}          ${g.exceeded ? '*** REFUSED ***' : 'ok'}`);
}

console.log('\n  If the terrain model over-rides a REAL MEASUREMENT, we refuse a leg that is fine.');
console.log('  A gate that refuses good itineraries is not safe. It is broken the other way.\n');
process.exit(0);
