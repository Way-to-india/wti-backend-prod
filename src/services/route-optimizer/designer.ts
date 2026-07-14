/**
 * US-805 — THE DESIGNER. Sprint 8. THE SELECTION ENGINE.
 *
 * THE FAILURE THIS ENDS:
 *
 *   US-800b stopped the planner turning a region away. But it hands the traveller a LIST —
 *   eight states and twelve towns — and asks him to choose.
 *
 *   A LIST IS NOT A DESIGNER. A seasoned consultant does not hand a man twelve towns and
 *   ask which he likes. HE PROPOSES. He says: "In ten days, by train, I would give you
 *   Guwahati, Shillong and Kaziranga." The man who says "you are the expert, where should
 *   we go?" is the one who most needs us, and a list is how we tell him we are not.
 *
 * This module PROPOSES. Given the candidate towns of a region, the designers' memory, and
 * his brief, it chooses a SET and says why — and, just as loudly, why not.
 *
 * ==============================================================================
 * PURE. No DB, no network, no clock. The controller injects everything.
 * (Same doctrine as spine.ts / designerMemory.ts / intent.ts.)
 *
 * IT DOES NOT ROUTE. It does not sequence, price, or gate a body. It picks the SET and
 * hands it to the Sprint-7 engine, which already knows how to order it, refuse what a body
 * cannot take, and explain every refusal in the traveller's own words. THE DESIGNER CHOOSES
 * WHERE. THE ENGINE DECIDES HOW. Blur that and we will have two planners disagreeing.
 *
 * ==============================================================================
 * THE FOUR LAWS OF THIS FILE
 *
 * LAW 1 — NOTHING IS INVENTED. Every town proposed here is a StayNode we have SOLD or
 *   WRITTEN. This module cannot create a place; it has no way to. It receives candidates
 *   and returns a subset of them. If the region is empty, it proposes nothing and says so.
 *
 * LAW 2 — THE TIER IS DECLARED, AND SO IS ITS LOUDNESS. Two co-designs is not eighty-two.
 *   "Our designers have built this before, a handful of times" is a DIFFERENT PROMISE from
 *   "we have sold this route eighty times", and he is entitled to know which he is getting.
 *   Hence `signal` and `circuitVoice()`.
 *
 * LAW 3 — EVERY REJECTION SPEAKS IN HIS OWN WORDS, AND IS WRITTEN AT REJECTION TIME.
 *   Not "score below threshold". He said he would rather take trains; so Zunheboto is
 *   refused because its railhead is three and a half hours of road away, and we tell him
 *   that in a sentence he would use himself. (THE-CONSULTANTS-LAW, Laws 4 and 5.)
 *
 * LAW 4 — A NEARLY-TRUE SENTENCE IS A LIE WITH A GOOD ACCENT.
 *   Our designers put Guwahati with Shillong (twice) and Guwahati with Kaziranga (twice).
 *   THEY NEVER BUILT ALL THREE AS ONE TRIP. So we may not say "our designers built this
 *   circuit". We say exactly what they did, and we say that the joining is OURS. That
 *   distinction is the whole difference between a consultant and a confident guess.
 */

import type { StayNode, Gateway } from './spine';
import { nodeTier, nodeVoice, railReachable, gatewayDriveHours } from './spine';
import { haversineKm } from './geo';
import type { DesignerMemory, Tier, Confidence } from './designerMemory';
import { coDesignStrength, coDesignedWith, pairConfidence, nightsWeCanStandBehind } from './designerMemory';
import type { FoodFact, FoodNeed, FoodStatus } from './food';
import { foodStatus, foodVoiceFor, foodParagraph, foodRank } from './food';

// ---- what he told us -----------------------------------------------------------

/**
 * The brief, reduced to what the SELECTION actually turns on. Compiled by the controller
 * from the Sprint-7 `TravellerIntent` — this module never parses a sentence.
 */
export interface DesignerBrief {
  /**
   * THE CEILING. The MOST nights he will accept — never a target to be filled.
   *
   * FOUNDER, 2026-07-13: "Up to 10 days maximum does not mean 10 days is minimum too."
   * So nothing in this file pads a trip to reach this number. It only ever refuses to
   * exceed it. A man who tells us where his patience ends has not asked us to test it.
   */
  nights: number;
  /**
   * THE FLOOR, and ONLY when he gave one. "Between 8 and 10 days" is TWO facts, and a man
   * who says it and is handed four nights has been ignored just as surely as one who is
   * handed twelve. Null means he set no floor, and we may propose a short trip in peace.
   */
  minNights?: number | null;
  /** "we would prefer trains wherever possible" — RAIL preferred or AIR avoided. */
  railPreferred: boolean;
  /** Romance, honeymoon, "just the two of us". FEWER MOVES, not more sights. */
  romantic: boolean;
  /** comfort-first / premium / luxury. The drive from the railhead is held to a shorter rule. */
  comfortFirst: boolean;
  pace: 'savour' | 'steady' | 'packed';
  /**
   * US-806 — "we do not consume even eggs". A CONSTRAINT, NOT A PREFERENCE.
   * It can outrank a hotel star, and it decides the lunch halt on a five-hour drive.
   */
  foodNeed?: FoodNeed;
  /** HIS words for it, so we may quote him back rather than paraphrase him. */
  foodQuote?: string | null;
}

/** One town we could offer him, with everything the choice turns on. */
export interface Candidate {
  node: StayNode;
  gateways: Gateway[];
  /** VERIFIED attractions hanging off this bed. A zero means WE HAVE NOT SURVEYED IT — it
   *  does not mean there is nothing to see, and this module never reads it as though it did. */
  attractions: number;
  /** TRUE only for a town OUTSIDE the region he named — a neighbour our designers cross to.
   *  Founder ruling 2026-07-13: propose it, NAME ITS STATE, and let him strike it out. */
  outOfRegion: boolean;
  /** US-806. ABSENT means WE HAVE NOT CHECKED — never "there is no vegetarian food here". */
  food?: FoodFact | null;
}

