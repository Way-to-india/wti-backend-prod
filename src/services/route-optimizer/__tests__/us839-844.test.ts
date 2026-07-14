/**
 * US-844 — WE APOLOGISED FOR GIVING HIM WHAT HE ASKED FOR.
 * US-839 (input class) — A CITY NAMED TWICE IS ONE CITY.
 *
 * The live payload, 15 July 2026, to a luxury honeymooner who wrote "no trains, no long
 * road journeys": "This leg is harder than we would normally plan for you… the only service
 * we have on this leg is a flight… if you would rather not take it, tell us." A FLIGHT IS
 * EXACTLY WHAT HE WANTED. These assertions make both defects unrepeatable.
 */
import { describe, it, expect } from 'bun:test';
import { planFromSequence, mergeDuplicateCities } from '../optimize';
import type { OptimizeInput, LegOption, CityNode } from '../types';
import type { PlanContract } from '../intent';

const DELHI: [number, number] = [28.61, 77.21];
const MUMBAI: [number, number] = [19.076, 72.877];

const nodes: CityNode[] = [
  { name: 'Delhi', coord: DELHI, profile: {} },
  { name: 'Mumbai', coord: MUMBAI, profile: {} },
];

// The ONLY service on the leg is a flight — honest numbers (1,150 km, 2h10 ≈ 530 km/h).
const flight: LegOption = {
  from: 'Delhi', to: 'Mumbai', mode: 'AIR', distanceKm: 1150, durationMin: 130,
  operatingDays: 127, reliability: 4, identifier: 'AI 805', source: 'curated',
} as unknown as LegOption;
const pool = new Map<string, LegOption[]>([['Delhi||Mumbai', [flight]]]);

/** A contract whose ordeal ceiling nothing can pass — so the court finds no honourable
 *  option and buildPlan enters the forced-substitution branch. The ONLY variable between
 *  the two tests is whether he PREFERRED the surviving mode. */
const contract = (preferModes: Array<'AIR' | 'RAIL' | 'ROAD'>): PlanContract => ({
  filters: { banModes: [], banOvernightRail: false },
  preferences: { preferModes: preferModes as PlanContract['preferences']['preferModes'] },
  tighten: { perModeOrdealCeiling: { AIR: 0.01 } },
  rewardSwitches: { hotelNightSaving: false },
  moneyRule: 'tiebreak_only',
  chips: [],
  budgetStance: 'comfort_first',
  tpp: {},
  voice: { quotes: {} },
  echo: [],
});

const input = (c: PlanContract): OptimizeInput => ({
  cities: [{ name: 'Delhi', nights: 0 }, { name: 'Mumbai', nights: 2 }],
  objective: 'BALANCED', tripType: 'oneway', pax: 2, profile: 'standard',
  contract: c,
} as unknown as OptimizeInput);

describe('US-844 — we do not apologise for giving him what he asked for', () => {
  it('a forced leg on a PREFERRED mode is a confirmation, never a breach or an apology', () => {
    const p = planFromSequence(['Delhi', 'Mumbai'], input(contract(['AIR'])), { nodes, pool }, 'test');
    const leg = p.legs.find((l) => l.to === 'Mumbai');
    expect(leg).toBeTruthy();
    expect((leg as { contractBreach?: boolean }).contractBreach).toBeFalsy();
    const prose = [...p.warnings, ...((p as { contractNotes?: string[] }).contractNotes ?? [])].join(' ');
    expect(prose).not.toContain('harder than we would normally plan');
    expect(String(leg!.note || '')).toContain('You asked to fly');
  });

  it('a forced leg on a mode he did NOT prefer still gets the honest Law-4 paragraph', () => {
    const p = planFromSequence(['Delhi', 'Mumbai'], input(contract([])), { nodes, pool }, 'test');
    const leg = p.legs.find((l) => l.to === 'Mumbai');
    expect(leg).toBeTruthy();
    expect((leg as { contractBreach?: boolean }).contractBreach).toBe(true);
  });
});

describe('US-839 (input) — a city named twice is one city, its nights summed', () => {
  it('merges case- and whitespace-insensitively, keeps first coords, sums nights', () => {
    const out = mergeDuplicateCities([
      { name: 'Delhi', nights: 1 }, { name: 'Agra', nights: 2 }, { name: ' delhi ', nights: 2 },
    ]);
    expect(out.length).toBe(2);
    expect(out.find((c) => c.name.trim().toLowerCase() === 'delhi')!.nights).toBe(3);
    expect(out.find((c) => c.name.trim().toLowerCase() === 'agra')!.nights).toBe(2);
  });
  it('leaves a clean list untouched', () => {
    const out = mergeDuplicateCities([{ name: 'Delhi', nights: 1 }, { name: 'Agra', nights: 2 }]);
    expect(out.length).toBe(2);
  });
});
