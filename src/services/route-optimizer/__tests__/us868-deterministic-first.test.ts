/**
 * US-868 — THE DETERMINISTIC-FIRST PARSER. CODE FIRST, AI LAST.
 *
 * The founder's ruling for session 12: reduce the use and dependence on AI. These tests
 * pin the skip rule (origin + duration + brief ⇒ Haiku is not called), the qualifier
 * doctrine, the verbatim-quote law for deterministic readings, and the Law-1 fence that
 * keeps a named town out of the shortcut. The three acceptance sentences are the
 * founder's own live tests (part-11 handoff §2, §6b, §6c), in the shape he wrote them.
 */

import { describe, expect, test } from 'bun:test';
import {
  deterministicParse, deterministicallyComplete, originFromText,
  comfortTierFromText, modeStancesFromText, monthFromText, partyFromText,
} from '../deterministicParse';
import { intentFromRaw, compileContract, verifyQuote, chipKeywordHits } from '../intent';
import { parseCacheKey, parseCacheHash } from '../parseCacheDb';

const ASK = { statedCities: false, statedStart: false, statedNights: false };
const PICK = { statedCities: true, statedStart: true, statedNights: false };

// The founder's three live-test sentences (handoff part-11: §2 the Kerala luxury couple,
// §6b the heritage couple, §6c the Madhya Pradesh wildlife couple).
const S1 = 'We are a couple from Lucknow and want a luxury trip to Kerala in November. '
  + 'We would prefer flights wherever possible. Up to 8 days maximum.';
const S2 = 'I am 56 years old and along with my wife want to cover the heritage cities of '
  + 'Karnataka starting from Bangalore. We would be flying from Delhi and want to fly back '
  + 'from Goa. We have 8 to 10 days.';
const S3 = 'We are a couple from Delhi and want an adventure and wildlife trip in Madhya '
  + 'Pradesh with jungle safaris. We want luxury hotels and vegetarian food. 7 days is enough.';

describe('US-868 — the founder\'s three sentences pay zero tokens', () => {
  test('S1 (Kerala luxury) — code fills origin + duration + region: Haiku is not called', () => {
    const det = deterministicParse(S1);
    expect(det.origin?.name).toBe('Lucknow');
    expect(det.nights?.maxNights).toBe(7);          // 8 DAYS is 7 nights, and a ceiling
    expect(det.nights?.bound).toBe('ceiling');
    expect(det.region?.region.key).toBe('kerala');
    expect(det.month?.month).toBe(11);
    expect(det.tier?.tier).toBe('luxury');
    expect(det.modes.some((m) => m.mode === 'air' && m.stance === 'prefer')).toBe(true);
    expect(deterministicallyComplete(det, ASK)).toBe(true);
  });

  test('S2 (Karnataka heritage) — the frame is not the door: origin is Delhi, not Bangalore', () => {
    const det = deterministicParse(S2);
    expect(det.frame.entry).toBe('Bangalore');
    expect(det.frame.exit).toBe('Goa');
    expect(det.origin?.name).toBe('Delhi');
    expect(det.nights?.bound).toBe('range');        // a range is TWO facts
    expect(det.nights?.minNights).toBe(7);
    expect(det.nights?.maxNights).toBe(9);
    expect(det.chips.some((c) => c.chip === 'Heritage & Forts')).toBe(true);
    expect(det.region?.region.key).toBe('karnataka');
    expect(deterministicallyComplete(det, ASK)).toBe(true);
  });

  test('S3 (Madhya Pradesh wildlife) — state name is the region; both his chips are heard', () => {
    const det = deterministicParse(S3);
    expect(det.origin?.name).toBe('Delhi');
    expect(det.region?.region.key).toBe('central_india');  // US-867: the state's own name
    expect(det.chips.some((c) => c.chip === 'Wildlife & Nature')).toBe(true);
    expect(det.chips.some((c) => c.chip === 'Trekking & Adventure')).toBe(true);
    expect(det.tier?.tier).toBe('luxury');
    expect(det.raw.composition).toBe('couple');
    expect(det.raw.pax).toBe(2);
    expect(deterministicallyComplete(det, ASK)).toBe(true);
  });
});

describe('US-868 — the deterministic he_said quote discipline', () => {
  test('every quote a reader emits is a VERBATIM substring of his sentence', () => {
    for (const s of [S1, S2, S3]) {
      const det = deterministicParse(s);
      for (const q of Object.values(det.raw.quotes ?? {})) {
        expect(verifyQuote(q, s)).not.toBeNull();
      }
    }
  });

  test('the composed raw survives intentFromRaw with he_said receipts, not inferences', () => {
    const det = deterministicParse(S1);
    det.raw.start = 'Lucknow';                       // what verifyCity would confirm
    const intent = intentFromRaw(det.raw, S1);
    expect(intent.origin.provenance).toBe('he_said');
    expect(intent.nights.provenance).toBe('he_said');
    expect(intent.month.provenance).toBe('he_said');
    expect(intent.comfortTier.provenance).toBe('he_said');
    expect(intent.comfortTier.value).toBe('luxury');
  });

  test('the compiled contract keeps his luxury and his flights — the 43-hour train stays dead', () => {
    const det = deterministicParse(S1);
    const intent = intentFromRaw(det.raw, S1);
    const c = compileContract(intent);
    expect(c.preferences.preferModes).toContain('AIR');
    expect(c.moneyRule).toBe('tiebreak_only');       // comfort-first surgery fired
    expect(c.rewardSwitches.hotelNightSaving).toBe(false);
  });
});

