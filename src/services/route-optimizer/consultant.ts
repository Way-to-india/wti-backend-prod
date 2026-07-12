/**
 * L3 — THE CONSULTANT'S DECISION PROCEDURE. Sprint 7 / US-606. Pure.
 *
 * A seasoned consultant's concerns are LEXICOGRAPHIC, not weighted. He never trades a
 * higher concern for any amount of a lower one. He does not put a client on a nine-hour
 * night train because it saved four hundred rupees, and no quantity of rupees changes his
 * mind, because that is not the kind of thing rupees can buy.
 *
 *   0. THE BODY    — can these travellers physically do this day?      (gates; sacred)
 *   1. THE WORD    — did he refuse this? then it is out.               (contract filters)
 *   2. THE ORDEAL  — does this journey abuse him?                      (ceilings, dead hours)
 *   3. THE TRIP    — does this leg serve what the trip is FOR?         (intent-service)
 *   4. THE CRAFT   — among honourable options, the smoothest.          (DDCV, TPP-modulated)
 *   5. THE PURSE   — money. LAST. And for a comfort-first traveller,
 *                    only ever as a tiebreak inside a band where the
 *                    comfort is already equal.
 *
 * The engine already ran levels 0 and 4 — and level 4 was the whole court. This module
 * inserts 1, 2 and 3, and demotes 5.
 *
 * WHY LAW 3 CANNOT BE DELIVERED BY WEIGHTS (the argument, since the brief demanded it):
 *
 *   1. Zero is unreachable. tpp.ts clamps every multiplier to [0.3, 2.0], so at full
 *      comfort-first the money weight only falls to 0.6x. The clamp is right and must
 *      stay: a finite multiplier can never un-block a +infinity hard gate.
 *   2. Zero would not be enough anyway. Money hides in proxies — F4 proved it was living
 *      inside q, the comfort term, wearing a convenience costume. Kill the M weight and
 *      the costume still walks.
 *   3. Scalarisation ITSELF is the leak. In any weighted sum, enough small money
 *      advantages will eventually outvote one large comfort loss. Law 3 says NEVER — "not
 *      by a rupee, not ever". "Never" is a lexicographic word, not a weight.
 *
 * Hence: money is ABSENT from levels 0–4 for a comfort-first traveller (w.M := 0), and
 * appears only to split an ordeal band. Inside a band the comfort is equal BY
 * CONSTRUCTION, so the tiebreak cannot buy discomfort. That is the proof, and
 * consultant.test.ts machine-checks it: a rejected option made COMPLETELY FREE still
 * loses if it sits in a worse ordeal band.
 */

import type { LegOption } from './types';
import { ddcv, ddcvScalar, indicativeFarePp, type DDCV, type LegCtx, type Weights } from './ddcv';
import { ordeal, ceilingBreach, BAND_EPS, type Ordeal, type OrdealParty } from './ordeal';
import { sayRejection, spokenDuration, type RejectionCause } from './explain';
import type { PlanContract } from './intent';

export interface ConsultantCandidate {
  opt: LegOption;
  ctx: LegCtx;
  /** transfers on this option, if the provider knows of any (US-612 will use them fully). */
  transfers?: number;
}

export interface RankedConsultant {
  opt: LegOption;
  v: DDCV;
  ordeal: Ordeal;
  /** the ordeal BAND index — the first and highest key. Inside a band, comfort is equal. */
  band: number;
  /** level 3 — how well this leg serves what the trip is FOR. See intentService(). */
  service: number;
  /** level 4 — the DDCV scalar, with money REMOVED for a comfort-first traveller. */
  craft: number;
  /** level 5 — the purse. The only place money exists at all under 'tiebreak_only'. */
  farePp: number;
}

export interface RejectedOption {
  opt: LegOption;
  cause: RejectionCause;
  /** HIS reason, in his words, written HERE — at the moment of rejection (Law 5). */
  reason: string;
  ordeal: number;
}

export interface ConsultantChoice {
  winner: RankedConsultant | null;
  ranked: RankedConsultant[];
  rejected: RejectedOption[];
  /** every candidate was refused by a gate, a ceiling, or his own word. */
  infeasible: boolean;
  /** his refusal, and nothing else, emptied this leg → the consultant must SPEAK (US-607). */
  refusedAll: boolean;
}

