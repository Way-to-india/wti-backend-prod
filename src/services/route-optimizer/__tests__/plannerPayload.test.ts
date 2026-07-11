/**
 * Sprint 5 — increment US-501 acceptance: PLANNER PAYLOAD ADAPTER.
 *
 * Proves: (0) the display formatters; (1) THE JOIN — the design reads
 * `days[].transit` but the engine emits it THIN, so the adapter must hydrate it from
 * the matching `plan.legs[]` entry (durationMin / distanceKm / frequency / overnight /
 * verifyFlag / pearlSplit / decisionRecord); (2) the derived reasoning stream and the
 * keyed legOptions map, both built ONLY from services the engine actually compared;
 * (3) ANTI-HALLUCINATION — absent facts are OMITTED, never fabricated (no
 * decisionRecord ⇒ no "why"; no legOptions ⇒ no stream lines; no enrichment ⇒ null
 * costBreakdown), and `verifyFlag` is always carried through; (4) ADDITIVE — the
 * adapter is pure, never mutates the solve, and `plans[0]` keeps the exact shape
 * `loadFromOptimizer` reads; (5) the payload covers every key the design's data.js
 * declares.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/plannerPayload.test.ts
 */

import {
  toPlannerPayload, buildReasoning, buildLegOptions, buildCostBreakdown, findLegFor,
  fmtDur, fmtFarePp, legKey,
} from '../plannerPayload';
import { optimize, type OptimizeDeps } from '../optimize';
import type { CityNode, LegOption, OptimizeInput, Plan, PlanLeg, OptimizeResult } from '../types';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`)); };

console.log('\nSprint 5 / US-501 — Planner payload adapter\n');

// ---- (0) FORMATTERS --------------------------------------------------------------
check('fmtDur(115) = "1 h 55"', fmtDur(115) === '1 h 55', String(fmtDur(115)));
check('fmtDur(595) = "9 h 55" (the overnight train)', fmtDur(595) === '9 h 55', String(fmtDur(595)));
check('fmtDur(120) = "2 h" (no dangling minutes)', fmtDur(120) === '2 h', String(fmtDur(120)));
check('fmtDur(45) = "45 min"', fmtDur(45) === '45 min', String(fmtDur(45)));
check('fmtDur(null) = null (never a fabricated duration)', fmtDur(null) === null && fmtDur(undefined) === null);
check('fmtFarePp(1450) = "₹1,450 pp" (Indian grouping)', fmtFarePp(1450) === '₹1,450 pp', String(fmtFarePp(1450)));
check('fmtFarePp(null) = null (never a fabricated fare)', fmtFarePp(null) === null);
check('legKey("Delhi","Agra") = "Delhi-Agra" (the design key)', legKey('Delhi', 'Agra') === 'Delhi-Agra');

// ---- (1) THE JOIN, on a REAL solve ------------------------------------------------
// Delhi → Agra → Varanasi. The Agra→Varanasi leg gets TWO competing services so the
// engine produces a real decisionRecord + legOptions for it.
const nodes: CityNode[] = [
  { name: 'Delhi', coord: [28.6139, 77.2090], profile: {} },
  { name: 'Agra', coord: [27.1767, 78.0081], profile: {} },
  { name: 'Varanasi', coord: [25.3176, 82.9739], profile: {} },
];
const trainDA: LegOption = { from: 'Delhi', to: 'Agra', mode: 'RAIL', identifier: '12280 Taj Express', classes: ['CC', '2A'], distanceKm: 200, durationMin: 115, depTime: '06:15', arrTime: '08:10', operatingDays: 127, reliability: 5, farePpMin: 405, farePpMax: 405, source: 'ir' };
const overnightAV: LegOption = { from: 'Agra', to: 'Varanasi', mode: 'RAIL', identifier: '12559 Exp', classes: ['2A'], distanceKm: 620, durationMin: 595, depTime: '20:10', arrTime: '06:05', operatingDays: 21, reliability: 3, farePpMin: 1450, farePpMax: 1450, source: 'ir' };
const flightAV: LegOption = { from: 'Agra', to: 'Varanasi', mode: 'AIR', identifier: '6E 2043', distanceKm: 600, durationMin: 80, depTime: '14:20', arrTime: '15:40', operatingDays: 127, reliability: 2, farePpMin: 6900, farePpMax: 6900, source: 'air-sched' };

const pool = new Map<string, LegOption[]>([
  ['Delhi||Agra', [trainDA]],
  ['Agra||Varanasi', [overnightAV, flightAV]],
]);
const deps: OptimizeDeps = { nodes, pool };
const input: OptimizeInput = {
  cities: [{ name: 'Delhi', nights: 1 }, { name: 'Agra', nights: 1 }, { name: 'Varanasi', nights: 2 }],
  start: 'Delhi', end: 'Varanasi', objective: 'BALANCED', pax: 2, profile: 'senior',
} as OptimizeInput;

const result: OptimizeResult = optimize(input, deps);
const before = JSON.stringify(result);
const payload = toPlannerPayload(result, { request: 'Parents (68 & 65) — 5 days, must see Varanasi.' });

check('payload.plan is present on a feasible solve', payload.plan != null);
check('payload.request echoes the brief', payload.request === 'Parents (68 & 65) — 5 days, must see Varanasi.');

const plan0 = result.plans[0];
const transitDays = (payload.plan?.days ?? []).filter((d) => d.transit != null);
check('at least one day carries a transit', transitDays.length > 0, `days=${payload.plan?.days.length}`);

// the thin engine transit has ONLY from/to/mode/identifier/dep/arr — prove the source really is thin
const rawTransit = (plan0.days.find((d) => d.transit) as any)?.transit;
check('ENGINE day.transit is thin (no durationMin/frequency/decisionRecord on it)',
  rawTransit != null && rawTransit.durationMin === undefined && rawTransit.frequency === undefined && rawTransit.decisionRecord === undefined);

// …and the adapter hydrated it from plan.legs[]
const hydrated = transitDays.map((d) => d.transit!);
check('ADAPTER hydrates day.transit with durationMin from the matching leg',
  hydrated.some((t) => t.durationMin != null), JSON.stringify(hydrated[0]));
check('ADAPTER carries verifyFlag onto every hydrated transit (booking safety)',
  hydrated.every((t) => typeof t.verifyFlag === 'boolean'));
const legFor = (f: string, t: string): PlanLeg | undefined => plan0.legs.find((l) => l.from === f && l.to === t);
const av = legFor('Agra', 'Varanasi');
const avTransit = hydrated.find((t) => t.from === 'Agra' && t.to === 'Varanasi');
check('the Agra→Varanasi leg produced a real decisionRecord on the engine',
  av?.decisionRecord != null, JSON.stringify(av?.decisionRecord));
check('…and the adapter surfaces that decisionRecord on days[].transit (WhyThisWay binds here)',
  avTransit?.decisionRecord != null && avTransit.decisionRecord!.winner === av!.decisionRecord!.winner);
check('hydrated transit keeps the engine identifier/dep/arr unchanged',
  avTransit?.identifier === av?.identifier && avTransit?.dep === av?.dep);
check('findLegFor matches on from+to+mode', findLegFor({ from: 'Delhi', to: 'Agra', mode: 'RAIL' } as any, plan0.legs)?.from === 'Delhi');

// ---- (2) DERIVED STREAM + KEYED LEG OPTIONS ---------------------------------------
check('legOptions map is keyed "From-To" (design key)',
  Object.keys(payload.legOptions).some((k) => k === 'Agra-Varanasi'), Object.keys(payload.legOptions).join(','));
const avRows = payload.legOptions['Agra-Varanasi'] ?? [];
check('the Agra→Varanasi key lists BOTH compared services (chosen + rejected)', avRows.length >= 2, `rows=${avRows.length}`);
check('exactly one row is flagged chosen', avRows.filter((r) => r.chosen).length === 1);
check('rows carry DISPLAY strings (dur "9 h 55" / fare "₹1,450 pp"), not raw numbers',
  avRows.every((r) => r.dur === null || typeof r.dur === 'string') && avRows.every((r) => r.fare === null || typeof r.fare === 'string'),
  JSON.stringify(avRows[0]));
check('every row carries the engine frequency string (non-daily must stay visible)',
  avRows.every((r) => typeof r.freq === 'string'));

const reasoning = payload.reasoning;
check('reasoning stream is non-empty on a leg the engine actually compared', reasoning.length > 0, `lines=${reasoning.length}`);
check('the stream carries BOTH kept (ok:true) and rejected (ok:false) lines',
  reasoning.some((l) => l.ok) && reasoning.some((l) => !l.ok));
check('the chosen line precedes the rejected one within a leg',
  (() => { const i = reasoning.findIndex((l) => l.text.startsWith('Agra → Varanasi') && l.ok); const j = reasoning.findIndex((l) => l.text.startsWith('Agra → Varanasi') && !l.ok); return i >= 0 && j >= 0 && i < j; })());
check('every stream line names a REAL compared service (no scripted filler)',
  reasoning.every((l) => /→/.test(l.text) && l.text.length > 5));

// ---- (3) ANTI-HALLUCINATION -------------------------------------------------------
// a leg the engine never explained contributes NOTHING — no invented why, no filler line
const bareLeg: PlanLeg = { from: 'X', to: 'Y', mode: 'ROAD', distanceKm: 100 };
check('a leg with NO legOptions contributes ZERO reasoning lines', buildReasoning([bareLeg]).length === 0);
check('a leg with NO legOptions contributes NO legOptions key', Object.keys(buildLegOptions([bareLeg])).length === 0);
const bareTransit = { from: 'X', to: 'Y', mode: 'ROAD' } as any;
const bareDayPlan = { legs: [bareLeg], days: [{ day: 1, city: 'Y', activity: 'a', transit: bareTransit }], map: { stops: [], legs: [] }, totals: {}, sequence: [], weekdayLock: null, warnings: [], verifyBeforeBooking: [] } as unknown as Plan;
const barePayload = toPlannerPayload({ plans: [bareDayPlan] } as OptimizeResult);
check('an unexplained leg yields transit WITHOUT a decisionRecord (no invented "why")',
  barePayload.plan!.days[0].transit!.decisionRecord === undefined);
check('no enrichment ⇒ costBreakdown is null (never an invented price)',
  buildCostBreakdown(bareDayPlan) === null && barePayload.costBreakdown === null);
check('no enrichment ⇒ enrichment[] is empty, not fabricated', barePayload.enrichment.length === 0);

// costBreakdown maps STRAIGHT from the engine's tripCost when it IS present
const withCost = { ...bareDayPlan, totals: { ...(bareDayPlan.totals as any), hotelNights: 7 }, enrichment: { cities: [], enriching: false, generatedAt: 'x', tripCost: { currency: 'INR', perPersonMin: 42000, perPersonMax: 52000, totalMin: 0, totalMax: 0, breakdown: { hotel: 19400, roadTransport: 8900, intercityTransport: 9300, serviceTaxes: 4900 }, tier: '3star', pax: 4, indicative: true, gstPending: true } } } as unknown as Plan;
const cb = buildCostBreakdown(withCost)!;
check('costBreakdown renders the engine\'s 4 real cost lines (no re-derivation)',
  cb.perPerson.length === 4 && cb.perPerson[0].amount === 19400 && cb.perPerson[3].amount === 4900);
check('costBreakdown carries pax + an indicative note', cb.pax === 4 && /Indicative/.test(cb.note));

// ---- (4) PURE + ADDITIVE ----------------------------------------------------------
check('adapter did NOT mutate the solve result (pure)', JSON.stringify(result) === before);
check('plans[0] shape is untouched — loadFromOptimizer seam safe',
  Array.isArray(result.plans) && result.plans[0].days != null && result.plans[0].legs != null && result.plans[0].totals != null);
check('cards[] pass through unchanged', payload.cards.length === (result.cards?.length ?? 0));

// ---- (5) DESIGN-SHAPE COVERAGE (every key data.js declares) ------------------------
const required = ['request', 'cards', 'plan', 'legOptions', 'costBreakdown', 'enrichment', 'mapStops', 'mapLegs', 'reasoning'];
check('payload exposes every top-level key the design data.js declares',
  required.every((k) => k in payload), required.filter((k) => !(k in payload)).join(','));
const planKeys = ['label', 'weekdayLock', 'sequence', 'phaseShift', 'rhythm', 'totals', 'verifyBeforeBooking', 'days'];
check('payload.plan exposes every plan key the design binds',
  planKeys.every((k) => k in (payload.plan as any)), planKeys.filter((k) => !(k in (payload.plan as any))).join(','));
check('mapStops/mapLegs come from plan.map (JourneyRibbon + map bind here)',
  Array.isArray(payload.mapStops) && Array.isArray(payload.mapLegs));

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
