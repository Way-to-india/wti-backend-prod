/**
 * US-805 — THE DESIGNER. Tests.
 *
 * THE FIXTURES ARE THE REAL NORTH EAST, read off production on 2026-07-13. Not invented,
 * not rounded, not tidied: Guwahati's railhead really is IN the town (GHY, 146 services,
 * zero drive), Kaziranga's really is 138 minutes away, and Zunheboto's really is 206.
 *
 * A test built on invented data proves that the code agrees with my imagination. These
 * numbers are the ones the traveller will actually meet.
 */
import { describe, it, expect } from 'bun:test';
import {
  design, designAll, maxStops, railGate, pickAnchor, isGatewayOf, circuitVoice, RAILHEAD_DRIVE_HOURS,
  type Candidate, type DesignerBrief,
} from '../designer';
import type { StayNode, Gateway } from '../spine';
import type { DesignerMemory } from '../designerMemory';
import { nightsFromWords } from '../intent';

// ---- the real North East -------------------------------------------------------

const node = (
  name: string, state: string, admin1: string, tourCount: number,
  source: StayNode['source'] = 'wti_catalogue',
): StayNode => ({
  id: name.toLowerCase(), name, lat: 26, lng: 92, admin1Code: admin1, stateName: state,
  district: null, tourCount, source, guideUrl: null, hasOwnFoodNotes: false,
});

const rail = (code: string, name: string, services: number, roadMin: number | null): Gateway => ({
  kind: 'rail', role: 'primary', code, name, services,
  straightLineKm: roadMin == null ? 0 : roadMin, roadKm: roadMin == null ? null : roadMin, roadMin,
});
const air = (name: string, services: number, roadMin: number): Gateway => ({
  kind: 'air', role: 'primary', code: null, name, services,
  straightLineKm: roadMin, roadKm: roadMin, roadMin,
});

const cand = (n: StayNode, gws: Gateway[], attractions = 0, outOfRegion = false): Candidate =>
  ({ node: n, gateways: gws, attractions, outOfRegion });

// exactly as production has them
const GUWAHATI  = cand(node('Guwahati', 'Assam', '03', 6),        [rail('GHY', 'GUWAHATI - GHY', 146, 0),   air('Guwahati', 183, 0)], 5);
const SHILLONG  = cand(node('Shillong', 'Meghalaya', '18', 2),    [rail('GHY', 'GUWAHATI - GHY', 146, 75),  air('Guwahati', 183, 75)], 1);
const KAZIRANGA = cand(node('Kaziranga', 'Assam', '03', 2),       [rail('GHY', 'GUWAHATI - GHY', 146, 138), air('Guwahati', 183, 138)], 0);
const GANGTOK   = cand(node('Gangtok', 'Sikkim', '29', 4),        [rail('NJP', 'NEW JALPAIGURI - NJP', 180, 94), air('Bagdogra', 84, 94)], 0);
const ZUNHEBOTO = cand(node('Zunheboto', 'Nagaland', '20', 0, 'own_guide'), [rail('LMG', 'LUMDING JN - LMG', 79, 206)], 0);
const AIZAWL    = cand(node('Aizawl', 'Mizoram', '31', 0, 'own_guide'),     [rail('BPB', 'BAIRABI - BPB', 56, 146)], 0);
const TAWANG    = cand(node('Tawang', 'Arunachal Pradesh', '30', 0, 'own_guide'), []);   // no railhead at all
// over the border — our designers cross to them, and the founder ruled we may propose them
const DARJEELING = cand(node('Darjeeling', 'West Bengal', '28', 6), [rail('NJP', 'NEW JALPAIGURI - NJP', 180, 90)], 0, true);
const BAGDOGRA   = cand(node('Bagdogra', 'West Bengal', '28', 4),   [rail('NJP', 'NEW JALPAIGURI - NJP', 180, 15)], 0, true);

