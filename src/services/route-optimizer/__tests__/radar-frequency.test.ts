/**
 * RADAR — prefer the more convenient (more frequent) service (founder, 15 Jul 2026).
 * The frequency penalty used to be binary (daily vs not), so a 3-days-a-week flight
 * (Trivandrum → Chennai, Mon/Tue/Wed) tied with a 2-days-a-week one (Tuticorin → Chennai,
 * Tue/Sun) and the tie fell to sort order. Now it is graded by operating-day count.
 */
import { describe, test, expect } from 'bun:test';
import { operatingDayCount, optionCost } from '../optimize';
import type { LegOption } from '../types';

describe('RADAR — operatingDayCount', () => {
  test('daily = 7, Mon/Tue/Wed (mask 7) = 3, Tue/Sun (mask 66) = 2', () => {
    expect(operatingDayCount(127)).toBe(7);
    expect(operatingDayCount(7)).toBe(3);   // 0b0000111 → Mon,Tue,Wed
    expect(operatingDayCount(66)).toBe(2);  // 0b1000010 → Tue,Sun
    expect(operatingDayCount(null)).toBe(7);
  });
});

// a realistic AIR option (shape from providers.airOptions), everything equal except the
// operating-days mask — so only the frequency penalty can differ.
const airOpt = (operatingDays: number, id: string): LegOption => ({
  from: 'Kanyakumari', to: 'Tirupati', mode: 'AIR',
  identifier: id, fromNode: 'Chennai', toNode: 'Chennai',
  distanceKm: 650, durationMin: 80, depTime: '20:15', arrTime: '21:45', arrDayOffset: 0,
  operatingDays, classes: ['ECONOMY'], reliability: 4, source: 'dgca-schedule', verifiedAt: null,
  accessFromKm: 98, accessFromMin: 106, accessToKm: 139, accessToMin: 151,
  fromAirportCity: 'Thiruvananthapuram', toAirportCity: 'Chennai',
} as unknown as LegOption);

describe('RADAR — the more frequent service costs less (preferDaily)', () => {
  test('a 3-day/week flight beats an otherwise-identical 2-day/week flight', () => {
    const thrice = airOpt(7, 'TRV-3day');   // Mon/Tue/Wed
    const twice = airOpt(66, 'TCR-2day');   // Tue/Sun
    const c3 = optionCost(thrice, 'BALANCED', 4, /*preferDaily*/ true);
    const c2 = optionCost(twice, 'BALANCED', 4, true);
    expect(c3).toBeLessThan(c2);
  });
  test('with preferDaily OFF, frequency does not tilt (dates are fixed)', () => {
    const thrice = airOpt(7, 'a');
    const twice = airOpt(66, 'b');
    expect(optionCost(thrice, 'BALANCED', 4, false)).toBe(optionCost(twice, 'BALANCED', 4, false));
  });
});
