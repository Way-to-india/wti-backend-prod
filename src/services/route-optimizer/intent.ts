/**
 * L0 — THE TRAVELLER'S INTENT (the ear). Sprint 7 / US-601 + US-602.
 *
 * THE-CONSULTANTS-LAW.md, Law 1: "What the traveller says he wants is not one more
 * term in a scoring function to be outvoted by cost. It is THE BRIEF."
 *
 * Until now the engine heard six things (cities, nights, start, pax, profile, month)
 * and had nowhere to put the rest. A man asked for a luxury honeymoon with no trains
 * and was sold a nine-hour overnight train because it saved a hotel night. This module
 * is the slot those words were missing.
 *
 * Two halves, both PURE (DB never enters the engine; the controller injects):
 *
 *   US-601  intentFromRaw()   raw model JSON + his own sentence → TravellerIntent,
 *                             where every fact carries its receipt (Reading<T>).
 *   US-602  compileContract() TravellerIntent → PlanContract: his refusals become
 *                             filters, his qualified refusals become ordeal ceilings,
 *                             his comfort becomes a tightening and a TPP.
 *
 * STRUCTURAL GUARANTEE (same doctrine as tpp.ts, and for the same reason): this module
 * imports NOTHING from physiology.ts. Its only bridge to the body gates is `Tightening`,
 * a type in which a LOOSENING CANNOT BE EXPRESSED, merged by `tightened()`, which clamps
 * in one direction only. Intent may make the body's rules stricter. It can never make
 * them kinder. That is a type error, not a code review.
 */

import type { Mode, TPP } from './types';

// ---- US-601: the reading — every fact carries its receipt ---------------------

export type Provenance = 'he_said' | 'we_inferred' | 'we_need_it';

/**
 * One fact, and where it came from. `quote` is not decoration: it is the thing that
 * makes the echo panel honest, and no value may be labelled `he_said` unless its quote
 * is literally present in his sentence (verifyQuote below). An inference presented as
 * his word is the worst outcome available to us — so we made it unrepresentable.
 */
export interface Reading<T> {
  value: T | null;
  provenance: Provenance;
  confidence: number;   // 0..1, from the coarse rubric below — not vibes
  quote?: string;       // his words, verbatim, ONLY when provenance === 'he_said'
  basis?: string;       // one plain line, ONLY when provenance === 'we_inferred'
}

/** The confidence rubric (spec Part 8.2 — coarse on purpose; Haiku's self-reported
 *  confidence is not calibrated, so we do not ask it for one). */
export const CONF = { EXPLICIT: 0.95, STRONG: 0.7, WEAK: 0.4 } as const;

export function heSaid<T>(value: T, quote: string, confidence = CONF.EXPLICIT): Reading<T> {
  return { value, provenance: 'he_said', confidence, quote };
}
export function weInferred<T>(value: T, basis: string, confidence = CONF.STRONG): Reading<T> {
  return { value, provenance: 'we_inferred', confidence, basis };
}
export function weNeedIt<T>(): Reading<T> {
  return { value: null, provenance: 'we_need_it', confidence: 0 };
}

// ---- the mode stance — refusals are first-class, and they carry a scope -------

/**
 * "No trains or long road journeys" is TWO different speech acts. Trains are refused as
 * a category (unqualified). Road is refused only when it is LONG (qualified). They must
 * compile to different machinery, and that difference is the whole of Law 2:
 *
 *   refuse + qualifier 'any'  → a candidate FILTER (the mode leaves the pool)
 *   refuse/avoid + qualifier  → an ORDEAL CEILING on that mode (a ban on the ordeal,
 *                               not on the rolling stock — the 3 h drive is blessed,
 *                               the 8 h drive is not)
 */
export type Stance = 'prefer' | 'accept' | 'avoid' | 'refuse';
export type Qualifier = 'any' | 'long' | 'overnight' | 'night_arrival';

export interface ModeStance {
  mode: Mode;
  stance: Stance;
  qualifier: Qualifier;
  strength: number;        // 0..1 — "absolutely no trains" vs "I would rather not"
  reading: Reading<true>;  // provenance + his quote
}

// ---- the intent ---------------------------------------------------------------

export type Purpose =
  | 'honeymoon' | 'pilgrimage' | 'family_holiday' | 'heritage'
  | 'leisure' | 'adventure' | 'wildlife' | 'wellness' | 'business';
export type ComfortTier = 'budget' | 'standard' | 'premium' | 'luxury';
export type BudgetStance = 'price_first' | 'value' | 'comfort_first' | 'money_no_object';
export type Pace = 'savour' | 'steady' | 'packed';
export type Composition = 'couple' | 'family_kids' | 'seniors' | 'friends' | 'solo';
export type GroupProfileName = 'standard' | 'family' | 'senior';

export interface PartyFacts {
  pax: number;
  composition: Composition;
  profile: GroupProfileName;
}