const POOL = [GUWAHATI, GANGTOK, KAZIRANGA, SHILLONG, ZUNHEBOTO, AIZAWL, TAWANG, DARJEELING, BAGDOGRA];

/** The real designer_cooccurrence rows for the North East. Both directions, as the DB holds them. */
const MEMORY: DesignerMemory = {
  pairs: [
    { city: 'Guwahati', pairsWith: 'Shillong',   designedTogether: 2, tier: 'designer_catalogue' },
    { city: 'Shillong', pairsWith: 'Guwahati',   designedTogether: 2, tier: 'designer_catalogue' },
    { city: 'Guwahati', pairsWith: 'Kaziranga',  designedTogether: 2, tier: 'designer_catalogue' },
    { city: 'Kaziranga', pairsWith: 'Guwahati',  designedTogether: 2, tier: 'designer_catalogue' },
    { city: 'Gangtok',  pairsWith: 'Darjeeling', designedTogether: 2, tier: 'designer_catalogue' },
    { city: 'Darjeeling', pairsWith: 'Gangtok',  designedTogether: 2, tier: 'designer_catalogue' },
    { city: 'Gangtok',  pairsWith: 'Bagdogra',   designedTogether: 2, tier: 'designer_catalogue' },
    { city: 'Bagdogra', pairsWith: 'Gangtok',    designedTogether: 2, tier: 'designer_catalogue' },
  ],
  nights: [
    { city: 'Guwahati',  nights: 1.1, timesDesigned: 7, tier: 'catalogue_ai_parsed', reconciled: true, agreementRate: 1 },
    { city: 'Shillong',  nights: 2.3, timesDesigned: 3, tier: 'catalogue_ai_parsed', reconciled: true, agreementRate: 1 },
    { city: 'Kaziranga', nights: 2.2, timesDesigned: 5, tier: 'catalogue_ai_parsed', reconciled: true, agreementRate: 1 },
    { city: 'Gangtok',   nights: 2.7, timesDesigned: 7, tier: 'catalogue_ai_parsed', reconciled: true, agreementRate: 1 },
    { city: 'Darjeeling', nights: 2.4, timesDesigned: 5, tier: 'catalogue_ai_parsed', reconciled: true, agreementRate: 1 },
  ],
};

/** THE MAN HIMSELF. 56 and 49, romantic, comfortable, trains not flights, ten days. */
const HIM: DesignerBrief = { nights: 9, railPreferred: true, romantic: true, comfortFirst: false, pace: 'steady' };

// ================================================================================
describe('US-805 — the hotel-change ceiling (every change buys a bad night)', () => {
  it('gives a romantic couple with nine nights THREE stops, not five', () => {
    expect(maxStops(HIM)).toBe(3);
  });

  it('lets a packed traveller move more often than a romantic one', () => {
    const packed = { ...HIM, romantic: false, pace: 'packed' as const };
    expect(maxStops(packed)).toBeGreaterThanOrEqual(maxStops(HIM));
  });

  it('never proposes more than five hotels, however long the trip', () => {
    expect(maxStops({ ...HIM, nights: 21, romantic: false, pace: 'packed' })).toBeLessThanOrEqual(5);
  });

  it('always proposes at least one', () => {
    expect(maxStops({ ...HIM, nights: 1 })).toBe(1);
  });
});