export interface ConsultantOpts {
  contract?: PlanContract;
  party: OrdealParty;
  /** base weights (objective + TPP already applied by the caller). */
  weights: Weights;
  /** level 3 — the intent-service scorer. See the note on intentService(). */
  serviceScore?: (o: LegOption, c?: PlanContract) => number;
}

/**
 * LEVEL 3 — DOES THIS LEG SERVE WHAT THE TRIP IS FOR?
 *
 * A leg through Mysuru serves a heritage-loving honeymooner in a way a leg down the NH
 * does not. We would like to score that.
 *
 * WE CANNOT, HONESTLY, YET. It requires a curated per-edge/per-place table (the same
 * "adjective registry" flagged in the spec) and that table does not exist. So the default
 * scorer returns ZERO for everything and the level is INERT — it changes no decision.
 *
 * That is deliberate, and it is the whole product: an honest zero beats an invented
 * number. The hook is here; the day the table exists, this becomes a real level. Until
 * then the engine does not pretend to know which road is beautiful.
 */
export function intentService(_o: LegOption, _c?: PlanContract): number {
  return 0;
}

const farePpOf = (o: LegOption): number =>
  (o.farePpMin != null && o.farePpMax != null) ? (o.farePpMin + o.farePpMax) / 2 : indicativeFarePp(o);

/**
 * THE PROCEDURE (spec 3.2, step 7). Every removal writes its reason AT THE MOMENT OF
 * REMOVAL, in the traveller's own terms — never reconstructed later from a score.
 */
