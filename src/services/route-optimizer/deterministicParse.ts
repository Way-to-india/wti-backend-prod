/**
 * US-868 — THE DETERMINISTIC-FIRST PARSER. CODE FIRST, AI LAST.
 *
 * FOUNDER RULING (15 Jul 2026): "we cannot endlessly spend money on AI tokens" — and the
 * session-12 theme that followed it: reduce the use and dependence on AI. Plain-code
 * readers run BEFORE any Haiku call; the model is called ONLY for what code could not
 * fill.
 *
 * THE LAW: a deterministic reading carries the same he_said quote discipline as a model
 * reading — the quote is the MATCHED SUBSTRING, verbatim. Every quote this module emits
 * is by construction a substring of his sentence, so verifyQuote() in intentFromRaw()
 * always blesses it. Nothing here can invent his words, because everything here IS his
 * words.
 *
 * THE SKIP RULE (the founder's, verbatim): when the code readers fill
 *
 *       ORIGIN + DURATION + (chips OR cities OR region OR named circuit)
 *
 * Haiku IS NOT CALLED. "Cities" means cities he POSTED AS FIELDS (the pick path) — this
 * module never extracts destinations from prose; that remains the model's one remaining
 * job, and the town-scan fence below exists precisely to protect it.
 *
 * THE LAW-1 FENCE. A sentence can be "complete" by the rule above and STILL name a town
 * ("a pilgrimage from Delhi, 6 days, we want to see Varanasi"). If code skipped the model
 * there, his named city would be silently replaced by a theme shortlist — Law 1 broken by
 * an optimisation. So this module also surfaces candidateTownTokens(): every word and
 * word-pair of his sentence that COULD be a town, minus everything the readers already
 * accounted for. The CONTROLLER checks those tokens against our own catalogue and the
 * gazetteer (a name is not a key; the catalogue is the primary gazetteer) — one cheap SQL
 * — and if ANY hit survives, the model IS called after all. A false positive costs one
 * Haiku call (yesterday's price); a false negative would cost a traveller his city, so
 * the scan is deliberately greedy.
 *
 * PURE. No DB, no network, no clock. The controller injects the catalogue.
 */

import {
  nightsFromWords, frameFromText, chipKeywordHits,
  type StatedLength, type TripFrame, type RawIntent, type Chip, type ComfortTier,
  type Composition, type Purpose,
} from './intent';
import { resolveRegion, type RegionMatch } from './regions';
import { resolveNamedCircuit, type NamedCircuitMatch } from './namedCircuits';

