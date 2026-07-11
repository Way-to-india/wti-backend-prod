/**
 * TRIP COST MODEL — the honest price engine (rebuilt 2026-07-11, founder rulings).
 *
 * WHY THIS WAS REBUILT
 * The first version charged a full day of car hire for EVERY day of the trip
 * (`roadDays = totalDays - airLegs`) and put every senior traveller in a 4-star hotel.
 * A 6-day Golden Triangle for two came out at ~₹43,000 per person — roughly three
 * times what the same trip is advertised for on our own tour pages. A price that is
 * wrong in public is the one mistake that destroys trust fastest.
 *
 * THE FOUR LAWS THIS FILE OBEYS (founder, 2026-07-11)
 *
 *  1. THE CAR IS CHARGED FOR WHAT IT ACTUALLY DOES.
 *       - an intercity ROAD day  → OUTSTATION, full-day rate
 *       - a day sightseeing in one city → AT DISPOSAL, full-day rate
 *       - a day whose intercity movement is a TRAIN or a FLIGHT → the car only runs
 *         to the station/airport and away from the next one → TRANSFER LEGS, priced
 *         per leg (Sedan ₹2,000 · Innova ₹3,000 · Tempo ₹6,000 per leg), NOT a day.
 *     Two legs (a drop and a pickup) on a train day = 2 × the leg rate.
 *
 *  2. THE DEFAULT IS 3-STAR, FOR EVERYONE. Age is not a budget. The old rule
 *     ("senior ⇒ 4-star") silently added ₹10,000 to a family's trip. Every price we
 *     show must SAY it is a 3-star estimate and that the real cost moves with the
 *     hotel chosen. `assumptions.note` carries that sentence — never print a band
 *     without it.
 *
 *  3. THE RATE LADDER. Hotels are priced from (i) our own CONTRACTED rates when we
 *     have them, else (ii) a live hotel source when one is wired, else (iii) this
 *     estimate. `assumptions.hotelSource` says which rung was used, out loud.
 *     NOTE (2026-07-11): the contracted-rate tables are EMPTY (0 rows). Rung (iii)
 *     is what actually runs today, and will for months. It has to be good on its own.
 *
 *  4. NEVER A PRECISE NUMBER. "₹43,247" is a promise we cannot keep, and it is the
 *     exact string a traveller pastes into a competitor's search box. We publish a
 *     ROUNDED BAND, the assumption beneath it, and the two LEVERS that actually move
 *     it — group size and hotel level. A traveller who can see "two more of you and
 *     it drops ₹11,000 each" becomes our salesman inside his own group.
 */

import type { DayItem } from '@/services/route-optimizer/types';

// ---------------------------------------------------------------------------
// Rates (founder-specified, ₹)
// ---------------------------------------------------------------------------

export type HotelTier = 'standard' | '3' | '4' | '5';
export const MARGIN_RATE = 0.15;
export const GST_RATE = 0.05;

/** Per room, per night, double sharing, breakfast included. */
export const HOTEL_PER_NIGHT: Record<HotelTier, number> = { standard: 3500, '3': 5500, '4': 7500, '5': 20000 };

export const TIER_LABEL: Record<HotelTier, string> = {
  standard: 'budget', '3': '3 star', '4': '4 star', '5': '5 star',
};

/** A day the vehicle is with the party: outstation, or at disposal for sightseeing. */
const FULL_DAY = { SEDAN: 5500, INNOVA: 6500, TEMPO: 11500 } as const;

/** A single airport/railway-station run — a pickup OR a drop. NOT a day. */
const TRANSFER_LEG = { SEDAN: 2000, INNOVA: 3000, TEMPO: 6000 } as const;

type VehicleKey = keyof typeof FULL_DAY;

/** How many travellers each vehicle seats, comfortably, with luggage. */
const SEATS: Record<VehicleKey, number> = { SEDAN: 3, INNOVA: 5, TEMPO: 12 };

/** Every sensible vehicle set we would actually send out. */
const FLEETS: VehicleKey[][] = [
  ['SEDAN'],
  ['INNOVA'],
  ['INNOVA', 'SEDAN'],
  ['TEMPO'],
  ['TEMPO', 'SEDAN'],
  ['TEMPO', 'INNOVA'],
  ['TEMPO', 'TEMPO'],
];

