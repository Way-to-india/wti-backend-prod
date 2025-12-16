import type { Request, Response } from 'express';
import { TourService } from '@/services/admin/tour.service';
import type { TourFilters, TourIncludes } from '@/helpers/tour-query.helper';
import { S3Folder } from '@/common/constants';
import { deleteImagesFromS3, uploadImageToS3, uploadMultipleImagesToS3 } from '@/utils/s3';

export class TourController {
  
  static async getAllTours(req: Request, res: Response) {
    try {
      const {
        page = '1',
        limit = '10',
        sortBy = 'createdAt',
        sortOrder = 'desc',
        ...queryFilters
      } = req.query;

      const filters: TourFilters = {};
      const includes: TourIncludes = {};

      // Parse all filter parameters
      if (queryFilters.search) filters.search = queryFilters.search as string;
      if (queryFilters.id) filters.id = queryFilters.id as string;
      if (queryFilters.slug) filters.slug = queryFilters.slug as string;
      if (queryFilters.title) filters.title = queryFilters.title as string;
      if (queryFilters.isActive !== undefined) filters.isActive = queryFilters.isActive === 'true';
      if (queryFilters.isFeatured !== undefined)
        filters.isFeatured = queryFilters.isFeatured === 'true';
      if (queryFilters.minPrice) filters.minPrice = parseInt(queryFilters.minPrice as string);
      if (queryFilters.maxPrice) filters.maxPrice = parseInt(queryFilters.maxPrice as string);
      if (queryFilters.currency) filters.currency = queryFilters.currency as string;
      if (queryFilters.hasDiscount) filters.hasDiscount = queryFilters.hasDiscount === 'true';
      if (queryFilters.minDurationDays)
        filters.minDurationDays = parseInt(queryFilters.minDurationDays as string);
      if (queryFilters.maxDurationDays)
        filters.maxDurationDays = parseInt(queryFilters.maxDurationDays as string);
      if (queryFilters.minDurationNights)
        filters.minDurationNights = parseInt(queryFilters.minDurationNights as string);
      if (queryFilters.maxDurationNights)
        filters.maxDurationNights = parseInt(queryFilters.maxDurationNights as string);
      if (queryFilters.minGroupSize)
        filters.minGroupSize = parseInt(queryFilters.minGroupSize as string);
      if (queryFilters.maxGroupSize)
        filters.maxGroupSize = parseInt(queryFilters.maxGroupSize as string);
      if (queryFilters.minRating) filters.minRating = parseFloat(queryFilters.minRating as string);
      if (queryFilters.maxRating) filters.maxRating = parseFloat(queryFilters.maxRating as string);
      if (queryFilters.minReviewCount)
        filters.minReviewCount = parseInt(queryFilters.minReviewCount as string);
      if (queryFilters.minViewCount)
        filters.minViewCount = parseInt(queryFilters.minViewCount as string);
      if (queryFilters.minBookingCount)
        filters.minBookingCount = parseInt(queryFilters.minBookingCount as string);
      if (queryFilters.createdAfter)
        filters.createdAfter = new Date(queryFilters.createdAfter as string);
      if (queryFilters.createdBefore)
        filters.createdBefore = new Date(queryFilters.createdBefore as string);
      if (queryFilters.updatedAfter)
        filters.updatedAfter = new Date(queryFilters.updatedAfter as string);
      if (queryFilters.updatedBefore)
        filters.updatedBefore = new Date(queryFilters.updatedBefore as string);
      if (queryFilters.startCityId) filters.startCityId = queryFilters.startCityId as string;
      if (queryFilters.startCitySlug) filters.startCitySlug = queryFilters.startCitySlug as string;
      if (queryFilters.startCityName) filters.startCityName = queryFilters.startCityName as string;
      if (queryFilters.cityId) filters.cityId = queryFilters.cityId as string;
      if (queryFilters.citySlug) filters.citySlug = queryFilters.citySlug as string;
      if (queryFilters.cityName) filters.cityName = queryFilters.cityName as string;
      if (queryFilters.stateId) filters.stateId = queryFilters.stateId as string;
      if (queryFilters.stateName) filters.stateName = queryFilters.stateName as string;
      if (queryFilters.countryId) filters.countryId = queryFilters.countryId as string;
      if (queryFilters.countryName) filters.countryName = queryFilters.countryName as string;
      if (queryFilters.themeId) filters.themeId = queryFilters.themeId as string;
      if (queryFilters.themeSlug) filters.themeSlug = queryFilters.themeSlug as string;
      if (queryFilters.themeName) filters.themeName = queryFilters.themeName as string;
      if (queryFilters.difficulty) filters.difficulty = queryFilters.difficulty as string;
      if (queryFilters.bestTime) filters.bestTime = queryFilters.bestTime as string;
      if (queryFilters.idealFor) filters.idealFor = queryFilters.idealFor as string;

      // Parse include parameters
      includes.includeStartCity = queryFilters.includeStartCity === 'true';
      includes.includeItinerary = queryFilters.includeItinerary === 'true';
      includes.includeThemes = queryFilters.includeThemes === 'true';
      includes.includeCities = queryFilters.includeCities === 'true';
      includes.includeFaqs = queryFilters.includeFaqs === 'true';
      includes.includeReviews = queryFilters.includeReviews === 'true';
      includes.includePriceGuide = queryFilters.includePriceGuide === 'true';

      const result = await TourService.getAllTours(
        parseInt(page as string),
        parseInt(limit as string),
        filters,
        includes,
        sortBy as string,
        sortOrder as string
      );

      return res.deliver(200, true, result);
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

      const tour = await TourService.getTourById(id, includeAll === 'true');

      return res.deliver(200, true, tour);
    } catch (error) {
      console.error('Error fetching tour:', error);
      return res.deliver(
        404,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch tour'
      );
    }
  }

