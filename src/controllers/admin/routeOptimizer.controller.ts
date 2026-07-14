import prisma from '@/config/db';
import type { Request, Response } from 'express';
import { optimize, planFromSequence, estCostPp } from '@/services/route-optimizer/optimize';
import { haversineKm, osrmDriving, osrmRouteGeometry, osrmRouteAlternatives, pointAtKmAlong, fmtDuration, type RouteGeometry } from '@/services/route-optimizer/geo';
import { multimodalOptions } from '@/services/route-optimizer/providers';
import { freqLabel } from '@/services/route-optimizer/dayExpand';
import { isTrueOvernight } from '@/services/route-optimizer/constraints';
import { enrichPlan } from '@/services/enrichment/orchestrator';
import { enrichmentEnabled } from '@/services/enrichment/core';
import type { CityNode, LegOption, OptimizeInput, InputCity, LatLng, Plan, HaltSuggestion, PlanComparison, LegModeOption } from '@/services/route-optimizer/types';
import { consultantChoose } from '@/services/route-optimizer/consultant';
import { toleranceForProfile } from '@/services/route-optimizer/physiology';
import { weightsForObjective, type LegCtx } from '@/services/route-optimizer/ddcv';
import { applyTPP } from '@/services/route-optimizer/tpp';
import type { OrdealParty } from '@/services/route-optimizer/ordeal';
import { anchorValueFromCounts, type AnchorCandidate } from '@/services/route-optimizer/anchors';
import { roadKmIsImpossible } from '@/services/route-optimizer/truth';
import { repeatedCities } from '@/services/route-optimizer/sequence';
import { toPlannerPayload } from '@/services/route-optimizer/plannerPayload';
import { loadElevations } from '@/services/route-optimizer/spineDb';
import { roadTerrainFor } from '@/services/route-optimizer/roadTerrainDb';

/**
 * Route Optimizer — POST /api/admin/route-optimizer/optimize
 *
 * P1 (road-only): resolves each input city to coordinates (custom stops with
 * lat/lng self-register into world_cities, exactly like the route editor's "+"),
 * builds a road option pool from OSRM (cached in osm_leg_distance, NEVER called
 * inside the optimization loop), runs the engine, and logs the run.
 *
 * RAIL/AIR come from the curated transport_leg_options pool in P2; until then
 * every leg is road (or VERIFY when a corridor is unmapped) — zero fabrication.
 */

const PROFILE_MAX_KM: Record<string, number> = { senior: 300, family: 350, standard: 350 };

async function osrmCached(a: LatLng, b: LatLng, fromName: string, toName: string): Promise<{ km: number; min: number } | null> {
  // 1. cache read (osm_leg_distance is name-keyed, mirrors routeStops)
  try {
    const rows = await prisma.$queryRaw<{ km: number; durationMin: number | null }[]>`
      SELECT km, "durationMin" FROM osm_leg_distance
      WHERE lower("fromName") = lower(${fromName}) AND lower("toName") = lower(${toName}) LIMIT 1`;
    if (rows[0]?.km != null && rows[0]?.durationMin != null) return { km: Number(rows[0].km), min: Number(rows[0].durationMin) };
  } catch { /* table may not exist yet — fall through to OSRM */ }
  // 2. OSRM (build-time only)
  const r = await osrmDriving(a, b);
  if (!r) return null;
  const padded = { km: r.km, min: Math.round(r.min * 1.15) };
  try {
    await prisma.$executeRaw`
      INSERT INTO osm_leg_distance ("fromName", "toName", km, "durationMin")
      VALUES (${fromName}, ${toName}, ${padded.km}, ${padded.min})
      ON CONFLICT DO NOTHING`;
  } catch { /* best-effort cache write */ }
  return padded;
}

export class RouteOptimizerController {
  /** GET /route-optimizer/city-search?q= — world_cities autosuggest, India-preferred.
   *  Self-contained (mirrors routeStops.searchCities) so the optimizer works on any
   *  backend build without depending on the tour route-editor controller. */
  static async searchCities(req: Request, res: Response) {
    try {
      const q = String(req.query.q || '').trim();
      if (q.length < 2) return res.deliver(200, true, []);
      const rows = await prisma.$queryRaw<
        { name: string; latitude: number; longitude: number; countryName: string; admin1Code: string }[]
      >`SELECT name, latitude, longitude, "countryName", "admin1Code"
        FROM world_cities
        WHERE name ILIKE ${q + '%'}
        ORDER BY ("countryCode" = 'IN') DESC, population DESC NULLS LAST
        LIMIT 12`;
      return res.deliver(200, true, rows.map((c) => ({
        name: c.name,
        lat: Number(c.latitude),
        lng: Number(c.longitude),
        region: [c.admin1Code, c.countryName].filter(Boolean).join(', '),
      })));
    } catch (e) {
      console.error('optimizer city-search failed:', e);
      return res.deliver(500, false, undefined, 'City search failed');
    }
  }

  /** POST /route-optimizer/city — register a custom stop into world_cities (idempotent). */
  static async addCity(req: Request, res: Response) {
    try {
      const name = String(req.body?.name || '').trim();
      const lat = Number(req.body?.lat);
      const lng = Number(req.body?.lng);
      if (!name || isNaN(lat) || isNaN(lng)) return res.deliver(400, false, undefined, 'name, lat, lng required');
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return res.deliver(400, false, undefined, 'Invalid coordinates');
      const isIndia = lat >= 6 && lat <= 37.5 && lng >= 68 && lng <= 97.5;
      await prisma.$executeRaw`
        INSERT INTO world_cities (name, "asciiName", latitude, longitude, "countryCode", "countryName", population, "searchRank", source)
        SELECT ${name}, ${name}, ${lat}, ${lng},
               ${isIndia ? 'IN' : null}, ${isIndia ? 'India' : null}, 0, 0, 'ADMIN'
        WHERE NOT EXISTS (SELECT 1 FROM world_cities WHERE lower(name) = lower(${name}))`;
      return res.deliver(200, true, { name, lat, lng, registered: true });
    } catch (e) {
      console.error('optimizer addCity failed:', e);
      return res.deliver(500, false, undefined, 'Failed to register city');
    }
  }