// ---- US-831b — the origin readers, moved here from the controller so every -----------
// deterministic reader lives in one testable place. Same patterns, same stop-words.
const ORIGIN_PATTERNS: RegExp[] = [
  /\b(?:we|i|they|my parents|my wife and i)?\s*(?:are\s+)?(?:travelling|traveling|starting|departing|leaving|flying|coming)\s+(?:out\s+)?from\s+([A-Za-z][A-Za-z .'-]{2,28})/i,
  /\b(?:we|i|they|my parents)\s+(?:live|are\s+based|reside)\s+in\s+([A-Za-z][A-Za-z .'-]{2,28})/i,
  /\bbased\s+in\s+([A-Za-z][A-Za-z .'-]{2,28})/i,
  /\bfrom\s+([A-Za-z][A-Za-z .'-]{2,28})\b/i,          // the plain one, last: "four friends from PUNE"
];

/** Words that follow a city name and mean the match has run off the end of it. */
const ORIGIN_STOP = /\b(?:want|wants|wish|wishes|and|with|for|to|who|that|we|i|they|all|aged|in our|looking|would|will|plan|planning|travelling|traveling|is|are|has|have)\b/i;

/**
 * THE FRAME IS NOT THE DOOR (US-868). "starting from Bangalore" satisfies these patterns,
 * but it is his ENTRY GATE (US-854) — his door is elsewhere in the same sentence ("we
 * would be flying from Delhi"). So the reader can be given names to REFUSE: it walks every
 * match of every pattern and returns the first candidate that is not a frame gate.
 */
export function originFromTextExcluding(text: string, exclude: string[]): { name: string; quote: string } | null {
  const banned = new Set(exclude.filter(Boolean).map((s) => s.trim().toLowerCase()));
  for (const re of ORIGIN_PATTERNS) {
    const g = new RegExp(re.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = g.exec(text)) !== null) {
      if (!m[1]) continue;
      // Cut the capture at the first word that cannot be part of a city name. "PUNE, all
      // in our twenties" must yield "Pune", never "Pune all in our twenties".
      let cand = m[1].split(/[,.;:!?]/)[0].trim();
      const stop = ORIGIN_STOP.exec(cand);
      if (stop && stop.index > 0) cand = cand.slice(0, stop.index).trim();
      cand = cand.replace(/\s+/g, ' ').trim();
      if (cand.length < 3 || cand.length > 28) continue;
      if (/^(the|a|an|there|here|home|india)$/i.test(cand)) continue;
      if (banned.has(cand.toLowerCase())) continue;
      return { name: cand, quote: m[0].trim() };
    }
  }
  return null;
}

export function originFromText(text: string): { name: string; quote: string } | null {
  return originFromTextExcluding(text, []);
}

// ---- the comfort tier — his one word decides the hotels AND the contract --------------
// (compileContract: luxury/premium ⇒ comfort_first ⇒ dead-hours gate, leg ordeal ceiling,
// the hotel-night reward DELETED. Missing this on a skipped parse would re-sell the
// 43-hour train — so the reader is deliberately generous with spellings of comfort.)
const TIER_PATTERNS: [RegExp, ComfortTier][] = [
  [/\b(?:luxur\w*|5[\s-]?star|five[\s-]?star)\b/i, 'luxury'],
  [/\b(?:premium|4[\s-]?star|four[\s-]?star)\b/i, 'premium'],
  [/\b(?:budget|cheap\w*|economical|low[\s-]?cost|shoestring)\b/i, 'budget'],
  [/\b(?:3[\s-]?star|three[\s-]?star|mid[\s-]?range)\b/i, 'standard'],
];

export function comfortTierFromText(text: string): { tier: ComfortTier; quote: string } | null {
  for (const [re, tier] of TIER_PATTERNS) {
    const m = re.exec(text);
    if (m) return { tier, quote: m[0] };
  }
  return null;
}

// ---- the mode stances — refusals and preferences, with the qualifier doctrine ---------
// "no trains" is refuse+any (the mode leaves the pool). "no long drives" is avoid+long
// (a ban on the ORDEAL, not the rolling stock — the 3 h drive is blessed, the 8 h drive
// is not). The patterns compile his words to exactly the machinery Law 2 demands.
interface ModeHit {
  mode: 'road' | 'rail' | 'air' | 'ferry';
  stance: 'prefer' | 'avoid' | 'refuse';
  qualifier: 'any' | 'long' | 'overnight';
  strength: number;
  quote: string;
}

const MODE_PATTERNS: [RegExp, ModeHit['mode'], ModeHit['stance'], ModeHit['qualifier']][] = [
  // overnight FIRST — "no overnight trains" must not fall into the blanket "no trains".
  [/\b(?:no|avoid|without)\s+overnight\s+(?:trains?|journeys?|travel)\b/i, 'rail', 'refuse', 'overnight'],
  // the long-road qualifier — the golden sentence's "no trains or long road journeys"
  // matches here WHOLE, so the road ceiling and the rail ban both fire from one phrase.
  [/\b(?:no|avoid)\s+(?:trains?\s+or\s+)?long\s+(?:road\s+journeys?|drives?|driving|car\s+(?:rides?|journeys?))\b/i, 'road', 'avoid', 'long'],
  [/\b(?:no|without)\s+(?:any\s+)?trains?\b/i, 'rail', 'refuse', 'any'],
  [/\bavoid\s+(?:any\s+)?trains?\b/i, 'rail', 'avoid', 'any'],
  [/\b(?:no|without)\s+(?:any\s+)?flights?\b/i, 'air', 'refuse', 'any'],
  [/\b(?:avoid\s+fly(?:ing)?|(?:don'?t|do\s+not)\s+want\s+to\s+fly)\b/i, 'air', 'avoid', 'any'],
  [/\bno\s+road\s+(?:journeys?|travel|trips?)\b/i, 'road', 'refuse', 'any'],
  [/\b(?:would\s+)?prefer\s+(?:to\s+)?(?:fly\b|flights?\b|air\s+travel\b)(?:\s+wherever\s+possible)?/i, 'air', 'prefer', 'any'],
  [/\bflights?\s+wherever\s+possible\b/i, 'air', 'prefer', 'any'],
  [/\b(?:would\s+)?prefer\s+(?:to\s+travel\s+by\s+)?trains?\b(?:\s+wherever\s+possible)?/i, 'rail', 'prefer', 'any'],
  [/\btrains?\s+wherever\s+possible\b/i, 'rail', 'prefer', 'any'],
];

export function modeStancesFromText(text: string): ModeHit[] {
  const out: ModeHit[] = [];
  for (const [re, mode, stance, qualifier] of MODE_PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    // one stance per mode+stance pair; the first (most specific) pattern wins.
    if (out.some((h) => h.mode === mode && h.stance === stance)) continue;
    out.push({
      mode, stance, qualifier,
      strength: stance === 'refuse' ? 0.9 : stance === 'avoid' ? 0.7 : 0.8,
      quote: m[0].trim(),
    });
  }
  return out;
}

// ---- the month — his word for it, verbatim ---------------------------------------------
// "may" is an English verb before it is a month, so it alone demands travel context.
const MONTH_RES: [RegExp, number][] = [
  [/\bjanuary\b/i, 1], [/\bfebruary\b/i, 2], [/\bmarch\b/i, 3], [/\bapril\b/i, 4],
  [/\b(?:in|during|for|of|early|mid|late|this|next)\s+(may)\b/i, 5],
  [/\bjune\b/i, 6], [/\bjuly\b/i, 7], [/\baugust\b/i, 8], [/\bseptember\b/i, 9],
  [/\boctober\b/i, 10], [/\bnovember\b/i, 11], [/\bdecember\b/i, 12],
];

export function monthFromText(text: string): { month: number; quote: string } | null {
  for (const [re, month] of MONTH_RES) {
    const m = re.exec(text);
    if (m) return { month, quote: (m[1] ?? m[0]).trim() };
  }
  return null;
}

// ---- the party — explicit counts and plainly-stated couples only. ---------------------
// A guess that happens to be right is still a guess; where the sentence is not explicit
// this returns nothing and the default of 2 stays labelled we_guessed, exactly as today.
const PAX_WORDS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

export function partyFromText(text: string): { pax: number | null; composition: Composition | null; quote: string } | null {
  const count = /\b(\d{1,2}|two|three|four|five|six|seven|eight|nine|ten)\s+(?:of\s+us|persons?|people|pax|adults?|travellers?|travelers?|friends?|members)\b/i.exec(text);
  const couple = /\b(?:i\s+along\s+with\s+my\s+wife|my\s+wife\s+and\s+i|my\s+husband\s+and\s+i|along\s+with\s+my\s+(?:wife|husband)|we\s+are\s+a\s+couple|both\s+of\s+us|two\s+of\s+us|\bcouple\b)/i.exec(text);
  const seniors = /\b(?:my\s+parents|senior\s+citizens?|elderly)\b/i.exec(text);
  const kids = /\b(?:kids?|children|my\s+(?:son|daughter))\b/i.exec(text);

  const composition: Composition | null =
    seniors ? 'seniors' : kids ? 'family_kids' : couple ? 'couple' : count ? 'friends' : null;
  if (count) {
    const w = count[1].toLowerCase();
    const n = /^\d+$/.test(w) ? parseInt(w, 10) : PAX_WORDS[w];
    if (Number.isFinite(n) && n >= 1 && n <= 12) return { pax: n, composition, quote: count[0].trim() };
  }
  if (couple) return { pax: 2, composition: 'couple', quote: couple[0].trim() };
  if (seniors) return { pax: null, composition: 'seniors', quote: seniors[0].trim() };
  if (kids) return { pax: null, composition: 'family_kids', quote: kids[0].trim() };
  return null;
}

// ---- the purpose — only where his own word IS the purpose ------------------------------
const PURPOSE_RES: [RegExp, Purpose][] = [
  [/\b(?:pilgrimage|yatra|darshan|tirth\w*)\b/i, 'pilgrimage'],
  [/\bhoneymoon\b/i, 'honeymoon'],
  [/\b(?:wildlife|safari)\b/i, 'wildlife'],
  [/\b(?:adventure|trek(?:king)?)\b/i, 'adventure'],
  [/\bheritage\b/i, 'heritage'],
];

export function purposeFromText(text: string): { purpose: Purpose; quote: string } | null {
  for (const [re, purpose] of PURPOSE_RES) {
    const m = re.exec(text);
    if (m) return { purpose, quote: m[0].trim() };
  }
  return null;
}

// ---- the Law-1 fence: which of his words might be a town? -----------------------------
// Greedy on purpose. Anything the readers already accounted for (origin, frame, region,
// circuit, months) is excluded; a light stop-list trims plain English. The controller
// checks the survivors against stay_nodes + Indian world_cities; ANY hit = the model runs.
const TOKEN_STOP = new Set([
  // plain english that shows up in every travel sentence
  'the', 'and', 'for', 'with', 'from', 'along', 'want', 'wants', 'wish', 'would', 'will',
  'like', 'love', 'need', 'prefer', 'please', 'plan', 'planning', 'trip', 'tour', 'tours',
  'journey', 'journeys', 'travel', 'travelling', 'traveling', 'holiday', 'holidays',
  'vacation', 'visit', 'visiting', 'see', 'cover', 'covering', 'days', 'day', 'nights',
  'night', 'week', 'weeks', 'month', 'months', 'year', 'years', 'old', 'wife', 'husband',
  'family', 'friends', 'parents', 'children', 'kids', 'couple', 'persons', 'people',
  'maximum', 'minimum', 'about', 'around', 'between', 'after', 'before', 'during',
  'starting', 'start', 'begin', 'beginning', 'end', 'ending', 'back', 'home', 'return',
  'india', 'indian', 'north', 'south', 'east', 'west', 'central', 'northeast',
  // our own vocabulary — chips, tiers, modes, food. these are reasons, not towns.
  'pilgrimage', 'yatra', 'darshan', 'temple', 'temples', 'beach', 'beaches', 'sea',
  'coast', 'island', 'islands', 'honeymoon', 'romance', 'romantic', 'culture', 'cultural',
  'festival', 'festivals', 'music', 'dance', 'heritage', 'fort', 'forts', 'palace',
  'palaces', 'monument', 'monuments', 'hill', 'hills', 'mountain', 'mountains', 'valley',
  'snow', 'trek', 'trekking', 'hike', 'hiking', 'rafting', 'adventure', 'camping',
  'wildlife', 'safari', 'safaris', 'jungle', 'tiger', 'tigers', 'bird', 'birds',
  'elephant', 'rhino', 'national', 'park', 'parks', 'luxury', 'luxurious', 'premium',
  'budget', 'cheap', 'standard', 'comfortable', 'comfort', 'star', 'hotel', 'hotels',
  'resort', 'resorts', 'stay', 'train', 'trains', 'flight', 'flights', 'fly', 'flying',
  'road', 'roads', 'drive', 'drives', 'driving', 'car', 'overnight', 'vegetarian',
  'vegetarians', 'veg', 'food', 'eggs', 'meals', 'mango', 'january', 'february', 'march',
  'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
]);

export function candidateTownTokens(text: string, excludeQuotes: (string | null | undefined)[]): string[] {
  const excluded = new Set<string>();
  for (const q of excludeQuotes) {
    if (!q) continue;
    for (const t of q.toLowerCase().split(/[^a-z0-9]+/)) if (t) excluded.add(t);
  }
  const words = text.split(/[^A-Za-z]+/).filter((w) => w.length >= 3).map((w) => w.toLowerCase());
  const out = new Set<string>();
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!TOKEN_STOP.has(w) && !excluded.has(w)) out.add(w);
    // two-word towns: "bodh gaya", "mount abu". A gram is excluded only if EVERY word of
    // it belongs to a reader's quote — "from Lucknow to" must not shadow "lucknow fort".
    if (i + 1 < words.length) {
      const w2 = words[i + 1];
      if (w2.length >= 3 && !(TOKEN_STOP.has(w) && TOKEN_STOP.has(w2))
          && !(excluded.has(w) && excluded.has(w2))) {
        out.add(`${w} ${w2}`);
      }
    }
    if (out.size >= 120) break;
  }
  return [...out];
}

// ---- the composed reading ---------------------------------------------------------------

export interface DeterministicParse {
  /** candidates in the model's own wire shape, quotes verbatim — feed to intentFromRaw(). */
  raw: RawIntent;
  origin: { name: string; quote: string } | null;
  nights: StatedLength | null;
  month: { month: number; quote: string } | null;
  tier: { tier: ComfortTier; quote: string } | null;
  modes: ModeHit[];
  chips: { chip: Chip; quote: string }[];
  region: RegionMatch | null;
  circuit: NamedCircuitMatch | null;
  frame: TripFrame;
  /** words of his that MIGHT be towns — the controller must scan these before skipping the model. */
  townCandidates: string[];
}

export function deterministicParse(text: string): DeterministicParse {
  const frameEarly = frameFromText(text);
  // THE FRAME IS NOT THE DOOR: the entry and exit gates (US-854) may never be read back
  // as his origin. The reader walks past them to the candidate that is actually his door.
  const origin = originFromTextExcluding(text, [frameEarly.entry ?? '', frameEarly.exit ?? '']);
  const nights = nightsFromWords(text);
  const month = monthFromText(text);
  const tier = comfortTierFromText(text);
  const modes = modeStancesFromText(text);
  const chips = chipKeywordHits(text);
  const region = resolveRegion(text);
  const circuit = resolveNamedCircuit(text);
  const frame = frameEarly;
  const party = partyFromText(text);
  const purpose = purposeFromText(text);

  const quotes: Record<string, string> = {};
  if (origin) quotes.start = origin.quote;
  if (nights) quotes.nights = nights.quote;
  if (month) quotes.month = month.quote;
  if (tier) quotes.comfortTier = tier.quote;
  if (party) quotes.party = party.quote;
  if (purpose) quotes.purpose = purpose.quote;
  for (const h of modes) quotes[`mode_${h.mode}`] = h.quote;

  // his chip words ride as interests: intentFromRaw maps them back to chips through the
  // same fixed keyword table, and each carries its own verbatim quote.
  const interests: string[] = [];
  for (const c of chips) {
    const w = c.quote.trim().toLowerCase();
    interests.push(w);
    quotes[`interest_${w.replace(/[\s ]+/g, ' ')}`] = c.quote;
  }

  const raw: RawIntent = {
    cities: [],                                  // code NEVER invents destinations
    start: origin?.name ?? null,
    end: frame.exit ?? null,
    pax: party?.pax ?? null,
    profile: party?.composition === 'seniors' ? 'senior'
           : party?.composition === 'family_kids' ? 'family' : null,
    month: month?.month ?? null,
    nights: nights?.maxNights ?? null,
    purpose: purpose?.purpose ?? null,
    comfortTier: tier?.tier ?? null,
    pace: null,
    composition: party?.composition ?? null,
    interests: interests.length ? interests : null,
    mainChips: null,                              // a chip row is a BUTTON; prose never fills it
    alsoHappyToSee: null,
    modes: modes.length ? modes.map((h) => ({
      mode: h.mode, stance: h.stance, qualifier: h.qualifier, strength: h.strength,
    })) : null,
    quotes,
  };

  const townCandidates = candidateTownTokens(text, [
    origin?.quote, origin?.name, frame.entryQuote, frame.entry, frame.exitQuote, frame.exit,
    region?.quote, circuit?.quote,
  ]);

  return { raw, origin, nights, month, tier, modes, chips, region, circuit, frame, townCandidates };
}

/** What the request already carries as FIELDS — his word, stronger than any reading. */
export interface FieldFacts {
  /** cities[] posted with something in it (the pick path). Carries its own nights. */
  statedCities: boolean;
  /** start typed into the origin box. */
  statedStart: boolean;
  /** nights from the stepper. */
  statedNights: boolean;
}

/**
 * THE SKIP RULE, decided. True = the code readers (plus his own fields) have filled
 * origin + duration + a brief, and Haiku has nothing left to earn — SUBJECT TO the
 * controller's two remaining checks, which need the DB and so cannot live here:
 *   1. the town scan over candidateTownTokens (Law 1 — a named town means the model runs);
 *   2. verifyCity on a text-read origin (a model may propose; only the gazetteer confirms
 *      — and the same is true of a regex).
 */
export function deterministicallyComplete(det: DeterministicParse, fields: FieldFacts): boolean {
  const originKnown = fields.statedStart || !!det.origin;
  const durationKnown = fields.statedNights || fields.statedCities || !!det.nights;
  const briefKnown = fields.statedCities || det.chips.length > 0 || !!det.region || !!det.circuit;
  return originKnown && durationKnown && briefKnown;
}