export interface TravellerIntent {
  purpose: Reading<Purpose>;
  comfortTier: Reading<ComfortTier>;
  budgetStance: Reading<BudgetStance>;
  modeStances: ModeStance[];
  interests: Reading<string>[];
  pace: Reading<Pace>;
  party: Reading<PartyFacts>;
  /** TWO FACTS, TWO RECEIPTS. These were once a single Reading<{nights, month}> — and the echo
   *  panel test caught exactly what that costs: he answers the MONTH, and the nights WE
   *  invented get promoted to "you said" along with it. An inference wearing his words is the
   *  one thing we said we would never do. A Reading may hold ONE fact, and only one. */
  nights: Reading<number>;
  month: Reading<number>;
  origin: Reading<string>;
  destinations: Reading<string>[];
}

// ---- the raw shape the model is asked for (candidates ONLY; nothing trusted) ---

export interface RawIntent {
  cities?: { name: string; nights: number }[];
  start?: string | null;
  end?: string | null;
  pax?: number | null;
  profile?: string | null;
  month?: number | null;
  nights?: number | null;
  purpose?: string | null;
  comfortTier?: string | null;
  pace?: string | null;
  composition?: string | null;
  interests?: string[] | null;
  modes?: { mode?: string; stance?: string; qualifier?: string; strength?: number }[] | null;
  /** the model must hand back the traveller's OWN words for anything it claims he said. */
  quotes?: Record<string, string> | null;
}

const PURPOSES: Purpose[] = ['honeymoon', 'pilgrimage', 'family_holiday', 'heritage', 'leisure', 'adventure', 'wildlife', 'wellness', 'business'];
const TIERS: ComfortTier[] = ['budget', 'standard', 'premium', 'luxury'];
const PACES: Pace[] = ['savour', 'steady', 'packed'];
const COMPOSITIONS: Composition[] = ['couple', 'family_kids', 'seniors', 'friends', 'solo'];
const MODES: Mode[] = ['ROAD', 'RAIL', 'AIR', 'FERRY'];
const STANCES: Stance[] = ['prefer', 'accept', 'avoid', 'refuse'];
const QUALIFIERS: Qualifier[] = ['any', 'long', 'overnight', 'night_arrival'];

const oneOf = <T extends string>(v: unknown, allowed: T[]): T | null =>
  typeof v === 'string' && (allowed as string[]).includes(v.toLowerCase()) ? (v.toLowerCase() as T) : null;

const norm = (s: string) => s.toLowerCase().replace(/[\s ]+/g, ' ').trim();

/**
 * THE ANTI-FABRICATION LOCK. A model may hand us a quote it composed rather than read.
 * So a quote is only a quote if it is ACTUALLY IN HIS SENTENCE. If it is not, the fact
 * is not lost — it is demoted to `we_inferred`, which is exactly what it is.
 */
export function verifyQuote(quote: string | undefined | null, text: string): string | null {
  if (!quote || typeof quote !== 'string') return null;
  const q = norm(quote);
  if (q.length < 3) return null;
  return norm(text).includes(q) ? quote.trim() : null;
}

/** Build a Reading from a model value + the quote it claims for it. */
function read<T>(value: T | null, rawQuote: string | undefined, text: string, basisIfInferred: string, inferredConfidence = CONF.STRONG): Reading<T> {
  if (value == null) return weNeedIt<T>();
  const q = verifyQuote(rawQuote, text);
  return q ? heSaid(value, q) : weInferred(value, basisIfInferred, inferredConfidence);
}

/**
 * "I along with my wife" is TWO travellers, stated. The old parser guessed it — and a
 * guess that happens to be right is still a guess, and gets labelled as one. This guard
 * (kept verbatim in spirit from publicPlanner.controller.ts:179) stops the model turning
 * a plainly-plural sentence into a party of one.
 */
export function soundsLikeAGroup(text: string): boolean {
  return /\b(friends?|family|we|us|our|group|couple|parents|kids|children|wife|husband|spouse|partner)\b/i.test(text);
}

/** Party composition → the coarse GroupProfile the physiology model already speaks. */
export function profileForComposition(c: Composition | null): GroupProfileName {
  if (c === 'seniors') return 'senior';
  if (c === 'family_kids') return 'family';
  return 'standard';
}

/**
 * US-601 — raw model JSON + his own sentence → TravellerIntent. PURE: no network, no
 * DB, no clock. The Haiku call lives in the controller; everything that decides what we
 * BELIEVE lives here, where it can be tested against his actual words.
 */
