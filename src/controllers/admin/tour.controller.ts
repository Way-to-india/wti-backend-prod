import type { Request, Response } from 'express';
import prisma from '@/config/db';
import type { Prisma } from 'prisma/generated/prisma/client';
import { S3Folder } from '@/common/constants';
import { deleteImagesFromS3, uploadImageToS3, uploadMultipleImagesToS3 } from '@/utils/s3';

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

      const orderBy: Prisma.TourOrderByWithRelationInput = {};
      orderBy[sortBy as keyof Prisma.TourOrderByWithRelationInput] =
        sortOrder === 'asc' ? 'asc' : 'desc';

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
      const { includeAll } = req.query;

      const include: Prisma.TourInclude | undefined =
        includeAll === 'true'
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
        return res.deliver(404, false, undefined, 'Tour not found');
      }

      await prisma.tour.update({
        where: { id: tour.id },
        data: { viewCount: { increment: 1 } },
      });

      return res.deliver(200, true, tour);
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

  static async createTour(req: Request, res: Response) {
    try {
      const bodyData = req.validated?.body || req.body;

      const {
        title,
        slug,
        metatitle,
        metadesc,
        overview,
        description,
        durationDays,
        durationNights,
        price,
        discountPrice,
        currency,
        minGroupSize,
        maxGroupSize,
        bestTime,
        idealFor,
        difficulty,
        isActive,
        isFeatured,
        cancellationPolicy,
        travelTips,
        startCityId,
        highlights,
        inclusions,
        exclusions,
        itinerary,
        themes,
        cities,
        faqs,
        priceGuide,
      } = bodyData;

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      let uploadedImages: string[] = [];
      let itineraryImagesMap: { [key: string]: string } = {};

      if (files.images && files.images.length > 0) {
        uploadedImages = await uploadMultipleImagesToS3(files.images, S3Folder.TOUR_IMAGES);
      }

      if (files.itineraryImages && files.itineraryImages.length > 0) {
        const itineraryImageKeys = await uploadMultipleImagesToS3(
          files.itineraryImages,
          S3Folder.TOUR_IMAGES
        );

        files.itineraryImages.forEach((file, index) => {
          itineraryImagesMap[index.toString()] = itineraryImageKeys[index];
        });
      }

      if (files.coverImage && files.coverImage.length > 0) {
        const coverImageKey = await uploadImageToS3(files.coverImage[0], S3Folder.TOUR_IMAGES);
        uploadedImages.unshift(coverImageKey);
      }

      const itineraryData = itinerary
        ? itinerary.map((item: any, index: number) => ({
            day: item.day || index + 1,
            title: item.title,
            description: item.description,
            imageUrl: itineraryImagesMap[index.toString()] || item.imageUrl || null,
          }))
        : undefined;

      const tour = await prisma.tour.create({
        data: {
          title,
          slug,
          metatitle,
          metadesc,
          overview,
          description,
          durationDays,
          durationNights,
          price,
          discountPrice,
          currency,
          minGroupSize,
          maxGroupSize,
          bestTime,
          idealFor,
          difficulty,
          isActive,
          isFeatured,
          cancellationPolicy,
          travelTips,
          startCityId,
          images: uploadedImages,
          highlights,
          inclusions,
          exclusions,
          itinerary: itineraryData
            ? {
                create: itineraryData,
              }
            : undefined,
          themes: themes
            ? {
                create: themes.map((themeId: string) => ({ themeId })),
              }
            : undefined,
          cities: cities
            ? {
                create: cities.map((item: any, index: number) => ({
                  cityId: item.cityId,
                  order: item.order !== undefined ? item.order : index,
                })),
              }
            : undefined,
          faqs: faqs
            ? {
                create: faqs.map((faq: any) => ({
                  isActive: faq.isActive !== undefined ? faq.isActive : true,
                  questions: {
                    create: faq.questions.map((q: any, index: number) => ({
                      question: q.question,
                      answer: q.answer,
                      order: q.order !== undefined ? q.order : index,
                    })),
                  },
                })),
              }
            : undefined,
          priceGuide: priceGuide
            ? {
                create: priceGuide.map((item: any, index: number) => ({
                  title: item.title,
                  value: item.value || 0,
                  order: item.order !== undefined ? item.order : index,
                })),
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

      return res.deliver(201, true, tour, 'Tour created successfully');
    } catch (error) {
      console.error('Error creating tour:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to create tour'
      );
    }
  }

  static async updateTour(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const bodyData = req.validated?.body || req.body;
      const { itinerary, themes, cities, faqs, priceGuide, ...mainData } = bodyData;

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      let newImages: string[] = [];

      const existingTour = await prisma.tour.findUnique({
        where: { id },
        select: { images: true },
      });

      if (!existingTour) {
        return res.deliver(404, false, undefined, 'Tour not found');
      }

      if (files.images && files.images.length > 0) {
        newImages = await uploadMultipleImagesToS3(files.images, S3Folder.TOUR_IMAGES);
      }

      const updatedImages = mainData.images
        ? [...mainData.images, ...newImages]
        : [...existingTour.images, ...newImages];

      const updateData: any = {
        ...mainData,
        images: updatedImages,
      };

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

      return res.deliver(200, true, tour, 'Tour updated successfully');
    } catch (error) {
      console.error('Error updating tour:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to update tour'
      );
    }
  }

  static async deleteTour(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const tour = await prisma.tour.findUnique({
        where: { id },
        select: { images: true, itinerary: { select: { imageUrl: true } } },
      });

      if (!tour) {
        return res.deliver(404, false, undefined, 'Tour not found');
      }

      await prisma.tour.delete({ where: { id } });

      const imageKeys = [
        ...tour.images,
        ...tour.itinerary.map((item) => item.imageUrl).filter(Boolean),
      ] as string[];

      if (imageKeys.length > 0) {
        await deleteImagesFromS3(imageKeys);
      }

      return res.deliver(200, true, undefined, 'Tour deleted successfully');
    } catch (error) {
      console.error('Error deleting tour:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to delete tour'
      );
    }
  }

  static async uploadGalleryImages(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.deliver(400, false, undefined, 'No images provided');
      }

      const tour = await prisma.tour.findUnique({
        where: { id },
        select: { images: true },
      });

      if (!tour) {
        return res.deliver(404, false, undefined, 'Tour not found');
      }

      const newImageKeys = await uploadMultipleImagesToS3(files, S3Folder.TOUR_IMAGES);

      const updatedTour = await prisma.tour.update({
        where: { id },
        data: {
          images: [...tour.images, ...newImageKeys],
        },
        select: { images: true },
      });

      return res.deliver(200, true, updatedTour, 'Images uploaded successfully');
    } catch (error) {
      console.error('Error uploading gallery images:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to upload images'
      );
    }
  }

  static async deleteGalleryImage(req: Request, res: Response) {
    try {
      const { id, imageKey } = req.params;

      const tour = await prisma.tour.findUnique({
        where: { id },
        select: { images: true },
      });

      if (!tour) {
        return res.deliver(404, false, undefined, 'Tour not found');
      }

      const updatedImages = tour.images.filter((img) => img !== imageKey);

      await prisma.tour.update({
        where: { id },
        data: { images: updatedImages },
      });

      await deleteImagesFromS3([imageKey]);

      return res.deliver(200, true, { images: updatedImages }, 'Image deleted successfully');
    } catch (error) {
      console.error('Error deleting image:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to delete image'
      );
    }
  }

  static async uploadCoverImage(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        return res.deliver(400, false, undefined, 'No image provided');
      }

      const tour = await prisma.tour.findUnique({
        where: { id },
        select: { images: true },
      });

      if (!tour) {
        return res.deliver(404, false, undefined, 'Tour not found');
      }

      const coverImageKey = await uploadImageToS3(file, S3Folder.TOUR_IMAGES);

      const updatedImages = [coverImageKey, ...tour.images.slice(1)];

      const updatedTour = await prisma.tour.update({
        where: { id },
        data: { images: updatedImages },
        select: { images: true },
      });

      return res.deliver(200, true, updatedTour, 'Cover image uploaded successfully');
    } catch (error) {
      console.error('Error uploading cover image:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to upload cover image'
      );
    }
  }

  static async uploadItineraryImages(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const files = req.files as Express.Multer.File[];
      const { dayIndex } = req.body;

      if (!files || files.length === 0) {
        return res.deliver(400, false, undefined, 'No images provided');
      }

      const imageKeys = await uploadMultipleImagesToS3(files, S3Folder.TOUR_IMAGES);

      return res.deliver(
        200,
        true,
        { imageKeys, dayIndex },
        'Itinerary images uploaded successfully'
      );
    } catch (error) {
      console.error('Error uploading itinerary images:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to upload itinerary images'
      );
    }
  }
}
