/**
 * US-840 — THE FOUR GATES. Days, origin, season, body. Each assertion below is a defect
 * class made unrepeatable:
 *
 *   - a 12-night Char Dham shown to a man with 5 nights (DAYS)
 *   - Kerala offered to a man in Guwahati with 4 days (ORIGIN)
 *   - the Char Dham offered in December, when the temples themselves are shut (SEASON)
 *   - Kedarnath — a 16 km mountain trek — offered to a senior who cannot walk far (BODY)
 */
import { describe, it, expect } from 'bun:test';
import { gateProposals, internalTravelDaysLowerBound, buildShape, type GateFacts, type EntryFact } from '../proposalGates';
import type { Proposal, ProposedStop } from '../designer';

const stop = (name: string, nights: number, state = 'Uttarakhand'): ProposedStop => ({
  name, state, nights, nightsSource: 'our_default', nightsWhy: 'test', tier: 'designer_catalogue',
  why: 'test', railheadNote: null, outOfRegion: false, foodStatus: 'unknown', foodNote: null,
});

const proposal = (stops: ProposedStop[]): Proposal => ({
  stops, totalNights: stops.reduce((s, x) => s + x.nights, 0), shortfall: null,
  foodParagraph: null, gateway: { name: 'Haridwar', code: 'HW', services: 100, kind: 'rail' },
  tier: 'designer_catalogue', signal: 'built_before', signalVoice: 'test', cohesion: 1,
  rejected: [], alsoConsidered: [],
});

const HARIDWAR: [number, number] = [29.9457, 78.1642];
const GUPTKASHI: [number, number] = [30.5288, 79.0781];
const KEDARNATH: [number, number] = [30.7346, 79.0669];
const BADRINATH: [number, number] = [30.7433, 79.4938];
const VARANASI: [number, number] = [25.3176, 82.9739];

const facts = (over: Partial<GateFacts> = {}): GateFacts => ({
  nightsCeiling: 8,
  month: null,
  profile: 'standard',
  coords: new Map([
    ['haridwar', HARIDWAR], ['guptkashi', GUPTKASHI], ['kedarnath', KEDARNATH],
    ['badrinath', BADRINATH], ['varanasi', VARANASI],
  ]),
  elevations: { kedarnath: 3583, badrinath: 3300, haridwar: 314 },
  seasons: [
    { place: 'Kedarnath', kind: 'closed', months: [11, 12, 1, 2, 3, 4], note: 'the temple closes for the winter' },
    { place: 'Badrinath', kind: 'closed', months: [11, 12, 1, 2, 3, 4], note: 'the temple closes for the winter' },
  ],
  access: [
    { place: 'Kedarnath', access: 'trek', magnitude: 'about 16 km mountain trek from Gaurikund', note: 'the temple is reached on foot, by pony or palki.' },
  ],
  entry: new Map(),
  originName: 'Lucknow',
  ...over,
});

describe('US-840 — GATE 1: DAYS (a 12-day trip is not shown to a 5-day man)', () => {
  it('refuses a circuit whose nights + travel lower bound exceed his ceiling', () => {
    const p = proposal([stop('Haridwar', 4), stop('Guptkashi', 4), stop('Badrinath', 4)]);
    const { offered, refused } = gateProposals([p], facts({ nightsCeiling: 5 }));
    expect(offered.length).toBe(0);
    expect(refused.length).toBe(1);
    expect(refused[0].gate).toBe('days');
    expect(refused[0].reason).toContain('You have 5');
  });
  it('passes a circuit that fits', () => {
    const p = proposal([stop('Haridwar', 2), stop('Guptkashi', 2)]);
    const { offered } = gateProposals([p], facts({ nightsCeiling: 8 }));
    expect(offered.length).toBe(1);
    expect(offered[0].gates.days).toBe('pass');
  });
  it('the travel bound is a LOWER bound — it can never exceed honest geometry', () => {
    // Haridwar→Varanasi is ~570 crow km; at 70 km/h that is ~8.2 h → 1 travel day floor'd.
    const d = internalTravelDaysLowerBound(['Haridwar', 'Varanasi'], facts().coords);
    expect(d).toBeLessThanOrEqual(1);
  });
});

describe('US-840 — GATE 2: ORIGIN (entry may not eat his holiday)', () => {
  it('refuses when getting there and back would eat more than 40% of his days', () => {
    const p = proposal([stop('Haridwar', 2), stop('Guptkashi', 1)]);
    const entry = new Map<string, EntryFact | null>([
      ['haridwar', { hours: 30, how: 'ROAD', basis: 'estimated by road' }],
    ]);
    const { refused } = gateProposals([p], facts({ nightsCeiling: 4, entry }));
    expect(refused.length).toBe(1);
    expect(refused[0].gate).toBe('origin');
  });
  it('passes a flyable entry, and says nothing it cannot prove when entry is unknown', () => {
    const p = proposal([stop('Haridwar', 2), stop('Guptkashi', 1)]);
    const entry = new Map<string, EntryFact | null>([
      ['haridwar', { hours: 5.5, how: 'AIR', basis: 'a scheduled sector exists' }],
    ]);
    const a = gateProposals([p], facts({ nightsCeiling: 8, entry }));
    expect(a.offered[0].gates.origin).toBe('pass');
    const b = gateProposals([p], facts({ nightsCeiling: 8 }));
    expect(b.offered[0].gates.origin).toBe('unknown');
  });
});

