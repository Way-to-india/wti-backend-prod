/**
 * US-853 — A FAMOUS CIRCUIT NAMED IS A DESTINATION ANSWERED.
 *
 * The live defect: a traveller wrote "I want to do a nau devi yatra" and was told to name
 * a city. And the founder's rule: close variants ("van durga yatra", "nav devi tour") must
 * reveal the intent — but a VARIANT is a reading, said out loud, correctable. These
 * assertions pin both.
 */
import { describe, it, expect } from 'bun:test';
import { resolveNamedCircuit, NAMED_CIRCUITS } from '../namedCircuits';

describe('US-853 — exact circuit names resolve with confidence "exact"', () => {
  it('nau devi yatra', () => {
    const m = resolveNamedCircuit('I want to do a nau devi yatra with my mother');
    expect(m?.circuit.key).toBe('nau_devi');
    expect(m?.confidence).toBe('exact');
    expect(m?.quote.toLowerCase()).toContain('nau devi');
  });
  it('9 devi temples / 9 durga temples / nine temples of durga', () => {
    expect(resolveNamedCircuit('we wish to visit the 9 devi temples')?.circuit.key).toBe('nau_devi');
    expect(resolveNamedCircuit('a 9 durga darshan please')?.circuit.key).toBe('nau_devi');
    expect(resolveNamedCircuit('the nine temples of durga')?.circuit.key).toBe('nau_devi');
  });
  it('char dham / chardham', () => {
    expect(resolveNamedCircuit('planning the Char Dham yatra in May')?.circuit.key).toBe('char_dham');
    expect(resolveNamedCircuit('chardham for my parents')?.circuit.key).toBe('char_dham');
  });
  it('12 jyotirlinga', () => {
    expect(resolveNamedCircuit('we want the 12 jyotirlinga darshan')?.circuit.key).toBe('jyotirlinga_12');
  });
  it('vaishno devi', () => {
    expect(resolveNamedCircuit('vaishno devi with the helicopter')?.circuit.key).toBe('vaishno_devi');
  });
});

describe('US-853 — spelling variants resolve, but as a READING he can correct', () => {
  it('van durga yatra (the founder\'s own example) reads as nau devi, confidence "variant"', () => {
    const m = resolveNamedCircuit('I want to do a van durga yatra');
    expect(m?.circuit.key).toBe('nau_devi');
    expect(m?.confidence).toBe('variant');
  });
  it('nav devi tour / navdurga / nao devi', () => {
    expect(resolveNamedCircuit('a Nav devi tour for the family')?.confidence).toBe('variant');
    expect(resolveNamedCircuit('navdurga darshan')?.circuit.key).toBe('nau_devi');
    expect(resolveNamedCircuit('nao devi yatra')?.circuit.key).toBe('nau_devi');
  });
  it('an exact name of one circuit beats a variant reading of another', () => {
    // "nau devi" (exact) must win even though "vaishno devi" (exact for another circuit)
    // is also present — nau devi is checked first in registry order, and Vaishno Devi is
    // one of the nine. Registry order is the ruling, pinned here so it cannot drift.
    const m = resolveNamedCircuit('nau devi yatra including vaishno devi');
    expect(m?.circuit.key).toBe('nau_devi');
  });
});

describe('US-853 — no false matches, and every circuit carries its receipt', () => {
  it('ordinary sentences do not match', () => {
    expect(resolveNamedCircuit('a beach break in Goa')).toBe(null);
    expect(resolveNamedCircuit('we love vandalism-free heritage towns')).toBe(null);
    expect(resolveNamedCircuit('a comfortable pilgrimage, flights preferred')).toBe(null);
  });
  it('every registry entry names its OWN tour — the receipt rule', () => {
    for (const c of NAMED_CIRCUITS) {
      expect(c.tourId.length).toBeGreaterThan(3);
      expect(c.exact.length).toBeGreaterThan(0);
      expect(c.note.length).toBeGreaterThan(10);
    }
  });
});
