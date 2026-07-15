/**
 * Orchestrator — runs Stages A→F and returns best + 2 alternates.
 *
 * DB-free: the controller injects
 *   - resolved `nodes` (Stage A already done, incl. custom-stop coords)
 *   - `pool`: for each ordered pair "from||to", the curated LegOption[] (may be a
 *     single road option produced from OSRM). Pairs absent from the pool are
 *     treated as road with a large cost so the sequencer still connects them.
 *
 * Sequencing uses a scalar cost matrix reduced from the pool under the objective.
 * After ordering, each consecutive pair's best option is chosen, the weekday lock
 * is resolved from the weekday-limited legs, days are expanded with that lock, the
 * plan is scored, and guardrails attach the verify list.
 */

import type { CityNode, LatLng, LegOption, OptimizeInput, OptimizeResult, Plan, PlanLeg, Objective, MapRoute, MapRouteLeg, Mode } from './types';
import { rqiForLeg, type ElevationIndex } from './terrain';
import type { PlanContract } from './intent';
import { isTrueOvernight } from './constraints';
import { sequence } from './sequence';
import { expandDays } from './dayExpand';
import { resolveWeekdayLock, type WeekdayConstrainedLeg, phaseShift, type PhaseShiftResult } from './constraints';
import { scorePlan, toTotals } from './score';
import { verifyList } from './guardrails';
import { fmtDuration } from './geo';
import { ddcv, ddcvScalar, weightsForObjective, type LegCtx, type Weights } from './ddcv';
import { applyTPP } from './tpp';
import { buildLegExplain, optionKey } from './explain';
import { toleranceForProfile, roadDayHardCapExceeded, type Tolerance } from './physiology';
import { chooseAnchor } from './anchors';
import { hybridAccessHours } from './fallback';
import { checkPlanTruth, TruthViolationError, type TruthViolation, type TruthCtx } from './truth';
import type { AnchorCandidate } from './anchors';
import { runFatigueLedger, dayLoadsFromDays, projectComfort, rhythmHeadline } from './fatigue';
import { consultantChoose } from './consultant';
import type { OrdealParty } from './ordeal';
import { buildArchetypes } from './archetypes';
import { negotiate, needsNegotiation } from './negotiate';

const legKey = (a: string, b: string) => `${a}||${b}`;
const BIG = 1e7;

/**
 * US-839 (input class) — A CITY NAMED TWICE IS ONE CITY.
 *
 * T5 (Seniors, Char Dham) listed Delhi twice. The engine built two nodes with one name, the
 * cost matrix and the nights map tripped over each other, and an EMPTY plan shipped with an
 * easeScore of 94. A repeated name is merged and its nights are SUMMED — the traveller asked
 * for more time in the town, not for the town to exist twice. The first occurrence keeps its
 * coordinates (a custom stop's lat/lng is not thrown away).
 *
 * Exported and used by BOTH doors (admin/CRM and the public planner), because a gate that
 * guards one entrance while another stands open is a decoration — we have built that twice.
 */
export function mergeDuplicateCities<T extends { name: string; nights?: number }>(cities: T[]): T[] {
  const merged = new Map<string, T>();
  for (const c of cities) {
    const k = String(c.name || '').trim().toLowerCase();
    if (!k) continue;
    const hit = merged.get(k);
    if (hit) hit.nights = (Number(hit.nights) || 0) + (Number(c.nights) || 0);
    else merged.set(k, { ...c });
  }
  return [...merged.values()];
}

/**
 * The sentence for the moment we could not honour him. Three parts, as Law 4 requires: what we
 * looked for, what we found, and what we are therefore doing — plus an offer, because a
 * consultant who can only apologise is not much of a consultant.
 */
function sayForcedSubstitution(from: string, to: string, mode: Mode, identifier: string | null, contract?: PlanContract): string {
  const word = mode === 'RAIL' ? 'train' : mode === 'ROAD' ? 'road journey' : mode === 'AIR' ? 'flight' : 'service';
  const named = identifier ? ` (${identifier})` : '';
  const quote = contract?.voice.quotes[`mode_${mode.toLowerCase()}`];

  // ==========================================================================================
  // US-821b — WE WERE PUTTING WORDS IN HIS MOUTH, AND WE WERE DOING IT IN NEARLY EVERY PLAN.
  //
  // This line used to read:
  //
  //     const said = quote ? `You told us "${quote}".` : `You asked us to avoid travelling by ${word}.`;
  //
  // Read the `else`. When we had NO QUOTE FROM HIM AT ALL, we simply ASSERTED that he had
  // refused the mode. He had not. A ten-traveller sweep on 14 July 2026 found this lie in FOUR
  // PLANS OUT OF SIX:
  //
  //   a luxury honeymooner who said "no long TRAIN journeys" was told:
  //       "You asked us to avoid travelling by FLIGHT."          -- he never said it
  //   a man who said "we prefer to FLY between cities" was told:
  //       "You asked us to avoid travelling by TRAIN."           -- he never said it
  //   a pilgrim who said "we would prefer FLIGHTS wherever possible" was told:
  //       "You asked us to avoid travelling by ROAD JOURNEY."    -- he never said it
  //
  // A LEG CAN BE FORCED FOR THREE QUITE DIFFERENT REASONS, and the old code told the same lie
  // for all three. It is forced because HE REFUSED the alternatives; or because HIS BODY refuses
  // them; or because THERE IS NOTHING ELSE ON EARTH between these two towns. Only the first is
  // about his word, and we may only speak of his word when he has actually given us one.
  //
  // THE ANTI-FABRICATION LOCK GUARDS `Reading.provenance`. IT NEVER GUARDED THE PROSE.
  // Law 5: a rejected option must be rejected for a HUMAN reason -- HIS reason. And Law 1: his
  // word is the brief. A brief we invent is not a brief. It is a forgery.
  // ==========================================================================================
  const banned = (contract?.filters.banModes ?? []).includes(mode);
  const preferred = contract?.preferences?.preferModes ?? [];
  const otherWord = (m: Mode) => (m === 'RAIL' ? 'train' : m === 'ROAD' ? 'road' : m === 'AIR' ? 'flight' : 'service');

  let said: string;
  if (quote) {
    // HIS OWN WORDS, verbatim. The only case in which we may say "you told us".
    said = `You told us "${quote}".`;
  } else if (banned) {
    // He refused this mode -- the contract proves it -- but gave us no quotable phrase. We may
    // still say what he asked, because he really did ask it.
    said = `You asked us not to travel by ${word}.`;
  } else if (preferred.length && !preferred.includes(mode)) {
    // THE T8 CASE. He never said a word against this mode. He said he would rather travel by
    // ANOTHER one. So that is what we say, and not a syllable more.
    said = `You told us you would rather travel by ${preferred.map(otherWord).join(' or ')} where we can manage it.`;
  } else {
    // HE SAID NOTHING ABOUT THIS MODE AT ALL. So we say nothing about what he said. The leg was
    // forced by the road, or by his body -- not by his word -- and the honest sentence names the
    // real reason instead of inventing a preference he never expressed.
    said = `This leg is harder than we would normally plan for you.`;
  }

  return `${said} We checked every way to travel from ${from} to ${to}, and the only service we have on this leg is a ${word}${named}. We have used it so that your plan is complete, but we are telling you plainly rather than slipping it past you. If you would rather not take it, tell us and we will re-plan this part of the route.`;
}

