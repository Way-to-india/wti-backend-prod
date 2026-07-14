/**
 * US-854 — WHERE THE MEMORY IS ALL SINGLETONS, GEOGRAPHY MAY PROPOSE ONE JOINED TRIP.
 * The Karnataka heritage case: pool = Mysore, Hassan, Hampi (no designer pairs among
 * them) → the offer was three LONE towns. A traveller who asked for "cities" plural was
 * answered in the singular. The joined trip leads now, and the voice owns the joining.
 */
import { describe, it, expect } from 'bun:test';
import { designAll, type Candidate, type DesignerBrief } from '../designer';
import { EMPTY_MEMORY } from '../designerMemory';
import type { StayNode } from '../spine';

const node = (name: string, lat: number, lng: number, tourCount: number): StayNode => ({
  id: name.toLowerCase(), name, lat, lng, admin1Code: '19', stateName: 'Karnataka',
  district: null, tourCount, source: 'wti_catalogue', guideUrl: null, hasOwnFoodNotes: false,
});
const cand = (n: StayNode): Candidate => ({ node: n, gateways: [], attractions: 3, outOfRegion: false, food: null });

const brief: DesignerBrief = {
  nights: 8, minNights: null, railPreferred: false, romantic: false,
  comfortFirst: false, pace: 'steady', foodNeed: 'none', foodQuote: null,
};

describe('US-854 — all-singleton memory yields a JOINED geographic trip, said honestly', () => {
  const pool = [
    cand(node('Mysore', 12.2958, 76.6394, 3)),
    cand(node('Hassan', 13.0068, 76.0996, 1)),
    cand(node('Hampi', 15.335, 76.46, 2)),
  ];
  it('the first proposal has more than one town', () => {
    const out = designAll(pool, EMPTY_MEMORY, brief);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].stops.length).toBeGreaterThan(1);
  });
  it('and the voice owns the joining — designers did not build it, and we say so', () => {
    const out = designAll(pool, EMPTY_MEMORY, brief);
    expect(out[0].signalVoice.toLowerCase()).toContain('not built these towns together');
  });
  it('a town further than 400 km from the chain is not dragged in', () => {
    const far = [...pool, cand(node('Bikaner', 28.0229, 73.3119, 5))];
    const out = designAll(far, EMPTY_MEMORY, brief);
    expect(out[0].stops.map((s) => s.name)).not.toContain('Bikaner');
  });
});
