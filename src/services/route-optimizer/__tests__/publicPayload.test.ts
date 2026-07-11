/**
 * US-503a acceptance: PUBLIC PAYLOAD FILTER — the gate between the engine and the open web.
 *
 * The load-bearing test in this whole story: (1) NO PII — no `phone`, `email` or
 * `piiFlag` may appear ANYWHERE in the serialized public payload, at any depth, even
 * if a future field starts carrying one; (2) the internal cost SPLIT is gone
 * (founder: band only) while the price BAND survives; (3) internal `plan.warnings[]`
 * are gone; (4) everything that makes the product HONEST survives — decisionRecord,
 * legOptions (rejected options stay visible), verifyBeforeBooking, verifyFlag,
 * reasoning, comfort/rhythm, cards, negotiation; (5) the filter is PURE — deriving
 * the public payload must not damage the admin one.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/publicPayload.test.ts
 */

import { toPublicPayload, scrubKeys, PUBLIC_FORBIDDEN_KEYS } from '../publicPayload';
import { toPlannerPayload, type PlannerPayload } from '../plannerPayload';
import { optimize, type OptimizeDeps } from '../optimize';
import type { CityNode, LegOption, OptimizeInput, Plan } from '../types';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`)); };

console.log('\nUS-503a — Public payload filter (PII + cost-split gate)\n');

// ---- (0) the recursive scrubber itself -------------------------------------------
const nested = { a: 1, phone: '9999999999', deep: { email: 'x@y.com', keep: 'yes', list: [{ piiFlag: true, name: 'Ashish' }] } };
const scrubbed: any = scrubKeys(nested);
check('scrubKeys removes a top-level forbidden key', scrubbed.phone === undefined);
check('scrubKeys removes a NESTED forbidden key', scrubbed.deep.email === undefined);
check('scrubKeys removes a forbidden key INSIDE AN ARRAY of objects', scrubbed.deep.list[0].piiFlag === undefined);
check('scrubKeys keeps everything else intact', scrubbed.a === 1 && scrubbed.deep.keep === 'yes' && scrubbed.deep.list[0].name === 'Ashish');
check('scrubKeys is PURE (input untouched)', nested.phone === '9999999999' && nested.deep.email === 'x@y.com');
check('scrubKeys is case-insensitive', (scrubKeys({ Phone: '1', EMAIL: '2' }) as any).Phone === undefined && (scrubKeys({ Phone: '1', EMAIL: '2' }) as any).EMAIL === undefined);

// ---- a REAL solve, enriched with the worst case: a named guide with a phone+email --
const nodes: CityNode[] = [
  { name: 'Delhi', coord: [28.6139, 77.2090], profile: {} },
  { name: 'Agra', coord: [27.1767, 78.0081], profile: {} },
  { name: 'Varanasi', coord: [25.3176, 82.9739], profile: {} },
];
const trainDA: LegOption = { from: 'Delhi', to: 'Agra', mode: 'RAIL', identifier: '12280 Taj Express', classes: ['CC', '2A'], distanceKm: 200, durationMin: 115, depTime: '06:15', arrTime: '08:10', operatingDays: 127, reliability: 5, farePpMin: 405, farePpMax: 405, source: 'ir' };
const overnightAV: LegOption = { from: 'Agra', to: 'Varanasi', mode: 'RAIL', identifier: '12559 Exp', classes: ['2A'], distanceKm: 620, durationMin: 595, depTime: '20:10', arrTime: '06:05', operatingDays: 21, reliability: 3, farePpMin: 1450, farePpMax: 1450, source: 'ir' };
const flightAV: LegOption = { from: 'Agra', to: 'Varanasi', mode: 'AIR', identifier: '6E 2043', distanceKm: 600, durationMin: 80, depTime: '14:20', arrTime: '15:40', operatingDays: 127, reliability: 2, farePpMin: 6900, farePpMax: 6900, source: 'air-sched' };
const deps: OptimizeDeps = { nodes, pool: new Map([['Delhi||Agra', [trainDA]], ['Agra||Varanasi', [overnightAV, flightAV]]]) };
const input: OptimizeInput = {
  cities: [{ name: 'Delhi', nights: 1 }, { name: 'Agra', nights: 1 }, { name: 'Varanasi', nights: 2 }],
  start: 'Delhi', end: 'Varanasi', objective: 'BALANCED', pax: 4, profile: 'senior',
} as OptimizeInput;

const result = optimize(input, deps);
const plan: Plan = result.plans[0];
// attach a realistic enrichment: a real guide WITH contact details + a tripCost
(plan as any).enrichment = {
  cities: [{
    city: 'Delhi', overnight: true,
    hotels: [{ name: 'ibis New Delhi Aerocity', rating: 4.5, reviewCount: 900, pricePnMin: 4200, pricePnMax: 6100, source: 'x', sourceUrl: null, blurb: null, rank: 1 }],
    guides: [{
      name: 'Ashish Jain', languages: ['Hindi', 'English'],
      phone: '+91 98100 12345', email: 'ashish.guide@example.com',   // ← MUST NOT LEAK
      recognition: 'govt-recognised', rating: 4.8, source: 'wti', sourceUrl: null,
      verified: true, piiFlag: true,                                  // ← MUST NOT LEAK
    }],
    content: { intro: null, attractions: [{ name: 'Red Fort' }], itineraryBody: null, bestTime: 'Oct–Mar', uniqueFacts: ['…'], sources: [] },
  }],
  tripCost: { currency: 'INR', perPersonMin: 42000, perPersonMax: 52000, totalMin: 168000, totalMax: 208000, breakdown: { hotel: 19400, roadTransport: 8900, intercityTransport: 9300, serviceTaxes: 4900 }, tier: '3star', pax: 4, indicative: true, gstPending: true },
  enriching: false, generatedAt: '2026-07-10',
};
plan.warnings = ['internal: finalize A fallback used'];

const admin: PlannerPayload = toPlannerPayload(result, { request: 'Parents (68 & 65), 9 days.' });
const adminBefore = JSON.stringify(admin);
const pub = toPublicPayload(admin);
const pubJson = JSON.stringify(pub);

// ---- (1) THE PII GATE — the load-bearing assertion --------------------------------
check('the ADMIN payload legitimately DOES carry the guide phone (proves the fixture is real)',
  /\+91 98100 12345/.test(adminBefore));
for (const key of PUBLIC_FORBIDDEN_KEYS) {
  check(`PUBLIC payload contains NO "${key}" key anywhere (deep)`, !new RegExp(`"${key}"\\s*:`, 'i').test(pubJson));
}
check('PUBLIC payload does not contain the guide\'s phone NUMBER', !/98100 12345/.test(pubJson));
check('PUBLIC payload does not contain the guide\'s email ADDRESS', !/ashish\.guide@example\.com/.test(pubJson));
check('…but the guide is still NAMED and credentialled (the useful part survives)',
  /Ashish Jain/.test(pubJson) && /govt-recognised/.test(pubJson));

// ---- (2) COST: band survives, internal split is GONE (founder ruling) --------------
check('ADMIN payload HAS the 4-line costBreakdown (operator tool)', admin.costBreakdown != null && admin.costBreakdown!.perPerson.length === 4);
check('PUBLIC payload has NO costBreakdown key at all', !('costBreakdown' in (pub as any)));
check('PUBLIC payload does NOT leak the internal split numbers (19400 / 8900 / 9300 / 4900)',
  !/19400|8900|9300|4900/.test(pubJson));
check('…but the PRICE BAND survives on plan.totals.costPpBand (what the public sees)',
  Array.isArray(pub.plan?.totals?.costPpBand) || pub.plan?.totals?.costPpBand === null,
  JSON.stringify(pub.plan?.totals?.costPpBand));

// ---- (3) internal warnings are gone -----------------------------------------------
check('PUBLIC plan has NO internal warnings[]', !('warnings' in ((pub.plan ?? {}) as any)));
check('PUBLIC payload does not leak the internal warning text', !/finalize A fallback/.test(pubJson));

// ---- (4) EVERYTHING HONEST SURVIVES — this is the product, not the risk -------------
check('reasoning[] survives (the "watch it think" stream)', Array.isArray(pub.reasoning) && pub.reasoning.length > 0);
check('the REJECTED options survive in reasoning (ok:false) — honesty is the pitch',
  pub.reasoning.some((l) => l.ok === false));
check('legOptions survive (the compared services stay visible)', Object.keys(pub.legOptions).length > 0);
check('per-leg decisionRecord survives ("Why this way?")',
  (pub.plan?.days ?? []).some((d) => d.transit?.decisionRecord != null));
check('verifyBeforeBooking survives', Array.isArray(pub.plan?.verifyBeforeBooking));
check('verifyFlag survives on transit (a leg needing reconfirmation stays flagged)',
  (pub.plan?.days ?? []).some((d) => d.transit != null && typeof d.transit.verifyFlag === 'boolean'));
check('comfort + rhythm survive (fatigue/effort/comfortNote + rhythm)',
  (pub.plan?.days ?? []).some((d) => d.effort != null) && pub.plan?.rhythm != null);
check('archetype cards survive', Array.isArray(pub.cards) && pub.cards.length > 0);
check('hotels survive (no PII on them — name/rating/price only)', /ibis New Delhi Aerocity/.test(pubJson));
check('city content survives (bestTime / attractions)', /Oct–Mar/.test(pubJson) && /Red Fort/.test(pubJson));
check('the map survives', Array.isArray(pub.mapStops) && Array.isArray(pub.mapLegs));

// ---- (5) PURITY — deriving the public payload must not damage the admin one ---------
check('toPublicPayload is PURE — the ADMIN payload is byte-identical afterwards',
  JSON.stringify(admin) === adminBefore);
check('the admin payload STILL has the phone (CRM operator keeps it)', /98100 12345/.test(JSON.stringify(admin)));

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