/**
 * US-805 — HIS TRIP LENGTH, IN HIS OWN WORDS. AND A CEILING IS NOT A TARGET.
 *
 * THE DEFECT THIS CLOSES. Found on the LIVE PAYLOAD, 2026-07-13 — never by a unit test.
 *
 *   He wrote: "Up to 10 days maximum."
 *   We recorded: nights = null, provenance = 'we_need_it'.
 *
 * So the echo panel would have told a man we did not know how long his trip was, in the
 * same breath as he told us. And the Designer, finding nothing, fell back to a default of
 * six — WE INVENTED HIS TRIP LENGTH WHILE HE WAS LOOKING AT US.
 *
 * ---------------------------------------------------------------------------------
 * FOUNDER, 2026-07-13, AND HE IS RIGHT:
 *
 *   "Up to 10 days maximum does not mean 10 days is minimum too."
 *   "Between 8 to 10 days does signify that minimum 8 days and maximum 10 days."
 *
 * A CEILING IS NOT A TARGET. A man who says "no more than ten days" has not asked for a
 * ten-day trip — he has told us where his patience ends. If we read that as a target we
 * will pad his holiday with a town he never wanted, to fill a number he never asked for.
 *
 * A RANGE IS TWO FACTS. "Between 8 and 10 days" is a FLOOR as well as a ceiling, and a man
 * who says it and is handed four nights has been ignored just as surely.
 *
 * So this returns BOTH bounds, and it says which of them he actually gave us.
 *
 * ---------------------------------------------------------------------------------
 * WHY IT STAYS SILENT ON TWO LOOSE QUANTITIES.
 *
 * "3 days in Delhi and 4 days in Agra" holds two numbers and NEITHER is the trip length.
 * A rule that grabbed the largest would say "you said 4 nights" — a lie wearing his own
 * words, which is worse than the honest "we need it" we say today. WHERE WE CANNOT READ
 * HIM, WE ASK.
 *
 * AND DAYS ARE NOT NIGHTS. A ten-day trip is NINE nights. Getting that off by one is how a
 * traveller ends up with a hotel booked for a night he is sitting on a train.
 *
 * PURE. Give it his sentence, get a reading or an honest null.
 */
const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
};

const NUM = '\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty';

const toNum = (w: string): number | null => {
  const n = /^\d+$/.test(w) ? parseInt(w, 10) : WORD_NUMBERS[w.toLowerCase()];
  return Number.isFinite(n) && n >= 1 && n <= 30 ? n : null;
};

/** Days are not nights. Ten days is nine nights. */
const toNights = (n: number, unit: string): number => (/^day/i.test(unit) ? n - 1 : n);

export interface StatedLength {
  /** The most nights he will accept. Always present — it is the binding constraint. */
  maxNights: number;
  /** The fewest he wants. ONLY when he gave a range. Null means he set no floor. */
  minNights: number | null;
  /** 'ceiling' = "up to 10 days". 'range' = "8 to 10 days". 'exact' = "10 days". */
  bound: 'ceiling' | 'range' | 'exact';
  /** HIS words, recovered from his sentence. A quote we composed is not a quote. */
  quote: string;
}

export function nightsFromWords(text: string | null | undefined): StatedLength | null {
  if (!text) return null;

  // A RANGE FIRST — "between 8 and 10 days", "8 to 10 days", "8-10 nights".
  // It must win, because a range also contains something that looks like a bare number.
  const rangeRe = new RegExp(
    `\\b(?:between\\s+)?(${NUM})\\s*(?:-|–|to|and|or)\\s*(${NUM})\\s*(days?|nights?)\\b`, 'i');
  const rm = text.match(rangeRe);
  if (rm) {
    const lo = toNum(rm[1]), hi = toNum(rm[2]);
    if (lo && hi && hi > lo) {
      const minNights = toNights(lo, rm[3]);
      const maxNights = toNights(hi, rm[3]);
      if (maxNights >= 1) {
        return { maxNights, minNights: minNights >= 1 ? minNights : null, bound: 'range', quote: rm[0] };
      }
    }
  }

  // Otherwise exactly ONE quantity, or we do not claim to know.
  const one = [...text.matchAll(new RegExp(`\\b(${NUM})\\s*(days?|nights?)\\b`, 'gi'))];
  if (one.length !== 1) return null;

  const [quote, num, unit] = one[0];
  const n = toNum(num);
  if (!n) return null;
  const maxNights = toNights(n, unit);
  if (maxNights < 1) return null;

  // IS IT A CEILING OR A TARGET? His own qualifier decides — never us.
  // "up to 10 days", "10 days maximum", "max 10 days", "no more than 10 days", "within 10 days"
  const i = text.toLowerCase().indexOf(quote.toLowerCase());
  const before = text.slice(Math.max(0, i - 24), i).toLowerCase();
  const after = text.slice(i + quote.length, i + quote.length + 14).toLowerCase();
  const isCeiling =
    /\b(up\s*to|upto|max|maximum|at\s*most|no\s*more\s*than|within|under|less\s*than|not\s*more\s*than)\b[^a-z]*$/.test(before)
    || /^[^a-z]*\b(max|maximum|at\s*most|or\s*less|or\s*fewer)\b/.test(after);

  return { maxNights, minNights: null, bound: isCeiling ? 'ceiling' : 'exact', quote };
}

