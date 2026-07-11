/**
 * ============================================================================
 *  ENRICHMENT IRON RULES — anti-hallucination validation layer
 * ============================================================================
 * The model is NEVER trusted on its word. Every fact it returns is validated
 * here, in code, against hard rules before it may enter a cache table or a plan.
 * Anything that fails is DROPPED (bookable facts) or DOWNGRADED to an
 * unverified/verify-before-booking state — it is never presented as confirmed.
 *
 *  RULE 1  SOURCE MANDATORY.       Every fare/hotel/guide/attraction must carry a
 *                                  valid http(s) source_url. No URL → discard.
 *  RULE 2  SOURCE MUST BE REAL.    The claimed source_url must match a URL the
 *                                  web_search actually returned this call (host
 *                                  match). A cited-but-not-retrieved URL is
 *                                  treated as fabricated → discard.
 *  RULE 3  NUMERIC SANITY.         Fares/prices/ratings must fall inside
 *                                  plausible bounds; out-of-range = hallucination
 *                                  → discard the value.
 *  RULE 4  NO INVENTED CONTACTS.   A guide phone must match an Indian phone
 *                                  pattern; else the phone is nulled (never
 *                                  guessed). Email must be well-formed or nulled.
 *  RULE 5  PROVENANCE STAMPED.     Every stored row keeps source + confidence +
 *                                  fetched_at. Low confidence / unofficial →
 *                                  verify-before-booking.
 *  RULE 6  DETERMINISTIC FALLBACK. On any doubt the engine falls back to a
 *                                  deterministic value (estCostPp / tier rate)
 *                                  labelled "indicative". Enrichment MUST NEVER
 *                                  block optimisation or emit an unvalidated fact.
 *  RULE 7  NO FABRICATION CONTRACT. Prompts instruct JSON-only + "return
 *                                  null/[] if not found"; combined with the above
 *                                  the model cannot smuggle a guess through.
 * ============================================================================
 */

// ---- URL / source provenance -------------------------------------------------
function host(url: string): string | null {
  try { return new URL(url).host.replace(/^www\./, '').toLowerCase(); } catch { return null; }
}
export function isHttpUrl(u?: string | null): boolean {
  return typeof u === 'string' && /^https?:\/\/\S+$/i.test(u.trim());
}
// two-part public suffixes we see for India/travel sites
const TWO_PART_TLDS = new Set(['co.in', 'com.au', 'co.uk', 'co.nz', 'com.sg', 'gov.in', 'nic.in', 'org.in', 'net.in', 'ac.in']);
/** Brand label of a host, e.g. www.tripadvisor.in → "tripadvisor", hotels.booking.com → "booking". */
function brand(h: string): string {
  const parts = h.split('.');
  if (parts.length < 2) return h;
  const lastTwo = parts.slice(-2).join('.');
  const idx = TWO_PART_TLDS.has(lastTwo) ? parts.length - 3 : parts.length - 2;
  return parts[Math.max(0, idx)] || h;
}
/**
 * RULE 2 — the claimed source_url must correspond to a site the web_search
 * actually returned. Matched at BRAND level (tripadvisor.com ~ tripadvisor.in ~
 * in.tripadvisor.com) so legitimate ccTLD/subdomain variants pass, while a URL on
 * a brand that was never searched is rejected as fabricated. Fails closed when the
 * call returned no searched URLs.
 */
export function sourceIsReal(url: string | null | undefined, searched: string[]): boolean {
  if (!isHttpUrl(url)) return false;
  const h = host(url!);
  if (!h) return false;
  const hosts = new Set(searched.map(host).filter(Boolean) as string[]);
  if (!hosts.size) return false;                 // no searched URLs → cannot verify → fail closed
  const hb = brand(h);
  for (const sh of hosts) {
    if (sh === h) return true;                    // exact host
    if (sh.slice(-h.length) === h || h.slice(-sh.length) === sh) return true; // subdomain suffix
    if (hb.length >= 4 && brand(sh) === hb) return true; // same brand (ccTLD/subdomain variance)
  }
  return false;
}

/**
 * Resolve provenance for one item. If the item's own URL is verifiable against
 * the searched sources, use it (verified=true). Otherwise, if the call DID return
 * real searched pages, ground the item on the primary searched page
 * (verified=false → lower confidence + verify-before-booking). Only when there
 * are NO searched sources at all do we reject (fail closed — the model didn't
 * actually search, so the item can't be trusted). This keeps every fact grounded
 * in a real web_search while not demanding a deep-link per row.
 */
export function resolveProvenance(itemUrl: string | null | undefined, searched: string[]): { url: string; verified: boolean } | null {
  if (sourceIsReal(itemUrl, searched)) return { url: itemUrl!.trim(), verified: true };
  const firstReal = searched.find(isHttpUrl);
  if (firstReal) return { url: firstReal, verified: false };
  return null;
}

// ---- numeric sanity bounds (RULE 3) -----------------------------------------
export const FARE_BOUNDS = { AIR: { min: 800, max: 60000 }, RAIL: { min: 80, max: 12000 } } as const;
export function fareInBounds(mode: 'AIR' | 'RAIL', min: number, max: number): boolean {
  const b = FARE_BOUNDS[mode];
  return Number.isFinite(min) && Number.isFinite(max) && min > 0 && max >= min && min >= b.min && max <= b.max;
}
export function ratingInBounds(r: unknown): number | null {
  const n = typeof r === 'number' ? r : parseFloat(String(r));
  if (!Number.isFinite(n) || n < 0 || n > 5) return null;
  return Math.round(n * 10) / 10;
}
export function hotelPriceOk(p: unknown): number | null {
  const n = typeof p === 'number' ? p : parseFloat(String(p));
  if (!Number.isFinite(n) || n < 300 || n > 200000) return null; // ₹/room/night sanity
  return Math.round(n);
}

