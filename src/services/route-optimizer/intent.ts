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
  timeInHand: Reading<{ nights?: number; month?: number }>;
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

  // ---- time in hand ---------------------------------------------------------------
  const month = Number.isInteger(r.month) && (r.month as number) >= 1 && (r.month as number) <= 12 ? (r.month as number) : undefined;
  const nightsFromCities = (r.cities ?? []).reduce((s, c) => s + (Number(c?.nights) || 0), 0) || undefined;
  const nights = Number.isFinite(Number(r.nights)) && Number(r.nights) > 0 ? Number(r.nights) : nightsFromCities;
  const monthQuote = verifyQuote(quotes.month, text);
  const nightsQuote = verifyQuote(quotes.nights, text);
  let timeInHand: Reading<{ nights?: number; month?: number }>;
  if (month == null && nights == null) {
    timeInHand = weNeedIt();
  } else if (monthQuote || nightsQuote) {
    timeInHand = heSaid({ nights, month }, (monthQuote || nightsQuote) as string);
  } else {
    timeInHand = weInferred({ nights, month }, 'we split your days across the places you named', CONF.WEAK);
  }

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

  return { purpose, comfortTier, budgetStance, modeStances, interests, pace, party, timeInHand, origin, destinations };
}

/** The gateway step's one legal way to fill an origin we had to work out ourselves. */
export function withInferredOrigin(intent: TravellerIntent, city: string, basis: string): TravellerIntent {
  if (intent.origin.provenance === 'he_said') return intent;
  return { ...intent, origin: weInferred(city, basis, 0.6) };
}

/** The one legal way to fold an answer he gave to a counter-question back into intent. */
export function withAnsweredMonth(intent: TravellerIntent, month: number, quote: string): TravellerIntent {
  const t = intent.timeInHand.value ?? {};
  return { ...intent, timeInHand: heSaid({ ...t, month }, quote) };
}