export function intentFromRaw(raw: RawIntent | null | undefined, text: string): TravellerIntent {
  const r: RawIntent = raw ?? {};
  const quotes = r.quotes ?? {};

  // ---- purpose, tier, pace -----------------------------------------------------
  const purpose = read<Purpose>(oneOf(r.purpose, PURPOSES), quotes.purpose, text, 'read from your message');
  const comfortTier = read<ComfortTier>(oneOf(r.comfortTier, TIERS), quotes.comfortTier, text, 'read from your message');
  const pace = read<Pace>(oneOf(r.pace, PACES), quotes.pace, text, 'read from your message', CONF.WEAK);

  // ---- budget stance: usually INFERRED from the tier, and we say so -------------
  // Law 3 hangs off this field, so it may never be a silent assumption.
  let budgetStance: Reading<BudgetStance>;
  const tier = comfortTier.value;
  if (tier === 'luxury') budgetStance = weInferred<BudgetStance>('comfort_first', 'from "luxury"', 0.9);
  else if (tier === 'premium') budgetStance = weInferred<BudgetStance>('comfort_first', 'from "premium"', CONF.STRONG);
  else if (tier === 'budget') budgetStance = weInferred<BudgetStance>('price_first', 'from "budget"', 0.9);
  else if (tier === 'standard') budgetStance = weInferred<BudgetStance>('value', 'from "standard"', CONF.STRONG);
  else budgetStance = weNeedIt<BudgetStance>();

  // ---- mode stances — his refusals, with their scope ----------------------------
  const modeStances: ModeStance[] = [];
  for (const m of r.modes ?? []) {
    const mode = oneOf(m?.mode, MODES.map((x) => x.toLowerCase()) as string[]);
    const canonical = MODES.find((x) => x.toLowerCase() === mode);
    const stance = oneOf(m?.stance, STANCES);
    if (!canonical || !stance) continue;
    const qualifier = oneOf(m?.qualifier, QUALIFIERS) ?? 'any';
    const strength = Math.max(0, Math.min(1, Number.isFinite(Number(m?.strength)) ? Number(m?.strength) : 0.8));
    const q = verifyQuote(quotes[`mode_${canonical.toLowerCase()}`] ?? quotes.modes, text);
    modeStances.push({
      mode: canonical, stance, qualifier, strength,
      reading: q ? heSaid(true as const, q) : weInferred(true as const, 'read from your message'),
    });
  }

  // If he refused every ground mode and named no air stance, he plainly means to fly —
  // but that is OUR reading of his sentence, not his word, and it is labelled as ours.
  const has = (mode: Mode) => modeStances.some((s) => s.mode === mode);
  const refusedOrAvoided = (mode: Mode) => modeStances.some((s) => s.mode === mode && (s.stance === 'refuse' || s.stance === 'avoid'));
  if (!has('AIR') && refusedOrAvoided('RAIL') && refusedOrAvoided('ROAD')) {
    modeStances.push({
      mode: 'AIR', stance: 'prefer', qualifier: 'any', strength: 0.7,
      reading: weInferred(true as const, 'from what you asked us to avoid', 0.75),
    });
  }

  // ---- interests ----------------------------------------------------------------
  const interests: Reading<string>[] = (r.interests ?? [])
    .filter((s): s is string => typeof s === 'string' && !!s.trim())
    .slice(0, 8)
    .map((s) => {
      const q = verifyQuote(quotes[`interest_${norm(s)}`] ?? quotes.interests, text);
      return q ? heSaid(s.trim().toLowerCase(), q) : weInferred(s.trim().toLowerCase(), 'read from your message');
    });

  // ---- party ---------------------------------------------------------------------
  const composition = oneOf(r.composition, COMPOSITIONS);
  const group = soundsLikeAGroup(text);
  let paxValue: number | null = Number.isFinite(Number(r.pax)) ? Math.min(Math.max(Number(r.pax), 1), 12) : null;
  // "I along with my wife" must never become one traveller. If the model says 1 while the
  // sentence plainly speaks of two or more, we discard its number rather than shrink his party.
  if (paxValue === 1 && group) paxValue = null;
  const partyQuote = verifyQuote(quotes.party ?? quotes.pax, text);
  const party: Reading<PartyFacts> = paxValue != null
    ? (partyQuote
        ? heSaid({ pax: paxValue, composition: composition ?? 'friends', profile: profileForComposition(composition) }, partyQuote)
        : weInferred({ pax: paxValue, composition: composition ?? 'friends', profile: profileForComposition(composition) }, 'read from your message'))
    : weNeedIt<PartyFacts>();

  // ---- time in hand: the month and the nights are DIFFERENT FACTS -------------------
  const monthVal = Number.isInteger(r.month) && (r.month as number) >= 1 && (r.month as number) <= 12 ? (r.month as number) : null;
  const nightsFromCities = (r.cities ?? []).reduce((s, c) => s + (Number(c?.nights) || 0), 0) || null;
  const nightsVal = Number.isFinite(Number(r.nights)) && Number(r.nights) > 0 ? Number(r.nights) : nightsFromCities;

  const month: Reading<number> = read<number>(monthVal, quotes.month, text, 'read from your message');
  // US-805 — WHEN THE MODEL DROPPED HIS TRIP LENGTH, READ IT BACK OUT OF HIS OWN SENTENCE.
  // "Up to 10 days maximum" was being thrown away, and the default that replaced it was OURS.
  const statedNights = nightsVal == null ? nightsFromWords(text) : null;

  // The value we plan to is his CEILING — the most he will accept. It is never a target to
  // be filled: nothing downstream pads a trip to reach it. The quote is HIS, so the echo
  // chip shows him "up to 10 days maximum" in his own words, not a number we made up.
  const nights: Reading<number> = nightsVal == null
    ? (statedNights ? heSaid(statedNights.maxNights, statedNights.quote) : weNeedIt<number>())
    : (verifyQuote(quotes.nights, text)
        ? heSaid(nightsVal, verifyQuote(quotes.nights, text) as string)
        : weInferred(nightsVal, 'we split your days across the places you named', CONF.WEAK));

  // ---- origin + destinations -------------------------------------------------------
  // The origin the traveller TYPED is his word. The one we work out from where he is
  // going is ours, and the gateway step below (controller) labels it we_inferred.
  const originQuote = verifyQuote(quotes.start ?? (r.start ?? undefined), text);
  const origin: Reading<string> = r.start
    ? (originQuote ? heSaid(String(r.start).trim(), originQuote) : weInferred(String(r.start).trim(), 'read from your message'))
    : weNeedIt<string>();

  const destinations: Reading<string>[] = (r.cities ?? [])
    .filter((c) => c && typeof c.name === 'string' && c.name.trim())
    .slice(0, 7)
    .map((c) => heSaid(c.name.trim(), c.name.trim()));

  return { purpose, comfortTier, budgetStance, modeStances, interests, pace, party, nights, month, origin, destinations };
}

