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
  month?: number; // 1..12 (seasonality)
  pax?: number;
  profile?: GroupProfile;
  overnightTrains?: boolean;
  maxRoadKmDay?: number; // hard cap; default 350 (senior 300)
  /** fixed Day-1 weekday if the client already has a date; else engine derives the lock. */
  startWeekday?: Weekday | null;
  pins?: { legFrom: string; legTo: string; mode?: Mode; optionId?: number | string }[];
}

// ---- output ------------------------------------------------------------------

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
  /** true overnight rail (saves a hotel night). */
  overnight?: boolean;
  note?: string;
}

export interface DayItem {
  day: number;
  weekday?: string | null;
  city: string;
  activity: string;
  transit?: { from: string; to: string; mode: Mode; identifier?: string | null; dep?: string | null; arr?: string | null } | null;
  roadKm?: number;
  transitMin?: number;
  /** hard-constraint violations that made this day infeasible (day was rejected/rerouted). */
  violations?: string[];
}

export interface Totals {
  roadKm: number;
  transitHrs: number;
  costPpBand: [number, number] | null;
  easeScore: number; // 0..100
  hotelNights: number;
}

// The map contract — must match TourRouteMap.tsx exactly.
export interface MapRouteLeg { day: number; from: string; to: string; mode: MapLegMode; km: number | null; timeText: string | null; estimated?: boolean }
export interface MapRouteStop { order: number; name: string; day: number; lat: number | null; lng: number | null }
export interface MapRoute { stops: MapRouteStop[]; legs: MapRouteLeg[]; roadTotalKm: number; modes: MapLegMode[] }

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
}

export interface OptimizeResult {
  plans: Plan[];
}
