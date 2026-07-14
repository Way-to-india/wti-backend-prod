/**
 * US-860 — THE BUILDER MUST KEEP THE CARD'S PROMISE (founder-found, live page, 14 Jul 2026).
 *
 * The card told a luxury couple, with a receipt: "You fly in — Lucknow → Kochi is flyable
 * with one change of plane." The BUILT plan opened with a 43-hour train that runs Mondays
 * only. Three organs of one disease, each pinned here:
 *
 *   1. THE POOL — no AIR option existed for a town with no airport (US-847): the one-stop
 *      via-node never entered the pool, so the prefer-tilt had nothing to tilt toward.
 *      (The pool synthesis is DB-bound and proved on the live payload; what is pinned HERE
 *      is that once the option exists, the builder chooses it and SPEAKS its anatomy.)
 *   2. THE MATRIX — no door-to-door time gradient, so a 43-hour leg won on terms that never
 *      saw a clock (US-832), and anchors' "re-sequence to avoid this leg" was ignored.
 *   3. THE ORDEAL GATE — refused a 41-hour ROAD by name, passed a 43-hour TRAIN.
 *      THE RAIL-ORDEAL RULING (founder, 15 Jul 2026): advisory for everyone at 24 h+,
 *      HARD REFUSAL for senior/comfort-first parties at 30 h+.
 */
import { describe, it, expect } from 'bun:test';
import { ddcv } from '../ddcv';
import { RAIL_ORDEAL_ADVISORY_HRS, RAIL_ORDEAL_REFUSE_HRS } from '../ordeal';
import { toleranceForProfile } from '../physiology';
import { planFromSequence, solveForObjective, type OptimizeDeps } from '../optimize';
import { hydrateTransitForTest } from '../plannerPayload';
import type { CityNode, LegOption, OptimizeInput, PlanLeg } from '../types';
import type { PlanContract } from '../intent';

const LUCKNOW: [number, number] = [26.85, 80.95];
const MALAMPUZHA: [number, number] = [10.81, 76.68];

const contract = (preferModes: Array<'AIR' | 'RAIL' | 'ROAD'> = []): PlanContract => ({
  filters: { banModes: [], banOvernightRail: false },
  preferences: { preferModes: preferModes as PlanContract['preferences']['preferModes'] },
  tighten: {},
  rewardSwitches: { hotelNightSaving: false },
  moneyRule: 'tiebreak_only',
  chips: [],
  budgetStance: 'comfort_first',
  voice: { quotes: {} },
} as unknown as PlanContract);

/** the 43-hour Monday-only train that opened the founder's plan. Honest numbers. */
const RAPTI_SAGAR: LegOption = {
  from: 'Lucknow', to: 'Malampuzha', mode: 'RAIL', identifier: '12521 RAPTI SAGAR EXP',
  distanceKm: 2900, durationMin: 43 * 60, depTime: '13:35', arrTime: '08:35', arrDayOffset: 2,
  operatingDays: 1, reliability: 3, classes: ['2A', '3A', 'SL'], source: 'ir-timetable',
} as unknown as LegOption;

/** the one-stop via-node the card promised: two real sectors + a road transfer, spoken. */
const ONE_STOP_FLY: LegOption = {
  from: 'Lucknow', to: 'Malampuzha', mode: 'AIR',
  identifier: '6E 142 + 6E 7005 (change at Bangalore)',
  distanceKm: 2050, durationMin: 150 + 90 + 80, depTime: '08:30', arrTime: null, arrDayOffset: 0,
  operatingDays: 127, reliability: 2, classes: ['ECONOMY'], source: 'dgca-schedule-onestop',
  viaHub: 'Bangalore', toAirportCity: 'Coimbatore',
  accessToKm: 55, accessToMin: 75, fromAirportCity: null, accessFromKm: 0, accessFromMin: 0,
} as unknown as LegOption;

const nodes: CityNode[] = [
  { name: 'Lucknow', coord: LUCKNOW, profile: {} },
  { name: 'Malampuzha', coord: MALAMPUZHA, profile: {} },
];
const pool = new Map<string, LegOption[]>([['Lucknow||Malampuzha', [RAPTI_SAGAR, ONE_STOP_FLY]]]);
const input = (c: PlanContract): OptimizeInput => ({
  cities: [{ name: 'Lucknow', nights: 0 }, { name: 'Malampuzha', nights: 2 }],
  objective: 'BALANCED', tripType: 'oneway', pax: 2, profile: 'standard',
  contract: c,
} as unknown as OptimizeInput);

