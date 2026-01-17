import type { Prisma } from 'prisma/generated/prisma/client';

export interface TourFilters {
  search?: string;
  id?: string;
  slug?: string;
  title?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  hasDiscount?: boolean;
  minDurationDays?: number;
  maxDurationDays?: number;
  minDurationNights?: number;
  maxDurationNights?: number;
  minGroupSize?: number;
  maxGroupSize?: number;
  minRating?: number;
  maxRating?: number;
  minReviewCount?: number;
  minViewCount?: number;
  minBookingCount?: number;
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
  startCityId?: string;
  startCitySlug?: string;
  startCityName?: string;
  cityId?: string;
  citySlug?: string;
  cityName?: string;
  stateId?: string;
  stateName?: string;
  countryId?: string;
  countryName?: string;
  themeId?: string;
  themeSlug?: string;
  themeName?: string;
  difficulty?: string;
  bestTime?: string;
  idealFor?: string;
}

export interface TourIncludes {
  includeStartCity?: boolean;
  includeItinerary?: boolean;
  includeThemes?: boolean;
  includeCities?: boolean;
  includeFaqs?: boolean;
  includeReviews?: boolean;
  includePriceGuide?: boolean;
}

export class TourQueryHelper {
  static buildWhereClause(filters: TourFilters): Prisma.TourWhereInput {
    const conditions: Prisma.TourWhereInput[] = [];

    if (filters.search) {
      conditions.push({
        OR: [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { slug: { contains: filters.search, mode: 'insensitive' } },
          { metatitle: { contains: filters.search, mode: 'insensitive' } },
          { metadesc: { contains: filters.search, mode: 'insensitive' } },
          { overview: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ],
      });
    }

    if (filters.id) conditions.push({ id: filters.id });
    if (filters.slug) conditions.push({ slug: filters.slug });
    if (filters.title) {
      conditions.push({ title: { contains: filters.title, mode: 'insensitive' } });
    }
    if (filters.isActive !== undefined) conditions.push({ isActive: filters.isActive });
    if (filters.isFeatured !== undefined) conditions.push({ isFeatured: filters.isFeatured });
    if (filters.currency) conditions.push({ currency: filters.currency });
    if (filters.difficulty) {
      conditions.push({ difficulty: { contains: filters.difficulty, mode: 'insensitive' } });
    }
    if (filters.bestTime) {
      conditions.push({ bestTime: { contains: filters.bestTime, mode: 'insensitive' } });
    }
    if (filters.idealFor) {
      conditions.push({ idealFor: { contains: filters.idealFor, mode: 'insensitive' } });
    }

    if (filters.minPrice || filters.maxPrice) {
      const priceFilter: Prisma.IntFilter = {};
      if (filters.minPrice) priceFilter.gte = filters.minPrice;
      if (filters.maxPrice) priceFilter.lte = filters.maxPrice;
      conditions.push({ price: priceFilter });
    }

    if (filters.hasDiscount) {
      conditions.push({ discountPrice: { not: null } });
    }

    if (filters.minDurationDays || filters.maxDurationDays) {
      const daysFilter: Prisma.IntFilter = {};
      if (filters.minDurationDays) daysFilter.gte = filters.minDurationDays;
      if (filters.maxDurationDays) daysFilter.lte = filters.maxDurationDays;
      conditions.push({ durationDays: daysFilter });
    }

    if (filters.minDurationNights || filters.maxDurationNights) {
      const nightsFilter: Prisma.IntFilter = {};
      if (filters.minDurationNights) nightsFilter.gte = filters.minDurationNights;
      if (filters.maxDurationNights) nightsFilter.lte = filters.maxDurationNights;
      conditions.push({ durationNights: nightsFilter });
    }

    if (filters.minGroupSize) {
      conditions.push({ minGroupSize: { gte: filters.minGroupSize } });
    }
    if (filters.maxGroupSize) {
      conditions.push({ maxGroupSize: { lte: filters.maxGroupSize } });
    }

    if (filters.minRating || filters.maxRating) {
      const ratingFilter: Prisma.DecimalFilter = {};
      if (filters.minRating) ratingFilter.gte = filters.minRating;
      if (filters.maxRating) ratingFilter.lte = filters.maxRating;
      conditions.push({ rating: ratingFilter });
    }

    if (filters.minReviewCount) {
      conditions.push({ reviewCount: { gte: filters.minReviewCount } });
    }
    if (filters.minViewCount) {
      conditions.push({ viewCount: { gte: filters.minViewCount } });
    }
    if (filters.minBookingCount) {
      conditions.push({ bookingCount: { gte: filters.minBookingCount } });
    }

    if (filters.createdAfter || filters.createdBefore) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (filters.createdAfter) dateFilter.gte = filters.createdAfter;
      if (filters.createdBefore) dateFilter.lte = filters.createdBefore;
      conditions.push({ createdAt: dateFilter });
    }

    if (filters.updatedAfter || filters.updatedBefore) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (filters.updatedAfter) dateFilter.gte = filters.updatedAfter;
      if (filters.updatedBefore) dateFilter.lte = filters.updatedBefore;
      conditions.push({ updatedAt: dateFilter });
    }

