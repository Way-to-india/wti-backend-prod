import prisma from '@/config/db';
import { TourQueryHelper } from '@/helpers/tour-query.helper';
import type { TourFilters, TourIncludes } from '@/helpers/tour-query.helper';
import type { Prisma } from 'prisma/generated/prisma/client';

export interface CreateTourData {
  title: string;
  slug: string;
  durationDays: number;
  durationNights: number;
  price: number;
  currency: string;
  minGroupSize: number;
  maxGroupSize: number;
  isActive: boolean;
  isFeatured: boolean;
  metatitle?: string;
  metadesc?: string;
  overview?: string;
  description?: string;
  discountPrice?: number;
  bestTime?: string;
  idealFor?: string;
  difficulty?: string;
  cancellationPolicy?: string;
  travelTips?: string;
  startCityId?: string;
  highlights?: string[];
  inclusions?: string[];
  exclusions?: string[];
  themes?: string[];
  cities?: string[];
  images?: string[];
  itinerary?: Array<{
    day: number;
    title: string;
    description: string;
    imageUrl?: string | null;
  }>;
}

export interface UpdateTourData {
  title?: string;
  slug?: string;
  metatitle?: string;
  metadesc?: string;
  overview?: string;
  description?: string;
  durationDays?: number;
  durationNights?: number;
  price?: number;
  discountPrice?: number;
  currency?: string;
  minGroupSize?: number;
  maxGroupSize?: number;
  bestTime?: string;
  idealFor?: string;
  difficulty?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  cancellationPolicy?: string;
  travelTips?: string;
  startCityId?: string;
  images?: string[];
  highlights?: string[];
  inclusions?: string[];
  exclusions?: string[];
}