// ---- what we propose -----------------------------------------------------------

export interface ProposedStop {
  name: string;
  /** Never null in practice for a proposal — the founder ruling requires the state NAMED. */
  state: string | null;
  nights: number;
  /** Where the night count came from. A MODEL'S PARSE of our itineraries is not our hand. */
  nightsSource: 'catalogue_ai_parsed' | 'our_default';
  nightsWhy: string;
  tier: Tier;
  why: string;
  /** How he gets there by train, in a sentence. Null when we have no railhead for it. */
  railheadNote: string | null;
  /** He may strike this out. It is a chip, not a decree. */
  outOfRegion: boolean;
  /** US-806. 'unknown' is the honest answer today, and it is SPOKEN, never swallowed. */
  foodStatus: FoodStatus;
  foodNote: string | null;
}

/** A town we looked at and did not offer — AND THE HUMAN REASON WHY NOT. */
export interface Rejection {
  name: string;
  state: string | null;
  reason: string;
}

/**
 * HE ASKED FOR A FLOOR WE CANNOT REACH HONESTLY. Founder, 2026-07-13:
 *
 *   "If the efficient itinerary cannot stretch up to 8 days even when the user has
 *    specified minimum 8 days, what would the system do?"
 *
 * IT SAYS SO. It does not quietly hand him six nights and hope he does not count them.
 * That is a SILENT SUBSTITUTION, and THE-CONSULTANTS-LAW Law 4 forbids it absolutely.
 *
 * And it does not pad. Padding is the same lie told with extra hotels: an idle night in a
 * town that does not deserve one, or a fourth packing morning he never asked for, purely
 * so a number on our side comes out right.
 *
 * So: THE FINDING, THE REASON, AND A NAMED ALTERNATIVE. All three, every time.
 */
export interface Shortfall {
  askedAtLeastNights: number;
  weCanStandBehindNights: number;
  /** What we checked, and what we found. */
  finding: string;
  /** Why it will not stretch — in his terms, not the engine's. */
  reason: string;
  /** Concrete, named ways to still get what he wanted. Never "please rephrase". */
  options: string[];
}

export interface Proposal {
  stops: ProposedStop[];
  totalNights: number;
  /** Null when his floor was met, or when he set none. NEVER null after a silent shortfall. */
  shortfall: Shortfall | null;
  /** US-806. The food paragraph he will actually read. Null only when he asked for nothing. */
  foodParagraph: string | null;
  /** The railhead the whole circuit hangs off. He said trains; this is the answer to that. */
  gateway: { name: string; code: string | null; services: number; kind: 'rail' | 'air' } | null;
  /** The strongest tier that chose this set. */
  tier: Tier;
  /** HOW LOUD THE SIGNAL IS. Two co-designs is not eighty-two. */
  signal: Confidence;
  /** The honest sentence about what our designers did and did not build. LAW 4. */
  signalVoice: string;
  /** Mean pairwise co-design strength across the set. Diagnostics; not shown to him raw. */
  cohesion: number;
  rejected: Rejection[];
  /** The OTHER real circuit in this region. A consultant who found two and hid one is not
   *  being straight with his client. */
  alsoConsidered: { stops: string[]; why: string }[];
}

// ---- the gates -----------------------------------------------------------------

/**
 * HOW LONG A DRIVE FROM THE RAILHEAD IS STILL "BY TRAIN"?
 *
 * A railhead six hours away is not a rail connection; it is a road trip with a train at the
 * start. spine.railReachable() defaults to five hours. For a COMFORT-FIRST party we hold it
 * to three — and that is a TIGHTENING, which is the only direction this project allows a
 * gate to move.
 */
export const RAILHEAD_DRIVE_HOURS = { standard: 5, comfort_first: 3 } as const;

/**
 * THE HOTEL-CHANGE CEILING. Every hotel change buys a bad night: you pack, you check out,
 * you sit in a car, you check in, and the day is gone. (Psychology map U7.)
 *
 * The spec caps hotel CHANGES at ceil(nights/3); a set of N stops is N-1 changes, so this
 * cap on STOPS is at or below the spec's. Tighter, never looser — the house rule.
 *
 * ROMANCE AND SAVOUR MOVE LESS. A couple of 56 and 49 who asked for a romantic, comfortable
 * trip did not ask to see more towns. They asked to enjoy the ones they see.
 */
export function maxStops(brief: DesignerBrief): number {
  const divisor = brief.romantic || brief.pace === 'savour' ? 4 : 3;
  return Math.max(1, Math.min(5, Math.ceil(brief.nights / divisor)));
}

/** The drive from a candidate's railhead, in hours. Null when we have not measured it. */
function railDriveHours(c: Candidate, brief: DesignerBrief) {
  const max = brief.comfortFirst ? RAILHEAD_DRIVE_HOURS.comfort_first : RAILHEAD_DRIVE_HOURS.standard;
  return railReachable(c.gateways, max);
}

const hoursWord = (h: number) =>
  h < 1 ? `${Math.round(h * 60)} minutes` : `${h.toFixed(1).replace('.0', '')} hours`;