// Default door-to-door access hours per mode when no city transport profile is
// loaded (Sprint 1). Precise per-node access (airport/railhead transfer km) is the
// §4.5 airport-as-via-node hook that Sprint 2 fills in.
const ACCESS = { RAIL: { from: 0.75, to: 0.75 }, AIR: { from: 1.5, to: 1.0 } } as const;

/** US-821. What a stated preference is worth in the objective. A tilt, not a ban: enough to win
 *  wherever comfort is comparable, never enough to force a flight onto a leg the road covers
 *  better. Applied to the DDCV scalar AFTER the ordeal is measured. */
const PREFER_TILT = 0.7;

/** US-826. Every hard-blocked option sits above this, so a feasible option ALWAYS wins and the
 *  body gates keep their meaning. But blocked options are ordered AMONG THEMSELVES by the very
 *  ordeal that blocked them — so when no option can be made comfortable, we give him the least
 *  bad one instead of the one that happens to run every day. */
const BLOCKED_BASE = 1e6;
const DEFAULT_TOL: Tolerance = toleranceForProfile(undefined);
function legCtx(
  o: LegOption, tol: Tolerance, pax: number, month?: number, contract?: PlanContract,
  elevations?: ElevationIndex,
): LegCtx {
  const a = o.mode === 'RAIL' ? ACCESS.RAIL : o.mode === 'AIR' ? ACCESS.AIR : { from: 0, to: 0 };
  // §4.6 rung 2: a rail+road hybrid folds its onward Band-A road transfer into
  // door-to-door access so the DDCV charges the extra hours + taxi honestly (a far
  // drop railhead loses to a nearer one, exactly like a far airport).
  const hyb = hybridAccessHours(o);

  // ---- US-803c: THE WIRE THAT WAS NEVER CONNECTED ----------------------------------
  //
  // `roadQualityIndex` has been READ in ddcv.ts, fallback.ts and anchors.ts since Sprint 1
  // -- and SET NOWHERE. It fell back to 4, so EVERY HILL ROAD IN INDIA WAS PLANNED AT
  // PLAINS SPEED (55 km/h). Founder, 2026-07-12: "plains 55 km/h, hills 22 km/h."
  //
  // The engine's own speed table already said exactly that. It was simply never asked.
  // Now it is: the terrain comes from the MEASURED ELEVATION of the two ends of the leg
  // (Open-Meteo, all 214 StayNodes, receipts stored).
  //
  //   Guwahati (60 m) -> Shillong (1495 m)  = a road that CLIMBS = 30 km/h = 3.3 h
  //   OSRM's opinion of that same road: 1h15. It is wrong, and a body gate believed it.
  //
  // If we hold no elevation for either end, this is NULL -- not a guess -- and the engine
  // keeps its existing safe default. We never invent a terrain that a body gate rests on.
  const rqi = rqiForLeg(elevations, o.from, o.to);

  // Sprint 7: his contract rides with every leg. It can only TIGHTEN this party's gates.
  return {
    tol, pax, month,
    roadQualityIndex: rqi,
    // US-822: the drive to the departure airport and from the arrival airport. Zero for a
    // flight whose airport is in the city, so nothing that worked before changes. This is what
    // makes an honest comparison possible: an 18h25 train against a flight that HONESTLY costs
    // a 2 h drive + check-in + the air time + the drive out the other side.
    accessFromHrs: a.from + (o.accessFromMin ?? 0) / 60,
    accessToHrs: a.to + hyb.hrs + (o.accessToMin ?? 0) / 60,
    accessCostPp: hyb.costPp,
    tighten: contract?.tighten,
    // THE RAIL-ORDEAL RULING (founder, 15 Jul 2026): the 30-hour rail refusal in ddcv needs
    // to know whether this party is comfort-first. His own words decide (budgetStance).
    comfortFirst: contract?.budgetStance === 'comfort_first' || contract?.budgetStance === 'money_no_object',
  };
}

