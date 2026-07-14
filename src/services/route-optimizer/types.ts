/**
 * WTI Route Optimizer — domain types.
 *
 * Pure + dependency-free. The engine is deliberately DB-agnostic: the controller
 * injects the gazetteer, curated leg options and constraint library (all read from
 * Postgres), and the engine returns plans. This keeps every stage unit-testable
 * against the Ramayana fixture with no DB or network.
 *
 * The `plan.map` field is emitted in the EXACT `TourRoute` shape that the live
 * Leaflet component (wti-frontend-prod/components/tour/TourRouteMap.tsx) already
 * consumes, so the CRM page reuses that renderer unchanged.
 */

// Type-only import (erased at runtime, so no cycle): the compiled brief the engine is
// bound by. Its home is intent.ts, which imports nothing from physiology.ts by design.
import type { PlanContract } from './intent';

// ---- geography ---------------------------------------------------------------

export type LatLng = readonly [number, number]; // [lat, lng]

/** Weekday index: Mon=0 … Sun=6 (matches operating_days bit order). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const WEEKDAY_NAMES = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;

/** Modes on the wire mirror the map contract; ROAD/RAIL/AIR/FERRY are canonical. */
export type Mode = 'ROAD' | 'RAIL' | 'AIR' | 'FERRY';

/** Map-facing leg mode (lower-case) required by TourRouteMap. */
export type MapLegMode = 'road' | 'flight' | 'train' | 'helicopter' | 'ferry';

export interface CityNode {
  name: string;
  coord: LatLng;
  /** transport profile (nearest airport/railhead, road-quality, constraints). */
  profile?: CityProfile;
  /** true when we had to fall back to a road-only node (no profile row). */
  degraded?: boolean;
  /** ⚠️ IRON LAW L2 — metres above sea level. An airport 100 km from Yamunotri AS THE CROW FLIES
   *  is the best part of a day away UP A MOUNTAIN. Without this, the airport catchment is a
   *  straight line drawn across the Garhwal Himalaya, and that is how we came to sell a
   *  68-year-old couple a "flight to Yamunotri" — a village with no runway. */
  elevationM?: number | null;
}

export interface CityProfile {
  nearestAirportIata?: string;
  airportTransferKm?: number;
  airportRouteCount?: number;
  nearestRailheadCode?: string;
  railheadTransferKm?: number;
  /** 1 (worst: ghat/LWE) … 5 (trunk highway). */
  roadQualityIndex?: number;
  constraints?: CityConstraint[];
}

// ---- constraints -------------------------------------------------------------

export interface GateWindow {
  kind: 'gate';
  name: string; // e.g. "Mannanur–Domalapenta (Amrabad)"
  /** local clock the gate is CLOSED, inclusive start → exclusive end, e.g. "21:00-06:00". */
  closed: string;
  /** which corridor this gate sits on (arrival city must cross it inbound). */
  onCorridorTo?: string;
}
export interface DaylightOnly {
  kind: 'daylight';
  name: string; // e.g. "NH30 Konta corridor"
  onCorridorTo?: string;
}
export interface PermitReq {
  kind: 'permit';
  name: string;
  note?: string;
}
export type CityConstraint = GateWindow | DaylightOnly | PermitReq;

// ---- transport options -------------------------------------------------------

/**
 * US-800a — WHERE A ROAD LEG'S CLOCK CAME FROM. LOAD-BEARING: physiology.vehicleHours()
 * branches on this, and that branch decides whether a BODY GATE fires.
 *
 *   'measured' — a real routing service has DRIVEN this road (Google Directions). It is a
 *                FACT. A fitted model may NEVER floor a fact.
 *   'routed'   — a router's OPINION (OSRM). OSRM cannot tell a mountain from a motorway —
 *                it claims 79 km/h on the Guwahati->Shillong road, which is 31. So we FLOOR
 *                it with the climb model. Math.max. A TIGHTENING, never a loosening.
 *   'derived'  — nobody drove it. Our climb model alone. An ESTIMATE, and we say so.
 *
 * ABSENT MEANS 'routed'. An unlabelled leg keeps the conservative floor, byte for byte, so
 * this type can never loosen a gate that exists today.
 *
 * THE ONLY WRITER OF 'measured' IN THIS CODEBASE IS THE GOOGLE DIRECTIONS ADAPTER IN
 * roadTerrainDb.ts, and __tests__/durationSource.test.ts enforces that by reading the
 * source of every file in this directory. Made unrepresentable, not merely forbidden.
 */