/** "NEW JALPAIGURI - NJP" -> "New Jalpaiguri". He is a person, not a railway timetable. */
const prettyStation = (name: string) =>
  name.replace(/\s*-\s*[A-Z]+$/, '').trim().toLowerCase()
    .split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/**
 * CAN HE GET THERE THE WAY HE ASKED TO? — and if not, he is TOLD, in his own words.
 *
 * LAW 3, and THE-CONSULTANTS-LAW Law 4: never substitute in silence. Three parts, all
 * compulsory — the finding, the reason, and (where one exists) the honourable alternative.
 */
export function railGate(c: Candidate, brief: DesignerBrief): { pass: boolean; reason?: string; note?: string } {
  if (!brief.railPreferred) return { pass: true };

  const r = railDriveHours(c, brief);

  if (!r.railhead) {
    return {
      pass: false,
      reason: `There is no railway station with real trains within reach of ${c.node.name}. `
        + 'You told me you would rather travel by train, so I have left it out. If you would '
        + 'like to see it anyway, it has to be a flight, and you can tell me so.',
    };
  }

  const station = prettyStation(r.railhead.name);
  const h = gatewayDriveHours(r.railhead);

  // An unmeasured drive is not a reason to refuse him — but it IS a reason not to promise.
  if (h == null) {
    return { pass: true, note: `The railhead for ${c.node.name} is ${station}. We have not measured that drive, so I will not put a time on it.` };
  }

  if (!r.reachable) {
    return {
      pass: false,
      reason: `${c.node.name} is a fine place, but the nearest railway station with real trains `
        + `is ${station}, and it is about ${hoursWord(h)} by road from there. You said you would `
        + 'rather travel by train. That is not a train journey, it is a long road journey with a '
        + 'train at the start, and I will not sell it to you as one.',
    };
  }

  const note = r.longTransfer
    ? `You reach ${c.node.name} from ${station} station, and it is about ${hoursWord(h)} by road from there. `
      + 'That drive is part of the journey, and I would rather you heard it from me now than found it out on the day.'
    : h < 0.1
      ? `${c.node.name} has its own railway station, ${station}. You step off the train and you are there.`
      : `You reach ${c.node.name} from ${station} station, about ${hoursWord(h)} away by road.`;

  return { pass: true, note };
}

// ---- the anchor ----------------------------------------------------------------

/** Which hour-band the railhead drive falls in. 0 = you step off the train and you are there. */
const driveBand = (c: Candidate, brief: DesignerBrief): number => {
  const r = railDriveHours(c, brief);
  const h = r.railhead ? gatewayDriveHours(r.railhead) : null;
  return h == null ? 9 : Math.floor(h);
};

/**
 * THE ANCHOR — the town he ARRIVES at, and the town the circuit hangs off.
 *
 * The order of the questions is the whole argument, so it is written as an order of
 * questions and not as a weighted score with invented numbers:
 *
 *   1. CAN HE STEP OFF THE TRAIN AND BE THERE?  (the railhead drive band)
 *   2. DO WE ACTUALLY KNOW THE TOWN?            (how many of our tours use it — Tier 1)
 *   3. HOW GOOD IS THE RAILHEAD?                (trains that really stop)
 *
 * On the live North-East pool this returns GUWAHATI: its railhead is IN the town (GHY, 146
 * services, zero drive) and our designers have used it in six tours. Gangtok's railhead is
 * a stronger station (NJP, 180) but it is an hour and a half of road away — so for the man
 * who said "trains wherever possible", Guwahati is the honest gateway. THE DATA CHOSE IT.
 */
export function pickAnchor(candidates: Candidate[], brief: DesignerBrief): Candidate | null {
  const usable = candidates.filter((c) => !c.outOfRegion && railGate(c, brief).pass);
  if (!usable.length) return null;
  return [...usable].sort((a, b) =>
    (driveBand(a, brief) - driveBand(b, brief))
    || (b.node.tourCount - a.node.tourCount)
    || (railServices(b) - railServices(a))
    || a.node.name.localeCompare(b.node.name),
  )[0];
}

const railServices = (c: Candidate): number => {
  const rail = c.gateways.filter((g) => g.kind === 'rail');
  return rail.length ? Math.max(...rail.map((g) => g.services)) : 0;
};

/**
 * A GATEWAY IS NOT A DESTINATION.
 *
 * Bagdogra sits in our catalogue with four tours to its name, and our designers pair it
 * with Gangtok twice — because it is THE AIRPORT YOU LAND AT. It is not a town you give a
 * romantic couple two nights in. A designer that cannot tell an airport from a destination
 * will one day book a honeymoon suite beside a runway.
 */
export function isGatewayOf(c: Candidate, selected: Candidate[]): boolean {
  const mine = c.node.name.trim().toLowerCase();
  return selected.some((s) =>
    s.gateways.some((g) => prettyStation(g.name).trim().toLowerCase() === mine),
  );
}

// ---- the voice -----------------------------------------------------------------

/**
 * WHAT OUR DESIGNERS ACTUALLY DID — NOT WHAT IT WOULD BE CONVENIENT TO SAY THEY DID.
 *
 * THIS IS LAW 4, AND IT IS THE HARDEST SENTENCE IN THE SPRINT.
 *
 * For Guwahati + Shillong + Kaziranga the truth is precise and awkward: our designers put
 * Guwahati WITH Shillong (twice) and Guwahati WITH Kaziranga (twice). THEY NEVER BUILT ALL
 * THREE AS ONE TRIP. Shillong and Kaziranga have never appeared in the same tour.
 *
 * "Our designers have built this circuit before" would therefore be NEARLY TRUE — and a
 * sentence that is nearly true is a lie with a good accent. So we say what they built, we
 * say what they did not, and we own the joining. He can then trust every other sentence we
 * give him, which is the only reason he would ever buy from us.
 */
