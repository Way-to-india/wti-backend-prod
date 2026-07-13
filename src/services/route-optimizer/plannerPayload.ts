/**
 * US-501 — PLANNER PAYLOAD ADAPTER (Sprint 5, frontend enablement).
 *
 * The trip-planner design (`docs/route-optimizer/wti-redesign/preview/trip-planner/`)
 * binds its components to a `TRIP_DATA` object (see that folder's `data.js` +
 * `MOTION_AND_BINDING.md` §2). The engine ALREADY produces every fact that shape
 * needs — but in a different arrangement:
 *
 *   - the rich per-leg facts (durationMin, distanceKm, frequency, overnight,
 *     verifyFlag, positioning, pearlSplit, decisionRecord, legOptions) live on
 *     `plan.legs[]` (PlanLeg), while the design reads them from `days[].transit`,
 *     which the engine emits THIN (from/to/mode/identifier/dep/arr only);
 *   - `legOptions` are per-leg rows of raw numbers; the design wants one map keyed
 *     `"From-To"` with display strings;
 *   - the cost lines live on `enrichment.tripCost.breakdown`; the city content on
 *     `enrichment.cities`; the map on `plan.map`.
 *
 * This module is the single, PURE place that performs that rearrangement. It is an
 * ADAPTER, not a source of truth: it moves and formats facts the engine already
 * asserted. It is deliberately NOT wired into `optimize()` — the controller calls it
 * to build an ADDITIVE response field, so `plans[0]` keeps the exact shape
 * `loadFromOptimizer` reads.
 *
 * ANTI-HALLUCINATION (iron rule): this adapter NEVER invents a fact. If the engine
 * did not assert something, the field is OMITTED, not filled with plausible prose:
 *   - no `decisionRecord` on a leg  → no "why" and NO reasoning lines for that leg;
 *   - no `legOptions`              → that leg contributes nothing to the stream;
 *   - no enrichment                → `costBreakdown` / `enrichment` are null/[];
 *   - `verifyFlag` is always carried through — a leg needing reconfirmation can never
 *     be silently laundered into a confident one.
 * The reasoning stream is DERIVED (kept = the chosen option, rejected = the options
 * the engine actually compared and their real notes) — never scripted.
 */

import type {
  OptimizeResult, Plan, PlanLeg, DayItem, ArchetypeCard,
  DecisionRecord, LegOptionRow, CityEnrichment, TripCostAssumptions, TripCostLever,
} from './types';

// ---- display formatting (pure) ------------------------------------------------