export type DurationSource = 'measured' | 'routed' | 'derived';

export interface LegOption {
  id?: number | string;
  from: string; // city name
  to: string; // city name
  mode: Mode;
  /** '17416 Haripriya Exp' | '6E JGB-HYD' | null for a plain road leg. */
  identifier?: string | null;
  fromNode?: string | null; // station code / IATA
  toNode?: string | null;
  distanceKm?: number | null;
  durationMin?: number | null;
  /** local departure "HH:MM" (24h) and arrival; arrDayOffset≥1 = next calendar day. */
  depTime?: string | null;
  arrTime?: string | null;
  arrDayOffset?: number;
  /** Mon..Sun bitmask; 127 = daily. */
  operatingDays?: number;
  classes?: string[];
  farePpMin?: number | null;
  farePpMax?: number | null;
  /** 1 (single daily ATR) … 5 (trunk). */
  reliability?: number;
  seasonal?: boolean;
  source?: string;
  /** US-800a — WHERE `durationMin` CAME FROM. Absent = 'routed'. It decides whether
   *  physiology.vehicleHours() floors this clock with the climb model. See DurationSource. */
  durationSource?: DurationSource;
  verifiedAt?: string | null; // ISO
  /** rail+road hybrid (spec §4.6 rung 2): this RAIL option drops at a railhead
   *  `viaNode`, then an onward Band-A road transfer of `onwardRoadKm`/`onwardRoadMin`
   *  reaches the city. The engine folds the onward road into door-to-door access
   *  (optimize.legCtx) so the DDCV charges it honestly. Additive + optional. */
  onwardRoadKm?: number;
  onwardRoadMin?: number;
  viaNode?: string | null;

  /** US-822 — THE AIRPORT IS NOT IN THE CITY. A flight from Kanyakumari is a 90 km drive to
   *  Trivandrum first, and a plan that hides that is not a plan, it is a brochure. These are
   *  the road transfers at each end, folded into door-to-door access by optimize.legCtx --
   *  exactly as the rail+road hybrid above already does, and as its comment already promised
   *  ("a far drop railhead loses to a nearer one, EXACTLY LIKE A FAR AIRPORT"). Additive and
   *  optional: a flight whose airport is in the city carries 0 and behaves as before. */
  accessFromKm?: number;
  accessFromMin?: number;
  accessToKm?: number;
  accessToMin?: number;
  /** the airport cities actually used, so Law 4 can NAME them to him. */
  fromAirportCity?: string | null;
  toAirportCity?: string | null;
  /** US-847/US-860 -- a ONE-STOP flight: both hops are real scheduled sectors that meet at
   *  this hub city. Existence-checked, never time-checked: the connection must be confirmed
   *  at booking (verifyFlag rides with it), and every consumer of this option is obliged to
   *  SAY SO. Absent = a direct sector. */
  viaHub?: string | null;
}

// ---- input -------------------------------------------------------------------

export type Objective = 'TIME' | 'COST' | 'EASE' | 'BALANCED';
export type GroupProfile = 'standard' | 'family' | 'senior';

export interface InputCity {
  name: string;
  nights?: number;
  mustVisitPois?: string[];
  /**
   * Custom-stop coordinates. Supplied when the executive adds a place that is NOT
   * in world_cities (same flow as the route editor's "+"): the optimizer uses these
   * coords directly, and the controller self-registers the stop into world_cities
   * (reusing POST /tours/route/city) so it is searchable on the next run.
   */
  lat?: number | null;
  lng?: number | null;
  /** true when this stop was hand-added with coords (not resolved from the gazetteer). */
  custom?: boolean;
}

/**
 * §14 Traveler Psyche Profile — eight psyche dimensions, each ∈ [−1,+1], default 0
 * (= the physiology-class + segment prior). It rescales the DDCV SOFT weights only
 * (`w' = w ∘ M(TPP)`, see route-optimizer/tpp.ts) and can NEVER override a body-truth
 * hard gate (§3 / §14.1). Additive + optional: absent TPP = the v1.0 engine exactly.
 */