export function circuitVoice(memory: DesignerMemory, stops: string[]): { text: string; signal: Confidence; cohesion: number } {
  if (stops.length < 2) {
    const text = 'This is one town, chosen on its own merits, not as a circuit.';
    return { text, signal: 'never_built', cohesion: 0 };
  }

  const built: { a: string; b: string; n: number }[] = [];
  const notBuilt: { a: string; b: string }[] = [];
  let total = 0, pairCount = 0;

  for (let i = 0; i < stops.length; i++) {
    for (let j = i + 1; j < stops.length; j++) {
      const n = coDesignStrength(memory, stops[i], stops[j]);
      total += n; pairCount++;
      if (n > 0) built.push({ a: stops[i], b: stops[j], n });
      else notBuilt.push({ a: stops[i], b: stops[j] });
    }
  }
  const cohesion = pairCount ? total / pairCount : 0;
  const strongest = built.length ? Math.max(...built.map((p) => p.n)) : 0;
  const signal = pairConfidence(strongest);

  if (!built.length) {
    return {
      text: 'Our designers have not built these towns together before. I have chosen them on how '
        + 'you get there and what is worth seeing, and I am telling you that rather than dressing '
        + 'it up as something we have sold for years.',
      signal, cohesion,
    };
  }

  const many = built.every((p) => p.n >= 10);
  const pairText = built.map((p) => `${p.a} with ${p.b}`).join(', and ');

  if (!notBuilt.length) {
    return {
      text: many
        ? `Our designers have put ${pairText} together many times. This is a circuit we know well.`
        : `Our designers have built ${pairText} before, though only a handful of times. It is ours, `
          + 'but I will not pretend we sell it every week.',
      signal, cohesion,
    };
  }

  // The awkward, honest case — and the one the North East actually is.
  const gap = notBuilt.map((p) => `${p.a} and ${p.b}`).join(', or ');
  return {
    text: `Our designers have built ${pairText} before, though only a handful of times. They have `
      + `not put ${gap} in the same trip, so the joining of them is mine, not theirs. I think it is `
      + 'a good joining, and you should know it is a judgement and not a track record.',
    signal, cohesion,
  };
}

// ---- the nights ----------------------------------------------------------------

/** A town we have never sold gets a plain two nights, and we say that is what we did. */
const DEFAULT_NIGHTS = 2;

/**
 * Nobody wants a fifth night in one town on a ten-day holiday — it stops being a stay and
 * starts being a wait. This is a JUDGEMENT, not a measurement, and it is written down as one
 * so that the day a traveller tells us otherwise we know exactly which line to change.
 */
const MAX_NIGHTS_IN_ONE_TOWN = 4;

function nightsFor(memory: DesignerMemory, name: string): Pick<ProposedStop, 'nights' | 'nightsSource' | 'nightsWhy'> {
  const t = nightsWeCanStandBehind(memory, name);
  if (t) {
    return {
      nights: Math.max(1, Math.round(t.nights)),
      nightsSource: 'catalogue_ai_parsed',
      // The receipt, and the honest grade of the evidence. tour_stays is a MODEL'S PARSE of
      // our designers' itineraries — verified against their own day counts, but not their hand.
      nightsWhy: `taken from our own tour itineraries, where ${name} is given about `
        + `${t.nights.toFixed(1).replace('.0', '')} nights across ${t.timesDesigned} of our tours`,
    };
  }
  return {
    nights: DEFAULT_NIGHTS,
    nightsSource: 'our_default',
    nightsWhy: 'we have not sold this town often enough to have a night count I can stand behind, '
      + 'so I have given it two nights. Change it and I will rebuild around you.',
  };
}

// ---- THE DESIGNER ---------------------------------------------------------------

/**
 * THE SELECTION, in the order of the spec (§4, steps 3 to 5).
 *
 *   3. SCORE, and SAY WHICH SIGNAL SPOKE.
 *   4. SELECT a set that FITS THE BRIEF — not merely the region.
 *   5. HAND IT to the Sprint-7 engine, which sequences, refuses and explains.
 *
 * Returns null ONLY when the region gives us nothing we can stand behind. A null here means
 * "we have nothing to offer in this region" and the caller must SAY that. It must never
 * mean "so let us make something up".
 */
export function design(
  candidates: Candidate[],
  memory: DesignerMemory,
  brief: DesignerBrief,
): Proposal | null {
  return designAll(candidates, memory, brief)[0] ?? null;
}

/**
 * US-805b — EVERY REAL TRIP IN THE REGION, NOT ONE AND A FOOTNOTE.
 *
 * FOUNDER, 2026-07-13: "Why only one tour plan? There could have been 3 plans."
 *
 * HE IS RIGHT, AND THE FIRST CUT OF THIS FILE WAS WRONG. It found the circuits, chose the
 * best, and demoted the rest to a sentence. But the North East is not one trip — it is TWO,
 * and they are genuinely different holidays:
 *
 *   GUWAHATI + KAZIRANGA + SHILLONG   in through Guwahati (GHY, 146 trains, no drive)
 *   GANGTOK + DARJEELING              in through New Jalpaiguri, a different corner entirely
 *
 * A consultant who found two good answers and showed you one is not saving you effort. He is
 * making your decision for you and calling it service.
 *
 * ONE HONEST CORRECTION TO THE FOUNDER'S THREE, AND IT COMES FROM OUR OWN DATA:
 * GANGTOK AND DARJEELING ARE NOT TWO TRIPS. Our designers put them in the SAME tour, twice.
 * Bagdogra is the gateway to both, not a fork between them. Splitting them would be US
 * inventing a division our own catalogue does not make — and inventing a division is the
 * same sin as inventing a town, wearing a tidier coat.
 *
 * Returns the trips STRONGEST FIRST. Empty when the region gives us nothing we can stand
 * behind — and then the caller must SAY we have nothing, not fill the silence.
 */