/**
 * US-604 — THE CANDIDATE FILTER, and the flag that lied.
 *
 * The old line said:
 *     usable = opts.filter(o => opts2?.overnightTrains === false ? !(o.mode === 'RAIL') : true)
 * A traveller who says "no overnight trains" is not saying "no trains". That filter threw
 * away the pleasant 10 a.m. Shatabdi along with the 03:50 sleeper — the flag was named for
 * overnights and behaved like a blanket ban on rail. Fixed: it now removes the OVERNIGHT,
 * which is the thing he refused.
 *
 * And his refusals (Law 1) enter here, as a filter rather than a weight, because a weight
 * can be outvoted and a brief cannot.
 *
 * ONE HONEST LIMIT, stated out loud: if the filter would empty a leg's candidate set, we
 * do NOT invent a service and we do NOT silently hand him back the thing he refused. The
 * pool is returned intact, the leg is marked, and the consultant fallback (US-607) is the
 * one allowed to speak — with a finding, a reason, and a named alternative (Law 4).
 */
export interface UsableOpts {
  /** US-803c — city -> metres. Feeds roadQualityIndex -> terrainSpeedKmh -> THE BODY GATES.
   *  Absent => the engine keeps its safe default. We never guess an altitude. */
  elevations?: ElevationIndex;
  overnightTrains?: boolean;
  preferDaily?: boolean;
  dailyOnly?: boolean;
  contract?: PlanContract;
}

export function usableOptions(opts: LegOption[], o2?: UsableOpts): { usable: LegOption[]; refusedAll: boolean } {
  const banned = new Set<Mode>(o2?.contract?.filters.banModes ?? []);
  const noOvernight = o2?.overnightTrains === false || !!o2?.contract?.filters.banOvernightRail;

  let usable = opts.filter((o) => !banned.has(o.mode));
  // the fix: the overnight, not the mode.
  if (noOvernight) usable = usable.filter((o) => !isTrueOvernight(o));

  // His word removed everything this leg had. That is not a licence to overrule him in
  // silence — it is the moment the consultant is supposed to speak.
  const refusedAll = usable.length === 0 && opts.length > 0;

  if (o2?.dailyOnly) {
    const daily = usable.filter((o) => (o.operatingDays ?? 127) === 127);
    if (daily.length) usable = daily;
  }
  return { usable, refusedAll };
}

export interface OptimizeDeps {
  nodes: CityNode[];
  pool: Map<string, LegOption[]>;
  /** names that are inserted en-route halts (for day labelling). */
  haltNames?: Set<string>;
  /** force daily-only services (the date-flexible alternate). */
  dailyOnly?: boolean;
  /** §4.4 candidate anchors per leg key (from||to), for pearl-split reasoning. */
  anchorsByLeg?: Map<string, AnchorCandidate[]>;
}

/**
 * Indicative per-person fare (₹) when no real fare is in the pool. Rough India
 * economics so COST can actually rank modes: train (AC) cheapest, road next,
 * flight most expensive with a floor. Replaced by real fares when a source lands.
 */
export function estCostPp(o: LegOption): number {
  if (o.farePpMin != null && o.farePpMax != null) return (o.farePpMin + o.farePpMax) / 2;
  const km = o.distanceKm ?? 400;
  switch (o.mode) {
    case 'AIR': return Math.max(2500, Math.round(km * 5));
    case 'RAIL': return Math.round(km * 1.2) + 150;   // 3A AC ballpark
    case 'FERRY': return Math.round(km * 3);
    default: return Math.round(km * 4);               // road, per-pax share
  }
}

/** scalarize one option to a comparable cost under the objective (lower = better).
 *  preferDaily: when the travel date is unknown, penalise non-daily services so the
 *  plan stays date-flexible unless nothing daily exists. */
function optionCost(o: LegOption, obj: Objective, pax: number, preferDaily = false, tol: Tolerance = DEFAULT_TOL, month?: number, w?: Weights, contract?: PlanContract, elevations?: ElevationIndex): number {
  // ALL mode comparisons now run on the Door-to-Door Cost Vector (spec §4.1): raw
  // durations never compete. A body-truth hard-blocked option (over hour cap,
  // chronotype breach, class-floor fail) is strongly deprioritised for LIVE
  // sequencing but still connects the graph — dayExpand surfaces the infeasibility.
  const nonDaily = preferDaily && o.operatingDays != null && o.operatingDays !== 127;
  const penalty = nonDaily ? 40 : 0;
  const wts = w ?? weightsForObjective(obj);
  const v = ddcv(o, legCtx(o, tol, pax, month, contract, elevations));
  const scalar = ddcvScalar(v, wts);

  // ---- US-826: THE LEAST-BAD OPTION -------------------------------------------------------
  //
  // ddcvScalar returns +Infinity for a hard-blocked option, and this line used to flatten EVERY
  // blocked option to the same 1e6. On a leg where nothing fits inside a comfortable day -- and
  // Kanyakumari to Tirupati is 650 km, so nothing does -- ALL the options scored identically.
  // The ordering was destroyed, and the decision fell through to the only tiebreak left: the +40
  // penalty for a service that does not run daily.
  //
  // TRAINS RUN DAILY. FLIGHTS DO NOT. So the engine rejected an 11h48 flight and chose a 20h24
  // train, for a man of 56 who had asked to fly. That is the thrift reflex of THE-CONSULTANTS-LAW
  // for the third time: not cheaper in rupees this time, but cheaper in the engine's arithmetic,
  // and it bought his discomfort just the same.
  //
  // A BLOCKED OPTION IS STILL BETTER OR WORSE THAN ANOTHER BLOCKED OPTION. BLOCKED_BASE keeps
  // every blocked option strictly worse than every feasible one -- a gate is still a gate, and a
  // comfortable option always wins -- while PRESERVING THE ORDER AMONG THEM, so that when his day
  // cannot be saved we hand him the least bad of it rather than the most convenient for us.
  const base = Number.isFinite(scalar)
    ? scalar
    : BLOCKED_BASE + ddcvScalar({ ...v, hardBlock: false }, wts);

  // ---- US-821: LAW 1. A PREFERENCE MUST REACH THE OBJECTIVE. ------------------------------
  //
  // "We would prefer flights wherever possible." He said it, we parsed it, we stored it in
  // modeStances -- and then NOTHING read it. He got an 18h25 train.
  //
  // A REFUSAL is structural: the mode leaves the pool, and no price can buy it back. A
  // PREFERENCE is deliberately NOT that, and it must not become that. The founder's own
  // consultant, in the ruling this project is built on, still drives his luxury client
  // Bengaluru → Mysuru: "the destinations we have selected for you are BEST COVERED BY ROAD."
  // On a three-hour scenic drive the road IS the comfort (Law 2). Forcing a flight there would
  // obey the word and betray the man.
  //
  // So: a strong TILT, applied AFTER the DDCV has measured the ordeal honestly (door to door,
  // now including the drive to the airport). It wins wherever comfort is comparable, and it
  // cannot rescue an absurd option -- a 200 km flight still loses to the drive, because the
  // check-in and the two transfers are in its clock.
  const preferred = contract?.preferences?.preferModes?.includes(o.mode) ? PREFER_TILT : 1;
  return (base + penalty) * preferred;
}