export class TourService {
  static async getAllTours(
    page: number,
    limit: number,
    filters: TourFilters,
    includes: TourIncludes,
    sortBy: string,
    sortOrder: string
  ) {
    const skip = (page - 1) * limit;
    const where = TourQueryHelper.buildWhereClause(filters);
    const include = TourQueryHelper.buildIncludeClause(includes);
    const orderBy = TourQueryHelper.buildOrderByClause(sortBy, sortOrder);

    const [tours, total] = await Promise.all([
      prisma.tour.findMany({
        where,
        include,
        orderBy,
        skip,
        take: limit,
      }),
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

    // Increment view count
    await prisma.tour.update({
      where: { id: tour.id },
      data: { viewCount: { increment: 1 } },
    });

    return tour;
  }

  static async createTour(data: CreateTourData) {
    const themesData = data.themes?.map((themeId: string) => ({
      themeId: themeId,
    }));

    // Transform cities array to proper format for Prisma relation
    const citiesData = data.cities?.map((cityId: string) => ({
      cityId: cityId,
    }));

    // Transform itinerary array to proper format
    const itineraryData = data.itinerary?.map((item) => ({
      day: item.day,
      title: item.title,
      description: item.description,
      imageUrl: item.imageUrl || null,
    }));

    const tour = await prisma.tour.create({
      data: {
        title: data.title,
        slug: data.slug,
        durationDays: data.durationDays,
        durationNights: data.durationNights,
        price: data.price,
        currency: data.currency,
        minGroupSize: data.minGroupSize,
        maxGroupSize: data.maxGroupSize,
        isActive: data.isActive,
        isFeatured: data.isFeatured,
        metatitle: data.metatitle,
        metadesc: data.metadesc,
        overview: data.overview,
        description: data.description,
        discountPrice: data.discountPrice,
        bestTime: data.bestTime,
        idealFor: data.idealFor,
        difficulty: data.difficulty,
        cancellationPolicy: data.cancellationPolicy,
        travelTips: data.travelTips,
        startCityId: data.startCityId,
        highlights: data.highlights,
        inclusions: data.inclusions,
        exclusions: data.exclusions,
        images: data.images,
        // ✅ Properly format the relations
        themes:
          themesData && themesData.length > 0
            ? {
                create: themesData,
              }
            : undefined,
        cities:
          citiesData && citiesData.length > 0
            ? {
                create: citiesData,
              }
            : undefined,
        itinerary:
          itineraryData && itineraryData.length > 0
            ? {
                create: itineraryData,
              }
            : undefined,
      },
      include: {
        startCity: true,
        itinerary: true,
        themes: {
          include: {
            theme: true,
          },
        },
        cities: {
          include: {
            city: true,
          },
        },
        faqs: {
          include: {
            questions: true,
          },
        },
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

    const updateData = Object.keys(data).reduce((acc, key) => {
      const value = data[key as keyof UpdateTourData];
      if (value !== undefined) {
        (acc as any)[key] = value;
      }
      return acc;
    }, {} as Prisma.TourUncheckedUpdateInput);

    const tour = await prisma.tour.update({
      where: { id },
      data: updateData,
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

  static async updateTourItinerary(
    tourId: string,
    itinerary: Array<{
      day: number;
      title: string;
      description: string;
      imageUrl?: string;
    }>
  ) {
    // Delete existing itinerary
    await prisma.tourItinerary.deleteMany({
      where: { tourId },
    });

    // Create new itinerary
    await prisma.tourItinerary.createMany({
      data: itinerary.map((item) => ({
        tourId,
        ...item,
      })),
    });

    return await prisma.tour.findUnique({
      where: { id: tourId },
      include: { itinerary: { orderBy: { day: 'asc' } } },
    });
  }

  static async updateTourThemes(tourId: string, themeIds: string[]) {
    // Delete existing themes
    await prisma.tourTheme.deleteMany({
      where: { tourId },
    });

    // Create new themes
    await prisma.tourTheme.createMany({
      data: themeIds.map((themeId) => ({
        tourId,
        themeId,
      })),
    });

    return await prisma.tour.findUnique({
      where: { id: tourId },
      include: { themes: { include: { theme: true } } },
    });
  }

  static async updateTourCities(
    tourId: string,
    cities: Array<{
      cityId: string;
      order: number;
    }>
  ) {
    // Delete existing cities
    await prisma.tourCity.deleteMany({
      where: { tourId },
    });

    // Create new cities
    await prisma.tourCity.createMany({
      data: cities.map((city) => ({
        tourId,
        ...city,
      })),
    });

    return await prisma.tour.findUnique({
      where: { id: tourId },
      include: { cities: { include: { city: true }, orderBy: { order: 'asc' } } },
    });
  }

  static async updateTourFaqs(
    tourId: string,
    faqs: Array<{
      isActive?: boolean;
      questions: Array<{
        question: string;
        answer: string;
        order: number;
      }>;
    }>
  ) {
    // Delete existing FAQs
    await prisma.faq.deleteMany({
      where: { tourId },
    });

    // Create new FAQs
    for (const faq of faqs) {
      await prisma.faq.create({
        data: {
          tourId,
          isActive: faq.isActive ?? true,
          questions: {
            create: faq.questions,
          },
        },
      });
    }

    return await prisma.tour.findUnique({
      where: { id: tourId },
      include: { faqs: { include: { questions: { orderBy: { order: 'asc' } } } } },
    });
  }

  static async updateTourPriceGuide(
    tourId: string,
    priceGuide: Array<{
      title: string;
      value: number;
      order: number;
    }>
  ) {
    // Delete existing price guide
    await prisma.tourPriceGuide.deleteMany({
      where: { tourId },
    });

    // Create new price guide
    await prisma.tourPriceGuide.createMany({
      data: priceGuide.map((item) => ({
        tourId,
        ...item,
      })),
    });

    return await prisma.tour.findUnique({
      where: { id: tourId },
      include: { priceGuide: { orderBy: { order: 'asc' } } },
    });
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

    // Return image keys for S3 deletion
    const imageKeys = [
      ...tour.images,
      ...tour.itinerary.map((item) => item.imageUrl).filter(Boolean),
    ] as string[];

    return imageKeys;
  }

  static async addGalleryImages(id: string, imageKeys: string[]) {
    const tour = await prisma.tour.findUnique({
      where: { id },
      select: { images: true },
    });

    if (!tour) {
      throw new Error('Tour not found');
    }

    const updatedTour = await prisma.tour.update({
      where: { id },
      data: {
        images: [...tour.images, ...imageKeys],
      },
      select: { images: true },
    });

    return updatedTour;
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

    const updatedImages = [coverImageKey, ...tour.images.slice(1)];

    const updatedTour = await prisma.tour.update({
      where: { id },
      data: { images: updatedImages },
      select: { images: true },
    });

    return updatedTour;
  }
}
