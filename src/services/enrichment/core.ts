/**
 * Enrichment core — shared LLM + web-search + cache primitives.
 *
 * The enrichment layer sits ON TOP of the (pure, deterministic) route optimizer.
 * It is cache-first: every reader checks a cache table first and only calls the
 * model on a miss/stale. This bounds cost + latency and lets the system LEARN
 * (fares) and remember (hotels/guides/content) over time.
 *
 * GUARDRAIL (non-negotiable): every enriched fact must carry a `source_url` and a
 * `confidence`. Anything without a source is marked unverified and never treated
 * as bookable. We never invent a fare, hotel, guide, phone number or train/flight.
 */

import Anthropic from '@anthropic-ai/sdk';

// Reuse the same key the CRM AI funnel already uses (present in prod .env).
let _client: Anthropic | null = null;
export function anthropic(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

const HAIKU = 'claude-haiku-4-5-20251001';
const SONNET = 'claude-sonnet-4-5-20250929';

export const MODELS = {
  haiku: HAIKU,
  sonnet: SONNET,
} as const;

/**
 * Per-concern model selection. Accuracy-critical + PII-sensitive concerns default
 * to Sonnet; low-risk extraction (hotels) uses Haiku. Override per concern with
 * ENRICH_MODEL_FARE / _HOTEL / _GUIDE / _CONTENT (value: 'haiku' | 'sonnet' | a
 * full model id).
 */
function pick(envKey: string, dflt: string): string {
  const v = (process.env[envKey] || '').trim().toLowerCase();
  if (v === 'haiku') return HAIKU;
  if (v === 'sonnet') return SONNET;
  return process.env[envKey]?.trim() || dflt;
}
export const CONCERN_MODEL = {
  fare:    () => pick('ENRICH_MODEL_FARE', HAIKU),   // drives the cost decision → accuracy
  hotel:   () => pick('ENRICH_MODEL_HOTEL', HAIKU),   // low-risk list extraction
  guide:   () => pick('ENRICH_MODEL_GUIDE', HAIKU),  // PII + anti-fabrication → strongest
  content: () => pick('ENRICH_MODEL_CONTENT', HAIKU),// narrative quality
} as const;

export const enrichmentEnabled = (): boolean => !!process.env.ANTHROPIC_API_KEY;

// ---- India travel seasonality -----------------------------------------------
// Peak inbound/domestic leisure season is roughly Oct–Mar (cool, dry). Fares in
// these months are inflated; the LEARNING average is built only from NON-PEAK
// (Apr–Sep) observations so the fallback reflects a fair baseline.
const PEAK_MONTHS = new Set([10, 11, 12, 1, 2, 3]);
export function isPeakMonth(month?: number | null): boolean {
  if (!month || month < 1 || month > 12) return false;
  return PEAK_MONTHS.has(month);
}
/** Current month (1..12) in IST when the caller doesn't specify one. */
export function currentMonthIST(): number {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  return ist.getUTCMonth() + 1;
}

// ---- cache freshness ---------------------------------------------------------
export function isFresh(fetchedAt: Date | string | null | undefined, ttlHours: number): boolean {
  if (!fetchedAt) return false;
  const t = typeof fetchedAt === 'string' ? Date.parse(fetchedAt) : fetchedAt.getTime();
  if (isNaN(t)) return false;
  return Date.now() - t < ttlHours * 3600 * 1000;
}

// ---- guardrails --------------------------------------------------------------
export function hasSource(x: { source_url?: string | null; sourceUrl?: string | null }): boolean {
  const u = (x.source_url ?? x.sourceUrl ?? '').toString().trim();
  return /^https?:\/\//i.test(u);
}
export function clampConfidence(c: unknown): number {
  const n = typeof c === 'number' ? c : parseFloat(String(c));
  if (isNaN(n)) return 0.4;
  return Math.max(0, Math.min(1, n));
}

// ---- robust JSON extraction from a model response ---------------------------
/** Every balanced {...}/[...] substring that parses as JSON. */
function jsonCandidates(text: string): any[] {
  const out: any[] = [];
  for (let i = 0; i < text.length; i++) {
    const open = text[i];
    if (open !== '{' && open !== '[') continue;
    const close = open === '{' ? '}' : ']';
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) { try { out.push(JSON.parse(text.slice(i, j + 1))); } catch { /* not valid */ } break; }
      }
    }
  }
  return out;
}

