/**
 * ELIGIBILITY — who is allowed in, and who must not be sent.
 *
 * THE FAILURE THIS ENDS. Every temple in our catalogue carried one word, `Pilgrimage`.
 * But Jagannath Puri bars non-Hindus at the gate by name and appearance, and Hampi is an
 * ASI monument open to everyone. Sold from the same label, those are two different products
 * and one of them ends with a family turned away at a Lion Gate they have flown to reach.
 *
 * An OCI card does NOT help at Puri. It also does not help for an Inner Line Permit — an
 * OCI holder is legally foreign for permits and Indian only for ticket prices. That single
 * asymmetry is the commonest booking error we make.
 *
 * This module is DETERMINISTIC and reads only facts stored in `place_eligibility`, each of
 * which carries its own sources, confidence and re-verify date. It NEVER infers a rule.
 * Silence here means "we have not verified it", which the caller must say out loud rather
 * than paper over.
 */

export type Audience =
  | 'hindu_indian'
  | 'foreign'
  | 'oci_nri'
  | 'mixed_nationality'
  | 'non_hindu'
  | 'unknown';

export interface EligibilityFact {
  place: string;
  templeName: string | null;
  entryClass: string | null;
  nonHinduEntry: string | null;      // Permitted | Barred | Outer areas only | Not applicable
  enforcementNote: string | null;
  dressCode: string | null;
  ageOrMedical: string | null;
  registration: string | null;
  foreignSuitable: string | null;
  ociNote: string | null;
  alternative: string | null;        // what a barred guest CAN still see
  confidence: string | null;
  reVerifyBy: string | null;
}

export interface EligibilityWarning {
  place: string;
  templeName: string | null;
  severity: 'blocker' | 'caution' | 'note';
  reason: string;
  alternative: string | null;
  confidence: string | null;
}

/** Words that reveal WHO is travelling. Read from his own sentence — zero tokens, no model. */
export function audienceFromText(text: string | null | undefined): Audience {
  const t = (text ?? '').toLowerCase();
  if (!t.trim()) return 'unknown';
  const mixed = /(my (wife|husband|partner) is (a )?(british|american|german|french|australian|canadian|russian|japanese|chinese|italian|spanish|dutch|swedish|foreign))|mixed (faith|nationality)|(he|she) is not (a )?hindu|non[- ]?hindu/i;
  if (mixed.test(t)) return 'mixed_nationality';
  if (/\b(christian|muslim|catholic|jewish|parsi|atheist|buddhist by faith)\b/.test(t)) return 'non_hindu';
  if (/\boci\b|overseas citizen|pio card|nri\b|non[- ]resident indian|we live (in|abroad)|settled in (usa|uk|canada|australia|singapore|dubai)/i.test(t)) return 'oci_nri';
  if (/\b(foreigner|foreign national|we are (from|coming from) (the )?(usa|uk|us|america|britain|germany|france|australia|canada|japan|spain|italy))\b/i.test(t)) return 'foreign';
  if (/\b(hindu|darshan|puja|pooja|yatra|temple)\b/.test(t)) return 'hindu_indian';
  return 'unknown';
}

/** Is this audience at risk of being refused at a Hindu-only gate? */
export function facesEntryRisk(a: Audience): boolean {
  return a === 'foreign' || a === 'non_hindu' || a === 'mixed_nationality';
}

/**
 * Turn stored facts into warnings for THIS traveller.
 *
 * A blocker is a gate that will refuse him. A caution is a real restriction that will not
 * refuse him but will change his day (dress, registration, a medical bar). A note is
 * information he should have. We never soften a blocker into a caution — a family that
 * flew to Puri deserves the word "barred" before they book, not after.
 */
export function warningsFor(facts: EligibilityFact[], audience: Audience): EligibilityWarning[] {
  const out: EligibilityWarning[] = [];
  const atRisk = facesEntryRisk(audience);

  for (const f of facts) {
    const entry = (f.nonHinduEntry ?? '').toLowerCase();

    if (atRisk && entry.startsWith('barred')) {
      out.push({
        place: f.place, templeName: f.templeName, severity: 'blocker',
        reason: `${f.templeName ?? f.place} does not allow non-Hindus inside. The check at the gate is by name and appearance, so an OCI card does not help.`,
        alternative: f.alternative, confidence: f.confidence,
      });
    } else if (atRisk && entry.startsWith('outer')) {
      out.push({
        place: f.place, templeName: f.templeName, severity: 'caution',
        reason: `At ${f.templeName ?? f.place} non-Hindus may see the outer areas but not the sanctum.`,
        alternative: f.alternative, confidence: f.confidence,
      });
    }

    // Age and medical bars apply to EVERYONE, whatever their faith or passport.
    if (f.ageOrMedical && /\b(only|bar|not allowed|below \d|above \d|under \d|over \d|prohibit|must not|certificate)\b/i.test(f.ageOrMedical)) {
      out.push({
        place: f.place, templeName: f.templeName, severity: 'caution',
        reason: `${f.place}: ${f.ageOrMedical.slice(0, 300)}`,
        alternative: null, confidence: f.confidence,
      });
    }

    if (f.registration && !/^unknown/i.test(f.registration) && f.registration.length > 8) {
      out.push({
        place: f.place, templeName: f.templeName, severity: 'note',
        reason: `${f.place} needs a booking or permit before you travel: ${f.registration.slice(0, 220)}`,
        alternative: null, confidence: f.confidence,
      });
    }

    if (atRisk && f.dressCode && !/^unknown/i.test(f.dressCode)) {
      out.push({
        place: f.place, templeName: f.templeName, severity: 'note',
        reason: `Dress rule at ${f.templeName ?? f.place}: ${f.dressCode.slice(0, 220)}`,
        alternative: null, confidence: f.confidence,
      });
    }
  }

  // A blocker outranks everything about the same place; do not bury it under notes.
  const rank = { blocker: 0, caution: 1, note: 2 } as const;
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || a.place.localeCompare(b.place));
}