  /** POST /route-optimizer/optimize */
  static async optimize(req: Request, res: Response) {
    try {
      const body = req.body || {};
      const cities: InputCity[] = Array.isArray(body.cities) ? body.cities : [];
      if (cities.length < 2) return res.deliver(400, false, undefined, 'Provide at least 2 cities.');

      // ---- Stage A: resolve coordinates -------------------------------------
      const names = cities.map((c) => String(c.name || '').trim()).filter(Boolean);

      /**
       * A NAME IS NOT A PLACE. (2026-07-11 — the bug that offered a 76-hour drive to Goa.)
       *
       * This query used to be `WHERE lower(name) = ANY(...)`, and the loop below kept whichever
       * row the database returned LAST. There are two Goas — one in India, one in the PHILIPPINES
       * — so the engine planned a road trip to the Philippines, found no Indian airport within
       * 66 km of it, and offered the traveller seventy-six hours in a car. The plan was not wrong.
       * The place was.
       *
       * The same bug wore three other hats today: "Turturiya" became Turtuk in Ladakh, "Hyderabad"
       * became Hyderabad in Pakistan, and "Gorakhpur" sat in Haryana, 811 km from itself.
       *
       * So the resolution is now DETERMINISTIC and it prefers, in strict order:
       *   1. INDIA. This is an India planner. A foreign namesake never wins.
       *   2. A place a traveller can actually REACH — one with a real airport or a railway station
       *      near it. A city you can get to is more likely to be the city he meant.
       *   3. Population, last — because population lies here: our gazetteer gives a Haryana village
       *      the population of the Uttar Pradesh city of Gorakhpur (1,324,570), and that single
       *      corrupt number has already defeated a population-first rule once today.
       */
      const gazRows = await prisma.$queryRaw<{ name: string; latitude: number; longitude: number }[]>`
        SELECT DISTINCT ON (lower(w.name)) w.name, w.latitude, w.longitude
          FROM world_cities w
         WHERE lower(w.name) = ANY(${names.map((n) => n.toLowerCase())})
         ORDER BY lower(w.name),
                  (w."countryCode" = 'IN') DESC,                      -- 1. India, always
                  (EXISTS (SELECT 1 FROM stay_nodes s                -- 2. OUR OWN CATALOGUE
                            WHERE abs(s.lat - w.latitude) < 0.25
                              AND abs(s.lng - w.longitude) < 0.25
                              AND similarity(lower(s.name), lower(w.name)) > 0.45)) DESC,
                  (EXISTS (SELECT 1 FROM airport_cities a            -- 3. a place he can reach
                            WHERE abs(a.lat - w.latitude) < 0.8
                              AND abs(a.lng - w.longitude) < 0.8)) DESC,
                  (EXISTS (SELECT 1 FROM train_stations t
                            WHERE abs(t.lat - w.latitude) < 0.5
                              AND abs(t.lng - w.longitude) < 0.5)) DESC,
                  w.population DESC NULLS LAST`;   // 5. size, last of all — population lies here
      const gaz = new Map<string, LatLng>();
      for (const r of gazRows) gaz.set(r.name.toLowerCase(), [Number(r.latitude), Number(r.longitude)]);

      // ---- US-823: OUR OWN CATALOGUE IS THE PRIMARY GAZETTEER ----------------------
      //
      // world_cities is a 33,000-row world gazetteer. It holds namesakes, corrupt populations,
      // and rows OUR OWN verify ladder wrote badly. It sent every traveller who typed "Manali"
      // to a SUBURB OF CHENNAI, 2,138 km from the mountains, across 17 of our tours -- because
      // the real Manali is a curated row with population 0, and population was the last rung.
      // It sent a pilgrim asking for RAMESWARAM to a village in Andhra Pradesh, because the
      // village is near an airport and the temple island is not.
      //
      // stay_nodes holds 251 towns our designers have PHYSICALLY SENT TRAVELLERS TO, with
      // verified coordinates and a tour count. NOTHING OUTRANKS HAVING ACTUALLY TAKEN SOMEONE
      // THERE. The catalogue answers first; world_cities is the fallback for towns we have
      // never sold. Ranking alone could never have fixed Sultanpur, Khandala or Nakhtrana --
      // for those the ONLY row in world_cities is the wrong one, and you cannot promote a row
      // that does not exist.
      //
      // The match is on NAME SIMILARITY and the COORDINATE COMES FROM US -- which is why it
      // works when our catalogue spells it "Rameshwaram" and he types "Rameswaram" (0.615).
      // Threshold 0.6 is safe: of our 251 towns, ZERO pairs score above 0.6 while sitting more
      // than 50 km apart, so it cannot confuse two of our own places.
      const lowered = names.map((n) => n.toLowerCase());
      const catRows = await prisma.$queryRaw<{ asked: string; latitude: number; longitude: number }[]>`
        SELECT DISTINCT ON (q.n) q.n AS asked, s.lat AS latitude, s.lng AS longitude
          FROM unnest(${lowered}::text[]) AS q(n)
          JOIN stay_nodes s ON similarity(lower(s.name), q.n) > 0.6
         ORDER BY q.n, similarity(lower(s.name), q.n) DESC, s.tour_count DESC NULLS LAST`;
      for (const r of catRows) gaz.set(String(r.asked).toLowerCase(), [Number(r.latitude), Number(r.longitude)]);

      const nodes: CityNode[] = [];
      const missing: string[] = [];
      const registered: string[] = [];
      for (const c of cities) {
        const nm = String(c.name || '').trim();
        if (!nm) continue;
        let coord: LatLng | undefined;
        if (c.lat != null && c.lng != null) {
          coord = [Number(c.lat), Number(c.lng)];
          // self-register custom stop into world_cities (reuse the route-editor "+" behaviour)
          const isIndia = coord[0] >= 6 && coord[0] <= 37.5 && coord[1] >= 68 && coord[1] <= 97.5;
          try {
            await prisma.$executeRaw`
              INSERT INTO world_cities (name, "asciiName", latitude, longitude, "countryCode", "countryName", population, "searchRank", source)
              SELECT ${nm}, ${nm}, ${coord[0]}, ${coord[1]}, ${isIndia ? 'IN' : null}, ${isIndia ? 'India' : null}, 0, 0, 'ADMIN'
              WHERE NOT EXISTS (SELECT 1 FROM world_cities WHERE lower(name) = lower(${nm}))`;
            registered.push(nm);
          } catch (e) { console.error('optimizer custom-city register failed:', e); }
        } else {
          coord = gaz.get(nm.toLowerCase());
        }
        if (!coord) { missing.push(nm); continue; }
        nodes.push({ name: nm, coord, profile: {} });
      }
      if (nodes.length < 2) {
        return res.deliver(400, false, { missing }, `Could not resolve coordinates for: ${missing.join(', ')}. Add them as custom stops with lat/lng.`);
      }

      // ---- Stage B: road option pool (pruned to nearest-12 for large sets) ---
      const pax = Number(body.pax) || 2;
      const pool = new Map<string, LegOption[]>();
      const idx = nodes.map((_, i) => i);
      for (let i = 0; i < nodes.length; i++) {
        // nearest-12 neighbours by haversine to cap OSRM calls
        const near = idx.filter((j) => j !== i)
          .sort((a, b) => haversineKm(nodes[i].coord, nodes[a].coord) - haversineKm(nodes[i].coord, nodes[b].coord))
          .slice(0, 12);
        for (const j of near) {
          const [r, mm] = await Promise.all([
            osrmCached(nodes[i].coord, nodes[j].coord, nodes[i].name, nodes[j].name),
            multimodalOptions(nodes[i], nodes[j], { pax }),  // concurrent rail + air
          ]);
          // ⚠️ IRON LAW L1 — GEOGRAPHY CANNOT BE ARGUED WITH. (truth.ts, 14 Jul 2026)
          //
          // The geography gate already existed -- in roadTerrainDb, guarding the terrain CACHE.
          // So it caught the stale Rameswaram row and NEVER SAW the 1,878 km "road" from Jaipur
          // to Udaipur, because that number came in through THIS door: the router. A gate that
          // guards one entrance while another stands open is not a gate. It is a decoration.
          //
          // Jaipur to Udaipur is about 400 km as the crow flies. The router handed back 1,878 --
          // 5.3× the straight line -- and the engine stamped it `osrm`, which is precisely what
          // it has been taught to trust without question. We shipped it to a traveller.
          //
          // NOW: if the router's number cannot be the road between these two points, WE DO NOT
          // USE THE ROUTER'S NUMBER. We fall back to the honest model (crow-fly x 1.3) and we
          // LABEL IT as a model, never as a measurement. An honest estimate beats a confident lie.
          const routed = r?.km ?? null;
          const impossible = routed != null ? roadKmIsImpossible(routed, nodes[i].coord, nodes[j].coord) : null;
          if (impossible) {
            console.error(`[IRON LAW L1] ${nodes[i].name} -> ${nodes[j].name}: ${impossible}. Router number DISCARDED.`);
          }
          const useRouted = routed != null && !impossible;
          const km = useRouted ? routed : Math.round(haversineKm(nodes[i].coord, nodes[j].coord) * 1.3);
          const min = useRouted && r?.min != null ? r.min : Math.round((km / 45) * 60);
          const roadOpt: LegOption = {
            from: nodes[i].name, to: nodes[j].name, mode: 'ROAD',
            distanceKm: km, durationMin: min, operatingDays: 127, reliability: 4,
            source: useRouted ? 'osrm' : 'haversine', verifiedAt: new Date().toISOString(),
          };
          // ---- US-803d: THE ROAD THE TRAVELLER WILL ACTUALLY DRIVE -------------------------
          //
          // THE BUG THIS CLOSES, CAUGHT ON THE LIVE PAYLOAD AND NOWHERE ELSE (Lesson 1):
          // after US-803c the BODY GATE correctly reserved ~3.3 h for Guwahati->Shillong --
          // but the plan handed to the traveller still said `durationMin: 84`. The engine and
          // the page disagreed, and THE PAGE WAS LYING. A fixed gate behind a false itinerary
          // is worse than neither, because it looks like it works.
          //
          // OSRM reports 61-73 km/h for Delhi->Agra, Shillong->Kaziranga, Guwahati->Shillong
          // AND Gangtok->Darjeeling alike. IT CANNOT TELL A MOUNTAIN FROM A MOTORWAY. The real
          // speeds are 54, 41, 31 and 24 km/h.
          //
          // So we measure the road: the true OSRM geometry, sampled against real elevation, gives
          // CLIMB PER KM, and speed = clamp(55 / (1 + 0.04*climbPerKm), 22, 55) -- bounded by the
          // founder's own plains and hills numbers. Within 8% of reality on all four roads.
          //
          // ONE NUMBER now feeds the gate AND the page. Math.max keeps it a TIGHTENING: we never
          // make a drive look shorter than the router already claimed. Absent-safe: if we cannot
          // measure it, the router's number stands and the plan is no worse than yesterday's.
          try {
            const rt = await roadTerrainFor(nodes[i].name, nodes[j].name, nodes[i].coord, nodes[j].coord);
            if (rt && rt.minutes > 0) {
              // ---- US-800a — TRUST A MEASUREMENT; FLOOR A GUESS -----------------------
              //
              // If a real routing service DROVE this road, its clock is a FACT, and
              // Math.max against our fitted climb model would make the MODEL the authority
              // over REALITY. The model is an hour too slow on a national highway (NH66:
              // model 4h40, Google 3h22) because it knows terrain and not road class, and
              // it CANNOT be re-tuned out without breaking the mountain roads it gets right.
              //
              // So a measured road is taken as measured, and an unmeasured one keeps the
              // full conservative floor it had yesterday. The tightening is not weakened;
              // it is confined to the guesses, which is the only place it was ever right.
              if (rt.source === 'measured') {
                roadOpt.durationMin = rt.minutes;
                roadOpt.durationSource = 'measured';
              } else {
                roadOpt.durationMin = Math.max(roadOpt.durationMin ?? 0, rt.minutes);
                roadOpt.durationSource = 'routed';
              }
              (roadOpt as any).climbPerKm = Number(rt.climbPerKm.toFixed(1));
            }
          } catch (e) {
            console.error('roadTerrainFor failed (non-fatal, keeping router time):', e);
          }
          pool.set(`${nodes[i].name}||${nodes[j].name}`, [roadOpt, ...mm]);
        }
      }

      // ---- US-803c: THE LAST INCH OF THE WIRE --------------------------------
      //
      // The engine can now read terrain (terrain.ts -> roadQualityIndex -> terrainSpeedKmh
      // -> THE BODY GATES). But an engine that CAN read terrain and is never HANDED any is
      // a no-op in production -- and that is Lesson 1 of this project, paid for once
      // already: "an engine test proves the engine; only the live payload proves the
      // product." 570 assertions were green while a man who wrote "no trains" was put on a
      // train.
      //
      // So the elevations are injected HERE, on the shared path, which means BOTH the CRM
      // desk and the public planner get them. Absent-safe: {} means the engine keeps its
      // existing safe default, and the plan is no worse than yesterday's.
      const elevations = await loadElevations(nodes.map((n) => n.name));
      // ⚠️ IRON LAW L2 — the height goes ONTO THE NODE, so the airport catchment can be measured
      // in HOURS instead of in a straight line across a mountain range. (truth.ts, 14 Jul 2026)
      for (const n of nodes) {
        const m = elevations[n.name] ?? elevations[n.name.toLowerCase()];
        if (m != null && Number.isFinite(Number(m))) n.elevationM = Number(m);
      }

      // ---- Stage C–F: run the engine ----------------------------------------
      const input: OptimizeInput = {
        // city -> metres. Measured (Open-Meteo), never guessed. Feeds the body gates.
        elevations,
        cities: cities.filter((c) => nodes.some((n) => n.name.toLowerCase() === String(c.name).trim().toLowerCase())),
        start: body.start ?? null,
        end: body.end ?? null,
        objective: (['TIME', 'COST', 'EASE', 'BALANCED'].includes(body.objective) ? body.objective : 'BALANCED'),
        tripType: body.tripType === 'oneway' ? 'oneway' : 'roundtrip',
        month: body.month, pax,
        profile: (['standard', 'family', 'senior'].includes(body.profile) ? body.profile : 'standard'),
        overnightTrains: body.overnightTrains !== false,
        // Sprint 7 — the traveller brief, compiled by the public planner from his own
        // sentence (route-optimizer/intent.ts). Absent on every admin/CRM call, so the
        // desk pipeline behaves exactly as before.
        contract: body.contract,
        tpp: body.tpp,
        maxRoadKmDay: Number(body.maxRoadKmDay) || PROFILE_MAX_KM[body.profile] || 350,
        startWeekday: body.startWeekday ?? null,
        pins: Array.isArray(body.pins) ? body.pins : [],
        acceptedHalts: Array.isArray(body.acceptedHalts) ? body.acceptedHalts : [],
        dayBudget: body.dayBudget != null && Number.isFinite(Number(body.dayBudget)) ? Number(body.dayBudget) : undefined,
        softStartWindowDays: body.softStartWindowDays != null && Number.isFinite(Number(body.softStartWindowDays)) ? Number(body.softStartWindowDays) : undefined,
      };
      // §4.4 curated en-route anchors per leg (both directions) so pearl-split
      // reasoning fires on over-cap road legs. One query; absent-safe.
      const anchorsByLeg = await RouteOptimizerController.loadAnchorsByLeg(nodes, body.contract?.chips ?? []);
      const result = optimize(input, { nodes, pool, anchorsByLeg });

      // ---- Stage E+: opt-in halt suggestions, road corridors (A/B), comparison
      const nodeMap = new Map(nodes.map((n) => [n.name.toLowerCase(), n] as const));
      const finalized: Plan[] = [];
      const best = result.plans[0];
      if (best) {
        best.corridorId = 'A'; best.corridorLabel = 'Route A — fastest';
        try { finalized.push(await RouteOptimizerController.finalizePlan(best, nodeMap, input, pool, undefined, anchorsByLeg)); }
        catch (e) { console.error('finalize A failed:', e); finalized.push(best); }
        // Route B — a physically different road corridor on the longest leg
        try {
          const alt = await RouteOptimizerController.altCorridor(best, nodeMap);
          if (alt) {
            const bPlan: Plan = { ...best, corridorId: 'B', corridorLabel: 'Route B — alternate corridor' };
            finalized.push(await RouteOptimizerController.finalizePlan(bPlan, nodeMap, input, pool, alt, anchorsByLeg));
          }
        } catch (e) { console.error('corridor B failed:', e); }
      }
      // itinerary alternates (different ordering / date-flexible)
      for (const p of result.plans.slice(1)) {
        try { finalized.push(await RouteOptimizerController.finalizePlan(p, nodeMap, input, pool, undefined, anchorsByLeg)); }
        catch (e) { console.error('finalize alt failed:', e); finalized.push(p); }
      }
      result.plans = finalized;

      // ---- AI enrichment layer (cache-first; live fares each time) ----------
      // Attaches real fares, hotels, govt-recognised guides, city content and a
      // website-model trip cost. Fail-safe: never blocks the plan on error.
      if (enrichmentEnabled() && body.enrich !== false) {
        const enrichMode = body.enrich === 'deep' ? 'deep' : 'fast';
        const tier = ['standard', '3', '4', '5'].includes(body.hotelTier) ? body.hotelTier : undefined;
        try {
          await Promise.all(result.plans.map((p) =>
            enrichPlan(p, { month: input.month, pax, profile: input.profile, tier, mode: enrichMode, budgetMs: 50000 })
              .catch((e) => { console.error('enrichPlan failed (non-fatal):', e); return p; })));
        } catch (e) { console.error('enrichment pass failed (non-fatal):', e); }
      }

      // ---- audit log --------------------------------------------------------
      try {
        const uid = (req as any).admin?.id ?? (req as any).user?.id ?? null;
        await prisma.$executeRaw`
          INSERT INTO optimizer_runs (input, objective, plans, created_by)
          VALUES (${JSON.stringify(input)}::jsonb, ${input.objective}, ${JSON.stringify(result.plans)}::jsonb, ${uid})`;
      } catch (e) { console.error('optimizer_runs log failed (non-fatal):', e); }

      // ---- US-501/502: trip-planner payload (OPT-IN, purely additive) -------
      // The public trip-planner design binds to a TRIP_DATA shape whose leg detail
      // lives on days[].transit, while the engine emits that THIN (the rich facts are
      // on plan.legs[]). toPlannerPayload() performs that join + the display
      // formatting. It is OPT-IN (`planner: true`) so every existing CRM call keeps a
      // byte-identical response — plans[0] is untouched and loadFromOptimizer is safe.
      // Fail-safe: an adapter error must never sink a good solve.
      let planner: unknown;
      if (body.planner === true) {
        try {
          planner = toPlannerPayload(result, { request: typeof body.request === 'string' ? body.request : null });
        } catch (e) { console.error('planner payload failed (non-fatal):', e); }
      }

      return res.deliver(200, true, {
        ...result,
        ...(planner ? { planner } : {}),
        meta: { registered, missing },
      });
    } catch (e) {
      console.error('route optimize failed:', e);
      return res.deliver(500, false, undefined, 'Route optimization failed');
    }
  }