export interface TPP {
  /** Pace: −1 savour (fewer, deeper) … +1 packer (more, faster). */
  P1?: number;
  /** Novelty: −1 comfort-seeking … +1 adventure-seeking. */
  P2?: number;
  /** Structure: −1 spontaneous … +1 planned-rigid (soft rules; not a DDCV weight). */
  P3?: number;
  /** Crowd tolerance: −1 solitude … +1 festival-energy (soft rules; not a DDCV weight). */
  P4?: number;
  /** Budget elasticity: −1 price-first … +1 comfort-first. */
  P5?: number;
  /** Transit meaning: −1 transit=cost … +1 transit=experience. */
  P6?: number;
  /** Control need: −1 "just decide for me" … +1 wants options & reasons (UI only). */
  P7?: number;
  /** Anchoring: −1 wanderer … +1 nester/hub-and-spoke (soft rules; not a DDCV weight). */
  P8?: number;
}

export interface OptimizeInput {
  /** US-803c — city name (lower-case) -> metres. INJECTED; the engine never reads a DB.
   *  Feeds roadQualityIndex, which feeds terrainSpeedKmh, which feeds the BODY GATES.
   *  Absent => the engine keeps its existing safe default. We never guess an altitude. */
  elevations?: Record<string, number>;
  cities: InputCity[];
  start?: string | null;
  end?: string | null;
  objective: Objective;
  /** 'roundtrip' appends a return journey to the origin via the access gateway. */
  tripType?: 'oneway' | 'roundtrip';
  month?: number; // 1..12 (seasonality)
  pax?: number;
  profile?: GroupProfile;
  overnightTrains?: boolean;
  maxRoadKmDay?: number; // hard cap; default 350 (senior 300)
  /** fixed Day-1 weekday if the client already has a date; else engine derives the lock. */
  startWeekday?: Weekday | null;
  /** §6.1: how many days the traveller's start date can slide (0/undefined = fixed).
   *  When > 0 and startWeekday is set, the engine tries a whole-trip phase shift to
   *  align weekday-limited trains before any physical fallback. */
  softStartWindowDays?: number;
  pins?: { legFrom: string; legTo: string; mode?: Mode; optionId?: number | string }[];
  /** halts the executive accepted from the suggestions — only these are inserted. */
  acceptedHalts?: { legFrom: string; legTo: string; name: string; lat: number; lng: number }[];
  /** §9 the traveller's day budget (e.g. 8). When set and the honest plan runs
   *  longer, the request is infeasible and optimize() attaches a negotiation. */
  dayBudget?: number;
  /** §14 Traveler Psyche Profile — rescales the DDCV soft weights per mind. Absent =
   *  today's behaviour exactly; can never relax a body-truth hard gate. */
  tpp?: TPP;
  /** Sprint 7 — THE BRIEF, compiled from the traveller's own sentence (intent.ts). His
   *  refusals become candidate filters, his qualified refusals become ordeal ceilings, and
   *  his comfort becomes a TIGHTENING of the body gates (one direction only — see
   *  intent.ts). Absent ⇒ today's behaviour exactly.
   *
   *  Law 1: what he says he wants is not one more term to be outvoted by cost. It is the
   *  brief, and it enters the engine HERE. */
  contract?: PlanContract;
}

/** A suggested (opt-in) en-route overnight town on an over-long road leg. */
export interface HaltSuggestion {
  name: string;
  lat: number;
  lng: number;
  tourCount: number;   // how many WTI tours feature it (popularity)
  monuments: number;   // POI monument count (attractions)
  detourKm: number;    // extra km vs. driving straight through
  atKm: number;        // distance along the leg where the break falls
  why: string;         // human-readable rationale
}

// ---- output ------------------------------------------------------------------

/** §10 decision record — the "Why this way?" note. Facts only; the
 *  Sprint-5 narration AI polishes the voice, never the facts. */
export interface DecisionRecord { winner: string; runnerUp: string | null; marginText: string; why: string }

/** §10 one compared service on a leg (ranked, chosen flagged). `dur` = honest
 *  door-to-door minutes; `fare` = indicative ₹ per person. */
