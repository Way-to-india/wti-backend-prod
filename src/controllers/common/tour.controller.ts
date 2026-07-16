import prisma from '@/config/db';
import cacheService from '@/services/common/cache.service';
import { buildTourRoute, norm } from '@/utils/tourRoute';
import { unescoForTour, tourUnescoJsonLd } from '@/services/common/unesco.service';
import { sacredForTour, tourSacredJsonLd } from '@/services/common/sacred.service';
import type { Request, Response } from 'express';
import type { Prisma } from 'prisma/generated/prisma/client';

export class TourController {
  
  static async getAllTours(req: Request, res: Response) {
    try {
      const {
        page = '1',
        limit = '10',
        search,
        id,
        slug,
        title,
        isActive,
        isFeatured,
        minPrice,
        maxPrice,
        currency,
        hasDiscount,
        minDurationDays,
        maxDurationDays,
        minDurationNights,
        maxDurationNights,
        minGroupSize,
        maxGroupSize,
        minRating,
        maxRating,
        minReviewCount,
        minViewCount,
        minBookingCount,
        createdAfter,
        createdBefore,
        updatedAfter,
        updatedBefore,
        startCityId,
        startCitySlug,
        startCityName,
        cityId,
        citySlug,
        cityName,
        stateId,
        stateName,
        countryId,
        countryName,
        themeId,
        themeSlug,
        themeName,
        difficulty,
        bestTime,
        idealFor,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        includeStartCity,
        includeItinerary,
        includeThemes,
        includeCities,
        includeFaqs,
        includeReviews,
        includePriceGuide,
      } = req.query;

      const where: Prisma.TourWhereInput = { AND: [] };

      if (search) {
        (where.AND as Prisma.TourWhereInput[]).push({
          OR: [
            { title: { contains: search as string, mode: 'insensitive' } },
            { slug: { contains: search as string, mode: 'insensitive' } },
            { metatitle: { contains: search as string, mode: 'insensitive' } },
            { metadesc: { contains: search as string, mode: 'insensitive' } },
            { overview: { contains: search as string, mode: 'insensitive' } },
            { description: { contains: search as string, mode: 'insensitive' } },
          ],
        });
      }

      if (id) (where.AND as Prisma.TourWhereInput[]).push({ id: id as string });
      if (slug) (where.AND as Prisma.TourWhereInput[]).push({ slug: slug as string });
      if (title)
        (where.AND as Prisma.TourWhereInput[]).push({
          title: { contains: title as string, mode: 'insensitive' },
        });
      if (isActive !== undefined)
        (where.AND as Prisma.TourWhereInput[]).push({ isActive: isActive === 'true' });
      if (isFeatured !== undefined)
        (where.AND as Prisma.TourWhereInput[]).push({ isFeatured: isFeatured === 'true' });

      if (minPrice || maxPrice) {
        const priceFilter: Prisma.IntFilter = {};
        if (minPrice) priceFilter.gte = parseInt(minPrice as string);
        if (maxPrice) priceFilter.lte = parseInt(maxPrice as string);
        (where.AND as Prisma.TourWhereInput[]).push({ price: priceFilter });
      }

      if (currency) (where.AND as Prisma.TourWhereInput[]).push({ currency: currency as string });
      if (hasDiscount === 'true')
        (where.AND as Prisma.TourWhereInput[]).push({ discountPrice: { not: null } });

      if (minDurationDays || maxDurationDays) {
        const daysFilter: Prisma.IntFilter = {};
        if (minDurationDays) daysFilter.gte = parseInt(minDurationDays as string);
        if (maxDurationDays) daysFilter.lte = parseInt(maxDurationDays as string);
        (where.AND as Prisma.TourWhereInput[]).push({ durationDays: daysFilter });
      }

      if (minDurationNights || maxDurationNights) {
        const nightsFilter: Prisma.IntFilter = {};
        if (minDurationNights) nightsFilter.gte = parseInt(minDurationNights as string);
        if (maxDurationNights) nightsFilter.lte = parseInt(maxDurationNights as string);
        (where.AND as Prisma.TourWhereInput[]).push({ durationNights: nightsFilter });
      }

      if (minGroupSize)
        (where.AND as Prisma.TourWhereInput[]).push({
          minGroupSize: { gte: parseInt(minGroupSize as string) },
        });
      if (maxGroupSize)
        (where.AND as Prisma.TourWhereInput[]).push({
          maxGroupSize: { lte: parseInt(maxGroupSize as string) },
        });

      if (minRating || maxRating) {
        const ratingFilter: Prisma.DecimalFilter = {};
        if (minRating) ratingFilter.gte = parseFloat(minRating as string);
        if (maxRating) ratingFilter.lte = parseFloat(maxRating as string);
        (where.AND as Prisma.TourWhereInput[]).push({ rating: ratingFilter });
      }

      if (minReviewCount)
        (where.AND as Prisma.TourWhereInput[]).push({
          reviewCount: { gte: parseInt(minReviewCount as string) },
        });
      if (minViewCount)
        (where.AND as Prisma.TourWhereInput[]).push({
          viewCount: { gte: parseInt(minViewCount as string) },
        });
      if (minBookingCount)
        (where.AND as Prisma.TourWhereInput[]).push({
          bookingCount: { gte: parseInt(minBookingCount as string) },
        });

      if (createdAfter || createdBefore) {
        const dateFilter: Prisma.DateTimeFilter = {};
        if (createdAfter) dateFilter.gte = new Date(createdAfter as string);
        if (createdBefore) dateFilter.lte = new Date(createdBefore as string);
        (where.AND as Prisma.TourWhereInput[]).push({ createdAt: dateFilter });
      }

      if (updatedAfter || updatedBefore) {
        const dateFilter: Prisma.DateTimeFilter = {};
        if (updatedAfter) dateFilter.gte = new Date(updatedAfter as string);
        if (updatedBefore) dateFilter.lte = new Date(updatedBefore as string);
        (where.AND as Prisma.TourWhereInput[]).push({ updatedAt: dateFilter });
      }

      if (startCityId || startCitySlug || startCityName) {
        const cityFilter: Prisma.CityWhereInput = {};
        if (startCityId) cityFilter.id = startCityId as string;
        if (startCitySlug) cityFilter.slug = startCitySlug as string;
        if (startCityName)
          cityFilter.name = { contains: startCityName as string, mode: 'insensitive' };
        (where.AND as Prisma.TourWhereInput[]).push({ startCity: cityFilter });
      }

      if (cityId || citySlug || cityName || stateId || stateName || countryId || countryName) {
        const cityFilter: Prisma.CityWhereInput = {};
        if (cityId) cityFilter.id = cityId as string;
        if (citySlug) cityFilter.slug = citySlug as string;
        if (cityName) cityFilter.name = { contains: cityName as string, mode: 'insensitive' };
        if (stateId) cityFilter.stateId = stateId as string;
        if (stateName)
          cityFilter.stateName = { contains: stateName as string, mode: 'insensitive' };
        if (countryId) cityFilter.countryId = countryId as string;
        if (countryName)
          cityFilter.countryName = { contains: countryName as string, mode: 'insensitive' };

        (where.AND as Prisma.TourWhereInput[]).push({
          cities: { some: { city: cityFilter } },
        });
      }

      if (themeId || themeSlug || themeName) {
        const themeFilter: Prisma.ThemeWhereInput = {};
        if (themeId) themeFilter.id = themeId as string;
        if (themeSlug) themeFilter.slug = themeSlug as string;
        if (themeName) themeFilter.name = { contains: themeName as string, mode: 'insensitive' };

        (where.AND as Prisma.TourWhereInput[]).push({
          themes: { some: { theme: themeFilter } },
        });
      }

      if (difficulty)
        (where.AND as Prisma.TourWhereInput[]).push({
          difficulty: { contains: difficulty as string, mode: 'insensitive' },
        });
      if (bestTime)
        (where.AND as Prisma.TourWhereInput[]).push({
          bestTime: { contains: bestTime as string, mode: 'insensitive' },
        });
      if (idealFor)
        (where.AND as Prisma.TourWhereInput[]).push({
          idealFor: { contains: idealFor as string, mode: 'insensitive' },
        });

      if ((where.AND as Prisma.TourWhereInput[]).length === 0) delete where.AND;

      const orderBy: Prisma.TourOrderByWithRelationInput[] = [
        { isFeatured: 'desc' },
        {
          [sortBy as keyof Prisma.TourOrderByWithRelationInput]:
            sortOrder === 'asc' ? 'asc' : 'desc',
        },
        { id: 'asc' },
      ];

      const include: Prisma.TourInclude = {};
      if (includeStartCity === 'true') include.startCity = true;
      if (includeItinerary === 'true') include.itinerary = { orderBy: { day: 'asc' } };
      if (includeThemes === 'true') include.themes = { include: { theme: true } };
      if (includeCities === 'true')
        include.cities = { include: { city: true }, orderBy: { order: 'asc' } };
      if (includeFaqs === 'true')
        include.faqs = { include: { questions: { orderBy: { order: 'asc' } } } };
      if (includeReviews === 'true')
        include.reviews = {
          include: { user: { select: { id: true, name: true, profileImage: true } }, images: true },
        };
      if (includePriceGuide === 'true') include.priceGuide = { orderBy: { order: 'asc' } };

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const [tours, total] = await Promise.all([
        prisma.tour.findMany({
          where,
          include: Object.keys(include).length > 0 ? include : undefined,
          orderBy,
          skip,
          take: limitNum,
        }),
        prisma.tour.count({ where }),
      ]);

      return res.deliver(200, true, {
        tours,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error('Error fetching tours:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch tours'
      );
    }
  }

  static async getTourById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { includeSimilar = 'true', similarLimit = '6' } = req.query;

      const tour = await prisma.tour.findFirst({
        where: {
          OR: [{ id }, { slug: { equals: id, mode: 'insensitive' } }],
        },
        include: {
          startCity: {
            select: {
              id: true,
              name: true,
              label: true,
              slug: true,
              stateId: true,
              stateName: true,
              countryId: true,
              countryName: true,
              latitude: true,
              longitude: true,
              imageUrl: true,
            },
          },
          itinerary: {
            orderBy: { day: 'asc' },
            select: {
              id: true,
              day: true,
              title: true,
              description: true,
              imageUrl: true,
            },
          },
          themes: {
            include: {
              theme: {
                select: {
                  id: true,
                  name: true,
                  label: true,
                  slug: true,
                  icon: true,
                  description: true,
                  imageUrl: true,
                  isActive: true,
                },
              },
            },
            orderBy: { theme: { order: 'asc' } },
          },
          cities: {
            include: {
              city: {
                select: {
                  id: true,
                  name: true,
                  label: true,
                  slug: true,
                  stateId: true,
                  stateName: true,
                  countryId: true,
                  countryName: true,
                  latitude: true,
                  longitude: true,
                  imageUrl: true,
                },
              },
            },
            orderBy: { order: 'asc' },
          },
          faqs: {
            include: {
              questions: {
                orderBy: { order: 'asc' },
                select: {
                  id: true,
                  question: true,
                  answer: true,
                  order: true,
                },
              },
            },
            where: { isActive: true },
          },
          reviews: {
            where: { isActive: true },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  profileImage: true,
                  email: true,
                },
              },
              images: {
                select: {
                  id: true,
                  url: true,
                  thumbnail: true,
                  key: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
          priceGuide: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              title: true,
              value: true,
              order: true,
            },
          },
        },
      });

      if (!tour) {
        return res.deliver(404, false, undefined, 'Tour not found');
      }

      prisma.tour
        .update({
          where: { id: tour.id },
          data: { viewCount: { increment: 1 } },
        })
        .then(() => {
          // Invalidate cache for this tour after view count update
          cacheService.delete(`tour:${id}`).catch(console.error);
          cacheService.deletePattern('tour:list:*').catch(console.error);
        })
        .catch((error) => {
          console.error('Failed to increment view count:', error);
        });

      let similarTours = null;
      if (includeSimilar === 'true') {
        const themeIds = tour.themes.map((t) => t.themeId);
        const cityIds = tour.cities.map((c) => c.cityId);
        const limit = parseInt(similarLimit as string);

        const baseSelect = {
          id: true,
          title: true,
          slug: true,
          overview: true,
          durationDays: true,
          durationNights: true,
          price: true,
          discountPrice: true,
          currency: true,
          rating: true,
          reviewCount: true,
          difficulty: true,
          images: true,
          startCity: {
            select: {
              id: true,
              name: true,
              slug: true,
              imageUrl: true,
            },
          },
          themes: {
            include: {
              theme: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  icon: true,
                },
              },
            },
            take: 3,
          },
          cities: {
            include: {
              city: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        };

        const baseWhere = {
          id: { not: tour.id },
          isActive: true,
        };

        const orderBy = [
          { isFeatured: 'desc' as const },
          { rating: 'desc' as const },
          { reviewCount: 'desc' as const },
          { bookingCount: 'desc' as const },
        ];

        // Priority 1: Tours with matching cities (highest priority)
        let toursFromSameCities: any[] = [];
        if (cityIds.length > 0) {
          toursFromSameCities = await prisma.tour.findMany({
            where: {
              ...baseWhere,
              cities: { some: { cityId: { in: cityIds } } },
            },
            select: baseSelect,
            orderBy,
            take: limit,
          });
        }

        // Priority 2: Tours with same start city
        let toursFromSameStartCity: any[] = [];
        if (toursFromSameCities.length < limit && tour.startCityId) {
          toursFromSameStartCity = await prisma.tour.findMany({
            where: {
              ...baseWhere,
              startCityId: tour.startCityId,
              id: { notIn: toursFromSameCities.map((t) => t.id) },
            },
            select: baseSelect,
            orderBy,
            take: limit - toursFromSameCities.length,
          });
        }

        // Priority 3: Tours with matching themes
        let toursWithSameThemes: any[] = [];
        const existingIds = [...toursFromSameCities, ...toursFromSameStartCity].map((t) => t.id);
        if (existingIds.length < limit && themeIds.length > 0) {
          toursWithSameThemes = await prisma.tour.findMany({
            where: {
              ...baseWhere,
              themes: { some: { themeId: { in: themeIds } } },
              id: { notIn: existingIds },
            },
            select: baseSelect,
            orderBy,
            take: limit - existingIds.length,
          });
        }

        // Priority 4: Tours with similar duration and price (fallback)
        let similarPriceAndDuration: any[] = [];
        const allExistingIds = [...existingIds, ...toursWithSameThemes.map((t) => t.id)];
        if (allExistingIds.length < limit) {
          const priceRange = tour.price * 0.3;
          similarPriceAndDuration = await prisma.tour.findMany({
            where: {
              ...baseWhere,
              id: { notIn: allExistingIds },
              OR: [
                {
                  price: {
                    gte: Math.max(0, tour.price - priceRange),
                    lte: tour.price + priceRange,
                  },
                },
                {
                  durationDays: {
                    gte: Math.max(0, tour.durationDays - 2),
                    lte: tour.durationDays + 2,
                  },
                },
                tour.difficulty ? { difficulty: tour.difficulty } : {},
              ].filter((condition) => Object.keys(condition).length > 0),
            },
            select: baseSelect,
            orderBy,
            take: limit - allExistingIds.length,
          });
        }

        // Combine all results in priority order
        similarTours = [
          ...toursFromSameCities,
          ...toursFromSameStartCity,
          ...toursWithSameThemes,
          ...similarPriceAndDuration,
        ].slice(0, limit);

        // Remove the cities field from the response as it's only needed for matching
        similarTours = similarTours.map(({ cities, ...tour }) => tour);
      }

      // VERIFIED ROUTE ONLY. The map/route is served exclusively from
      // human-verified `tour_route_stops` (name + exact lat/lng + per-leg mode,
      // confirmed by an executive in admin). Road-leg distances come from
      // osm_leg_distance (real OSRM routing on the exact coords); time is the
      // free-flow OSRM duration ×1.35 traffic buffer, labelled `estimated`.
      // Emits nothing unless the tour has >=2 verified stops -> no map on
      // unverified tours (founder ruling: "100% accurate maps, or none").
      let route: any = null;
      try {
        const all = await prisma.$queryRaw<
          { order: number; name: string; latitude: number; longitude: number; modeIn: string | null; legKm: number | null; legMin: number | null; legKmSource: string | null; legGeometry: string | null; kind: string | null }[]
        >`SELECT "order", name, latitude, longitude, "modeIn", "legKm", "legMin", "legKmSource", "legGeometry", kind
          FROM tour_route_stops WHERE "tourId" = ${tour.id} AND verified = true ORDER BY "order"`;
        // landmarks (Mount Kailash, Mansarovar Lake…) are map-only pins — kept
        // out of the journey chain, stop numbering and distance totals
        const landmarks = all
          .filter((s) => s.kind === 'landmark')
          .map((s) => ({ name: s.name, lat: Number(s.latitude), lng: Number(s.longitude) }));
        const rs = all.filter((s) => s.kind !== 'landmark');
        if (rs.length >= 2) {
          const legRows = await prisma.$queryRaw<
            { fromName: string; toName: string; km: number; durationMin: number }[]
          >`SELECT "fromName", "toName", km, "durationMin" FROM osm_leg_distance`;
          const key = (a: string, b: string) => a.toLowerCase().trim() + '|' + b.toLowerCase().trim();
          const dmap = new Map(legRows.map((r) => [key(r.fromName, r.toName), r]));
          // mode metadata (label/icon/strategy) — DB-driven so admin-added modes render
          let modeMetaRows: { key: string; label: string; icon: string; distanceStrategy: string }[] = [];
          try {
            modeMetaRows = await prisma.$queryRaw<
              { key: string; label: string; icon: string; distanceStrategy: string }[]
            >`SELECT key, label, icon, "distanceStrategy" FROM travel_modes WHERE active = true`;
          } catch {}
          const metaMap = new Map(modeMetaRows.map((m) => [m.key, m]));
          const fmt = (mins: number) => {
            const h = Math.floor(mins / 60), m = mins % 60;
            return `~${h ? h + 'h ' : ''}${m ? m + 'm' : h ? '' : '0m'}`.trim();
          };
          const stops = rs.map((s, idx) => ({
            order: idx + 1, name: s.name, day: idx + 1, lat: Number(s.latitude), lng: Number(s.longitude),
          }));
          const legs: any[] = [];
          for (let i = 1; i < rs.length; i++) {
            const from = rs[i - 1], to = rs[i];
            const mode = (to.modeIn || 'road') as string;
            const strat = metaMap.get(mode)?.distanceStrategy || (mode === 'road' ? 'osrm-driving' : 'none');
            let km: number | null = null, timeText: string | null = null, estimated = false;
            if (to.legKm != null || to.legMin != null) {
              // per-leg stored values (auto-routed by mode strategy, or manual override)
              km = to.legKm != null ? Math.round(Number(to.legKm)) : null;
              if (to.legMin != null) {
                const raw = Number(to.legMin);
                timeText = fmt(Math.round(mode === 'road' && to.legKmSource !== 'manual' ? raw * 1.35 : raw));
              }
              estimated = to.legKmSource !== 'manual';
            } else if (mode === 'road') {
              // legacy fallback: name-pair OSRM cache
              const hit = dmap.get(key(from.name, to.name)) || dmap.get(key(to.name, from.name));
              if (hit) {
                km = Math.round(Number(hit.km));
                timeText = fmt(Math.round(Number(hit.durationMin) * 1.35));
                estimated = true;
              }
            }
            legs.push({
              day: i, from: from.name, to: to.name, mode, km, timeText, estimated,
              aerial: strat === 'aerial' && to.legKmSource !== 'manual' && km != null,
              // encoded polyline of the REAL path (trail/highway) — maps decode
              // and draw this instead of a straight line when present
              geometry: to.legGeometry || null,
            });
          }
          const roadTotalKm = Math.round(legs.filter((l) => l.mode === 'road' && l.km).reduce((a, l) => a + (l.km || 0), 0));
          const trekModes = new Set(modeMetaRows.filter((m) => m.distanceStrategy === 'osrm-foot').map((m) => m.key));
          const trekTotalKm = Math.round(legs.filter((l) => trekModes.has(l.mode) && l.km).reduce((a, l) => a + (l.km || 0), 0));
          const modes = Array.from(new Set(legs.map((l) => l.mode)));
          const modesMeta = Object.fromEntries(
            modes.map((m) => [m, { label: metaMap.get(m)?.label || `By ${m}`, icon: metaMap.get(m)?.icon || 'route' }])
          );
          route = { stops, legs, roadTotalKm, trekTotalKm, modes, modesMeta, landmarks };
        }
      } catch (e) {
        console.error('verified route load failed:', e);
      }
      // ---- UNESCO World Heritage layer (U3) — the sites this route passes, honest by
      // distance. Fails CLOSED: any error leaves the tour untouched (no map/heritage block,
      // never a 500). JSON-LD is built server-side for the tour detail page to inject.
      let unescoSites: any[] = [];
      let unescoJsonLd: Record<string, any> | null = null;
      try {
        unescoSites = await unescoForTour(tour.id);
        unescoJsonLd = tourUnescoJsonLd(
          { title: tour.title, slug: tour.slug, overview: tour.overview },
          unescoSites,
        );
      } catch (e) {
        console.error('UNESCO enrichment failed (non-fatal):', e);
      }
      // ---- Sacred temple circuits (S1) — Jyotirlingas, Char Dham, Arupadai Veedu,
      // Navagraha, Shakti Peethas, Divya Desams. Same fail-closed pattern.
      let sacredSites: any[] = [];
      let sacredJsonLd: Record<string, any> | null = null;
      try {
        sacredSites = await sacredForTour(tour.id);
        sacredJsonLd = tourSacredJsonLd({ title: tour.title, slug: tour.slug }, sacredSites);
      } catch (e) {
        console.error('Sacred enrichment failed (non-fatal):', e);
      }
      const tourWithRoute = { ...tour, route, unescoSites, unescoJsonLd, sacredSites, sacredJsonLd };

      return res.deliver(200, true, {
        tour: tourWithRoute,
        similarTours: similarTours || [],
      });
    } catch (error) {
      console.error('Error fetching tour:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch tour'
      );
    }
  }

  static async getSearchSuggestion(req: Request, res: Response) {
    const { search } = req.params;

    try {
      if (!search || search.trim().length < 2) {
        return res.deliver(400, false, undefined, 'Search query must be at least 2 characters');
      }

      const searchQuery = search.trim();

      // const cacheKey = `search:suggestions:${searchQuery}`;
      // const cached = await cacheService.get(cacheKey);

      // if (cached) {
      //   return res.deliver(200, true,cached);
      // }

      const tours = await prisma.tour.findMany({
        where: {
          isActive: true,
          OR: [
            { title: { contains: searchQuery, mode: 'insensitive' } },
            { slug: { contains: searchQuery, mode: 'insensitive' } },
            { overview: { contains: searchQuery, mode: 'insensitive' } },
            { description: { contains: searchQuery, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          title: true,
          slug: true,
        },
        orderBy: [
          { isFeatured: 'desc' },
          { rating: 'desc' },
          { reviewCount: 'desc' },
          { bookingCount: 'desc' },
        ],
      });

      // await cacheService.set(cacheKey, JSON.stringify(tours), 300);

      return res.deliver(200, true, tours);
    } catch (error) {
      console.error('Error fetching tour suggestions:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch tour suggestions'
      );
    }
  }

  static async clearTourCache(tourId?: string) {
    try {
      if (tourId) {
        await cacheService.delete(`tour:${tourId}`);
      }
      await cacheService.deletePattern('tour:list:*');
      await cacheService.deletePattern('route:*');
      console.log('✅ Tour cache cleared successfully');
    } catch (error) {
      console.error('Failed to clear tour cache:', error);
    }
  }
}
