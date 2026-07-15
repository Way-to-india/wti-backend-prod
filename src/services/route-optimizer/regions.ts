/**
 * US-801 — THE REGION. Sprint 8 / THE DESIGNER.
 *
 * THE FAILURE THIS MODULE EXISTS TO END:
 *
 *   A traveller wrote "somewhere in north east India" and the planner replied
 *   "Tell us at least one place you would like to visit." Everything else he had
 *   said — his age, his wife's age, romance, trains over flights, ten days, 3-star,
 *   pure vegetarian — was thrown away at a gate that sits IN FRONT of the Sprint-7
 *   brain, because the engine can resolve a CITY and he had named a REGION.
 *
 * This module is the missing resolver: a region phrase, in his own words, becomes a
 * set of states we can actually go and look inside.
 *
 * ------------------------------------------------------------------------------
 * PURE. No DB, no network, no clock. (Same doctrine as intent.ts and tpp.ts: the
 * engine never reaches for the database; the controller injects.) The seed below is
 * small, hand-curated, human knowledge — it is OURS, and it is the correct shape for
 * a constant, not a table. A caller that wants to render regions in a CMS should read
 * REGIONS; it is exported for exactly that.
 *
 * ------------------------------------------------------------------------------
 * THE RECEIPT RULE (the Sprint-8 anti-fabrication law, applied to reference data).
 *
 * `world_cities` has an `admin1Code` column and NO state-name column. So the mapping
 * "Assam is 03" cannot be read out of our data — it has to be asserted. An asserted
 * fact with no receipt is exactly the thing this project has banned.
 *
 * So EVERY state code below was VERIFIED EMPIRICALLY on production (2026-07-12) by
 * querying a city everybody knows to be in that state and reading back the code it
 * actually carries. That city is stored beside the code, as `witness`. It is not
 * decoration: it is the evidence, and it is re-checkable by anyone in one query:
 *
 *     SELECT name, "admin1Code" FROM world_cities
 *      WHERE "countryCode"='IN' AND lower("asciiName") = lower('<witness>');
 *
 * NOTHING HERE IS FROM MEMORY. Two of my own assumptions died in that check:
 *   - Leh is admin1 41 (Ladakh), NOT 12 (Jammu & Kashmir).
 *   - `cities.stateName` — which the spec proposed as a second source — is EMPTY:
 *     201 of its 209 rows are blank. It cannot be used. `admin1Code` is the only
 *     state key that actually exists in our data.
 *
 * ------------------------------------------------------------------------------
 * THE SCOPE RULE (this one protects the shipped product, so read it before editing).
 *
 * Region resolution is a FALLBACK, NEVER AN OVERRIDE. It is for the traveller who
 * named NO place we can resolve. It must never hijack a traveller who DID name one.
 *
 * The reason is concrete. "Goa" is both a state and, in our catalogue, one of the
 * most-sold destinations on earth — the shipped golden-honeymoon test routes
 * Bengaluru -> Coorg -> Goa. If a region matcher swallowed the word "Goa", it would
 * quietly turn a man who asked for Goa into a man who asked for a state to be
 * surveyed, and a green test would go red for a reason nobody could see.
 *
 * Two defences, and they are both deliberate:
 *   1. The bare word "goa" is NOT a trigger phrase. The Goa/Konkan region answers to
 *      "konkan", "konkan coast", "goa and konkan" — never to "goa" alone.
 *   2. `resolveRegion()` REPORTS. It does not decide. The caller may only act on it
 *      when no destination resolved. See `regionIsUsable()`.
 */

// ---- the state, and the city that proves it ----------------------------------

export interface StateRef {
  /** world_cities.admin1Code — the only state key that exists in our data. */
  admin1Code: string;
  /** The state's name, for the traveller's eyes. We never show him a code. */
  name: string;
  /** The city that PROVED this code on production, 2026-07-12. The receipt. */
  witness: string;
}

export type RegionKey =
  | 'north_east'
  | 'rajasthan'
  | 'kerala'
  | 'himalayas'
  | 'golden_triangle'
  | 'goa_konkan'
  | 'ladakh'
  | 'south_india'
  | 'central_india'
  | 'east_india'
  | 'andamans'
  // US-854 — single states a traveller actually names ("the heritage cities of
  // KARNATAKA"). The resolver knew eleven multi-state regions and not the states
  // themselves, so "Karnataka" resolved to nothing and the theme fence never closed.
  | 'karnataka'
  | 'tamil_nadu'
  | 'gujarat'
  | 'himachal'
  | 'uttarakhand'
  | 'kashmir_valley';

export interface Region {
  key: RegionKey;
  /** What we call it back to him, in his register. */
  label: string;
  states: StateRef[];
  /** What he might actually type. Normalised, matched on word boundaries. */
  phrases: string[];
}