/** minutes → "1 h 55" / "9 h 55" / "45 min". Null-safe. */
export function fmtDur(min: number | null | undefined): string | null {
  if (min == null || !Number.isFinite(min) || min < 0) return null;
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/** ₹ per person, Indian digit grouping → "₹1,450 pp". Null-safe. */
export function fmtFarePp(fare: number | null | undefined): string | null {
  if (fare == null || !Number.isFinite(fare)) return null;
  return `₹${Math.round(fare).toLocaleString('en-IN')} pp`;
}

/** the design's leg key: "Delhi-Agra". */
export const legKey = (from: string, to: string): string => `${from}-${to}`;

// ---- the payload shape the design's data.js declares ----------------------------

export interface PlannerTransit {
  from: string; to: string; mode: string;
  identifier?: string | null; dep?: string | null; arr?: string | null;
  durationMin?: number | null; distanceKm?: number | null;
  frequency?: string; overnight?: boolean; verifyFlag?: boolean; positioning?: boolean;
  pearlSplit?: { anchor: string; detourPct: number; subHrs?: [number, number]; why?: string | null };
  decisionRecord?: DecisionRecord;
}
export interface PlannerDay {
  day: number; weekday?: string | null; city: string; activity: string;
  fatigue?: 'easy' | 'full'; effort?: number; comfortNote?: string; marker?: string; halt?: boolean;
  transit: PlannerTransit | null;
}
export interface PlannerLegOptionRow {
  id: string | number; dur: string | null; fare: string | null; freq: string;
  chosen?: boolean; note?: string;
}
/**
 * THE PRICE, AS THE TRAVELLER SHOULD MEET IT (founder rulings, 2026-07-11).
 *
 *   band        — rounded, never a precise number. "₹43,247" is a promise we cannot
 *                 keep and the exact string he pastes into a competitor's search box.
 *   assumptions — the sentence that must sit under every band: how many travellers,
 *                 which hotel level, what is in, what is out. A price without its
 *                 assumption printed next to it is not a price, it is bait.
 *   levers      — group size and hotel level, each re-computed by the SAME engine.
 *                 This is what turns a number he argues with into a decision he can
 *                 make: "two more of you and it is ₹9,000 less each."
 *
 * PUBLIC-SAFE by construction: no hotel/road/tax split, no supplier, no margin.
 */
export interface PlannerPrice {
  currency: string;
  perPersonMin: number;
  perPersonMax: number;
  assumptions: TripCostAssumptions;
  levers: TripCostLever[];
  car?: { fullDays: number; transferLegs: number; vehicle: string };
}

export interface PlannerCostBreakdown {
  perPerson: { label: string; amount: number }[];
  pax: number; note: string;
}
export interface PlannerReasoningLine { text: string; ok: boolean }
export interface PlannerPayload {
  request: string | null;
  cards: ArchetypeCard[];
  plan: {
    label?: string; weekdayLock: string | null; sequence: string[];
    phaseShift?: Plan['phaseShift']; rhythm?: Plan['rhythm']; totals: Plan['totals'];
    verifyBeforeBooking: string[]; warnings: string[];
    days: PlannerDay[];
    /** Law 4 — every leg where we could NOT keep to his brief, said out loud. This must
     *  survive the public gate (which strips `warnings`), because the traveller is precisely
     *  the person who needs to read it. Never a silent substitution. */
    contractNotes?: string[];
  } | null;
  legOptions: Record<string, PlannerLegOptionRow[]>;
  /** the honest, public price. null when enrichment did not run — and then we show
   *  NO price at all, because a wrong price is worse than no price. */
  price: PlannerPrice | null;
  /** ADMIN ONLY — publicPayload.ts strips this. */
  costBreakdown: PlannerCostBreakdown | null;
  enrichment: CityEnrichment[];
  mapStops: Plan['map']['stops'];
  mapLegs: Plan['map']['legs'];
  reasoning: PlannerReasoningLine[];
  /** §9 priced relaxations — surfaced unchanged when the request is infeasible. */
  negotiation?: OptimizeResult['negotiation'];
}

// ---- the join: days[].transit ← the matching plan.legs[] entry -------------------

/**
 * Find the PlanLeg that a thin `day.transit` refers to. Matches on from+to+mode, and
 * disambiguates with `identifier` when the engine supplied one (two legs can share an
 * origin/destination pair across a round trip). Returns undefined when there is no
 * match — the caller then keeps the thin transit rather than guessing.
 */
export function findLegFor(
  transit: NonNullable<DayItem['transit']>, legs: PlanLeg[],
): PlanLeg | undefined {
  const same = legs.filter((l) => l.from === transit.from && l.to === transit.to && l.mode === transit.mode);
  if (same.length <= 1) return same[0];
  const byId = same.find((l) => l.identifier != null && l.identifier === transit.identifier);
  return byId ?? same[0];
}

/** Merge the thin day.transit with its rich PlanLeg. Facts only — nothing invented. */
function hydrateTransit(transit: NonNullable<DayItem['transit']>, leg: PlanLeg | undefined): PlannerTransit {
  const out: PlannerTransit = {
    from: transit.from, to: transit.to, mode: transit.mode as string,
    identifier: transit.identifier ?? null, dep: transit.dep ?? null, arr: transit.arr ?? null,
  };
  if (!leg) return out; // no match ⇒ emit exactly what the day asserted, nothing more
  if (leg.durationMin != null) out.durationMin = leg.durationMin;
  if (leg.distanceKm != null) out.distanceKm = leg.distanceKm;
  if (leg.frequency != null) out.frequency = leg.frequency;
  if (leg.overnight != null) out.overnight = leg.overnight;
  if (leg.positioning != null) out.positioning = leg.positioning;
  // verifyFlag is carried through even when false — the UI's verify rule depends on it
  out.verifyFlag = leg.verifyFlag === true;
  if (leg.pearlSplit) out.pearlSplit = leg.pearlSplit;
  if (leg.decisionRecord) out.decisionRecord = leg.decisionRecord;
  return out;
}

// ---- the reasoning stream: DERIVED from what the engine actually compared --------

/**
 * "Watch it think" (design Screen 2). Each line is a real service the engine compared:
 * `ok:true` = the option it chose, `ok:false` = one it rejected — with the engine's own
 * `note` as the reason. A leg with no `legOptions` contributes NOTHING (we do not
 * script filler). Order = leg order, chosen first within each leg.
 */
/**
 * HE IS WATCHING US THINK. HE SHOULD NOT BE WATCHING US QUERY A DATABASE.
 *
 * The stream was printing the engine's INTERNAL KEY straight onto the screen:
 *
 *     Guwahati → Shillong: ROAD:Guwahati-Shillong
 *
 * That is a row id. It is not a sentence, and it is certainly not a 30-year tour designer
 * thinking out loud. The page promises him a consultant and then shows him our plumbing.
 *
 * The FACTS do not change by one digit. Only the words do.
 */
function spokenMode(id: string | number): string {
  const [mode, ...rest] = String(id || '').split(':');
  const service = rest.join(':').trim();
  switch ((mode || '').toUpperCase()) {
    case 'ROAD':  return 'by road';
    // The train NUMBER is the receipt — it is how he checks us. It stays.
    case 'RAIL':  return service ? `by train ${service}` : 'by train';
    case 'AIR':   return service ? `by flight ${service}` : 'by flight';
    case 'FERRY': return 'by ferry';
    // Something we have not taught it to say. Show the raw value rather than swallow it —
    // an honest ugly line beats a pretty one we invented.
    default:      return service || String(id);
  }
}

export function buildReasoning(legs: PlanLeg[]): PlannerReasoningLine[] {
  const lines: PlannerReasoningLine[] = [];
  for (const leg of legs) {
    const rows = leg.legOptions;
    if (!rows || !rows.length) continue;
    const ordered = [...rows.filter((r) => r.chosen), ...rows.filter((r) => !r.chosen)];
    for (const r of ordered) {
      const dur = fmtDur(r.dur);
      // KEEP THE ARROW. It is compact, it reads instantly, and two tests rightly pin it.
      // The thing that was ugly was never the arrow — it was `ROAD:Guwahati-Shillong`, an
      // internal row id printed onto a page that had just promised him a tour designer.
      const head = `${leg.from} → ${leg.to} — ${spokenMode(r.id)}`
        + (dur ? `, ${dur}` : '');
      lines.push({ text: r.note ? `${head}. ${r.note}` : head, ok: r.chosen === true });
    }
  }
  return lines;
}

/** Per-leg compared services, keyed "From-To", with display strings (design shape). */
export function buildLegOptions(legs: PlanLeg[]): Record<string, PlannerLegOptionRow[]> {
  const out: Record<string, PlannerLegOptionRow[]> = {};
  for (const leg of legs) {
    const rows = leg.legOptions;
    if (!rows || !rows.length) continue;
    out[legKey(leg.from, leg.to)] = rows.map((r: LegOptionRow) => {
      const row: PlannerLegOptionRow = { id: r.id, dur: fmtDur(r.dur), fare: fmtFarePp(r.fare), freq: r.freq };
      if (r.chosen) row.chosen = true;
      if (r.note) row.note = r.note;
      return row;
    });
  }
  return out;
}

/** The public price: band + assumption + levers. Straight from the engine's own
 *  computation — no invented number, no invented discount. Null when there is no
 *  trip cost, and then the UI shows no price rather than a guess. */
export function buildPrice(plan: Plan): PlannerPrice | null {
  const tc = plan.enrichment?.tripCost;
  if (!tc || !tc.assumptions) return null;
  return {
    currency: tc.currency,
    perPersonMin: tc.perPersonMin,
    perPersonMax: tc.perPersonMax,
    assumptions: tc.assumptions,
    levers: tc.levers ?? [],
    ...(tc.car ? { car: { fullDays: tc.car.fullDays, transferLegs: tc.car.transferLegs, vehicle: tc.car.vehicle } } : {}),
  };
}

/** The four cost lines the design renders — straight from the enrichment tripCost. */
export function buildCostBreakdown(plan: Plan): PlannerCostBreakdown | null {
  const tc = plan.enrichment?.tripCost;
  if (!tc) return null; // no enrichment ⇒ NO invented prices
  const b = tc.breakdown;
  const nights = plan.totals?.hotelNights;
  return {
    perPerson: [
      { label: nights != null ? `Hotels · ${nights} nights` : 'Hotels', amount: b.hotel },
      { label: 'Road transport', amount: b.roadTransport },
      { label: 'Trains & flights', amount: b.intercityTransport },
      { label: 'Service & taxes', amount: b.serviceTaxes },
    ],
    pax: tc.pax,
    note: tc.indicative
      ? 'Indicative fares — your final quote confirms exact hotels and GST.'
      : 'Your final quote confirms exact hotels and GST.',
  };
}

// ---- the adapter ----------------------------------------------------------------

/**
 * Build the trip-planner payload from a solve. PURE. `plan` defaults to the
 * recommended archetype's plan when the caller passes one, else `plans[0]` — the
 * SAME plan `loadFromOptimizer` reads, so the CRM and the planner never disagree.
 */
export function toPlannerPayload(
  result: OptimizeResult,
  opts: { request?: string | null; plan?: Plan } = {},
): PlannerPayload {
  const plan = opts.plan ?? result.plans?.[0];
  const cards = result.cards ?? [];

  if (!plan) {
    // an infeasible solve can still carry negotiation[] — surface it, invent nothing
    return {
      request: opts.request ?? null, cards, plan: null, legOptions: {},
      price: null, costBreakdown: null, enrichment: [], mapStops: [], mapLegs: [], reasoning: [],
      ...(result.negotiation ? { negotiation: result.negotiation } : {}),
    };
  }

  const legs = plan.legs ?? [];
  const days: PlannerDay[] = (plan.days ?? []).map((d: DayItem) => {
    const out: PlannerDay = {
      day: d.day, weekday: d.weekday ?? null, city: d.city, activity: d.activity,
      transit: d.transit ? hydrateTransit(d.transit, findLegFor(d.transit, legs)) : null,
    };
    if (d.fatigue != null) out.fatigue = d.fatigue;
    if (d.effort != null) out.effort = d.effort;
    if (d.comfortNote != null) out.comfortNote = d.comfortNote;
    if (d.marker != null) out.marker = d.marker;
    if (d.halt != null) out.halt = d.halt;
    return out;
  });

  return {
    request: opts.request ?? null,
    cards,
    plan: {
      label: plan.label,
      weekdayLock: plan.weekdayLock ?? null,
      sequence: plan.sequence ?? [],
      phaseShift: plan.phaseShift,
      rhythm: plan.rhythm,
      totals: plan.totals,
      verifyBeforeBooking: plan.verifyBeforeBooking ?? [],
      warnings: plan.warnings ?? [],
      ...(plan.contractNotes?.length ? { contractNotes: plan.contractNotes } : {}),
      days,
    },
    legOptions: buildLegOptions(legs),
    price: buildPrice(plan),
    costBreakdown: buildCostBreakdown(plan),
    enrichment: plan.enrichment?.cities ?? [],
    mapStops: plan.map?.stops ?? [],
    mapLegs: plan.map?.legs ?? [],
    reasoning: buildReasoning(legs),
    ...(result.negotiation ? { negotiation: result.negotiation } : {}),
  };
}