const seatsOf = (f: VehicleKey[]) => f.reduce((s, v) => s + SEATS[v], 0);
const dayCostOf = (f: VehicleKey[]) => f.reduce((s, v) => s + FULL_DAY[v], 0);

/**
 * The CHEAPEST vehicle set that seats the whole group.
 * (Before this, a party of 6 was quoted an Innova + a Sedan at ₹12,000 a day when a
 * Tempo Traveller seats them for ₹11,500 — so the per-person price went UP as the
 * group grew, which is nonsense to the traveller and a costlier quote than we need.)
 */
export function vehiclesForPax(pax: number): VehicleKey[] {
  const n = Math.max(pax, 1);
  const fits = FLEETS.filter((f) => seatsOf(f) >= n);
  if (!fits.length) return ['TEMPO', 'TEMPO'];
  return fits.slice().sort((a, b) => dayCostOf(a) - dayCostOf(b) || a.length - b.length)[0];
}

export const vehiclePerDay = (pax: number): number =>
  vehiclesForPax(pax).reduce((s, v) => s + FULL_DAY[v], 0);

export const vehiclePerTransferLeg = (pax: number): number =>
  vehiclesForPax(pax).reduce((s, v) => s + TRANSFER_LEG[v], 0);

export const vehicleLabel = (pax: number): string =>
  vehiclesForPax(pax).map((v) => (v === 'TEMPO' ? 'Tempo Traveller' : v === 'INNOVA' ? 'Innova' : 'Sedan')).join(' + ');

export const roomsForPax = (pax: number): number => Math.ceil(Math.max(pax, 1) / 2);

/** Map an enrichment hotel category to a tier, and back. */
export function categoryToTier(cat?: string | null): HotelTier {
  switch ((cat || '').toLowerCase()) {
    case 'budget': return 'standard';
    case 'premium': return '4';
    case 'luxury': return '5';
    default: return '3';
  }
}
export function tierToCategory(tier: HotelTier): 'budget' | 'standard' | 'premium' | 'luxury' {
  return tier === 'standard' ? 'budget' : tier === '3' ? 'standard' : tier === '4' ? 'premium' : 'luxury';
}

// ---------------------------------------------------------------------------
// LAW 1 — what the car actually does, day by day
// ---------------------------------------------------------------------------

export type CarDayKind = 'OUTSTATION' | 'AT_DISPOSAL' | 'TRANSFER';

export interface CarDay {
  day: number;
  kind: CarDayKind;
  /** TRANSFER only: how many station/airport runs this day pays for. */
  transferLegs: number;
  /** plain-English reason, shown to the operator, never guessed. */
  why: string;
}

/**
 * Classify every day of the plan by what the vehicle is actually asked to do.
 * PURE — reads only the day list the engine already produced.
 *
 *   day has an intercity ROAD leg      → OUTSTATION   (full day)
 *   day has an intercity TRAIN/FLIGHT  → TRANSFER × 2 (a drop, then a pickup)
 *   day has no intercity movement      → AT_DISPOSAL  (full day of local sightseeing)
 */
export function classifyCarDays(days: DayItem[]): CarDay[] {
  return (days || []).map((d) => {
    const mode = d.transit?.mode;
    if (!mode) {
      return { day: d.day, kind: 'AT_DISPOSAL', transferLegs: 0, why: `Sightseeing in ${d.city} — car at disposal for the day` };
    }
    if (mode === 'ROAD') {
      return { day: d.day, kind: 'OUTSTATION', transferLegs: 0, why: `${d.transit!.from} to ${d.transit!.to} by road — full day of the vehicle` };
    }
    // TRAIN / FLIGHT / FERRY: the car only runs to the station or airport and away
    // from the one at the other end. Two runs, priced per leg — not a day of hire.
    const where = mode === 'AIR' ? 'airport' : mode === 'FERRY' ? 'jetty' : 'railway station';
    return {
      day: d.day, kind: 'TRANSFER', transferLegs: 2,
      why: `${d.transit!.from} to ${d.transit!.to} by ${mode === 'AIR' ? 'flight' : mode === 'FERRY' ? 'ferry' : 'train'} — ${where} drop and pickup only`,
    };
  });
}

export interface CarCost {
  total: number;
  fullDays: number;
  transferLegs: number;
  vehicle: string;
  perDay: number;
  perLeg: number;
  days: CarDay[];
}