// ================================================================================
describe('US-805 — the gate HE set: he said trains', () => {
  it('passes Guwahati, and tells him he steps off the train and is there', () => {
    const g = railGate(GUWAHATI, HIM);
    expect(g.pass).toBe(true);
    expect(g.note).toContain('own railway station');
  });

  it('passes Kaziranga and NAMES THE DRIVE rather than letting him find it out on the day', () => {
    const g = railGate(KAZIRANGA, HIM);
    expect(g.pass).toBe(true);
    expect(g.note).toContain('Guwahati');
    expect(g.note).toContain('2.3 hours');
  });

  it('REFUSES a town whose railhead is a road journey away — in HIS words, not the engine\'s', () => {
    const g = railGate(ZUNHEBOTO, { ...HIM, comfortFirst: true });   // 206 min = 3.4 h > 3 h
    expect(g.pass).toBe(false);
    expect(g.reason).toContain('3.4 hours');
    expect(g.reason).toContain('rather travel by train');
    // LAW 5 — never the engine's reason.
    expect(g.reason).not.toContain('score');
    expect(g.reason).not.toContain('threshold');
  });

  it('refuses a town with no railhead at all, and offers him the honourable alternative', () => {
    const g = railGate(TAWANG, HIM);
    expect(g.pass).toBe(false);
    expect(g.reason).toContain('no railway station');
    expect(g.reason).toContain('flight');          // Law 4: an alternative, never a silent drop
  });

  it('TIGHTENS for a comfort-first party, and never loosens', () => {
    expect(RAILHEAD_DRIVE_HOURS.comfort_first).toBeLessThan(RAILHEAD_DRIVE_HOURS.standard);
    // Aizawl: 146 min = 2.4 h. Inside both ceilings.
    expect(railGate(AIZAWL, HIM).pass).toBe(true);
    expect(railGate(AIZAWL, { ...HIM, comfortFirst: true }).pass).toBe(true);
    // Zunheboto: 3.4 h. Inside the standard ceiling, outside the comfort one.
    expect(railGate(ZUNHEBOTO, HIM).pass).toBe(true);
    expect(railGate(ZUNHEBOTO, { ...HIM, comfortFirst: true }).pass).toBe(false);
  });

  it('does not apply the rail gate at all to a man who never asked for trains', () => {
    expect(railGate(TAWANG, { ...HIM, railPreferred: false }).pass).toBe(true);
  });
});

// ================================================================================
describe('US-805 — the anchor: where he steps off the train', () => {
  it('picks GUWAHATI over GANGTOK — a weaker station IN the town beats a stronger one 94 minutes away', () => {
    const a = pickAnchor(POOL, HIM);
    expect(a?.node.name).toBe('Guwahati');
    // and the reason is not a fudge: NJP genuinely has MORE trains than GHY.
    expect(GANGTOK.gateways[0].services).toBeGreaterThan(GUWAHATI.gateways[0].services);
  });

  it('never anchors on a town outside the region he named', () => {
    // Darjeeling has 6 tours — more than Guwahati's 6 and a fine railhead. It is still not
    // his region, and a region is a thing he SAID.
    const a = pickAnchor([DARJEELING, SHILLONG], HIM);
    expect(a?.node.name).toBe('Shillong');
  });

  it('returns null when nothing in the region survives his own gate', () => {
    expect(pickAnchor([TAWANG], HIM)).toBeNull();
  });
});

// ================================================================================
describe('US-805 — an airport is not a destination', () => {
  it('knows Bagdogra is where you LAND for Gangtok, not where you SLEEP', () => {
    expect(isGatewayOf(BAGDOGRA, [GANGTOK])).toBe(true);
  });

  it('does not mistake a real town for a gateway', () => {
    expect(isGatewayOf(SHILLONG, [GUWAHATI])).toBe(false);
  });

  it('never proposes Bagdogra as a stop, even though our designers pair it with Gangtok twice', () => {
    // Gangtok-only pool, so the growth step MUST reach for Bagdogra and MUST refuse it.
    const p = design([GANGTOK, BAGDOGRA, DARJEELING], MEMORY, HIM);
    expect(p!.stops.map((s) => s.name)).not.toContain('Bagdogra');
    expect(p!.rejected.some((r) => r.name === 'Bagdogra' && /airport/i.test(r.reason))).toBe(true);
  });
});