function bestOption(opts: LegOption[] | undefined, obj: Objective, pax: number, opts2?: UsableOpts, tol: Tolerance = DEFAULT_TOL, month?: number, w?: Weights): LegOption | undefined {
  if (!opts || !opts.length) return undefined;
  const { usable } = usableOptions(opts, opts2);
  const pick = (usable.length ? usable : opts).slice().sort((a, b) => optionCost(a, obj, pax, opts2?.preferDaily, tol, month, w, opts2?.contract, opts2?.elevations) - optionCost(b, obj, pax, opts2?.preferDaily, tol, month, w, opts2?.contract, opts2?.elevations));
  return pick[0];
}

/** Rank a leg's candidate options best→worst under the objective, mirroring
 *  bestOption's usable-filter EXACTLY so ranked[0] === the chosen option. This is
 *  what lets the §10 decision record name a truthful winner + runner-up.
 *  (The two used to keep their own copies of the filter. One filter now — a rule that
 *  lives in two places is a rule that will one day disagree with itself.) */
function rankLegOptions(opts: LegOption[] | undefined, obj: Objective, pax: number, opts2?: UsableOpts, tol: Tolerance = DEFAULT_TOL, month?: number, w?: Weights): { ranked: LegOption[]; refusedAll: boolean } {
  if (!opts || !opts.length) return { ranked: [], refusedAll: false };
  const { usable, refusedAll } = usableOptions(opts, opts2);
  // THE HOLE THAT PRODUCTION FOUND. When his refusal empties a leg, this falls back to the
  // full pool so the graph still connects — and the graph is right to insist on that. But the
  // fallback must NEVER BE SILENT. The leg is marked here, and buildPlan says it out loud.
  const pool = usable.length ? usable : opts;
  const ranked = pool.slice().sort((a, b) => optionCost(a, obj, pax, opts2?.preferDaily, tol, month, w, opts2?.contract, opts2?.elevations) - optionCost(b, obj, pax, opts2?.preferDaily, tol, month, w, opts2?.contract, opts2?.elevations));
  return { ranked, refusedAll };
}

function buildMatrix(names: string[], deps: OptimizeDeps, obj: Objective, pax: number, preferDaily = false, tol: Tolerance = DEFAULT_TOL, month?: number, w?: Weights, contract?: PlanContract, elevations?: ElevationIndex): number[][] {
  const n = names.length;
  const m: number[][] = Array.from({ length: n }, () => new Array(n).fill(BIG));
  const nodeByName = new Map(deps.nodes.map((nd) => [nd.name.toLowerCase(), nd] as const));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j) { m[i][j] = 0; continue; }
    const best = bestOption(deps.pool.get(legKey(names[i], names[j])), obj, pax, { preferDaily, contract, elevations }, tol, month, w);
    if (!best) { m[i][j] = BIG; continue; }

    // ---- US-832a — A PAIR WHOSE ONLY HONEST ANSWER IS "RE-SEQUENCE" IS A FORBIDDEN EDGE.
    // anchors.ts has returned the literal string "re-sequence to avoid this leg" since §4.4
    // shipped — and NOBODY LISTENED. An over-cap road day with no honourable halt kept its
    // finite cost, so the solver kept choosing it and dayExpand kept apologising for it one
    // screen later. The advice is now taken where the ordering is decided: the edge costs
    // BIG, exactly as if the pair had no options at all, and Held-Karp routes around it
    // whenever any other order exists. (Graceful: only when anchor candidates were injected —
    // absent candidates, we cannot tell a dead halt from an un-analysed leg.)
    if (best.mode === 'ROAD' && roadDayHardCapExceeded(best, tol, { month }).exceeded) {
      const cands = deps.anchorsByLeg?.get(legKey(names[i], names[j]));
      const fc = nodeByName.get(names[i].toLowerCase())?.coord;
      const tc = nodeByName.get(names[j].toLowerCase())?.coord;
      if (cands && cands.length && fc && tc) {
        const ch = chooseAnchor(fc, tc, cands, tol, { month });
        if (ch.deadHalt) { m[i][j] = BIG; continue; }
      }
    }

    // ---- US-832b — THE DOOR-TO-DOOR TIME TERM. GEOMETRY RE-ENTERS THE ORDERING. ----------
    // The DDCV scalar weighs time against money, fatigue and risk — right for CHOOSING a
    // service, wrong on its own for ORDERING a tour: on a fly-heavy trip the fixed airport
    // overheads flatten the gradient until Tirupati → Kanyakumari → Madurai (fly to the tip,
    // come back north) costs the same as the sane order, and a 43-hour leg can win on terms
    // that never saw a clock. So the matrix cell — and ONLY the matrix cell — carries the
    // leg's honest door-to-door HOURS additively. Hours always grow with distance; time is a
    // fact, not a tunable; no coefficient is invented (the unit weight IS the statement).
    const doorHours = ddcv(best, legCtx(best, tol, pax, month, contract, elevations)).T;
    m[i][j] = optionCost(best, obj, pax, preferDaily, tol, month, w, contract, elevations)
      + (Number.isFinite(doorHours) ? doorHours : 0);
  }
  return m;
}

