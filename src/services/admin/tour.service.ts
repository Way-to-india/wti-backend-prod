import prisma from '@/config/db';
import type { TourFilters, TourIncludes } from '@/helpers/tour-query.helper';
import { TourQueryHelper } from '@/helpers/tour-query.helper';
import type { CreateTourData, UpdateTourData } from '@/types/tour';
import type { Prisma } from 'prisma/generated/prisma/client';

export class TourService {
  static async getAllTours(
    page: number,
    limit: number,
    filters: TourFilters,
    includes: TourIncludes,
    sortBy: string,
    sortOrder: string
  ) {
    const where = TourQueryHelper.buildWhereClause(filters);
    const include = TourQueryHelper.buildIncludeClause(includes);

    // If searching, we need to sort by relevance in memory
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();

      // Fetch ALL matching records
      const allMatchingTours = await prisma.tour.findMany({
        where,
        include,
        // Default sort as tie-breaker
        orderBy: TourQueryHelper.buildOrderByClause(sortBy, sortOrder),
      });

      // Sort by relevance
      allMatchingTours.sort((a, b) => {
        const titleA = a.title.toLowerCase();
        const titleB = b.title.toLowerCase();

        // Priority 1: Exact Title Match
        if (titleA === searchTerm && titleB !== searchTerm) return -1;
        if (titleB === searchTerm && titleA !== searchTerm) return 1;

        // Priority 2: Starts with Search Term
        const aStarts = titleA.startsWith(searchTerm);
        const bStarts = titleB.startsWith(searchTerm);
        if (aStarts && !bStarts) return -1;
        if (bStarts && !aStarts) return 1;

        // Priority 3: Title Contains Search Term
        const aContains = titleA.includes(searchTerm);
        const bContains = titleB.includes(searchTerm);
        if (aContains && !bContains) return -1;
        if (bContains && !aContains) return 1;

        // Priority 4: Default (already sorted by query)
        return 0;
      });

      // Manual Pagination
      const total = allMatchingTours.length;
      const skip = (page - 1) * limit;
      const paginatedTours = allMatchingTours.slice(skip, skip + limit);

      return {
        tours: paginatedTours,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    // Standard optimized database query for non-search cases
    const skip = (page - 1) * limit;
    const orderBy = TourQueryHelper.buildOrderByClause(sortBy, sortOrder);

    const [tours, total] = await Promise.all([
      prisma.tour.findMany({ where, include, orderBy, skip, take: limit }),
      prisma.tour.count({ where }),
    ]);

    return {
      tours,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getTourById(id: string, includeAll: boolean = false) {
    const include: Prisma.TourInclude | undefined = includeAll
      ? {
          startCity: true,
          itinerary: { orderBy: { day: 'asc' } },
          themes: { include: { theme: true } },
          cities: { include: { city: true }, orderBy: { order: 'asc' } },
          faqs: { include: { questions: { orderBy: { order: 'asc' } } } },
          reviews: {
            where: { isActive: true },
            include: {
              user: { select: { id: true, name: true, profileImage: true } },
              images: true,
            },
            orderBy: { createdAt: 'desc' },
          },
          priceGuide: { orderBy: { order: 'asc' } },
        }
      : undefined;

    const tour = await prisma.tour.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include,
    });

    if (!tour) {
      throw new Error('Tour not found');
    }

    await prisma.tour.update({
      where: { id: tour.id },
      data: { viewCount: { increment: 1 } },
    });

    return tour;
  }

  static async createTour(data: CreateTourData) {
    const tour = await prisma.tour.create({
      data: {
        title: data.title,
        slug: data.slug,
        metatitle: data.metatitle,
        metadesc: data.metadesc,
        overview: data.overview,
        description: data.description,

        durationDays: data.durationDays,
        durationNights: data.durationNights,
        price: data.price,
        discountPrice: data.discountPrice,
        currency: data.currency,

        minGroupSize: data.minGroupSize,
        maxGroupSize: data.maxGroupSize,

        isActive: data.isActive,
        isFeatured: data.isFeatured,

        bestTime: data.bestTime,
        idealFor: data.idealFor,
        difficulty: data.difficulty,
        cancellationPolicy: data.cancellationPolicy,
        travelTips: data.travelTips,

        startCityId: data.startCityId,

        images: data.images,
        highlights: data.highlights,
        inclusions: data.inclusions,
        exclusions: data.exclusions,

        themes: data.themes?.length
          ? {
              create: data.themes.map((themeId) => ({ themeId })),
            }
          : undefined,

        cities: data.cities?.length
          ? {
              create: data.cities.map((cityId) => ({ cityId })),
            }
          : undefined,

        itinerary: data.itinerary?.length
          ? {
              create: data.itinerary,
            }
          : undefined,
      },
      include: {
        startCity: true,
        itinerary: true,
        themes: { include: { theme: true } },
        cities: { include: { city: true } },
        faqs: { include: { questions: true } },
        priceGuide: true,
      },
    });

    return tour;
  }

  static async updateTour(id: string, data: UpdateTourData) {
    const existingTour = await prisma.tour.findUnique({ where: { id } });

    if (!existingTour) {
      throw new Error('Tour not found');
    }

    const { startCityId, ...restData } = data;

    const updateData: Prisma.TourUpdateInput = Object.entries(restData).reduce(
      (acc, [key, value]) => {
        if (value !== undefined) {
          (acc as any)[key] = value;
        }
        return acc;
      },
      {} as Prisma.TourUpdateInput
    );

    if (startCityId !== undefined) {
      updateData.startCity = startCityId as Prisma.CityUpdateOneWithoutStartingToursNestedInput;
    }

    const tour = await prisma.tour.update({
      where: { id },
      data: updateData,
      include: {
        startCity: true,
        itinerary: { orderBy: { day: 'asc' } },
        themes: { include: { theme: true } },
        cities: { include: { city: true }, orderBy: { order: 'asc' } },
        faqs: { include: { questions: { orderBy: { order: 'asc' } } } },
        priceGuide: { orderBy: { order: 'asc' } },
      },
    });

    return tour;
  }

  static async deleteTour(id: string) {
    const tour = await prisma.tour.findUnique({
      where: { id },
      select: { images: true, itinerary: { select: { imageUrl: true } } },
    });

    if (!tour) {
      throw new Error('Tour not found');
    }

    await prisma.tour.delete({ where: { id } });

    const imageKeys = [
      ...tour.images,
      ...tour.itinerary.map((item) => item.imageUrl).filter(Boolean),
    ] as string[];

    return imageKeys;
  }

  static async updateTourItinerary(
    tourId: string,
    itinerary: Array<{
      day: number;
      title: string;
      description: string;
      imageUrl?: string | null;
    }>
  ) {
    await prisma.tourItinerary.deleteMany({ where: { tourId } });

    if (itinerary.length > 0) {
      await prisma.tourItinerary.createMany({
        data: itinerary.map((item) => ({ tourId, ...item, imageUrl: item.imageUrl || null })),
      });
    }

    return prisma.tour.findUnique({
      where: { id: tourId },
      include: { itinerary: { orderBy: { day: 'asc' } } },
    });
  }

  static async updateTourThemes(tourId: string, themeIds: string[]) {
    await prisma.tourTheme.deleteMany({ where: { tourId } });

    if (themeIds.length > 0) {
      await prisma.tourTheme.createMany({
        data: themeIds.map((themeId) => ({ tourId, themeId })),
      });
    }

    return prisma.tour.findUnique({
      where: { id: tourId },
      include: { themes: { include: { theme: true } } },
    });
  }

  static async updateTourCities(tourId: string, cities: Array<{ cityId: string; order: number }>) {
    await prisma.tourCity.deleteMany({ where: { tourId } });

    if (cities.length > 0) {
      await prisma.tourCity.createMany({
        data: cities.map((city) => ({ tourId, ...city })),
      });
    }

    return prisma.tour.findUnique({
      where: { id: tourId },
      include: { cities: { include: { city: true }, orderBy: { order: 'asc' } } },
    });
  }

  static async updateTourFaqs(
    tourId: string,
    faqs: Array<{
      isActive?: boolean;
      questions: Array<{ question: string; answer: string; order: number }>;
    }>
  ) {
    await prisma.faq.deleteMany({ where: { tourId } });

    for (const faq of faqs) {
      await prisma.faq.create({
        data: {
          tourId,
          isActive: faq.isActive ?? true,
          questions: { create: faq.questions },
        },
      });
    }

    return prisma.tour.findUnique({
      where: { id: tourId },
      include: { faqs: { include: { questions: { orderBy: { order: 'asc' } } } } },
    });
  }

  static async updateTourPriceGuide(
    tourId: string,
    priceGuide: Array<{ title: string; value: number; order: number }>
  ) {
    await prisma.tourPriceGuide.deleteMany({ where: { tourId } });

    if (priceGuide.length > 0) {
      await prisma.tourPriceGuide.createMany({
        data: priceGuide.map((item) => ({ tourId, ...item })),
      });
    }

    return prisma.tour.findUnique({
      where: { id: tourId },
      include: { priceGuide: { orderBy: { order: 'asc' } } },
    });
  }

  static async addGalleryImages(id: string, imageKeys: string[]) {
    const tour = await prisma.tour.findUnique({
      where: { id },
      select: { images: true },
    });

    if (!tour) {
      throw new Error('Tour not found');
    }

    return prisma.tour.update({
      where: { id },
      data: { images: [...tour.images, ...imageKeys] },
      select: { images: true },
    });
  }

  static async deleteGalleryImage(id: string, imageKey: string) {
    const tour = await prisma.tour.findUnique({
      where: { id },
      select: { images: true },
    });

    if (!tour) {
      throw new Error('Tour not found');
    }

    const updatedImages = tour.images.filter((img) => img !== imageKey);

    await prisma.tour.update({
      where: { id },
      data: { images: updatedImages },
    });

    return { images: updatedImages };
  }

  static async updateCoverImage(id: string, coverImageKey: string) {
    const tour = await prisma.tour.findUnique({
      where: { id },
      select: { images: true },
    });

    if (!tour) {
      throw new Error('Tour not found');
    }

    return prisma.tour.update({
      where: { id },
      data: { images: [coverImageKey, ...tour.images.slice(1)] },
      select: { images: true },
    });
  }

  static async getTourImages(id: string): Promise<string[]> {
    const tour = await prisma.tour.findUnique({
      where: { id },
      select: { images: true },
    });

    return tour?.images || [];
  }
}
