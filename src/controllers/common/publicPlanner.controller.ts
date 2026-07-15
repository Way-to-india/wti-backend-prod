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
import { stayNodesInStates, stayNodesByNames, stayNodesNear, gatewaysFor, attractionsFor } from '@/services/route-optimizer/spineDb';
import { nodeTier, nodeVoice, type StayNode } from '@/services/route-optimizer/spine';
import { design, designAll, type Candidate, type DesignerBrief, type Proposal } from '@/services/route-optimizer/designer';
import { loadDesignerMemory } from '@/services/route-optimizer/designerMemoryDb';
import { foodFor } from '@/services/route-optimizer/foodDb';
import { foodNeedFromWords, foodStatus, foodParagraph } from '@/services/route-optimizer/food';
import { coDesignedWith } from '@/services/route-optimizer/designerMemory';
import { intentFromRaw, compileContract, counterQuestions, buildEcho, nightsFromWords, chipsOf, cityWasNamed, frameFromText, heSaid, isStatedCityList, type RawIntent, type TravellerIntent, type CounterQuestion, type EchoRow } from '@/services/route-optimizer/intent';
import { deterministicParse, deterministicallyComplete, originFromText, type FieldFacts } from '@/services/route-optimizer/deterministicParse';
import { parseCacheKey, parseCacheHash, readStoredParse, bumpParseHit, writeStoredParse } from '@/services/route-optimizer/parseCacheDb';
import prisma from '@/config/db';
import { savePlan, getPlan, markShared, buildDemandRow, recordDemand, isUuid } from '@/services/route-optimizer/planStore';
import { mergeDuplicateCities } from '@/services/route-optimizer/optimize';
import { poolForChips, scopedDesignerMemory, originFactsFor, flightSectorExists, flightOneStopExists, airportsNear } from '@/services/route-optimizer/themePool';
import { gateProposals, buildShape, seasonBodyExitCheck, type EntryFact, type GateFacts } from '@/services/route-optimizer/proposalGates';
import { loadSeasonFacts, loadAccessFacts } from '@/services/route-optimizer/placeFactsDb';
import { resolveNamedCircuit, overlayTourDays } from '@/services/route-optimizer/namedCircuits';
import { circuitStays, circuitTourFacts, circuitItinerary } from '@/services/route-optimizer/namedCircuitsDb';
// SPRINT C1 — RUNG 2, the library (itinerary memory + faceted retrieval + proof objects).
import { retrieve, type QueryFacets } from '@/services/route-optimizer/library';
import { loadBranches, branchIdByTour, saveRetrievalProof } from '@/services/route-optimizer/libraryDb';
import { buildLibraryCards, proofSummary } from '@/services/route-optimizer/libraryCards';
import { loadElevations } from '@/services/route-optimizer/spineDb';
import { haversineKm } from '@/services/route-optimizer/geo';
import type { DesignerMemory } from '@/services/route-optimizer/designerMemory';

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
 * US-840 — the one personal sentence on each offer card. Easy English, second person,
 * built ONLY from things he actually gave us — a chip he pressed (or a purpose he wrote)
 * and a mode he preferred. Nothing here may assert a preference he never expressed.
 */
function whyForYou(chips: string[], intent: TravellerIntent | null): string {
  const parts: string[] = [];
  const CHIP_WHY: Record<string, string> = {
    'Pilgrimage': 'Temple towns, because you asked for a pilgrimage',
    'Beaches': 'Beach towns, because you asked for the sea',
    'Honeymoon & Romance': 'Quiet, romantic places, because this trip is for the two of you',
    'Culture & Festivals': 'Towns with living culture, because that is what you asked for',
    'Heritage & Forts': 'Forts and heritage towns, because that is what you asked for',
    'Hill Stations & Mountains': 'Hill towns, because you asked for the mountains',
    'Trekking & Adventure': 'Places built for adventure, because you asked for it',
    'Wildlife & Nature': 'Parks and wild country, because you asked for wildlife',
  };
  for (const c of chips) if (CHIP_WHY[c]) { parts.push(CHIP_WHY[c]); break; }
  const prefersAir = (intent?.modeStances ?? []).some((s) => s.mode === 'AIR' && s.stance === 'prefer');
  const prefersRail = (intent?.modeStances ?? []).some((s) => s.mode === 'RAIL' && s.stance === 'prefer');
  if (prefersAir) parts.push('and we will fly you wherever it truly helps, as you asked');
  else if (prefersRail) parts.push('and we will use trains wherever they serve you well, as you asked');
  if (!parts.length) return 'Chosen from journeys our own designers have built and sold.';
  return parts.join(', ') + '.';
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
  injectedMemory?: DesignerMemory,
): Promise<Proposal[]> {
  if (!nodes.length) return [];
  // US-840 — the memory may be THEME-SCOPED (see themePool.scopedDesignerMemory: the
  // unscoped memory sells the Golden Triangle as a pilgrimage). Absent = old behaviour.
  const memory = injectedMemory ?? await loadDesignerMemory();

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

// ---- THE PARSE CACHE (founder ruling, 15 July 2026: "we cannot endlessly spend money on
// AI tokens"). -------------------------------------------------------------------------------
//
// The pick flow re-sends the EXACT sentence the ask flow already paid to parse — and since
// `d74e655` every pick parses again, so one traveller choosing a journey was paying for the
// same Haiku call twice (three times if he re-picks). The sentence is the key: same words,
// same brief. In-memory, this process only (PM2 id 0 is a single process); 500 entries,
// 24-hour life, oldest evicted first. A cache entry is returned as a DEEP COPY, because the
// controller patches heard.raw in place (US-831b) and a shared object would let one
// traveller's patch bleed into the next identical sentence.
const PARSE_CACHE_MAX = 500;
const PARSE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const parseCache = new Map<string, { at: number; value: { trip: ParsedTrip; raw: RawIntent } | null }>();

/** US-868 — the Law-1 fence's teeth: which of his words are actually towns we know?
 *  The catalogue is the PRIMARY gazetteer (a name is not a key); Indian world_cities
 *  back it up so a non-catalogue town he named still forces the model to read it. */
async function catalogueTownsAmong(tokens: string[]): Promise<string[]> {
  if (!tokens.length) return [];
  try {
    const rows = await prisma.$queryRaw<{ name: string }[]>`
      SELECT name FROM stay_nodes WHERE lower(name) = ANY(${tokens})
      UNION
      SELECT name FROM world_cities WHERE lower(name) = ANY(${tokens}) AND "countryCode" = 'IN'`;
    return rows.map((r) => r.name);
  } catch (e) {
    // If the fence cannot be checked, the fence FAILS CLOSED: report a phantom hit so the
    // model still reads his sentence. A wasted parse is yesterday's price; a lost city is not.
    console.error('US-868 town scan failed (failing closed — model will run):', e);
    return ['__scan_failed__'];
  }
}

async function parseIntent(text: string, fields: FieldFacts): Promise<{ trip: ParsedTrip; raw: RawIntent } | null> {
  // ============================ US-868 — CODE FIRST, AI LAST ============================
  //
  // The deterministic readers run BEFORE the model, before either cache, before the
  // API-key check — they cost nothing and they cannot hallucinate. When they fill
  // ORIGIN + DURATION + (chips | stated cities | region | named circuit), Haiku is not
  // called at all, SUBJECT to two DB checks that cannot live in the pure module:
  //   1. THE TOWN SCAN (Law 1): if any word of his sentence is a town our catalogue or
  //      the Indian gazetteer knows — beyond his origin, his frame and his region words —
  //      then he may have NAMED A DESTINATION, and only the model reads those. It runs.
  //   2. THE ORIGIN VERIFY: a regex may propose; only the gazetteer confirms. If his
  //      text-read origin does not verify, the model gets its chance at the sentence.
  // Every deterministic he_said quote is a verbatim matched substring, so the standing
  // anti-fabrication lock (verifyQuote) blesses it unchanged.
  try {
    const det = deterministicParse(text);
    if (deterministicallyComplete(det, fields)) {
      // On the pick path his towns arrive as FIELDS (Law 1 already satisfied); prose
      // tokens need no scan there. On the ask path the scan is mandatory.
      const towns = fields.statedCities ? [] : await catalogueTownsAmong(det.townCandidates);
      let originOk = true;
      if (!fields.statedStart && det.origin) {
        const v = await verifyCity(det.origin.name);
        if (v.ok && v.name) det.raw.start = v.name;
        else originOk = false;
      }
      if (!towns.length && originOk) {
        const trip: ParsedTrip = {
          cities: [],                                   // code never invents destinations
          start: det.raw.start ?? null,
          end: det.raw.end ?? null,
          pax: det.raw.pax ?? undefined,
          profile: (det.raw.profile === 'senior' || det.raw.profile === 'family') ? det.raw.profile : undefined,
          month: det.raw.month ?? undefined,
        };
        return { trip, raw: det.raw };
      }
    }
  } catch (e) {
    console.error('US-868 deterministic parse failed (non-fatal — model path continues):', e);
  }
  // ======================================================================================

  if (!enrichmentEnabled()) return null;
  const cacheKey = parseCacheKey(text);
  const hit = parseCache.get(cacheKey);
  if (hit && Date.now() - hit.at < PARSE_CACHE_TTL_MS) {
    return hit.value == null ? null : structuredClone(hit.value);
  }
  const remember = (value: { trip: ParsedTrip; raw: RawIntent } | null) => {
    if (parseCache.size >= PARSE_CACHE_MAX) {
      const oldest = parseCache.keys().next().value;
      if (oldest !== undefined) parseCache.delete(oldest);
    }
    parseCache.set(cacheKey, { at: Date.now(), value: value == null ? null : structuredClone(value) });
    return value;
  };

  // ---- US-869 — THE PERMANENT CACHE (L2). One sentence is paid for once, EVER. --------
  // Read-through under the in-memory L1; a hit hydrates L1 so the pick that follows the
  // ask never even reaches the disk. The hit counter is fire-and-forget bookkeeping.
  const hash = parseCacheHash(cacheKey);
  const stored = await readStoredParse<{ trip: ParsedTrip; raw: RawIntent }>(hash);
  if (stored && stored.trip && Array.isArray(stored.trip.cities) && stored.raw) {
    bumpParseHit(hash);
    remember(stored);
    return structuredClone(stored);
  }

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
    // ONLY a successful parse is remembered. A failed or empty parse is NOT cached: a model
    // hiccup must retry on the next request, not become the sticky truth about a good
    // sentence for 24 hours (US-861 is exactly the class of variance we refuse to pin).
    // US-869: and a successful MODEL parse goes to the permanent cache too — paid once, EVER.
    const value = { trip, raw: { ...j, cities: trip.cities } as RawIntent };
    void writeStoredParse(hash, cacheKey, value);
    return remember(value);
  } catch (e) {
    console.error('planner parseIntent failed:', e);
    return null;
  }
}