/**
 * Pull the intended JSON value out of a model response, resilient to prose,
 * markdown fences and inline brace-examples. Strategy: try fenced ```json blocks
 * first, then scan the whole text for every balanced JSON value and return the
 * LARGEST one (the real payload dwarfs any inline example). Non-empty arrays and
 * objects are preferred over empties.
 */
export function extractJson<T = any>(text: string): T | null {
  if (!text) return null;
  const pools: string[] = [];
  for (const m of text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) pools.push(m[1]);
  pools.push(text);
  let best: any = null; let bestScore = -1;
  for (const pool of pools) {
    for (const cand of jsonCandidates(pool)) {
      const size = JSON.stringify(cand).length;
      const nonEmpty = Array.isArray(cand) ? cand.length > 0 : (cand && typeof cand === 'object' ? Object.keys(cand).length > 0 : true);
      const score = size + (nonEmpty ? 100000 : 0);
      if (score > bestScore) { bestScore = score; best = cand; }
    }
    if (best != null && bestScore >= 100000) break; // found a non-empty fenced payload
  }
  return best as T | null;
}

// ---- the one call all enrichers use -----------------------------------------
export interface WebSearchOpts {
  model?: string;
  system?: string;
  prompt: string;
  maxSearches?: number;   // cap web_search uses (cost control)
  maxTokens?: number;
  timeoutMs?: number;     // hard per-call budget
}
export interface WebSearchResult<T> {
  data: T | null;
  sources: string[];      // URLs the model cited (from web_search results)
  text: string;
  error?: string;
}

/**
 * Run a model with the web_search server tool and parse a JSON answer.
 * Fail-safe: any error resolves to { data:null } so callers fall back to
 * deterministic values — enrichment must never break optimisation.
 */
export async function webSearchJson<T = any>(opts: WebSearchOpts): Promise<WebSearchResult<T>> {
  const model = opts.model || MODELS.haiku;
  const maxSearches = opts.maxSearches ?? 3;
  const timeoutMs = opts.timeoutMs ?? 30000;
  if (!enrichmentEnabled()) return { data: null, sources: [], text: '', error: 'no_api_key' };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await anthropic().messages.create(
      {
        model,
        max_tokens: opts.maxTokens ?? 1500,
        system: opts.system ?? 'You are a data-extraction API. After using web_search, respond with ONLY the requested JSON value — no preamble, no explanation, no markdown fences. If you cannot find real, sourced data, return an empty array [] or {"fare_pp_min":null}. Never invent values.',
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: maxSearches } as any],
        messages: [{ role: 'user', content: opts.prompt }],
      },
      { signal: ctrl.signal as any },
    );
    // collect text + cited source URLs. NOTE: a web_search_tool_result block's
    // `content` may be an ARRAY of results OR an ERROR object (e.g. rate-limited /
    // no results); `citations` may be absent. Guard every iteration with
    // Array.isArray so a search error can never throw out of the whole call.
    let text = '';
    const sources = new Set<string>();
    for (const block of (Array.isArray((resp as any).content) ? (resp as any).content : [])) {
      if (block?.type === 'text') {
        text += block.text || '';
        if (Array.isArray(block.citations)) for (const cite of block.citations) if (cite?.url) sources.add(cite.url);
      }
      if (block?.type === 'web_search_tool_result' && Array.isArray(block.content)) {
        for (const r of block.content) if (r?.url) sources.add(r.url);
      }
    }
    const data = extractJson<T>(text);
    return { data, sources: [...sources], text };
  } catch (e: any) {
    return { data: null, sources: [], text: '', error: e?.message || String(e) };
  } finally {
    clearTimeout(timer);
  }
}

// ---- concurrency helper (bound parallel enrichment fan-out) ------------------
export async function mapLimit<A, B>(items: A[], limit: number, fn: (a: A, i: number) => Promise<B>): Promise<B[]> {
  const out: B[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) break;
      try { out[idx] = await fn(items[idx], idx); } catch (e) { out[idx] = undefined as any; }
    }
  });
  await Promise.all(workers);
  return out;
}
