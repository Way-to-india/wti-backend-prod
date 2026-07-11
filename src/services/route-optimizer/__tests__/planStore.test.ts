/**
 * US-701 — the pure half of the plan store.
 *
 * The DB half is deliberately NOT unit-tested with a mock: a mock of our own code is
 * "a copy of itself" (founder law #5) and would prove nothing. It is proved on the live
 * box by the smoke test in the handoff. What IS testable without a database is the two
 * things that can silently ruin us: the uuid guard (a junk token must never reach SQL)
 * and the demand row (the business signal we write for every solve, including for a
 * visitor who told us nothing).
 */
import { isUuid, buildDemandRow } from '../planStore';

describe('isUuid — the guard that keeps junk out of the database', () => {
  it('accepts a real uuid', () => {
    expect(isUuid('3f1b8c3e-9d2a-4f1e-8b7a-1c2d3e4f5a6b')).toBe(true);
  });
  it('rejects a sequential id — the enumeration attack we designed the uuid to stop', () => {
    expect(isUuid('1042')).toBe(false);
  });
  it('rejects SQL, junk, empty and non-strings', () => {
    expect(isUuid("'; DROP TABLE saved_plans; --")).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(42)).toBe(false);
  });
});

describe('buildDemandRow — what even an anonymous visitor teaches us', () => {
  const base = {
    planId: '3f1b8c3e-9d2a-4f1e-8b7a-1c2d3e4f5a6b',
    request: 'My parents, my wife and me. Nine days. Varanasi and Khajuraho, in November.',
    cities: [
      { name: 'Delhi', nights: 0 },      // the gateway — passed through, not slept in
      { name: 'Varanasi', nights: 3 },
      { name: 'Khajuraho', nights: 2 },
    ],
    start: 'Delhi',
    end: null,
    month: 11,
    pax: 4,
    profile: 'senior',
    solved: true,
  };

  it('records the places he actually sleeps in, not the gateway he passes through', () => {
    expect(buildDemandRow(base).cities).toEqual(['Varanasi', 'Khajuraho']);
  });

  it('keeps the traveller\'s own words — the motivation is the richest field we have', () => {
    expect(buildDemandRow(base).requestText).toContain('My parents');
  });

  it('counts every night, including the ones in the gateway', () => {
    expect(buildDemandRow(base).nights).toBe(5);
  });

  it('marks a solved plan solved', () => {
    expect(buildDemandRow(base).outcome).toBe('solved');
  });

  it('marks an infeasible request infeasible, and keeps what we had to take away — this is the column that tells us where our supply is missing', () => {
    const row = buildDemandRow({ ...base, solved: false, dropped: ['Khajuraho'] });
    expect(row.outcome).toBe('infeasible');
    expect(row.droppedCities).toEqual(['Khajuraho']);
  });

  it('works for a visitor who told us nothing about himself — no plan id, no month', () => {
    const row = buildDemandRow({ ...base, planId: null, month: undefined, request: null });
    expect(row.planId).toBeNull();
    expect(row.month).toBeNull();
    expect(row.requestText).toBeNull();
    expect(row.cities).toEqual(['Varanasi', 'Khajuraho']); // still tells us where India wants to go
  });
});