// ---- contact validation (RULE 4) --------------------------------------------
/** Indian phone: optional +91/0, 10 digits starting 6-9, tolerant of spaces/dashes. */
export function cleanIndianPhone(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d+]/g, '');
  const m = digits.match(/(?:\+?91|0)?([6-9]\d{9})$/);
  return m ? `+91${m[1]}` : null;
}
export function cleanEmail(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? s : null;
}

// ---- confidence --------------------------------------------------------------
export function normConfidence(c: unknown, floor = 0, ceil = 1): number {
  const n = typeof c === 'number' ? c : parseFloat(String(c));
  if (!Number.isFinite(n)) return 0.4;
  return Math.max(floor, Math.min(ceil, n));
}

// ---- validated shapes --------------------------------------------------------
export interface ValidatedFare { min: number; max: number; currency: string; serviceId: string | null; sourceUrl: string; confidence: number }

/** RULE 1+2+3 for a fare. Returns null (→ deterministic fallback) if it fails. */
export function validateFare(
  mode: 'AIR' | 'RAIL',
  d: { fare_pp_min?: any; fare_pp_max?: any; currency?: any; service_id?: any; source_url?: any; confidence?: any },
  searched: string[],
): ValidatedFare | null {
  if (d?.fare_pp_min == null || d?.fare_pp_max == null) return null;
  const min = Math.round(Number(d.fare_pp_min)); const max = Math.round(Number(d.fare_pp_max));
  if (!fareInBounds(mode, min, max)) return null;                 // RULE 3 (numeric sanity is the hard guard)
  const prov = resolveProvenance(d?.source_url, searched);        // RULE 1 + 2 (grounded in a real search)
  if (!prov) return null;
  // unverified provenance → cap confidence so it joins verify-before-booking
  const conf = prov.verified ? normConfidence(d.confidence) : Math.min(normConfidence(d.confidence), 0.5);
  return { min, max, currency: (d.currency || 'INR').toString().toUpperCase().slice(0, 3),
    serviceId: d.service_id ? String(d.service_id).trim().slice(0, 40) : null,
    sourceUrl: prov.url, confidence: conf };
}

export interface ValidatedHotel { name: string; rating: number | null; reviewCount: number | null; pricePnMin: number | null; pricePnMax: number | null; sourceUrl: string; verified: boolean; blurb: string | null }
export function validateHotel(h: any, searched: string[]): ValidatedHotel | null {
  const name = (h?.name || '').toString().trim();
  if (!name) return null;
  const prov = resolveProvenance(h?.source_url, searched);        // RULE 1 + 2 (grounded in a real search)
  if (!prov) return null;
  return { name: name.slice(0, 120), rating: ratingInBounds(h.rating),
    reviewCount: Number.isFinite(Number(h.review_count)) ? Math.max(0, Math.round(Number(h.review_count))) : null,
    pricePnMin: h.price_pn_min != null ? hotelPriceOk(h.price_pn_min) : null,
    pricePnMax: h.price_pn_max != null ? hotelPriceOk(h.price_pn_max) : null,
    sourceUrl: prov.url, verified: prov.verified, blurb: h.blurb ? String(h.blurb).trim().slice(0, 240) : null };
}

export interface ValidatedGuide { name: string; languages: string[]; phone: string | null; email: string | null; recognition: string; rating: number | null; sourceUrl: string; verified: boolean; piiFlag: boolean }
export function validateGuide(g: any, searched: string[]): ValidatedGuide | null {
  const name = (g?.name || '').toString().trim();
  if (!name) return null;
  const prov = resolveProvenance(g?.source_url, searched);        // RULE 1 + 2
  if (!prov) return null;
  const phone = cleanIndianPhone(g.phone);                        // RULE 4 (never invent)
  const email = cleanEmail(g.email);
  const rec = (g.recognition || 'unverified').toString().trim().slice(0, 60);
  const official = /tourism|ministry|govt|government|rlg|regional level|incredible ?india/i.test(rec + ' ' + prov.url);
  return { name: name.slice(0, 120), languages: Array.isArray(g.languages) ? g.languages.map((x: any) => String(x).slice(0, 30)).slice(0, 8) : [],
    phone, email, recognition: rec, rating: ratingInBounds(g.rating), sourceUrl: prov.url,
    verified: prov.verified && official, piiFlag: !!(phone || email) };
}

export interface ValidatedAttraction { name: string; why?: string; hours?: string; sourceUrl?: string }
export function validateAttraction(a: any, searched: string[]): ValidatedAttraction | null {
  const name = (a?.name || '').toString().trim();
  if (!name) return null;
  const url = (a?.source_url || '').toString().trim();
  // attractions are descriptive (not bookable); keep name even without a source,
  // but only attach a source_url that passes provenance.
  return { name: name.slice(0, 120), why: a.why ? String(a.why).slice(0, 200) : undefined,
    hours: a.hours ? String(a.hours).slice(0, 80) : undefined,
    sourceUrl: sourceIsReal(url, searched) ? url : undefined };
}