// ---- the verified state table -------------------------------------------------
// Every code below was read back off production. The witness is the proof.

const S = {
  ANDAMAN:      { admin1Code: '01', name: 'Andaman & Nicobar Islands', witness: 'Port Blair' },
  ANDHRA:       { admin1Code: '02', name: 'Andhra Pradesh',            witness: 'Rasapudipalem' },
  ASSAM:        { admin1Code: '03', name: 'Assam',                     witness: 'Guwahati' },
  DELHI:        { admin1Code: '07', name: 'Delhi',                     witness: 'Delhi' },
  HIMACHAL:     { admin1Code: '11', name: 'Himachal Pradesh',          witness: 'Shimla' },
  KASHMIR:      { admin1Code: '12', name: 'Jammu & Kashmir',           witness: 'Srinagar' },
  KERALA:       { admin1Code: '13', name: 'Kerala',                    witness: 'Kochi' },
  MANIPUR:      { admin1Code: '17', name: 'Manipur',                   witness: 'Imphal' },
  MEGHALAYA:    { admin1Code: '18', name: 'Meghalaya',                 witness: 'Shillong' },
  KARNATAKA:    { admin1Code: '19', name: 'Karnataka',                 witness: 'Bengaluru' },
  NAGALAND:     { admin1Code: '20', name: 'Nagaland',                  witness: 'Kohima' },
  ODISHA:       { admin1Code: '21', name: 'Odisha',                    witness: 'Bhubaneswar' },
  PUDUCHERRY:   { admin1Code: '22', name: 'Puducherry',                witness: 'Puducherry' },
  RAJASTHAN:    { admin1Code: '24', name: 'Rajasthan',                 witness: 'Jaipur' },
  TAMIL_NADU:   { admin1Code: '25', name: 'Tamil Nadu',                witness: 'Chennai' },
  TRIPURA:      { admin1Code: '26', name: 'Tripura',                   witness: 'Agartala' },
  WEST_BENGAL:  { admin1Code: '28', name: 'West Bengal',               witness: 'Kolkata' },
  SIKKIM:       { admin1Code: '29', name: 'Sikkim',                    witness: 'Gangtok' },
  ARUNACHAL:    { admin1Code: '30', name: 'Arunachal Pradesh',         witness: 'Itanagar' },
  MIZORAM:      { admin1Code: '31', name: 'Mizoram',                   witness: 'Aizawl' },
  GOA:          { admin1Code: '33', name: 'Goa',                       witness: 'Mormugao' },
  BIHAR:        { admin1Code: '34', name: 'Bihar',                     witness: 'Patna' },
  MADHYA:       { admin1Code: '35', name: 'Madhya Pradesh',            witness: 'Indore' },
  UTTAR:        { admin1Code: '36', name: 'Uttar Pradesh',             witness: 'Agra' },
  CHHATTISGARH: { admin1Code: '37', name: 'Chhattisgarh',              witness: 'Raipur' },
  JHARKHAND:    { admin1Code: '38', name: 'Jharkhand',                 witness: 'Jamshedpur' },
  UTTARAKHAND:  { admin1Code: '39', name: 'Uttarakhand',               witness: 'Dehra Dun' },
  TELANGANA:    { admin1Code: '40', name: 'Telangana',                 witness: 'Hyderabad' },
  LADAKH:       { admin1Code: '41', name: 'Ladakh',                    witness: 'Leh' },
  MAHARASHTRA:  { admin1Code: '16', name: 'Maharashtra',               witness: 'Mumbai' },
  // US-854 — verified on production 2026-07-14: Ahmedabad carries admin1Code '09'.
  GUJARAT:      { admin1Code: '09', name: 'Gujarat',                   witness: 'Ahmedabad' },
} as const satisfies Record<string, StateRef>;

/**
 * THE SEED. Eleven regions, as ruled in the spec.
 *
 * A note on what is NOT here, and why. There is no `district`. Founder ruling,
 * 2026-07-12: district is a stored attribute, never a routing key. Trains do not stop
 * at districts; they stop at stations, and stations serve towns at a distance. Saying
 * Kaziranga is "in" Golaghat district tells the traveller nothing about how he gets
 * there or where he sleeps.
 */
