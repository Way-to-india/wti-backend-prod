/**
 * US-866 — A 0-NIGHT START IS HIS OWN FRONT DOOR (founder's live tests, 15 Jul 2026).
 *
 * "Arrive Delhi" — with a billed rest day at HOME — for a man who LIVES in Delhi; the
 * same for a Hyderabadi; then "Arrive Lucknow" on the Kerala plan. dayExpand always
 * emitted the arrive-day and the first calendar day landed on the start node. The truth:
 * a man does not arrive at his own city, and he does not rest a day there before leaving.
 * A 0-night HOME start begins with the DEPARTURE LEG, on Day 1.
 */
import { describe, it, expect } from 'bun:test';
import { expandDays, type ExpandInput } from '../dayExpand';
import type { CityNode, LegOption } from '../types';

const nodes = new Map<string, CityNode>([
  ['Lucknow', { name: 'Lucknow', coord: [26.85, 80.95], profile: {} } as CityNode],
  ['Munnar', { name: 'Munnar', coord: [10.09, 77.06], profile: {} } as CityNode],
]);
const leg: LegOption = {
  from: 'Lucknow', to: 'Munnar', mode: 'AIR', identifier: '6E 142',
  distanceKm: 2200, durationMin: 210, depTime: '09:00', arrTime: '12:30', arrDayOffset: 0,
  reliability: 4,
} as unknown as LegOption;

const base = (homeNights: number): ExpandInput => ({
  sequence: ['Lucknow', 'Munnar'],
  nights: new Map([['Lucknow', homeNights], ['Munnar', 2]]),
  nodes,
  chosen: new Map([['Lucknow||Munnar', leg]]),
  profile: 'standard',
});

describe('US-866 — a 0-night home start begins with the departure leg', () => {
  it('Day 1 IS the departure — there is no "Arrive Lucknow" for a man who lives there', () => {
    const out = expandDays(base(0));
    expect(out.days[0].day).toBe(1);
    expect(out.days[0].transit).toBeTruthy();          // the departure leg
    expect(out.days[0].activity).not.toMatch(/^Arrive/);
    expect(out.days.some((d) => d.city === 'Lucknow' && !d.transit)).toBe(false); // no rest day at home
  });

  it('the calendar stays continuous after the opening leg', () => {
    const out = expandDays(base(0));
    // Day 1 fly, then the extra full day at Munnar is Day 2.
    expect(out.days.map((d) => d.day)).toEqual([1, 2]);
    expect(out.days[1].activity).toContain('full day');
  });

  it('where he actually SLEEPS at the first stop, nothing changes — the arrive-day stands', () => {
    const out = expandDays(base(1));
    expect(out.days[0].activity).toMatch(/^Arrive Lucknow/);
    expect(out.days[0].day).toBe(1);
    // and the flight then sits on Day 2, exactly as before this fix.
    const fly = out.days.find((d) => d.transit);
    expect(fly?.day).toBe(2);
  });
});