/** The gateway step's one legal way to fill an origin we had to work out ourselves. */
export function withInferredOrigin(intent: TravellerIntent, city: string, basis: string): TravellerIntent {
  if (intent.origin.provenance === 'he_said') return intent;
  return { ...intent, origin: weInferred(city, basis, 0.6) };
}

/**
 * The one legal way to fold an answer he gave to a counter-question back into intent.
 *
 * Note what it CANNOT do, now that the model is right: answering the month cannot promote the
 * nights. Two facts, two receipts. He said December; he did not say six nights; and no amount
 * of convenient bookkeeping may pretend otherwise.
 */
export function withAnsweredMonth(intent: TravellerIntent, month: number, quote: string): TravellerIntent {
  return { ...intent, month: heSaid(month, quote) };
}

/** Likewise for the nights, when he answers that question. */
export function withAnsweredNights(intent: TravellerIntent, nights: number, quote: string): TravellerIntent {
  return { ...intent, nights: heSaid(nights, quote) };
}

// ==============================================================================
// US-602 — THE PLAN CONTRACT: what his words compile to.
// ==============================================================================

/**
 * THE ONLY BRIDGE INTENT HAS TO THE BODY GATES — and it is a one-way street.
 *
 * Read the field names: every one of them can only make the traveller's day HARDER to
 * fill, never easier. There is no `hardCapHrsRaise`. There is no `deadHoursArrival:
 * false` — the type is the literal `true`, so "switch the dead-hours gate off" is not a
 * value you can hold in your hand. A future engineer who wants a comfort-first party to
 * accept a 03:50 arrival cannot express the wish in this type; he must come and argue
 * with the law instead. That is the point.
 */
export interface Tightening {
  /** may only LOWER the party's hard road-hour cap. */
  hardCapHrs?: number;
  /** may only LOWER the civil arrival ceiling. */
  latestArrivalMin?: number;
  /** may only RAISE the earliest civil start. */
  earliestStartMin?: number;
  /** may only ADD the gate. Literal `true` — `false` is not expressible. */
  deadHoursArrival?: true;
  /** may only ADD ceilings: the ordeal a leg of this mode may not exceed. */
  perModeOrdealCeiling?: Partial<Record<Mode, number>>;
  /** may only ADD a ceiling: the ordeal ANY leg may not exceed. */
  legOrdealCeiling?: number;
}

/** The structural subset of a body Tolerance that a tightening may touch. Declared
 *  HERE, so intent.ts imports nothing whatsoever from physiology.ts (the same doctrine,
 *  and the same reason, as tpp.ts). The real Tolerance satisfies it structurally. */
export interface Clampable {
  hardCapHrs: number;
  latestArrivalMin: number;
  earliestStartMin: number;
}