export function designAll(
  candidates: Candidate[],
  memory: DesignerMemory,
  brief: DesignerBrief,
): Proposal[] {
  if (!candidates.length) return [];

  // Which towns pass the gates HE set. Computed once; every circuit draws from this pool.
  //
  // AND EVERY TOWN THAT FAILS IS REFUSED BY NAME, HERE, ONCE — for the whole region.
  // (This was a real regression when circuits arrived: Tawang belongs to NO circuit, so with
  // the rejections computed per-circuit, NOBODY reported it and it vanished in silence. A town
  // that fails HIS OWN gate must be named and explained. Silence is the one thing forbidden.)
  const need0: FoodNeed = brief.foodNeed ?? 'none';
  const eligible: Candidate[] = [];
  const regionRejections: Rejection[] = [];

  for (const c of candidates) {
    const g = railGate(c, brief);
    if (!g.pass) {
      // An out-of-region town we never offered is not a town he needs a reason for.
      if (!c.outOfRegion) {
        regionRejections.push({ name: c.node.name, state: c.node.stateName, reason: g.reason! });
      }
      continue;
    }
    if (foodRank(c.food, need0) === -1) {
      regionRejections.push({
        name: c.node.name, state: c.node.stateName,
        reason: `We looked in ${c.node.name} and we could not find a kitchen we would put you in `
          + 'front of. I would rather lose the town than sit you down to a plate you cannot eat.',
      });
      continue;
    }
    eligible.push(c);
  }
  if (!eligible.length) return [];

  // THE CIRCUITS ARE OUR DESIGNERS' OWN CLUSTERS, recovered from the co-design graph.
  // A town they never paired with anything is its own circuit of one — and a circuit of one
  // is still a trip, if we have sold the town.
  const seen = new Set<string>();
  const circuits: Candidate[][] = [];

  const anchors = [...eligible]
    .filter((c) => !c.outOfRegion)
    .sort((a, b) =>
      (driveBand(a, brief) - driveBand(b, brief))
      || (b.node.tourCount - a.node.tourCount)
      || a.node.name.localeCompare(b.node.name));

  for (const head of anchors) {
    const hk = head.node.name.trim().toLowerCase();
    if (seen.has(hk)) continue;

    // Breadth-first through our designers' own pairings, crossing the border where THEY did.
    const group: Candidate[] = [head];
    const local = new Set([hk]);
    const queue = [head.node.name];
    while (queue.length) {
      const from = queue.shift()!;
      for (const pair of coDesignedWith(memory, from)) {
        const k = pair.pairsWith.trim().toLowerCase();
        if (local.has(k)) continue;
        const c = eligible.find((x) => x.node.name.trim().toLowerCase() === k);
        if (!c) continue;                       // a town they know and our spine does not.
        local.add(k);                           // We do not conjure it from the pairing.
        group.push(c);
        queue.push(c.node.name);
      }
    }
    for (const k of local) seen.add(k);

    // A lone town we have NEVER sold is not a trip we would propose on its own.
    if (group.length === 1 && head.node.tourCount === 0) continue;
    circuits.push(group);
  }

  // ---- RANK THE CIRCUITS BEFORE WE CUT THEM ------------------------------------
  //
  // THE DEFECT THE LIVE PAYLOAD FOUND (2026-07-13, minutes after the first cut shipped):
  // it returned THREE trips — Guwahati/Kaziranga/Shillong, then GOLAGHAT ALONE, then JORHAT
  // ALONE — and the real GANGTOK + DARJEELING circuit was cut off by the cap of three.
  //
  // Because I had ranked circuits by how easily you reach the ANCHOR. Golaghat and Jorhat sit
  // beside a railway line, so they won — and they are not trips. They are single towns our
  // designers never paired with anything.
  //
  // A CIRCUIT IS A THING OUR DESIGNERS BUILT. A lone town is a fallback, not a holiday, and it
  // may never elbow a real circuit off the page. So: rank FIRST, cut SECOND.
  const strengthOf = (g: Candidate[]): number => {
    let t = 0;
    for (let i = 0; i < g.length; i++) {
      for (let j = i + 1; j < g.length; j++) {
        t += coDesignStrength(memory, g[i].node.name, g[j].node.name);
      }
    }
    return t;
  };
  /** The best arrival in a circuit: can he step off the train and BE there? */
  const bestBand = (g: Candidate[]): number =>
    Math.min(...g.filter((c) => !c.outOfRegion).map((c) => driveBand(c, brief)));

  circuits.sort((a, b) =>
    // 1. A REAL CIRCUIT ALWAYS BEATS A LONE TOWN. A lone town is a fallback, not a holiday.
    ((b.length > 1 ? 1 : 0) - (a.length > 1 ? 1 : 0))
    // 2. HIS BRIEF DECIDES THE ORDER, NOT OUR ARITHMETIC. He said trains. So the circuit he can
    //    step off a train INTO leads. Guwahati's railhead is in the town; Gangtok's is 94 minutes
    //    of road away. Both are real trips — but only one of them is the trip he ASKED for.
    //    (Live payload, 2026-07-13: ranking on catalogue weight alone put Gangtok first and
    //    quietly demoted the train-first answer. The engine had forgotten what he said.)
    || (bestBand(a) - bestBand(b))
    // 3. Then what our designers actually built, and how often.
    || (strengthOf(b) - strengthOf(a))
    || (b.reduce((t, c) => t + c.node.tourCount, 0) - a.reduce((t, c) => t + c.node.tourCount, 0))
    || (b.length - a.length));

  // WHERE OUR DESIGNERS SAID NOTHING, WE STILL HAVE TOWNS — AND WE DO NOT GO QUIET.
  //
  // A region we have never sold in (our writers went; our designers never built) yields NO
  // co-design clusters at all. Returning nothing there would tell the traveller we have nothing,
  // WHICH IS FALSE. So we fall to Tier 2 — transport and what there is to see — and we SAY that
  // is what we did. An honest thinner answer, never a silence.
  if (!circuits.length) {
    const tier2 = eligible.filter((c) => !c.outOfRegion).slice(0, maxStops(brief));
    if (tier2.length) circuits.push(tier2);
  }

  // US-854 — WHERE THE MEMORY IS ALL SINGLETONS, GEOGRAPHY MAY PROPOSE ONE JOINED TRIP.
  //
  // THE LIVE FAILURE (Karnataka heritage, 2026-07-14): the pool held Mysore, Hassan,
  // Halebid, Hampi, Badami — and the offer was three LONE TOWNS, because our designers'
  // pairs barely touch the region, every BFS circuit was a singleton, and the Tier-2 pad
  // only draws from WITHIN a circuit — a singleton can never grow. A traveller who asked
  // for "the heritage cities of Karnataka" plural was answered in the singular.
  //
  // So when NOT ONE real circuit exists, geography joins compact singletons into ONE trip:
  // nearest-neighbour, each hop ≤ 400 km (the same compactness the pool fence uses). The
  // joining is OURS and circuitVoice already says so out loud ("our designers have not
  // built these towns together…") — Tier 2 doctrine, extended from zero-circuits to
  // all-singletons. Geography may propose; it still cannot outrank a designers' circuit,
  // because this runs only when there is none.
  const hasRealCircuit = circuits.some((g) => g.length > 1);
  if (!hasRealCircuit && eligible.length >= 2) {
    const inRegion = eligible.filter((c) => !c.outOfRegion);
    const seeds = [...inRegion].sort((a, b) =>
      (b.node.tourCount - a.node.tourCount) || (b.attractions - a.attractions) || a.node.name.localeCompare(b.node.name));
    const cap = maxStops(brief);
    // The strongest town may be geographically ISOLATED (a lone star far from the rest).
    // A seed that cannot join anything is not a failure of the idea — try the next one.
    for (const seed of seeds) {
      const joined: Candidate[] = [seed];
      while (joined.length < cap) {
        const last = joined[joined.length - 1];
        const next = inRegion
          .filter((c) => !joined.includes(c) && !isGatewayOf(c, joined))
          .map((c) => ({ c, km: haversineKm([last.node.lat, last.node.lng], [c.node.lat, c.node.lng]) }))
          .filter((x) => x.km <= 400)
          .sort((a, b) => (a.km - b.km) || (b.c.node.tourCount - a.c.node.tourCount))[0];
        if (!next) break;
        joined.push(next.c);
      }
      if (joined.length > 1) { circuits.unshift(joined); break; }
    }
  }

  // A LONE TOWN IS A FALLBACK, NOT A THIRD OPTION.
  //
  // The live payload offered "Golaghat, 2 nights" as a trip beside two proper circuits. It is a
  // real town and we have sold it twice — but no consultant lays a single town on the table next
  // to two built circuits and calls it a choice. It pads the page and it flatters us.
  // So: lone towns appear ONLY when we have fewer than two real circuits to give him.
  const realCircuits = circuits.filter((g) => g.length > 1);
  const offer = realCircuits.length >= 2 ? realCircuits : circuits;

  const out: Proposal[] = [];
  for (const circuit of offer) {
    const p = designOne(circuit, eligible, memory, brief);
    if (!p) continue;
    // The region-wide refusals travel WITH every trip. He sees what we ruled out, and why,
    // whichever trip he is looking at.
    p.rejected = [...regionRejections, ...p.rejected];
    out.push(p);
    if (out.length >= 3) break;                 // three trips is a choice. Six is a list again.
  }

  // The circuits were already ranked before we cut them. `out` preserves that order, and a
  // second sort here would quietly undo the very fix above.
  return out;
}

