/**
 * THE RETURN-LEG BUILDER (founder principle, 15 Jul 2026) — a return to the ORIGIN cannot
 * be an open-path endpoint (the sequencer visits each city once). So a round trip sequences
 * the open path, then appends the origin as the ONE legal closing repeat.
 */
import { describe, test, expect } from 'bun:test';
import { sequenceOrder } from '../optimize';
import { repeatedCities } from '../sequence';

// symmetric cost matrix over 4 nodes: 0=Delhi(origin), 1,2,3 = stops
const M = [
  [0, 5, 9, 7],
  [5, 0, 3, 8],
  [9, 3, 0, 4],
  [7, 8, 4, 0],
];
const NAMES = ['Delhi', 'Dalhousie', 'Dharamsala', 'Amritsar'];

describe('return-leg builder', () => {
  test('round trip (end===start) closes back on the origin and visits every stop once', () => {
    const order = sequenceOrder(M, 0, 0);   // start = end = Delhi
    expect(order[0]).toBe(0);
    expect(order[order.length - 1]).toBe(0);            // closes home
    const names = order.map((i) => NAMES[i]);
    // exactly one legal repeat: the closing origin, nothing else
    expect(repeatedCities(names, { closingOrigin: true }).length).toBe(0);
    // every stop present
    for (const s of [1, 2, 3]) expect(order.includes(s)).toBe(true);
  });
  test('a distinct onward end is a normal fixed endpoint, no origin appended', () => {
    const order = sequenceOrder(M, 0, 3);   // Delhi → … → Amritsar (distinct)
    expect(order[0]).toBe(0);
    expect(order[order.length - 1]).toBe(3);
    expect(order.filter((i) => i === 0).length).toBe(1);   // origin appears once
  });
  test('a one-way (no end) is an open path, no closing repeat', () => {
    const order = sequenceOrder(M, 0, null);
    expect(order[0]).toBe(0);
    expect(order.filter((i) => i === 0).length).toBe(1);
  });
});