// ================================================================================
describe('US-805 — LAW 4: a nearly-true sentence is a lie with a good accent', () => {
  it('REFUSES to claim our designers built a circuit they never built', () => {
    // The truth, and it is awkward: Guwahati+Shillong (2) and Guwahati+Kaziranga (2) are ours.
    // SHILLONG AND KAZIRANGA HAVE NEVER APPEARED IN THE SAME TOUR. So "our designers have
    // built this circuit" is NEARLY true — and nearly true is the thing we banned.
    const v = circuitVoice(MEMORY, ['Guwahati', 'Shillong', 'Kaziranga']);
    expect(v.text).toContain('have not put');
    expect(v.text).toContain('Shillong and Kaziranga');
    expect(v.text).toContain('the joining of them is mine, not theirs');
    expect(v.text).toContain('a judgement and not a track record');
  });

  it('says "a handful of times" for two co-designs, and does NOT say "many times"', () => {
    const v = circuitVoice(MEMORY, ['Guwahati', 'Shillong']);
    expect(v.text).toContain('a handful of times');
    expect(v.text).not.toContain('many times');
    expect(v.signal).toBe('built_before');   // NOT well_trodden. Two is not eighty-two.
  });

  it('says "many times" only when our designers really have — eighty-two is not two', () => {
    const wellTrodden: DesignerMemory = {
      pairs: [{ city: 'Delhi', pairsWith: 'Jaipur', designedTogether: 29, tier: 'designer_catalogue' }],
      nights: [],
    };
    const v = circuitVoice(wellTrodden, ['Delhi', 'Jaipur']);
    expect(v.text).toContain('many times');
    expect(v.signal).toBe('well_trodden');
  });

  it('owns the choice out loud when our designers have never paired these towns', () => {
    const v = circuitVoice({ pairs: [], nights: [] }, ['Aizawl', 'Kohima']);
    expect(v.text).toContain('have not built these towns together');
    expect(v.signal).toBe('never_built');
  });
});

// ================================================================================
describe('US-805 — THE PROPOSAL: the catalogue answers the North-East traveller', () => {
  const p = design(POOL, MEMORY, HIM)!;

  it('proposes a TRIP, not a list of eight states and twelve towns', () => {
    expect(p).not.toBeNull();
    expect(p.stops.length).toBe(3);
  });

  it('RECOVERS our designers\' own answer — Guwahati, Shillong and Kaziranga. It does not invent one', () => {
    expect(p.stops.map((s) => s.name).sort()).toEqual(['Guwahati', 'Kaziranga', 'Shillong']);
  });

  it('NAMES THE STATE of every stop (founder ruling)', () => {
    for (const s of p.stops) expect(s.state).toBeTruthy();
    expect(p.stops.find((s) => s.name === 'Shillong')!.state).toBe('Meghalaya');
  });

  it('DECLARES THE TIER of every stop, and carries the count as the receipt', () => {
    for (const s of p.stops) expect(s.tier).toBe('designer_catalogue');
    expect(p.stops.find((s) => s.name === 'Guwahati')!.why).toContain('6 of our tours');
  });

  it('hangs the whole circuit off ONE railhead, because he asked for trains', () => {
    expect(p.gateway?.code).toBe('GHY');
    expect(p.gateway?.services).toBe(146);
    expect(p.gateway?.kind).toBe('rail');
  });

  it('FITS HIS TEN DAYS: five nights of stay, leaving the journey its due', () => {
    expect(p.totalNights).toBe(5);           // 1 + 2 + 2, from our own itineraries
    expect(p.totalNights).toBeLessThanOrEqual(HIM.nights);
  });

  it('grades the night counts honestly — a model\'s parse of our itineraries is not our designers\' hand', () => {
    const g = p.stops.find((s) => s.name === 'Guwahati')!;
    expect(g.nights).toBe(1);
    expect(g.nightsSource).toBe('catalogue_ai_parsed');
    expect(g.nightsWhy).toContain('our own tour itineraries');
  });

  it('SAYS HOW LOUD THE SIGNAL IS. Two co-designs is not eighty-two', () => {
    expect(p.signal).toBe('built_before');
    expect(p.signalVoice).toContain('a handful of times');
  });

  it('refuses Tawang by name even though it belongs to NO circuit — silence is forbidden', () => {
    // This was a real regression the moment circuits arrived: Tawang is in no cluster, so with
    // rejections computed per-circuit, NOBODY reported it and it vanished.
    expect(p.rejected.some((r) => r.name === 'Tawang')).toBe(true);
  });
});

