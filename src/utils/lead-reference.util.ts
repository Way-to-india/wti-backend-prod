import prisma from '@/config/db';

/**
 * Single source of truth for generating Lead Reference Numbers.
 *
 * Format:  WTI-YY-NNNNNN     e.g.  WTI-26-001042
 *   - WTI    brand prefix
 *   - YY     2-digit year the lead was created
 *   - NNNNNN zero-padded global running number (>= 6 digits, grows naturally)
 *
 * Why a Postgres SEQUENCE:
 *   nextval() is atomic and concurrency-safe at the database level, so two
 *   leads created in the same millisecond can NEVER collide. This replaces:
 *     (a) the random `CT-#####` website generator (only 80k values, retry loop,
 *         timestamp fallback — NON-sequential), and
 *     (b) the per-day count `WTI{YY}{MM}{####}` admin generator (race condition
 *         on count(), resets daily, counts unrelated rows).
 *
 * Backward compatibility:
 *   Legacy refs (`CT-63317`, `WTI26030001`) remain valid and unique — the column
 *   is just a unique VARCHAR. Only NEW leads adopt the WTI-YY-NNNNNN scheme.
 *
 * Safety net:
 *   If the sequence is somehow unreachable we fall back to a timestamp-based ref
 *   so a customer enquiry is NEVER lost. This path is logged loudly for alerting.
 */
export async function generateLeadReference(): Promise<string> {
  const yy = new Date().getFullYear().toString().slice(-2);

  try {
    const rows = await prisma.$queryRaw<Array<{ nextval: bigint }>>`
      SELECT nextval('lead_reference_seq') AS nextval
    `;
    const seq = rows?.[0]?.nextval;
    if (seq === undefined || seq === null) {
      throw new Error('lead_reference_seq returned no value');
    }
    return `WTI-${yy}-${seq.toString().padStart(6, '0')}`;
  } catch (err) {
    const fallback = `WTI-${yy}-T${Date.now().toString().slice(-8)}`;
    // eslint-disable-next-line no-console
    console.error(
      `[lead-reference] FALLBACK USED — sequence unavailable. Issued ${fallback}.`,
      err
    );
    return fallback;
  }
}
