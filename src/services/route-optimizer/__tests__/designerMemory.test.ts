/**
 * Sprint 8 / US-804 acceptance — THE DESIGNERS' MEMORY.
 *
 * The fixture below is REAL DATA, read off production 2026-07-12. Not invented numbers:
 * Agra-Delhi 37, Delhi-Jaipur 29, Agra-Jaipur 26, Guwahati-Shillong 2. If someone edits
 * the derivation and these move, this test is the thing that notices.
 *
 * FOUR THINGS ARE PROVED, and the third is the one that matters most:
 *
 *  1. THE GOLDEN TRIANGLE IS RECOVERED, NOT INVENTED. Our own designers built it, and
 *     the memory can read it back.
 *
 *  2. THE CATALOGUE HAD ALREADY ANSWERED THE NORTH-EAST TRAVELLER. Guwahati-Shillong,
 *     Guwahati-Kaziranga, Gangtok-Darjeeling. I once reported "zero North-East tours" —
 *     from a search of tour TITLES. That was wrong, and this test is the correction.
 *
 *  3. THE TIER IS DECLARED, AND AN UNRECONCILED NIGHT COUNT IS NEVER STATED AS FACT.
 *     Every one of the 1,002 rows in tour_stays is `ai_backfill` — NOT ONE was written
 *     by a designer. The night counts are a MODEL'S PARSE of our designers' itineraries.
 *     Verified (98.9% against the human day count), but a parse. The seven towns whose
 *     parse disagreed return NULL rather than a confident number.
 *
 *  4. THINNESS IS SPOKEN, NOT HIDDEN. Delhi-Jaipur 29 and Guwahati-Shillong 2 are both
 *     real, and they are NOT the same promise.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/designerMemory.test.ts
 */