describe('US-860 organ 3 — THE RAIL-ORDEAL RULING (founder, 15 Jul 2026)', () => {
  const tol = toleranceForProfile('standard');
  it('a 43-hour train is REFUSED for a comfort-first party (30 h ceiling)', () => {
    const v = ddcv(RAPTI_SAGAR, { tol, pax: 2, comfortFirst: true });
    expect(v.hardBlock).toBe(true);
    expect(v.blockReasons.join(' ')).toContain('founder ruling');
  });
  it('a 43-hour train is REFUSED for an elderly party even without a stated tier', () => {
    const v = ddcv(RAPTI_SAGAR, { tol: toleranceForProfile('senior'), pax: 2 });
    expect(v.hardBlock).toBe(true);
  });
  it('the same train is NOT hard-blocked for a value-minded standard party (advisory territory)', () => {
    const v = ddcv(RAPTI_SAGAR, { tol, pax: 2, comfortFirst: false });
    const railBlocked = v.blockReasons.some((r) => r.includes('founder ruling'));
    expect(railBlocked).toBe(false);
  });
  it('the ruling constants are the founder\'s numbers: advisory 24, refusal 30', () => {
    expect(RAIL_ORDEAL_ADVISORY_HRS).toBe(24);
    expect(RAIL_ORDEAL_REFUSE_HRS).toBe(30);
  });
});

describe('US-860 organ 1 — once the via-node is in the pool, the builder keeps the promise', () => {
  it('the luxury flights-preferring couple get the one-stop flight, never the 43-hour train', () => {
    const p = planFromSequence(['Lucknow', 'Malampuzha'], input(contract(['AIR'])), { nodes, pool }, 'test');
    const leg = p.legs.find((l) => l.to === 'Malampuzha')!;
    expect(leg.mode).toBe('AIR');
    expect(String(leg.identifier)).toContain('change at Bangalore');
  });
  it('the AIR leg SPEAKS its anatomy: the hub, the landing airport, the road transfer', () => {
    const p = planFromSequence(['Lucknow', 'Malampuzha'], input(contract(['AIR'])), { nodes, pool }, 'test');
    const leg = p.legs.find((l) => l.to === 'Malampuzha')!;
    expect(String(leg.note || '')).toContain('change planes at Bangalore');
    expect(String(leg.note || '')).toContain('lands at Coimbatore');
    expect(String(leg.note || '')).toContain('55 km road transfer');
    const flyDay = p.days.find((d) => d.transit && d.transit.to === 'Malampuzha')!;
    expect(String(flyDay.activity)).toContain('then road to Malampuzha');
    // the day's clock counts the road transfer, not only the sector minutes
    expect(flyDay.transitMin).toBe((150 + 90 + 80) + 75);
  });
  it('a 25-hour train that survives (standard value party) carries the 24 h+ ADVISORY, spoken', () => {
    const train25: LegOption = { ...RAPTI_SAGAR, durationMin: 25 * 60, identifier: '12521 TEST' } as LegOption;
    const p = planFromSequence(['Lucknow', 'Malampuzha'],
      { ...input(contract([])), contract: undefined } as unknown as OptimizeInput,
      { nodes, pool: new Map([['Lucknow||Malampuzha', [train25]]]) }, 'test');
    const leg = p.legs.find((l) => l.to === 'Malampuzha')!;
    expect(String(leg.note || '')).toContain('hours on a train');
    expect(p.warnings.join(' ')).toContain('rail-ordeal ruling');
  });
});

describe('US-832 — the matrix carries a door-to-door time term; geometry orders the tour', () => {
  // Hyderabad down the peninsula: the sane order walks south. The backtrack order
  // (fly to the tip, come back north) must lose on HOURS even where money likes it.
  const HYD: [number, number] = [17.38, 78.48];
  const TPT: [number, number] = [13.63, 79.42];
  const MDU: [number, number] = [9.93, 78.12];
  const KKM: [number, number] = [8.09, 77.54];
  const nodes4: CityNode[] = [
    { name: 'Hyderabad', coord: HYD, profile: {} },
    { name: 'Tirupati', coord: TPT, profile: {} },
    { name: 'Madurai', coord: MDU, profile: {} },
    { name: 'Kanyakumari', coord: KKM, profile: {} },
  ];
  const crow = (a: [number, number], b: [number, number]) => {
    const R = 6371, dLat = (b[0] - a[0]) * Math.PI / 180, dLng = (b[1] - a[1]) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  };
  const coordOf: Record<string, [number, number]> = { Hyderabad: HYD, Tirupati: TPT, Madurai: MDU, Kanyakumari: KKM };
  const pool4 = new Map<string, LegOption[]>();
  const names = ['Hyderabad', 'Tirupati', 'Madurai', 'Kanyakumari'];
  for (const a of names) for (const b of names) {
    if (a === b) continue;
    const km = Math.round(crow(coordOf[a], coordOf[b]) * 1.15);
    pool4.set(`${a}||${b}`, [{
      from: a, to: b, mode: 'ROAD', distanceKm: km,
      durationMin: Math.round((km / 55) * 60), operatingDays: 127, reliability: 4,
      identifier: null, source: 'curated',
    } as unknown as LegOption]);
  }
  it('from Hyderabad the tour walks the peninsula in order — no fly-to-the-tip-and-back', () => {
    const inp = {
      cities: names.map((n, i) => ({ name: n, nights: i === 0 ? 0 : 1 })),
      start: 'Hyderabad', objective: 'BALANCED', tripType: 'oneway', pax: 2, profile: 'standard',
    } as unknown as OptimizeInput;
    const plan = solveForObjective(inp, { nodes: nodes4, pool: pool4 }, 'BALANCED', 'test');
    expect(plan.sequence.join(' → ')).toBe('Hyderabad → Tirupati → Madurai → Kanyakumari');
  });
});

