/**
 * Stage A — Resolve each input city to a node with coordinates + transport profile.
 *
 * Resolution order for coordinates:
 *   1. Custom coords supplied on the input (executive added a place not in
 *      world_cities, exactly like the route editor's "+"). These win and the
 *      controller separately self-registers the stop into world_cities.
 *   2. The injected gazetteer (world_cities rows the controller pre-fetched).
 *   3. Graceful degrade → the city is dropped from the map with a warning
 *      (road-only handling can still reference it by name if a curated leg exists).
 *
 * Pure: the controller injects `gazetteer` (name→coord) and `profiles`
 * (name→CityProfile). No DB access here.
 */

import type { CityNode, CityProfile, InputCity, LatLng } from './types';

export interface ResolveDeps {
  /** name (as typed) → coord, from world_cities. Case-insensitive lookups. */
  gazetteer: Map<string, LatLng>;
  /** name → transport profile (city_transport_profile). Optional (P1 may be empty). */
  profiles?: Map<string, CityProfile>;
}

const key = (s: string) => s.trim().toLowerCase();

export interface ResolveOutput {
  nodes: CityNode[];
  warnings: string[];
  /** custom stops that must be persisted to world_cities by the controller. */
  toRegister: { name: string; lat: number; lng: number }[];
}

export function resolveCities(cities: InputCity[], deps: ResolveDeps): ResolveOutput {
  const gaz = new Map<string, LatLng>();
  deps.gazetteer.forEach((v, k) => gaz.set(key(k), v));
  const prof = new Map<string, CityProfile>();
  deps.profiles?.forEach((v, k) => prof.set(key(k), v));

  const nodes: CityNode[] = [];
  const warnings: string[] = [];
  const toRegister: { name: string; lat: number; lng: number }[] = [];

  for (const c of cities) {
    const k = key(c.name);
    let coord: LatLng | undefined;
    let degraded = false;

    if (c.lat != null && c.lng != null) {
      coord = [Number(c.lat), Number(c.lng)] as LatLng;
      // custom stop → queue for self-registration into world_cities
      if (c.custom || !gaz.has(k)) toRegister.push({ name: c.name.trim(), lat: coord[0], lng: coord[1] });
    } else if (gaz.has(k)) {
      coord = gaz.get(k)!;
    } else {
      degraded = true;
      warnings.push(`"${c.name}" is not in world_cities and no coordinates were supplied — add it as a custom stop with lat/lng so it can be mapped and optimized.`);
      continue;
    }

    const profile = prof.get(k);
    if (!profile) degraded = true; // road-only node (no airport/railhead/constraints yet)
    nodes.push({ name: c.name.trim(), coord, profile, degraded });
  }

  return { nodes, warnings, toRegister };
}
