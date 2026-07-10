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
  verifiedAt?: string | null; // ISO
  /** rail+road hybrid (spec §4.6 rung 2): this RAIL option drops at a railhead
   *  `viaNode`, then an onward Band-A road transfer of `onwardRoadKm`/`onwardRoadMin`
   *  reaches the city. The engine folds the onward road into door-to-door access
   *  (optimize.legCtx) so the DDCV charges it honestly. Additive + optional. */
  onwardRoadKm?: number;
  onwardRoadMin?: number;
  viaNode?: string | null;
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

export interface OptimizeInput {
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
  sequence: string[];
  weekdayLock: string | null;
  legs: PlanLeg[];
  days: DayItem[];
  totals: Totals;
  warnings: string[];
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
}

export interface OptimizeResult {
  plans: Plan[];
  /** §8 Swift/Balanced/Gentle archetype cards. Additive + optional — plans[] stays
   *  present + unchanged so loadFromOptimizer (reads plans[0]) is safe. */
  cards?: ArchetypeCard[];
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
export interface TripCostSummary {
  currency: string;
  perPersonMin: number; perPersonMax: number;
  totalMin: number; totalMax: number;
  breakdown: { hotel: number; roadTransport: number; intercityTransport: number; serviceTaxes: number };
  tier: string; pax: number; indicative: boolean; gstPending: boolean;
}
export interface PlanEnrichment {
  cities: CityEnrichment[];
  tripCost?: TripCostSummary;
  enriching: boolean;     // true when anything is still filling in the background
  generatedAt: string;
}