export function consultantChoose(cands: ConsultantCandidate[], opts: ConsultantOpts): ConsultantChoice {
  const { contract, party, weights } = opts;
  const service = opts.serviceScore ?? intentService;
  const tighten = contract?.tighten;
  const banned = new Set(contract?.filters.banModes ?? []);
  const quotes = contract?.voice.quotes ?? {};

  // Law 3, structurally: for a comfort-first traveller money does not exist at level 4.
  // Not "is worth little" — DOES NOT EXIST. It reappears at level 5 and nowhere else.
  const rankWeights: Weights = contract?.moneyRule === 'tiebreak_only'
    ? { ...weights, M: 0 }
    : weights;

  const ranked: RankedConsultant[] = [];
  const rejected: RejectedOption[] = [];
  let refusedByWord = 0;

  for (const c of cands) {
    const o = c.opt;
    const v = ddcv(o, {
      ...c.ctx,
      tighten,
      rewardHotelNightSaving: contract?.rewardSwitches.hotelNightSaving,
    });
    const ord = ordeal(o, party, {
      doorToDoorHrs: Number.isFinite(v.T) ? v.T : null,
      transfers: c.transfers ?? 0,
    });
    const d2dMin = Number.isFinite(v.T) ? Math.round(v.T * 60) : (o.durationMin ?? null);

    // ---- LEVEL 1 — THE WORD. He refused this. It is out. -------------------------
    if (banned.has(o.mode)) {
      const cause: RejectionCause = { kind: 'refused_mode', mode: o.mode, quote: quotes[`mode_${o.mode.toLowerCase()}`] };
      rejected.push({ opt: o, cause, reason: sayRejection(o, cause, d2dMin), ordeal: ord.total });
      refusedByWord++;
      continue;
    }

    // ---- LEVEL 0 — THE BODY, and the dead-hours gate he asked for ------------------
    // (ddcv() carries both: the body's own gates, and the tightenings HE added. It can
    //  never carry a loosening — see intent.ts.)
    if (v.hardBlock) {
      // A dead-hours refusal already speaks in his voice; a body refusal speaks in ours,
      // and we say it plainly rather than dressing it up.
      const isDeadHours = v.blockReasons.some((r) => /in the morning|at night/.test(r));
      const cause: RejectionCause = isDeadHours
        ? { kind: 'dead_hours' }
        : { kind: 'body', reasons: v.blockReasons };
      rejected.push({ opt: o, cause, reason: sayRejection(o, cause, d2dMin), ordeal: ord.total });
      continue;
    }

    // ---- LEVEL 2 — THE ORDEAL. His ceilings: "no long road journeys", given a number.
    const breach = ceilingBreach(o, ord.total, tighten);
    if (breach) {
      const qualified = breach.kind === 'mode' && breach.ceiling <= 30 ? 'long' : 'any';
      const cause: RejectionCause = {
        kind: 'ceiling', ceiling: breach.ceiling, ordeal: ord.total, qualified,
        quote: quotes[`mode_${o.mode.toLowerCase()}`],
      };
      rejected.push({ opt: o, cause, reason: sayRejection(o, cause, d2dMin), ordeal: ord.total });
      continue;
    }

    ranked.push({
      opt: o, v, ordeal: ord,
      band: Math.floor(ord.total / BAND_EPS),
      service: service(o, contract),
      craft: ddcvScalar(v, rankWeights),
      farePp: farePpOf(o),
    });
  }

  // ---- LEVELS 3, 4, 5 — the sort ---------------------------------------------------
  //
  // TWO LANES, AND THE TRAVELLER CHOOSES WHICH ONE HE IS IN.
  //
  // THE COMFORT LANE (moneyRule 'tiebreak_only'). The ordeal band is the FIRST key, and it
  // outranks everything below it. Money is not in the craft term (M := 0 above) and appears
  // only to split a band — inside which comfort is equal by construction. This is what makes
  // "not by a rupee, not ever" a fact rather than a hope.
  //
  // THE PURSE LANE ('normal'). The band does NOT pre-empt. For a family who said "cheapest
  // way please", a comfort-band veto would be the same arrogance in the opposite direction:
  // it would force them onto a flight they never asked for and cannot afford, and congratulate
  // itself for their comfort. Money is a legitimate concern for them, so it stays where it has
  // always been — inside the DDCV scalar — and the overnight train wins, because for THEM it
  // genuinely is the right answer.
  //
  // The body gates and his own ceilings apply in BOTH lanes. What changes is only whether
  // comfort is allowed to overrule the purse, and that is his call, not ours.
  const comfortLane = contract?.moneyRule === 'tiebreak_only';
  ranked.sort((a, b) => (comfortLane
    ? (a.band - b.band)               // 2. the ordeal band — comfort, and it outranks all
      || (b.service - a.service)      // 3. what the trip is FOR (inert until the data exists)
      || (a.craft - b.craft)          // 4. the craft: smoothest of the honourable options
      || (a.farePp - b.farePp)        // 5. THE PURSE. Last, and only ever inside a band.
    : (b.service - a.service)         // 3. what the trip is FOR
      || (a.craft - b.craft)          // 4. the craft — money lives in here, as it always has
      || (a.farePp - b.farePp)
  ));

  // Every option that survived the gates but simply lost: it still gets a human line, because
  // the rejected list is where the traveller learns that we looked.
  const winner = ranked[0] ?? null;
  for (const r of ranked.slice(1)) {
    const cause: RejectionCause = { kind: 'lost', winner: winner ? (winner.opt.identifier ?? winner.opt.mode) : '' };
    rejected.push({
      opt: r.opt, cause,
      reason: sayRejection(r.opt, cause, Number.isFinite(r.v.T) ? Math.round(r.v.T * 60) : null),
      ordeal: r.ordeal.total,
    });
  }

  return {
    winner,
    ranked,
    rejected,
    infeasible: ranked.length === 0,
    // His word, and nothing else, emptied this leg. That is not a licence to overrule him
    // in silence: it is the moment the consultant is supposed to speak (Law 4, US-607).
    refusedAll: ranked.length === 0 && refusedByWord > 0,
  };
}

/**
 * THE OVERRIDE ASYMMETRY (spec 3.4) — the crux of the whole brief, as a function.
 *
 * The founder overrode "no road" (he put the man in a car to Mysuru) and did NOT override
 * "no trains". Both were refusals. What made one legitimate and the other a betrayal?
 *
 *   LEGITIMATE — it gives him MORE of what he actually wanted:
 *      (1) it is MATERIALLY more comfortable (a full band better, not a whisker),
 *      (2) it breaches no unqualified refusal — his word is still his word,
 *      (3) it is ANNOUNCED (finding · reason · alternative).
 *
 *   BETRAYAL — it serves us, or serves thrift:
 *      X is no better on ordeal, but cheaper. For a traveller whose money rule is not
 *      'normal', X MUST NOT WIN. Ever. That is not a tuning; it is a refusal.
 *
 * The Mysuru road passes all three: lower ordeal than any air composite for that leg, no
 * unqualified refusal breached ("no LONG road journeys" is qualified, and 3 hours is under
 * his ceiling), and the consultant said it out loud. The Netravathi fails (2) outright —
 * and would fail the betrayal clause even if he had never mentioned trains, because the
 * train's only virtue was money.
 */
