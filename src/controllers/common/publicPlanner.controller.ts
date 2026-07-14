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
import { verifyCity } from '@/services/route-optimizer/cityVerify';
import { inferGateway, type StartSource } from '@/services/route-optimizer/gateway';
import { resolveRegion, regionIsUsable, statesOf, stateNamesOf, type RegionMatch } from '@/services/route-optimizer/regions';
import { stayNodesInStates, stayNodesByNames, gatewaysFor, attractionsFor } from '@/services/route-optimizer/spineDb';
import { nodeTier, nodeVoice, type StayNode } from '@/services/route-optimizer/spine';
import { design, designAll, type Candidate, type DesignerBrief, type Proposal } from '@/services/route-optimizer/designer';
import { loadDesignerMemory } from '@/services/route-optimizer/designerMemoryDb';
import { foodFor } from '@/services/route-optimizer/foodDb';
import { foodNeedFromWords } from '@/services/route-optimizer/food';
import { coDesignedWith } from '@/services/route-optimizer/designerMemory';
import { intentFromRaw, compileContract, counterQuestions, buildEcho, nightsFromWords, type RawIntent, type TravellerIntent, type CounterQuestion, type EchoRow } from '@/services/route-optimizer/intent';
import prisma from '@/config/db';
import { savePlan, getPlan, markShared, buildDemandRow, recordDemand, isUuid } from '@/services/route-optimizer/planStore';

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

/**
 * US-601 — THE EAR. Claude Haiku: free text → candidate trip structure AND the
 * traveller's INTENT. Candidates ONLY: every city name is validated against
 * world_cities afterwards, and every QUOTE is checked against his own sentence by
 * intentFromRaw() — a quote the model composed rather than read can never become
 * "you said".
 *
 * The old schema asked for six fields (cities, nights, start, end, pax, profile,
 * month) and had nowhere to put purpose, comfort tier, refusals or interests. That is
 * why a man who asked for a luxury honeymoon with no trains was sold a nine-hour
 * overnight train. The slot now exists.
 */
/**
 * US-805 -- THE BRIEF, reduced to what the SELECTION turns on.
 *
 * The Sprint-7 parser already captured all of this and the region branch threw ALL of it
 * away. This is the wire. Where the parser failed entirely (`intent` is null) we fall back
 * to HIS OWN SENTENCE -- which is not an invention, it is a re-reading of what he wrote.
 */
function briefFrom(intent: TravellerIntent | null, request: string): DesignerBrief {
  const said = (re: RegExp) => re.test(request);
  const modes = intent?.modeStances ?? [];

  // "we would prefer trains wherever possible" -- and equally, "not too much money on flights".
  const railPreferred =
    modes.some((m) => m.mode === 'RAIL' && m.stance === 'prefer')
    || modes.some((m) => m.mode === 'AIR' && (m.stance === 'avoid' || m.stance === 'refuse'))
    || (said(/\btrains?\b/i) && said(/prefer|rather|wherever possible|instead of/i));

  // Romance is not in our Purpose enum unless it is a honeymoon -- but HE used the word,
  // and his word is the brief (Law 1).
  const romantic =
    intent?.purpose.value === 'honeymoon'
    || (intent?.interests ?? []).some((i) => /romanc|romantic/i.test(String(i.value)))
    || said(/romantic|romance|honeymoon/i);

  const comfortFirst =
    intent?.budgetStance.value === 'comfort_first'
    || intent?.budgetStance.value === 'money_no_object'
    || intent?.comfortTier.value === 'premium'
    || intent?.comfortTier.value === 'luxury';

  // HIS CEILING, AND HIS FLOOR IF HE GAVE ONE. (Founder, 2026-07-13: a maximum is not a
  // minimum.) `intent.nights` already holds the ceiling; the floor only exists when he
  // stated a range, so we read it back off his own sentence.
  const nights = intent?.nights.value;
  const stated = nightsFromWords(request);

  // US-806 — "we do not consume even eggs". The word EVEN is doing real work: he is
  // pre-empting the answer he has been given before, by people who thought an omelette was
  // vegetarian. He has met us before. We do not do it to him again.
  const food = foodNeedFromWords(request);

  return {
    nights: typeof nights === 'number' && nights > 0 ? Math.min(21, nights)
          : stated ? stated.maxNights : 6,
    minNights: stated?.minNights ?? null,
    railPreferred,
    romantic,
    comfortFirst,
    pace: intent?.pace.value ?? 'steady',
    foodNeed: food?.need ?? 'none',
    foodQuote: food?.quote ?? null,
  };
}

/**
 * US-805 -- THE DESIGNER, WIRED.
 *
 * US-800b stopped the region being a dead end, but it handed him a LIST: eight states and
 * twelve towns, choose one. A LIST IS NOT A DESIGNER. A seasoned consultant does not ask a
 * man to pick from a menu of towns he has never heard of. HE PROPOSES.
 *
 * Non-fatal by construction: if anything here fails he still gets the towns, exactly as he
 * did yesterday. A thinner answer, never a wrong one.
 */