  /**
   * §4.4 curated en-route anchors for every ordered pair among the trip cities,
   * keyed `from||to` in BOTH directions (exact node-name casing dayExpand looks up),
   * so pearl-split reasoning fires on over-cap road legs. ONE query over the curated
   * en_route_anchors table (the authoritative source); lean for the 2 GB box and
   * fully absent-safe (returns an empty map on any error).
   */
  static async loadAnchorsByLeg(nodes: CityNode[], chips: string[] = []): Promise<Map<string, AnchorCandidate[]>> {
    const byLeg = new Map<string, AnchorCandidate[]>();
    if (nodes.length < 2) return byLeg;
    const names = nodes.map((n) => n.name);
    const low = names.map((n) => n.trim().toLowerCase());
    const nameByLower = new Map(names.map((n) => [n.trim().toLowerCase(), n] as const));
    try {
      const rows = await prisma.$queryRaw<{ city_a: string; city_b: string; anchor_name: string; anchor_lat: number; anchor_lng: number; anchor_value_days: number; why: string | null }[]>`
        SELECT city_a, city_b, anchor_name, anchor_lat, anchor_lng, anchor_value_days, why
        FROM en_route_anchors
        WHERE lower(city_a) = ANY(${low}) AND lower(city_b) = ANY(${low})`;
      for (const r of rows) {
        const a = nameByLower.get(String(r.city_a).trim().toLowerCase());
        const b = nameByLower.get(String(r.city_b).trim().toLowerCase());
        if (!a || !b) continue;
        const cand: AnchorCandidate = {
          name: String(r.anchor_name),
          coord: [Number(r.anchor_lat), Number(r.anchor_lng)] as [number, number],
          valueDays: Number(r.anchor_value_days) || 0.5,
          why: r.why ?? null,
          source: 'curated',
        };
        for (const key of [`${a}||${b}`, `${b}||${a}`]) {
          const arr = byLeg.get(key) ?? []; arr.push(cand); byLeg.set(key, arr);
        }
      }
    } catch (e) { console.error('loadAnchorsByLeg failed (non-fatal):', e); }
    return byLeg;
  }