// ================================================================================
// FOUNDER, 2026-07-13: "Why only one tour plan? There could have been 3 plans."
//
// HE IS RIGHT. The first cut found the circuits, picked the best, and demoted the rest to a
// sentence. A consultant who found two good answers and showed you one is not saving you
// effort — he is making your decision for you and calling it service.
// ================================================================================
describe('US-805b — every real trip in the region, not one and a footnote', () => {
  const trips = designAll(POOL, MEMORY, HIM);

  it('returns BOTH North-East circuits, not one', () => {
    expect(trips.length).toBe(2);
  });

  it('the first is the Assam circuit, in through Guwahati', () => {
    expect(trips[0].stops.map((s) => s.name).sort()).toEqual(['Guwahati', 'Kaziranga', 'Shillong']);
    expect(trips[0].gateway?.code).toBe('GHY');
  });

  it('the second is the Sikkim circuit, in through a DIFFERENT railhead', () => {
    const names = trips[1].stops.map((s) => s.name);
    expect(names).toContain('Gangtok');
    expect(names).toContain('Darjeeling');
    expect(trips[1].gateway?.code).toBe('NJP');       // New Jalpaiguri — a different corner
  });

  it('does NOT split Gangtok and Darjeeling into two trips — our designers built them TOGETHER', () => {
    // The founder asked for three. Our own catalogue pairs Gangtok with Darjeeling twice, so
    // splitting them would be US inventing a division our designers do not make.
    expect(trips.length).not.toBe(3);
    const sikkim = trips[1].stops.map((s) => s.name);
    expect(sikkim).toContain('Gangtok');
    expect(sikkim).toContain('Darjeeling');
  });

  it('still refuses Bagdogra in the Sikkim trip — it is the airport, not a night', () => {
    expect(trips[1].stops.map((s) => s.name)).not.toContain('Bagdogra');
  });

  it('carries the region-wide refusals into EVERY trip — he sees what we ruled out either way', () => {
    for (const t of trips) expect(t.rejected.some((r) => r.name === 'Tawang')).toBe(true);
  });

  it('never goes silent where our designers said nothing — it falls to Tier 2 and says so', () => {
    // A region we have written about but never sold in: no co-design clusters at all.
    const unsold = designAll([AIZAWL, ZUNHEBOTO], { pairs: [], nights: [] },
      { ...HIM, romantic: false, comfortFirst: false });
    expect(unsold.length).toBe(1);
    expect(unsold[0].stops.length).toBeGreaterThanOrEqual(1);
    expect(unsold[0].tier).toBe('transport_poi');     // and it DECLARES the weaker tier
  });

  it('returns nothing at all — and invents nothing — when the region truly has nothing', () => {
    expect(designAll([TAWANG], MEMORY, HIM)).toEqual([]);
  });

  it('does NOT pad a romantic couple\'s ten days with a town nobody has ever sold', () => {
    expect(trips[0].stops.map((s) => s.name)).not.toContain('Aizawl');
  });

  it('refuses Tawang IN HIS OWN WORDS, never in the engine\'s', () => {
    const t = trips[0].rejected.find((r) => r.name === 'Tawang')!;
    expect(t.reason).toContain('no railway station');
    expect(t.reason).toContain('flight');       // Law 4: an alternative, never a silent drop
    expect(t.reason).not.toContain('score');
  });
});