describe('US-868 — the qualifier doctrine (Law 2, deterministic)', () => {
  test('"no trains" is a refusal of the CATEGORY; "no long drives" is a ceiling on the ORDEAL', () => {
    const hits = modeStancesFromText('We want no trains and no long drives please.');
    const rail = hits.find((h) => h.mode === 'rail');
    const road = hits.find((h) => h.mode === 'road');
    expect(rail?.stance).toBe('refuse');
    expect(rail?.qualifier).toBe('any');
    expect(road?.stance).toBe('avoid');
    expect(road?.qualifier).toBe('long');
  });

  test('the golden sentence: "no trains or long road journeys" fires BOTH machineries', () => {
    const hits = modeStancesFromText(
      'I along with my wife wish to go on a romantic honeymoon. We want a luxury tour, '
      + 'so no trains or long road journeys for us. We love mountains and sea.');
    expect(hits.some((h) => h.mode === 'rail' && h.stance === 'refuse' && h.qualifier === 'any')).toBe(true);
    expect(hits.some((h) => h.mode === 'road' && h.stance === 'avoid' && h.qualifier === 'long')).toBe(true);
  });

  test('"no overnight trains" bans the overnight, not the rolling stock', () => {
    const hits = modeStancesFromText('Trains are fine but no overnight trains for my parents.');
    expect(hits.some((h) => h.mode === 'rail' && h.qualifier === 'overnight')).toBe(true);
    expect(hits.some((h) => h.mode === 'rail' && h.qualifier === 'any' && h.stance === 'refuse')).toBe(false);
  });
});

describe('US-868 — where code must stand aside', () => {
  test('the golden honeymoon sentence is NOT complete (no origin, no nights) — the model still runs', () => {
    const det = deterministicParse(
      'I along with my wife wish to go on a romantic honeymoon. We want a luxury tour, '
      + 'so no trains or long road journeys for us. We love mountains and sea.');
    expect(deterministicallyComplete(det, ASK)).toBe(false);
  });

  test('LAW 1 — a sentence that names a town surfaces it for the scan; the shortcut may not eat his city', () => {
    const det = deterministicParse('We are from Delhi and want a pilgrimage of 6 days. We must see Varanasi.');
    expect(deterministicallyComplete(det, ASK)).toBe(true);   // complete by the rule…
    expect(det.townCandidates).toContain('varanasi');          // …but the fence carries his city
  });

  test('the reader\'s own words never reach the town scan — origin, frame and region are excluded', () => {
    const det = deterministicParse(S2);
    expect(det.townCandidates).not.toContain('bangalore');     // frame entry
    expect(det.townCandidates).not.toContain('goa');           // frame exit
    expect(det.townCandidates).not.toContain('delhi');         // his door
    expect(det.townCandidates).not.toContain('karnataka');     // the region word
  });

  test('the pick path counts his FIELDS as filled facts — no Haiku on a pick', () => {
    const det = deterministicParse('any words at all');        // even a sentence code cannot read
    expect(deterministicallyComplete(det, PICK)).toBe(true);
  });
});

describe('US-868 — the small readers', () => {
  test('comfort tier keywords, verbatim', () => {
    expect(comfortTierFromText('a premium stay please')?.tier).toBe('premium');
    expect(comfortTierFromText('we want 5 star hotels')?.tier).toBe('luxury');
    expect(comfortTierFromText('a budget yatra')?.tier).toBe('budget');
    expect(comfortTierFromText('just a nice trip')).toBeNull();
  });

  test('"may" is a month only in travel context — an English verb may not become a date', () => {
    expect(monthFromText('we are travelling in May')?.month).toBe(5);
    expect(monthFromText('we may travel later this year')).toBeNull();
    expect(monthFromText('sometime in December')?.month).toBe(12);
  });

  test('the party reader: stated couples and explicit counts only — never a guess', () => {
    expect(partyFromText('I along with my wife')?.pax).toBe(2);
    expect(partyFromText('four of us are going')?.pax).toBe(4);
    expect(partyFromText('a wonderful holiday')).toBeNull();
  });

  test('origin reader still cuts the run-on: "PUNE, all in our twenties" yields Pune', () => {
    expect(originFromText('Four friends from Pune, all in our twenties.')?.name).toBe('Pune');
  });

  test('chip keywords carry the matched substring as the quote', () => {
    const hits = chipKeywordHits('we want jungle safaris and some trekking');
    const wild = hits.find((h) => h.chip === 'Wildlife & Nature');
    expect(wild).toBeDefined();
    expect('we want jungle safaris and some trekking'.includes(wild!.quote)).toBe(true);
  });
});

describe('US-869 — the permanent cache keys', () => {
  test('L1 and L2 share ONE normalisation — a sentence cannot live twice', () => {
    const a = parseCacheKey('  We are a COUPLE from   Lucknow. ');
    const b = parseCacheKey('we are a couple from lucknow.');
    expect(a).toBe(b);
    expect(parseCacheHash(a)).toBe(parseCacheHash(b));
    expect(parseCacheHash(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});