  /**
   * Finalize a plan: insert only ACCEPTED halts (opt-in), attach real road
   * geometry, attach opt-in halt SUGGESTIONS to any leg still over the day cap,
   * and compute the comparison block. `legOverride` forces one leg onto a specific
   * road corridor (used for Route B).
   */
  static async finalizePlan(plan: Plan, nodeMap: Map<string, CityNode>, input: OptimizeInput, mmPool: Map<string, LegOption[]>, legOverride?: { key: string; geom: RouteGeometry }, anchorsByLeg?: Map<string, AnchorCandidate[]>): Promise<Plan> {
    const maxKm = Number(input.maxRoadKmDay) || (input.profile === 'senior' ? 300 : 350);
    const seq = plan.sequence;
    if (seq.length < 2) return plan;

    const accepted = input.acceptedHalts || [];
    const nodesByName = new Map<string, CityNode>();
    for (const n of seq) { const nd = nodeMap.get(n.toLowerCase()); if (nd) nodesByName.set(n, nd); }

    // 1. final sequence with accepted halts inserted at their leg
    const expanded: string[] = [];
    const haltNames = new Set<string>();
    const extraCities: InputCity[] = [];
    for (let i = 1; i < seq.length; i++) {
      const a = seq[i - 1], b = seq[i];
      if (expanded.length === 0) expanded.push(a);
      for (const h of accepted.filter((x) => x.legFrom === a && x.legTo === b)) {
        nodesByName.set(h.name, { name: h.name, coord: [Number(h.lat), Number(h.lng)], profile: {} });
        haltNames.add(h.name); extraCities.push({ name: h.name, nights: 1 }); expanded.push(h.name);
      }
      expanded.push(b);
    }

    // 2. pool: reuse the MULTIMODAL options (road+rail+air) for original pairs so
    //    the chosen mode is preserved; OSRM road for new halt sub-legs only.
    const pool = new Map<string, LegOption[]>();
    for (let i = 1; i < expanded.length; i++) {
      const x = expanded[i - 1], y = expanded[i];
      const key = `${x}||${y}`;
      if (mmPool.has(key)) {
        let opts = mmPool.get(key)!;
        if (legOverride && legOverride.key === key) {
          opts = opts.map((o) => o.mode === 'ROAD' ? { ...o, distanceKm: legOverride.geom.km, durationMin: legOverride.geom.min, source: 'osrm-alt' } : o);
        }
        pool.set(key, opts);
      } else {
        const xN = nodesByName.get(x), yN = nodesByName.get(y);
        if (!xN || !yN) continue;
        const g = await osrmRouteGeometry(xN.coord, yN.coord);
        const km = g?.km ?? Math.round(haversineKm(xN.coord, yN.coord) * 1.3);
        const min = g?.min ?? Math.round((km / 45) * 60);
        pool.set(key, [{ from: x, to: y, mode: 'ROAD', distanceKm: km, durationMin: min, operatingDays: 127, reliability: 4, source: g ? 'osrm' : 'haversine', verifiedAt: new Date().toISOString() }]);
      }
    }

    const uniqueNodes: CityNode[] = [];
    const seen = new Set<string>();
    for (const nm of expanded) { const k = nm.toLowerCase(); const nd = nodesByName.get(nm); if (!seen.has(k) && nd) { seen.add(k); uniqueNodes.push(nd); } }

    const expandedInput: OptimizeInput = { ...input, cities: [...input.cities, ...extraCities] };
    const np = planFromSequence(expanded, expandedInput, { nodes: uniqueNodes, pool, haltNames, dailyOnly: plan.dateFlexible, anchorsByLeg }, plan.label || 'Plan');
    np.corridorId = plan.corridorId; np.corridorLabel = plan.corridorLabel; np.dateFlexible = plan.dateFlexible;

    // 3. attach real-road geometry to ROAD legs; opt-in halt suggestions on over-cap road legs
    const used = new Set(expanded.map((n) => n.toLowerCase()));
    for (const leg of np.legs) {
      if (leg.mode !== 'ROAD') continue;
      const xN = nodesByName.get(leg.from), yN = nodesByName.get(leg.to);
      if (!xN || !yN) continue;
      const geom = legOverride && legOverride.key === `${leg.from}||${leg.to}` ? legOverride.geom : await osrmRouteGeometry(xN.coord, yN.coord);
      if (geom?.coords?.length) {
        const mapLeg = np.map.legs.find((m) => m.from === leg.from && m.to === leg.to && m.mode === 'road');
        if (mapLeg) mapLeg.geometry = geom.coords.map((c) => [c[0], c[1]] as [number, number]);
      }
      if (geom && leg.distanceKm && leg.distanceKm > maxKm) {
        const targetKm = Math.min(maxKm, Math.round(geom.km / 2));
        const pt = pointAtKmAlong(geom.coords, targetKm);
        if (!pt) continue;
        const cands = await RouteOptimizerController.findTouristHalts(pt[0], pt[1], used, 3);
        if (!cands.length) continue;
        leg.haltSuggestions = cands.map((c) => ({
          name: c.name, lat: c.lat, lng: c.lng, tourCount: c.tour, monuments: c.mon, atKm: targetKm,
          detourKm: Math.max(0, Math.round(haversineKm(xN.coord, [c.lat, c.lng]) + haversineKm([c.lat, c.lng], yN.coord) - haversineKm(xN.coord, yN.coord))),
          why: c.tour > 0 ? `On ${c.tour} WTI tour${c.tour > 1 ? 's' : ''}${c.mon ? `, ${c.mon} attractions` : ''}` : c.mon ? `${c.mon} attractions nearby` : 'Practical overnight town',
        } as HaltSuggestion));
        np.warnings.push(`${leg.from} → ${leg.to} is ${leg.distanceKm} km by road — over the ${maxKm} km/day cap. Add an overnight halt (${cands.map((c) => c.name).join(', ')}) or pick a train/flight if offered.`);
      }
    }

    // 4. per-leg mode alternatives (flight/train/road) + indicative fares
    for (const leg of np.legs) {
      const opts = pool.get(`${leg.from}||${leg.to}`) || [];
      if (opts.length) {
        leg.modeOptions = opts.map((o) => ({
          mode: o.mode, identifier: o.identifier ?? null, durationMin: o.durationMin ?? null, distanceKm: o.distanceKm ?? null,
          costPp: estCostPp(o), frequency: o.mode !== 'ROAD' ? freqLabel(o.operatingDays) : 'daily',
          dep: o.depTime ?? null, arr: o.arrTime ?? null, overnight: isTrueOvernight(o),
          chosen: o.mode === leg.mode && (o.identifier ?? null) === (leg.identifier ?? null),
        } as LegModeOption)).sort((a, b) => a.costPp - b.costPp);
      }
      if (!leg.farePpBand) {
        const chosen = opts.find((o) => o.mode === leg.mode && (o.identifier ?? null) === (leg.identifier ?? null)) || opts[0];
        if (chosen) { const c = estCostPp(chosen); leg.farePpBand = [Math.round(c * 0.85), Math.round(c * 1.2)]; }
      }
    }

    // 5. round-trip: append the return journey to the origin via the access gateway.
    //    Skip when the user fixed a DIFFERENT end gateway — that's an intentional
    //    open-jaw itinerary (enter one city, exit another); respect the endpoint.
    const originCity = (input.start || np.sequence[0] || '').toLowerCase();
    const endFixed = (input.end || '').trim().toLowerCase();
    const openJaw = !!endFixed && endFixed !== originCity;
    if (input.tripType === 'roundtrip' && !openJaw) {
      try { await RouteOptimizerController.appendReturnJourney(np, mmPool, input); }
      catch (e) { console.error('appendReturnJourney failed (non-fatal):', e); }
    }

    np.comparison = await RouteOptimizerController.computeComparison(np);
    return np;
  }