import {
  coDesignedWith, coDesignStrength, pairConfidence, pairVoice,
  nightsWeCanStandBehind, nightsRaw, setCohesion, TIER_RANK, TIER_VOICE, EMPTY_MEMORY,
  type DesignerMemory,
} from '../designerMemory';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`)); };

console.log('\nSprint 8 / US-804 — the designers\' memory: thirty years, recovered\n');

// ---- THE FIXTURE. Real rows, read off production 2026-07-12. -------------------------

const P = (city: string, pairsWith: string, designedTogether: number) =>
  ({ city, pairsWith, designedTogether, tier: 'designer_catalogue' as const });

const N = (city: string, nights: number, timesDesigned: number, reconciled: boolean, agreementRate: number) =>
  ({ city, nights, timesDesigned, tier: 'catalogue_ai_parsed' as const, reconciled, agreementRate });

const MEM: DesignerMemory = {
  pairs: [
    // The Golden Triangle, as our designers actually built it.
    P('Agra', 'Delhi', 37),   P('Delhi', 'Agra', 37),
    P('Jaipur', 'Delhi', 29), P('Delhi', 'Jaipur', 29),
    P('Jaipur', 'Agra', 26),  P('Agra', 'Jaipur', 26),
    P('Jaipur', 'Fatehpur Sikri', 9), P('Jaipur', 'Pushkar', 8),
    // The North East. Quiet — but not silent. This is the correction I owe the record.
    P('Guwahati', 'Shillong', 2),  P('Shillong', 'Guwahati', 2),
    P('Guwahati', 'Kaziranga', 2), P('Kaziranga', 'Guwahati', 2),
    P('Gangtok', 'Darjeeling', 2), P('Gangtok', 'Bagdogra', 2),
  ],
  nights: [
    // Reconciled — the model's parse agreed with our designers' own written itineraries.
    N('Delhi', 1.5, 82, true, 0.988),
    N('Jaipur', 1.9, 60, true, 0.983),
    N('Agra', 1.2, 46, true, 0.978),
    N('Munnar', 2.3, 26, true, 1.0),
    N('Leh', 3.0, 22, true, 1.0),
    // NOT reconciled — the parse disagreed. These may never be stated as fact.
    N('Kedarnath', 1.7, 3, false, 0.667),
    N('Orchha', 1.0, 2, false, 0.5),
    N('Murud', 1.0, 1, false, 0.0),
  ],
};

// ---- 1. THE GOLDEN TRIANGLE, RECOVERED --------------------------------------------

const jaipur = coDesignedWith(MEM, 'Jaipur');
check('Jaipur\'s strongest pairing is Delhi (29) — our designers said so, not a model',
  jaipur[0]?.pairsWith === 'Delhi' && jaipur[0]?.designedTogether === 29, JSON.stringify(jaipur[0]));
check('...then Agra (26), then Fatehpur Sikri (9), then Pushkar (8) — that IS the Golden Triangle',
  jaipur.map((p) => p.pairsWith).slice(0, 4).join(',') === 'Delhi,Agra,Fatehpur Sikri,Pushkar',
  jaipur.map((p) => p.pairsWith).join(','));
check('every pairing is stamped designer_catalogue — our designers\' own hand',
  jaipur.every((p) => p.tier === 'designer_catalogue'));
check('co-design strength reads back both ways (Delhi->Agra and Agra->Delhi are the same 37)',
  coDesignStrength(MEM, 'Delhi', 'Agra') === 37 && coDesignStrength(MEM, 'Agra', 'Delhi') === 37);
check('a pairing we never built is 0, not a guess', coDesignStrength(MEM, 'Delhi', 'Kaziranga') === 0);
check('lookup is case-insensitive — he will not type our capitalisation',
  coDesignStrength(MEM, 'delhi', 'JAIPUR') === 29);

// ---- 2. THE CATALOGUE HAD ALREADY ANSWERED THE NORTH-EAST TRAVELLER ----------------
//
// I once reported "zero North-East tours" from a search of tour TITLES. Wrong. The
// answer was in the DATA all along, and it is exactly what a seasoned consultant gives.

check('Guwahati is co-designed with Shillong', coDesignStrength(MEM, 'Guwahati', 'Shillong') === 2);
check('Guwahati is co-designed with Kaziranga', coDesignStrength(MEM, 'Guwahati', 'Kaziranga') === 2);
check('Gangtok is co-designed with Darjeeling', coDesignStrength(MEM, 'Gangtok', 'Darjeeling') === 2);
check('so the North-East traveller CAN be served from our own catalogue — it was never empty',
  coDesignedWith(MEM, 'Guwahati').length >= 2);

// ---- 3. THE TIER IS DECLARED — AND AN UNRECONCILED PARSE IS NEVER STATED AS FACT ----
//
// This is the heart of the story. tour_stays is 100% ai_backfill. Not one designer row.

check('Leh: 3 nights, and the parse reconciled with our designers\' written itineraries',
  nightsWeCanStandBehind(MEM, 'Leh')?.nights === 3.0);
check('...and it is stamped catalogue_ai_parsed — a MODEL read it, not a designer',
  nightsWeCanStandBehind(MEM, 'Leh')?.tier === 'catalogue_ai_parsed');
check('Delhi: 1.5 nights across 82 tours, reconciled 98.8%',
  nightsWeCanStandBehind(MEM, 'Delhi')?.nights === 1.5 && nightsWeCanStandBehind(MEM, 'Delhi')?.timesDesigned === 82);

check('Kedarnath\'s parse DISAGREED with the human itinerary — so we return NULL, not a number',
  nightsWeCanStandBehind(MEM, 'Kedarnath') === null);
check('Orchha likewise — an unreconciled count is not a lie we are willing to tell',
  nightsWeCanStandBehind(MEM, 'Orchha') === null);
check('Murud likewise (0 of 1 tours agreed)', nightsWeCanStandBehind(MEM, 'Murud') === null);
check('a town we have never designed returns NULL, not a confident guess',
  nightsWeCanStandBehind(MEM, 'Cherrapunji') === null);

check('...but the unreconciled row still EXISTS for the admin panel — it is withheld, not deleted',
  nightsRaw(MEM, 'Kedarnath')?.nights === 1.7 && nightsRaw(MEM, 'Kedarnath')?.reconciled === false);
check('and it carries the agreement rate, so a human can judge it', nightsRaw(MEM, 'Kedarnath')?.agreementRate === 0.667);

check('the tier ranking puts our designers ABOVE a model, always',
  TIER_RANK.designer_catalogue < TIER_RANK.catalogue_ai_parsed &&
  TIER_RANK.catalogue_ai_parsed < TIER_RANK.transport_poi &&
  TIER_RANK.transport_poi < TIER_RANK.ai_proposed);
check('every tier has a sentence we could read aloud to him',
  Object.values(TIER_VOICE).every((v) => v.length > 10 && !/tier|score|weight/i.test(v)));

// ---- 4. THINNESS IS SPOKEN, NOT HIDDEN ---------------------------------------------
//
// "Our designers have built this, though only a handful of times" is a DIFFERENT PROMISE
// from "we have sold this eighty times". The engine must be able to say which.

check('Delhi-Jaipur (29) is well trodden', pairConfidence(29) === 'well_trodden');
check('Guwahati-Shillong (2) is built before — real, but quiet', pairConfidence(2) === 'built_before');
check('a pairing we have never built says so', pairConfidence(0) === 'never_built');

const thin = pairVoice('Guwahati', 'Shillong', 2);
check('the thin pairing SAYS it is thin, in his own register',
  /handful of times/i.test(thin) && !/tier|score|2/.test(thin), thin);
const thick = pairVoice('Delhi', 'Jaipur', 29);
check('the well-trodden pairing makes the stronger claim, and earns it',
  /many times/i.test(thick), thick);
check('the never-built pairing does not pretend — it says how it was chosen instead',
  /not built/i.test(pairVoice('Delhi', 'Cherrapunji', 0)));

// ---- 5. SET COHESION — a set our designers SOLD beats a set that looks good on a map -

const goldenTriangle = setCohesion(MEM, ['Delhi', 'Agra', 'Jaipur']);
const northEast = setCohesion(MEM, ['Guwahati', 'Shillong', 'Kaziranga']);
check('the Golden Triangle scores high on cohesion — our designers sold it hundreds of times',
  goldenTriangle > 25, String(goldenTriangle));
check('the North-East set is cohesive too, but QUIETLY so — and the number does not lie about it',
  northEast > 0 && northEast < goldenTriangle, String(northEast));
check('a set with no shared history scores 0 — and the Designer must then fall to a lower tier',
  setCohesion(MEM, ['Delhi', 'Kaziranga']) === 0);
check('a single city has no cohesion to speak of', setCohesion(MEM, ['Delhi']) === 0);

// ---- 6. AN EMPTY MEMORY IS A THINNER PLAN, NEVER A WRONG ONE ------------------------

check('an empty memory returns no pairings rather than throwing',
  coDesignedWith(EMPTY_MEMORY, 'Delhi').length === 0);
check('an empty memory returns no nights rather than inventing one',
  nightsWeCanStandBehind(EMPTY_MEMORY, 'Delhi') === null);
check('an empty memory scores 0 cohesion — the Designer falls to Tier 2 and SAYS so',
  setCohesion(EMPTY_MEMORY, ['Delhi', 'Agra']) === 0);

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