describe('US-832 — a dead-halt pair is a FORBIDDEN EDGE; the solver re-sequences around it', () => {
  // A → C is an over-cap road with NO worthy anchor (the literal "re-sequence to avoid this
  // leg" case). A → B and B → C are civilised. The solver must never take A → C.
  const A: [number, number] = [26.85, 80.95];   // Lucknow-ish
  const B: [number, number] = [23.2, 79.9];     // en-route
  const C: [number, number] = [19.9, 79.3];     // far south
  const mk = (from: string, to: string, km: number, min: number): LegOption => ({
    from, to, mode: 'ROAD', distanceKm: km, durationMin: min,
    operatingDays: 127, reliability: 4, identifier: null, source: 'curated',
  } as unknown as LegOption);
  const nodes3: CityNode[] = [
    { name: 'Alpha', coord: A, profile: {} },
    { name: 'Beta', coord: B, profile: {} },
    { name: 'Gamma', coord: C, profile: {} },
  ];
  const pool3 = new Map<string, LegOption[]>([
    ['Alpha||Gamma', [mk('Alpha', 'Gamma', 900, 990)]],   // 16.5 h — over every cap
    ['Gamma||Alpha', [mk('Gamma', 'Alpha', 900, 990)]],
    ['Alpha||Beta', [mk('Alpha', 'Beta', 430, 470)]],
    ['Beta||Alpha', [mk('Beta', 'Alpha', 430, 470)]],
    ['Beta||Gamma', [mk('Beta', 'Gamma', 400, 440)]],
    ['Gamma||Beta', [mk('Gamma', 'Beta', 400, 440)]],
  ]);
  // one WORTHLESS anchor candidate on the dead pair → chooseAnchor returns deadHalt
  const anchorsByLeg = new Map([
    ['Alpha||Gamma', [{ name: 'Nowhere Junction', coord: [30.0, 85.0] as const, valueDays: 0.1 }]],
    ['Gamma||Alpha', [{ name: 'Nowhere Junction', coord: [30.0, 85.0] as const, valueDays: 0.1 }]],
  ]);
  it('the tour routes Alpha → Beta → Gamma; the dead-halt edge is never driven', () => {
    const inp = {
      cities: [{ name: 'Alpha', nights: 0 }, { name: 'Beta', nights: 1 }, { name: 'Gamma', nights: 1 }],
      start: 'Alpha', objective: 'BALANCED', tripType: 'oneway', pax: 2, profile: 'standard',
    } as unknown as OptimizeInput;
    const deps = { nodes: nodes3, pool: pool3, anchorsByLeg } as unknown as OptimizeDeps;
    const plan = solveForObjective(inp, deps, 'BALANCED', 'test');
    expect(plan.sequence.join(' → ')).toBe('Alpha → Beta → Gamma');
    const direct = plan.legs.find((l) => l.from === 'Alpha' && l.to === 'Gamma');
    expect(direct).toBeUndefined();
  });
});

describe('US-847/US-860 — the anatomy survives the page adapter (hydrateTransit)', () => {
  it('viaHub, airports and transfers ride days[].transit', () => {
    const leg = {
      from: 'Lucknow', to: 'Malampuzha', mode: 'AIR', identifier: '6E 142 + 6E 7005 (change at Bangalore)',
      durationMin: 320, distanceKm: 2050, viaHub: 'Bangalore', toAirportCity: 'Coimbatore',
      accessToKm: 55, accessToMin: 75, note: 'spoken',
    } as unknown as PlanLeg;
    const t = hydrateTransitForTest({ from: 'Lucknow', to: 'Malampuzha', mode: 'AIR', identifier: leg.identifier }, [leg]);
    expect(t.viaHub).toBe('Bangalore');
    expect(t.toAirportCity).toBe('Coimbatore');
    expect(t.accessToKm).toBe(55);
    expect(t.accessToMin).toBe(75);
    expect(t.note).toBe('spoken');
  });
});