export interface LegOptionRow { id: string | number; dur: number | null; fare: number | null; freq: string; chosen: boolean; note?: string }

export interface PlanLeg {
  from: string;
  to: string;
  mode: Mode;
  identifier?: string | null;
  dep?: string | null;
  arr?: string | null;
  distanceKm?: number | null;
  durationMin?: number | null;
  farePpBand?: [number, number] | null;
  /** thin/unverified/seasonal → must be reconfirmed before booking. */
  verifyFlag?: boolean;
  /** road leg that exists purely to reach a gateway (airport/railhead), not a sightseeing stop. */
  positioning?: boolean;
  /** §4.4 pearl-on-the-string: an over-cap road leg should be split at this anchor. */
  pearlSplit?: { anchor: string; detourPct: number; subHrs?: [number, number]; why?: string | null };
  /** §4.4: over-cap road leg with NO worthwhile anchor — prefer re-sequencing. */
  deadHalt?: boolean;
  /** true overnight rail (saves a hotel night). */
  overnight?: boolean;
  /** US-847/US-860 — the AIR leg's honest anatomy. A flight that lands at a different town
   *  than the leg's destination must NAME the airport and the road transfer; a one-stop
   *  must NAME its hub. Absent on a same-city direct flight. */
  viaHub?: string | null;
  fromAirportCity?: string | null;
  toAirportCity?: string | null;
  accessFromKm?: number;
  accessFromMin?: number;
  accessToKm?: number;
  accessToMin?: number;
  note?: string;
  /** opt-in break-town suggestions when this road leg exceeds the day cap. */
  haltSuggestions?: HaltSuggestion[];
  /** Mon..Sun bitmask of the chosen service (127 = daily). */
  operatingDays?: number;
  /** human frequency, e.g. "daily" or "Mon, Wed only". */
  frequency?: string;
  /** every mode/service that was compared for this leg — lets the desk pick the
   *  budget train over the fast flight, etc. */
  modeOptions?: LegModeOption[];
  /** §10 decision record: winner / runner-up / margin / why. Additive +
   *  absent-safe (UI renders nothing when absent). */
  decisionRecord?: DecisionRecord;
  /** §10 every service compared for this leg, ranked best→worst, chosen flagged. */
  legOptions?: LegOptionRow[];
  /** Sprint 7 / Law 4 — we had to use a mode the traveller REFUSED, because it was the only
   *  service on this leg. The plan is still complete, but it is never silent about it: the
   *  leg carries the consultant's paragraph in `note`. */
  contractBreach?: boolean;
}

export interface LegModeOption {
  mode: Mode;
  identifier?: string | null;
  durationMin?: number | null;
  distanceKm?: number | null;
  costPp: number;          // indicative ₹ per person
  frequency: string;       // "daily" / "Mon, Wed only"
  dep?: string | null;
  arr?: string | null;
  overnight?: boolean;
  chosen?: boolean;
}

export interface DayItem {
  day: number;
  weekday?: string | null;
  city: string;
  activity: string;
  transit?: { from: string; to: string; mode: Mode; identifier?: string | null; dep?: string | null; arr?: string | null } | null;
  roadKm?: number;
  transitMin?: number;
  /** true when this city is an inserted en-route overnight halt (not an original input city). */
  halt?: boolean;
  /** hard-constraint violations that made this day infeasible (day was rejected/rerouted). */
  violations?: string[];
  /** §7 per-day comfort projection (Sprint 3 inc-2): 'full' = a heavy travel day,
   *  'easy' = rest/light/overnight. */
  fatigue?: 'easy' | 'full';
  /** effort 0–100 = this day's load vs the party's daily cap. */
  effort?: number;
  /** one plain-voice line on how the day feels. */
  comfortNote?: string;
  /** short highlight tag, e.g. "Rest day" / "Longest drive · 4½ h" / "Overnight train". */
  marker?: string;
}

export interface Totals {
  roadKm: number;
  transitHrs: number;
  costPpBand: [number, number] | null;
  easeScore: number; // 0..100
  hotelNights: number;
}