async function proposeForRegion(
  nodes: StayNode[], intent: TravellerIntent | null, request: string,
): Promise<Proposal[]> {
  if (!nodes.length) return [];
  const memory = await loadDesignerMemory();

  // THE BORDER NEIGHBOUR (founder ruling). Our designers build Gangtok with Darjeeling, and
  // Darjeeling is West Bengal. A strict region filter would drop the very town our own
  // catalogue says belongs in the trip. So we go and fetch the neighbours our designers
  // themselves reached for -- BY NAME, and the twin guard in stayNodesByNames does the rest.
  const inRegion = new Set(nodes.map((n) => n.name.trim().toLowerCase()));
  const neighbourNames = new Set<string>();
  for (const n of nodes) {
    for (const p of coDesignedWith(memory, n.name)) {
      if (!inRegion.has(p.pairsWith.trim().toLowerCase())) neighbourNames.add(p.pairsWith);
    }
  }
  const neighbours = neighbourNames.size ? await stayNodesByNames([...neighbourNames]) : [];

  const all = [...nodes, ...neighbours];
  const ids = all.map((n) => n.id);
  const [gwMap, attractions, foodMap] = await Promise.all([
    gatewaysFor(ids), attractionsFor(ids), foodFor(ids),
  ]);

  // A zero here means WE HAVE NOT SURVEYED IT -- not that there is nothing to see. designer.ts
  // knows that and never reads a zero as an absence.
  const attrCount = new Map<string, number>();
  for (const a of attractions) {
    if (a.stayNodeId) attrCount.set(a.stayNodeId, (attrCount.get(a.stayNodeId) ?? 0) + 1);
  }

  const candidates: Candidate[] = all.map((n) => ({
    node: n,
    gateways: gwMap.get(n.id) ?? [],
    attractions: attrCount.get(n.id) ?? 0,
    outOfRegion: !inRegion.has(n.name.trim().toLowerCase()),
    // ABSENT means WE HAVE NOT CHECKED. food.ts says so out loud; it never guesses.
    food: foodMap.get(n.id) ?? null,
  }));

  return designAll(candidates, memory, briefFrom(intent, request));
}