// ================================================================================
describe('US-805 — the border neighbour (founder ruling, 2026-07-13)', () => {
  it('PROPOSES a co-designed town over the border WITH ITS STATE NAMED, as a correctable chip', () => {
    // A Sikkim-only region: the catalogue's answer crosses into West Bengal, and it should.
    const p = design([GANGTOK, DARJEELING, BAGDOGRA], MEMORY, HIM)!;
    const d = p.stops.find((s) => s.name === 'Darjeeling');
    expect(d).toBeTruthy();
    expect(d!.state).toBe('West Bengal');     // NAMED. He can see it is not Sikkim, and strike it.
    expect(d!.outOfRegion).toBe(true);
  });

  it('keeps the REGION itself strict — a border town may be proposed, never anchored', () => {
    const p = design([GANGTOK, DARJEELING, BAGDOGRA], MEMORY, HIM)!;
    expect(p.stops[0].name).toBe('Gangtok');
    expect(p.stops[0].outOfRegion).toBe(false);
  });
});

// ================================================================================
describe('US-805 — the days he actually has', () => {
  it('DROPS the weakest stop rather than overrun his nights — and tells him it did', () => {
    // Gangtok (3 nights) + Darjeeling (2) is 5 nights of stay. He has four.
    const short: DesignerBrief = { ...HIM, nights: 4, romantic: false, pace: 'packed' };
    const p = design([GANGTOK, DARJEELING, BAGDOGRA], MEMORY, short)!;
    expect(p.totalNights).toBeLessThanOrEqual(4);
    const dropped = p.rejected.find((r) => /rushing the rest/.test(r.reason));
    expect(dropped).toBeTruthy();
    expect(dropped!.reason).toContain('4 nights');
    // and it is a HUMAN reason, not the engine's arithmetic
    expect(dropped!.reason).toContain('enjoy them');
  });

  it('gives a town we have never sold a plain two nights, and SAYS that is what it did', () => {
    const p = design([AIZAWL], { pairs: [], nights: [] }, { ...HIM, romantic: false })!;
    expect(p.stops[0].nights).toBe(2);
    expect(p.stops[0].nightsSource).toBe('our_default');
    expect(p.stops[0].nightsWhy).toContain('stand behind');
    expect(p.stops[0].tier).toBe('transport_poi');
  });
});

// ================================================================================
describe('US-805 — LAW 1: it cannot invent a place, and it does not fill a silence', () => {
  it('returns null for an empty region rather than making something up', () => {
    expect(design([], MEMORY, HIM)).toBeNull();
  });

  it('returns null when every town fails the gate HE set', () => {
    expect(design([TAWANG], MEMORY, HIM)).toBeNull();
  });

  it('only ever returns towns it was GIVEN — the output is a subset of the input, always', () => {
    const p = design(POOL, MEMORY, HIM)!;
    const given = new Set(POOL.map((c) => c.node.name));
    for (const s of p.stops) expect(given.has(s.name)).toBe(true);
  });

  it('ignores a town our designers know that our spine does not hold', () => {
    // The memory pairs Guwahati with Shillong, but the pool has no Shillong. We do not
    // conjure it from the pairing. A name in a pair is not a place.
    const p = design([GUWAHATI], MEMORY, HIM)!;
    expect(p.stops.map((s) => s.name)).toEqual(['Guwahati']);
  });
});