describe('US-840 — GATE 3: SEASON (the Char Dham is shut in winter, and we hold the month)', () => {
  it('refuses Kedarnath in December, naming the closure as the temple\'s own calendar', () => {
    const p = proposal([stop('Haridwar', 2), stop('Kedarnath', 2)]);
    const { refused } = gateProposals([p], facts({ month: 12 }));
    expect(refused.length).toBe(1);
    expect(refused[0].gate).toBe('season');
    expect(refused[0].reason).toContain('December');
    expect(refused[0].reason).toContain('closes for the winter');
  });
  it('passes the same circuit in May', () => {
    const p = proposal([stop('Haridwar', 2), stop('Kedarnath', 2)]);
    const { offered } = gateProposals([p], facts({ month: 5 }));
    expect(offered.length).toBe(1);
    expect(offered[0].gates.season).toBe('pass');
  });
  it('with NO month given, it never guesses — it flags that the month matters', () => {
    const p = proposal([stop('Haridwar', 2), stop('Kedarnath', 2)]);
    const { offered } = gateProposals([p], facts({ month: null }));
    expect(offered.length).toBe(1);
    expect(offered[0].gateNotes.join(' ')).toContain('Tell us your month');
  });
});

describe('US-840 — GATE 4: BODY (the safety gate — a trek shrine is never sold to a senior)', () => {
  it('removes Kedarnath BY NAME for a senior party and keeps the rest of the circuit', () => {
    const p = proposal([stop('Haridwar', 2), stop('Guptkashi', 2), stop('Kedarnath', 2)]);
    const { offered } = gateProposals([p], facts({ profile: 'senior', month: 5 }));
    expect(offered.length).toBe(1);
    const names = offered[0].proposal.stops.map((s) => s.name);
    expect(names).not.toContain('Kedarnath');
    expect(names).toContain('Haridwar');
    const rej = offered[0].proposal.rejected.find((r) => r.name === 'Kedarnath');
    expect(rej).toBeTruthy();
    expect(rej!.reason).toContain('16 km');
    // the nights were recomputed after the removal — no phantom nights
    expect(offered[0].proposal.totalNights).toBe(4);
  });
  it('does not remove it for a standard party', () => {
    const p = proposal([stop('Haridwar', 2), stop('Kedarnath', 2)]);
    const { offered } = gateProposals([p], facts({ profile: 'standard', month: 5 }));
    expect(offered[0].proposal.stops.map((s) => s.name)).toContain('Kedarnath');
  });
  it('altitude above 2,700 m earns a senior an advisory with the metres named', () => {
    const p = proposal([stop('Haridwar', 2), stop('Badrinath', 2)]);
    const { offered } = gateProposals([p], facts({ profile: 'senior', month: 5 }));
    expect(offered[0].gates.body).toBe('advisory');
    expect(offered[0].gateNotes.join(' ')).toContain('3300');
  });
});

describe('US-840 — THE SHAPE is existence facts + a declared deferral, never a service', () => {
  it('AIR shape only from a proven entry fact; the deferral sentence always rides along', () => {
    const s = buildShape({ hours: 5, how: 'AIR', basis: 'a scheduled Lucknow → Dehradun flight exists' }, null);
    expect(s.in.kind).toBe('AIR');
    expect(s.provisional).toBe(true);
    expect(s.note).toContain('confirm the exact');
  });
  it('falls to the rail gateway, then to an honest ROAD, never inventing an airport', () => {
    const s = buildShape(null, { name: 'Haridwar', code: 'HW', services: 100, kind: 'rail' });
    expect(s.in.kind).toBe('RAIL');
    const r = buildShape(null, null);
    expect(r.in.kind).toBe('ROAD');
  });
});

describe('US-853 — gate order and the un-edited sold tour', () => {
  it('when December kills the Char Dham AND the days are tight, the SEASON speaks, not the arithmetic', () => {
    const p = proposal([stop('Haridwar', 4), stop('Kedarnath', 4), stop('Badrinath', 4)]);
    const { refused } = gateProposals([p], facts({ month: 12, nightsCeiling: 5 }));
    expect(refused.length).toBe(1);
    expect(refused[0].gate).toBe('season');
    expect(refused[0].reason).toContain('closes for the winter');
  });
  it('with bodyEdits false, a senior gets the trek ADVISORY and the sold tour keeps its stop', () => {
    const p = proposal([stop('Haridwar', 2), stop('Kedarnath', 2)]);
    const { offered } = gateProposals([p], facts({ profile: 'senior', month: 5 }), { bodyEdits: false });
    expect(offered.length).toBe(1);
    expect(offered[0].proposal.stops.map((s) => s.name)).toContain('Kedarnath');
    expect(offered[0].gates.body).toBe('advisory');
    expect(offered[0].gateNotes.join(' ')).toContain('16 km');
  });
});
