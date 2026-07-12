/**
 * US-804 — THE DESIGNERS' MEMORY. Sprint 8 / THE DESIGNER.
 *
 * Thirty years of our own designers' decisions, recovered from our own catalogue. Which
 * towns they put in a tour together, and how many nights they gave each one.
 *
 *   Jaipur pairs with Delhi 29 times, Agra 26, Fatehpur Sikri 9, Pushkar 8.
 *
 * THAT IS THE GOLDEN TRIANGLE, AND NOBODY INVENTED IT. We did not need a model to guess
 * which towns belong together. Our own designers decided, a thousand times, and wrote it
 * down. We simply never asked them.
 *
 * ------------------------------------------------------------------------------
 * PURE. No DB, no network, no clock. The controller injects a `DesignerMemory` read by
 * designerMemoryDb.ts. Same doctrine as anchors.ts / anchorsDb.ts.
 *
 * ------------------------------------------------------------------------------
 * THE TIER IS NOT A DECORATION. IT IS THE PROMISE.
 *
 * "A stop we chose because our designers have sold it 40 times is a different promise
 * from a stop we chose because a model suggested it — and he is entitled to know which
 * he is being given."  (Sprint-8 spec, §4.3)
 *
 * So every fact in here carries the tier that produced it, and the tiers are NOT
 * interchangeable:
 *
 *   'designer_catalogue'   OUR OWN DESIGNERS' HAND. tour_cities — the actual composition
 *                          of real tours we built and sold. Human. Structural. Strongest.
 *
 *   'catalogue_ai_parsed'  A MODEL'S READING OF OUR DESIGNERS' ITINERARIES. Every one of
 *                          the 1,002 rows in tour_stays is `ai_backfill`. NOT ONE was
 *                          written by a designer.
 *
 * ------------------------------------------------------------------------------
 * THE THING THIS FILE EXISTS TO STOP.
 *
 * The mined CSV is named "designer-typical-nights" and the spec says "our designers have
 * already told us how many nights Leh deserves". THEY DID NOT. A MODEL DID. Shipping
 * that under the Tier-1 badge — "our own catalogue, human" — would have been precisely
 * the fabrication this whole sprint was written to prevent.
 *
 * It was VERIFIED rather than trusted, by the spec's own rule (§3.2: "a row is unverified
 * until a second, independent source agrees"). The independent source is tour_itinerary:
 * 2,166 rows of human-written day-by-day prose. A tour of N days has N-1 nights. If the
 * model's parse is faithful, sum(nights) must equal max(day) - 1.
 *
 *   343 of 355 tours EXACT. 98.9% within a single night.
 *
 * So the nights ARE a faithful parse — but a faithful parse is still a parse. It is
 * labelled `catalogue_ai_parsed`, and the seven towns whose tours did NOT reconcile
 * (Kedarnath, Orchha, and five Konkan towns that all trace to one misparsed tour) carry
 * `reconciled: false` and MAY NEVER BE STATED AS FACT. See `nightsWeCanStand behind()`.
 */

// ---- the tiers ----------------------------------------------------------------

/**
 * WHICH SIGNAL SPOKE. Ordered strongest first. The plan must be able to tell the
 * traveller which of these chose his trip.
 */
export type Tier =
  /** Our own designers' hand: they put these towns in a tour together, and sold it. */
  | 'designer_catalogue'
  /** A model's reading of our designers' own itineraries. Verified, but not their hand. */
  | 'catalogue_ai_parsed'
  /** Works everywhere, including where we have never sold: transport + attraction density. */
  | 'transport_poi'
  /** Only for gaps, and only through the verify ladder. Never registers a place by itself. */
  | 'ai_proposed';

export const TIER_RANK: Record<Tier, number> = {
  designer_catalogue: 1,
  catalogue_ai_parsed: 2,
  transport_poi: 3,
  ai_proposed: 4,
};

/** What we may say out loud about a tier, in the traveller's own register. */
export const TIER_VOICE: Record<Tier, string> = {
  designer_catalogue: 'our own designers have built this pairing before',
  catalogue_ai_parsed: 'taken from our own tour itineraries',
  transport_poi: 'chosen for how easily you can reach it and what there is to see',
  ai_proposed: 'suggested for you, and then checked against our records before we offered it',
};

// ---- the facts ----------------------------------------------------------------

/** Two towns our designers put in the same tour, and how often. */
export interface DesignerPair {
  city: string;
  pairsWith: string;
  designedTogether: number;
  tier: 'designer_catalogue';
}

