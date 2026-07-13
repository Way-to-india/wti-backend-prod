/** Call airOptions() directly with the exact coordinates the engine uses. No inference. */
import { airOptions, multimodalOptions } from '../src/services/route-optimizer/providers';

const kanyakumari = { name: 'Kanyakumari', coord: [8.0883, 77.5385] as [number, number], profile: {} };
const tirupati    = { name: 'Tirupati',    coord: [13.6355, 79.4199] as [number, number], profile: {} };

const air = await airOptions(kanyakumari, tirupati, { pax: 2 });
console.log('airOptions returned', air.length, 'option(s)');
for (const o of air) {
  console.log('  %s  %s -> %s  flight %s min | drive TO airport %s km (%s min) | drive FROM airport %s km (%s min)',
    o.identifier, o.fromNode, o.toNode, o.durationMin, o.accessFromKm, o.accessFromMin, o.accessToKm, o.accessToMin);
}

const mm = await multimodalOptions(kanyakumari, tirupati, { pax: 2 });
console.log('\nmultimodalOptions returned', mm.length, 'option(s):');
const byMode: Record<string, number> = {};
for (const o of mm) byMode[o.mode] = (byMode[o.mode] ?? 0) + 1;
console.log('  by mode:', JSON.stringify(byMode));
process.exit(0);
