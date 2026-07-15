/**
 * SPRINT C1 — THE LIBRARY (pure core). Pins the hashing, chip derivation, roles + night
 * classes, season/body derivation, and the retrieval funnel + proof object. No DB, no
 * model — every assertion is deterministic.
 */
import { describe, test, expect } from 'bun:test';
import {
  normAlias, structHash, seasonMaskFromBestTime, monthInMask, ALL_MONTHS, bodyClassFor,
  assignRoles, deriveBranchChips, hardFacets, scoreBranch, retrieve,
  type RawStop, type BranchLite, type QueryFacets,
} from '../library';
import { startGatewaySpan } from '../intent';
import { stripHtml } from '../namedCircuits';

describe('C1 — day text is plain prose, never CMS HTML', () => {
  test('tags removed, entities decoded, whitespace collapsed', () => {
    const html = '<p class="min-h-[1.5em] mb-4">Visit <strong>Meenakshi Amman temple</strong> &amp; the ghats.</p>';
    expect(stripHtml(html)).toBe('Visit Meenakshi Amman temple & the ghats.');
  });
  test('null/empty safe; plain text unchanged', () => {
    expect(stripHtml(null)).toBe('');
    expect(stripHtml('Just plain prose.')).toBe('Just plain prose.');
  });
});

describe('C1 — a starting gateway is not a destination', () => {
  test('"start my journey from Chennai or Madurai" → both are in the gateway span', () => {
    const span = (startGatewaySpan('I want a pilgrimage of south India. I can start my journey from Chennai or Madurai. Provide me ideas.') ?? '').toLowerCase();
    expect(span).toContain('chennai');
    expect(span).toContain('madurai');
  });
  test('a destination verb ends the span — "and visit Agra" is NOT swallowed', () => {
    const span = (startGatewaySpan('start my journey from Delhi and visit Agra') ?? '').toLowerCase();
    expect(span).toContain('delhi');
    expect(span).not.toContain('agra');
  });
  test('a plain origin phrase without start/begin does not match', () => {
    expect(startGatewaySpan('four friends from Pune, we love beaches')).toBeNull();
  });
});

describe('C1 — normalisation', () => {
  test('drops non-alnum and the letter h (spelling drift)', () => {
    expect(normAlias('Dharamshala')).toBe(normAlias('Dharamsala'));
    expect(normAlias('Nau Devi Yatra!')).toBe('naudeviyatra'.replace(/h/g, ''));
    expect(normAlias('9 Devi Darshan')).toBe('9devidarsan');
  });
  test('null/empty safe', () => { expect(normAlias(null)).toBe(''); expect(normAlias(undefined)).toBe(''); });
});

describe('C1 — structural hash (§10.4: town ids + entry/exit region, NOT nights)', () => {
  test('same towns + regions ⇒ same hash regardless of order of call', () => {
    expect(structHash(['a', 'b', 'c'], 'kerala', 'kerala'))
      .toBe(structHash(['a', 'b', 'c'], 'kerala', 'kerala'));
  });
  test('different town order ⇒ different hash', () => {
    expect(structHash(['a', 'b'], 'kerala', 'kerala'))
      .not.toBe(structHash(['b', 'a'], 'kerala', 'kerala'));
  });
  test('different entry region ⇒ different hash (from-Mumbai vs from-Pune stay distinct)', () => {
    expect(structHash(['a', 'b'], 'goa_konkan', 'central_india'))
      .not.toBe(structHash(['a', 'b'], 'central_india', 'central_india'));
  });
});

describe('C1 — season mask', () => {
  test('a range parses to its months; November is inside "October to March"', () => {
    const m = seasonMaskFromBestTime('October to March');
    expect(monthInMask(10, m)).toBe(true);   // Nov
    expect(monthInMask(6, m)).toBe(false);   // Jul
  });
  test('unparseable / all-year ⇒ every month admitted', () => {
    expect(seasonMaskFromBestTime('Round the year')).toBe(ALL_MONTHS);
    expect(seasonMaskFromBestTime(null)).toBe(ALL_MONTHS);
    expect(monthInMask(3, ALL_MONTHS)).toBe(true);
  });
  test('no month named ⇒ season can never refuse', () => {
    expect(monthInMask(null, seasonMaskFromBestTime('October to March'))).toBe(true);
  });
});

describe('C1 — body class from elevation', () => {
  test('thresholds', () => {
    expect(bodyClassFor(200)).toBe('standard');
    expect(bodyClassFor(1800)).toBe('moderate');
    expect(bodyClassFor(3000)).toBe('high_altitude');
    expect(bodyClassFor(4000)).toBe('strenuous');
    expect(bodyClassFor(null)).toBe('standard');
  });
});