export function isLegitimateOverride(
  x: { ordeal: number; farePp: number }, y: { ordeal: number; farePp: number },
  breachesUnqualifiedRefusal: boolean, announced: boolean,
): boolean {
  if (breachesUnqualifiedRefusal) return false;              // his word stays his word
  if (!announced) return false;                              // never in silence (Law 4)
  return x.ordeal < y.ordeal - BAND_EPS;                     // materially kinder, not marginally
}

export function isBetrayal(
  x: { ordeal: number; farePp: number }, y: { ordeal: number; farePp: number },
  moneyRule: 'normal' | 'tiebreak_only',
): boolean {
  if (moneyRule === 'normal') return false;   // for a price-first mind, cheaper IS the service
  return x.ordeal >= y.ordeal && x.farePp < y.farePp;
}

// =============================================================================
// US-607 — THE CONSULTANT'S FALLBACK. Law 4, as an algorithm.
//
//   "A seasoned consultant does not quietly put his client on a train the client refused.
//    He explains: 'There is no airport within reach of Coorg. So I advise you to drive on
//    to Mangalore, and fly from there. There is no direct flight, but you told me you
//    would rather fly, and this is the way to do it.'"
//
// Three parts, and ALL THREE ARE COMPULSORY:
//    1. THE FINDING     — what we checked, and what we found.
//    2. THE REASON      — why the preferred thing is not available HERE.
//    3. THE ALTERNATIVE — a concrete, named, honourable way to still get what he wanted.
//
// A silent substitution is the one thing this module exists to make impossible.
// =============================================================================

/**
 * A way to restore his preference by going somewhere else first. The controller builds these
 * FROM REAL DATA ONLY — the nearest airport that has SCHEDULED SERVICE (flight_sectors, not
 * merely a runway on a map), the nearest railhead with an acceptable class. The engine never
 * conjures a gateway, and never asserts a flight exists. If the data does not have it, the
 * composite is not built, and we say THAT instead.
 */
export interface GatewayCandidate {
  /** the node that restores the preference — 'Mangalore'. */
  node: string;
  /** the reach-leg: how he actually gets there. A real routed road/rail option. */
  reach: LegOption;
  /** the onward services from that node, in his preferred mode. REAL SERVICES ONLY. */
  onward: LegOption[];
}

export interface CompositeChoice {
  gateway: string;
  reach: RankedConsultant;
  onward: RankedConsultant;
  /** the two segments are judged SEPARATELY — that is the point. A 3.5 h drive and a
   *  1 h flight are two civilised half-days; welded into one 7 h "leg" they are an ordeal
   *  that breaches his ceiling. The traveller does not live the sum; he lives the days. */
  totalOrdeal: number;
}

export interface FallbackResult {
  kind: 'composite' | 'his_call' | 'none';
  composite?: CompositeChoice;
  /** 3.3(f) — we could not honour him, so we present rather than decide. */
  hisCall?: { opt: LegOption; reason: string };
  /** THE PARAGRAPH. Finding · reason · alternative. Never absent when we substituted. */
  paragraph: string;
  rejected: RejectedOption[];
}

export interface FallbackOpts extends ConsultantOpts {
  /** how the caller builds a leg context for a given option (access hours, fares…). */
  ctxFor: (o: LegOption) => LegCtx;
}

/**
 * Build the honourable way round, from real data, or say plainly that there is none.
 *
 * `directCands` are the leg's own candidates (already found unhelpable by consultantChoose).
 * `gateways` are the real ways to restore his preferred mode. Both come from the caller.
 */