/** The whole-group vehicle cost, built from what the car actually does. */
export function computeCarCost(days: DayItem[], pax: number): CarCost {
  const carDays = classifyCarDays(days);
  const perDay = vehiclePerDay(pax);
  const perLeg = vehiclePerTransferLeg(pax);
  let fullDays = 0, transferLegs = 0;
  for (const d of carDays) {
    if (d.kind === 'TRANSFER') transferLegs += d.transferLegs;
    else fullDays += 1;
  }
  return {
    total: fullDays * perDay + transferLegs * perLeg,
    fullDays, transferLegs, vehicle: vehicleLabel(pax), perDay, perLeg, days: carDays,
  };
}

// ---------------------------------------------------------------------------
// LAW 4 — a band, never a precise number
// ---------------------------------------------------------------------------

/** Round a per-person figure the way an honest estimate should read: the low end
 *  DOWN to the nearest ₹500, the high end UP to the nearest ₹500, and the band
 *  never narrower than ₹2,000 — because we do not know it that precisely. */
export function roundBand(min: number, max: number): [number, number] {
  const lo = Math.max(0, Math.floor(min / 500) * 500);
  let hi = Math.ceil(Math.max(max, min) / 500) * 500;
  if (hi - lo < 2000) hi = lo + 2000;
  return [lo, hi];
}

// ---------------------------------------------------------------------------
// The cost
// ---------------------------------------------------------------------------

export type HotelSource = 'contracted' | 'live' | 'estimate';

export interface TripCostInput {
  pax: number;
  tier: HotelTier;
  /** the engine's day list — the car cost is derived from it, not guessed. */
  days: DayItem[];
  hotelNights: number;
  /** per-person intercity fares already resolved (trains/flights), ₹. */
  intercityFarePpMin: number;
  intercityFarePpMax: number;
  /** real ₹/room/night when a contracted or live rate exists. */
  hotelPerNightOverride?: number | null;
  hotelSource?: HotelSource;
}

export interface TripCostAssumptions {
  pax: number;
  tier: HotelTier;
  tierLabel: string;
  vehicle: string;
  hotelSource: HotelSource;
  landOnly: boolean;
  /** THE sentence. Never publish a band without it. */
  note: string;
  includes: string[];
  excludes: string[];
}

/** A lever the traveller can actually pull — and what it does to the price.
 *  This is the difference between a number he argues with and a number he acts on. */
export interface TripCostLever {
  kind: 'GROUP_SIZE' | 'HOTEL_LEVEL';
  label: string;
  perPersonMin: number;
  perPersonMax: number;
  current: boolean;
  /** e.g. "₹11,000 less each" — computed against the current choice. */
  delta?: string;
}

export interface TripCost {
  pax: number;
  tier: HotelTier;
  currency: string;
  perPersonMin: number;
  perPersonMax: number;
  totalMin: number;
  totalMax: number;
  breakdown: {
    hotel: number;              // group total
    roadTransport: number;      // group total — car days + transfer legs
    intercityTransport: number; // group total — train/flight fares × pax
    serviceTaxes: number;       // margin + tax, never itemised apart
  };
  car: CarCost;
  assumptions: TripCostAssumptions;
  levers: TripCostLever[];
  indicative: boolean;
  gstPending: boolean;
}

const fmtInr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** One raw (unrounded) per-person computation. Used for the headline and, with
 *  different pax/tier, for each lever — so a lever can never disagree with the price. */
function perPersonRaw(inp: TripCostInput, pax: number, tier: HotelTier): { min: number; max: number; parts: TripCost['breakdown']; car: CarCost } {
  const p = Math.max(pax, 1);
  const perNight = inp.hotelPerNightOverride && inp.hotelPerNightOverride > 0 && tier === inp.tier
    ? inp.hotelPerNightOverride
    : HOTEL_PER_NIGHT[tier];
  const hotel = perNight * Math.max(inp.hotelNights, 0) * roomsForPax(p);
  const car = computeCarCost(inp.days, p);

  const band = (farePp: number) => {
    const intercity = Math.max(farePp, 0) * p;
    const sub = hotel + car.total + intercity;
    const margin = sub * MARGIN_RATE;
    const gst = (sub + margin) * GST_RATE;
    return { total: sub + margin + gst, intercity, serviceTaxes: margin + gst };
  };
  const lo = band(inp.intercityFarePpMin);
  const hi = band(inp.intercityFarePpMax);

  return {
    min: lo.total / p,
    max: hi.total / p,
    parts: {
      hotel: Math.round(hotel),
      roadTransport: Math.round(car.total),
      intercityTransport: Math.round(hi.intercity),
      serviceTaxes: Math.round(hi.serviceTaxes),
    },
    car,
  };
}

