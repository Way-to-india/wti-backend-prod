/**
 * US-806 — THE FOOD GATE. Sprint 8 / THE DESIGNER.
 *
 * "We are vegetarians and do not consume even eggs."
 *
 * THAT IS A CONSTRAINT, NOT A PREFERENCE. It is not a note for the file, to be honoured if
 * convenient. For this couple it can outrank a hotel star, and it decides the lunch halt on
 * a five-hour drive through Assam. So it sits with the GATES, not with the content.
 *
 * ==============================================================================
 * THE FINDING THAT DECIDES THIS FILE (production, 2026-07-13)
 *
 *   220 of our travel guides carry food text.
 *    92 of them mention "vegetarian".
 *     9 of them mention pure-veg, shudh or Jain.
 *   AND FOR GUWAHATI, SHILLONG AND KAZIRANGA — THE THREE TOWNS WE ARE ABOUT TO PROPOSE
 *   TO HIM — OUR GUIDES SAY NOTHING ABOUT FOOD AT ALL.
 *
 * So we do not know whether he can eat in the towns we are sending him to. Not "probably".
 * Not "it should be fine". WE DO NOT KNOW.
 *
 * ==============================================================================
 * WHAT A SYSTEM WITH NO DATA IS ALLOWED TO SAY
 *
 * THERE ARE EXACTLY THREE HONEST ANSWERS, and reassurance is not among them:
 *
 *   1. "Yes — here is the kitchen, and here is who checked it."          (verified)
 *   2. "No — and I will not send you somewhere you cannot eat."          (verified absent)
 *   3. "I DO NOT KNOW YET, AND I WILL NOT PRETEND I DO."                 (unknown)
 *
 * Today, for the North East, the answer is (3) — and a man who does not eat eggs would
 * rather hear that from us now than discover it at a table in Kohima. An empty table is not
 * a bug in this module. IT IS THE MODULE WORKING: it is what "empty until filled, never
 * guessed" looks like from the inside.
 *
 * A GUESS HERE IS NOT A SMALL LIE. It is a man of 56 and his wife sitting in front of a
 * plate they cannot touch, in a town they cannot leave, on a holiday we sold them.
 *
 * ==============================================================================
 * AND IT IS BUILT TO BITE THE DAY IT IS FILLED.
 *
 * The gate is real code with a real ranking. It returns `unknown` today because the table is
 * empty today. The moment a human signs off a pure-vegetarian kitchen in Shillong, this gate
 * starts preferring Shillong — with no change to a line of it.
 *
 * PURE. No DB, no network, no clock. foodDb.ts reads; the controller injects.
 */

// ---- what HE needs -------------------------------------------------------------

/**
 * Strictest first. Each level CONTAINS the ones below it: a Jain kitchen satisfies a
 * pure-vegetarian traveller; a pure-vegetarian kitchen satisfies a vegetarian one. The
 * reverse is NEVER true, and that asymmetry is the whole gate.
 */
export type FoodNeed = 'none' | 'vegetarian' | 'pure_veg_no_egg' | 'jain';

export const NEED_RANK: Record<FoodNeed, number> = {
  none: 0, vegetarian: 1, pure_veg_no_egg: 2, jain: 3,
};

/**
 * WHAT HE ACTUALLY SAID, read out of his own sentence.
 *
 * "We are vegetarians and do not consume even eggs" is NOT the same claim as "we are
 * vegetarian". The word EVEN is doing real work: he is pre-empting the answer he has been
 * given before, by people who thought an omelette was vegetarian. He has met us before, and
 * he is telling us not to do it again.
 *
 * So eggs are read explicitly, and they RAISE the bar. We never lower it.
 */