export function consultantFallback(
  leg: { from: string; to: string },
  directCands: ConsultantCandidate[],
  gateways: GatewayCandidate[],
  opts: FallbackOpts,
): FallbackResult {
  const { contract } = opts;
  const preferred = contract ? preferredMode(contract) : null;
  const rejected: RejectedOption[] = [];

  // ---- (a)+(b) BUILD each composite, and judge EACH SEGMENT on its own merits ---------
  const composites: CompositeChoice[] = [];
  for (const gw of gateways) {
    if (!gw.onward.length) continue;                       // no real service ⇒ no composite. Full stop.

    // the reach-leg must itself be honourable — his ceilings apply to it too. A 6-hour drive
    // to an airport is not a solution, it is the same ordeal with a boarding pass.
    const reachChoice = consultantChoose([{ opt: gw.reach, ctx: opts.ctxFor(gw.reach) }], opts);
    if (!reachChoice.winner) { rejected.push(...reachChoice.rejected); continue; }

    // THE DRIVE TO MANGALORE **IS** THE AIRPORT ACCESS. It has already been counted, in
    // full, as the reach-leg. Charging it a second time as the flight's "access to the
    // terminal" would bill the traveller twice for one car journey and push a perfectly
    // civilised half-day over his own comfort ceiling — the far-airport double-charge, run
    // backwards. The reach-leg delivers him TO the terminal; the onward leg starts there.
    // (Check-in, egress and the ride to his hotel at the far end are all still charged.)
    const onwardChoice = consultantChoose(
      gw.onward.map((o) => ({ opt: o, ctx: { ...opts.ctxFor(o), accessFromHrs: 0, accessCostPp: 0 } })),
      opts,
    );
    if (!onwardChoice.winner) { rejected.push(...onwardChoice.rejected); continue; }

    composites.push({
      gateway: gw.node,
      reach: reachChoice.winner,
      onward: onwardChoice.winner,
      totalOrdeal: Math.round((reachChoice.winner.ordeal.total + onwardChoice.winner.ordeal.total) * 10) / 10,
    });
  }

  // ---- (c)+(d) the composite is A CANDIDATE, NOT A DECREE ------------------------------
  // It competes on the same ordeal ranking as everything else. If driving four hours to an
  // airport is worse than the thing he was trying to avoid, we do not do it just because it
  // technically honours the letter of his preference.
  composites.sort((a, b) => a.totalOrdeal - b.totalOrdeal);
  const best = composites[0];

  if (best) {
    return {
      kind: 'composite',
      composite: best,
      paragraph: sayComposite(leg, best, contract, preferred),
      rejected,
    };
  }

  // ---- (f) WE COULD NOT HONOUR HIM. So we say so, and we do not decide for him. ----------
  //
  // Present, don't decide. We put the least-ordeal thing THAT ACTUALLY EXISTS in front of
  // him, with its true cost in plain words, and we let him choose.
  //
  // WHAT WE RELAX HERE, AND WHAT WE NEVER RELAX. We set aside only his ORDEAL CEILINGS —
  // "no long road journeys" is a preference about degree, and a consultant may honourably
  // come back and say "the only drive is eight hours; it is longer than you wanted; shall
  // we?" (negotiate.ts exists precisely to price that question).
  //
  // We do NOT set aside his REFUSALS, his dead-hours gate, or his body's gates. An earlier
  // draft of this function dropped the whole contract here — and the test caught it doing
  // something genuinely disgraceful: it offered the man the Netravathi, the very train he
  // had refused, inside a paragraph that promised we would never put him on something he
  // asked us to avoid. A silent substitution wearing the costume of honesty is worse than
  // the silent substitution alone. His word is not a ceiling. It is a wall.
  const relaxedCeilings: PlanContract | undefined = contract && {
    ...contract,
    tighten: { ...contract.tighten, perModeOrdealCeiling: undefined, legOrdealCeiling: undefined },
  };
  const all = consultantChoose(directCands, { ...opts, contract: relaxedCeilings });
  const fallbackWinner = all.winner;
  if (!fallbackWinner) {
    return { kind: 'none', paragraph: sayNothingWorks(leg), rejected: [...rejected, ...all.rejected] };
  }
  return {
    kind: 'his_call',
    hisCall: {
      opt: fallbackWinner.opt,
      reason: sayRejection(fallbackWinner.opt, { kind: 'lost', winner: '' }, Math.round(fallbackWinner.v.T * 60)),
    },
    paragraph: sayHisCall(leg, fallbackWinner, contract, preferred, refusedName(directCands, contract)),
    rejected: [...rejected, ...all.rejected],
  };
}

/** The thing he refused, named — so that "his call" is a fully informed call. */
function refusedName(cands: ConsultantCandidate[], c?: PlanContract): string | null {
  if (!c) return null;
  const banned = new Set(c.filters.banModes);
  const hit = cands.find((x) => banned.has(x.opt.mode));
  return hit ? (hit.opt.identifier ?? `the ${hit.opt.mode.toLowerCase()} option`) : null;
}

