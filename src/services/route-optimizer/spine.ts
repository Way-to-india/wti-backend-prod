/**
 * US-802 / US-803 — THE SPINE. StayNode, Attraction, Gateway.
 * Sprint 8 / THE DESIGNER. Founder rulings, Amendments 1 and 2, 2026-07-12.
 *
 *   StayNode   — A TOWN YOU CAN SLEEP IN. The planner routes between these.
 *   Attraction — A THING YOU GO AND SEE. It hangs off a StayNode by a REAL DRIVE.
 *
 * You sleep at a town. You see a park. Conflate the two and the engine will try to book a
 * hotel inside a national park, or route a train to a waterfall.
 *
 * DISTRICT IS AN ATTRIBUTE, NEVER A ROUTING KEY (Amendment 2). Trains do not stop at
 * districts. They stop at stations, and stations serve towns AT A DISTANCE.
 *
 * PURE. No DB, no network, no clock. spineDb.ts reads; the controller injects.
 *
 * ==============================================================================
 * THE TWO LAWS, AND THE CORPSE BEHIND EACH
 * ==============================================================================
 *
 * LAW A — AN AIRSTRIP WITH NO SCHEDULED SERVICE IS NOT AN AIRPORT.
 *   163 cities sit in `airport_cities`. Only 125 appear in `flight_sectors`. Tezpur has a
 *   runway, a name, coordinates — and no aeroplanes. Any rule that picks an airport on
 *   coordinates and population will send a traveller there.
 *
 * LAW B — A STATION WHERE NO TRAINS STOP IS NOT A RAILHEAD.
 *   This one nearly repeated the Sprint-7 failure wearing a new coat. The NEAREST station
 *   to Gangtok is "DARJEELING - DJ", 47 km away — the TOY TRAIN terminus. A nearest-station
 *   rule would have handed the man who wrote "we would prefer trains wherever possible" a
 *   heritage mountain railway as his ARRIVAL from Delhi, and called it service.
 *
 *     NJP  New Jalpaiguri  180 services   <- the real railhead for Gangtok
 *     GHY  Guwahati        146            <- the real railhead for Assam AND Meghalaya
 *     FKG  Furkating        39
 *     DJ   Darjeeling       25            <- the toy train
 *     JKB  Jakhalabandha     9            <- nearest to Kaziranga, and nearly useless
 *
 *   So a gateway is ranked BY SERVICE FIRST, DISTANCE SECOND — and the distance that
 *   counts is a REAL ROAD, not a straight line.
 *
 * ==============================================================================
 * WHY `roadMin` MAY BE NULL, AND WHY THAT IS THE HONEST ANSWER
 * ==============================================================================
 *
 * A straight line is not a drive. Gangtok to New Jalpaiguri is 73 km as the crow flies and
 * 116 km on the road. Shillong to Guwahati is 70 km straight and 99 km on the road. In the
 * hills the crow lies by half.
 *
 * So this module NEVER converts `straightLineKm` into a drive time. If OSRM did not answer,
 * `roadMin` is null and the caller must say "we have not measured that drive" — not invent
 * one. A null is not a gap in the product. It is the product telling the truth.
 *
 * AND A WARNING WORTH MORE THAN THE CODE: OSRM's DURATIONS ARE OPTIMISTIC ON INDIAN HILL
 * ROADS. It calls Guwahati->Shillong 1h15; it is realistically three hours. The DISTANCE is
 * real; the CLOCK is not. physiology.ts and fatigue.ts remain the sole authority on how
 * many road hours a body may be asked to take. Nothing here may soften a body gate — and
 * because `Tightening` cannot express a loosening, nothing here CAN.
 */

import type { Tier } from './designerMemory';

// ---- the node ------------------------------------------------------------------

/** Where a StayNode came from, strongest first. This is the promise we are making. */
export type NodeSource =
  /** We have SOLD trips to this town. Our designers chose it, travellers paid for it. */
  | 'wti_catalogue'
  /** OUR OWN WRITERS researched and published a guide to it. Ours. Human. No model. */
  | 'own_guide'
  /** It entered through the verify ladder: our own guide named it, OSM located it. */
  | 'own_guide_osm';

export interface StayNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** world_cities.admin1Code. The ONLY state key that exists in our data. */
  admin1Code: string | null;
  stateName: string | null;
  /** AN ATTRIBUTE (Amendment 2). Stored, never routed on. */
  district: string | null;
  /** How many times WE have sold it. 0 for a town we have written about but never sold. */
  tourCount: number;
  source: NodeSource;
  /** Do we have our own written guide to this town? Then we may say so, and link to it. */
  guideUrl: string | null;
  /** Our own guide has a food section for this town — the raw material of the US-806 gate. */
  hasOwnFoodNotes: boolean;
}

/** A StayNode's tier, for the plan's tier declaration. Selling beats writing. */
export function nodeTier(n: StayNode): Tier {
  return n.tourCount > 0 ? 'designer_catalogue' : 'transport_poi';
}

// ---- the gateway ---------------------------------------------------------------

export interface Gateway {
  kind: 'rail' | 'air';
  /** 'primary' = best trains-vs-drive trade. 'nearest' = shortest real drive. */
  role: 'primary' | 'nearest';
  /** Station code. Null for an airport. */
  code: string | null;
  name: string;
  /** THE RECEIPT. Trains that actually stop / flight sectors that actually operate. */
  services: number;
  /** Haversine. HONESTLY NAMED. Never presented to a traveller as a drive. */
  straightLineKm: number;
  /** OSRM. The real road. NULL when we could not measure it — and then we say so. */
  roadKm: number | null;
  roadMin: number | null;
}