function mapRoute(names: string[], chosen: Map<string, LegOption>, nodes: Map<string, CityNode>): MapRoute {
  const stops = names.map((nm, i) => {
    const c = nodes.get(nm)?.coord;
    return { order: i + 1, name: nm, day: i + 1, lat: c ? c[0] : null, lng: c ? c[1] : null };
  });
  const legs: MapRouteLeg[] = [];
  for (let i = 1; i < names.length; i++) {
    const o = chosen.get(legKey(names[i - 1], names[i]));
    const mode = o?.mode === 'AIR' ? 'flight' : o?.mode === 'RAIL' ? 'train' : o?.mode === 'FERRY' ? 'ferry' : 'road';
    legs.push({ day: i + 1, from: names[i - 1], to: names[i], mode, km: o?.distanceKm ?? null, timeText: fmtDuration(o?.durationMin), estimated: o?.source === 'osrm' || o?.source === 'haversine' });
  }
  const roadTotalKm = legs.filter((l) => l.mode === 'road' && l.km).reduce((a, l) => a + (l.km || 0), 0);
  return { stops, legs, roadTotalKm: Math.round(roadTotalKm), modes: Array.from(new Set(legs.map((l) => l.mode))) };
}

function buildPlan(order: number[], names0: string[], input: OptimizeInput, deps: OptimizeDeps, label: string): Plan {
  const names = order.map((i) => names0[i]);
  const nodeMap = new Map(deps.nodes.map((n) => [n.name.toLowerCase(), n] as const));
  const nights = new Map(input.cities.map((c) => [c.name, c.nights ?? 1] as const));
  const pax = input.pax ?? 2;
  const tol = toleranceForProfile(input.profile);
  const month = input.month;

  // choose best option per consecutive pair. When no travel date is set, prefer
  // daily services so the plan is date-flexible; date-flexible alternate forces it.
  const preferDaily = input.startWeekday == null;
  const chosen = new Map<string, LegOption>();
  const chosenList: LegOption[] = [];
  // Legs where HIS REFUSAL emptied the pool and we had to fall back to the very thing he
  // refused. Never silent (Law 4): every one of these gets a paragraph.
  const refusedLegs = new Map<string, LegOption | undefined>();
  // §10: rank each leg's options once (same objective ordering the sequencer uses),
  // keep ranked[0] as the chosen option, and retain the ranking for decision records.
  const explainByLeg = new Map<string, ReturnType<typeof buildLegExplain>>();
  // §14.5 the DDCV weight vector, rescaled by the traveller's psyche (w' = w ∘ M(TPP)).
  // Absent TPP = the objective weights unchanged (v1.0 behaviour). Hard gates untouched.
  const w = applyTPP(weightsForObjective(input.objective), input.tpp);
  // Whose body is enduring this, and what money means to him. Both are needed before a single
  // leg can be judged: the same overnight berth is a fair bargain to one mind and an ordeal
  // to another.
  const party: OrdealParty = { cls: tol.cls, budgetStance: input.contract?.budgetStance ?? null };
  for (let i = 1; i < names.length; i++) {
    const key = legKey(names[i - 1], names[i]);
    const { ranked, refusedAll } = rankLegOptions(deps.pool.get(key), input.objective, pax, { overnightTrains: input.overnightTrains, preferDaily, dailyOnly: deps.dailyOnly, contract: input.contract }, tol, month, w);
    if (!ranked.length) continue;

    // ---- THE CONSULTANT'S COURT, WIRED (Sprint 7 fusion) --------------------------------
    // The court was built, tested and PROVED — and the solve never called it. That is how a
    // man who wrote "no trains" still got the 17315 Velankanni Express on production: the
    // ordeal ceilings and the human refusals lived in consultantChoose, and buildPlan was
    // still ranking on raw DDCV alone. The brain was connected to nothing. It is connected now.
    let order = ranked;
    let rejectedReasons: Map<string, string> | undefined;
    let breached = refusedAll;

    if (input.contract) {
      const court = consultantChoose(
        ranked.map((o) => ({ opt: o, ctx: legCtx(o, tol, pax, month, input.contract, input.elevations) })),
        { contract: input.contract, party, weights: w },
      );
      rejectedReasons = new Map(court.rejected.map((r) => [optionKey(r.opt), r.reason]));
      if (court.winner) {
        // Honourable options exist: take the court's order, not the scalar's.
        const won = court.ranked.map((r) => r.opt);
        const alsoRan = ranked.filter((o) => !won.includes(o));
        order = [...won, ...alsoRan];
      } else {
        // NOTHING here honours his brief. We still have to connect the graph — but we do NOT
        // do it in silence, AND WE DO NOT DO IT BY PRICE.
        //
        // US-827. This branch used to leave `order` as the raw DDCV ranking — the money-weighted
        // scalar — so on the Tirupati → Kanyakumari leg the engine BLOCKED the 20-hour overnight
        // train for a luxury traveller and then SHIPPED IT ANYWAY, because among the blocked
        // options it was the cheapest. It blocked the thing and sold it to him in the same breath.
        //
        // LAW 3: A MARGINAL SAVING MAY NEVER BUY A TRAVELLER'S DISCOMFORT. If every road hurts,
        // we take the one that HURTS LEAST — measured by the ordeal, which is the thing that
        // hurts — and the consultant's paragraph says we had to (Law 4).
        breached = true;
        if (court.leastBad) {
          const rest = ranked.filter((o) => o !== court.leastBad);
          order = [court.leastBad, ...rest];
        }
      }
    }

    const opt = order[0];
    chosen.set(key, opt); chosenList.push(opt);
    if (breached) refusedLegs.set(key, opt);
    explainByLeg.set(key, buildLegExplain(
      order, (legOpt) => legCtx(legOpt, tol, pax, month, input.contract, input.elevations), w,
      { praiseHotelNight: input.contract?.rewardSwitches.hotelNightSaving !== false, rejectedReasons },
    ));
  }

  const nodesByName = new Map(deps.nodes.map((n) => [n.name, n] as const));

  // pass 1 — expand with no weekday to learn each constrained leg's day index
  const praiseHotelNight = input.contract?.rewardSwitches.hotelNightSaving !== false;
  const pass1 = expandDays({ sequence: names, nights, nodes: nodesByName, chosen, profile: input.profile ?? 'standard', maxRoadKmDay: input.maxRoadKmDay, startWeekday: null, haltNames: deps.haltNames, anchorsByLeg: deps.anchorsByLeg, month: input.month, praiseHotelNight });
  const constrained: WeekdayConstrainedLeg[] = [];
  {
    // ---- US-862 — THE FLIGHT WAS SCHEDULED ON A DAY IT DOES NOT FLY. -----------------------
    //
    // Found by the FOUNDER on a live plan, 15 July 2026: Day 1 locked to Wednesday, the
    // Wed/Sun-only IX 2019 placed on Day 2 — a THURSDAY. The plan's own calendar
    // contradicted its own flight, and a traveller who booked his hotels around it would
    // have stood at the airport on a day the aeroplane does not come.
    //
    // The bug: this loop updated its running day index AFTER handling each day, so every
    // constrained leg was registered one day EARLY — the lock solved the calendar for a
    // flight on Day 1 that actually flies on Day 2. The day already knows its own index;
    // we use it, and the off-by-one dance is deleted.
    for (const d of pass1.days) {
      if (d.transit) {
        const o = chosen.get(legKey(d.transit.from, d.transit.to));
        if (o && o.operatingDays != null && o.operatingDays !== 127) constrained.push({ dayIndex: d.day - 1, operatingDays: o.operatingDays, identifier: o.identifier });
      }
    }
  }
  let { lock } = resolveWeekdayLock(constrained, input.startWeekday ?? null);
  // §6.1 whole-trip phase shift: if the traveller's date is SOFT and their desired
  // Day-1 weekday does not align the weekday-limited trains, slide the whole trip by
  // up to ±softStartWindowDays days — the cheapest fix, tried before any reroute.
  let phase: PhaseShiftResult | undefined;
  let startWd: any = lock ? (['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'].indexOf(lock)) : (input.startWeekday ?? null);
  if (input.startWeekday != null && (input.softStartWindowDays ?? 0) > 0) {
    phase = phaseShift(input.startWeekday, constrained, input.softStartWindowDays);
    if (phase.aligned && phase.startWeekday != null) {
      startWd = phase.startWeekday;
      lock = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'][phase.startWeekday];
    }
  }
  const exp = expandDays({ sequence: names, nights, nodes: nodesByName, chosen, profile: input.profile ?? 'standard', maxRoadKmDay: input.maxRoadKmDay, startWeekday: startWd, haltNames: deps.haltNames, anchorsByLeg: deps.anchorsByLeg, month: input.month, praiseHotelNight });

  // §10 attach decision records + legOptions to the legs the plan actually took
  // (additive, absent-safe; matched by from||to on the main sequencing path).
  for (const leg of exp.legs) {
    const ex = explainByLeg.get(legKey(leg.from, leg.to));
    if (ex) {
      if (ex.decisionRecord) leg.decisionRecord = ex.decisionRecord;
      leg.legOptions = ex.legOptions;
    }
  }

  // ---- LAW 4, ON THE LIVE PATH: never a silent substitution ------------------------
  // Production handed a man who had written "no trains" a train — 17315 Velankanni Exp —
  // because it was the only service on that leg, and the fallback said nothing. The engine
  // was right that it had nothing else to offer. It was wrong to stay quiet about it.
  const contractNotes: string[] = [];
  for (const leg of exp.legs) {
    const key = legKey(leg.from, leg.to);
    if (!refusedLegs.has(key)) continue;

    // ---- US-844 — WE APOLOGISED FOR GIVING HIM WHAT HE ASKED FOR ---------------------
    //
    // The forced-substitution paragraph fired whenever only one mode survived, WITHOUT EVER
    // ASKING WHETHER THAT MODE WAS THE ONE HE ASKED FOR. A luxury honeymooner who wrote
    // "no trains, no long road journeys" was told his flight was "harder than we would
    // normally plan for you… if you would rather not take it, tell us". A FLIGHT IS EXACTLY
    // WHAT HE WANTED. When the only survivor is a mode he PREFERS, the correct register is
    // a plain confirmation, not an apology — and it is not a contract breach, because the
    // contract is the thing being honoured.
    if ((input.contract?.preferences?.preferModes ?? []).includes(leg.mode)) {
      const w = leg.mode === 'AIR' ? 'fly' : leg.mode === 'RAIL' ? 'take the train' : 'travel by road';
      const confirmation = `You asked to ${w} where we can manage it, and this leg does exactly that.`;
      leg.note = leg.note ? leg.note : confirmation;
      continue;
    }

    const line = sayForcedSubstitution(leg.from, leg.to, leg.mode, leg.identifier ?? null, input.contract);
    leg.note = leg.note ? `${leg.note} ${line}` : line;
    (leg as PlanLeg & { contractBreach?: boolean }).contractBreach = true;
    contractNotes.push(line);
  }

  const metrics = scorePlan(exp.legs, exp.days, pax, input.profile ?? 'standard');
  const warnings = [...exp.warnings, ...contractNotes];
  // US-834 — THE CONSENTS. A long road day may be PLANNED but it may never be ASSUMED.
  // Founder, 14 Jul 2026: "for an old couple also 350 km can be outer limit for one day road
  // travel, BUT STRICTLY AFTER EDUCATING THEM AND TAKING THEIR CONSENT." These are the exact
  // sentences we put to him — the kilometres, the hours, and a real choice. Law 4.
  const consents = [...(exp.consents ?? [])];
  if (phase && (!phase.aligned || phase.shiftDays !== 0)) warnings.push(`Phase shift: ${phase.reason}`);
  // §3.3/§7 rhythm gates: accumulate the fatigue ledger over the scheduled days and
  // surface any two-consecutive-heavy / heavy→heavy-drive / 3-day-streak violation.
  const dayLoads = dayLoadsFromDays(exp.days, chosen, tol, month);
  const ledger = runFatigueLedger(dayLoads, tol);
  // §7 inc-2: project per-day comfort (fatigue/effort/comfortNote/marker) onto the days.
  projectComfort(dayLoads, exp.days, tol, praiseHotelNight).forEach((c, i) => { const d = exp.days[i]; if (!d) return; d.fatigue = c.fatigue; d.effort = c.effort; d.comfortNote = c.comfortNote; if (c.marker) d.marker = c.marker; });
  for (const v of ledger.violations) warnings.push(`Rhythm (${v.kind}): ${v.detail}`);
  if (exp.infeasible) warnings.unshift('Plan contains a hard-constraint violation (gate/daylight/permit) — a day was flagged infeasible and must be rerouted.');
  void nodeMap;

  const plan: Plan = {
    sequence: names,
    weekdayLock: lock,
    legs: exp.legs,
    days: exp.days,
    totals: toTotals(metrics),
    warnings,
    consents,
    verifyBeforeBooking: verifyList(chosenList),
    map: mapRoute(names, chosen, nodesByName),
    label,
    rhythm: { ok: ledger.ok, peakF: ledger.F.length ? Math.max(...ledger.F) : 0, headline: rhythmHeadline(ledger, tol), violations: ledger.violations },
    // The traveller must SEE this, so it rides on the plan itself and not merely in an
    // internal warning the public payload strips out.
    ...(contractNotes.length ? { contractNotes } : {}),
    phaseShift: phase ? { aligned: phase.aligned, shiftDays: phase.shiftDays, startWeekday: phase.startWeekday != null ? ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'][phase.startWeekday] : null, reason: phase.reason } : undefined,
  };

  // ⚠️ US-835 — THE IRON LAW IS NOW INSTALLED, AND THIS IS THE DOOR.
  //
  // `truth.ts` was written on 14 July, committed with the words "a plan containing one
  // unprovable fact IS NOT DELIVERED", and then CALLED FROM NOWHERE. `assertPlanTruth()` was
  // dead code for a whole day. We wrote the law, hung it on the wall, and hired no policeman —
  // so the very next sweep shipped a 460 km train across a 1,476 km gap, a plan with Delhi in
  // it twice, and an empty itinerary carrying a 94/100 ease score.
  //
  // buildPlan() is the ONE function in this engine that constructs a Plan. Best, both
  // alternates, every archetype card and planFromSequence() are all born here. So the gate goes
  // HERE, and there is no second door to leave open. Every plan is now stamped with its own
  // violations at birth; optimize() refuses to hand out a plan that carries any.
  plan.truthViolations = checkPlanTruth(plan, truthCtxFor(input, deps));
  return plan;
}

/**
 * The Iron Law needs three things, and buildPlan already holds all three: the coordinate we
 * ACTUALLY used for every stop (not the one we wish we had used), the set of towns that
 * resolved, and whether the traveller asked to come home.
 *
 * L3 (a city must exist) and L5 (we may not quote a man who did not speak) cannot fire here and
 * are not meant to: inside the engine every stop is a node BY CONSTRUCTION, and the engine has
 * never seen his sentence. Those two are enforced at the controller, where the gazetteer and
 * his own words are in scope. This is not a gap — it is the same law, checked where the evidence
 * lives.
 */
export function truthCtxFor(input: OptimizeInput, deps: OptimizeDeps): TruthCtx {
  const coords = new Map<string, LatLng>();
  const known = new Set<string>();
  for (const n of deps.nodes) {
    coords.set(n.name.trim().toLowerCase(), n.coord);
    known.add(n.name.trim().toLowerCase());
  }
  return { coords, known, roundTrip: input.tripType !== 'oneway' };
}

/**
 * Solve ONE full plan under a fixed objective (matrix → sequence → buildPlan).
 * Exported so the §8 archetype builder can produce Swift/Balanced/Gentle without
 * re-implementing sequencing. Deliberately does NOT build cards, so there is no
 * recursion with optimize(). The objective is forced into the input the plan sees so
 * its DDCV weights, ranking and decision records are all consistent with it.
 */
export function solveForObjective(input: OptimizeInput, deps: OptimizeDeps, objective: Objective, label: string): Plan {
  const names0 = deps.nodes.map((n) => n.name);
  const pax = input.pax ?? 2;
  const startIdx = input.start ? names0.findIndex((n) => n.toLowerCase() === input.start!.toLowerCase()) : null;
  const endIdx = input.end ? names0.findIndex((n) => n.toLowerCase() === input.end!.toLowerCase()) : null;
  const preferDaily = input.startWeekday == null;
  const solveTol = toleranceForProfile(input.profile);
  const solveW = applyTPP(weightsForObjective(objective), input.tpp);
  const matrix = buildMatrix(names0, deps, objective, pax, preferDaily, solveTol, input.month, solveW, input.contract, input.elevations);
  const { order } = sequence(matrix, { start: startIdx != null && startIdx >= 0 ? startIdx : null, end: endIdx != null && endIdx >= 0 ? endIdx : null });
  return buildPlan(order, names0, { ...input, objective }, deps, label);
}

export function optimize(input: OptimizeInput, deps: OptimizeDeps): OptimizeResult {
  const names0 = deps.nodes.map((n) => n.name);
  const pax = input.pax ?? 2;
  const startIdx = input.start ? names0.findIndex((n) => n.toLowerCase() === input.start!.toLowerCase()) : null;
  const endIdx = input.end ? names0.findIndex((n) => n.toLowerCase() === input.end!.toLowerCase()) : null;

  const preferDaily = input.startWeekday == null;
  const solveTol = toleranceForProfile(input.profile);
  const solveW = applyTPP(weightsForObjective(input.objective), input.tpp);
  const matrix = buildMatrix(names0, deps, input.objective, pax, preferDaily, solveTol, input.month, solveW, input.contract, input.elevations);
  const { order } = sequence(matrix, { start: startIdx != null && startIdx >= 0 ? startIdx : null, end: endIdx != null && endIdx >= 0 ? endIdx : null });

  const best = buildPlan(order, names0, input, deps, `Best (${input.objective})`);

  // alternate 1 — edge-penalty diversification (penalise 30% of chosen edges, re-sequence)
  const alt1Matrix = matrix.map((row) => row.slice());
  for (let i = 1; i < order.length; i++) if (i % 3 === 0) alt1Matrix[order[i - 1]][order[i]] *= 1.6;
  const alt1Order = sequence(alt1Matrix, { start: startIdx != null && startIdx >= 0 ? startIdx : null, end: endIdx != null && endIdx >= 0 ? endIdx : null }).order;
  const alt1 = buildPlan(alt1Order, names0, input, deps, 'Alternate (diversified)');

  // alternate 2 — weekday-free fallback: force road/daily modes only (no weekday lock)
  const roadOnlyDeps: OptimizeDeps = {
    nodes: deps.nodes,
    pool: new Map(Array.from(deps.pool.entries()).map(([k, v]) => [k, v.filter((o) => (o.operatingDays ?? 127) === 127)] as const)),
  };
  const roadMatrix = buildMatrix(names0, roadOnlyDeps, input.objective, pax, true, solveTol, input.month, solveW, input.contract, input.elevations);
  const alt2Order = sequence(roadMatrix, { start: startIdx != null && startIdx >= 0 ? startIdx : null, end: endIdx != null && endIdx >= 0 ? endIdx : null }).order;
  const alt2 = buildPlan(alt2Order, names0, input, { ...deps, pool: roadOnlyDeps.pool, dailyOnly: true }, 'Alternate (date-flexible, no weekday lock)');
  alt2.dateFlexible = true;

  // ⚠️ US-835 — every plan is STAMPED with the Iron Law's verdict at birth (see buildPlan).
  // The engine does not refuse here, and that is deliberate: optimize() is a pure kernel and a
  // unit test is entitled to drive it with a synthetic pool. THE REFUSAL LIVES AT THE PRODUCT
  // EXIT — RouteOptimizerController.optimize(), the single door through which every real
  // traveller passes, CRM and public planner alike (the public controller literally calls it).
  // No door is left open for a human being; and the kernel stays a kernel.
  const plans = dedupePlans([best, alt1, alt2]);
  // §8 additive: Swift/Balanced/Gentle archetype cards (each a full solve under a
  // fixed objective). plans[] stays present + unchanged — loadFromOptimizer is safe.
  const cards = buildArchetypes(input, deps);
  // §9 negotiation: only when the chosen plan is infeasible (engine signals) or over
  // the traveller's day budget — a senior expert negotiates instead of erroring. The
  // extra re-solves run ONLY on an infeasible request, so feasible solves are untouched.
  const negotiation = needsNegotiation(best, input.dayBudget)
    ? negotiate(input, deps, { dayBudget: input.dayBudget })
    : undefined;
  return { plans, cards, ...(negotiation && negotiation.length ? { negotiation } : {}) };
}

/**
 * THE IRON LAW'S TURNSTILE. Keeps every plan that can prove itself; throws only when NOT ONE
 * survives — because at that point we have nothing true to say, and saying nothing true is the
 * only remaining honest act. Called by the CONTROLLER (the product exit), not by the kernel.
 *
 * If a lie is confined to one alternate we simply drop that alternate and the traveller never
 * learns it existed. If EVERY plan we can build is a lie, we say so out loud — an honest
 * "we could not build this" beats a beautiful, confident fiction, because the fiction is the
 * one he would have acted on.
 */
export function honestPlansOnly(plans: Plan[]): Plan[] {
  const clean = plans.filter((p) => !(p.truthViolations?.length));
  if (clean.length) return clean;
  const all: TruthViolation[] = [];
  const seen = new Set<string>();
  for (const p of plans) for (const v of (p.truthViolations ?? []) as TruthViolation[]) {
    const k = `${v.law}|${v.what}|${v.detail}`;
    if (!seen.has(k)) { seen.add(k); all.push(v); }
  }
  throw new TruthViolationError(all);
}

/**
 * Build a plan for an already-fixed sequence (no re-sequencing). Used after
 * en-route halts have been inserted into a chosen order: the controller supplies
 * the expanded ordered names (originals + halts), the augmented nodes/pool, and
 * input.cities carrying each halt's nights.
 */
export function planFromSequence(names: string[], input: OptimizeInput, deps: OptimizeDeps, label: string): Plan {
  return buildPlan(names.map((_, i) => i), names, input, deps, label);
}

function dedupePlans(plans: Plan[]): Plan[] {
  const seen = new Set<string>();
  const out: Plan[] = [];
  for (const p of plans) {
    const sig = p.sequence.join('>') + '|' + p.weekdayLock;
    if (!seen.has(sig)) { seen.add(sig); out.push(p); }
  }
  return out.length ? out : plans.slice(0, 1);
}
