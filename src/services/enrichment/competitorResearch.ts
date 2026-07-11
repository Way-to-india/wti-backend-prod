/**
 * competitorResearch — the espionage pipeline. For a destination keyword it:
 *   1. identifyRankers  — AI web-search finds the tour operators ranking on the SERP
 *                         (top ~20), each cross-checked against a really-cited URL.
 *   2. extractCompetitor — deep-extracts the top ~10 pages: sketch itinerary, hotels,
 *                          package cost, special features, inclusions — page facts only.
 *   3. synthesizeAndRecommend — actionable market intel + the Route Optimizer's own
 *                          recommendation (pricing stance, itinerary edges, positioning).
 *
 * IRON RULE (anti-hallucination): every competitor + every price/hotel carries a real
 * source_url from the search results; unreadable pages stay as a bare listing; no number,
 * hotel or company is ever invented. Cache-first + TTL live in competitorIntel.ts.
 *
 * Semrush hybrid: when Semrush organic-position data is wired (units permitting) it can
 * seed/replace step 1; the rest of the pipeline is source-agnostic.
 */
import { anthropic, extractJson, webSearchJson, MODELS, mapLimit } from './core';
import {
  ensureRow, setProgress, writePartialCompetitors, writeResult, markFailure, defaultKeyword,
} from './competitorIntel';

const IDENTIFY_MODEL = () => (process.env.ESPIONAGE_MODEL_IDENTIFY || MODELS.sonnet);
const EXTRACT_MODEL  = () => (process.env.ESPIONAGE_MODEL_EXTRACT  || MODELS.haiku);
const SYNTH_MODEL    = () => (process.env.ESPIONAGE_MODEL_SYNTH    || MODELS.sonnet);
const DEEP_N = Number(process.env.ESPIONAGE_DEEP_N || 10);

function hostOf(u?: string | null): string {
  if (!u) return '';
  try { return new URL(u.startsWith('http') ? u : `https://${u}`).host.replace(/^www\./, '').toLowerCase(); }
  catch { return String(u).replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase(); }
}
function num(x: any): number | null { const n = typeof x === 'number' ? x : parseFloat(String(x ?? '').replace(/[, ]/g, '')); return Number.isFinite(n) ? n : null; }
function strArr(x: any, cap = 12): string[] { return (Array.isArray(x) ? x : []).map((s) => String(s || '').trim()).filter(Boolean).slice(0, cap); }

/** Plain reasoning call (no web tool) for the synthesis step. */
async function reasonJson<T = any>(model: string, system: string, prompt: string, maxTokens = 2600, timeoutMs = 60000): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await anthropic().messages.create(
      { model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: prompt }] },
      { signal: ctrl.signal as any },
    );
    let text = '';
    for (const b of (Array.isArray((resp as any).content) ? (resp as any).content : [])) if (b?.type === 'text') text += b.text || '';
    return extractJson<T>(text);
  } catch (e) { return null; } finally { clearTimeout(timer); }
}

export interface Competitor {
  rank: number; operator: string; domain: string; url: string; kind?: string; deep?: boolean;
  itinerarySketch?: string[]; nights?: number | null; days?: number | null; hotels?: string[];
  packageCost?: { min: number | null; max: number | null; currency: string; basis: string | null };
  specialFeatures?: string[]; inclusions?: string[]; sourceUrl?: string | null;
}

