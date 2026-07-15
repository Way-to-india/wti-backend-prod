/**
 * SPRINT C1 — LIBRARY CARDS. Turns retrieval winners (ScoredBranch[]) into offer cards,
 * reusing the EXACT circuit-card gating the controller already ships (US-853/871): stops
 * from our own tour_stays (circuitStays), the four gates (season/body/days/origin), the
 * day-by-day in OUR words (circuitItinerary — the ours-only law), the honest entry fact,
 * and the ready-to-POST pick body. Generalises the single named-circuit card to the N
 * branches the facets chose.
 *
 * PURE of any model. Every fact is our catalogue's own. A branch that no gate passes is
 * dropped from the offer and named in refusedProposals — never shown as a hollow card.
 */
import { circuitStays, circuitTourFacts, circuitItinerary } from './namedCircuitsDb';
import { gateProposals, buildShape, type EntryFact } from './proposalGates';
import { loadSeasonFacts, loadAccessFacts } from './placeFactsDb';
import { originFactsFor, airportsNear, flightSectorExists } from './themePool';
import { haversineKm } from './geo';
import type { Proposal } from './designer';
import type { ScoredBranch, ProofObject } from './library';

const lowc = (s: string) => s.trim().toLowerCase();

export interface LibraryCard {
  branchId: string;
  label: string;
  ourTourId: string | null;
  score: number;
  matchedChips: string[];
  missingChips: string[];
  evidenceCount: number;
  dayByDay: { day: number; title: string; description: string | null }[];
  card: any;                 // the shaped proposal (gates/shape/pick) — same shape the FE renders
}

export interface LibraryResponse {
  offered: LibraryCard[];
  refused: { stops: string[]; gate: string; reason: string }[];
}

/** Build gated cards for the offered branches. Returns offered cards (gates passed) and
 *  refused ones (named reasons). Non-fatal per branch: a branch that throws is skipped. */
export async function buildLibraryCards(opts: {
  offered: ScoredBranch[];
  request: string;
  measuredFrom: string | null;
  end: string | null;
  month: number | null;                 // 1..12, the same integer the controller holds
  saidNights: number | null;
  profile: 'standard' | 'family' | 'senior';
  pax: number;
}): Promise<LibraryResponse> {
  const { offered, request, measuredFrom, end, month, saidNights, profile, pax } = opts;
  const cards: LibraryCard[] = [];
  const refused: { stops: string[]; gate: string; reason: string }[] = [];

  for (const o of offered) {
    const tourId = o.branch.ourTourId;
    if (!tourId) continue;
    try {
      const [stays, tour, itinerary] = await Promise.all([
        circuitStays(tourId), circuitTourFacts(tourId), circuitItinerary(tourId),
      ]);
      if (!stays.length || !tour) continue;

      const proposal: Proposal = {
        stops: stays.map((st) => ({
          name: st.name, state: st.stateName, nights: Math.max(1, st.nights),
          nightsSource: 'catalogue_ai_parsed' as const,
          nightsWhy: `taken from our own ${tour.title} itinerary`,
          tier: 'designer_catalogue' as const,
          why: `part of our own ${tour.title}`,
          railheadNote: null, outOfRegion: false,
          foodStatus: 'unknown' as const, foodNote: null,
        })),
        totalNights: stays.reduce((s, x) => s + Math.max(1, x.nights), 0),
        shortfall: null, foodParagraph: null, gateway: null,
        tier: 'designer_catalogue', signal: 'built_before',
        signalVoice: o.branch.evidenceCount > 1
          ? `This is our own ${tour.title}, a route we run — ${o.branch.evidenceCount} of our journeys follow this shape. `
          : `This is our own ${tour.title} — a journey we run ourselves. `,
        cohesion: 0, rejected: [], alsoConsidered: [],
      };

      // gate facts — identical to the circuit path
      const coords = new Map(stays.map((s) => [lowc(s.name), [s.lat, s.lng] as [number, number]]));
      const elevations: Record<string, number> = {};
      for (const s of stays) if (s.elevationM != null) elevations[lowc(s.name)] = s.elevationM;
      const stayNames = stays.map((s) => s.name);
      const [seasons, access] = await Promise.all([loadSeasonFacts(stayNames), loadAccessFacts(stayNames)]);

      const entry = new Map<string, EntryFact | null>();
      if (measuredFrom && stays[0]) {
        const origin = await originFactsFor(measuredFrom);
        if (origin) {
          const first = stays[0];
          let fact: EntryFact = {
            hours: (haversineKm(origin.coord, [first.lat, first.lng]) * 1.3) / 55,
            how: 'ROAD', basis: 'estimated by road until we can prove a better way',
          };
          const oa = await airportsNear(origin.coord, 200, 3);
          const aa = oa.length ? await airportsNear([first.lat, first.lng], 150, 3) : [];
          outer:
          for (const a1 of oa) for (const a2 of aa) {
            if (await flightSectorExists(a1.city, a2.city)) {
              fact = { hours: 4.5 + a2.km / 60, how: 'AIR', basis: `a scheduled ${a1.city} → ${a2.city} flight exists` };
              break outer;
            }
          }
          entry.set(lowc(first.name), fact);
        }
      }

      const gated = gateProposals([proposal], {
        nightsCeiling: saidNights ?? 99,
        month: month ?? null,           // 1..12 integer (GateFacts.month), same as circuit path
        profile,
        coords, elevations, seasons, access, entry, originName: measuredFrom,
      }, { bodyEdits: false });

      if (!gated.offered.length) {
        const r = gated.refused[0];
        if (r) refused.push({ stops: r.proposal.stops.map((s) => s.name), gate: r.gate, reason: r.reason });
        continue;
      }
      const g = gated.offered[0];
      const pick = {
        request,
        cities: g.proposal.stops.map((s) => ({ name: s.name, nights: s.nights })),
        start: measuredFrom,
        end: end ?? null,
        ...(month ? { month } : {}),
        pax, profile,
        libraryTourId: tourId,   // C1 — the picked plan overlays this branch's own day text
      };
      const shaped = {
        ...g.proposal, gates: g.gates, gateNotes: g.gateNotes, whyForYou: null,
        shape: buildShape(entry.get(lowc(stays[0].name)) ?? null, null), pick,
        branchId: o.branch.id, label: o.branch.label, score: Math.round(o.score),
        matchedChips: o.matchedChips, missingChips: o.missingChips,
        evidenceCount: o.branch.evidenceCount,
      };
      cards.push({
        branchId: o.branch.id, label: o.branch.label, ourTourId: tourId,
        score: Math.round(o.score), matchedChips: o.matchedChips, missingChips: o.missingChips,
        evidenceCount: o.branch.evidenceCount, dayByDay: itinerary, card: shaped,
      });
    } catch (e) {
      console.error(`buildLibraryCards: branch ${o.branch.id} failed (non-fatal):`, e);
    }
  }
  return { offered: cards, refused };
}

/** A compact, human-readable summary of the proof for the payload (the full object is
 *  persisted server-side; the wire carries the gist). */
export function proofSummary(proof: ProofObject) {
  return {
    version: proof.version,
    aliasHit: proof.aliasHit,
    considered: proof.stage1_in,
    facetSurvivors: proof.stage1_survivors,
    served: proof.served,
    reason: proof.reason,
    excluded: proof.excluded.slice(0, 6),
    ranking: proof.ranked.slice(0, 6),
  };
}