const GROUP_SIZES = [2, 4, 6, 8];
const TIER_LADDER: HotelTier[] = ['standard', '3', '4', '5'];

export function computeTripCost(inp: TripCostInput): TripCost {
  const pax = Math.max(inp.pax, 1);
  const tier = inp.tier;
  const hotelSource: HotelSource = inp.hotelSource ?? 'estimate';

  const here = perPersonRaw(inp, pax, tier);
  const [ppMin, ppMax] = roundBand(here.min, here.max);
  const mid = (ppMin + ppMax) / 2;

  // ---- the levers: the SAME computation, re-run. Never a made-up discount. ----
  const levers: TripCostLever[] = [];

  for (const n of GROUP_SIZES) {
    const r = perPersonRaw(inp, n, tier);
    const [lo, hi] = roundBand(r.min, r.max);
    const isCurrent = n === pax;
    const diff = (lo + hi) / 2 - mid;
    levers.push({
      kind: 'GROUP_SIZE',
      label: n === 1 ? '1 traveller' : `${n} travellers`,
      perPersonMin: lo, perPersonMax: hi, current: isCurrent,
      delta: isCurrent || Math.abs(diff) < 500 ? undefined
        : diff < 0 ? `${fmtInr(-diff)} less each` : `${fmtInr(diff)} more each`,
    });
  }
  if (!GROUP_SIZES.includes(pax)) {
    const r = perPersonRaw(inp, pax, tier);
    const [lo, hi] = roundBand(r.min, r.max);
    levers.unshift({ kind: 'GROUP_SIZE', label: `${pax} travellers`, perPersonMin: lo, perPersonMax: hi, current: true });
  }

  for (const t of TIER_LADDER) {
    const r = perPersonRaw(inp, pax, t);
    const [lo, hi] = roundBand(r.min, r.max);
    const isCurrent = t === tier;
    const diff = (lo + hi) / 2 - mid;
    levers.push({
      kind: 'HOTEL_LEVEL',
      label: TIER_LABEL[t],
      perPersonMin: lo, perPersonMax: hi, current: isCurrent,
      delta: isCurrent || Math.abs(diff) < 500 ? undefined
        : diff < 0 ? `${fmtInr(-diff)} less each` : `${fmtInr(diff)} more each`,
    });
  }

  // ---- LAW 2 + LAW 3: the assumption, said out loud, every single time ----
  const sourceLine =
    hotelSource === 'contracted' ? 'These are our own contracted hotel rates.'
    : hotelSource === 'live' ? 'These hotel rates are live and will be reconfirmed before you pay.'
    : `These are estimated costs based on a ${TIER_LABEL[tier]} hotel. The actual cost will vary with the hotel and the category of hotel you choose.`;

  const assumptions: TripCostAssumptions = {
    pax, tier, tierLabel: TIER_LABEL[tier],
    vehicle: vehicleLabel(pax),
    hotelSource,
    landOnly: true,
    note: sourceLine,
    includes: [
      `Hotels — ${inp.hotelNights} night${inp.hotelNights === 1 ? '' : 's'}, ${TIER_LABEL[tier]}, on double sharing, with breakfast`,
      `${vehicleLabel(pax)} — ${here.car.fullDays} full day${here.car.fullDays === 1 ? '' : 's'}${here.car.transferLegs ? `, and ${here.car.transferLegs} airport or station transfer${here.car.transferLegs === 1 ? '' : 's'}` : ''}`,
      'Train and flight fares shown inside the plan',
      'All taxes',
    ],
    excludes: [
      'Your flights or trains to reach the starting city, and home again',
      'Entry tickets at monuments, guides, and camera fees',
      'Meals other than breakfast',
      'Anything personal',
    ],
  };

  return {
    pax, tier, currency: '₹',
    perPersonMin: ppMin,
    perPersonMax: ppMax,
    totalMin: Math.round(ppMin * pax),
    totalMax: Math.round(ppMax * pax),
    breakdown: here.parts,
    car: here.car,
    assumptions,
    levers,
    indicative: hotelSource === 'estimate',
    gstPending: true,
  };
}