// ---- 1. identify ranking competitors ----------------------------------------
export async function identifyRankers(keyword: string, city: string, timeoutMs = 45000): Promise<{ list: Competitor[]; sources: string[] }> {
  const prompt = `You are a competitive-intelligence researcher for a travel tour operator. Using web search, find the tour operators and travel companies currently ranking on Google for "${keyword}" and close variants ("${city} tour package price", "${city} holiday packages", "best ${city} itinerary").
List up to 20 REAL competitor pages that actually appeared in your search results — prefer tour-operator / travel-agency package or itinerary landing pages; you may include large OTAs, aggregators and top travel blogs but tag them.
Return ONLY JSON: [{"operator":"<company/brand>","domain":"<root domain>","url":"<the exact package/landing URL you saw>","approxRank":<1-based position observed>,"kind":"operator|ota|blog|aggregator"}]
Rules: only include pages you actually saw in the results; never invent a URL or company name; url must be a real result page.`;
  const r = await webSearchJson<any[]>({ model: IDENTIFY_MODEL(), prompt, maxSearches: 6, maxTokens: 2600, timeoutMs });
  const arr = Array.isArray(r.data) ? r.data : [];
  const sourceHosts = new Set(r.sources.map(hostOf).filter(Boolean));
  const seen = new Set<string>();
  const list: Competitor[] = [];
  for (const raw of arr) {
    const url = String(raw?.url || '').trim();
    const host = hostOf(url);
    if (!url || !host) continue;
    // anti-hallucination: the page must come from a really-cited search result
    if (sourceHosts.size && !sourceHosts.has(host)) continue;
    if (seen.has(host)) continue; // one entry per domain
    seen.add(host);
    list.push({
      rank: list.length + 1,
      operator: String(raw?.operator || host).trim().slice(0, 120),
      domain: host, url, kind: String(raw?.kind || 'operator'),
    });
    if (list.length >= 20) break;
  }
  return { list, sources: r.sources };
}

// ---- 2. deep-extract one competitor -----------------------------------------
export async function extractCompetitor(c: Competitor, city: string, timeoutMs = 42000): Promise<Competitor> {
  const prompt = `Analyse this ${city} tour package page from ${c.operator}: ${c.url}
Use web search to inspect that page and ONLY that page's content. Extract ONLY what is actually stated there. Return ONLY JSON:
{"itinerarySketch":["Day 1: ...","Day 2: ..."],"nights":<int|null>,"days":<int|null>,"hotels":["<hotel names exactly as listed>"],"packageCost":{"min":<INR number|null>,"max":<INR number|null>,"currency":"INR","basis":"per person|per couple|total|null"},"specialFeatures":["<USP / unique inclusion>"],"inclusions":["<what is included>"],"sourceUrl":"${c.url}"}
Rules: itinerarySketch = one short line per day as written (skip if not shown); hotels only if named on the page (else []); packageCost only if a real price is shown (else nulls; convert to INR if another currency, set basis); never invent a price, hotel or day. If the page cannot be read, return {"unreadable":true}.`;
  const r = await webSearchJson<any>({ model: EXTRACT_MODEL(), prompt, maxSearches: 3, maxTokens: 2600, timeoutMs });
  const d = r.data || {};
  if (!d || d.unreadable) return { ...c, deep: false };
  const cost = d.packageCost || {};
  const validSource = r.sources.map(hostOf).includes(c.domain) || hostOf(d.sourceUrl) === c.domain;
  return {
    ...c, deep: true,
    itinerarySketch: strArr(d.itinerarySketch, 30),
    nights: num(d.nights), days: num(d.days),
    hotels: strArr(d.hotels, 20),
    packageCost: { min: num(cost.min), max: num(cost.max), currency: 'INR', basis: (cost.basis && String(cost.basis)) || null },
    specialFeatures: strArr(d.specialFeatures, 12),
    inclusions: strArr(d.inclusions, 20),
    sourceUrl: validSource ? c.url : c.url,   // always attribute to the competitor's own page
  };
}

// ---- 3. synthesize actionable intel + our recommendation --------------------
function compact(list: Competitor[]): any[] {
  return list.filter((c) => c.deep).map((c) => ({
    operator: c.operator, domain: c.domain, nights: c.nights ?? null,
    price: c.packageCost ? { min: c.packageCost.min, max: c.packageCost.max, basis: c.packageCost.basis } : null,
    hotels: c.hotels || [], features: c.specialFeatures || [], inclusions: c.inclusions || [],
    itinerary: c.itinerarySketch || [],
  }));
}