/** A railhead is a station where trains actually stop. Below this it is a halt. */
export const MIN_RAILHEAD_SERVICES = 20;

/**
 * The drive from the gateway to the bed, in hours — ONLY if we have measured it.
 *
 * Returns null rather than dividing a straight line by an invented speed. The whole point
 * of Amendment 1 is that this number is real.
 */
export function gatewayDriveHours(g: Gateway): number | null {
  return g.roadMin == null ? null : g.roadMin / 60;
}

/**
 * CAN HE GET HERE BY TRAIN? — the question the North-East traveller actually asked.
 *
 * "We would prefer trains wherever possible." So: is there a railhead with real trains,
 * and is the drive from it something a body will accept? A railhead six hours away is not
 * a rail connection; it is a road trip with a train at the start, and he must be TOLD that.
 */
export function railReachable(gateways: Gateway[], maxDriveHours = 5): {
  reachable: boolean;
  railhead: Gateway | null;
  driveHours: number | null;
  /** True when the railhead is real but the drive from it is long. He is entitled to know. */
  longTransfer: boolean;
} {
  const rail = gateways.filter((g) => g.kind === 'rail' && g.services >= MIN_RAILHEAD_SERVICES);
  const primary = rail.find((g) => g.role === 'primary') ?? rail[0] ?? null;
  if (!primary) return { reachable: false, railhead: null, driveHours: null, longTransfer: false };

  const h = gatewayDriveHours(primary);
  // An unmeasured drive is not a reason to refuse him, but it IS a reason not to promise.
  if (h == null) return { reachable: true, railhead: primary, driveHours: null, longTransfer: false };

  return {
    reachable: h <= maxDriveHours,
    railhead: primary,
    driveHours: h,
    longTransfer: h > 3,
  };
}

/** The same question for the air, and it obeys LAW A: no sectors, no airport. */
export function airReachable(gateways: Gateway[]): { reachable: boolean; airport: Gateway | null } {
  const air = gateways.filter((g) => g.kind === 'air' && g.services > 0);
  const primary = air.find((g) => g.role === 'primary') ?? air[0] ?? null;
  return { reachable: !!primary, airport: primary };
}

/**
 * How we would SAY the railhead to him. A consultant names the station, the drive, and —
 * when the drive is long — he says that out loud rather than letting it arrive as a
 * surprise on the day. (THE-CONSULTANTS-LAW, Law 4: never substitute in silence.)
 */
export function railheadVoice(node: StayNode, r: ReturnType<typeof railReachable>): string | null {
  if (!r.railhead) {
    return `There is no railway station within reach of ${node.name}, so the train cannot take you all the way.`;
  }
  const station = r.railhead.name.replace(/\s*-\s*[A-Z]+$/, '');   // "GUWAHATI - GHY" -> "GUWAHATI"
  const pretty = station.charAt(0) + station.slice(1).toLowerCase();

  if (r.driveHours == null) {
    return `The railhead for ${node.name} is ${pretty}.`;
  }
  const hrs = r.driveHours < 1
    ? `${Math.round(r.driveHours * 60)} minutes`
    : `${r.driveHours.toFixed(1).replace('.0', '')} hours`;

  if (r.longTransfer) {
    return `The railhead for ${node.name} is ${pretty}, and it is about ${hrs} by road from there. ` +
           `That drive is part of the journey, and I would rather you heard it from me now than found it out on the day.`;
  }
  return `The railhead for ${node.name} is ${pretty}, about ${hrs} away by road.`;
}

// ---- the attraction ------------------------------------------------------------

export interface Attraction {
  id: number;
  name: string;
  lat: number;
  lng: number;
  district: string | null;
  stateName: string | null;
  /** THE PARENT. You sleep here and come out to see it. (Amendment 1.) */
  stayNodeId: string | null;
  straightLineKm: number | null;
  roadKm: number | null;
  /** The REAL drive from the bed. Null when unmeasured — and then we do not claim it. */
  roadMin: number | null;
  /** EVERY ROW CARRIES ITS RECEIPT (spec 3.1). */
  sourceKind: 'asi' | 'own_guide' | 'osm' | 'web' | 'ai_proposed';
  sourceUrl: string | null;
  verifiedAt: string | null;
}

/**
 * NOTHING UNVERIFIED IS EVER SHOWN TO A TRAVELLER (spec 3.2). An unverified row may sit in
 * the table and wait for a human. It may not appear in a plan.
 */
export function showableToTraveller(a: Attraction): boolean {
  return a.verifiedAt != null;
}

/**
 * THE HONEST DENSITY. How much is there to see from this bed?
 *
 * FOUNDER RULING, 2026-07-12: in the North East this number is NEAR ZERO, and that is a
 * FACT ABOUT OUR DATA, not a fact about the North East. Eighty-three ASI monuments across
 * eight states, seventeen with coordinates. Gangtok scores 0.
 *
 * So the ruling is: LEAN ON TIER 1 AND TRANSPORT, AND SAY SO. This function must therefore
 * be able to answer "I do not know" — hence `confident`. A Designer that treats a zero here
 * as "there is nothing to see in Sikkim" would be lying with a number, and lying with a
 * number is still lying.
 */
export function attractionDensity(attractions: Attraction[], nodeId: string): {
  count: number;
  confident: boolean;
} {
  const mine = attractions.filter((a) => a.stayNodeId === nodeId && showableToTraveller(a));
  return {
    count: mine.length,
    // A zero tells us nothing about the place. It tells us about the survey.
    confident: mine.length > 0,
  };
}