// The map contract — must match TourRouteMap.tsx exactly.
export interface MapRouteLeg { day: number; from: string; to: string; mode: MapLegMode; km: number | null; timeText: string | null; estimated?: boolean; /** real road polyline [lat,lng][] following the road, when available. */ geometry?: [number, number][] }
export interface MapRouteStop { order: number; name: string; day: number; lat: number | null; lng: number | null }
export interface MapRoute { stops: MapRouteStop[]; legs: MapRouteLeg[]; roadTotalKm: number; modes: MapLegMode[] }

export interface PlanComparison {
  distanceKm: number;   // TOTAL journey distance across all modes
  roadKm: number;       // of which by road
  driveHrs: number;
  transitHrs: number;
  touristStops: number;   // # of stops that are WTI tourist destinations
  amenityScore: number;   // 0..100 hotel-availability proxy
  easeScore: number;
  costPpBand: [number, number] | null;
  weekdayLock: string | null;
}

export interface Plan {
  /** ⚠️ US-835 — the Iron Law's verdict on THIS plan, stamped at birth in buildPlan().
   *  Non-empty = the plan contains a fact we cannot prove, and optimize() will not hand it out. */
  truthViolations?: { law: string; what: string; detail: string }[];
  sequence: string[];
  weekdayLock: string | null;
  legs: PlanLeg[];
  days: DayItem[];
  totals: Totals;
  warnings: string[];
  /** US-834 — long road days he must be TOLD about and must AGREE to. Never assumed. Law 4. */
  consents?: string[];
  verifyBeforeBooking: string[];
  map: MapRoute;
  /** which objective produced this plan (best vs. alternates). */
  label?: string;
  /** corridor identity for A/B comparison (e.g. "A", "B"). */
  corridorId?: string;
  corridorLabel?: string;
  /** the date-flexible alternate (daily services only). */
  dateFlexible?: boolean;
  /** §3.3/§7 fatigue-ledger + rhythm-gate summary for this plan. */
  rhythm?: { ok: boolean; peakF: number; headline?: string; violations: { day: number; kind: string; detail: string }[] };
  /** §6.1 whole-trip phase shift applied to align weekday-limited trains. */
  phaseShift?: { aligned: boolean; shiftDays: number; startWeekday: string | null; reason: string };
  /** Sprint 7 / Law 4 — every leg where we could not keep to his brief, said out loud. These
   *  ride on the PLAN (not in the internal warnings, which the public payload strips) because
   *  the traveller is the person who most needs to read them. */
  contractNotes?: string[];
  /** side-by-side comparison metrics. */
  comparison?: PlanComparison;
  /** AI enrichment layer output (fares, hotels, guides, city content, trip cost). */
  enrichment?: PlanEnrichment;
}

/** §8 archetype id — the three named plans the Pareto set collapses into. */
export type ArchetypeId = 'swift' | 'balanced' | 'gentle';

/** §8 archetype card — a design-ready summary of one full scheduled plan. Facts
 *  only; `fatigue[]` mirrors the plan's per-day comfort projection (Sprint 3 inc-2).
 *  Field names match the design data.js / handoff §4 contract EXACTLY. `totals` is
 *  the §4 canonical nested shape; the flat `costPpBand`/`easeScore` mirror it for the
 *  data.js binding (parent handoff §5). */
export interface ArchetypeCard {
  id: ArchetypeId;
  label: string;
  recommended: boolean;
  days: number;
  hotelNights: number;
  totals: { costPpBand: [number, number] | null; easeScore: number };
  costPpBand: [number, number] | null;
  easeScore: number;
  sequence: string[];
  fatigue: ('easy' | 'full')[];
  /** US-610 — the cards this one absorbed, because they were the SAME TRIP. Two doors into
   *  the same room is a lie, and we would rather show one door and say so. Additive +
   *  absent-safe: an un-merged card carries neither field, and the UI renders as before. */
  mergedFrom?: ArchetypeId[];
  /** "For your trip, the balanced plan and the gentle plan turn out to be the same, so we
   *  show it once." We do not hide the merge; we report it. */
  note?: string;
}

/** §9 the classic relaxation kinds a senior expert offers on an infeasible request. */
export type RelaxationKind =
  | 'add_day' | 'drop_node' | 'upgrade_mode' | 'shift_start_date' | 'allow_1_heavy_day' | 'swap_node';