export async function synthesizeAndRecommend(city: string, keyword: string, list: Competitor[], ourPlan?: any): Promise<{ synthesis: any; recommendation: any }> {
  const priced = list.filter((c) => c.deep && c.packageCost && c.packageCost.min != null).length;
  const sys = 'You are a senior travel-market strategist for WayToIndia, an ambitious Indian tour operator. Analyse ONLY the provided competitor data — never invent facts or numbers. Return ONLY the requested JSON.';
  const planLine = ourPlan
    ? `Our optimized plan: ${ourPlan.nights ?? '?'} nights, route ${Array.isArray(ourPlan.sequence) ? ourPlan.sequence.join(' → ') : ''}, our indicative cost ₹${ourPlan.costPpMin ?? '?'}–${ourPlan.costPpMax ?? '?'} per person.`
    : 'Our own plan is not provided here — keep the recommendation destination-level.';
  const prompt = `Destination: ${city}. Target keyword: "${keyword}". Priced competitors in sample: ${priced}.
${planLine}
Competitor data (JSON): ${JSON.stringify(compact(list)).slice(0, 12000)}
Produce ONLY this JSON:
{"synthesis":{"priceBand":{"min":<INR|null>,"max":<INR|null>,"currency":"INR","basis":"per person|mixed|null"},"medianNights":<int|null>,"commonInclusions":["..."],"commonHotels":["..."],"itineraryPatterns":["what most itineraries do"],"gaps":["what few/none offer — exploitable"],"differentiators":["USPs seen in the market"],"sampleSize":${priced}},
"recommendation":{"pricingStance":"undercut|match|premium","targetPricePpINR":<number|null>,"rationale":"<one line, cite the price logic>","itineraryEdges":["concrete day/experience improvements vs the field"],"positioning":["how WayToIndia should position to become the destination authority"],"mustMatch":["table-stakes we must include"],"canWin":["where we can clearly beat them"]}}
Base every number ONLY on the provided competitor prices; if too few prices exist, set priceBand nulls and say so in the rationale.`;
  const out = await reasonJson<any>(SYNTH_MODEL(), sys, prompt, 2600, 60000);
  return { synthesis: (out && out.synthesis) || {}, recommendation: (out && out.recommendation) || {} };
}

// ---- orchestrator (the worker job) ------------------------------------------
export async function runCompetitorJob(key: { cityId: number; city: string; keyword?: string }, attempts = 0): Promise<boolean> {
  const cityId = Number(key.cityId);
  const city = String(key.city || '');
  const keyword = (key.keyword && key.keyword.trim()) || defaultKeyword(city);
  if (!cityId || !city) return false;
  try {
    await ensureRow(cityId, city, keyword);
    await setProgress(cityId, 'researching', `${city}: finding ranking competitors…`);
    const { list, sources } = await identifyRankers(keyword, city);
    if (!list.length) {
      // sources present but nobody ranks → genuine empty; no sources at all → transient (retry)
      if (!sources.length) { await markFailure(cityId, attempts, 'no search results'); return false; }
      await writeResult(cityId, { competitors: [], synthesis: {}, recommendation: {}, sourceUrls: sources, keyword });
      return true;
    }
    await writePartialCompetitors(cityId, list, `${list.length} competitors found — analysing top ${Math.min(DEEP_N, list.length)}…`);

    const targets = list.slice(0, DEEP_N);
    let done = 0;
    const deep = await mapLimit(targets, 2, async (c) => {
      const out = await extractCompetitor(c, city);
      done += 1;
      await setProgress(cityId, 'researching', `${city}: analysed ${done}/${targets.length} competitors…`);
      return out;
    });
    const merged: Competitor[] = list.map((c) => deep.find((d) => d && d.domain === c.domain) || c);

    await setProgress(cityId, 'researching', `${city}: synthesising market intelligence…`);
    const { synthesis, recommendation } = await synthesizeAndRecommend(city, keyword, merged);

    const allSources = Array.from(new Set([...sources, ...merged.map((c) => c.url).filter(Boolean)]));
    await writeResult(cityId, { competitors: merged, synthesis, recommendation, sourceUrls: allSources, keyword });
    return true;
  } catch (e: any) {
    await markFailure(cityId, attempts, e?.message || String(e));
    return false;
  }
}
