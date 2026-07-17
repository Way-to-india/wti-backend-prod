/**
 * C1 — ALTERNATIVE CLASSIFICATION (founder rule, 2026-07-17). When a traveller names a
 * specific tour (e.g. the Navagraha planetary-temple tour) and a region (South India), the
 * OTHER tours we show must be classified, not dumped:
 *   - a true intent-PEER (same fine family) → "a few more that fit"
 *   - a broad temple journey IN the named region → "you may also like these temple journeys"
 *   - a national circuit that merely clips the region (Char Dham via Rameswaram), a wildlife
 *     tour, or an unrelated pilgrimage → DROPPED.
 * These pins guard the three pure decision atoms the controller composes from.
 */
import { describe, test, expect } from 'bun:test';
import { intentFamily, isTempleJourney, regionDominance } from '../library';

const SOUTH = ['Karnataka', 'Tamil Nadu', 'Kerala', 'Telangana', 'Andhra Pradesh', 'Puducherry'];

describe('intentFamily — fine motif beneath the coarse chips', () => {
  test('planetary temple asks read as celestial_temples', () => {
    expect(intentFamily('temples dedicated to planets in south india')).toBe('celestial_temples');
    expect(intentFamily('Navagraha Temple Tour Package From Chennai')).toBe('celestial_temples');
    expect(intentFamily('nav graha')).toBe('celestial_temples');
  });
  test('a future 27 Nakshatra temple tour joins the SAME family — so it becomes a "fit" with no code change', () => {
    expect(intentFamily('27 Nakshatra Temple Tour')).toBe('celestial_temples');
  });
  test('other pilgrimages get their OWN family, never celestial', () => {
    expect(intentFamily('Arupadai Veedu Tour')).toBe('murugan');
    expect(intentFamily('12 Jyotirlinga Tour Package')).toBe('jyotirlinga');
    expect(intentFamily('Char Dham Yatra In India')).toBe('char_dham');
  });
  test('a plain pilgrimage with no distinctive motif is generic — never an intent-equivalent', () => {
    expect(intentFamily('Sai Baba of Puttaparthi Tour')).toBe('generic');
    expect(intentFamily('Tour to Kerala')).toBe('generic');
  });
});

describe('isTempleJourney — the label is the honest signal (chips over-tag Pilgrimage)', () => {
  test('genuine temple tours qualify', () => {
    expect(isTempleJourney('Karnataka Temple Tour')).toBe(true);
    expect(isTempleJourney('Tamil Nadu Temples Tour')).toBe(true);
    expect(isTempleJourney('Tirupati Tour Package From Chennai')).toBe(true);
    expect(isTempleJourney('Rameshwaram Jyotirlinga Tour Package')).toBe(true);
  });
  test('a wildlife or beach tour that merely passes a shrine does NOT', () => {
    expect(isTempleJourney('Srisailam Wildlife Tour')).toBe(false);
    expect(isTempleJourney('Chennai Beach Tour')).toBe(false);
    expect(isTempleJourney('Kerala Honeymoon Holidays')).toBe(false);
    expect(isTempleJourney('Banerghatta National Park Tour')).toBe(false);
  });
});

describe('regionDominance — share IN the named region, not mere touch', () => {
  test('a wholly-South tour scores 1', () => {
    expect(regionDominance(['Tamil Nadu'], SOUTH)).toBe(1);
  });
  test('Char Dham (touches Tamil Nadu via Rameswaram) is dominated by the North → dropped by a 0.6 gate', () => {
    const charDham = ['Odisha', 'Maharashtra', 'Gujarat', 'Tamil Nadu', 'Delhi', 'Uttarakhand'];
    expect(regionDominance(charDham, SOUTH)).toBeLessThan(0.6);
  });
  test('the 12 Jyotirlinga national circuit clips South but is not of it', () => {
    const jyot = ['Uttarakhand', 'Delhi', 'Maharashtra', 'Gujarat', 'Madhya Pradesh', 'Telangana', 'Andhra Pradesh', 'Tamil Nadu', 'Uttar Pradesh', 'Jharkhand'];
    expect(regionDominance(jyot, SOUTH)).toBeLessThan(0.6);
  });
  test('no region named ⇒ everything qualifies (dominance 1)', () => {
    expect(regionDominance(['Uttarakhand'], null)).toBe(1);
  });
});

describe('the founder scenario — Navagraha + South India', () => {
  // the exact classification the controller runs, expressed on labels+states
  const famUser = intentFamily('temples dedicated to planets in south india');
  const classify = (label: string, states: string[]) => {
    const dom = regionDominance(states, SOUTH);
    if (famUser !== 'generic' && intentFamily(label) === famUser && dom > 0) return 'fit';
    if (dom >= 0.6 && isTempleJourney(label)) return 'also';
    return 'drop';
  };
  test('Char Dham and 12 Jyotirlinga are dropped, not shown as fits', () => {
    expect(classify('Char Dham Yatra In India', ['Odisha', 'Maharashtra', 'Gujarat', 'Tamil Nadu', 'Delhi', 'Uttarakhand'])).toBe('drop');
    expect(classify('12 Jyotirlinga Tour Package from Delhi', ['Uttarakhand', 'Delhi', 'Maharashtra', 'Gujarat', 'Madhya Pradesh', 'Telangana', 'Andhra Pradesh', 'Tamil Nadu', 'Uttar Pradesh', 'Jharkhand'])).toBe('drop');
  });
  test('Sai Baba (generic South pilgrimage, not a temple journey by name) is dropped from the temple list', () => {
    expect(classify('Sai Baba of Puttaparthi Tour', ['Andhra Pradesh'])).toBe('drop');
  });
  test('clean South temple tours land in "also like"', () => {
    expect(classify('Karnataka Temple Tour', ['Karnataka'])).toBe('also');
    expect(classify('Tamil Nadu Temples Tour', ['Tamil Nadu'])).toBe('also');
  });
  test('a future 27 Nakshatra Temple Tour in the South would be a real FIT', () => {
    expect(classify('27 Nakshatra Temple Tour', ['Tamil Nadu'])).toBe('fit');
  });
});
