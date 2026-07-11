/**
 * Enrichment orchestrator — augments a finalized Plan with real fares, hotels,
 * guides, city content and a website-model trip cost. Cache-first; bounded live
 * fan-out; misses are enqueued for the background worker (learn-over-time loop).
 *
 * mode:
 *   'fast'  (default) — live fares inline (they're the cost driver, few per plan);
 *                       hotels/guides/content served from cache, misses enqueued.
 *   'deep'            — live everything inline (first-fill), still time-budgeted.
 */
import type { Plan, PlanEnrichment, CityEnrichment, TripCostSummary } from '@/services/route-optimizer/types';
import { estCostPp } from '@/services/route-optimizer/optimize';
import { enrichmentEnabled, currentMonthIST, mapLimit } from './core';
import { resolveFare } from './fareRefresh';
import { findHotels, type HotelCategory } from './hotelFinder';
import { findGuides } from './guideFinder';
import { findCityContent } from './cityContent';
import { computeTripCost, categoryToTier, tierToCategory, type HotelTier, type HotelSource } from './costModel';
import prisma from '@/config/db';

export interface EnrichOpts {
  month?: number;
  pax?: number;
  tier?: HotelTier;       // hotel tier for costing + hotel category
  profile?: string;
  mode?: 'fast' | 'deep';
  budgetMs?: number;      // overall wall-clock budget for live calls
}

/**
 * LAW 2 (founder, 2026-07-11): the default is 3-star, FOR EVERYONE.
 * The old rule put every senior traveller in a 4-star hotel and silently added
 * ~₹10,000 to a family's trip. Old age is not a luxury budget. The traveller
 * chooses the hotel level; we never infer it from who they are.
 */
function tierForProfile(_profile?: string, explicit?: HotelTier): HotelTier {
  return explicit ?? '3';
}

/**
 * LAW 3 — THE RATE LADDER. Hotels are priced from, in order:
 *   1. our own CONTRACTED rates (contracted_hotel_rates), when they exist and are valid today;
 *   2. a LIVE hotel rate (today: the researched hotel_cache prices carried on the
 *      enriched cities; tomorrow: a hotel supplier feed, which plugs in right here);
 *   3. the ESTIMATE (the flat tier rate in costModel).
 * Whichever rung answers, we SAY SO — `assumptions.hotelSource` is published.
 *
 * NOTE (2026-07-11): contracted_hotel_rates is EMPTY (0 rows). Rung 3 is what runs
 * today and will for months. That is a fact to plan around, not to hide.
 */
async function hotelRateLadder(
  cityNames: string[], tier: HotelTier, enriched: CityEnrichment[],
): Promise<{ perNight: number | null; source: HotelSource }> {
  const low = cityNames.map((c) => c.trim().toLowerCase()).filter(Boolean);
  const catForTier: Record<string, number | null> = { standard: null, '3': 3, '4': 4, '5': 5 };

  // rung 1 — our own contracted rates
  if (low.length) {
    try {
      const rows = await prisma.$queryRawUnsafe<{ rate: number | null }[]>(
        `SELECT AVG(chr."netRatePerNight")::float AS rate
           FROM contracted_hotel_rates chr
           JOIN world_cities wc ON wc.id::text = chr."wtiCityId"
          WHERE lower(wc.name) = ANY($1)
            AND chr."isActive"
            AND CURRENT_DATE BETWEEN chr."validFrom" AND chr."validTo"
            AND ($2::int IS NULL OR chr."hotelCategory" = $2)`,
        low, catForTier[tier] ?? null,
      );
      const r = rows?.[0]?.rate;
      if (r != null && Number.isFinite(Number(r)) && Number(r) > 0) {
        return { perNight: Math.round(Number(r)), source: 'contracted' };
      }
    } catch (e) {
      console.error('hotelRateLadder: contracted rung failed (non-fatal):', e);
    }
  }

  // rung 2 — a HOTEL SUPPLIER feed. Not built yet; this is where it plugs in.
  //
  // A RESEARCHED WEB PRICE IS NOT A RATE. We deliberately do NOT price from the
  // hotel_cache prices an AI found on the web: on Delhi/Agra/Jaipur most rows carry
  // no price at all, and the ones that do range from a ₹1,371 lodge to an ₹11,177
  // palace. A median of that is not a 3-star rate — it is a number with a citation.
  // Those hotels stay on the page (they show the traveller the KIND of hotel he gets);
  // they never move the price. When a real supplier feed lands, return it here with
  // source 'live', and the assumption sentence will change itself.
  void enriched;

  // rung 3 — the estimate
  return { perNight: null, source: 'estimate' };
}