/**
 * ⚠️ US-831b — THE ORIGIN IS TOO IMPORTANT TO LEAVE TO A MODEL IN A GOOD MOOD.
 *
 * A ten-traveller sweep on 14 July 2026 caught this the moment the origin gate went live. Haiku
 * read "We live in LUCKNOW", "Couple from HYDERABAD" and "starting from KOLKATA" perfectly --
 * and then MISSED, in three consecutive requests:
 *
 *     "Two of us from BENGALURU want a beach break in Goa."
 *     "I am a wildlife photographer from CHENNAI."
 *     "Four friends from PUNE, all in our twenties."
 *
 * The man SAID where he lives. We asked him again. That is not a consultant asking a good
 * question -- IT IS A CONSULTANT WHO WAS NOT LISTENING, which is the precise crime the echo
 * panel exists to prevent. And it is worse than the old bug it replaced: before, we guessed and
 * were wrong; now we interrogate a man who has already answered.
 *
 * SO WE READ IT OURSELVES, DETERMINISTICALLY, AND WE DO NOT INVENT IT. The regex only PROPOSES
 * a name; `verifyCity` must then find it in our own catalogue or the gazetteer, or it is thrown
 * away. A model may propose. Only the gazetteer may confirm. And `verifyQuote` still governs
 * whether it may be labelled `he_said` -- the phrase has to be literally present in his sentence.
 *
 * The model stays. This runs only when the model came back with nothing, and it never overrides
 * a start the traveller typed into the form.
 */
// US-868 — originFromText and its patterns moved to deterministicParse.ts, where every
// deterministic reader now lives in one testable place. Behaviour unchanged; imported above.

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
  key: 'start' | 'destinations' | 'nights' | 'travellers' | 'month' | 'hotel' | 'end';
  label: string;
  value: string;
  source: StartSource;      // 'you_said' | 'we_guessed' | 'we_need_it'
  why?: string;
}