// ================================================================================
// THE DEFECT THE LIVE PAYLOAD FOUND, 2026-07-13 — and no unit test ever could have.
//
// He wrote "Up to 10 days maximum" and we recorded nights = null, 'we_need_it'. The echo
// panel would have told him we did not know how long his trip was, in the same breath as
// he told us. WE INVENTED HIS TRIP LENGTH WHILE HE WAS LOOKING AT US.
//
// AND THE FOUNDER'S CORRECTION, the same day, which is the harder half:
//   "Up to 10 days maximum does not mean 10 days is minimum too."
//   "Between 8 to 10 days does signify that minimum 8 days and maximum 10 days."
// A CEILING IS NOT A TARGET.
// ================================================================================
describe('US-805 — his trip length, in his own words', () => {
  const HIS_SENTENCE =
    'I am 56 and my wife is 49. We are looking to go on a romantic comfortable trip somewhere in '
    + 'north east India. We do not wish to spend too much money on flights and would prefer trains '
    + 'wherever possible. Up to 10 days maximum. Good budget hotels or max 3 star. We are '
    + 'vegetarians and do not consume even eggs.';

  it('READS HIS TEN DAYS out of the sentence the model threw away', () => {
    const r = nightsFromWords(HIS_SENTENCE);
    expect(r).not.toBeNull();
    expect(r!.maxNights).toBe(9);          // TEN DAYS IS NINE NIGHTS
    expect(r!.quote).toBe('10 days');      // HIS words, recovered — never composed
  });

  it('KNOWS A CEILING IS NOT A TARGET — "up to 10 days" sets no floor at all', () => {
    const r = nightsFromWords(HIS_SENTENCE)!;
    expect(r.bound).toBe('ceiling');
    expect(r.minNights).toBeNull();        // he has NOT asked for a ten-day trip
  });

  it('hears the ceiling however he phrases it', () => {
    for (const p of ['up to 10 days', '10 days maximum', 'max 10 days', 'no more than 10 days',
                     'within 10 days', 'at most 10 days']) {
      const r = nightsFromWords(`We are free, ${p}.`);
      expect(r!.bound).toBe('ceiling');
      expect(r!.maxNights).toBe(9);
    }
  });

  it('READS A RANGE AS TWO FACTS — "between 8 to 10 days" is a floor AND a ceiling', () => {
    const r = nightsFromWords('We can travel between 8 to 10 days.')!;
    expect(r.bound).toBe('range');
    expect(r.minNights).toBe(7);           // 8 days = 7 nights
    expect(r.maxNights).toBe(9);           // 10 days = 9 nights
  });

  it('reads a bare "10 days" as what he actually wants, not as a limit', () => {
    expect(nightsFromWords('We have 10 days for this trip.')!.bound).toBe('exact');
  });

  it('knows that ten days is NINE nights, not ten', () => {
    expect(nightsFromWords('we have 10 days')!.maxNights).toBe(9);
    expect(nightsFromWords('we have 10 nights')!.maxNights).toBe(10);
  });

  it('reads him when he writes the number as a word', () => {
    expect(nightsFromWords('we can spare ten days')!.maxNights).toBe(9);
  });

  it('STAYS SILENT on two loose quantities — it will not pass a guess off as his words', () => {
    // Neither number is the trip length. "You said 4 nights" would be a lie wearing HIS
    // words, which is worse than the honest "we need it" we say today.
    expect(nightsFromWords('3 days in Delhi and 4 days in Agra')).toBeNull();
  });

  it('is not fooled by his age, his wife\'s age, or his hotel stars', () => {
    expect(nightsFromWords('I am 56 and my wife is 49')).toBeNull();
    expect(nightsFromWords('good budget hotels or max 3 star')).toBeNull();
  });

  it('refuses a one-day trip rather than book a hotel for zero nights', () => {
    expect(nightsFromWords('just 1 day')).toBeNull();
  });

  it('says nothing at all when he said nothing at all', () => {
    expect(nightsFromWords('')).toBeNull();
    expect(nightsFromWords(null)).toBeNull();
    expect(nightsFromWords('we love the mountains')).toBeNull();
  });
});