  static async createTour(req: Request, res: Response) {
    try {
      console.log('📝 Creating tour - Request received');

      const bodyData = req.validated?.body || req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      // 🔍 DEBUG: Log what we received
      console.log('📦 Files received:', {
        images: files?.images?.length || 0,
        itineraryImages: files?.itineraryImages?.length || 0,
        coverImage: files?.coverImage?.length || 0,
      });

      let uploadedImages: string[] = [];
      let itineraryImagesMap: { [key: string]: string } = {};

      // Upload regular images
      if (files?.images?.length > 0) {
        console.log(`📤 Uploading ${files.images.length} regular images...`);
        uploadedImages = await uploadMultipleImagesToS3(files.images, S3Folder.TOUR_IMAGES);
        console.log(`✅ Uploaded ${uploadedImages.length} regular images`);
      }

      // Upload itinerary images (if any)
      if (files?.itineraryImages?.length > 0) {
        console.log(`📤 Uploading ${files.itineraryImages.length} itinerary images...`);
        const itineraryImageKeys = await uploadMultipleImagesToS3(
          files.itineraryImages,
          S3Folder.TOUR_IMAGES
        );
        files.itineraryImages.forEach((file, index) => {
          itineraryImagesMap[index.toString()] = itineraryImageKeys[index];
        });
        console.log(`✅ Uploaded ${itineraryImageKeys.length} itinerary images`);
      }

      // Upload cover image
      if (files?.coverImage?.length > 0) {
        console.log('📤 Uploading cover image...');
        const coverImageKey = await uploadImageToS3(files.coverImage[0], S3Folder.TOUR_IMAGES);
        uploadedImages.unshift(coverImageKey);
        console.log('✅ Uploaded cover image');
      }

      // Parse itinerary if it's a string
      let itineraryArray = bodyData.itinerary;
      if (typeof itineraryArray === 'string') {
        try {
          itineraryArray = JSON.parse(itineraryArray);
          console.log('📋 Parsed itinerary JSON');
        } catch (e) {
          console.error('❌ Failed to parse itinerary JSON:', e);
          return res.deliver(400, false, undefined, 'Invalid itinerary format');
        }
      }

      // Map itinerary with images
      const itineraryData = itineraryArray?.map((item: any, index: number) => {
        const imageUrl = itineraryImagesMap[index.toString()] || item.imageUrl || null;

        return {
          day: parseInt(item.day) || index + 1,
          title: item.title,
          description: item.description,
          imageUrl: imageUrl,
        };
      });

      console.log(`📋 Processed ${itineraryData?.length || 0} itinerary items`);

      // Helper function to parse JSON fields
      const parseJsonField = (field: any) => {
        if (typeof field === 'string') {
          try {
            return JSON.parse(field);
          } catch (e) {
            return field;
          }
        }
        return field;
      };

      // Helper function to convert string to number
      const toNumber = (value: any): number => {
        const num = Number(value);
        return isNaN(num) ? 0 : num;
      };

      // Helper function to convert string to boolean
      const toBoolean = (value: any): boolean => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true';
        }
        return Boolean(value);
      };