/** One circuit, worked up into a full proposal. The body of the old `design()`. */
function designOne(
  candidates: Candidate[],
  wholePool: Candidate[],
  memory: DesignerMemory,
  brief: DesignerBrief,
): Proposal | null {
  if (!candidates.length) return null;

  const rejected: Rejection[] = [];
  const reject = (c: Candidate, reason: string) =>
    rejected.push({ name: c.node.name, state: c.node.stateName, reason });

  const need: FoodNeed = brief.foodNeed ?? 'none';

  // ---- STEP 4a — THE GATES HE HIMSELF SET. Trains, and the food. ----------------
  //
  // THE FOOD GATE ONLY BITES WHERE WE KNOW. A town we have VERIFIED we cannot feed him in is
  // removed — I would rather lose the town than sit him down to a plate he cannot eat. But a
  // town we have NOT CHECKED is NOT removed, because an empty row is a fact about OUR SURVEY,
  // not about the town. Dropping Shillong because we have never eaten there would be LYING
  // WITH A NULL, and it is the same sin as inventing a restaurant, wearing a modest coat.
  const passed: Candidate[] = [];
  for (const c of candidates) {
    const g = railGate(c, brief);
    if (!g.pass) {
      if (!c.outOfRegion) reject(c, g.reason!);      // an out-of-region town we never offered
      continue;                                      // is not a town he needs a reason for.
    }
    if (foodRank(c.food, need) === -1) {
      reject(c, `We looked in ${c.node.name} and we could not find a kitchen we would put you in `
        + 'front of. I would rather lose the town than sit you down to a plate you cannot eat.');
      continue;
    }
    passed.push(c);
  }
  if (!passed.length) return null;

  // ---- STEP 4b — THE ANCHOR. Where he steps off the train. ----------------------
  const anchor = pickAnchor(passed, brief);
  if (!anchor) return null;

  const cap = maxStops(brief);
  const byName = new Map(passed.map((c) => [c.node.name.trim().toLowerCase(), c]));
  const selected: Candidate[] = [anchor];

  // ---- STEP 3/4c — GROW THE CIRCUIT FROM OUR OWN DESIGNERS' HAND ----------------
  //
  // THE CATALOGUE HAS ALREADY ANSWERED HIM. We do not need a model to guess which towns
  // belong with Guwahati. Our designers decided, and wrote it down, and we never asked them.
  // We ask them now — breadth-first, strongest pairing first, from the anchor outwards.
  const queue = [anchor.node.name];
  const seen = new Set([anchor.node.name.trim().toLowerCase()]);

  while (queue.length && selected.length < cap) {
    const from = queue.shift()!;
    for (const pair of coDesignedWith(memory, from)) {
      if (selected.length >= cap) break;
      const key = pair.pairsWith.trim().toLowerCase();
      if (seen.has(key)) continue;

      const c = byName.get(key);
      if (!c) continue;                    // a town our designers know and our spine does not.
      seen.add(key);                       // Not an invitation to invent it. We move on.

      // A GATEWAY IS NOT A DESTINATION. Bagdogra is where you land, not where you sleep.
      if (isGatewayOf(c, selected)) {
        reject(c, `${c.node.name} is the airport you would land at for ${from}, not a place I would `
          + 'ask you to spend a night.');
        continue;
      }
      selected.push(c);
      queue.push(c.node.name);
    }
  }

  // ---- STEP 3 (TIER 2) — ONLY WHERE THE CATALOGUE IS SILENT ---------------------
  //
  // And NOT for this traveller. A romantic, unhurried couple is not served by padding their
  // ten days with a town nobody has ever sold, simply because a slot was free. Fewer stops,
  // better stops. That is a consultant's instinct, and it is also the U7 hotel-change law.
  const padAllowed = !(brief.romantic || brief.pace === 'savour');
  if (padAllowed && selected.length < cap) {
    const rest = passed
      .filter((c) => !seen.has(c.node.name.trim().toLowerCase()) && !c.outOfRegion)
      .filter((c) => !isGatewayOf(c, selected))
      .sort((a, b) =>
        // A town we have CHECKED and can feed him in wins a tie. A TIE-BREAK, never an
        // override: our designers' thirty years outrank our restaurant list, and always will.
        (foodRank(b.food, need) - foodRank(a.food, need))
        || (b.attractions - a.attractions)
        || (driveBand(a, brief) - driveBand(b, brief))
        || (b.node.tourCount - a.node.tourCount)
        || a.node.name.localeCompare(b.node.name));
    for (const c of rest) {
      if (selected.length >= cap) break;
      selected.push(c);
      seen.add(c.node.name.trim().toLowerCase());
    }
  }

  // ---- STEP 4d — DOES IT FIT HIS DAYS? ------------------------------------------
  //
  // He said ten days. A consultant does not quietly overrun that and hope. He drops the
  // weakest stop and TELLS HIM he dropped it.
  const stops: ProposedStop[] = selected.map((c) => {
    const g = railGate(c, brief);
    return {
      name: c.node.name,
      state: c.node.stateName,
      ...nightsFor(memory, c.node.name),
      tier: nodeTier(c.node),
      why: nodeVoice(c.node),
      railheadNote: g.note ?? null,
      outOfRegion: c.outOfRegion,
      // 'unknown' today, for every North-East town. WE SAY SO. We do not reassure him.
      foodStatus: foodStatus(c.food, need),
      foodNote: foodVoiceFor(c.node.name, c.food, need),
    };
  });

  const budget = Math.max(1, brief.nights);
  while (stops.length > 1 && stops.reduce((s, x) => s + x.nights, 0) > budget) {
    // The weakest stop is the one our designers have paired LEAST with the rest of the set.
    let worst = 1, worstStrength = Infinity;
    for (let i = 1; i < stops.length; i++) {
      const strength = stops.reduce((s, o, j) =>
        i === j ? s : s + coDesignStrength(memory, stops[i].name, o.name), 0);
      if (strength < worstStrength) { worstStrength = strength; worst = i; }
    }
    const dropped = stops.splice(worst, 1)[0];
    rejected.push({
      name: dropped.name,
      state: dropped.state,
      reason: `${dropped.name} would have been a good addition, but you have ${budget} nights and `
        + 'adding it would mean rushing the rest. I would rather give you fewer places and let you '
        + 'enjoy them than tick one more town off a list.',
    });
  }

  // ---- STEP 4e — AND HIS FLOOR, IF HE GAVE ONE ---------------------------------
  //
  // "Between 8 and 10 days" is a floor as well as a ceiling. If the towns our designers
  // pair here come to fewer nights than he asked for, a consultant does NOT reach for
  // another town — this couple asked to move LESS, not to see more. He gives the nights
  // to the places already chosen, and he says out loud that he did it.
  const floor = brief.minNights ?? null;
  let shortfall: Shortfall | null = null;

  if (floor && floor <= budget) {
    const total = () => stops.reduce((s, x) => s + x.nights, 0);
    const order = [...stops].sort((a, b) => b.nights - a.nights);
    let guard = 0;

    // FIRST: give the nights to the towns he is ALREADY going to. That is what a romantic,
    // unhurried couple actually wants — a slower morning, not a fourth suitcase.
    while (total() < floor && guard < 12) {
      let moved = false;
      for (const st of order) {
        if (total() >= floor) break;
        if (st.nights >= MAX_NIGHTS_IN_ONE_TOWN) continue;
        st.nights += 1;
        st.nightsSource = 'our_default';
        st.nightsWhy = `you asked for at least ${floor} nights, so I have given ${st.name} an extra `
          + 'night rather than push you into another town and another packing morning.';
        moved = true;
      }
      if (!moved) break;
      guard += 1;
    }

    // AND IF IT STILL WILL NOT STRETCH — WE SAY SO. WE DO NOT PAD, AND WE DO NOT GO QUIET.
    if (total() < floor) {
      // THE WHOLE REGION, not just this circuit — if we cannot reach his floor here, the
      // honest options include towns from anywhere he could actually get to.
      const spare = wholePool
        .filter((c) => !seen.has(c.node.name.trim().toLowerCase()))
        .filter((c) => !c.outOfRegion && !isGatewayOf(c, selected))
        .sort((a, b) => b.node.tourCount - a.node.tourCount)
        .slice(0, 2);

      const options: string[] = [];
      for (const c of spare) {
        options.push(
          `I can add ${c.node.name}${c.node.stateName ? `, ${c.node.stateName}` : ''} — `
          + `${nodeVoice(c.node)}. That is one more town and one more packing morning, and it would `
          + `bring you close to the ${floor} nights you asked for. Say the word and I will put it in.`);
      }
      options.push(
        `Or we do it in ${total()} nights and do it properly — longer mornings, no rushing, and you `
        + 'come home rested rather than having ticked off one more town.');
      options.push(
        'Or tell me you would rather see a different part of the country for the longer trip, and I '
        + 'will build that instead.');

      shortfall = {
        askedAtLeastNights: floor,
        weCanStandBehindNights: total(),
        finding: `You asked for at least ${floor} nights. The towns I can honestly stand behind here `
          + `come to ${total()} nights at the pace you asked for.`,
        reason: 'I could stretch it — but only by keeping you somewhere an extra night it does not '
          + 'deserve, or by adding a town you did not ask for. Neither of those is a better holiday; '
          + 'they are just a bigger number on my side of the table.',
        options,
      };
    }
  }

  const names = stops.map((s) => s.name);
  const voice = circuitVoice(memory, names);

  // The gateway of the whole circuit is the ANCHOR's railhead — the station he arrives at.
  const anchorRail = railDriveHours(anchor, brief).railhead;
  const gateway = anchorRail
    ? { name: prettyStation(anchorRail.name), code: anchorRail.code, services: anchorRail.services, kind: 'rail' as const }
    : null;

  // The strongest tier in the set is the promise we are making about the set.
  const tier: Tier = stops.some((s) => s.tier === 'designer_catalogue') ? 'designer_catalogue' : 'transport_poi';

  return {
    stops,
    totalNights: stops.reduce((s, x) => s + x.nights, 0),
    shortfall,
    foodParagraph: foodParagraph(need, brief.foodQuote ?? null,
      stops.map((st) => ({ name: st.name, status: st.foodStatus }))),
    gateway,
    tier,
    signal: voice.signal,
    signalVoice: voice.text,
    cohesion: voice.cohesion,
    rejected,
    // EMPTY BY DESIGN NOW. The other circuits are no longer a footnote at the bottom of one
    // proposal — they are PROPOSALS OF THEIR OWN, returned alongside this one by designAll().
    // (Founder, 2026-07-13: "Why only one tour plan? There could have been 3 plans.")
    alsoConsidered: [],
  };
}