async function parseIntent(text: string): Promise<{ trip: ParsedTrip; raw: RawIntent } | null> {
  if (!enrichmentEnabled()) return null;
  try {
    const resp = await anthropic().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 900,
      system:
        'You extract a trip brief from an Indian travel request. Reply with ONLY a JSON object, no prose: ' +
        '{"cities":[{"name":string,"nights":number}],"start":string|null,"end":string|null,' +
        '"pax":number|null,"profile":"standard"|"family"|"senior"|null,"month":1-12|null,' +
        '"purpose":"honeymoon"|"pilgrimage"|"family_holiday"|"heritage"|"leisure"|"adventure"|"wildlife"|"wellness"|"business"|null,' +
        '"comfortTier":"budget"|"standard"|"premium"|"luxury"|null,' +
        '"pace":"savour"|"steady"|"packed"|null,' +
        '"composition":"couple"|"family_kids"|"seniors"|"friends"|"solo"|null,' +
        '"interests":[string],' +
        '"modes":[{"mode":"road"|"rail"|"air"|"ferry","stance":"prefer"|"accept"|"avoid"|"refuse","qualifier":"any"|"long"|"overnight"|"night_arrival","strength":0-1}],' +
        '"quotes":{"purpose":string,"comfortTier":string,"party":string,"interests":string,"month":string,"nights":string,"mode_road":string,"mode_rail":string,"mode_air":string,"mode_ferry":string}}. ' +
        'Rules: cities = real city/town names the traveller wants to visit, in the order mentioned; ' +
        'nights = your best reasonable split of their total days (default 1-2 per city); ' +
        'profile=senior if parents/elderly (age 60+) travel, family if children travel; ' +
        'month from any month or festival mentioned; pax = number of travellers. ' +
        'modes: capture what he PREFERS and what he REFUSES. The qualifier matters: ' +
        '"no trains" is stance=refuse qualifier=any, but "no LONG road journeys" is ' +
        'stance=avoid qualifier=long (he refuses the ordeal, not the mode). ' +
        'quotes: for every field you fill from his words, copy the EXACT substring of his ' +
        'message that says it, character for character. Never paraphrase a quote and never ' +
        'invent one; omit the quote if he did not actually say it. ' +
        'If the text names no real places, reply {"cities":[]}.',
      messages: [{ role: 'user', content: text.slice(0, 1000) }],
    });
    const out = resp.content?.[0]?.type === 'text' ? resp.content[0].text : '';
    const m = out.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    if (!Array.isArray(j.cities)) return null;
    const trip: ParsedTrip = {
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
    return { trip, raw: { ...j, cities: trip.cities } as RawIntent };
  } catch (e) {
    console.error('planner parseIntent failed:', e);
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

/** The ONLY thing we truly cannot plan without: somewhere to go. Even then we ask a
 *  question, we do not scold. (One destination is enough — the origin is the second node.) */
const ASK_AGAIN =
  'Tell us at least one place you would like to visit, like "Tirthan Valley" or "Delhi and Agra", and we will build the rest.';

const ASK_START =
  'Almost there. Where will you be starting your journey from? Tell us your city, and we will plan it from there.';

/** What the plan is resting on — every fact, and whether HE gave it or WE assumed it.
 *  The confirm screen renders exactly this. Nothing is assumed silently, ever. */
export interface UnderstoodField {
  key: 'start' | 'destinations' | 'nights' | 'travellers' | 'month' | 'hotel';
  label: string;
  value: string;
  source: StartSource;      // 'you_said' | 'we_guessed' | 'we_need_it'
  why?: string;
}

export class PublicPlannerController {
  /** POST /planner/plan — anonymous, rate-limited, sanitized. */
  static async plan(req: Request, res: Response) {
    try {
      const ip = (String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.ip || 'unknown';

      // ⚠️ RATE LIMIT — SWITCHED OFF FOR DEVELOPMENT. Founder, 2026-07-13.
      //
      // It was firing on our OWN testing and, worse, its honest message ("try again in five
      // minutes") was being replaced by the frontend with "we could not build your plan" —
      // so an ordinary throttle looked like a crash.
      //
      // ⚠️⚠️ THIS MUST GO BACK ON BEFORE THE PLANNER IS PUBLIC. The endpoint is ANONYMOUS and
      // every call costs us a model parse and Google Directions requests. Without this gate a
      // single script can run up our bill all night.
      //
      // TO RESTORE: remove PLANNER_RATE_LIMIT=off from .env and `pm2 restart 0`. Nothing else.
      const rateLimitOn = process.env.PLANNER_RATE_LIMIT !== 'off';
      const gate = rateLimitOn ? allow(ip) : { ok: true as const, retryMin: 0 };
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

      // Where did each value actually come from? A value the model read out of his
      // sentence is an ASSUMPTION, not his word — and it must be labelled as one.
      const paxFromField = Number.isFinite(Number(body.pax));
      const monthFromField = Number.isInteger(body.month) && body.month >= 1 && body.month <= 12;
      let paxFromText = false, monthFromText = false;

      // Free-text ask → candidate structure + the traveller's INTENT (validated below).
      // `intent` is what the plan will be built to honour: his purpose, his comfort tier,
      // his refusals, his interests — each carrying the receipt that says whether HE said
      // it or WE worked it out. (US-601.)
      let intent: TravellerIntent | null = null;
      if (cities.length < 2 && request) {
        const heard = await parseIntent(request);
        const parsed = heard?.trip ?? null;
        if (heard) intent = intentFromRaw(heard.raw, request);
        if (parsed) {
          if (parsed.cities.length) cities = parsed.cities;
          start = start || parsed.start || null;
          end = end || parsed.end || null;
          // "I along with few friends" must never become 1 traveller. If the model
          // returns a single traveller while the text plainly speaks of a group, we
          // discard the model's number and fall back to our stated default — and we SAY
          // that we assumed it. A wrong number quietly presented as his word is the
          // worst of both worlds.
          const soundsLikeAGroup = /\b(friends?|family|we|us|our|group|couple|parents|kids|children|wife|husband)\b/i.test(request);
          if (!paxFromField && parsed.pax) {
            if (parsed.pax === 1 && soundsLikeAGroup) { /* keep the default of 2, and label it */ }
            else { pax = parsed.pax; paxFromText = true; }
          }
          if (!['standard', 'family', 'senior'].includes(body.profile) && parsed.profile) profile = parsed.profile;
          if (month === undefined && parsed.month) { month = parsed.month; monthFromText = true; }
        }
      }

      // ---- the starting city (founder ruling 2026-07-11) --------------------
      // He may have TYPED it ("from Mumbai"). Claude already pulls it out; until now
      // we threw it away. Keep it, verify it like any other place, and make it a real
      // node. If he did not say, we infer a gateway BELOW (after the destinations are
      // resolved and we know where he is actually going) — and we say that we did.
      const startWasStated = !!(start && String(start).trim());

      // validation gate: only real places survive. Unresolved names are NOT
      // silently dropped — each gets the full verify ladder (exact → fuzzy
      // spelling fix → AI existence check + registration). Only a name that
      // fails ALL gates is rejected, and then we SAY SO by name.
      const ok = await resolvable(cities.map((c) => c.name));
      const failed: string[] = [];
      let repairs = 0;
      for (const c of cities) {
        if (ok.has(c.name.toLowerCase())) continue;
        if (repairs >= 3) { failed.push(c.name); continue; } // bound the spend per request
        repairs += 1;
        const v = await verifyCity(c.name);
        if (v.ok && v.name) {
          if (start && start.toLowerCase() === c.name.toLowerCase()) start = v.name;
          if (end && end.toLowerCase() === c.name.toLowerCase()) end = v.name;
          c.name = v.name; // canonical spelling
          ok.add(v.name.toLowerCase());
        } else {
          failed.push(c.name);
        }
      }
      cities = cities.filter((c) => ok.has(c.name.toLowerCase()));
      if (failed.length) {
        return res.status(400).json({
          status: false,
          message: `We could not find ${failed.length === 1 ? 'this place' : 'these places'}: ${failed.join(', ')}. Please check the spelling, or use the nearest big town.`,
        });
      }
      const totalNights = cities.reduce((s, c) => s + c.nights, 0);
      // ---- US-800b — A REGION IS NOT A DEAD END --------------------------------------
      //
      // THE FAILURE THIS CLOSES, verified on production 2026-07-12. A traveller wrote:
      //
      //   "...a romantic comfortable trip somewhere in north east India ... we would
      //    prefer trains ... up to 10 days ... we are vegetarians and do not eat even eggs"
      //
      // and we answered: "Tell us at least one place you would like to visit."
      //
      // Everything he told us -- his age, romance, comfort, trains over flights, ten days,
      // three star, PURE VEGETARIAN -- was thrown away at a gate that sits IN FRONT of the
      // Sprint-7 brain. The brain never ran. The page had just promised him "your 30-year
      // tour designer is on the case", and then handed him a form error.
      //
      // THE MAN WHO SAYS "YOU ARE THE EXPERT, WHERE SHOULD WE GO?" IS THE ONE WHO MOST
      // NEEDS US, AND HE IS THE ONE WE TURNED AWAY.
      //
      // `regions.ts` has been built and tested (40/40) since this morning AND CONNECTED TO
      // NOTHING. This is the wire.
      //
      // THE GUARD (regions.regionIsUsable): a region may be acted on ONLY when he has given
      // us no place at all. If he named somewhere we could resolve, THAT IS THE BRIEF
      // (Law 1) -- and a region word elsewhere in his sentence ("a beach holiday, we love
      // South India") is colour, not an instruction to survey five states. This is what
      // keeps the shipped golden-honeymoon plan byte for byte as it is.
      const regionMatch: RegionMatch | null = resolveRegion(request);

      if (cities.length < 1 && regionIsUsable(regionMatch, cities.length)) {
        const m = regionMatch as RegionMatch;
        // THE TOWNS ARE REAL OR THERE ARE NONE. Every one of these is a StayNode we have
        // either SOLD or WRITTEN ABOUT, read from the spine, with its state named and its
        // tier declared. NOT ONE IS PROPOSED BY A MODEL. If the spine is empty for a
        // region, we say we have nothing there -- we do not fill the silence.
        let nodes: StayNode[] = [];
        try {
          nodes = await stayNodesInStates(statesOf(m));
        } catch (e) {
          console.error('stayNodesInStates failed (non-fatal):', e);
        }
        // Strongest first: a town our designers have sold outranks one we have only visited.
        nodes.sort((a, b) => (b.tourCount - a.tourCount) || a.name.localeCompare(b.name));
        const towns = nodes.slice(0, 12).map((n) => ({
          name: n.name,
          state: n.stateName,
          tier: nodeTier(n),
          // The traveller is ENTITLED to know which of the three is speaking: a town we have
          // sold forty times is a DIFFERENT PROMISE from one we have merely written about.
          // nodeVoice() carries the COUNT, because the count is the receipt.
          why: nodeVoice(n),
        }));

        // ---- US-805 -- WE PROPOSE. WE DO NOT HAND HIM A MENU. -------------------------
        //
        // The towns above are still there, and he may still overrule us with any of them.
        // But a consultant LEADS. He says "I would give you Guwahati, Shillong and Kaziranga",
        // and then he says exactly how sure he is, and exactly what he left out and why.
        // EVERY REAL TRIP IN THE REGION, strongest first — not one and a footnote.
        // (Founder, 2026-07-13.) The North East is TWO trips: Guwahati/Kaziranga/Shillong in
        // through GHY, and Gangtok/Darjeeling in through New Jalpaiguri. He chooses.
        let proposals: Proposal[] = [];
        try {
          proposals = await proposeForRegion(nodes, intent, request);
        } catch (e) {
          // He still gets the towns. A thinner answer, never a wrong one.
          console.error('designer failed (non-fatal):', e);
        }
        const proposal: Proposal | null = proposals[0] ?? null;
        const stopWords = proposal
          ? proposal.stops.map((s) => s.name).reduce((acc, n, i, a) =>
              i === 0 ? n : i === a.length - 1 ? `${acc} and ${n}` : `${acc}, ${n}`, '')
          : '';

        return res.status(200).json({
          status: false,          // not a plan yet — a question, and a real one
          need: 'destinations',
          region: {
            key: m.region.key,
            label: m.region.label,
            quote: m.quote,               // HIS words. We may only say "you said" if he did.
            states: stateNamesOf(m),      // never a code. He is a person, not a database.
          },
          towns,
          // US-811 — THE CHIPS. He is entitled to see what we heard, BEFORE we build on it,
          // and each chip must say whether HE said it, WE guessed it, or we still need it.
          // The echo has existed since Sprint 7 and the region branch never sent it. A
          // Designer that guesses in silence is worse than the dead end it replaced.
          echo: intent ? buildEcho(intent) : [],
          questions: intent ? counterQuestions(intent) : [],
          // THE PROPOSALS. Every stop carries its state, its tier, its night count and the
          // grade of the evidence behind it. Every rejection carries a HUMAN reason.
          // `proposal` is proposals[0] and is kept so nothing downstream breaks.
          proposal,
          proposals,
          // THE OPENING SENTENCE, AND NOTHING ELSE.
          //
          // It used to carry the food paragraph, the shortfall AND the signal voice inline —
          // all of which the page ALSO renders in their own places. So the traveller read the
          // same food warning twice, in one centred wall of text, and it looked like a machine
          // repeating itself. A consultant says a thing ONCE, in the right place.
          //
          // Each part now lives where it belongs: signalVoice under its own trip card, the
          // food warning in the food box, the shortfall in the shortfall box.
          message: proposal
            ? `You said ${m.quote}, and I have kept everything else you told me too. `
              + `With trains rather than flights, I would give you ${stopWords} — `
              + `${proposal.totalNights} nights of stay, well inside the `
              + `${briefFrom(intent, request).nights} you allowed, and the journey either side.`
              + (proposals.length > 1
                  ? ` And this is not the only way to do it. I have laid out `
                    + `${proposals.length} real circuits our designers have built. Look at them `
                    + 'side by side and tell me which one is yours.'
                  : '')
            : towns.length
            ? `${m.region.label} is ${stateNamesOf(m).length} states, and they are a long way `
              + 'apart. These are the towns we know there — tell me which of them appeals to '
              + 'you, or say "you choose", and I will build the rest of the trip around it.'
            : `You said ${m.quote}, and I have kept that. But I do not yet have towns I can `
              + 'stand behind in that region, and I will not invent them. Name one place you '
              + 'have in mind and I will build the trip around it.',
        });
      }

      // THE ONLY HARD FLOOR: somewhere to go. One place is enough — the starting city
      // is the second node. (Was: "at least two places", which dead-ended the single-
      // destination request, i.e. the commonest request in travel.)
      if (cities.length < 1) return res.status(400).json({ status: false, message: ASK_AGAIN });
      if (totalNights > 21) return res.status(400).json({ status: false, message: 'That is a very long trip for one plan. Please keep it within 21 nights, or split it into two trips.' });
      if (end && !ok.has(end.toLowerCase())) end = null;

      // ======================================================================
      // US-831 — WE DO NOT PLAN A TRIP FOR A MAN WHOSE FRONT DOOR WE CANNOT FIND.
      //
      // FOUNDER, 13 July 2026:
      //   "I THINK THE BASIC FLAW IS NOT ASKING FROM WHERE THE PERSON WISHES TO START HIS
      //    JOURNEY. ONCE WE KNOW WHERE HE WANTS TO START HIS JOURNEY AND THE THEME OF HIS
      //    JOURNEY -- OTHER THINGS START BECOMING CLEAR."
      //
      // Until this line existed, the engine's own echo panel said `origin -- we_need_it` and
      // THE ENGINE PLANNED ANYWAY. It called inferGateway(), which takes the CENTROID of the
      // places he wants to visit and calls that his home. For a South India pilgrimage the
      // centroid is in the deep south, so the plan began at RAMESWARAM -- a town with no
      // airport, which no traveller on earth can start a holiday from. The man lives in
      // LUCKNOW. Nothing in the request said otherwise, and nothing in the code asked.
      //
      // A GUESS AT THE ORIGIN IS NOT A WEAK FACT. IT IS A WRONG TRIP.
      // Every leg, every mode, every gateway, every rejection hangs off it. There is no honest
      // provisional available -- so we ask, and we wait, and we do not plan.
      //
      // The gateway inference is NOT deleted. It stays for the CRM, where an operator building
      // a package genuinely has no traveller to ask. It is simply no longer allowed to speak
      // for a real person who is standing right there.
      if (!startWasStated || !start) {
        const q = intent ? counterQuestions(intent) : [];
        return res.status(200).json({
          status: false,
          need: 'origin',
          echo: intent ? buildEcho(intent) : [],
          questions: q.length ? q : [{
            key: 'origin',
            risk: 1,
            text: 'Where does your journey start from? Tell us your city and we will plan from your door, not from somebody else\'s.',
          }],
          message: 'Before we plan anything, tell us the city you are starting from. It changes everything: which airport you can use, which train, and which of these places are even worth the journey. We would rather ask you once than send you a trip that begins in a town you cannot reach.',
        });
      }

      // ---- resolve the ORIGIN -----------------------------------------------
      // He said it. We verify it. (The `else` branch below is now unreachable from the public
      // planner and is kept only because the CRM shares this ladder.)
      let startSource: StartSource = 'we_guessed';
      let startWhy = '';

      if (start && !ok.has(start.toLowerCase())) {
        // he named a starting city we have not resolved yet — run the same ladder
        const v = await verifyCity(start);
        if (v.ok && v.name) { start = v.name; ok.add(v.name.toLowerCase()); }
        else start = null;
      }

      if (start && startWasStated) {
        startSource = 'you_said';
        startWhy = 'You told us where you are starting from';
      } else {
        // fetch the coordinates of the destinations so the gateway is inferred from
        // WHERE HE IS ACTUALLY GOING, not from a guess about who he is.
        // THIS QUERY HAD NO ORDER BY AT ALL. With two rows of the same name it took whichever
        // Postgres handed back first -- and it is the query that picks his STARTING CITY. Same
        // ladder as the engine now, catalogue first. (US-823)
        const destRows = await prisma.$queryRaw<{ name: string; latitude: number; longitude: number }[]>`
          SELECT DISTINCT ON (lower(w.name)) w.name, w.latitude, w.longitude
            FROM world_cities w
           WHERE lower(w.name) = ANY(${cities.map((c) => c.name.toLowerCase())})
           ORDER BY lower(w.name),
                    (w."countryCode" = 'IN') DESC,
                    (EXISTS (SELECT 1 FROM stay_nodes s
                              WHERE abs(s.lat - w.latitude) < 0.25
                                AND abs(s.lng - w.longitude) < 0.25
                                AND similarity(lower(s.name), lower(w.name)) > 0.45)) DESC,
                    (EXISTS (SELECT 1 FROM airport_cities a
                              WHERE abs(a.lat - w.latitude) < 0.8
                                AND abs(a.lng - w.longitude) < 0.8)) DESC,
                    w.population DESC NULLS LAST`;
        const byName = new Map(destRows.map((r) => [r.name.toLowerCase(), [Number(r.latitude), Number(r.longitude)] as [number, number]]));

        // US-823: and OUR OWN CATALOGUE overrides it, for the same reason it does in the
        // engine. This query chooses the city he STARTS from -- inferring that gateway from a
        // Chennai suburb because he said "Manali" is how a Himachal trip begins in Tamil Nadu.
        const catStart = await prisma.$queryRaw<{ asked: string; latitude: number; longitude: number }[]>`
          SELECT DISTINCT ON (q.n) q.n AS asked, s.lat AS latitude, s.lng AS longitude
            FROM unnest(${cities.map((c) => c.name.toLowerCase())}::text[]) AS q(n)
            JOIN stay_nodes s ON similarity(lower(s.name), q.n) > 0.6
           ORDER BY q.n, similarity(lower(s.name), q.n) DESC, s.tour_count DESC NULLS LAST`;
        for (const r of catStart) byName.set(String(r.asked).toLowerCase(), [Number(r.latitude), Number(r.longitude)]);
        const dests = cities
          .map((c) => ({ name: c.name, coord: byName.get(c.name.toLowerCase()) }))
          .filter((d): d is { name: string; coord: [number, number] } => !!d.coord);

        const gw = await inferGateway(dests);
        if (gw.city) {
          start = gw.city;
          startSource = 'we_guessed';
          startWhy = gw.why;
        } else {
          // we could not even work out a gateway — ASK. One question, not a wall.
          return res.status(400).json({ status: false, message: ASK_START, need: 'start' });
        }
      }

      // The origin is a NODE. If it is not already one of the places he sleeps in, add
      // it with ZERO nights — a gateway you pass through, not a place you stay.
      if (start && !cities.some((c) => c.name.toLowerCase() === start!.toLowerCase())) {
        cities = [{ name: start, nights: 0 }, ...cities];
      }

      // ---- THE BRIEF (US-604) ------------------------------------------------
      // His words, compiled. Until now this line said `overnightTrains: true` — welded ON,
      // for every traveller who ever used the planner, including the one who had just
      // written "no trains". The switch existed; the ear did not. It is his now.
      const contract = intent ? compileContract(intent) : undefined;

      // sanitized body for the SAME admin pipeline — planner on, enrichment
      // cache-first 'fast' (never deep), no pins/halts/custom coords
      // ---- THE FOUNDER'S LAW, 2026-07-13 -----------------------------------
      //
      //   "It started from Madurai and wanted to bring the traveller BACK to Madurai. That is
      //    not how it should be unless asked for. There was no need to bring the user back."
      //
      // `tripType` has never been sent by this controller, and the engine's default is
      //     body.tripType === 'oneway' ? 'oneway' : 'roundtrip'
      // -- so EVERY traveller who has ever used the public planner was silently sent home.
      // A 56-year-old pilgrim was driven 600 km back up the peninsula to the town he started
      // in, and the only reason was a default nobody had ever typed.
      //
      // THE TRIP DOES NOT HAVE TO COME BACK. Open-jaw is the CORRECT answer; the round trip is
      // the SPECIAL CASE. He asks for it by naming an end city -- and if that end city is the
      // one he started from, then and only then do we take him home.
      //
      // (The CRM desk keeps its own default: an operator pricing a package may need the return
      //  leg costed, and silently deleting it would mis-price live quotes. That default now
      //  applies ONLY to direct CRM calls, because this call site is explicit.)
      const askedToReturn = !!(end && start && end.trim().toLowerCase() === start.trim().toLowerCase());

      // ---- US-824: A GUESS MAY NOT BECOME A CONSTRAINT -----------------------
      //
      // `start` is forced on the sequencer as a fixed first node. That is RIGHT when he told us
      // where he begins, and right when the gateway is a city he must genuinely pass through to
      // reach his trip (fly into Bengaluru for Coorg and Goa -- he sleeps 0 nights there, it is
      // an entry point, and the path really does start at it).
      //
      // IT IS WRONG when we GUESSED a gateway and the guess happens to be one of the places he
      // is actually staying. Then our guess stops being a suggestion and becomes a hard corner
      // the whole route must bend around. That is how a South India pilgrimage came out as
      //     Madurai -> Kanyakumari -> Tirupati -> Rameswaram
      // running 600 km north and 600 km back south, because WE had decided he starts at Madurai.
      //
      // What he SAID is the brief (Law 1). What WE INFERRED is a suggestion. So: free the
      // endpoints and let the route take its natural shape, then arrive him at whichever city
      // it truly begins with.
      const startIsHisOwnStop = !!start && cities.some(
        (c) => c.name.toLowerCase() === start!.toLowerCase() && (c.nights ?? 0) > 0,
      );
      const forceStart = startWasStated || (!!start && !startIsHisOwnStop);

      const innerBody = {
        cities,
        start: forceStart ? (start || cities[0].name) : null,
        end: end || null,
        tripType: askedToReturn ? ('roundtrip' as const) : ('oneway' as const),
        objective: OBJECTIVE_MAP[String(body.objective)] || 'BALANCED',
        pax, profile, month,
        // no longer hardcoded: he decides, and where he said nothing we keep the old default.
        overnightTrains: contract ? !contract.filters.banOvernightRail : true,
        contract,
        // the psyche dial that was built, tested, and wired to nothing. Wired.
        tpp: contract?.tpp,
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

      // ---- WHAT WE UNDERSTOOD ------------------------------------------------
      // Every fact the plan rests on, and who supplied it. The confirm screen renders
      // this. An assumption we make is shown as an assumption — never as his word.
      const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const stops = cities.filter((c) => c.nights > 0).map((c) => c.name);
      const understanding: UnderstoodField[] = [
        {
          key: 'start', label: 'Starting from', value: start || '—',
          source: startSource, why: startWhy || undefined,
        },
        {
          key: 'destinations', label: 'Going to', value: stops.join(', ') || '—',
          source: 'you_said',
        },
        {
          key: 'nights', label: 'Nights', value: String(totalNights),
          source: request && !Array.isArray(body.cities) ? 'we_guessed' : 'you_said',
          why: request && !Array.isArray(body.cities) ? 'We split your days across the places you named' : undefined,
        },
        {
          key: 'travellers', label: 'Travellers', value: String(pax),
          source: paxFromField ? 'you_said' : 'we_guessed',
          why: paxFromField ? undefined
            : paxFromText ? 'We read this from your message — tap to correct it'
            : 'We assumed two of you — tap to change',
        },
        {
          key: 'month', label: 'Month', value: month ? MONTH_NAMES[month - 1] : '—',
          source: monthFromField ? 'you_said' : month ? 'we_guessed' : 'we_need_it',
          why: monthFromField ? undefined
            : month ? 'We read this from your message — tap to correct it'
            : 'Tell us the month and we will use the right trains and the right season',
        },
        {
          key: 'hotel', label: 'Hotels', value: '3 star',
          source: 'we_guessed',
          why: 'Our costs assume a 3 star hotel. The real cost varies with the hotel and category you choose.',
        },
      ];

      // ---- US-609: WHAT WE UNDERSTOOD, AND WHAT WE STILL NEED TO ASK ----------
      //
      // The echo panel is the standing third round of the conversation: the free sentence was
      // round one, the counter-questions are round two, and this panel — which he can correct
      // at any time — is round three.
      //
      // THE IRON RULE, and the UI cannot break it because the chip text is DERIVED from the
      // provenance enum, never hand-set: a value WE inferred may never render under a "you
      // said" chip. An inference presented as his word is the worst outcome available to us.
      //
      // The counter-questions are surfaced in the payload rather than blocking the plan: he
      // gets his itinerary AND the one question that would sharpen it. (Whether the UI asks
      // before it renders is a front-end decision; the payload carries everything it needs.)
      const echo: EchoRow[] = intent ? buildEcho(intent) : [];
      const questions: CounterQuestion[] = intent ? counterQuestions(intent) : [];

      // THE PUBLIC GATE: only the scrubbed planner payload ever leaves.
      // plans[], enrichment PII, costBreakdown, warnings never reach the wire.
      const publicPayload = toPublicPayload(planner);

      // ---- US-701: KEEP IT --------------------------------------------------
      // We store EXACTLY what we are about to send — the scrubbed payload, nothing
      // more. So the store can never leak what it was never given. The write is
      // non-fatal: if it fails he still gets his plan, he just cannot keep it.
      //
      // We save it even when he has told us NOTHING about himself. That is the
      // founder's law #1 ("no gate, no telephone number") taken seriously: the plan
      // is his the moment it exists, not the moment he pays for it with a phone
      // number. The link is what travels round the family WhatsApp group, and the
      // family is where the real customers are.
      const token = await savePlan({
        input: innerBody,
        payload: publicPayload,
        understanding,
      });

      // ---- US-506: even a stranger teaches us something ----------------------
      // FIREWALLED to the business. Where do people want to go, with whom, in which
      // month — and above all, WHAT COULD WE NOT GIVE THEM. This row is written for
      // every solve, and it is why an anonymous visitor is worth serving at all.
      void recordDemand(buildDemandRow({
        planId: token,
        request,
        cities,
        start: start || null,
        end: end || null,
        month,
        pax,
        profile,
        solved: !!publicPayload.plan,
        dropped: (planner.negotiation ?? []).flatMap((r: any) => Array.isArray(r?.dropCities) ? r.dropCities : []),
      }));

      return res.status(200).json({
        status: true,
        payload: { planner: publicPayload, understanding, echo, questions, token },
      });
    } catch (e) {
      console.error('public planner failed:', e);
      return res.status(500).json({ status: false, message: 'We could not build your plan just now. Please try again in a minute.' });
    }
  }

  /**
   * GET /planner/plan/:token — RE-OPEN a saved plan.
   *
   * READ-ONLY, DELIBERATELY. Anyone holding the link can READ the itinerary — that is
   * exactly what makes it travel round a family WhatsApp group, and it is founder law
   * #1. Nobody who merely holds the link can CHANGE it: a cousin who opens Papa's trip
   * must not be able to overwrite it, and since an anonymous plan has no owner we could
   * not prove the plan was his anyway. Someone who wants it different builds his own
   * plan, or (US-505) joins and says so in the family notes — which costs him a contact,
   * and that is the whole registration engine.
   *
   * It is a cheap DB read of the payload we already scrubbed and stored. No re-solve,
   * so a plan going round a family group costs us nothing, and it can never drift from
   * the plan he actually saw.
   */
  static async get(req: Request, res: Response) {
    try {
      const token = String(req.params.token || '');
      if (!isUuid(token)) {
        return res.status(404).json({ status: false, message: 'We could not find that plan. The link may be incomplete.' });
      }
      const stored = await getPlan(token);
      if (!stored) {
        return res.status(404).json({ status: false, message: 'We could not find that plan. The link may be old or incomplete.' });
      }
      return res.status(200).json({
        status: true,
        payload: {
          planner: stored.payload,
          understanding: stored.understanding ?? [],
          token: stored.id,
          title: stored.title,
          savedAt: stored.createdAt,
          readOnly: true,
        },
      });
    } catch (e) {
      console.error('public planner get failed:', e);
      return res.status(500).json({ status: false, message: 'We could not open that plan just now. Please try again in a minute.' });
    }
  }

  /** POST /planner/plan/:token/share — he copied the link. That is the moment the plan
   *  stopped being a browser tab he would have lost. Nothing is returned; it is a signal. */
  static async share(req: Request, res: Response) {
    const token = String(req.params.token || '');
    if (isUuid(token)) void markShared(token);
    return res.status(200).json({ status: true });
  }
}
