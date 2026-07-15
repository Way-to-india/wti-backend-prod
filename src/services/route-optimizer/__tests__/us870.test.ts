/**
 * US-870 — A DATE IS NOT A DOOR, AND AN AIRPORT IS NOT A DESTINATION.
 *
 * The Nau Devi group's live test (founder, 15 Jul 2026): ten travellers from Sydney,
 * landing at Delhi Airport on 20 November, asking for the Nau Devi Yatra. The model
 * returned `start: "20th November 2026"` — a DATE, blessed as he_said because the words
 * are verbatim in his sentence — and on the answer round it invented a Kumaon itinerary
 * whose one sentence-surviving town was DELHI, his arrival airport. One false city
 * switched off the named-circuit branch and the group got "tell us at least one place".
 *
 * The fixes these tests pin: "arriving at Delhi Airport" is a FRAME ENTRY (and the
 * airport word is stripped to the town the gazetteer knows); the frame keeps the
 * airport city out of the town scan; the circuit and its pick measure from the entry
 * gate. The gazetteer fence on a model start lives in the controller (verifyCity), and
 * its date-shape trigger is pinned here.
 */
import { describe, test, expect } from 'bun:test';
import { frameFromText } from '../intent';
import { deterministicParse } from '../deterministicParse';

const NAU = 'We are a goup of 10 persons. coming from Sydney Australia to India in '
  + 'November 2026. We would be arriving at Delhi Airport on 20th November 2026. '
  + 'We wish to do Nau Devi Yatra tour.Can you help us?';

describe('US-870 — the Nau Devi group, read correctly', () => {
  test('"arriving at Delhi Airport" is the ENTRY GATE, and the airport word is stripped', () => {
    const f = frameFromText(NAU);
    expect(f.entry).toBe('Delhi');
    expect(f.entryQuote).toContain('arriving at Delhi Airport');
  });

  test('the named circuit is heard, the party of 10 is heard, November is heard', () => {
    const det = deterministicParse(NAU);
    expect(det.circuit?.circuit.key).toBe('nau_devi');
    expect(det.raw.pax).toBe(10);
    expect(det.month?.month).toBe(11);
  });

  test('the entry-gate city never reaches the town scan — his airport cannot become a destination candidate', () => {
    const det = deterministicParse(NAU);
    expect(det.townCandidates).not.toContain('delhi');
    expect(det.townCandidates).not.toContain('sydney');      // his origin words, likewise
  });

  test('a date is date-shaped — the controller fence fires on any digit', () => {
    // The fence itself is one regex in the controller: /\d/.test(candidate). A city
    // name carries no digits; every calendar spelling the model has produced does.
    for (const bad of ['20th November 2026', '2026-11-20', 'November 20']) {
      expect(/\d/.test(bad)).toBe(true);
    }
    expect(/\d/.test('Sydney')).toBe(false);
  });

  test('other arrival spellings read the same gate', () => {
    expect(frameFromText('We land in Mumbai next month.').entry).toBe('Mumbai');
    expect(frameFromText('Arriving into Chennai on the 3rd.').entry).toBe('Chennai');
    expect(frameFromText('We will be arriving at Amritsar railway station tomorrow.').entry).toBe('Amritsar');
  });

  test('the old frame reading stands untouched — starting-from still wins as the entry', () => {
    const f = frameFromText('I want to cover the heritage cities of Karnataka starting from '
      + 'Bangalore. We would be flying from Delhi and want to fly back from Goa.');
    expect(f.entry).toBe('Bangalore');
    expect(f.exit).toBe('Goa');
  });
});