/**
 * Merge a tightening into a body tolerance. CLAMP-ONLY, in one direction, whatever
 * values arrive at runtime — a caller who passes hardCapHrs: 99 does not get a 99-hour
 * driving day; he gets the party's own cap back, unchanged. Loosening is not refused
 * here; it is arithmetically impossible here.
 */
export function tightened<T extends Clampable>(base: T, t?: Tightening): T {
  if (!t) return base;
  return {
    ...base,
    hardCapHrs: Math.min(base.hardCapHrs, t.hardCapHrs ?? Infinity),
    latestArrivalMin: Math.min(base.latestArrivalMin, t.latestArrivalMin ?? Infinity),
    earliestStartMin: Math.max(base.earliestStartMin, t.earliestStartMin ?? -Infinity),
  };
}

// ==============================================================================
// US-609 — THE COUNTER-QUESTION GATE.
//
// A seasoned consultant does not plan from one sentence. He asks one or two good questions
// first. But he never interrogates, and he never hands you a form — the difference between a
// consultant and a booking engine is that the consultant PROPOSES WHILE HE ASKS.
//
// The policy is value-of-information, kept brutally simple:
//
//      risk = (1 − confidence) × planImpact        ASK iff risk ≥ 0.45. At most TWO.
//
// And four rules that keep it human:
//   1. NEVER ask what he already told us. A `he_said` field is exempt whatever its impact —
//      asking a man to repeat himself is how you prove you were not listening.
//   2. Never more than two. The third-most-risky field becomes an editable chip instead.
//   3. Every question carries OUR PROVISIONAL ANSWER. A consultant proposes while he asks.
//   4. A high-impact `we_need_it` field is always asked, because a plan resting on a fact we
//      simply do not have is not a plan, it is a guess with a map.
// ==============================================================================

/** How much a wrong value here would damage the plan. Fixed table (spec 1.6). */
export const PLAN_IMPACT: Record<string, number> = {
  month: 0.9,
  party: 0.9,
  comfortTier: 0.8,
  budgetStance: 0.8,
  nights: 0.6,
  origin: 0.5,
  pace: 0.4,
  interests: 0.3,
};

export const ASK_THRESHOLD = 0.45;

export interface CounterQuestion {
  key: string;
  /** the question, and our provisional answer, in one line. */
  text: string;
  risk: number;
  /** what we will assume if he does not answer — never hidden from him. */
  provisional?: string;
}

/**
 * The two best questions, or fewer, or none. Pure.
 *
 * On the canonical honeymoon sentence this asks EXACTLY ONE question — the month — because
 * that is the only thing we genuinely do not have and cannot responsibly invent. His purpose,
 * his comfort tier, his refusals, his party: he told us all of it, and we do not ask a man to
 * say it twice.
 */
export function counterQuestions(intent: TravellerIntent): CounterQuestion[] {
  const risk = (r: Reading<unknown>, key: string): number => {
    if (r.provenance === 'he_said') return 0;                 // rule 1 — he told us. Never ask.
    return (1 - (r.confidence ?? 0)) * (PLAN_IMPACT[key] ?? 0.3);
  };

  const candidates: CounterQuestion[] = [
    {
      key: 'month',
      risk: risk(intent.month, 'month'),
      // The provisional is grounded in what our OWN model actually knows: the engine slows
      // hill roads in the monsoon (physiology.terrainSpeedKmh). We do not invent a "best
      // season" for a place we have no season data for — we say the thing we can prove.
      text: 'Which month are you travelling? It changes what we can promise: between June and September the hill roads are slower in the rain, and we plan shorter days.',
      provisional: 'we will plan for a dry-season month',
    },
    {
      key: 'party',
      risk: risk(intent.party, 'party'),
      text: 'How many of you are travelling, and is anyone elderly or a small child? We plan the day around whoever finds the journey hardest.',
      provisional: 'we have assumed two of you',
    },
    {
      key: 'comfortTier',
      risk: risk(intent.comfortTier, 'comfortTier'),
      text: 'What kind of stay do you have in mind — comfortable, or the best available? It decides the hotels and how we travel between them.',
      provisional: 'we have assumed a comfortable, mid-range trip',
    },
    {
      key: 'nights',
      risk: risk(intent.nights, 'nights'),
      text: 'How many nights do you have? Tell us, and we will fit the trip to your days rather than stretching your days to the trip.',
      provisional: 'we have split your nights across the places you named',
    },
  ];

  return candidates
    .filter((q) => q.risk >= ASK_THRESHOLD)
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 2);                                             // rule 2 — never a wall of questions
}

/** One row of the "what we understood" panel — the fact, and who supplied it. */
export interface EchoRow {
  key: string;
  label: string;
  value: string;
  provenance: Provenance;
  quote?: string;
  why?: string;
}

