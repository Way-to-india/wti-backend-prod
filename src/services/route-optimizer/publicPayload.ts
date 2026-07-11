/**
 * US-503a — PUBLIC PAYLOAD FILTER. The safety gate between the engine and the open web.
 *
 * The admin planner payload (`plannerPayload.ts`) is built for an AUTHED CRM operator.
 * It legitimately carries things that must NEVER reach an anonymous public page:
 *
 *   1. **PII.** `enrichment[].guides[]` are REAL, NAMED people with a `phone`, an
 *      `email` and a `piiFlag`. Publishing a working guide's phone number on a public
 *      URL is a privacy breach and would get those guides spammed. Non-negotiable.
 *   2. **The internal cost split.** FOUNDER RULING (2026-07-10): the public planner
 *      shows the per-person BAND only (`plan.totals.costPpBand`), never the four-line
 *      breakdown (hotels / road / trains+flights / taxes). That split is commercial
 *      information — a competitor must not be able to scrape our cost structure.
 *      → `costBreakdown` is REMOVED entirely from the public payload.
 *   3. **Internal engine warnings.** `plan.warnings[]` are operator diagnostics
 *      ("finalize A failed", constraint chatter), not traveller-facing copy.
 *
 * DESIGN: DENY-LIST BY KEY NAME, APPLIED RECURSIVELY — defence in depth. We do not
 * merely re-map the shapes we know about today; we deep-scrub every object in the
 * payload for forbidden key names. So if a future enrichment field ever starts
 * carrying `phone`/`email`, it is stripped automatically instead of silently leaking
 * the day someone adds it. The test asserts the SERIALIZED public payload contains no
 * forbidden key at all.
 *
 * PURE: returns a new object; never mutates the admin payload (the CRM response must
 * be unaffected by the public one being derived from it).
 */

import type { PlannerPayload } from './plannerPayload';

/** Key names that may NEVER appear anywhere in a public payload, at any depth. */
export const PUBLIC_FORBIDDEN_KEYS: readonly string[] = ['phone', 'email', 'piiFlag'] as const;

/**
 * FOUNDER RULING 2026-07-11 — no money on the public planner until the hotel rates
 * are real (contracted rates, or a supplier feed). Today the hotel line is a flat
 * estimate, so any band we print is a promise we cannot keep. We would rather show
 * NO price than a wrong one, on a page that promises nothing is invented.
 *
 * Flip it on with:  PLANNER_PUBLIC_PRICE=on
 * The admin/CRM payload is never affected — operators keep every number.
 */
export const publicPriceEnabled = (): boolean =>
  String(process.env.PLANNER_PUBLIC_PRICE || '').toLowerCase() === 'on';

/** Price keys stripped from the public payload while public pricing is off. */
const PRICE_KEYS: readonly string[] = ['price', 'costPpBand', 'costBreakdown'] as const;

/** The public shape: the admin payload minus the cost split, minus internal warnings,
 *  minus all PII. The price BAND survives on `plan.totals.costPpBand`, and — since
 *  2026-07-11 — the price BAND, the assumption and the levers survive on `price`.
 *  Those are what the traveller needs; none of them reveal our cost structure. */
export type PublicPayload = Omit<PlannerPayload, 'costBreakdown' | 'plan'> & {
  plan: (Omit<NonNullable<PlannerPayload['plan']>, 'warnings'>) | null;
};

/**
 * Recursively deep-copy `value`, dropping any property whose key is in `forbidden`
 * (case-insensitive). Arrays are walked element-wise. Primitives pass through. Pure.
 */
export function scrubKeys<T>(value: T, forbidden: readonly string[] = PUBLIC_FORBIDDEN_KEYS): T {
  const deny = new Set(forbidden.map((k) => k.toLowerCase()));

  const walk = (v: any): any => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(walk);
    const out: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) {
      if (deny.has(k.toLowerCase())) continue; // ← the gate
      out[k] = walk(val);
    }
    return out;
  };

  return walk(value) as T;
}

/**
 * Build the PUBLIC payload from the admin planner payload.
 *   - drops `costBreakdown` (founder: band only)
 *   - drops `plan.warnings` (internal diagnostics)
 *   - deep-scrubs every `phone` / `email` / `piiFlag` anywhere in the tree
 * Everything that makes the product honest is KEPT: the price band, the day-by-day
 * plan, per-leg `decisionRecord` ("why this way"), `legOptions` (the rejected options
 * stay visible), `verifyBeforeBooking`, `reasoning[]`, comfort/rhythm, the map, the
 * archetype cards, and `negotiation[]` on an infeasible request.
 */
export function toPublicPayload(payload: PlannerPayload): PublicPayload {
  const { costBreakdown: _dropped, ...rest } = payload;

  const plan = payload.plan
    ? (() => { const { warnings: _w, ...planRest } = payload.plan!; return planRest; })()
    : null;

  const out = scrubKeys({ ...rest, plan } as unknown as PublicPayload);

  // No money on the public page until the hotel rates are real. Deep-scrub by key
  // name, exactly like the PII gate — so a price cannot leak from a field somebody
  // adds next month either.
  return publicPriceEnabled() ? out : scrubKeys(out, PRICE_KEYS);
}