export function foodNeedFromWords(text: string | null | undefined): { need: FoodNeed; quote: string } | null {
  if (!text) return null;

  const jain = text.match(/\bjain\b[^.]{0,30}(food|meal|kitchen|thali)?|\bjain\b/i);
  if (jain) return { need: 'jain', quote: jain[0].trim() };

  // "no eggs", "not even eggs", "eggless", "without egg" — but NOT "we eat eggs".
  const noEgg = text.match(/\b(?:no|not|don'?t|do not|never|without|avoid)\b[^.]{0,40}\begg/i)
    || text.match(/\begg\s*less\b/i);

  const veg = text.match(/\b(?:pure\s*veg\w*|shudh\s*veg\w*|vegetarians?|veggie)\b/i);

  if (veg && (noEgg || /pure\s*veg|shudh/i.test(veg[0]))) {
    // His strictest sentence is the one we quote back — the egg clause, if he wrote one.
    return { need: 'pure_veg_no_egg', quote: (noEgg ? noEgg[0] : veg[0]).trim() };
  }
  if (veg) return { need: 'vegetarian', quote: veg[0].trim() };
  return null;
}

// ---- what WE know --------------------------------------------------------------

/**
 * What we can stand behind about eating in ONE town. EVERY FIELD CARRIES ITS RECEIPT.
 *
 * `pureVegKitchen: null` MEANS WE HAVE NOT CHECKED. It does not mean "no", and it does not
 * mean "probably yes". A three-state boolean is the only honest shape here, and collapsing
 * it to two is exactly how a couple ends up in front of a plate they cannot eat.
 */
export interface FoodFact {
  stayNodeId: string;
  /** true = we have found one. false = we looked and there is none. null = WE HAVE NOT LOOKED. */
  pureVegKitchen: boolean | null;
  jainKitchen: boolean | null;
  /** Named places we can actually stand behind. Never a place we cannot vouch for. */
  places: { name: string; note: string | null }[];
  source: 'own_guide' | 'own_executive' | 'osm' | 'web';
  sourceUrl: string | null;
  /** NOTHING UNVERIFIED IS EVER SHOWN TO A TRAVELLER (spec 3.2). Null = it waits for a human. */
  verifiedAt: string | null;
}

export type FoodStatus =
  /** He needs nothing, or we have verified we can feed him. */
  | 'ok'
  /** WE HAVE NOT CHECKED. The honest answer today, and it must be SPOKEN, not swallowed. */
  | 'unknown'
  /** We checked, and he cannot eat here. This town does not go in his plan. */
  | 'cannot_feed_him';

/** Nothing unverified reaches him. An unverified row may sit in the table and wait. */
const usable = (f: FoodFact | null | undefined): FoodFact | null =>
  f && f.verifiedAt ? f : null;

/**
 * CAN HE EAT IN THIS TOWN?
 *
 * The asymmetry is the point: a JAIN kitchen feeds a pure-vegetarian traveller, and a
 * pure-vegetarian kitchen feeds a vegetarian one. Never the other way. So we compare what we
 * can OFFER against what he NEEDS, and we only ever say yes when the offer meets or exceeds
 * the need.
 */
export function foodStatus(fact: FoodFact | null | undefined, need: FoodNeed): FoodStatus {
  if (need === 'none') return 'ok';

  const f = usable(fact);
  if (!f) return 'unknown';                       // WE HAVE NOT CHECKED. We say so.

  const offer: FoodNeed =
    f.jainKitchen === true ? 'jain'
    : f.pureVegKitchen === true ? 'pure_veg_no_egg'
    : 'none';

  if (NEED_RANK[offer] >= NEED_RANK[need]) return 'ok';

  // We LOOKED and found nothing that meets his need. That is a real, verified NO.
  const looked = f.pureVegKitchen === false || f.jainKitchen === false;
  return looked ? 'cannot_feed_him' : 'unknown';
}

// ---- what we SAY ---------------------------------------------------------------

const needWords: Record<FoodNeed, string> = {
  none: 'your food',
  vegetarian: 'vegetarian food',
  pure_veg_no_egg: 'pure vegetarian food, with no eggs',
  jain: 'Jain food',
};

/**
 * THE SENTENCE FOR ONE TOWN. Second person, easy English, and it never reassures him about
 * something we have not checked.
 */
export function foodVoiceFor(town: string, fact: FoodFact | null | undefined, need: FoodNeed): string | null {
  if (need === 'none') return null;
  const status = foodStatus(fact, need);
  const f = usable(fact);

  if (status === 'ok' && f) {
    const named = f.places.slice(0, 2).map((p) => p.name).join(' and ');
    return named
      ? `In ${town} you can eat at ${named}. We have checked the kitchen ourselves.`
      : `In ${town} we have checked that you can get ${needWords[need]}.`;
  }
  if (status === 'cannot_feed_him') {
    return `We looked in ${town} and we could not find a kitchen we would put you in front of. `
      + 'So I have left it out. I would rather lose the town than sit you down to a plate you cannot eat.';
  }
  // THE HONEST ONE. Today, this is what the North East returns.
  return `In ${town} I have not yet checked for ${needWords[need]}, and I will not tell you I have.`;
}

/**
 * THE FOOD PARAGRAPH FOR THE WHOLE TRIP — the one he will actually read.
 *
 * THE-CONSULTANTS-LAW, Law 4: the finding, the reason, and a concrete way forward. NEVER a
 * silent shrug, and NEVER a reassurance we have not earned.
 */
export function foodParagraph(
  need: FoodNeed,
  quote: string | null,
  towns: { name: string; status: FoodStatus }[],
): string | null {
  if (need === 'none' || !towns.length) return null;

  const unknown = towns.filter((t) => t.status === 'unknown').map((t) => t.name);
  const ok = towns.filter((t) => t.status === 'ok').map((t) => t.name);

  const opening = quote
    ? `On the food: you said "${quote}", and I have kept it as a rule, not a preference.`
    : `On the food: I have kept ${needWords[need]} as a rule, not a preference.`;

  if (!unknown.length) {
    return `${opening} I have checked every town on this trip, and you can eat in all of them.`;
  }

  const listed = unknown.length === 1
    ? unknown[0]
    : `${unknown.slice(0, -1).join(', ')} and ${unknown[unknown.length - 1]}`;

  const checked = ok.length
    ? ` I have checked ${ok.length === 1 ? ok[0] : ok.join(' and ')}, and you can eat there.`
    : '';

  // THE FINDING, THE REASON, THE WAY FORWARD. In his words, and without a comfortable lie.
  return `${opening}${checked} I will be straight with you: I have NOT yet checked `
    + `${listed} for ${needWords[need]}, and I am not going to tell you it will be fine when I `
    + 'do not know that it will. Before you pay us anything, I will have our people confirm a '
    + 'kitchen in each of those towns and come back to you with the names. If we cannot find '
    + 'one, I will tell you that too, and we will change the trip.';
}

/**
 * DOES FOOD CHANGE THE CHOICE OF TOWN? — and the honest answer today is: ONLY WHERE WE KNOW.
 *
 * A town we have VERIFIED we cannot feed him in is removed. A town we have NOT CHECKED is
 * NOT removed — because an empty row is a fact about OUR SURVEY, not about the town, and
 * dropping Shillong because we have not been to a restaurant there would be lying with a
 * null. (Same discipline as spine.attractionDensity: a zero tells you about the survey.)
 *
 * A town we have verified we CAN feed him in gets a nudge — a TIE-BREAK, never an override.
 * Our designers' thirty years outrank our restaurant list, and they always will.
 */
export function foodRank(fact: FoodFact | null | undefined, need: FoodNeed): -1 | 0 | 1 {
  const s = foodStatus(fact, need);
  if (s === 'cannot_feed_him') return -1;   // he cannot eat here. Out.
  if (s === 'ok' && need !== 'none') return 1;
  return 0;                                  // unknown: we neither reward nor punish a silence.
}