/** How many nights a town is typically given. A PARSE, and it says so. */
export interface TypicalNights {
  city: string;
  nights: number;
  timesDesigned: number;
  tier: 'catalogue_ai_parsed';
  /** Did the model's parse agree with the HUMAN itinerary's day count? */
  reconciled: boolean;
  /** How often it agreed, across the tours this town appears in. 0..1. */
  agreementRate: number | null;
}

/** The bundle the controller injects. The engine never reaches for the database. */
export interface DesignerMemory {
  pairs: DesignerPair[];
  nights: TypicalNights[];
}

export const EMPTY_MEMORY: DesignerMemory = { pairs: [], nights: [] };

const key = (s: string) => s.trim().toLowerCase();

// ---- reading the memory --------------------------------------------------------

/**
 * Every town our designers have paired with this one, strongest pairing first.
 *
 * This is the answer to "where else should he go?", and it did not cost us a rupee.
 */
export function coDesignedWith(memory: DesignerMemory, city: string): DesignerPair[] {
  const k = key(city);
  return memory.pairs
    .filter((p) => key(p.city) === k)
    .sort((a, b) => b.designedTogether - a.designedTogether);
}

/** How many times our designers put these two towns in the same tour. 0 = never. */
export function coDesignStrength(memory: DesignerMemory, a: string, b: string): number {
  const ka = key(a), kb = key(b);
  const hit = memory.pairs.find((p) => key(p.city) === ka && key(p.pairsWith) === kb);
  return hit?.designedTogether ?? 0;
}

/**
 * THE THINNESS RULE — and the traveller is entitled to this.
 *
 * "Our designers have built this circuit, though only a handful of times" is a DIFFERENT
 * PROMISE from "we have sold this route eighty times". The engine must be able to say
 * which it is, so it must be able to tell the difference.
 *
 * Delhi-Jaipur is 29. Guwahati-Shillong is 2. Both are real. They are not the same claim.
 */
export type Confidence = 'well_trodden' | 'built_before' | 'never_built';

export function pairConfidence(strength: number): Confidence {
  if (strength >= 10) return 'well_trodden';
  if (strength >= 1) return 'built_before';
  return 'never_built';
}

/** The honest sentence for a pairing, in his register. Never a number he did not ask for. */
export function pairVoice(a: string, b: string, strength: number): string {
  switch (pairConfidence(strength)) {
    case 'well_trodden':
      return `${a} and ${b} is a journey our designers have put together many times.`;
    case 'built_before':
      return `Our designers have built ${a} with ${b} before, though only a handful of times.`;
    case 'never_built':
      return `We have not built ${a} with ${b} before, so we have chosen it on how you get there and what is worth seeing.`;
  }
}

/**
 * The nights our designers' itineraries give this town — BUT ONLY IF WE CAN STAND BEHIND IT.
 *
 * A town whose parse did not reconcile against the human day count returns null. It is not
 * a lie we are willing to tell in order to have an opinion. The caller must then fall back
 * to a lower tier, and SAY that it did.
 *
 * This is the whole difference between a consultant and a confident guess.
 */
export function nightsWeCanStandBehind(memory: DesignerMemory, city: string): TypicalNights | null {
  const k = key(city);
  const hit = memory.nights.find((n) => key(n.city) === k);
  if (!hit) return null;
  if (!hit.reconciled) return null;   // the parse disagreed with our own designers' prose
  return hit;
}

/**
 * What we know about the nights, reconciled or not. For diagnostics and the admin panel —
 * NOT for the traveller. Nothing unverified is ever shown to him (spec §3.2).
 */
export function nightsRaw(memory: DesignerMemory, city: string): TypicalNights | null {
  const k = key(city);
  return memory.nights.find((n) => key(n.city) === k) ?? null;
}

/**
 * Given the towns we are considering, how strongly do our designers say they hang together?
 * The mean pairwise co-design strength. This is the Tier-1 score for a candidate SET —
 * a set our designers have actually sold beats a set that merely looks good on a map.
 */
export function setCohesion(memory: DesignerMemory, cities: string[]): number {
  if (cities.length < 2) return 0;
  let total = 0, n = 0;
  for (let i = 0; i < cities.length; i++) {
    for (let j = i + 1; j < cities.length; j++) {
      total += coDesignStrength(memory, cities[i], cities[j]);
      n++;
    }
  }
  return n ? total / n : 0;
}
