// =============================================================================
// US-857 — AN EMPTY LIST IS NOT A STATED LIST.
//
// The public page has ALWAYS sent `cities: []` beside the traveller's sentence.
// Guards that asked `!Array.isArray(body.cities)` to mean "no structured cities"
// were switched OFF by that empty array — so US-854 never removed the frame and
// US-853b never removed his home, for every real page traveller. The Karnataka
// acceptance sentence shipped Delhi → Bangalore → Goa: the frame flown, the
// heritage skipped. Found by posting THE PAGE'S OWN BODY at the live endpoint —
// the 18-traveller sweep had omitted the key, and so tested a request shape the
// page never sends.
// =============================================================================
import { describe, expect, it } from 'bun:test';
import { isStatedCityList } from '../intent';

describe('US-857 — an empty list is not a stated list', () => {
  it('an empty cities array is NOT a stated list (the page always sends one)', () => {
    expect(isStatedCityList([])).toBe(false);
  });
  it('an absent / non-array value is not a stated list either', () => {
    expect(isStatedCityList(undefined)).toBe(false);
    expect(isStatedCityList(null)).toBe(false);
    expect(isStatedCityList('Delhi')).toBe(false);
  });
  it('a list with a city in it IS his word — the named-cities fence (Law 1) holds', () => {
    expect(isStatedCityList([{ name: 'Jaipur', nights: 2 }])).toBe(true);
  });
});