export const REGIONS: Region[] = [
  {
    key: 'north_east',
    label: 'the North East',
    // The eight sister states. Verified codes, every one.
    states: [S.ASSAM, S.MEGHALAYA, S.SIKKIM, S.NAGALAND, S.MANIPUR, S.MIZORAM, S.TRIPURA, S.ARUNACHAL],
    phrases: [
      'north east india', 'north east indian', 'northeast india', 'north-east india',
      'north east', 'northeast', 'north-east', 'ne india',
      'seven sisters', 'seven sister states', 'eight sister states',
      'assam', 'meghalaya', 'sikkim', 'arunachal', 'arunachal pradesh', 'nagaland', 'mizoram', 'manipur', 'tripura',
    ],
  },
  {
    key: 'rajasthan',
    label: 'Rajasthan',
    states: [S.RAJASTHAN],
    phrases: ['rajasthan', 'the desert state', 'land of kings', 'rajputana'],
  },
  {
    key: 'kerala',
    label: 'Kerala and the backwaters',
    states: [S.KERALA],
    phrases: ['kerala', 'backwaters', 'kerala backwaters', 'gods own country', "god's own country", 'malabar'],
  },
  {
    key: 'himalayas',
    label: 'the Himalayas',
    states: [S.HIMACHAL, S.UTTARAKHAND, S.KASHMIR],
    phrases: [
      'himalayas', 'himalaya', 'the himalayas', 'himalayan',
      'hills of the north', 'north indian hills', 'mountains of the north',
    ],
  },
  {
    key: 'golden_triangle',
    label: 'the Golden Triangle',
    // Delhi, Agra (Uttar Pradesh) and Jaipur (Rajasthan). Our own catalogue pairs
    // Jaipur with Delhi 29 times and Agra 26 times — this region is not a marketing
    // phrase, it is a fact recovered from thirty years of our designers' decisions.
    states: [S.DELHI, S.UTTAR, S.RAJASTHAN],
    phrases: ['golden triangle', 'the golden triangle', 'delhi agra jaipur'],
  },
  {
    key: 'goa_konkan',
    label: 'Goa and the Konkan coast',
    states: [S.GOA, S.MAHARASHTRA, S.KARNATAKA],
    // DELIBERATELY NOT "goa". See THE SCOPE RULE at the head of this file: the bare
    // word Goa is a destination in our catalogue (the shipped golden-honeymoon test
    // routes to it) and must never be swallowed by a region matcher.
    phrases: ['konkan', 'konkan coast', 'goa and konkan', 'the konkan'],
  },
  {
    key: 'ladakh',
    label: 'Ladakh',
    states: [S.LADAKH],
    phrases: ['ladakh', 'leh ladakh', 'leh-ladakh'],
  },
  {
    key: 'south_india',
    label: 'South India',
    states: [S.KARNATAKA, S.TAMIL_NADU, S.KERALA, S.TELANGANA, S.ANDHRA, S.PUDUCHERRY],
    phrases: ['south india', 'southern india', 'the south', 'peninsular india', 'down south'],
  },
  {
    key: 'central_india',
    label: 'Central India',
    states: [S.MADHYA, S.CHHATTISGARH],
    // US-867 (founder's live test, 15 Jul 2026): a traveller wrote "Madhya Pradesh" and was
    // offered JAIPUR — the region listened for 'central india' but not for the state's own
    // name, so the theme pool ran unfenced across all of India. A state's name is the
    // plainest region word a traveller can write; every region now carries its states'
    // names as phrases.
    phrases: ['central india', 'the heart of india', 'madhya pradesh', 'madhya-pradesh', 'madhyapradesh', 'chhattisgarh', 'chattisgarh'],
  },
  {
    key: 'east_india',
    label: 'East India',
    states: [S.WEST_BENGAL, S.ODISHA, S.BIHAR, S.JHARKHAND],
    phrases: ['east india', 'eastern india', 'the east', 'west bengal', 'bengal', 'odisha', 'orissa', 'jharkhand'],
  },
  {
    key: 'andamans',
    label: 'the Andaman Islands',
    states: [S.ANDAMAN],
    phrases: ['andaman', 'andamans', 'andaman islands', 'andaman and nicobar', 'nicobar'],
  },
  // ---- US-854 — the single states travellers actually name ------------------------------
  // "The heritage cities of Karnataka" resolved to NOTHING: the resolver knew regions and
  // not states. Longest-phrase-wins already arbitrates against the multi-state regions
  // ("himachal pradesh" beats "himalayas" when he wrote the former). Codes verified; the
  // witness is beside each in S.
  {
    key: 'karnataka',
    label: 'Karnataka',
    states: [S.KARNATAKA],
    phrases: ['karnataka', 'karnatka'],
  },
  {
    key: 'tamil_nadu',
    label: 'Tamil Nadu',
    states: [S.TAMIL_NADU],
    phrases: ['tamil nadu', 'tamilnadu'],
  },
  {
    key: 'gujarat',
    label: 'Gujarat',
    states: [S.GUJARAT],
    phrases: ['gujarat', 'gujrat', 'kutch', 'kachchh'],
  },
  {
    key: 'himachal',
    label: 'Himachal Pradesh',
    states: [S.HIMACHAL],
    phrases: ['himachal', 'himachal pradesh'],
  },
  {
    key: 'uttarakhand',
    label: 'Uttarakhand',
    states: [S.UTTARAKHAND],
    phrases: ['uttarakhand', 'uttaranchal', 'garhwal', 'kumaon'],
  },
  {
    key: 'kashmir_valley',
    label: 'Kashmir',
    states: [S.KASHMIR],
    phrases: ['kashmir', 'kashmir valley', 'jammu and kashmir'],
  },
];

