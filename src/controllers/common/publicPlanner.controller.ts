// =============================================================================
// US-503 — PUBLIC PLANNER ENDPOINT. POST /api/common/planner/plan
//
// The public face of the Route-Mind engine. This is NOT the admin route with
// auth removed. Three protections (HANDOFF §US-503, founder decisions 2026-07-10):
//
//   1. PII / cost split — the response is ONLY the sanitized planner payload
//      (toPublicPayload: guide phone/email/piiFlag deep-scrubbed, costBreakdown
//      and internal warnings removed). plans[] is NEVER exposed publicly.
//   2. Cost + abuse — per-IP rate limit (10 solves/hour, burst 3/5min), input
//      caps (cities ≤ 7, pax ≤ 12, nights ≤ 21), enrichment forced to
//      cache-first 'fast' mode (never 'deep'), pins/halts stripped.
//   3. Free-text ask — the traveller types the trip like they'd tell a friend.
//      Claude (Haiku) extracts cities/nights/profile/month/pax; every city is
//      then VALIDATED against world_cities. Anything the model names that the
//      gazetteer cannot resolve is dropped; fewer than 2 resolvable cities =
//      an honest 400, never a guessed itinerary. The LLM only ever produces a
//      candidate list for validation — it cannot inject a fact into the plan.
//
// Reuses the admin controller's optimize() end-to-end (same engine, same
// adapter) via a captured response, so the two views can never disagree.
// =============================================================================
import { Request, Response } from 'express';
import { RouteOptimizerController } from '@/controllers/admin/routeOptimizer.controller';
import { toPublicPayload } from '@/services/route-optimizer/publicPayload';
import type { PlannerPayload } from '@/services/route-optimizer/plannerPayload';
import { anthropic, enrichmentEnabled } from '@/services/enrichment/core';
import prisma from '@/config/db';

// ---- per-IP rate limit (in-memory; nginx sits in front, single process) ----
const HOUR = 60 * 60 * 1000;
const hits = new Map<string, number[]>();
function allow(ip: string): { ok: boolean; retryMin?: number } {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < HOUR);
  if (arr.length >= 10) return { ok: false, retryMin: Math.ceil((HOUR - (now - arr[0])) / 60000) };
  if (arr.filter((t) => now - t < 5 * 60 * 1000).length >= 3) return { ok: false, retryMin: 5 };
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) { // bounded memory
    for (const [k, v] of hits) if (v.every((t) => now - t >= HOUR)) hits.delete(k);
  }
  return { ok: true };
}

const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];

interface ParsedTrip {
  cities: { name: string; nights: number }[];
  start?: string | null;
  end?: string | null;
  pax?: number;
  profile?: 'standard' | 'family' | 'senior';
  month?: number;
}

/** Claude Haiku: free text → candidate trip structure. Candidates ONLY —
 *  every city name is validated against world_cities afterwards. */
async function parseAsk(text: string): Promise<ParsedTrip | null> {
  if (!enrichmentEnabled()) return null;
  try {
    const resp = await anthropic().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system:
        'You extract trip parameters from an Indian travel request. Reply with ONLY a JSON object, no prose: ' +
        '{"cities":[{"name":string,"nights":number}],"start":string|null,"end":string|null,' +
        '"pax":number|null,"profile":"standard"|"family"|"senior"|null,"month":1-12|null}. ' +
        'Rules: cities = real city/town names the traveller wants to visit, in the order mentioned; ' +
        'nights = your best reasonable split of their total days (default 1-2 per city); ' +
        'profile=senior if parents/elderly (age 60+) travel, family if children travel; ' +
        'month from any month or festival mentioned; pax = number of travellers. ' +
        'If the text names no real places, reply {"cities":[]}.',
      messages: [{ role: 'user', content: text.slice(0, 1000) }],
    });
    const raw = resp.content?.[0]?.type === 'text' ? resp.content[0].text : '';
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    if (!Array.isArray(j.cities)) return null;
    return {
      cities: j.cities
        .filter((c: any) => c && typeof c.name === 'string' && c.name.trim())
        .slice(0, 7)
        .map((c: any) => ({ name: c.name.trim(), nights: Math.min(Math.max(Number(c.nights) || 1, 0), 9) })),
      start: typeof j.start === 'string' ? j.start : null,
      end: typeof j.end === 'string' ? j.end : null,
      pax: Number.isFinite(Number(j.pax)) ? Math.min(Math.max(Number(j.pax), 1), 12) : undefined,
      profile: ['standard', 'family', 'senior'].includes(j.profile) ? j.profile : undefined,
      month: Number.isInteger(j.month) && j.month >= 1 && j.month <= 12 ? j.month : undefined,
    };
  } catch (e) {
    console.error('planner parseAsk failed:', e);
    return null;
  }
}