  /**
   * Append a return journey from the last destination back to the ORIGIN, routed
   * through the access gateway so a landlocked stop (e.g. Gangtok) returns via its
   * airport/railhead (Bagdogra) instead of a straight-line drive. The gateway may
   * legitimately recur. Adds return legs, one travel day, map geometry, and folds
   * the return into totals — reusing the existing multimodal pool (no re-optimise).
   */
  /**
   * SPRINT 7 FIX — THE SECOND THRIFT REFLEX, hiding in the controller.
   *
   * This builds the journey home. It used to choose that leg with
   *     sort((a, b) => estCostPp(a) - estCostPp(b))[0]
   * — THE CHEAPEST SERVICE, full stop. No contract, no body gates, no ordeal, no court. So a
   * man who wrote "no trains" and asked for a luxury tour was sent home on the 17315
   * Velankanni Express because it was the cheapest thing in the pool: the identical failure
   * this whole sprint exists to abolish, living one layer ABOVE the engine, where not one of
   * the engine's 570 tests could see it.
   *
   * The way home is part of his holiday. It is bound by his brief like every other leg.
   */
  static async appendReturnJourney(plan: Plan, mmPool: Map<string, LegOption[]>, input?: OptimizeInput): Promise<void> {
    const seq = plan.sequence;
    if (seq.length < 2) return;
    const origin = seq[0];
    const lastDest = seq[seq.length - 1];
    if (lastDest.toLowerCase() === origin.toLowerCase()) return; // already a loop

    // access gateway = arrival city of the last AIR/RAIL leg on the outbound path
    let gateway: string | null = null;
    let gatewayMode: 'AIR' | 'RAIL' | null = null;
    for (const l of plan.legs) if (l.mode === 'AIR' || l.mode === 'RAIL') { gateway = l.to; gatewayMode = l.mode; }
    // THE GATEWAY MAY NOT RECUR. It used to be rejected only when it happened to BE the last
    // destination or the origin -- so a gateway sitting anywhere ELSE in the tour was waved
    // through and appended a second time. That is precisely how Tirupati was visited twice.
    //
    // A gateway is an ACCESS POINT: somewhere he passes through to reach somewhere he sleeps.
    // If he is already sleeping in it, it is not an access point. It is a city he has seen,
    // and routing him back through it is not "access", it is a 600 km detour.
    if (gateway && seq.some((n) => n.toLowerCase() === gateway!.toLowerCase())) gateway = null;

    const contract = input?.contract;
    const tol = toleranceForProfile(input?.profile);
    const pax = input?.pax ?? 2;
    const party: OrdealParty = { cls: tol.cls, budgetStance: contract?.budgetStance ?? null };
    const w = applyTPP(weightsForObjective(input?.objective ?? 'BALANCED'), input?.tpp);
    const ctxOf = (o: LegOption): LegCtx => ({
      tol, pax, month: input?.month,
      accessFromHrs: o.mode === 'AIR' ? 1.5 : o.mode === 'RAIL' ? 0.75 : 0,
      accessToHrs: o.mode === 'AIR' ? 1.0 : o.mode === 'RAIL' ? 0.75 : 0,
      tighten: contract?.tighten,
      rewardHotelNightSaving: contract?.rewardSwitches.hotelNightSaving,
    });

    /** Where we could not keep to his brief on the way home. Never silent (Law 4). */
    const forced: string[] = [];

    const pick = (from: string, to: string, prefer?: 'ROAD' | 'AIR' | 'RAIL'): LegOption | null => {
      const opts = mmPool.get(`${from}||${to}`) || [];
      if (!opts.length) return null;

      // No contract (the admin/CRM desk): behave exactly as before.
      if (!contract) {
        if (prefer) { const m = opts.find((o) => o.mode === prefer); if (m) return m; }
        return opts.slice().sort((a, b) => estCostPp(a) - estCostPp(b))[0];
      }

      // With a contract, the way home goes through the SAME COURT as every other leg.
      const court = consultantChoose(opts.map((o) => ({ opt: o, ctx: ctxOf(o) })), { contract, party, weights: w });
      if (court.winner) {
        if (prefer) {
          const preferred = court.ranked.find((r) => r.opt.mode === prefer);
          if (preferred) return preferred.opt;
        }
        return court.winner.opt;
      }

      // Nothing here honours his brief. We must still get him home — and we SAY SO.
      const leastBad = opts.slice().sort((a, b) => estCostPp(a) - estCostPp(b))[0];
      const why = court.rejected.find((r) => r.opt === leastBad)?.reason;
      forced.push(`Getting you home from ${from} to ${to}: ${why ?? 'the only service we have is one you asked us to avoid.'} It is the only service on this leg, so we have used it to keep your plan complete — but we are telling you plainly rather than slipping it past you. Tell us if you would rather we re-planned this part.`);
      return leastBad;
    };

    // build the return hop list
    const hops: { from: string; to: string; opt: LegOption }[] = [];
    if (gateway) {
      const toGw = pick(lastDest, gateway, 'ROAD') || pick(lastDest, gateway);
      const toHome = pick(gateway, origin, gatewayMode || 'AIR') || pick(gateway, origin);
      if (toGw) hops.push({ from: lastDest, to: gateway, opt: toGw });
      if (toHome) hops.push({ from: gateway, to: origin, opt: toHome });
    }
    if (!hops.length) {
      const direct = pick(lastDest, origin);
      if (direct) hops.push({ from: lastDest, to: origin, opt: direct });
    }
    if (!hops.length) { plan.warnings.push(`Return to ${origin} could not be routed automatically — add the return leg manually.`); return; }
    if (forced.length) plan.contractNotes = [...(plan.contractNotes ?? []), ...forced];

    // append plan legs (marked as return)
    let retRoadKm = 0, retMin = 0;
    const verbOf = (m: string) => m === 'AIR' ? 'Fly' : m === 'RAIL' ? 'Train' : m === 'FERRY' ? 'Ferry' : 'Drive';
    const actParts: string[] = [];
    for (const h of hops) {
      const o = h.opt;
      const km = o.distanceKm ?? 0;
      const mn = o.durationMin ?? 0;
      if (o.mode === 'ROAD') retRoadKm += km;
      retMin += mn;
      const c = estCostPp(o);
      plan.legs.push({
        from: h.from, to: h.to, mode: o.mode, identifier: o.identifier ?? null,
        dep: o.depTime ?? null, arr: o.arrTime ?? null, distanceKm: o.distanceKm ?? null, durationMin: o.durationMin ?? null,
        farePpBand: o.farePpMin != null && o.farePpMax != null ? [o.farePpMin, o.farePpMax] : [Math.round(c * 0.85), Math.round(c * 1.2)],
        frequency: o.mode !== 'ROAD' ? freqLabel(o.operatingDays) : undefined, operatingDays: o.operatingDays,
        note: 'Return journey', overnight: false,
      });
      actParts.push(`${verbOf(o.mode)} ${h.from} → ${h.to}${o.identifier ? ` · ${o.identifier}` : ''}`);
    }

    // one return travel day
    const lastDay = plan.days.length ? plan.days[plan.days.length - 1].day : plan.sequence.length;
    const retDay = lastDay + 1;
    plan.days.push({
      day: retDay, weekday: null, city: origin,
      activity: `Return to ${origin} — ${actParts.join(', then ')}. Trip ends at ${origin}.`,
      transit: { from: lastDest, to: origin, mode: hops[hops.length - 1].opt.mode }, roadKm: Math.round(retRoadKm), transitMin: retMin,
    });
    if (retRoadKm > 350) plan.warnings.push(`Return drive ${lastDest} → ${gateway || origin} is ${Math.round(retRoadKm)} km — consider splitting or an early start.`);

    // map: append return stops + legs (with road geometry) so it draws the way back
    const nextOrder = (plan.map.stops[plan.map.stops.length - 1]?.order ?? plan.sequence.length) + 1;
    let ord = nextOrder;
    for (const h of hops) {
      const o = h.opt;
      const mapMode = o.mode === 'AIR' ? 'flight' : o.mode === 'RAIL' ? 'train' : o.mode === 'FERRY' ? 'ferry' : 'road';
      // find coords for the 'to' city from existing map stops (outbound had them)
      const toStop = plan.map.stops.find((s) => s.name.toLowerCase() === h.to.toLowerCase());
      const fromStop = plan.map.stops.find((s) => s.name.toLowerCase() === h.from.toLowerCase());
      let geometry: [number, number][] | undefined;
      if (o.mode === 'ROAD' && fromStop?.lat != null && toStop?.lat != null) {
        const g = await osrmRouteGeometry([fromStop.lat, fromStop.lng!], [toStop.lat, toStop.lng!]);
        if (g?.coords?.length) geometry = g.coords.map((c) => [c[0], c[1]] as [number, number]);
      }
      plan.map.stops.push({ order: ord, name: h.to, day: retDay, lat: toStop?.lat ?? null, lng: toStop?.lng ?? null });
      plan.map.legs.push({ day: retDay, from: h.from, to: h.to, mode: mapMode as any, km: o.distanceKm ?? null, timeText: fmtDuration(o.durationMin), estimated: o.source === 'osrm' || o.source === 'haversine', geometry });
      ord++;
    }

    // fold the return into totals (comparison recomputes from legs right after this)
    plan.totals.roadKm = plan.legs.filter((l) => l.mode === 'ROAD').reduce((a, l) => a + (l.distanceKm || 0), 0);
    plan.totals.transitHrs = Math.round(plan.legs.reduce((a, l) => a + (l.durationMin || 0), 0) / 60 * 10) / 10;
    plan.map.roadTotalKm = Math.round(plan.map.legs.filter((l) => l.mode === 'road' && l.km).reduce((a, l) => a + (l.km || 0), 0));
    const overnights = plan.legs.filter((l) => l.overnight).length;
    plan.totals.hotelNights = Math.max(0, retDay - 1 - overnights);
    // THE APPEND THAT NEVER LOOKED. `[...plan.sequence, ...hops.map(h => h.to)]` pushed every
    // hop target onto the tour with no idea whether it was already there. The origin closing a
    // round trip is the ONE legal repeat (see repeatedCities). Anything else already in the
    // tour is a bug, and we drop it here rather than draw it on a map for a traveller.
    const inTour = new Set(plan.sequence.map((n) => n.toLowerCase()));
    const homeward = hops
      .map((h) => h.to)
      .filter((n, i, arr) => (i === arr.length - 1 ? true : !inTour.has(n.toLowerCase())));
    plan.sequence = [...plan.sequence, ...homeward];

    // TRIPWIRE. Correct-by-construction above; this is the thing that would have SCREAMED
    // instead of shipping. 724 tests were green while this exact line served a broken tour.
    const dupes = repeatedCities(plan.sequence, { closingOrigin: true });
    if (dupes.length) console.error('[ROUTE-MIND] INVARIANT BREACH -- city visited twice:', dupes.join(', '), '| sequence:', plan.sequence.join(' -> '));
  }