    if (filters.startCityId || filters.startCitySlug || filters.startCityName) {
      const cityFilter: Prisma.CityWhereInput = {};
      if (filters.startCityId) cityFilter.id = filters.startCityId;
      if (filters.startCitySlug) cityFilter.slug = filters.startCitySlug;
      if (filters.startCityName) {
        cityFilter.name = { contains: filters.startCityName, mode: 'insensitive' };
      }
      conditions.push({ startCity: cityFilter });
    }

    if (
      filters.cityId ||
      filters.citySlug ||
      filters.cityName ||
      filters.stateId ||
      filters.stateName ||
      filters.countryId ||
      filters.countryName
    ) {
      const cityFilter: Prisma.CityWhereInput = {};
      if (filters.cityId) cityFilter.id = filters.cityId;
      if (filters.citySlug) cityFilter.slug = filters.citySlug;
      if (filters.cityName) cityFilter.name = { contains: filters.cityName, mode: 'insensitive' };
      if (filters.stateId) cityFilter.stateId = filters.stateId;
      if (filters.stateName) {
        cityFilter.stateName = { contains: filters.stateName, mode: 'insensitive' };
      }
      if (filters.countryId) cityFilter.countryId = filters.countryId;
      if (filters.countryName) {
        cityFilter.countryName = { contains: filters.countryName, mode: 'insensitive' };
      }
      conditions.push({ cities: { some: { city: cityFilter } } });
    }

    if (filters.themeId || filters.themeSlug || filters.themeName) {
      const themeFilter: Prisma.ThemeWhereInput = {};
      if (filters.themeId) themeFilter.id = filters.themeId;
      if (filters.themeSlug) themeFilter.slug = filters.themeSlug;
      if (filters.themeName) {
        themeFilter.name = { contains: filters.themeName, mode: 'insensitive' };
      }
      conditions.push({ themes: { some: { theme: themeFilter } } });
    }

    return conditions.length > 0 ? { AND: conditions } : {};
  }

  static buildIncludeClause(includes: TourIncludes): Prisma.TourInclude | undefined {
    const include: Prisma.TourInclude = {};

    if (includes.includeStartCity) {
      include.startCity = true;
    }

    if (includes.includeItinerary) {
      include.itinerary = { orderBy: { day: 'asc' } };
    }

    if (includes.includeThemes) {
      include.themes = { include: { theme: true } };
    }

    if (includes.includeCities) {
      include.cities = { include: { city: true }, orderBy: { order: 'asc' } };
    }

    if (includes.includeFaqs) {
      include.faqs = { include: { questions: { orderBy: { order: 'asc' } } } };
    }

    if (includes.includeReviews) {
      include.reviews = {
        where: { isActive: true },
        include: {
          user: { select: { id: true, name: true, profileImage: true } },
          images: true,
        },
        orderBy: { createdAt: 'desc' },
      };
    }

    if (includes.includePriceGuide) {
      include.priceGuide = { orderBy: { order: 'asc' } };
    }

    return Object.keys(include).length > 0 ? include : undefined;
  }

  static buildOrderByClause(
    sortBy: string = 'createdAt',
    sortOrder: string = 'desc'
  ): Prisma.TourOrderByWithRelationInput {
    return {
      [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc',
    };
  }
}