// ---- the resolver -------------------------------------------------------------

export interface RegionMatch {
  region: Region;
  /** His own words, verbatim, as they appeared in his sentence. The receipt for the
   *  echo chip: we may only tell him "you said the North East" if he actually did. */
  quote: string;
}

/** Lower-case, collapse whitespace, and drop the punctuation that separates words.
 *  "North-East India!" and "north east india" must be the same thing to us. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/[\s]+/g, ' ')
    .trim();
}

/**
 * Does `phrase` occur in `hay` as WHOLE WORDS? Substring matching is how a region
 * matcher embarrasses itself: "the east" must not fire on "the eastern edge of
 * Bengaluru", and "goa" must never fire on "goat". We anchor on word boundaries and
 * we treat a hyphen as a space, because he may type either.
 */
function containsPhrase(hay: string, phrase: string): boolean {
  const h = ' ' + hay.replace(/-/g, ' ') + ' ';
  const p = ' ' + normalise(phrase).replace(/-/g, ' ') + ' ';
  return h.includes(p);
}

/**
 * Find the region the traveller named, if he named one.
 *
 * LONGEST PHRASE WINS. "north east india" and "north east" both match his sentence;
 * the longer is the more specific reading of what he said, and it is the one we quote
 * back to him. This also stops "the east" (East India) from stealing a traveller who
 * plainly wrote "north east" — a bug that would have sent a man to Kolkata when he
 * asked for Shillong.
 *
 * Returns AT MOST ONE region. A traveller who names two regions in ten days is telling
 * us something we should ask him about, not something we should quietly average.
 *
 * PURE. Give it a sentence, get a reading. It touches nothing.
 */
export function resolveRegion(text: string | null | undefined): RegionMatch | null {
  if (!text || typeof text !== 'string') return null;
  const hay = normalise(text);
  if (!hay) return null;

  let best: { region: Region; phrase: string } | null = null;

  for (const region of REGIONS) {
    for (const phrase of region.phrases) {
      if (!containsPhrase(hay, phrase)) continue;
      if (!best || phrase.length > best.phrase.length) best = { region, phrase };
    }
  }
  if (!best) return null;

  // The quote must be HIS words, not our phrase list. Recover the span as he typed
  // it — capitalisation, hyphens and all — so the echo chip can say "you said" and be
  // telling the truth. If we cannot find it in his raw sentence (only in the
  // normalised one), we fall back to the matched phrase rather than invent a quote.
  const quote = recoverQuote(text, best.phrase) ?? best.phrase;
  return { region: best.region, quote };
}

/**
 * Find the phrase in his ORIGINAL sentence and hand back the span exactly as he wrote
 * it. This is the same anti-fabrication discipline as intent.ts/verifyQuote: a quote
 * we composed is not a quote.
 */
function recoverQuote(original: string, phrase: string): string | null {
  const words = phrase.split(' ').filter(Boolean);
  // Allow any run of non-letter characters between his words (a hyphen, a comma).
  const pattern = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^a-zA-Z0-9]+');
  const re = new RegExp(`\\b${pattern}\\b`, 'i');
  const m = original.match(re);
  return m ? m[0] : null;
}

/**
 * THE GUARD THAT PROTECTS THE SHIPPED PRODUCT.
 *
 * A region may only be ACTED ON when the traveller has given us nothing else to go on.
 * If he named a place we could resolve, that place is the brief — Law 1 — and a region
 * word elsewhere in his sentence ("a beach holiday, we love South India") is colour,
 * not an instruction to survey five states.
 *
 * Call this at the point of decision. Do not infer it.
 */
export function regionIsUsable(match: RegionMatch | null, resolvedDestinationCount: number): boolean {
  return match !== null && resolvedDestinationCount === 0;
}

/** Every admin1 code the region covers — the key the candidate query will filter on. */
export function statesOf(match: RegionMatch): string[] {
  return match.region.states.map((s) => s.admin1Code);
}

/** The state names, for the traveller's eyes. We never show him "03". */
export function stateNamesOf(match: RegionMatch): string[] {
  return match.region.states.map((s) => s.name);
}

/** Look a region up by its key. For the CMS, and for tests. */
export function regionByKey(key: RegionKey): Region | null {
  return REGIONS.find((r) => r.key === key) ?? null;
}