  /** A physically different road corridor for the plan's longest leg (OSRM alternatives). */
  static async altCorridor(plan: Plan, nodeMap: Map<string, CityNode>): Promise<{ key: string; geom: RouteGeometry } | null> {
    const seq = plan.sequence;
    let best: { a: string; b: string; km: number } | null = null;
    for (let i = 1; i < seq.length; i++) {
      const aN = nodeMap.get(seq[i - 1].toLowerCase()), bN = nodeMap.get(seq[i].toLowerCase());
      if (!aN || !bN) continue;
      const d = haversineKm(aN.coord, bN.coord);
      if (!best || d > best.km) best = { a: seq[i - 1], b: seq[i], km: d };
    }
    if (!best) return null;
    const aN = nodeMap.get(best.a.toLowerCase())!, bN = nodeMap.get(best.b.toLowerCase())!;
    const alts = await osrmRouteAlternatives(aN.coord, bN.coord, 3);
    if (alts.length < 2) return null;
    const primary = alts[0];
    const alt = alts.slice(1).find((r) => Math.abs(r.km - primary.km) / Math.max(1, primary.km) > 0.03);
    return alt ? { key: `${best.a}||${best.b}`, geom: alt } : null;
  }

  /** Top-N tourist-worthy towns near a point (WTI destinations by tourCount + POI
   *  monuments; else nearest sizeable world_cities towns). */
  static async findTouristHalts(lat: number, lng: number, exclude: Set<string>, limit = 3): Promise<{ name: string; lat: number; lng: number; tour: number; mon: number }[]> {
    const B = 0.7;
    try {
      // candidate towns from WTI destinations (tourCount + POI) AND ASI monuments
      const [cityRows, asiRows] = await Promise.all([
        prisma.$queryRawUnsafe<{ name: string; lat: number; lng: number; tour: number; mon: number }[]>(
          `SELECT c.name, c.latitude AS lat, c.longitude AS lng, c."tourCount" AS tour, COALESCE(pc.monument_count,0) AS mon
           FROM cities c LEFT JOIN poi_cities pc ON lower(pc.name)=lower(c.name)
           WHERE c."isActive"=true AND c.latitude IS NOT NULL
             AND c.latitude BETWEEN ${lat - B} AND ${lat + B} AND c.longitude BETWEEN ${lng - B} AND ${lng + B}`),
        prisma.$queryRawUnsafe<{ name: string; lat: number; lng: number; asi: number }[]>(
          `SELECT location AS name, avg(lat) AS lat, avg(lng) AS lng, count(*) AS asi
           FROM asi_sites WHERE lat IS NOT NULL
             AND lat BETWEEN ${lat - B} AND ${lat + B} AND lng BETWEEN ${lng - B} AND ${lng + B}
           GROUP BY location`),
      ]);
      const m = new Map<string, { name: string; lat: number; lng: number; tour: number; mon: number; asi: number }>();
      for (const c of cityRows) m.set(c.name.trim().toLowerCase(), { name: c.name, lat: Number(c.lat), lng: Number(c.lng), tour: Number(c.tour) || 0, mon: Number(c.mon) || 0, asi: 0 });
      for (const a of asiRows) {
        if (!a.name) continue;
        const k = a.name.trim().toLowerCase(); const ex = m.get(k);
        if (ex) ex.asi = Number(a.asi) || 0;
        else m.set(k, { name: a.name, lat: Number(a.lat), lng: Number(a.lng), tour: 0, mon: 0, asi: Number(a.asi) || 0 });
      }
      const scored = [...m.values()]
        .filter((c) => !exclude.has(c.name.toLowerCase()) && Number.isFinite(c.lat) && Number.isFinite(c.lng))
        .map((c) => ({ ...c, dist: haversineKm([lat, lng], [c.lat, c.lng]) }))
        .filter((c) => c.dist <= 75)
        .sort((a, b) => (b.tour * 2 + b.mon + b.asi * 1.5 - b.dist * 0.15) - (a.tour * 2 + a.mon + a.asi * 1.5 - a.dist * 0.15));
      if (scored.length) return scored.slice(0, limit).map((c) => ({ name: c.name, lat: c.lat, lng: c.lng, tour: c.tour, mon: c.mon + c.asi }));

      // fallback — nearest sizeable world_cities town
      const wc = await prisma.$queryRaw<{ name: string; latitude: number; longitude: number; population: number }[]>`
        SELECT name, latitude, longitude, COALESCE(population,0) AS population FROM world_cities
        WHERE latitude BETWEEN ${lat - 0.6} AND ${lat + 0.6}
          AND longitude BETWEEN ${lng - 0.6} AND ${lng + 0.6}
          AND COALESCE(population,0) > 20000`;
      return wc
        .map((c) => ({ name: c.name, lat: Number(c.latitude), lng: Number(c.longitude), dist: haversineKm([lat, lng], [Number(c.latitude), Number(c.longitude)]) }))
        .filter((c) => !exclude.has(c.name.toLowerCase()) && c.dist <= 75)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, limit)
        .map((c) => ({ name: c.name, lat: c.lat, lng: c.lng, tour: 0, mon: 0 }));
    } catch (e) {
      console.error('findTouristHalts failed:', e);
      return [];
    }
  }

  /** Comparison metrics for A/B route cards. */
  static async computeComparison(plan: Plan): Promise<PlanComparison> {
    const totalKm = plan.legs.reduce((a, l) => a + (l.distanceKm || 0), 0);
    const roadKm = plan.legs.filter((l) => l.mode === 'ROAD').reduce((a, l) => a + (l.distanceKm || 0), 0);
    const driveMin = plan.legs.filter((l) => l.mode === 'ROAD').reduce((a, l) => a + (l.durationMin || 0), 0);
    let touristStops = 0, amenity = 0;
    try {
      const names = plan.sequence.map((n) => n.toLowerCase());
      const rows = await prisma.$queryRaw<{ name: string }[]>`
        SELECT name FROM cities WHERE "isActive" = true AND lower(name) = ANY(${names})`;
      const set = new Set(rows.map((r) => r.name.toLowerCase()));
      touristStops = plan.sequence.filter((n) => set.has(n.toLowerCase())).length;
      amenity = Math.round((100 * touristStops) / Math.max(1, plan.sequence.length));
    } catch { /* best-effort */ }
    const costLo = plan.legs.reduce((a, l) => a + (l.farePpBand ? l.farePpBand[0] : 0), 0);
    const costHi = plan.legs.reduce((a, l) => a + (l.farePpBand ? l.farePpBand[1] : 0), 0);
    return {
      distanceKm: Math.round(totalKm),
      roadKm: Math.round(roadKm),
      driveHrs: Math.round((driveMin / 60) * 10) / 10,
      transitHrs: plan.totals.transitHrs,
      touristStops,
      amenityScore: amenity,
      easeScore: plan.totals.easeScore,
      costPpBand: costHi > 0 ? [Math.round(costLo), Math.round(costHi)] : null,
      weekdayLock: plan.weekdayLock,
    };
  }
}