/** §9 one priced relaxation — plain, facts-only English naming what it costs (days /
 *  ₹ per person / comfort). The Sprint-5 narration AI polishes the voice, never the
 *  facts. `deltaCostPp` is ₹ per person vs the baseline; `deltaFatigue` is the peak-
 *  fatigue delta. The optional `feasibilityGained`/`experienceLost`/`score` diagnostics
 *  expose the ranking key (feasibility gained ÷ experience lost). */
export interface Relaxation {
  kind: RelaxationKind;
  label: string;
  deltaDays: number;
  deltaCostPp: number;
  deltaFatigue: number;
  plainText: string;
  feasibilityGained?: number;
  experienceLost?: number;
  score?: number;
  /** relies on a thin/unverified candidate — reconfirm before booking. */
  verifyFlag?: boolean;
}

export interface OptimizeResult {
  plans: Plan[];
  /** §8 Swift/Balanced/Gentle archetype cards. Additive + optional — plans[] stays
   *  present + unchanged so loadFromOptimizer (reads plans[0]) is safe. */
  cards?: ArchetypeCard[];
  /** §9 top-3 priced relaxations when the request is infeasible / over the day
   *  budget. Additive + optional — absent on a feasible solve. */
  negotiation?: Relaxation[];
}

// ---- enrichment (AI layer) output ------------------------------------------
// Attached by src/services/enrichment/orchestrator.ts. Pure type here so the
// engine stays dependency-free (no import cycle into the enrichment service).

export interface EnrichedHotel {
  name: string; rating: number | null; reviewCount: number | null;
  pricePnMin: number | null; pricePnMax: number | null;
  source: string; sourceUrl: string | null; blurb: string | null; rank: number;
}
export interface EnrichedGuide {
  name: string; languages: string[]; phone: string | null; email: string | null;
  recognition: string; rating: number | null; source: string; sourceUrl: string | null;
  verified: boolean; piiFlag: boolean;
}
export interface EnrichedContent {
  intro: string | null;
  attractions: { name: string; why?: string; hours?: string; sourceUrl?: string }[];
  itineraryBody: string | null; bestTime: string | null;
  uniqueFacts: string[]; sources: string[];
}
export interface CityEnrichment {
  city: string;
  overnight: boolean;
  hotels?: EnrichedHotel[];
  guides?: EnrichedGuide[];
  content?: EnrichedContent;
  enriching?: boolean;   // true when a background job was enqueued for a miss
  cityId?: number;       // world_cities.id — key for city_enrichment polling (E-1)
}
/** What the price ASSUMED. Never publish a band without it — a price without its
 *  assumption printed next to it is not a price, it is bait. (Founder, 2026-07-11.) */
export interface TripCostAssumptions {
  pax: number;
  tier: string;
  tierLabel: string;          // "3 star"
  vehicle: string;            // "Sedan" / "Innova + Sedan"
  hotelSource: 'contracted' | 'live' | 'estimate';
  landOnly: boolean;
  note: string;               // "These are estimated costs based on a 3 star hotel…"
  includes: string[];
  excludes: string[];
}
/** A lever the traveller can actually pull, and what it does to the price. The same
 *  computation, re-run — never an invented discount. */
export interface TripCostLever {
  kind: 'GROUP_SIZE' | 'HOTEL_LEVEL';
  label: string;
  perPersonMin: number;
  perPersonMax: number;
  current: boolean;
  delta?: string;             // "₹11,000 less each"
}
export interface TripCostSummary {
  currency: string;
  perPersonMin: number; perPersonMax: number;
  totalMin: number; totalMax: number;
  breakdown: { hotel: number; roadTransport: number; intercityTransport: number; serviceTaxes: number };
  tier: string; pax: number; indicative: boolean; gstPending: boolean;
  /** the assumption, said out loud — public-safe */
  assumptions?: TripCostAssumptions;
  /** group-size and hotel-level levers — public-safe */
  levers?: TripCostLever[];
  /** what the vehicle actually does — public-safe, and it explains the road line */
  car?: { fullDays: number; transferLegs: number; vehicle: string; perDay: number; perLeg: number };
}
export interface PlanEnrichment {
  cities: CityEnrichment[];
  tripCost?: TripCostSummary;
  enriching: boolean;     // true when anything is still filling in the background
  generatedAt: string;
}