describe('C1 — roles + night classes (§10.1)', () => {
  const stop = (name: string, nights: number, elev: number | null, themes: RawStop['themes']): RawStop =>
    ({ nodeId: name, name, nights, elevationM: elev, themes });
  test('an anchor-theme stop is ANCHOR + FIXED; a high stop first is RECOVERY + FIXED', () => {
    const stops: RawStop[] = [
      stop('Leh', 2, 3500, []),                                           // RECOVERY (acclimatise)
      stop('Nubra', 2, 3000, [{ chip: 'Hill Stations & Mountains', strength: 'anchor' }]),
      stop('Airportville', 1, 300, []),                                   // trailing gate → BUFFER
    ];
    const a = assignRoles(stops, ['Hill Stations & Mountains']);
    expect(a[0].role).toBe('RECOVERY'); expect(a[0].nightClass).toBe('FIXED');
    expect(a[1].role).toBe('ANCHOR');   expect(a[1].nightClass).toBe('FIXED');
    expect(a[2].role).toBe('BUFFER');   expect(a[2].nightClass).toBe('FLEXIBLE');
  });
  test('first 1-night themeless stop is a MANDATORY_GATE', () => {
    const stops: RawStop[] = [
      stop('Delhi', 1, 200, []),
      stop('Agra', 2, 200, [{ chip: 'Heritage & Forts', strength: 'anchor' }]),
    ];
    const a = assignRoles(stops, ['Heritage & Forts']);
    expect(a[0].role).toBe('MANDATORY_GATE');
    expect(a[1].role).toBe('ANCHOR');
  });
});

describe('C1 — chip derivation (union of stops\' anchor themes)', () => {
  test('adventure + wildlife from two different stops', () => {
    const stops: RawStop[] = [
      { nodeId: 'r', name: 'Rishikesh', nights: 2, elevationM: 400, themes: [{ chip: 'Trekking & Adventure', strength: 'anchor' }] },
      { nodeId: 'c', name: 'Corbett', nights: 2, elevationM: 400, themes: [{ chip: 'Wildlife & Nature', strength: 'anchor' }, { chip: 'Hill Stations & Mountains', strength: 'incidental' }] },
    ];
    const chips = deriveBranchChips(stops);
    expect(chips).toContain('Trekking & Adventure');
    expect(chips).toContain('Wildlife & Nature');
    expect(chips).not.toContain('Hill Stations & Mountains');   // incidental doesn't make coverage
  });
});

// ---- retrieval funnel ------------------------------------------------------------------
const branch = (over: Partial<BranchLite>): BranchLite => ({
  id: over.id ?? 'b1', label: over.label ?? 'Branch', ourTourId: over.ourTourId ?? 'tour-1',
  entryRegion: over.entryRegion ?? 'kerala', exitRegion: over.exitRegion ?? 'kerala',
  states: over.states ?? ['Kerala'], nightsMin: over.nightsMin ?? 6, nightsMax: over.nightsMax ?? 8,
  chips: over.chips ?? ['Honeymoon & Romance'], seasonMask: over.seasonMask ?? ALL_MONTHS,
  bodyClass: over.bodyClass ?? 'standard', evidenceCount: over.evidenceCount ?? 1,
  reversible: true, stops: over.stops ?? [{ name: 'Munnar', nights: 2, role: 'ANCHOR', themes: [] }],
});
const facets = (over: Partial<QueryFacets>): QueryFacets => ({
  chips: over.chips ?? [], regionStates: over.regionStates ?? null, regionKey: over.regionKey ?? null,
  measuredFrom: over.measuredFrom ?? null, monthIndex0: over.monthIndex0 ?? null,
  saidNights: over.saidNights ?? null, profile: over.profile ?? 'standard',
});

describe('C1 — STAGE 1 hard facets', () => {
  test('a branch outside the named region fails', () => {
    const b = branch({ states: ['Rajasthan'], entryRegion: 'rajasthan' });
    const r = hardFacets(b, facets({ regionStates: ['Kerala'], regionKey: 'kerala' }));
    expect(r.pass).toBe(false);
    expect(r.fails[0]).toContain('outside');
  });
  test('a branch touching the region passes', () => {
    const b = branch({ states: ['Kerala', 'Tamil Nadu'] });
    expect(hardFacets(b, facets({ regionStates: ['Kerala'], regionKey: 'kerala' })).pass).toBe(true);
  });
  test('season refuses a closed month', () => {
    const b = branch({ seasonMask: seasonMaskFromBestTime('October to March') });
    expect(hardFacets(b, facets({ monthIndex0: 6 })).pass).toBe(false);   // July
    expect(hardFacets(b, facets({ monthIndex0: 10 })).pass).toBe(true);   // Nov
  });
  test('a branch far longer than his ceiling is filtered (no tailor in C1)', () => {
    const b = branch({ nightsMin: 12, nightsMax: 14 });
    expect(hardFacets(b, facets({ saidNights: 7 })).pass).toBe(false);
  });
  test('a branch that anchors NONE of his named interests is excluded (§4b.2 coverage)', () => {
    const pilgrimage = branch({ chips: ['Pilgrimage'], states: ['Madhya Pradesh'], entryRegion: 'central_india' });
    const r = hardFacets(pilgrimage, facets({ chips: ['Wildlife & Nature', 'Trekking & Adventure'], regionStates: ['Madhya Pradesh'], regionKey: 'central_india' }));
    expect(r.pass).toBe(false);
    expect(r.fails.some((f) => f.includes('covers none of your interests'))).toBe(true);
  });
  test('a branch covering at least one named interest is kept', () => {
    const wild = branch({ chips: ['Wildlife & Nature'], states: ['Madhya Pradesh'], entryRegion: 'central_india' });
    expect(hardFacets(wild, facets({ chips: ['Wildlife & Nature', 'Trekking & Adventure'], regionStates: ['Madhya Pradesh'], regionKey: 'central_india' })).pass).toBe(true);
  });
});