      // ✅ Convert all numeric and boolean fields from strings to proper types
      const tourData = {
        title: bodyData.title,
        slug: bodyData.slug,
        durationDays: toNumber(bodyData.durationDays),
        durationNights: toNumber(bodyData.durationNights),
        price: toNumber(bodyData.price),
        currency: bodyData.currency,
        minGroupSize: toNumber(bodyData.minGroupSize),
        maxGroupSize: toNumber(bodyData.maxGroupSize),
        isActive: toBoolean(bodyData.isActive),
        isFeatured: toBoolean(bodyData.isFeatured),
        metatitle: bodyData.metatitle,
        metadesc: bodyData.metadesc,
        overview: bodyData.overview,
        description: bodyData.description,
        discountPrice: bodyData.discountPrice ? toNumber(bodyData.discountPrice) : undefined,
        bestTime: bodyData.bestTime,
        idealFor: bodyData.idealFor,
        difficulty: bodyData.difficulty,
        cancellationPolicy: bodyData.cancellationPolicy,
        travelTips: bodyData.travelTips,
        startCityId: bodyData.startCityId,
        highlights: parseJsonField(bodyData.highlights),
        inclusions: parseJsonField(bodyData.inclusions),
        exclusions: parseJsonField(bodyData.exclusions),
        themes: parseJsonField(bodyData.themes),
        cities: parseJsonField(bodyData.cities),
        images: uploadedImages,
        itinerary: itineraryData,
      };

      console.log('💾 Creating tour in database...');
      const tour = await TourService.createTour(tourData);
      console.log('✅ Tour created successfully:', tour.id);

      return res.deliver(201, true, tour, 'Tour created successfully');
    } catch (error) {
      console.error('❌ Error creating tour:', error);

      // More detailed error logging
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
      }

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
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      let newImages: string[] = [];

      if (files?.images?.length > 0) {
        newImages = await uploadMultipleImagesToS3(files.images, S3Folder.TOUR_IMAGES);
      }

      const updateData = {
        ...bodyData,
        images: bodyData.images ? [...bodyData.images, ...newImages] : undefined,
      };

      const tour = await TourService.updateTour(id, updateData);

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

      const imageKeys = await TourService.deleteTour(id);

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

      const newImageKeys = await uploadMultipleImagesToS3(files, S3Folder.TOUR_IMAGES);
      const updatedTour = await TourService.addGalleryImages(id, newImageKeys);

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

      const result = await TourService.deleteGalleryImage(id, imageKey);
      await deleteImagesFromS3([imageKey]);
      return res.deliver(200, true, result, 'Image deleted successfully');
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

      const coverImageKey = await uploadImageToS3(file, S3Folder.TOUR_IMAGES);
      const updatedTour = await TourService.updateCoverImage(id, coverImageKey);

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