/** Keep only cities world_cities can resolve — the anti-hallucination gate. */
async function resolvable(names: string[]): Promise<Set<string>> {
  if (!names.length) return new Set();
  const rows = await prisma.$queryRaw<{ name: string }[]>`
    SELECT name FROM world_cities WHERE lower(name) = ANY(${names.map((n) => n.toLowerCase())})`;
  return new Set(rows.map((r) => r.name.toLowerCase()));
}

const OBJECTIVE_MAP: Record<string, string> = {
  FASTEST: 'TIME', CHEAPEST: 'COST', EASIEST: 'EASE', BALANCED: 'BALANCED',
  TIME: 'TIME', COST: 'COST', EASE: 'EASE',
};

const ASK_AGAIN =
  'Please tell us at least two places you want to visit, like "Delhi, Agra and Varanasi in November".';

export class PublicPlannerController {
  /** POST /planner/plan — anonymous, rate-limited, sanitized. */
  static async plan(req: Request, res: Response) {
    try {
      const ip = (String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.ip || 'unknown';
      const gate = allow(ip);
      if (!gate.ok) {
        return res.status(429).json({
          status: false,
          message: `You have built a few plans in a short time. Please try again in about ${gate.retryMin} minutes.`,
        });
      }

      const body = req.body || {};
      let cities: { name: string; nights: number }[] = Array.isArray(body.cities)
        ? body.cities
            .filter((c: any) => c && typeof c.name === 'string' && c.name.trim())
            .slice(0, 7)
            .map((c: any) => ({ name: c.name.trim(), nights: Math.min(Math.max(Number(c.nights) || 1, 0), 9) }))
        : [];
      let start = typeof body.start === 'string' ? body.start : null;
      let end = typeof body.end === 'string' ? body.end : null;
      let pax = Number.isFinite(Number(body.pax)) ? Math.min(Math.max(Number(body.pax), 1), 12) : 2;
      let profile = ['standard', 'family', 'senior'].includes(body.profile) ? body.profile : 'standard';
      let month = Number.isInteger(body.month) && body.month >= 1 && body.month <= 12 ? body.month : undefined;
      const request = typeof body.request === 'string' ? body.request.slice(0, 1000) : null;

      // Free-text ask → candidate structure (validated below)
      if (cities.length < 2 && request) {
        const parsed = await parseAsk(request);
        if (parsed) {
          if (parsed.cities.length) cities = parsed.cities;
          start = start || parsed.start || null;
          end = end || parsed.end || null;
          if (!Number.isFinite(Number(body.pax)) && parsed.pax) pax = parsed.pax;
          if (!['standard', 'family', 'senior'].includes(body.profile) && parsed.profile) profile = parsed.profile;
          if (month === undefined && parsed.month) month = parsed.month;
        }
      }

      // validation gate: only gazetteer-resolvable cities survive
      const ok = await resolvable(cities.map((c) => c.name));
      cities = cities.filter((c) => ok.has(c.name.toLowerCase()));
      const totalNights = cities.reduce((s, c) => s + c.nights, 0);
      if (cities.length < 2) return res.status(400).json({ status: false, message: ASK_AGAIN });
      if (totalNights > 21) return res.status(400).json({ status: false, message: 'That is a very long trip for one plan. Please keep it within 21 nights, or split it into two trips.' });
      if (start && !ok.has(start.toLowerCase())) start = null;
      if (end && !ok.has(end.toLowerCase())) end = null;

      // sanitized body for the SAME admin pipeline — planner on, enrichment
      // cache-first 'fast' (never deep), no pins/halts/custom coords
      const innerBody = {
        cities,
        start: start || cities[0].name,
        end: end || null,
        objective: OBJECTIVE_MAP[String(body.objective)] || 'BALANCED',
        pax, profile, month,
        overnightTrains: true,
        planner: true,
        enrich: 'fast',
        request,
      };

      // capture the admin controller's delivery instead of sending it
      let captured: { code: number; status: boolean; payload?: any; message?: string } | null = null;
      const fakeRes = {
        deliver(code: number, status: boolean, payload?: any, message?: string) {
          captured = { code, status, payload, message };
          return fakeRes;
        },
      } as unknown as Response;
      const fakeReq = { body: innerBody, headers: {}, ip } as unknown as Request;

      await RouteOptimizerController.optimize(fakeReq, fakeRes);

      if (!captured || !captured.status) {
        return res.status(captured?.code === 400 ? 400 : 500).json({
          status: false,
          message: captured?.message || 'We could not build your plan just now. Please try again in a minute.',
        });
      }

      const planner = captured.payload?.planner as PlannerPayload | undefined;
      if (!planner) {
        return res.status(500).json({ status: false, message: 'We could not build your plan just now. Please try again in a minute.' });
      }

      // THE PUBLIC GATE: only the scrubbed planner payload ever leaves.
      // plans[], enrichment PII, costBreakdown, warnings never reach the wire.
      return res.status(200).json({ status: true, payload: { planner: toPublicPayload(planner) } });
    } catch (e) {
      console.error('public planner failed:', e);
      return res.status(500).json({ status: false, message: 'We could not build your plan just now. Please try again in a minute.' });
    }
  }
}