describe('C1 — STAGE 2.5 scoring (100 minus NAMED penalties)', () => {
  test('a fully-covered branch scores near 100; every penalty is a sentence', () => {
    const b = branch({ chips: ['Honeymoon & Romance'], nightsMin: 7, nightsMax: 7 });
    const s = scoreBranch(b, facets({ chips: ['Honeymoon & Romance'], saidNights: 7 }));
    expect(s.score).toBeGreaterThanOrEqual(99);
    expect(s.missingChips.length).toBe(0);
  });
  test('an uncovered main motivation is penalised and named', () => {
    const b = branch({ chips: ['Wildlife & Nature'] });
    const s = scoreBranch(b, facets({ chips: ['Wildlife & Nature', 'Trekking & Adventure'] }));
    expect(s.missingChips).toContain('Trekking & Adventure');
    expect(s.penalties.some((p) => p.reason.includes('Trekking & Adventure'))).toBe(true);
    expect(s.score).toBeLessThan(90);
  });
  test('theme FOCUS — a temple circuit beats a wildlife tour that passes one shrine', () => {
    const pil = { chip: 'Pilgrimage', strength: 'anchor' as const };
    const wild = { chip: 'Wildlife & Nature', strength: 'anchor' as const };
    // every stop a temple (a real pilgrimage circuit)
    const circuit = branch({ id: 'temples', chips: ['Pilgrimage'], states: ['Tamil Nadu'], stops: [
      { name: 'Mahabalipuram', nights: 3, role: 'ANCHOR', themes: [pil] },
      { name: 'Madurai', nights: 2, role: 'ANCHOR', themes: [pil] },
    ] });
    // a wildlife tour where only one stop (of 10 nights) also anchors pilgrimage
    const wildlifeTour = branch({ id: 'wild', chips: ['Pilgrimage', 'Wildlife & Nature'], states: ['Karnataka'], stops: [
      { name: 'Bangalore', nights: 2, role: 'ANCHOR', themes: [pil, wild] },
      { name: 'Bandipur', nights: 8, role: 'ANCHOR', themes: [wild] },
    ] });
    const q = facets({ chips: ['Pilgrimage'], regionStates: ['Tamil Nadu', 'Karnataka'], regionKey: 'south_india' });
    const sc = scoreBranch(circuit, q).score;
    const sw = scoreBranch(wildlifeTour, q).score;
    expect(sc).toBeGreaterThan(sw);
    expect(scoreBranch(wildlifeTour, q).penalties.some((p) => p.reason.includes('% of the nights serve Pilgrimage'))).toBe(true);
  });
});

describe('C1 — retrieve() + PROOF OBJECT (§10.3)', () => {
  const branches: BranchLite[] = [
    branch({ id: 'kerala-hm', label: 'Kerala Honeymoon', chips: ['Honeymoon & Romance', 'Hill Stations & Mountains'], states: ['Kerala'], nightsMin: 8, nightsMax: 8 }),
    branch({ id: 'kerala-fam', label: 'Kerala Family', chips: ['Wildlife & Nature'], states: ['Kerala'], nightsMin: 6, nightsMax: 6 }),
    branch({ id: 'raj', label: 'Rajasthan Forts', chips: ['Heritage & Forts'], states: ['Rajasthan'], entryRegion: 'rajasthan', nightsMin: 7, nightsMax: 7 }),
  ];
  test('facet retrieval serves region matches, ranks by chip, and records the excluded with reasons', () => {
    const { offered, proof } = retrieve(branches, facets({ chips: ['Honeymoon & Romance'], regionStates: ['Kerala'], regionKey: 'kerala', saidNights: 8 }));
    expect(offered.length).toBeGreaterThanOrEqual(1);
    expect(offered[0].branch.id).toBe('kerala-hm');
    // Rajasthan excluded at the facet stage, with a spoken reason.
    const rajEx = proof.excluded.find((e) => e.branchId === 'raj');
    expect(rajEx).toBeTruthy();
    expect(rajEx!.reason).toContain('outside');
    expect(proof.served).toContain('kerala-hm');
    expect(proof.stage1_in).toBe(3);
  });
  test('an alias hit is served alone and the proof records the name match', () => {
    const { offered, proof } = retrieve(branches, facets({}), { aliasBranchId: 'raj', aliasQuote: 'the forts of Rajasthan' });
    expect(offered.length).toBe(1);
    expect(offered[0].branch.id).toBe('raj');
    expect(proof.aliasHit).toBe('the forts of Rajasthan');
  });
});
