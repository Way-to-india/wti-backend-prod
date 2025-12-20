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

    const citiesData = data.cities?.map((cityId: string) => ({
      cityId: cityId,
    }));

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

    const updateData: Prisma.TourUpdateInput = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.metatitle !== undefined) updateData.metatitle = data.metatitle;
    if (data.metadesc !== undefined) updateData.metadesc = data.metadesc;
    if (data.overview !== undefined) updateData.overview = data.overview;
    if (data.description !== undefined) updateData.description = data.description;

    if (data.durationDays !== undefined) updateData.durationDays = data.durationDays;
    if (data.durationNights !== undefined) updateData.durationNights = data.durationNights;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.discountPrice !== undefined) updateData.discountPrice = data.discountPrice;
    if (data.minGroupSize !== undefined) updateData.minGroupSize = data.minGroupSize;
    if (data.maxGroupSize !== undefined) updateData.maxGroupSize = data.maxGroupSize;

    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.bestTime !== undefined) updateData.bestTime = data.bestTime;
    if (data.idealFor !== undefined) updateData.idealFor = data.idealFor;
    if (data.difficulty !== undefined) updateData.difficulty = data.difficulty;
    if (data.cancellationPolicy !== undefined) {
      updateData.cancellationPolicy = data.cancellationPolicy;
    }
    if (data.travelTips !== undefined) updateData.travelTips = data.travelTips;

    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.isFeatured !== undefined) updateData.isFeatured = data.isFeatured;

    if (data.startCityId !== undefined)
      updateData.startCity =
        data.startCityId as Prisma.CityUpdateOneWithoutStartingToursNestedInput;

    if (data.images !== undefined) updateData.images = data.images;
    if (data.highlights !== undefined) updateData.highlights = data.highlights;
    if (data.inclusions !== undefined) updateData.inclusions = data.inclusions;
    if (data.exclusions !== undefined) updateData.exclusions = data.exclusions;

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

  /**
   * Update tour itinerary (delete old and create new)
   */
  static async updateTourItinerary(
    tourId: string,
    itinerary: Array<{
      day: number;
      title: string;
      description: string;
      imageUrl?: string | null;
    }>
  ) {
    await prisma.tourItinerary.deleteMany({
      where: { tourId },
    });

    if (itinerary.length > 0) {
      await prisma.tourItinerary.createMany({
        data: itinerary.map((item) => ({
          tourId,
          day: item.day,
          title: item.title,
          description: item.description,
          imageUrl: item.imageUrl || null,
        })),
      });
    }

    return await prisma.tour.findUnique({
      where: { id: tourId },
      include: { itinerary: { orderBy: { day: 'asc' } } },
    });
  }

  /**
   * Update tour themes
   */
  static async updateTourThemes(tourId: string, themeIds: string[]) {
    await prisma.tourTheme.deleteMany({
      where: { tourId },
    });

    if (themeIds.length > 0) {
      await prisma.tourTheme.createMany({
        data: themeIds.map((themeId) => ({
          tourId,
          themeId,
        })),
      });
    }

    return await prisma.tour.findUnique({
      where: { id: tourId },
      include: { themes: { include: { theme: true } } },
    });
  }

  /**
   * Update tour cities
   */
  static async updateTourCities(tourId: string, cities: Array<{ cityId: string; order: number }>) {
    await prisma.tourCity.deleteMany({
      where: { tourId },
    });

    if (cities.length > 0) {
      await prisma.tourCity.createMany({
        data: cities.map((city) => ({
          tourId,
          cityId: city.cityId,
          order: city.order,
        })),
      });
    }

    return await prisma.tour.findUnique({
      where: { id: tourId },
      include: { cities: { include: { city: true }, orderBy: { order: 'asc' } } },
    });
  }

  /**
   * Update tour FAQs
   */
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
    await prisma.faq.deleteMany({
      where: { tourId },
    });

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

  /**
   * Update tour price guide
   */
  static async updateTourPriceGuide(
    tourId: string,
    priceGuide: Array<{
      title: string;
      value: number;
      order: number;
    }>
  ) {
    await prisma.tourPriceGuide.deleteMany({
      where: { tourId },
    });

    if (priceGuide.length > 0) {
      await prisma.tourPriceGuide.createMany({
        data: priceGuide.map((item) => ({
          tourId,
          title: item.title,
          value: item.value,
          order: item.order,
        })),
      });
    }

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