/** For the he_said month quote when the month arrives as a FIELD (a pressed chip). */
const MONTH_WORDS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'] as const;

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
      // THE TESTER'S DOOR (founder, 2026-07-14, five minutes after the brake went on:
      // he was testing the page and the brake shut the door on HIM). A request carrying
      // the secret test key skips the rate limit; everyone else still meets the wall.
      // The key lives in .env (PLANNER_TEST_KEY) and in the tester's own browser
      // (localStorage 'wti_planner_test' — the page attaches it to the POST body).
      // Rotate the env value to revoke every tester at once. No key set = no door.
      const testKey = process.env.PLANNER_TEST_KEY || '';
      const isTester = !!testKey && typeof req.body?.testKey === 'string' && req.body.testKey === testKey;
      const gate = rateLimitOn && !isTester ? allow(ip) : { ok: true as const, retryMin: 0 };
      if (!gate.ok) {
        return res.status(429).json({
          status: false,
          message: `You have built a few plans in a short time. Please try again in about ${gate.retryMin} minutes.`,
        });
      }

      const body = req.body || {};
      // ---- US-857 — AN EMPTY LIST IS NOT A STATED LIST ---------------------------------
      //
      // The public page has ALWAYS sent `cities: []` alongside the free text (AskScreen:
      // `onSolve({ cities: [], … })`). Four guards below asked `!Array.isArray(body.cities)`
      // to mean "he did not supply structured cities" — and an empty array made every one
      // of them lie. So for every REAL page traveller: US-854 never removed the frame
      // (the Karnataka sentence shipped Delhi → Bangalore → Goa, the frame flown and the
      // heritage skipped — the exact plan the law was written to kill), US-853b never
      // removed his home, and the understanding panel called parsed towns "you said".
      // The 18-traveller sweep missed all of it because its curl bodies OMITTED the key —
      // the sweep tested with bodies the page never sends. A stated list is a list with
      // something in it.
      const statedCities = isStatedCityList(body.cities);
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
      // SPRINT B — the origin box and the nights stepper answer our questions with FIELDS.
      const startFromField = typeof body.start === 'string' && !!body.start.trim();
      const nightsFromField = Number.isInteger(body.nights) && body.nights >= 1 && body.nights <= 60
        ? Number(body.nights) : null;
      let paxFromText = false, monthFromText = false;

      // Free-text ask → candidate structure + the traveller's INTENT (validated below).
      // `intent` is what the plan will be built to honour: his purpose, his comfort tier,
      // his refusals, his interests — each carrying the receipt that says whether HE said
      // it or WE worked it out. (US-601.)
      let intent: TravellerIntent | null = null;
      // ---- THE PICK PATH DROPPED HIS BRIEF (found live, 15 Jul 2026). --------------------
      //
      // This guard read `cities.length < 2 && request` — so his sentence was parsed on the
      // FIRST ask and never again. The moment he picked a journey (the pick posts its stops
      // as cities[]), the whole brief died: no contract, no luxury tier, no "prefer
      // flights", no rail-ordeal gate. The card was built ON his words and the plan was
      // built WITHOUT them — which is exactly how the one-stop flight the card promised
      // lost, silently, to a 46-hour train. His sentence is the brief on EVERY path that
      // carries it. (The parsed CITIES still merge only when he stated none — Law 1: towns
      // he posted as fields outrank anything a model reads.)
      if (request) {
        // US-868 — the field facts ride into the parser: a fact he posted as a FIELD is
        // already his word, and the deterministic skip rule counts it as filled.
        const heard = await parseIntent(request, {
          statedCities,
          statedStart: startFromField,
          statedNights: nightsFromField != null,
        });
        const parsed = heard?.trip ?? null;
        if (heard) intent = intentFromRaw(heard.raw, request);
        if (parsed && cities.length < 2) {
          // US-845 — A DESTINATION THE MODEL CHOSE IS NOT A DESTINATION HE NAMED.
          // "A relaxed beach break" came back as cities:[Goa]; "the Char Dham yatra in
          // December" came back as the four temple towns — and the named-cities path then
          // BYPASSED every shortlist gate (days/origin/season/body). Seniors were sold a
          // December Char Dham with the temples shut. The source for "he wants to go there"
          // is HIS SENTENCE: a parsed city that does not occur in it (with a little give for
          // spelling) is dropped, and the gated theme/region shortlist answers instead.
          if (parsed.cities.length) {
            const named = parsed.cities.filter((c) => cityWasNamed(c.name, request));
            const invented = parsed.cities.filter((c) => !named.some((n) => n.name === c.name));
            if (invented.length) {
              console.warn('US-845 — model-proposed destinations dropped (not in his sentence):',
                invented.map((c) => c.name).join(', '));
            }
            cities = named;
          }
          // ---- US-870 — A DATE IS NOT A DOOR. -------------------------------------------
          // The Nau Devi group's live test, 15 Jul 2026: the model returned
          // `start: "20th November 2026"` — his ARRIVAL DATE — and because the string is
          // verbatim in his sentence, the anti-fabrication lock blessed it as he_said.
          // The origin looked answered, so the origin question was never asked, and the
          // whole plan hung off a fact that is not a place. A MODEL MAY PROPOSE; ONLY THE
          // GAZETTEER MAY CONFIRM — the same law every parsed CITY already obeys, applied
          // at last to the parsed START. Anything date-shaped dies before it costs a
          // verify call; anything the gazetteer cannot confirm is scrubbed from the raw
          // and the intent is recompiled, so the echo says `origin — we need it` instead
          // of quoting a calendar entry back at him.
          if (!start && parsed.start) {
            const cand = String(parsed.start).trim();
            const v = /\d/.test(cand) ? null : await verifyCity(cand);
            if (v?.ok && v.name) {
              start = v.name;
            } else {
              console.warn(`US-870 — model start "${cand}" is not a city our gazetteer knows; dropped.`);
              if (heard?.raw) {
                heard.raw.start = null;
                if (heard.raw.quotes) delete heard.raw.quotes.start;
                intent = intentFromRaw(heard.raw, request);
              }
            }
          }
          // US-831b — the model missed it. Read it ourselves. It still has to survive verifyCity
          // below, so nothing enters the plan that our own gazetteer cannot confirm.
          if (!start) {
            const guess = originFromText(request);
            if (guess) {
              const v = await verifyCity(guess.name);
              if (v.ok && v.name) {
                // Setting `start` is enough: `startWasStated` is derived from it below, and it
                // is TRUE, because HE SAID IT. We simply had not been listening.
                start = v.name;
                if (heard?.raw) {
                  heard.raw.start = v.name;
                  heard.raw.quotes = { ...(heard.raw.quotes ?? {}), start: guess.quote };
                  // US-845c — the echo must SHOW the origin we just read out of his own
                  // sentence. The intent was compiled before this patch, so the panel said
                  // `origin — we need it` while the plan quietly began at his city: one
                  // screen arguing with itself, again. Recompile from the patched raw.
                  intent = intentFromRaw(heard.raw, request);
                }
              }
            }
          }
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

      // ---- SPRINT B — AN ANSWER TYPED INTO THE BOX IS HIS WORD --------------------------
      //
      // The origin box and the nights stepper (FRONTEND-ADAPTATION-SPEC §1) answer our
      // counter-questions with FIELDS. The intent was compiled from his TEXT alone, so a
      // man who answered "Lucknow" was shown `origin — we need it` and asked for his city
      // AGAIN while the plan quietly began at Lucknow (live payload, 2026-07-14) — one
      // screen arguing with itself, the US-845c bug wearing its field-shaped hat. Worse:
      // an answered nights could never bind the days gate, because the gate rightly
      // trusts only a number HE gave — and he GAVE this one, in the box we drew for him.
      // An answer to our own question is his word. Patch it into the intent as he_said,
      // quoting what he typed. Fields merge OVER text — the standing doctrine.
      if (intent && (startFromField || nightsFromField || monthFromField)) {
        if (startFromField && start) {
          const v = await verifyCity(start.trim());
          if (v.ok && v.name) {
            start = v.name;
            intent = { ...intent, origin: heSaid(v.name, String(body.start).trim()) };
          }
        }
        if (nightsFromField) {
          intent = { ...intent, nights: heSaid(nightsFromField, `${nightsFromField} nights`) };
        }
        if (monthFromField && month) {
          intent = { ...intent, month: heSaid(month, MONTH_WORDS[month - 1]) };
        }
      }

      // ---- US-854 — THE FRAME IS NOT THE TRIP -------------------------------------------
      //
      // "The heritage cities of Karnataka starting from Bangalore… flying from Delhi…
      // fly back from Goa." THREE city names, ZERO destinations: entry gate, home, exit
      // gate. The live payload answered it with Delhi → Bangalore → Goa — the frame flown,
      // the heritage skipped. The frame is read deterministically from his own words,
      // verified against the gazetteer, and its cities leave the destination list — BUT
      // ONLY when a theme or a region exists to fill the middle. Otherwise nothing changes.
      const frame: { entry: string | null; entryQuote: string | null; exit: string | null; exitQuote: string | null } =
        { entry: null, entryQuote: null, exit: null, exitQuote: null };
      if (request && !statedCities) {
        const f = frameFromText(request);
        if (f.entry) {
          const v = await verifyCity(f.entry);
          if (v.ok && v.name) { frame.entry = v.name; frame.entryQuote = f.entryQuote; }
        }
        if (f.exit) {
          const v = await verifyCity(f.exit);
          if (v.ok && v.name) { frame.exit = v.name; frame.exitQuote = f.exitQuote; }
        }
        if (frame.exit && !end) end = frame.exit;
        const canFillMiddle = ((intent ? chipsOf(intent).length : 0) > 0 || !!resolveRegion(request));
        if (canFillMiddle && (frame.entry || frame.exit)) {
          const frameNames = new Set([frame.entry, frame.exit]
            .filter((s): s is string => !!s).map((s) => s.trim().toLowerCase()));
          const before = cities.length;
          cities = cities.filter((c) => !frameNames.has(c.name.trim().toLowerCase()));
          if (cities.length !== before) {
            console.warn('US-854 — frame cities removed from destinations (entry/exit gates, not stays):',
              [...frameNames].join(', '));
          }
        }
      }

      // ---- US-853b — HIS HOME IS NOT A DESTINATION -------------------------------------
      // "I want to do a van durga yatra with my mother, we are from Delhi" — the parser
      // put Delhi into cities because the word appears in his sentence, and the one thing
      // it appears AS is his front door. A start that came out of the same sentence is
      // removed from the destination list (unless he explicitly asked to end there, which
      // is the round-trip ask, handled below). With the false destination gone, the named
      // circuit and the theme shortlist can answer, as designed.
      if (request && !statedCities && start && cities.length) {
        const s = start.trim().toLowerCase();
        const askedToEndThere = !!(end && end.trim().toLowerCase() === s);
        if (!askedToEndThere) {
          const before = cities.length;
          cities = cities.filter((c) => c.name.trim().toLowerCase() !== s);
          if (cities.length !== before) {
            console.warn(`US-853b — "${start}" removed from destinations: it is his ORIGIN, read from the same sentence.`);
          }
        }
      }

      // ---- US-839 (input class) — A CITY NAMED TWICE IS ONE CITY -----------------------
      // T5 listed Delhi twice; the engine built two nodes with one name, the matrix and the
      // nights map tripped over each other, and an EMPTY plan shipped with easeScore 94.
      // A repeated name is merged and its nights are summed — the traveller asked for more
      // time there, not for the town to exist twice.
      cities = mergeDuplicateCities(cities);

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

      // ---- US-840 — A THEME WITH NO TOWN NAMED MUST STILL GET A TRIP -------------------
      //
      // THE BAR ITSELF GOT A 400. The founder's definition-of-done traveller — "a
      // comfortable pilgrimage… we would prefer flights… up to 8 days… luxury hotels" —
      // named a THEME, and the proposal machine fired only on a REGION word. The 504-row
      // founder-ticked theme index was queried by nothing. This is the wire: his chips
      // (pressed, or honestly mapped from his stated purpose — chipsOf) open the same
      // shortlist the region branch already knows how to serve. Law 1 stands untouched:
      // a named, resolvable city always wins, and this branch never sees it.
      const chips = intent ? chipsOf(intent) : [];
      // US-853 — A FAMOUS CIRCUIT NAMED IS A DESTINATION ANSWERED. "Nau Devi yatra" is not
      // a missing city; it is the most precise brief a pilgrim can give. The registry only
      // matches circuits OUR OWN CATALOGUE sells, and the towns and nights are read from
      // that tour at request time. A spelling VARIANT ("van durga") is a READING: the route
      // may be shown, but the reading is said out loud and he can correct it (founder rule).
      const circuitHit = cities.length < 1 ? resolveNamedCircuit(request) : null;

      // US-870 — THE ENTRY GATE IS A MEASURING POINT. The Nau Devi group told us where
      // they LAND ("arriving at Delhi Airport") and were about to be interrogated for an
      // origin anyway — or worse, planned from a date. When he declared an entry gate,
      // the journey is measured from THERE; his home city stays an open question on the
      // side, never a wall in front of the circuit he named.
      const measuredFrom: string | null = frame.entry ?? ((startWasStated && start) ? start : null);

      // US-872 — THE ENTRY GATE IS SPOKEN. The Nau Devi group said "arriving at Delhi
      // Airport" and the echo panel never mentioned Delhi — a man who reads his own
      // chips back and finds his landing gate missing concludes we were not listening.
      // His arrival rides the echo like every other fact, with his own words as the quote.
      const askEcho: EchoRow[] = intent ? buildEcho(intent) : [];
      if (frame.entry) {
        askEcho.push({
          key: 'entry', label: 'Arriving at', value: frame.entry,
          provenance: frame.entryQuote ? 'he_said' : 'we_inferred',
          ...(frame.entryQuote ? { quote: frame.entryQuote } : { why: 'read from your message' }),
        });
      }

      if (cities.length < 1 && (circuitHit || regionIsUsable(regionMatch, cities.length) || chips.length > 0)) {
        const m: RegionMatch | null = regionMatch;

        // ============================================================================
        // RUNG 2 — THE LIBRARY (Sprint C1). Before the single named-circuit card and the
        // theme shortlist, ask the itinerary memory: does a REAL journey we run answer
        // this brief? STAGE 0 alias (the famous circuit he named) → STAGE 1 hard facets
        // (region · season · duration) → STAGE 2.5 constraint-satisfaction scoring → the
        // existing serve-time gates (STAGE 4, inside buildLibraryCards). Every retrieval
        // stores a PROOF OBJECT. NO model, NO embedding anywhere in C1. When the library
        // is silent the request falls through to the pre-C1 circuit/theme code UNCHANGED.
        // The rung fires ONLY where the brief is a named circuit or a USABLE region — the
        // exact acceptance surface — so no shipped theme/region behaviour moves beneath it.
        if (circuitHit || regionIsUsable(regionMatch, cities.length)) {
          try {
            const saidNightsLib = (intent?.nights.provenance === 'he_said' ? intent.nights.value : null)
              ?? nightsFromWords(request ?? '')?.maxNights ?? null;
            const libProfile = (['standard', 'family', 'senior'].includes(profile) ? profile : 'standard') as 'standard' | 'family' | 'senior';
            const facets: QueryFacets = {
              chips,
              regionStates: m ? stateNamesOf(m) : null,
              regionKey: m ? m.region.key : null,
              measuredFrom,
              monthIndex0: month != null ? month - 1 : null,
              saidNights: saidNightsLib,
              profile: libProfile,
            };
            let aliasBranchId: string | null = null;
            const aliasQuote = circuitHit ? circuitHit.quote : null;
            if (circuitHit) aliasBranchId = await branchIdByTour(circuitHit.circuit.tourId);
            const branches = await loadBranches();
            const { offered: scored, proof } = retrieve(branches, facets, { aliasBranchId, aliasQuote });
            void saveRetrievalProof(request ?? '', proof, proof.served, proof.aliasHit);   // §10.3, fire-and-forget

            if (scored.length) {
              const { offered: cards, refused } = await buildLibraryCards({
                offered: scored, request: request ?? '', measuredFrom, end,
                month: month != null ? month : null, saidNights: saidNightsLib,
                profile: libProfile, pax,
              });
              if (cards.length) {
                const originQ: CounterQuestion = { key: 'origin', risk: 1,
                  text: 'Where does your journey start from? Tell us your city and we will plan from your door, not from somebody else\'s.' };
                const baseQs = intent ? counterQuestions(intent) : [];
                const questions = !measuredFrom
                  ? [originQ, ...baseQs.filter((q) => q.key !== 'origin')].slice(0, 2)
                  : baseQs;
                const lead = circuitHit
                  ? (circuitHit.confidence === 'variant'
                      ? `I read "${circuitHit.quote}" as ${circuitHit.circuit.label}. If you meant something else, tell me plainly and I will start again. `
                      : `You asked for ${circuitHit.circuit.label}. `)
                  : `From the journeys we run ourselves${m ? ` in ${m.region.label}` : ''}, here ${cards.length === 1 ? 'is one that fits' : `are ${cards.length} that fit`}. `;
                const askOrigin = !measuredFrom
                  ? ' Now tell me the city you are starting from, and I will fit the journey to your door — the right trains, the right flights, and honest days.'
                  : '';
                const proposals = cards.map((c) => ({ ...c.card, dayByDay: c.dayByDay }));
                return res.status(200).json({
                  status: false,
                  need: 'destinations',
                  library: { alias: proof.aliasHit, served: proof.served, reason: proof.reason },
                  proof: proofSummary(proof),
                  circuit: circuitHit
                    ? { key: circuitHit.circuit.key, label: circuitHit.circuit.label, quote: circuitHit.quote, confidence: circuitHit.confidence, tourId: circuitHit.circuit.tourId }
                    : null,
                  region: m ? { key: m.region.key, label: m.region.label } : null,
                  theme: chips.length ? { chips, quote: null } : null,
                  frame: (frame.entry || frame.exit || startWasStated)
                    ? { home: startWasStated ? start : null, entry: frame.entry, exit: frame.exit }
                    : null,
                  towns: [],
                  echo: askEcho,
                  questions,
                  proposal: proposals[0],
                  proposals,
                  refusedProposals: refused,
                  message: `${lead}${frame.entry ? `You land at ${frame.entry}, and the journey is planned from there. ` : ''}`
                    + cards.map((c) => `${c.label} (${c.card.totalNights} nights)`).join('; ') + '.'
                    + askOrigin,
                });
              }
            }
          } catch (e) {
            console.error('RUNG 2 library retrieval failed (non-fatal — falls through to circuit/theme):', e);
          }
        }
        // ============================================================================

        if (circuitHit) {
          try {
            const [stays, tour] = await Promise.all([
              circuitStays(circuitHit.circuit.tourId), circuitTourFacts(circuitHit.circuit.tourId),
            ]);
            if (stays.length && tour) {
              const lowc = (s: string) => s.trim().toLowerCase();
              const circuitP: Proposal = {
                stops: stays.map((st) => ({
                  name: st.name, state: st.stateName, nights: Math.max(1, st.nights),
                  nightsSource: 'catalogue_ai_parsed' as const,
                  nightsWhy: `taken from our own ${tour.title} itinerary`,
                  tier: 'designer_catalogue' as const,
                  why: `part of our own ${tour.title}`,
                  railheadNote: null, outOfRegion: false,
                  foodStatus: 'unknown' as const, foodNote: null,
                })),
                totalNights: stays.reduce((s, x) => s + Math.max(1, x.nights), 0),
                shortfall: null, foodParagraph: null, gateway: null,
                tier: 'designer_catalogue', signal: 'built_before',
                signalVoice: `This is our own ${tour.title} — a journey we run ourselves. `
                  + `${circuitHit.circuit.note}.`,
                cohesion: 0, rejected: [], alsoConsidered: [],
              };

              // The gates still stand — a named circuit is not above the season or the
              // body. But the DAYS gate binds only on a number HE gave: gating a sold
              // 10-night yatra on our own default of 6 would be a silent assumption.
              const saidNights = (intent?.nights.provenance === 'he_said' ? intent.nights.value : null)
                ?? nightsFromWords(request)?.maxNights ?? null;
              const coords = new Map(stays.map((s) => [lowc(s.name), [s.lat, s.lng] as [number, number]]));
              const elevations: Record<string, number> = {};
              for (const s of stays) if (s.elevationM != null) elevations[lowc(s.name)] = s.elevationM;
              const stayNames = stays.map((s) => s.name);
              const [seasons, access] = await Promise.all([loadSeasonFacts(stayNames), loadAccessFacts(stayNames)]);

              // Entry facts from HIS door — or from his declared ENTRY GATE (US-870).
              const entry = new Map<string, import('@/services/route-optimizer/proposalGates').EntryFact | null>();
              if (measuredFrom && stays[0]) {
                const origin = await originFactsFor(measuredFrom);
                if (origin) {
                  const first = stays[0];
                  let fact: import('@/services/route-optimizer/proposalGates').EntryFact = {
                    hours: (haversineKm(origin.coord, [first.lat, first.lng]) * 1.3) / 55,
                    how: 'ROAD', basis: 'estimated by road until we can prove a better way',
                  };
                  const oa = await airportsNear(origin.coord, 200, 3);
                  const aa = await airportsNear([first.lat, first.lng], 150, 3);
                  outer:
                  for (const o of oa) for (const a of aa) {
                    if (await flightSectorExists(o.city, a.city)) {
                      fact = { hours: 4.5 + a.km / 60, how: 'AIR', basis: `a scheduled ${o.city} → ${a.city} flight exists` };
                      break outer;
                    }
                  }
                  entry.set(lowc(first.name), fact);
                }
              }

              const gated = gateProposals([circuitP], {
                nightsCeiling: saidNights ?? 99,
                month: month ?? null,
                profile: (['standard', 'family', 'senior'].includes(profile) ? profile : 'standard') as any,
                coords, elevations, seasons, access, entry, originName: measuredFrom,
              }, { bodyEdits: false });

              const reading = circuitHit.confidence === 'variant'
                ? `I read "${circuitHit.quote}" as ${circuitHit.circuit.label}. If you meant something else, tell me plainly and I will start again. `
                : `You asked for ${circuitHit.circuit.label}. `;
              const askOrigin = !measuredFrom
                ? ' Now tell me the city you are starting from, and I will fit the journey to your door — the right trains, the right flights, and honest days.'
                : '';
              const originQ: CounterQuestion = {
                key: 'origin', risk: 1,
                text: 'Where does your journey start from? Tell us your city and we will plan from your door, not from somebody else\'s.',
              };
              const baseQs = intent ? counterQuestions(intent) : [];
              const questions = !measuredFrom
                ? [originQ, ...baseQs.filter((q) => q.key !== 'origin')].slice(0, 2)
                : baseQs;

              if (gated.offered.length) {
                const g = gated.offered[0];
                const stopWords = g.proposal.stops.map((s) => `${s.name} (${s.nights} night${s.nights > 1 ? 's' : ''})`).join(', ');
                // The ready-to-POST body for the pick (see the theme branch for why).
                const pick = {
                  request,
                  cities: g.proposal.stops.map((s) => ({ name: s.name, nights: s.nights })),
                  start: measuredFrom,
                  end: end ?? null,
                  ...(month ? { month } : {}),
                  pax, profile,
                };
                const shapedCircuit = {
                  ...g.proposal, gates: g.gates, gateNotes: g.gateNotes, whyForYou: null,
                  shape: buildShape(entry.get(lowc(stays[0].name)) ?? null, null), pick,
                };
                return res.status(200).json({
                  status: false,
                  need: 'destinations',
                  circuit: { key: circuitHit.circuit.key, label: circuitHit.circuit.label, quote: circuitHit.quote, confidence: circuitHit.confidence, tourId: circuitHit.circuit.tourId },
                  region: null, theme: chips.length ? { chips, quote: null } : null,
                  frame: (frame.entry || frame.exit || startWasStated)
                    ? { home: startWasStated ? start : null, entry: frame.entry, exit: frame.exit }
                    : null,
                  towns: [],
                  echo: askEcho,
                  questions,
                  proposal: shapedCircuit,
                  proposals: [shapedCircuit],
                  refusedProposals: [],
                  message: `${reading}${frame.entry ? `You land at ${frame.entry}, and the journey is planned from there. ` : ''}That is a journey we run ourselves — ${tour.title}, `
                    + `${g.proposal.totalNights} nights: ${stopWords}. ${circuitHit.circuit.note}.`
                    + (g.gateNotes.length ? ` ${g.gateNotes.join(' ')}` : '')
                    + askOrigin,
                });
              }
              // The circuit was refused — say WHY (December Char Dham dies HERE, by name).
              const r = gated.refused[0];
              return res.status(200).json({
                status: false,
                need: 'destinations',
                circuit: { key: circuitHit.circuit.key, label: circuitHit.circuit.label, quote: circuitHit.quote, confidence: circuitHit.confidence, tourId: circuitHit.circuit.tourId },
                region: null, theme: chips.length ? { chips, quote: null } : null,
                  frame: (frame.entry || frame.exit || startWasStated)
                    ? { home: startWasStated ? start : null, entry: frame.entry, exit: frame.exit }
                    : null,
                towns: [], echo: askEcho, questions,
                proposal: null, proposals: [],
                refusedProposals: [{ stops: r.proposal.stops.map((s) => s.name), gate: r.gate, reason: r.reason }],
                message: `${reading}${r.reason}`,
              });
            }
          } catch (e) {
            console.error('named circuit failed (non-fatal — falls through to the theme shortlist):', e);
          }
        }

        // FOUNDER, 13 July 2026: "once we know where he wants to START his journey and the
        // THEME of his journey — other things start becoming clear." The gates (days from
        // his door, honest reachability) cannot run without the origin, so the origin
        // question comes FIRST. We do not propose blind and re-propose later — that is two
        // different answers from one consultant.
        // US-870 — a declared ENTRY GATE answers this question's purpose: the gates can
        // measure from where he lands. His home stays a side question, not a wall.
        if (!measuredFrom) {
          const q0 = intent ? counterQuestions(intent) : [];
          return res.status(200).json({
            status: false,
            need: 'origin',
            echo: askEcho,
            questions: q0.length ? q0 : [{
              key: 'origin',
              risk: 1,
              text: 'Where does your journey start from? Tell us your city and we will plan from your door, not from somebody else\'s.',
            }],
            message: 'Before we suggest anywhere, tell us the city you are starting from. It decides which of these journeys your days can actually reach.',
          });
        }

        // THE TOWNS ARE REAL OR THERE ARE NONE. Every one is a StayNode we have SOLD or
        // WRITTEN ABOUT — the theme pool reads the founder-ticked intent_place index, the
        // region pool reads the spine. NOT ONE IS PROPOSED BY A MODEL. When he named BOTH
        // a theme and a region, the theme pool is fenced to the region's states.
        let nodes: StayNode[] = [];
        try {
          if (chips.length) nodes = await poolForChips(chips, m ? statesOf(m) : []);
          if (!nodes.length && m) nodes = await stayNodesInStates(statesOf(m));
          // US-853b, APPLIED TO THE POOL (found on the founder's live test, 15 Jul 2026):
          // Hyderabad rides the Heritage chip, so a Hyderabadi asking for heritage was
          // offered THREE HOTEL NIGHTS IN HIS OWN CITY — and the US-849 nearest-first sort
          // then put that card on top, because his home is zero hours from his door. His
          // home is not a destination; it leaves the pool before the designer ever sees it.
          const homeName = (frame.entry ?? start ?? '').trim().toLowerCase();
          if (homeName) nodes = nodes.filter((n) => n.name.trim().toLowerCase() !== homeName);
        } catch (e) {
          console.error('shortlist pool failed (non-fatal):', e);
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
        //
        // US-840: the memory is THEME-SCOPED where he gave a theme. Proven on production:
        // the unscoped memory pairs Delhi–Jaipur 41 times among Pilgrimage-chip towns — the
        // Golden Triangle wearing a tilak. tour_themes is the honest scope.
        let proposals: Proposal[] = [];
        try {
          const mem = chips.length ? (await scopedDesignerMemory(chips)).memory : undefined;
          proposals = await proposeForRegion(nodes, intent, request, mem);
        } catch (e) {
          // He still gets the towns. A thinner answer, never a wrong one.
          console.error('designer failed (non-fatal):', e);
        }

        // ---- US-840 — THE FOUR GATES: days, origin, season, body -----------------------
        // A circuit is not offerable because it is popular; it is offerable because HE can
        // do it. Every fact the gates read is loaded here and injected; the gates are pure.
        let offered: ReturnType<typeof gateProposals>['offered'] = proposals.map((p) => ({
          proposal: p, gates: { days: 'pass', origin: 'unknown', season: 'unknown', body: 'pass' }, gateNotes: [],
        }));
        let refusedProposals: { stops: string[]; gate: string; reason: string }[] = [];
        // US-851 — true when the offers came from the near-origin re-pool, so the opening
        // sentence says plainly that his first ask died and what these are instead.
        let repooledNearOrigin = false;
        const brief = briefFrom(intent, request);
        try {
          const nodeByName = new Map(nodes.map((n) => [n.name.trim().toLowerCase(), n] as const));
          const stopNames = [...new Set(proposals.flatMap((p) => p.stops.map((s) => s.name)))];
          // US-854 — when he declared an ENTRY gate ("starting from Bangalore"), the trip
          // is reached from THERE; his home city is where the flights come from, and it
          // must not be the yardstick for the origin gate.
          const gateOrigin = frame.entry ?? start;
          const [seasons, access, elevations, origin] = await Promise.all([
            loadSeasonFacts(stopNames), loadAccessFacts(stopNames),
            loadElevations(stopNames), originFactsFor(gateOrigin),
          ]);
          const coords = new Map(nodes.map((n) => [n.name.trim().toLowerCase(), [n.lat, n.lng] as [number, number]]));

          // Entry facts: EXISTENCE-checked, honestly estimated, per proposal anchor.
          const entry = new Map<string, EntryFact | null>();
          for (const p of proposals) {
            const anchor = p.stops[0]?.name;
            if (!anchor) continue;
            const key = anchor.trim().toLowerCase();
            const node = nodeByName.get(key);
            if (!node || !origin) { entry.set(key, null); continue; }
            const crow = haversineKm(origin.coord, [node.lat, node.lng]);
            let fact: EntryFact | null = null;
            // US-854b — A THREE-HOUR DRIVE IS A DRIVE. Bangalore → Mysore came back as
            // "fly Bangalore → Kannur", because any sector between any nearby airports
            // outranked the honest short road. When the road estimate is a comfortable
            // half-day or less, the road IS the entry (Law 2: the ordeal is the point,
            // not the mode) and we do not go looking for an aeroplane.
            const roadHours = (crow * 1.3) / 55;
            const shortDrive = roadHours <= 4.5;
            // A NAME IS NOT A KEY: airport_cities holds synonym rows (Bengaluru AND
            // Bangalore) and the sectors are keyed to one of them. Check the few nearest
            // airports on EACH side, direct first, then one change of plane.
            const originAirports = shortDrive ? [] : await airportsNear(origin.coord, 200, 3);
            const anchorAirports = originAirports.length ? await airportsNear([node.lat, node.lng], 150, 3) : [];
            outer:
            for (const oa of originAirports) {
              for (const aa of anchorAirports) {
                if (await flightSectorExists(oa.city, aa.city)) {
                  fact = { hours: 4.5 + aa.km / 60, how: 'AIR',
                    basis: `a scheduled ${oa.city} → ${aa.city} flight exists` };
                  break outer;
                }
              }
            }
            if (!fact) {
              outer2:
              for (const oa of originAirports) {
                for (const aa of anchorAirports) {
                  if (await flightOneStopExists(oa.city, aa.city)) {
                    fact = { hours: 7.5 + aa.km / 60, how: 'AIR',
                      basis: `${oa.city} → ${aa.city} is flyable with one change of plane` };
                    break outer2;
                  }
                }
              }
            }
            if (!fact) {
              fact = { hours: (crow * 1.3) / 55, how: 'ROAD',
                basis: 'estimated by road until we can prove a better way' };
            }
            entry.set(key, fact);
          }

          // The DAYS gate binds only on a number HE gave. brief.nights carries our default
          // of 6 when he said nothing — gating on our own default would be a silent
          // assumption doing a founder ruling's job.
          const saidNightsTheme = (intent?.nights.provenance === 'he_said' ? intent.nights.value : null)
            ?? nightsFromWords(request)?.maxNights ?? null;
          const facts: GateFacts = {
            nightsCeiling: saidNightsTheme ?? 99,
            month: month ?? null,
            profile: (['standard', 'family', 'senior'].includes(profile) ? profile : 'standard') as GateFacts['profile'],
            coords, elevations, seasons, access, entry,
            originName: gateOrigin,
          };
          let gated = gateProposals(proposals, facts);
          offered = gated.offered;
          refusedProposals = gated.refused.map((r) => ({
            stops: r.proposal.stops.map((s) => s.name), gate: r.gate, reason: r.reason,
          }));

          // ---- US-851 — A SHORTLIST THAT REFUSES EVERYTHING OFFERS NOTHING. ---------------
          //
          // T5 (Guwahati, backwaters, 4 days) got three honest refusals and ZERO alternatives.
          // A consultant who rules out Kerala from Guwahati-with-4-days immediately offers
          // what 4 days from Guwahati IS good for — Shillong and Kaziranga are IN the
          // catalogue, 100 km from his door. So on zero survivors we RE-POOL NEARER THE
          // ORIGIN: our own catalogue towns within an honest day's reach of him, the same
          // designer, the SAME gates (a re-pool that skipped the gates would be a second
          // door left open). The refusals stay in the payload — he reads why his first ask
          // died AND what his days are genuinely good for.
          if (!offered.length && gated.refused.length && origin) {
            try {
              const nearNodes = (await stayNodesNear(origin.coord, 350))
                .filter((n) => n.name.trim().toLowerCase() !== (gateOrigin ?? '').trim().toLowerCase());
              if (nearNodes.length >= 2) {
                const memNear = chips.length ? (await scopedDesignerMemory(chips)).memory : undefined;
                const nearProposals = await proposeForRegion(nearNodes, intent, request, memNear);
                for (const p of nearProposals) {
                  const anchor = p.stops[0]?.name;
                  if (!anchor) continue;
                  const key = anchor.trim().toLowerCase();
                  if (entry.has(key)) continue;
                  const node = nearNodes.find((n) => n.name.trim().toLowerCase() === key);
                  if (!node) { entry.set(key, null); continue; }
                  const crowKm = haversineKm(origin.coord, [node.lat, node.lng]);
                  entry.set(key, {
                    hours: (crowKm * 1.3) / 55, how: 'ROAD',
                    basis: `about ${Math.round(crowKm * 1.3)} km by road from ${gateOrigin ?? 'your city'} — near enough to drive`,
                  });
                }
                const gatedNear = gateProposals(nearProposals, facts);
                if (gatedNear.offered.length) {
                  offered = gatedNear.offered;
                  repooledNearOrigin = true;
                }
              }
            } catch (e) {
              console.error('US-851 re-pool failed (non-fatal — honest refusals still shown):', e);
            }
          }

          // ---- US-849 — EASE FROM HIS ENTRY ENTERS THE RANKING. ----------------------------
          //
          // Samastipur and Lucknow received the SAME three journeys, led by Delhi–Haridwar —
          // while Varanasi and Bodh Gaya sat beside Samastipur. The origin gates REFUSE the
          // unreachable; nothing REWARDED the near. The ruling order stands: gates first
          // (everything in `offered` already passed), the designers' hand (tier), then
          // ease-from-HIS-entry ascending. The entry facts were always computed; the sort
          // simply never read them.
          offered = offered.slice().sort((a, b) => {
            const tierRank = (g: typeof a) => (g.proposal.tier === 'designer_catalogue' ? 0 : 1);
            const hours = (g: typeof a) =>
              entry.get(g.proposal.stops[0]?.name.trim().toLowerCase() ?? '')?.hours ?? Number.POSITIVE_INFINITY;
            return (tierRank(a) - tierRank(b)) || (hours(a) - hours(b));
          });

          // The shape and the personal sentence ride on each offer.
          for (const g of offered as (typeof offered[number] & { shape?: unknown; whyForYou?: string })[]) {
            const anchorKey = g.proposal.stops[0]?.name.trim().toLowerCase() ?? '';
            (g as any).shape = buildShape(entry.get(anchorKey) ?? null, g.proposal.gateway);
            (g as any).whyForYou = whyForYou(chips, intent);
          }
        } catch (e) {
          console.error('proposal gates failed (non-fatal — ungated proposals still shown):', e);
        }

        // Flatten for the page: each offer is the Proposal the frontend already renders,
        // plus its gates, notes, shape and the personal sentence — AND the `pick` object:
        // the EXACT body the page POSTs back when he chooses this journey. The frame
        // (entry/exit), his month, his party all ride inside it, so the frontend cannot
        // lose the frame even by accident (US-855's carry problem, closed structurally).
        const shaped = (offered as (typeof offered[number] & { shape?: unknown; whyForYou?: string })[])
          .map((g) => ({
            ...g.proposal, gates: g.gates, gateNotes: g.gateNotes,
            shape: (g as any).shape ?? null, whyForYou: (g as any).whyForYou ?? null,
            pick: {
              request,
              cities: g.proposal.stops.map((s) => ({ name: s.name, nights: s.nights })),
              start: frame.entry ?? (startWasStated && start ? start : null),
              end: frame.exit ?? null,
              ...(month ? { month } : {}),
              pax, profile,
            },
          }));
        const proposal = (shaped[0] as Proposal | undefined) ?? null;
        const shapedProposals = shaped as unknown as Proposal[];
        const stopWords = proposal
          ? proposal.stops.map((s) => s.name).reduce((acc, n, i, a) =>
              i === 0 ? n : i === a.length - 1 ? `${acc} and ${n}` : `${acc}, ${n}`, '')
          : '';

        // What we may quote back: his region words, or his stated purpose. NEVER a phrase
        // he did not write — where he pressed chips instead, we name the chips as ours.
        const youSaid = m?.quote
          ?? (intent?.purpose.provenance === 'he_said' && intent.purpose.quote ? intent.purpose.quote : null);
        // THE MODE SENTENCE WAS A HARDCODED LIE-IN-WAITING: it always said "With trains
        // rather than flights" — written for the North-East rail traveller and shown to
        // everyone, including the man who asked to FLY. His brief decides the sentence now.
        const prefersAir = (intent?.modeStances ?? []).some((s) => s.mode === 'AIR' && s.stance === 'prefer');
        const modeWord = brief.railPreferred ? 'With trains rather than flights, '
          : prefersAir ? 'Flying wherever it truly helps, ' : '';

        return res.status(200).json({
          status: false,          // not a plan yet — a question, and a real one
          need: 'destinations',
          region: m ? {
            key: m.region.key,
            label: m.region.label,
            quote: m.quote,               // HIS words. We may only say "you said" if he did.
            states: stateNamesOf(m),      // never a code. He is a person, not a database.
          } : null,
          // US-840 — the theme block: which chips opened this shortlist, and his own words
          // for the reason he travels, when he gave us words.
          theme: chips.length ? { chips, quote: youSaid } : null,
          // US-854 — the FRAME he declared: entry gate, exit gate, home. The pick-flow and
          // the page must carry these into the final plan (start = entry, end = exit).
          frame: (frame.entry || frame.exit || startWasStated)
            ? { home: startWasStated ? start : null, entry: frame.entry, exit: frame.exit }
            : null,
          towns,
          // US-811 — THE CHIPS. He is entitled to see what we heard, BEFORE we build on it,
          // and each chip must say whether HE said it, WE guessed it, or we still need it.
          // The echo has existed since Sprint 7 and the region branch never sent it. A
          // Designer that guesses in silence is worse than the dead end it replaced.
          echo: askEcho,
          questions: intent ? counterQuestions(intent) : [],
          // THE PROPOSALS. Every stop carries its state, its tier, its night count and the
          // grade of the evidence behind it. Every rejection carries a HUMAN reason. Each
          // offer now also carries its GATE verdicts, its transport SHAPE (existence facts
          // only, declared provisional) and the personal sentence.
          // `proposal` is proposals[0] and is kept so nothing downstream breaks.
          proposal,
          proposals: shapedProposals,
          // US-840 — circuits we found and REFUSED, each with the gate that killed it and
          // the human reason. A consultant who found three answers and hid one is not being
          // straight; one who explains why December rules out the Char Dham is.
          refusedProposals,
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
            ? `${repooledNearOrigin
                ? `What you first asked for I could not honestly give you from ${frame.entry ?? start ?? 'your city'} in the days you have — the reasons are below, in plain words. But those days ARE genuinely good for something from your door, and this is it. `
                : ''}`
              + `${youSaid ? `You said ${youSaid}, and I have kept everything else you told me too. ` : ''}`
              + `${modeWord}I would give you ${stopWords} — `
              + `${proposal.totalNights} nights of stay`
              // "the N you allowed" may only be said when HE allowed it (Law 5's spirit).
              + (((intent?.nights.provenance === 'he_said' ? intent.nights.value : null) ?? nightsFromWords(request)?.maxNights)
                  ? `, well inside the ${(intent?.nights.provenance === 'he_said' ? intent.nights.value : null) ?? nightsFromWords(request)!.maxNights} you allowed,`
                  : ',')
              + ' and the journey either side.'
              + (shapedProposals.length > 1
                  ? ` And this is not the only way to do it. I have laid out `
                    + `${shapedProposals.length} real journeys. Look at them `
                    + 'side by side and tell me which one is yours.'
                  : '')
              + (frame.entry || frame.exit
                  ? ` The journey enters${frame.entry ? ` through ${frame.entry}` : ''}`
                    + `${frame.exit ? ` and leaves through ${frame.exit}` : ''}`
                    + `${startWasStated && start && start.toLowerCase() !== (frame.entry ?? '').toLowerCase() ? `, with the flights from ${start} either side` : ''}`
                    + ' — exactly as you asked.'
                  : '')
              + (refusedProposals.length
                  ? ` There ${refusedProposals.length === 1 ? 'is one journey' : 'are journeys'} I looked at and ruled out for you — the reasons are below, in plain words.`
                  : '')
            : refusedProposals.length
            ? 'I found real journeys for what you asked — and I have had to rule them out for you. '
              + refusedProposals.map((r) => r.reason).join(' ')
            : towns.length
            ? `${m ? m.region.label : 'That'} is a wide ask, and I would rather lead than hand you a menu. `
              + 'These are the towns we know — tell me which of them appeals to you, or say '
              + '"you choose", and I will build the rest of the trip around it.'
            : `${youSaid ? `You said ${youSaid}, and I have kept that. ` : ''}But I do not yet have towns I can `
              + 'stand behind for that, and I will not invent them. Name one place you '
              + 'have in mind and I will build the trip around it.',
        });
      }

      // THE ONLY HARD FLOOR: somewhere to go. One place is enough — the starting city
      // is the second node. (Was: "at least two places", which dead-ended the single-
      // destination request, i.e. the commonest request in travel.)
      if (cities.length < 1) return res.status(400).json({ status: false, message: ASK_AGAIN });
      if (totalNights > 21) return res.status(400).json({ status: false, message: 'That is a very long trip for one plan. Please keep it within 21 nights, or split it into two trips.' });
      // ---- US-858 — THE EXIT GATE IS DROPPED AT THE PICK. -------------------------------
      //
      // THE BUG, live, 14 July 2026: the Karnataka pick carried `end:"Goa"` — his own words,
      // "fly back from Goa" — and this line NULLED IT, because `ok` holds only the towns he
      // SLEEPS in and an exit gate is precisely a town he does not sleep in. The plan ended
      // at Mysore, 300 km from the airport he told us he flies home from, with no sentence
      // about it. "Never substitute in silence", broken at step 5 by a membership test.
      //
      // An exit gate is HIS WORD. It gets the same verify ladder as every other place; only
      // a name our gazetteer cannot confirm is dropped — and a drop is SPOKEN, never silent
      // (the understanding panel carries the sentence).
      let endDropped: string | null = null;
      if (end && !ok.has(end.toLowerCase())) {
        const vEnd = await verifyCity(end);
        if (vEnd.ok && vEnd.name) end = vEnd.name;
        else { endDropped = end; end = null; }
      }

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
      // US-858 — and the EXIT gate is a node too, for the same reason the origin is: the
      // engine can only end a path at a city it knows. Zero nights — a gateway he leaves
      // from, not a place he stays. (When end === start he asked to come home; tripType
      // handles that below and no extra node is needed.)
      if (end && (!start || end.toLowerCase() !== start.toLowerCase())
          && !cities.some((c) => c.name.toLowerCase() === end!.toLowerCase())) {
        cities = [...cities, { name: end, nights: 0 }];
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
        // US-821c — the tier must reach the HOTEL dimension, not only the party. The
        // enrichment layer already speaks 'standard'|'3'|'4'|'5'; his word picks which.
        hotelTier: intent?.comfortTier.value === 'luxury' ? '5'
                 : intent?.comfortTier.value === 'premium' ? '4'
                 : intent?.comfortTier.value === 'budget' ? 'standard'
                 : '3',
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

      // ---- US-872 — A ROUND TRIP THAT CANNOT COME HOME IS NOT A DEAD SCREEN. -----------
      //
      // The Nau Devi group asked to return to Delhi; the way home from Katra had lost
      // every honest service (dirty timetable rows died on the Iron Law), the solver
      // returned an EMPTY sequence, US-839 refused the hollow plan — and the traveller
      // got "we could not build your plan just now". A consultant does not hang up the
      // phone: he gives you the trip that IS honest and tells you plainly which leg he
      // could not stand behind. So on a failed solve that carried an exit gate, we try
      // ONCE more without the return leg — and if that succeeds, the drop is SPOKEN in
      // the plan's own notes, never silent (and US-864 names the airport for the way
      // home). His word is not overridden; it is answered out loud.
      let returnLegDropped: string | null = null;
      if ((!captured || !(captured as any).status) && innerBody.end) {
        const onewayBody = { ...innerBody, end: null, tripType: 'oneway' as const };
        await RouteOptimizerController.optimize(
          { body: onewayBody, headers: {}, ip } as unknown as Request, fakeRes);
        if (captured && (captured as any).status) {
          returnLegDropped = String(innerBody.end);
          end = null;   // the way-home note (US-864) now speaks on the last day
          console.warn(`US-872 — return leg to ${returnLegDropped} could not be honestly built; delivered one-way with the drop spoken.`);
        }
      }

      if (!captured || !captured.status) {
        // US-861(a) — the public controller must never surface an admin-desk sentence.
        // "Provide at least 2 cities." is written for an operator with a form, not for a
        // traveller who typed a paragraph. Map it to the honest ask.
        const adminDesk = /provide at least \d+ cit/i;
        const rawMessage = captured?.message || '';
        return res.status(captured?.code === 400 ? 400 : 500).json({
          status: false,
          message: adminDesk.test(rawMessage)
            ? ASK_AGAIN
            : rawMessage || 'We could not build your plan just now. Please try again in a minute.',
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
        // US-858 — the exit gate, honoured out loud (or its drop confessed, never silent).
        ...(end && (!start || end.toLowerCase() !== start.toLowerCase()) ? [{
          key: 'end' as const, label: 'Finishing at', value: end,
          source: 'you_said' as StartSource,
          why: 'You told us where your journey ends, and the route is planned to finish there.',
        }] : []),
        ...(endDropped ? [{
          key: 'end' as const, label: 'Finishing at', value: '—',
          source: 'we_need_it' as StartSource,
          why: `You asked to finish at ${endDropped}, but we could not find that place on our map. Tell us the nearest big town and we will plan the route to end there.`,
        }] : []),
        // A RECEIPT MAY NOT LIE (founder's live test, 15 Jul 2026): the row said
        // "7 nights (you said)" to a man who wrote "8-10 days". On a pick, the night split
        // comes from the journey he CHOSE — that is a different truth from his own words,
        // and the chip must say which one it is.
        (() => {
          const saidNights = intent?.nights.provenance === 'he_said' ? intent.nights.value : null;
          const youSaidIt = nightsFromField != null || saidNights != null;
          return {
            key: 'nights' as const, label: 'Nights', value: String(totalNights),
            source: (youSaidIt ? 'you_said' : 'we_guessed') as StartSource,
            why: nightsFromField != null ? undefined
              : saidNights != null && saidNights !== totalNights
                ? `You allowed ${saidNights}; the journey you picked uses ${totalNights} nights — a ceiling is not a target`
              : saidNights != null ? undefined
              : statedCities ? 'The night split comes from the journey you picked'
              : 'We split your days across the places you named',
          };
        })(),
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
        // ---- US-821c — HE SAID LUXURY AND WE STILL QUOTED HIM A 3-STAR -------------------
        //
        // This row was a CONSTANT. The echo panel beside it said `comfortTier = luxury
        // (he_said)` while this said `hotel = 3 star (we_guessed)` — two panels
        // contradicting each other ON THE SAME SCREEN. The tier reached the party and never
        // the hotel dimension. His word decides this row now; only where he said nothing do
        // we keep the old 3-star assumption, labelled as ours.
        (() => {
          const tier = intent?.comfortTier.value ?? null;
          const heSaidTier = intent?.comfortTier.provenance === 'he_said';
          const HOTEL_WORD: Record<string, string> = {
            luxury: '5 star (luxury)', premium: '4 star (premium)',
            standard: '3 star', budget: 'budget (2–3 star)',
          };
          return {
            key: 'hotel' as const, label: 'Hotels',
            value: tier ? HOTEL_WORD[tier] : '3 star',
            source: (tier ? (heSaidTier ? 'you_said' : 'we_guessed') : 'we_guessed') as StartSource,
            why: tier && heSaidTier
              ? `You told us "${intent!.comfortTier.quote ?? tier}", and the plan is costed for that.`
              : tier
              ? 'We read this from your message — tap to correct it.'
              : 'Our costs assume a 3 star hotel. The real cost varies with the hotel and category you choose.',
          };
        })(),
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

      // ---- US-850 — THE NAMED PATH GETS THE SAME SEASON AND BODY TRUTH. -----------------
      //
      // T12 asked for Amarnath in October and got a ROUTE — outside the yatra window,
      // because he NAMED the shrine and the named path bypassed the proposal gates by
      // design (his word is the brief; we may not delete his stop). The honest behaviour,
      // as ruled: place_seasons / place_access are consulted for EVERY STOP of EVERY
      // FINISHED PLAN, here at the exit. A CLOSURE becomes a consent-style sentence plus
      // the month question — never a silent delete, never a silent route. An ADVISORY
      // becomes a note he reads. The sentences ride contractNotes, which survive the
      // public gate precisely because the traveller is the person who must read them.
      try {
        const finalStops = cities.filter((c) => c.nights > 0).map((c) => c.name);
        const [exitSeasons, exitAccess] = await Promise.all([
          loadSeasonFacts(finalStops), loadAccessFacts(finalStops),
        ]);
        const exitWarnings = seasonBodyExitCheck(
          finalStops, month ?? null, profile, exitSeasons, exitAccess,
        );
        if (exitWarnings.length && planner.plan) {
          planner.plan.contractNotes = [
            ...(planner.plan.contractNotes ?? []),
            ...exitWarnings.map((w) => w.sentence),
          ];
          for (const w of exitWarnings) {
            if (w.kind === 'closure' && w.ask) {
              questions.push({ key: 'month', risk: 1, text: w.ask } as CounterQuestion);
            }
          }
        }
      } catch (e) {
        console.error('US-850 exit season/body check failed (non-fatal):', e);
      }

      // ---- US-863 — HIS FOOD AND HIS SAFARI DO NOT VANISH AT THE PICK. ------------------
      //
      // Founder's live test, 15 July 2026: "vegetarian north indian food" and "jungle
      // safari" appeared NOWHERE in the finished plan except inside his own stored
      // sentence. The proposal cards carry a food paragraph; the picked plan dropped it on
      // the floor. The whole food machine (needs, verified kitchens, the honest
      // I-have-not-checked paragraph) existed and the exit never called it. It is called
      // now, for every finished plan; same for the wildlife stop, which now says plainly
      // that the safari must be reserved. Facts only: towns we have not checked are named
      // as unchecked, and no safari timing is invented.
      try {
        if (planner.plan) {
          const finalStops2 = cities.filter((c) => c.nights > 0).map((c) => c.name);
          const need = foodNeedFromWords(request);
          if (need) {
            const stayRows = await stayNodesByNames(finalStops2);
            const facts = await foodFor(stayRows.map((n) => n.id));
            const towns = stayRows.map((n) => ({ name: n.name, status: foodStatus(facts.get(n.id), need.need) }));
            const para = foodParagraph(need.need, need.quote, towns);
            if (para) planner.plan.contractNotes = [...(planner.plan.contractNotes ?? []), para];
          }
          const chips2 = intent ? chipsOf(intent) : [];
          const wildChip = chips2.find((c) => /wildlife/i.test(c));
          if (wildChip) {
            const wildPool = await poolForChips([wildChip]);
            const wildNames = new Set(wildPool.map((n) => n.name.trim().toLowerCase()));
            const wildStops = finalStops2.filter((s) => wildNames.has(s.trim().toLowerCase()));
            if (wildStops.length) {
              const saidSafari = /safari/i.test(request ?? '');
              planner.plan.contractNotes = [
                ...(planner.plan.contractNotes ?? []),
                `${saidSafari ? 'You asked for jungle safaris' : 'You asked for wildlife'} — `
                + `${wildStops.join(' and ')} ${wildStops.length > 1 ? 'are the wildlife stops' : 'is the wildlife stop'} on this plan. Safari seats are `
                + 'limited and must be reserved ahead; we will confirm the exact safari timings '
                + 'and book your seats with the lodge before you pay anything.',
              ];
              // US-863b — THE SAFARI LIVES IN THE DAY HE READS, NOT ONLY IN A FOOTNOTE.
              // The founder's live test: a jungle-safari couple's Kanha days said "full
              // day" — not one word about the safari they came for. A free day at a
              // wildlife stop IS the safari day; the day line now says so, with the
              // booking truth attached. No timing is invented.
              const wildSet = new Set(wildStops.map((s) => s.trim().toLowerCase()));
              for (const day of planner.plan.days ?? []) {
                const cityName = String((day as any).city ?? '');
                if (wildSet.has(cityName.trim().toLowerCase()) && /full day$/i.test(String((day as any).activity ?? ''))) {
                  (day as any).activity = `${cityName} — jungle safari day (seats are limited and must be reserved ahead; we book them with your plan)`;
                }
              }
              // And his ADVENTURE word gets an honest answer, not silence: today the
              // safari IS the adventure we can stand behind on this route.
              const saidAdventure = (intent ? chipsOf(intent) : []).some((c) => /adventure|trekking/i.test(c));
              if (saidAdventure) {
                planner.plan.contractNotes = [
                  ...(planner.plan.contractNotes ?? []),
                  'You also said adventure. On this route the jungle safaris are the adventure we can stand behind. If you want more — trekking, rafting, camping — tell us and we will re-plan around an adventure-first route.',
                ];
              }
            }
          }
        }
      } catch (e) {
        console.error('US-863 food/safari exit note failed (non-fatal):', e);
      }

      // ---- US-871 — A SOLD CIRCUIT'S DAYS SPEAK ITS OWN ITINERARY. ----------------------
      //
      // The founder's Nau Devi test: the picked plan said "Chandigarh — full day" to a
      // pilgrim, while our own tour_itinerary knew it is the day of Mansa Devi at
      // Panchkula and the three shrines en route to Dharamshala. When his sentence names
      // a circuit WE SELL, the finished plan's days carry the tour's own words — matched
      // city by city, in order, applied only when the plan convincingly IS that tour.
      // Nothing is invented: every sentence is the published itinerary.
      try {
        // C1 generalises US-871: a picked LIBRARY branch carries its own tourId, so any
        // branch we run — not only the four named circuits — speaks its published day
        // text on the finished plan. The named-circuit path is preserved as the fallback.
        const circuitOnPlan = resolveNamedCircuit(request);
        const libraryTourId = typeof body.libraryTourId === 'string' && body.libraryTourId.trim()
          ? body.libraryTourId.trim() : null;
        const overlayTourId = libraryTourId ?? circuitOnPlan?.circuit.tourId ?? null;
        const overlayLabel = circuitOnPlan?.circuit.label ?? 'the journey we run';
        if (overlayTourId && planner.plan?.days?.length) {
          const itin = await circuitItinerary(overlayTourId);
          const matched = itin.length ? overlayTourDays(planner.plan.days as any[], itin) : 0;
          if (matched >= 2) {
            planner.plan.contractNotes = [
              ...(planner.plan.contractNotes ?? []),
              `The day-by-day details come from our own ${overlayLabel} itinerary — the same journey we run ourselves.`,
            ];
          }
        }
      } catch (e) {
        console.error('US-871 circuit-day overlay failed (non-fatal):', e);
      }

      // US-872 — the dropped return leg is CONFESSED in the plan he reads, first thing.
      if (returnLegDropped && planner.plan) {
        planner.plan.contractNotes = [
          `You asked us to plan the journey back to ${returnLegDropped}. We checked the real services for that return and could not stand behind any of them within this trip, so this plan ends at the last stop — the note on the final day names the nearest airport. Tell us, and we will arrange the journey home to ${returnLegDropped} separately, with verified services.`,
          ...(planner.plan.contractNotes ?? []),
        ];
      }

      // ---- US-864 — A TRIP MUST SAY HOW IT ENDS. -----------------------------------------
      //
      // The founder's Kabini plan simply STOPPED, five hours by road from the nearest real
      // airport, for a couple who prefer flights — and said nothing. When he gave us no
      // exit city, the last stop's way home is now spoken: the nearest airport with real
      // scheduled service, the honest road estimate to it, and the invitation to tell us
      // his home city (the return-city box on the page posts it as `end`, which US-858
      // already honours end-to-end).
      try {
        if (planner.plan && !end) {
          const seq = planner.plan.sequence ?? [];
          const last = seq[seq.length - 1];
          const stop = (planner.mapStops ?? []).find((s: any) => s?.name === last && s?.lat != null && s?.lng != null) as any;
          if (last && stop) {
            const aps = await airportsNear([Number(stop.lat), Number(stop.lng)], 160, 1);
            const nearEnough = aps.length && aps[0].km < 30;
            if (!nearEnough) {
              const note = aps.length
                ? `Your trip ends at ${last}. The nearest airport with scheduled flights is ${aps[0].city}, roughly ${Math.round(aps[0].km * 1.3)} km by road. Tell us the city you want to return to and we will plan the journey home — flight, train or road — as part of this trip.`
                : `Your trip ends at ${last}, which is not near an airport. Tell us the city you want to return to and we will plan the journey home — flight, train or road — as part of this trip.`;
              planner.plan.contractNotes = [...(planner.plan.contractNotes ?? []), note];
              // US-864b — and it is said ON THE LAST DAY, where his eyes actually are
              // (founder, mid-test: "leaves dead end at Kanha"). A footnote he must
              // scroll for is a sentence we half-said.
              const days2 = planner.plan.days ?? [];
              const lastDay = days2[days2.length - 1] as any;
              if (lastDay && String(lastDay.city ?? '').trim().toLowerCase() === last.trim().toLowerCase()) {
                lastDay.activity = `${String(lastDay.activity ?? '').replace(/\s*$/, '')} · ${note}`;
              }
            }
          }
        }
      } catch (e) {
        console.error('US-864 way-home note failed (non-fatal):', e);
      }

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