/** distinct overnight cities in itinerary order + rough nights each. */
function overnightCities(plan: Plan): { city: string; nights: number }[] {
  const order: string[] = [];
  const nights = new Map<string, number>();
  for (const d of plan.days) {
    const c = d.city;
    if (!c) continue;
    if (!nights.has(c)) { nights.set(c, 0); order.push(c); }
    nights.set(c, (nights.get(c) || 0) + 1);
  }
  // last city on the final day is usually a departure, not an overnight — but we
  // still enrich it (guides/content are useful); nights come from the day count.
  return order.map((c) => ({ city: c, nights: Math.max(1, nights.get(c) || 1) }));
}

export async function enrichPlan(plan: Plan, opts: EnrichOpts = {}): Promise<Plan> {
  if (!enrichmentEnabled()) return plan;
  const start = Date.now();
  const budgetMs = opts.budgetMs ?? 45000;
  const mode = opts.mode ?? 'fast';
  const month = opts.month ?? currentMonthIST();
  const pax = opts.pax ?? 2;
  const tier = tierForProfile(opts.profile, opts.tier);
  const category: HotelCategory = tierToCategory(tier);
  const overBudget = () => Date.now() - start > budgetMs;

  // ---- 1. FARES (live each time, bounded) — real farePpBand on AIR/RAIL legs --
  const fareLegs = plan.legs.filter((l) => l.mode === 'AIR' || l.mode === 'RAIL');
  await mapLimit(fareLegs, 3, async (leg) => {
    const f = await resolveFare(leg.mode as 'AIR' | 'RAIL', leg.from, leg.to, {
      month, pax, allowLive: !overBudget(), timeoutMs: 9000,
    });
    if (f) {
      leg.farePpBand = [f.min, f.max];
      if (leg.modeOptions) {
        const mo = leg.modeOptions.find((o) => o.mode === leg.mode);
        if (mo) mo.costPp = Math.round((f.min + f.max) / 2);
      }
      (leg as any).fareSource = f.source;
    }
  });

  // ---- 2. STATIC enrichment per city (hotels / guides / content) ------------
  // MOVED AHEAD OF THE COST (2026-07-11). The price must be built from a REAL hotel
  // rate when we have one (LAW 3), so the hotels have to land before we price.
  const cities = overnightCities(plan);
  const allowStaticLive = mode === 'deep';
  let anyEnriching = false;
  const cityEnrich: CityEnrichment[] = await mapLimit(cities, 2, async ({ city }) => {
    const live = allowStaticLive && !overBudget();
    const [hotels, guides, content] = await Promise.all([
      findHotels(city, category, { allowLive: live, timeoutMs: 32000 }),
      findGuides(city, { allowLive: live, timeoutMs: 34000 }),
      findCityContent(city, { allowLive: live, timeoutMs: 42000 }),
    ]);
    const enriching = !hotels || !guides || !content;
    if (enriching) anyEnriching = true;
    return {
      city, overnight: true,
      hotels: hotels ?? undefined,
      guides: guides ?? undefined,
      content: content ?? undefined,
      enriching,
    } as CityEnrichment;
  });

  // ---- 3. THE PRICE — honest, banded, and it says what it assumed -----------
  // Intercity fares: real when resolved above, else the engine's own estimate.
  let intercityMin = 0, intercityMax = 0;
  for (const leg of plan.legs) {
    if (leg.mode === 'ROAD') continue;            // the road is priced by the vehicle, below
    if (leg.farePpBand) { intercityMin += leg.farePpBand[0]; intercityMax += leg.farePpBand[1]; }
    else { const c = estCostPp(leg as any); intercityMin += Math.round(c * 0.85); intercityMax += Math.round(c * 1.2); }
  }
  const totalDays = plan.days.length || plan.sequence.length;
  const hotelNights = plan.totals?.hotelNights ?? Math.max(0, totalDays - 1);

  const rate = await hotelRateLadder(cities.map((c) => c.city), tier, cityEnrich);

  // LAW 1 lives inside computeTripCost: it reads plan.days and charges the vehicle
  // for what it ACTUALLY does — a full day when the party is on the road or out
  // sightseeing, and only a per-leg transfer when the day's journey is a train or
  // a flight. It no longer bills a standing car for every day of the holiday.
  const tc = computeTripCost({
    pax, tier, days: plan.days, hotelNights,
    intercityFarePpMin: intercityMin, intercityFarePpMax: intercityMax,
    hotelPerNightOverride: rate.perNight, hotelSource: rate.source,
  });
  const tripCost: TripCostSummary = {
    currency: tc.currency, perPersonMin: tc.perPersonMin, perPersonMax: tc.perPersonMax,
    totalMin: tc.totalMin, totalMax: tc.totalMax, breakdown: tc.breakdown,
    tier, pax, indicative: tc.indicative, gstPending: tc.gstPending,
    assumptions: tc.assumptions, levers: tc.levers,
    car: { fullDays: tc.car.fullDays, transferLegs: tc.car.transferLegs, vehicle: tc.car.vehicle, perDay: tc.car.perDay, perLeg: tc.car.perLeg },
  };
  // the headline band the traveller sees — rounded, never a precise number
  plan.totals.costPpBand = [tripCost.perPersonMin, tripCost.perPersonMax];
  if (plan.comparison) plan.comparison.costPpBand = [tripCost.perPersonMin, tripCost.perPersonMax];

  // ---- 4. weave sightseeing into the day-by-day (itinerary, not a routing log) --
  // For each stay day at a city we have content for, inject that city's attractions,
  // distributing them across multi-night stays so each day reads differently.
  const contentByCity = new Map<string, { attractions?: { name: string }[]; itineraryBody?: string | null }>();
  for (const c of cityEnrich) if (c.content && ((c.content.attractions && c.content.attractions.length) || c.content.itineraryBody)) contentByCity.set(c.city.toLowerCase(), c.content);
  const usedByCity = new Map<string, number>();
  for (const d of plan.days) {
    const key = d.city.toLowerCase();
    const c = contentByCity.get(key);
    if (!c) continue;
    const isStay = !d.transit || /full day|arrive|sightseeing/i.test(d.activity);
    if (!isStay) continue;
    const names = (c.attractions || []).map((a) => a.name).filter(Boolean);
    const start = usedByCity.get(key) || 0;
    const slice = names.slice(start, start + 3);
    if (slice.length) {
      usedByCity.set(key, start + slice.length);
      const see = slice.join(', ');
      if (/full day/i.test(d.activity)) d.activity = `${d.city} — sightseeing: ${see}`;
      else d.activity = `${d.activity} · Sightseeing: ${see}`;
    } else if (c.itineraryBody && /full day/i.test(d.activity)) {
      d.activity = `${d.city} — ${c.itineraryBody}`;
    }
  }

  const enrichment: PlanEnrichment = {
    cities: cityEnrich,
    tripCost,
    enriching: anyEnriching,
    generatedAt: new Date().toISOString(),
  };
  plan.enrichment = enrichment;
  return plan;
}