/**
 * THE OTHER REAL CIRCUIT IN THE REGION.
 *
 * A consultant who found two good answers and mentioned only one is not being straight with
 * his client. In the North East the second answer is real and our designers built it too:
 * GANGTOK with DARJEELING, which is a different railhead (New Jalpaiguri) and a different
 * journey — and mixing it with Assam in ten days would put this couple on the road for days.
 * So we do not silently discard it. We name it, and we say why it is not the one.
 */
function otherCircuits(
  passed: Candidate[],
  memory: DesignerMemory,
  brief: DesignerBrief,
  chosen: Set<string>,
): { stops: string[]; why: string }[] {
  const out: { stops: string[]; why: string }[] = [];
  const seen = new Set(chosen);

  const rest = passed
    .filter((c) => !seen.has(c.node.name.trim().toLowerCase()))
    .sort((a, b) => b.node.tourCount - a.node.tourCount);

  for (const head of rest) {
    const k = head.node.name.trim().toLowerCase();
    if (seen.has(k)) continue;
    const group = [head];
    seen.add(k);
    for (const pair of coDesignedWith(memory, head.node.name)) {
      const pk = pair.pairsWith.trim().toLowerCase();
      if (seen.has(pk)) continue;
      const c = passed.find((x) => x.node.name.trim().toLowerCase() === pk);
      if (!c || isGatewayOf(c, group)) continue;
      group.push(c);
      seen.add(pk);
    }
    if (group.length < 2) continue;    // a lone town is not a circuit worth naming.

    const station = railDriveHours(head, brief).railhead;
    out.push({
      stops: group.map((c) => c.node.name),
      why: `${group.map((c) => c.node.name).join(' and ')} is the other trip our designers have built `
        + `in this part of the country`
        + (station ? `, and it comes in through a different railhead, ${prettyStation(station.name)}` : '')
        + '. It is a good trip. It is not the same trip, and putting both into ten days would have you '
        + 'on the road far more than you asked for. Say the word and I will build you that one instead.',
    });
    if (out.length >= 2) break;        // two alternatives is advice; five is a list again.
  }
  return out;
}