// ================================================================================
describe('US-805 — the ceiling is never filled, but the floor is honoured', () => {
  it('does NOT pad a trip to reach a ceiling he merely tolerated', () => {
    // He allows 9 nights. Our designers give these towns 5. We give him 5, not 9.
    const p = design(POOL, MEMORY, HIM)!;
    expect(p.totalNights).toBe(5);
    expect(p.totalNights).toBeLessThan(HIM.nights);
  });

  it('HONOURS A FLOOR he actually gave — and gives the nights to towns, not to more towns', () => {
    // "between 8 and 10 days" -> floor 7 nights, ceiling 9.
    const ranged: DesignerBrief = { ...HIM, nights: 9, minNights: 7 };
    const p = design(POOL, MEMORY, ranged)!;
    expect(p.totalNights).toBeGreaterThanOrEqual(7);
    expect(p.totalNights).toBeLessThanOrEqual(9);
    // FEWER MOVES, NOT MORE SIGHTS: he gets extra nights, NOT a fourth packing morning.
    expect(p.stops.length).toBe(3);
    const extended = p.stops.find((s) => /at least 7 nights/.test(s.nightsWhy));
    expect(extended).toBeTruthy();
    expect(extended!.nightsWhy).toContain('another packing morning');
  });

  it('will not invent a town to fill his floor', () => {
    const greedy: DesignerBrief = { ...HIM, nights: 20, minNights: 19 };
    const p = design(POOL, MEMORY, greedy)!;
    const given = new Set(POOL.map((c) => c.node.name));
    for (const s of p.stops) expect(given.has(s.name)).toBe(true);
  });
});

// ================================================================================
// FOUNDER, 2026-07-13:
//   "If the efficient itinerary cannot stretch up to 8 days even when the user has
//    specified minimum 8 days, what would the system do?"
//
// IT SAYS SO. It does not quietly hand him six nights and hope he does not count them.
// ================================================================================
describe('US-805 — when we CANNOT reach the floor he asked for', () => {
  // He wants at least 19 nights. Three towns, capped at four nights each, is twelve.
  const GREEDY: DesignerBrief = { ...HIM, nights: 20, minNights: 19 };
  const p = design(POOL, MEMORY, GREEDY)!;

  it('does NOT go quiet and does NOT pad — it raises a shortfall', () => {
    expect(p.shortfall).not.toBeNull();
    expect(p.shortfall!.askedAtLeastNights).toBe(19);
    expect(p.shortfall!.weCanStandBehindNights).toBe(p.totalNights);
    expect(p.totalNights).toBeLessThan(19);
  });

  it('gives him THE FINDING — what we checked and what we found', () => {
    expect(p.shortfall!.finding).toContain('at least 19 nights');
    expect(p.shortfall!.finding).toContain('honestly stand behind');
  });

  it('gives him THE REASON, in his terms and not the engine\'s', () => {
    expect(p.shortfall!.reason).toContain('extra night it does not deserve');
    expect(p.shortfall!.reason).not.toContain('score');
    expect(p.shortfall!.reason).not.toContain('constraint');
  });

  it('gives him A NAMED ALTERNATIVE — never "please rephrase"', () => {
    expect(p.shortfall!.options.length).toBeGreaterThanOrEqual(2);
    // a real town, named, with its tier declared
    const add = p.shortfall!.options.find((o) => /^I can add /.test(o));
    expect(add).toBeTruthy();
    expect(add).toMatch(/Golaghat|Jorhat|Sibsagar|Aizawl|Gangtok|Zunheboto/);
    // and the honourable option of simply doing less, properly
    expect(p.shortfall!.options.some((o) => /do it properly/.test(o))).toBe(true);
  });

  it('STILL never invents a town, even under pressure to fill his days', () => {
    const given = new Set(POOL.map((c) => c.node.name));
    for (const st of p.stops) expect(given.has(st.name)).toBe(true);
  });

  it('raises NO shortfall when his floor was comfortably met', () => {
    expect(design(POOL, MEMORY, { ...HIM, nights: 9, minNights: 7 })!.shortfall).toBeNull();
  });

  it('raises NO shortfall when he set no floor at all', () => {
    expect(design(POOL, MEMORY, HIM)!.shortfall).toBeNull();
  });
});