export interface PlanContract {
  // LEVEL 1 — his refusals. The brief, not a weight (Law 1).
  filters: {
    banModes: Mode[];          // unqualified refusals: the mode leaves the pool
    banOvernightRail: boolean; // the overnight, not all rail (the old flag lied — US-604)
  };
  // LEVEL 2 — tightenings. May only clamp down; loosening is not expressible (above).
  tighten: Tightening;
  // LEVEL 3 — objective surgery.
  rewardSwitches: {
    /** false ⇒ the ddcv.ts:120 "overnight saves a hotel night" bonus is REMOVED, not
     *  scaled. It is a MONEY reward wearing a convenience costume, and for a
     *  comfort-first traveller the comfort dial would otherwise AMPLIFY it ×1.3. */
    hotelNightSaving: boolean;
  };
  /** Law 3. 'tiebreak_only' ⇒ money is absent from levels 0–4 and may only split an
   *  ordeal band — inside which comfort is equal by construction. So a saving can never
   *  buy discomfort. Not by a rupee. Not ever. */
  moneyRule: 'normal' | 'tiebreak_only';
  /** what money MEANS to him — the ordeal function needs it, because the same berth is a
   *  bargain to one mind and an ordeal to another. */
  budgetStance: BudgetStance | null;
  // LEVEL 4 — the soft residual, and the human layer.
  tpp: TPP;
  voice: { purpose?: Purpose; partyWords?: string; quotes: Record<string, string> };
  echo: EchoRow[];
}

/** Ordeal ceilings (spec Part 2.6). Shapes principled, numbers tuned — pinned by tests. */
export const CEILING = {
  /** a comfort-first party: no single leg may be an ordeal. */
  COMFORT_FIRST_LEG: 45,
  /** "no LONG road journeys" — about a 4–5 h chauffeured drive. His words, given a number. */
  LONG_REFUSED: 30,
  /** "I'd rather not, at all" (avoid + no qualifier): discouraged, not banned. */
  AVOIDED_ANY: 35,
} as const;

const isComfortFirst = (i: TravellerIntent): boolean =>
  i.budgetStance.value === 'comfort_first' || i.budgetStance.value === 'money_no_object'
  || i.comfortTier.value === 'luxury' || i.comfortTier.value === 'premium';

/**
 * US-602 — his words → the contract the engine is bound by. PURE.
 *
 * The compilation of a refusal is the heart of Law 2, and it turns on the QUALIFIER:
 *
 *   "no trains"              refuse + any    → a FILTER. The mode leaves the pool.
 *   "no long road journeys"  avoid  + long   → a CEILING. The eight-hour drive is
 *                                              banned; the three-hour drive through
 *                                              Mysuru is blessed — because what he
 *                                              refused was the ordeal, not the road.
 */
export function compileContract(intent: TravellerIntent): PlanContract {
  const comfortFirst = isComfortFirst(intent);
  const banModes: Mode[] = [];
  let banOvernightRail = false;
  const perModeOrdealCeiling: Partial<Record<Mode, number>> = {};
  const quotes: Record<string, string> = {};
  let deadHours: true | undefined;

  for (const s of intent.modeStances) {
    if (s.reading.quote) quotes[`mode_${s.mode.toLowerCase()}`] = s.reading.quote;

    if (s.stance === 'refuse' && s.qualifier === 'any') {
      // A category refusal. The mode leaves the pool wherever an alternative exists; where
      // NONE exists the engine does not sneak it back in — it escalates to the consultant
      // fallback and says so out loud (Law 4, procedure step 6 / US-607).
      if (!banModes.includes(s.mode)) banModes.push(s.mode);
      if (s.mode === 'RAIL') banOvernightRail = true;
      continue;
    }
    if (s.stance === 'refuse' || s.stance === 'avoid') {
      switch (s.qualifier) {
        case 'overnight':
          banOvernightRail = true;
          break;
        case 'night_arrival':
          deadHours = true;
          break;
        case 'long': {
          const c = CEILING.LONG_REFUSED;
          perModeOrdealCeiling[s.mode] = Math.min(perModeOrdealCeiling[s.mode] ?? Infinity, c);
          break;
        }
        default: {
          // "I would rather not fly/take a train at all", but he did not forbid it.
          const c = CEILING.AVOIDED_ANY;
          perModeOrdealCeiling[s.mode] = Math.min(perModeOrdealCeiling[s.mode] ?? Infinity, c);
        }
      }
    }
  }

  // ---- the comfort-first surgery (Laws 2 and 3) ---------------------------------
  const tighten: Tightening = { ...(Object.keys(perModeOrdealCeiling).length ? { perModeOrdealCeiling } : {}) };
  if (comfortFirst) {
    // No arrival in the dead hours. This is the gate that should have refused the
    // Netravathi at 03:50 and did not exist (F3). It is now a gate, not a price.
    tighten.deadHoursArrival = true;
    tighten.legOrdealCeiling = CEILING.COMFORT_FIRST_LEG;
  }
  if (deadHours) tighten.deadHoursArrival = true;

  // ---- the soft residual: TPP, finally wired (spec 1.4) ---------------------------
  const tpp: TPP = {};
  const tier = intent.comfortTier.value;
  const stance = intent.budgetStance.value;
  if (tier === 'luxury' || stance === 'comfort_first' || stance === 'money_no_object') { tpp.P5 = 0.9; tpp.P1 = -0.3; }
  else if (tier === 'premium') tpp.P5 = 0.5;
  else if (stance === 'price_first' || tier === 'budget') tpp.P5 = -0.8;

  switch (intent.purpose.value) {
    case 'honeymoon': tpp.P4 = -0.5; tpp.P2 = -0.3; break;
    case 'pilgrimage': tpp.P3 = 0.3; tpp.P4 = 0.2; break;
    case 'adventure': tpp.P2 = 0.6; break;
    default: break;
  }
  if (intent.pace.value === 'savour') tpp.P1 = -0.6;
  else if (intent.pace.value === 'packed') tpp.P1 = 0.6;

  // ---- the human layer -------------------------------------------------------------
  for (const [k, r] of Object.entries({ purpose: intent.purpose, comfortTier: intent.comfortTier, party: intent.party })) {
    if (r.provenance === 'he_said' && r.quote) quotes[k] = r.quote;
  }

  return {
    filters: { banModes, banOvernightRail },
    tighten,
    // Law 3, structurally: for a comfort-first party the hotel-night reward is DELETED.
    // Down-weighting it is not enough — the comfort dial multiplies q by 1.3, so the
    // luxury setting would have made the engine love the overnight train MORE (F4).
    rewardSwitches: { hotelNightSaving: !comfortFirst },
    moneyRule: comfortFirst ? 'tiebreak_only' : 'normal',
    budgetStance: intent.budgetStance.value ?? (comfortFirst ? 'comfort_first' : null),
    tpp,
    voice: {
      purpose: intent.purpose.value ?? undefined,
      partyWords: partyWords(intent),
      quotes,
    },
    echo: buildEcho(intent),
  };
}