function preferredMode(c: PlanContract): 'AIR' | 'RAIL' | 'ROAD' | null {
  // He never says "I prefer to fly" in so many words. He says "no trains, no long drives",
  // and we read the preference out of the refusals (intent.ts). Whichever mode he did NOT
  // refuse is the one he is asking for.
  const banned = new Set(c.filters.banModes);
  if (!banned.has('AIR')) return 'AIR';
  if (!banned.has('RAIL')) return 'RAIL';
  return null;
}

const modeVerb = (m: string | null): string =>
  m === 'AIR' ? 'fly' : m === 'RAIL' ? 'take the train' : 'travel that way';

/** THE PARAGRAPH (spec 5.1). Finding · reason · alternative — all three, always. */
function sayComposite(
  leg: { from: string; to: string }, c: CompositeChoice,
  contract: PlanContract | undefined, preferred: string | null,
): string {
  const quote = contract?.voice.quotes.mode_rail ?? contract?.voice.quotes.mode_road ?? contract?.voice.quotes.comfortTier;
  const reachDur = spokenDuration(c.reach.opt.durationMin ?? null);
  const service = c.onward.opt.identifier ?? `the ${c.onward.opt.mode === 'AIR' ? 'flight' : 'train'}`;

  const parts: string[] = [];

  // 1. what he told us — in HIS words, quoted, so he knows we listened.
  if (quote) parts.push(`You told us "${quote}".`);

  // 2. THE FINDING and THE REASON. What we checked, and what we actually found.
  parts.push(`We checked every way to travel from ${leg.from} to ${leg.to}.`);
  parts.push(`${leg.from} has no airport, so there is no flight from there.`);

  // 3. THE ALTERNATIVE — named, concrete, and every number from a real service.
  //    (No adjectives the data cannot prove. The road is not "beautiful" until a curated
  //     table says so — spec 5.4. It is a drive of a stated length, with a driver.)
  const drive = reachDur
    ? `drive ${reachDur} to ${c.gateway} with your own car and driver`
    : `travel on to ${c.gateway} with your own car and driver`;
  parts.push(`So here is our advice: ${drive}, and take ${service} from ${c.gateway} to ${leg.to}.`);

  // 4. THE HONOUR — one line tying it back to what he asked for.
  parts.push(`There is no direct flight, but this way you still ${modeVerb(preferred)}, just as you preferred.`);

  return parts.join(' ');
}

/** 3.3(f) — present, don't decide. */
function sayHisCall(
  leg: { from: string; to: string }, w: RankedConsultant,
  contract: PlanContract | undefined, preferred: string | null,
  refusedAlternative?: string | null,
): string {
  const dur = spokenDuration(Math.round(w.v.T * 60));
  const parts = [
    `We checked every way to travel from ${leg.from} to ${leg.to}, and we could not find one that keeps to what you asked for.`,
    `There is no airport within reach of ${leg.from}, so you cannot ${modeVerb(preferred)} this leg.`,
  ];
  parts.push(w.opt.mode === 'ROAD'
    ? `The way left to you is the drive, and it is ${dur ?? 'a long one'} — longer than you wanted.`
    : `The way left to you is ${w.opt.identifier ?? 'this service'}, and it is ${dur ?? 'a long journey'}.`);
  if (refusedAlternative) parts.push(`The only other way is ${refusedAlternative}, which you asked us to avoid.`);
  parts.push('We would rather tell you that than quietly put you on something you asked us to avoid. If you like, we can break the journey with a night on the way, so that no single day is long.');
  return parts.join(' ');
}

function sayNothingWorks(leg: { from: string; to: string }): string {
  // Everything left is either refused by his own word or beyond what his body should be
  // asked to do in one day — and the body's cap is not ours to lift. We do not invent a
  // service, and we do not quietly hand him one he refused. We offer the one honest remedy
  // the engine actually has: break the journey, so that no single day is long.
  return `We checked every way to travel from ${leg.from} to ${leg.to}, and there is no single journey we would be willing to put you on: the drive is longer than one day should be, and the train is the one you asked us to avoid. Rather than invent something, we suggest we break this journey with a night on the way, so that no day is long. Tell us if you would like that, and we will plan it.`;
}
