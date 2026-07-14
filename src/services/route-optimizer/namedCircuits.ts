/**
 * US-853 — A FAMOUS CIRCUIT NAMED IS A DESTINATION ANSWERED.
 *
 * THE FAILURE THIS ENDS. A test traveller wrote "I want to do a Nau Devi yatra" and was
 * asked to name a city. She HAD named her destination — in the vocabulary every pilgrim
 * uses: the name of a famous, well-known circuit. And the answer was sitting in our own
 * catalogue the whole time: `nau-devi-yatra` is a tour we sell, 6 nights, with real base
 * towns and real night counts.
 *
 * THE FOUNDER'S RULE (2026-07-14): common names of well-known routes must reveal the
 * intent — and CLOSE variants must too. "Nav devi tour", "van durga yatra", "9 devi
 * temples", "9 durga temples" are all the same ask. So the matching is DETERMINISTIC
 * regex families (testable, no model in the loop), generous on spelling, strict on
 * meaning.
 *
 * THE RECEIPT RULE: a circuit lives in this registry ONLY if our own catalogue sells it —
 * `tourId` is the receipt, and the towns and nights are read from THAT tour at runtime
 * (namedCircuitsDb.ts), never hardcoded here. A famous route we do not sell is a theme
 * traveller, not a named circuit.
 *
 * PURE. No DB, no network, no clock. Same doctrine as regions.ts.
 */

export interface NamedCircuit {
  key: string;
  /** what we call it back to him. */
  label: string;
  /** OUR OWN TOUR — the receipt, and the source of towns + nights at runtime. */
  tourId: string;
  /** THE NAME, PROPERLY SPELT — its common exact forms. A hit here is confident. */
  exact: RegExp[];
  /** SPELLING AND WORD VARIATIONS ("van durga", "nav devi tour"). A hit here is a
   *  READING, and the founder's rule applies: the system may propose the route, but it
   *  must SAY what it read and let him correct it BEFORE anything is built on it. */
  variants: RegExp[];
  /** the one-line truth about how the circuit is actually travelled. */
  note: string;
}

export const NAMED_CIRCUITS: NamedCircuit[] = [
  {
    key: 'nau_devi',
    label: 'the Nau Devi Yatra — the nine Devi temples',
    tourId: 'nau-devi-yatra',
    exact: [
      /\bnau[\s-]*devi\b/i,
      /\b(9|nine)\s*(devi|durga)\s*(temples?|mandirs?|yatra|darshan)?\b/i,
      /\b(9|nine)\s+temples?\s+of\s+(devi|durga|maa|mata)\b/i,
    ],
    variants: [
      // nav/nao spellings, the "van durga" mistyping, joined words, navdurga forms.
      /\b(nav|nao|van)[\s-]*(devi|durga)s?\b/i,
      /\b(navdevi|naudevi|navdurga|navadurga|naodevi)\b/i,
      /\bnau[\s-]*durga\b/i,
    ],
    note: 'the nine Devi temples are visited as darshan day-trips from comfortable base towns — you do not sleep at the shrines',
  },
  {
    key: 'char_dham',
    label: 'the Char Dham Yatra',
    tourId: 'chardham-yatra-tour-package',
    exact: [
      /\bchar[\s-]*dham\b/i,
      /\bchardham\b/i,
    ],
    variants: [
      /\b(4|four)[\s-]*dham\b/i,
      /\bchota[\s-]*char[\s-]*dham\b/i,
      /\b(char|chaar)[\s-]*dhaam\b/i,
    ],
    note: 'Yamunotri, Gangotri, Kedarnath and Badrinath — the temples close for the winter, from around Diwali to Akshaya Tritiya',
  },
  {
    key: 'jyotirlinga_12',
    label: 'the 12 Jyotirlinga Yatra',
    tourId: '12-jyotirlinga-tour-package',
    exact: [
      /\b(12|twelve)[\s-]*jyotirling/i,
    ],
    variants: [
      /\b(barah|baarah)[\s-]*jyotirling/i,
      /\bjyotirling(a|am)?s?\s+(yatra|tour|darshan|circuit)\b/i,
      /\ball\s+(the\s+)?jyotirling/i,
      /\bjyotirlim?g/i,
    ],
    note: 'the twelve Jyotirlingas span the whole country — this is a long journey, flown between regions',
  },
  {
    key: 'vaishno_devi',
    label: 'the Vaishno Devi Yatra',
    tourId: 'vaishno-devi-yatra-with-helicopter',
    exact: [
      /\bvaishno[\s-]*devi\b/i,
    ],
    variants: [
      /\bvaishno+[\s-]*devi\b/i,
      /\bvaishnavi[\s-]*devi\b/i,
      /\bmata[\s-]*vaishno\b/i,
      /\bvaishnodevi\b/i,
    ],
    note: 'the shrine is reached by about a 13 km walk from Katra, or by pony, palki or the helicopter service',
  },
];

export interface NamedCircuitMatch {
  circuit: NamedCircuit;
  /** HIS words, the exact span that matched — the receipt for "you asked for". */
  quote: string;
  /** 'exact' = he named it properly, we may proceed. 'variant' = OUR READING of his
   *  spelling — the route may be shown, but the reading must be SAID OUT LOUD and he
   *  must be able to correct it. Never silent (founder rule, 2026-07-14). */
  confidence: 'exact' | 'variant';
}

/**
 * Find the famous circuit he named, if he named one. Exact spellings are checked across
 * the WHOLE registry before any variant is tried — a proper name always beats a fuzzy
 * reading of a different one. Within a tier, registry order decides (a man who writes
 * both "nau devi" and "vaishno devi" is doing the Nau Devi — Vaishno Devi is one of the
 * nine). Returns AT MOST one. PURE.
 */
export function resolveNamedCircuit(text: string | null | undefined): NamedCircuitMatch | null {
  if (!text || typeof text !== 'string') return null;
  for (const circuit of NAMED_CIRCUITS) {
    for (const re of circuit.exact) {
      const m = re.exec(text);
      if (m) return { circuit, quote: m[0].trim(), confidence: 'exact' };
    }
  }
  for (const circuit of NAMED_CIRCUITS) {
    for (const re of circuit.variants) {
      const m = re.exec(text);
      if (m) return { circuit, quote: m[0].trim(), confidence: 'variant' };
    }
  }
  return null;
}
