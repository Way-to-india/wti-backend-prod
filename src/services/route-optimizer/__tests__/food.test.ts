/**
 * US-806 — THE FOOD GATE. Tests.
 *
 * "We are vegetarians and do not consume even eggs."
 *
 * THE TABLE IS EMPTY TODAY, AND MOST OF THESE TESTS PIN WHAT WE SAY WHEN WE DO NOT KNOW.
 * That is not a gap in the suite. It is the suite holding us to the only thing that keeps a
 * travel company honest: a man of 56 and his wife must never be sat in front of a plate they
 * cannot eat, in a town they cannot leave, on a holiday we sold them.
 */
import { describe, it, expect } from 'bun:test';
import {
  foodNeedFromWords, foodStatus, foodVoiceFor, foodParagraph, foodRank, NEED_RANK,
  type FoodFact,
} from '../food';

const fact = (over: Partial<FoodFact> = {}): FoodFact => ({
  stayNodeId: 'x', pureVegKitchen: null, jainKitchen: null, places: [],
  source: 'own_executive', sourceUrl: null, verifiedAt: '2026-07-13T00:00:00Z', ...over,
});

const HIS_WORDS = 'We are vegetarians and do not consume even eggs.';

describe('US-806 — reading what he actually said', () => {
  it('hears the word EVEN, and raises the bar because of it', () => {
    // "we do not consume EVEN eggs" is not "we are vegetarian". He is pre-empting the answer
    // he has been given before, by people who thought an omelette was vegetarian.
    const r = foodNeedFromWords(HIS_WORDS)!;
    expect(r.need).toBe('pure_veg_no_egg');
    expect(r.quote.toLowerCase()).toContain('egg');
  });

  it('does not promote a plain vegetarian to a no-egg vegetarian', () => {
    expect(foodNeedFromWords('We are vegetarian.')!.need).toBe('vegetarian');
  });

  it('hears Jain, which is stricter still', () => {
    expect(foodNeedFromWords('We need Jain food please.')!.need).toBe('jain');
  });

  it('says nothing when he said nothing about food', () => {
    expect(foodNeedFromWords('We love the mountains and the sea.')).toBeNull();
    expect(foodNeedFromWords('')).toBeNull();
  });

  it('reads "pure veg" as no-egg even without the word egg', () => {
    expect(foodNeedFromWords('pure veg only')!.need).toBe('pure_veg_no_egg');
  });
});

describe('US-806 — the three honest answers, and reassurance is not among them', () => {
  it('SAYS "I HAVE NOT CHECKED" when we have not checked — it does not say "it will be fine"', () => {
    expect(foodStatus(null, 'pure_veg_no_egg')).toBe('unknown');
    const v = foodVoiceFor('Shillong', null, 'pure_veg_no_egg')!;
    expect(v).toContain('not yet checked');
    expect(v).toContain('I will not tell you I have');
    expect(v).not.toContain('should be fine');
  });

  it('NEVER reads a missing row as "there is no vegetarian food here"', () => {
    // An empty row is a fact about OUR SURVEY, not about Assam. Lying with a null is still lying.
    expect(foodStatus(null, 'pure_veg_no_egg')).not.toBe('cannot_feed_him');
    expect(foodRank(null, 'pure_veg_no_egg')).toBe(0);   // neither rewarded nor punished
  });

  it('says YES only when a human has verified it', () => {
    const verified = fact({ pureVegKitchen: true, places: [{ name: 'Ganesh Bhojanalaya', note: null }] });
    expect(foodStatus(verified, 'pure_veg_no_egg')).toBe('ok');
    expect(foodVoiceFor('Guwahati', verified, 'pure_veg_no_egg')).toContain('Ganesh Bhojanalaya');
    expect(foodVoiceFor('Guwahati', verified, 'pure_veg_no_egg')).toContain('checked the kitchen ourselves');
  });

  it('REFUSES to use an UNVERIFIED row, however confident it looks', () => {
    // A row with pureVegKitchen: true and no human sign-off is exactly the fabrication risk.
    const unverified = fact({ pureVegKitchen: true, verifiedAt: null });
    expect(foodStatus(unverified, 'pure_veg_no_egg')).toBe('unknown');
  });

  it('says NO — and drops the town — when we looked and there is nothing', () => {
    const looked = fact({ pureVegKitchen: false });
    expect(foodStatus(looked, 'pure_veg_no_egg')).toBe('cannot_feed_him');
    expect(foodRank(looked, 'pure_veg_no_egg')).toBe(-1);
    expect(foodVoiceFor('Kohima', looked, 'pure_veg_no_egg')).toContain('rather lose the town');
  });
});

describe('US-806 — the asymmetry IS the gate', () => {
  it('a Jain kitchen feeds a pure-vegetarian traveller', () => {
    expect(foodStatus(fact({ jainKitchen: true }), 'pure_veg_no_egg')).toBe('ok');
  });

  it('but a pure-vegetarian kitchen does NOT feed a Jain traveller', () => {
    expect(foodStatus(fact({ pureVegKitchen: true, jainKitchen: false }), 'jain')).toBe('cannot_feed_him');
  });

  it('a pure-vegetarian kitchen feeds a plain vegetarian', () => {
    expect(foodStatus(fact({ pureVegKitchen: true }), 'vegetarian')).toBe('ok');
  });

  it('and the ranking never lets a weaker offer satisfy a stronger need', () => {
    expect(NEED_RANK.jain).toBeGreaterThan(NEED_RANK.pure_veg_no_egg);
    expect(NEED_RANK.pure_veg_no_egg).toBeGreaterThan(NEED_RANK.vegetarian);
  });

  it('lets a man who asked for nothing eat anywhere', () => {
    expect(foodStatus(null, 'none')).toBe('ok');
    expect(foodVoiceFor('Anywhere', null, 'none')).toBeNull();
  });
});

describe('US-806 — the paragraph he actually reads', () => {
  const towns = [
    { name: 'Guwahati', status: 'unknown' as const },
    { name: 'Kaziranga', status: 'unknown' as const },
    { name: 'Shillong', status: 'unknown' as const },
  ];

  it('quotes HIS words back, and calls it a rule rather than a preference', () => {
    const p = foodParagraph('pure_veg_no_egg', 'do not consume even eggs', towns)!;
    expect(p).toContain('do not consume even eggs');
    expect(p).toContain('a rule, not a preference');
  });

  it('ADMITS what we have not checked, by name, and refuses to comfort him', () => {
    const p = foodParagraph('pure_veg_no_egg', 'do not consume even eggs', towns)!;
    expect(p).toContain('I have NOT yet checked');
    expect(p).toContain('Guwahati, Kaziranga and Shillong');
    expect(p).toContain('not going to tell you it will be fine when I do not know');
  });

  it('gives him a WAY FORWARD before he pays anything — never a shrug', () => {
    const p = foodParagraph('pure_veg_no_egg', 'do not consume even eggs', towns)!;
    expect(p).toContain('Before you pay us anything');
    expect(p).toContain('come back to you with the names');
    expect(p).toContain('we will change the trip');
  });

  it('says plainly that he can eat everywhere ONLY when every town is verified', () => {
    const allOk = towns.map((t) => ({ ...t, status: 'ok' as const }));
    const p = foodParagraph('pure_veg_no_egg', null, allOk)!;
    expect(p).toContain('checked every town');
    expect(p).not.toContain('NOT yet checked');
  });

  it('stays silent for a traveller who never raised food', () => {
    expect(foodParagraph('none', null, towns)).toBeNull();
  });
});
