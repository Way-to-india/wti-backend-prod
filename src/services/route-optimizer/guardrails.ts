/**
 * Guardrails (blueprint §6, non-negotiable).
 *
 *  - Zero fabrication: a RAIL/AIR leg must carry an identifier from the curated
 *    option pool. Without one it is downgraded to ROAD or flagged VERIFY — the
 *    engine never invents a train/flight number.
 *  - verify-before-booking: any thin (reliability ≤ 2), seasonal, or stale
 *    (verified_at > 90 days) option is surfaced so the desk reconfirms it.
 */

import type { LegOption } from './types';

export const STALE_DAYS = 90;

export function isStale(verifiedAt?: string | null, now = Date.now()): boolean {
  if (!verifiedAt) return true; // never verified ⇒ treat as stale
  const t = Date.parse(verifiedAt);
  if (Number.isNaN(t)) return true;
  return (now - t) / 86_400_000 > STALE_DAYS;
}

/** A RAIL/AIR option is only trustworthy if it has an identifier. */
export function requiresIdentifier(opt: LegOption): boolean {
  return (opt.mode === 'RAIL' || opt.mode === 'AIR') && !opt.identifier;
}

export function verifyList(options: LegOption[], now = Date.now()): string[] {
  const out: string[] = [];
  for (const o of options) {
    const label = o.identifier || `${o.from} → ${o.to} (${o.mode})`;
    if (requiresIdentifier(o)) out.push(`${o.from} → ${o.to}: ${o.mode} option has no identifier — do not fabricate; confirm a real service or ship as road.`);
    if (o.reliability != null && o.reliability <= 2) out.push(`${label}: thin service (reliability ${o.reliability}/5) — a retime cascades the plan; reconfirm.`);
    if (o.seasonal) out.push(`${label}: seasonal — verify it operates in the travel month.`);
    if (isStale(o.verifiedAt, now)) out.push(`${label}: timetable not verified in ${STALE_DAYS} days — reconfirm before booking.`);
  }
  return Array.from(new Set(out));
}
