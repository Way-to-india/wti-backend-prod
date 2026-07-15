/**
 * US-862 — THE FLIGHT WAS SCHEDULED ON A DAY IT DOES NOT FLY (founder-found, live plan,
 * 15 Jul 2026). Day 1 locked Wednesday; the Wed/Sun-only flight sat on Day 2 — a Thursday.
 * The collector registered every weekday-limited leg one day early (index updated AFTER
 * the day), so the lock solved the calendar for the wrong day. This file pins the truth:
 * THE DAY THE PLAN PRINTS FOR A LIMITED SERVICE MUST BE A DAY THAT SERVICE RUNS.
 */
import { describe, it, expect } from 'bun:test';
import { planFromSequence } from '../optimize';
import { WEEKDAY_NAMES } from '../types';
import { runsOn } from '../constraints';
import type { CityNode, LegOption, OptimizeInput, Weekday } from '../types';

const HYD: [number, number] = [17.38, 78.48];
const BLR: [number, number] = [12.97, 77.59];
const nodes: CityNode[] = [
  { name: 'Hyderabad', coord: HYD, profile: {} },
  { name: 'Bangalore', coord: BLR, profile: {} },
];
// Wednesday + Sunday only: bits 2 (WED) and 6 (SUN) of the Monday-first mask.
const WED_SUN = (1 << 2) | (1 << 6);
const flight: LegOption = {
  from: 'Hyderabad', to: 'Bangalore', mode: 'AIR', identifier: 'IX 2019',
  distanceKm: 499, durationMin: 65, depTime: '08:20', arrTime: '09:25', arrDayOffset: 0,
  operatingDays: WED_SUN, reliability: 4, classes: ['ECONOMY'], source: 'dgca-schedule',
} as unknown as LegOption;
const pool = new Map<string, LegOption[]>([['Hyderabad||Bangalore', [flight]]]);
const input = {
  cities: [{ name: 'Hyderabad', nights: 1 }, { name: 'Bangalore', nights: 2 }],
  objective: 'BALANCED', tripType: 'oneway', pax: 2, profile: 'standard',
} as unknown as OptimizeInput;

describe('US-862 — the printed day of a limited service is a day it runs', () => {
  it('the flight day carries a weekday the Wed/Sun-only flight actually flies', () => {
    const p = planFromSequence(['Hyderabad', 'Bangalore'], input, { nodes, pool }, 'test');
    const flyDay = p.days.find((d) => d.transit && d.transit.mode === 'AIR');
    expect(flyDay).toBeTruthy();
    const wd = WEEKDAY_NAMES.indexOf(flyDay!.weekday as typeof WEEKDAY_NAMES[number]) as Weekday;
    expect(wd).toBeGreaterThanOrEqual(0);
    expect(runsOn(WED_SUN, wd)).toBe(true);   // the whole bug, in one line
  });
  it('the Day-1 lock is consistent with the flight sitting on Day 2, not Day 1', () => {
    const p = planFromSequence(['Hyderabad', 'Bangalore'], input, { nodes, pool }, 'test');
    // With one night in Hyderabad first, the flight departs on Day 2: feasible Day-1
    // weekdays are Tuesday (→ Wed flight) and Saturday (→ Sun flight).
    expect(['TUESDAY', 'SATURDAY']).toContain(p.weekdayLock);
  });
});