/** How we will address him. "You and your wife", not "the pax". */
export function partyWords(intent: TravellerIntent): string | undefined {
  const p = intent.party.value;
  if (!p) return undefined;
  switch (p.composition) {
    case 'couple': return p.pax === 2 ? 'you and your wife' : 'the two of you';
    case 'family_kids': return 'your family';
    case 'seniors': return 'your parents';
    case 'friends': return 'you and your friends';
    case 'solo': return 'you';
    default: return undefined;
  }
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function row<T>(key: string, label: string, r: Reading<T>, fmt: (v: T) => string): EchoRow | null {
  if (r.value == null) return { key, label, value: '—', provenance: 'we_need_it' };
  return {
    key, label, value: fmt(r.value), provenance: r.provenance,
    ...(r.quote ? { quote: r.quote } : {}),
    ...(r.basis ? { why: r.basis } : {}),
  };
}


/**
 * The echo panel: every fact the plan rests on, and who supplied it. The chip text is
 * DERIVED from the provenance enum, never hand-set — so a value we inferred cannot be
 * rendered under a "you said" chip. Not "should not". Cannot.
 */
export function buildEcho(intent: TravellerIntent): EchoRow[] {
  const rows: (EchoRow | null)[] = [
    row('purpose', 'Trip', intent.purpose, (v) => v.replace(/_/g, ' ')),
    row('comfortTier', 'Comfort', intent.comfortTier, (v) => v),
    row('party', 'Travellers', intent.party, (v) => `${v.pax}`),
    row('origin', 'Starting from', intent.origin, (v) => v),
    row('month', 'Month', intent.month, (m) => MONTH_NAMES[m - 1]),
    row('nights', 'Nights', intent.nights, (n) => String(n)),
  ];
  for (const s of intent.modeStances) {
    if (s.stance !== 'refuse' && s.stance !== 'avoid') continue;
    const word = s.mode === 'RAIL' ? 'trains' : s.mode === 'ROAD' ? 'road journeys' : s.mode === 'AIR' ? 'flights' : 'ferries';
    rows.push({
      key: `mode_${s.mode.toLowerCase()}`,
      label: 'You asked us to avoid',
      value: s.qualifier === 'long' ? `long ${word}` : s.qualifier === 'overnight' ? `overnight ${word}` : word,
      provenance: s.reading.provenance,
      ...(s.reading.quote ? { quote: s.reading.quote } : {}),
      ...(s.reading.basis ? { why: s.reading.basis } : {}),
    });
  }
  if (intent.interests.length) {
    const first = intent.interests[0];
    rows.push({
      key: 'interests', label: 'You love', value: intent.interests.map((i) => i.value).join(', '),
      provenance: first.provenance,
      ...(first.quote ? { quote: first.quote } : {}),
    });
  }
  // A month/nights row with no value is a "we need it" row, and it must not appear twice.
  return rows.filter((r): r is EchoRow => !!r && !(r.key === 'nights' && r.value === '—'));
}
