import type { Request, Response } from 'express';
import { TourService } from '@/services/admin/tour.service';
import { S3Folder } from '@/common/constants';
import { deleteImagesFromS3, uploadImageToS3, uploadMultipleImagesToS3 } from '@/utils/s3';
import { parseJsonField, toNumber, toBoolean, prepareItineraryData, parseFilters, parseIncludes, handleImageUploads, prepareTourData } from '@/helpers/tour.helper';

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

      const filters = parseFilters(queryFilters);
      const includes = parseIncludes(queryFilters);

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

      const { uploadedImages, itineraryImagesMap } = await handleImageUploads(files);

      const itineraryData = prepareItineraryData(bodyData.itinerary, itineraryImagesMap);
      const tourData = prepareTourData(bodyData, uploadedImages, itineraryData);

      console.log('💾 Creating tour in database...');
      const tour = await TourService.createTour(tourData);
      console.log('✅ Tour created successfully:', tour.id);

      return res.deliver(201, true, tour, 'Tour created successfully');
    } catch (error) {
      console.error('❌ Error creating tour:', error);
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

      console.log('🔄 Starting tour update for ID:', id);
      console.log('📦 Body fields received:', Object.keys(bodyData));
      console.log('🖼️ Files received:', files ? Object.keys(files) : 'none');

      if (!bodyData || Object.keys(bodyData).length === 0) {
        return res.deliver(400, false, undefined, 'No data provided for update');
      }

      // ==================== STEP 1: Handle Image Updates ====================
      let updatedImageUrls: string[] = [];

      // Parse existing images from body
      const existingImages = bodyData.images ? parseJsonField(bodyData.images) : [];

      console.log('📸 Existing images count:', existingImages.length);

      // Upload new images if provided
      if (files?.images && files.images.length > 0) {
        console.log('⬆️ Uploading', files.images.length, 'new images...');
        const newImageKeys = await uploadMultipleImagesToS3(files.images, S3Folder.TOUR_IMAGES);
        console.log('✅ New images uploaded:', newImageKeys.length);

        // Combine existing + new images
        updatedImageUrls = [...existingImages, ...newImageKeys];
      } else {
        // No new images, just use existing ones
        updatedImageUrls = existingImages;
      }

      console.log('📊 Total images after update:', updatedImageUrls.length);

      // ==================== STEP 2: Prepare Basic Update Data ====================
      const updateData: any = {};

      // Basic text fields
      if ('title' in bodyData) updateData.title = bodyData.title;
      if ('slug' in bodyData) updateData.slug = bodyData.slug;
      if ('metatitle' in bodyData) updateData.metatitle = bodyData.metatitle || null;
      if ('metadesc' in bodyData) updateData.metadesc = bodyData.metadesc || null;
      if ('overview' in bodyData) updateData.overview = bodyData.overview || null;
      if ('description' in bodyData) updateData.description = bodyData.description || null;

      // Numeric fields
      if ('durationDays' in bodyData) {
        const value = toNumber(bodyData.durationDays);
        if (value !== undefined) updateData.durationDays = value;
      }
      if ('durationNights' in bodyData) {
        const value = toNumber(bodyData.durationNights);
        if (value !== undefined) updateData.durationNights = value;
      }
      if ('price' in bodyData) {
        const value = toNumber(bodyData.price);
        if (value !== undefined) updateData.price = value;
      }
      if ('discountPrice' in bodyData) {
        const value = toNumber(bodyData.discountPrice);
        if (value !== undefined) updateData.discountPrice = value;
      }
      if ('minGroupSize' in bodyData) {
        const value = toNumber(bodyData.minGroupSize);
        if (value !== undefined) updateData.minGroupSize = value;
      }
      if ('maxGroupSize' in bodyData) {
        const value = toNumber(bodyData.maxGroupSize);
        if (value !== undefined) updateData.maxGroupSize = value;
      }

      // String fields
      if ('currency' in bodyData) updateData.currency = bodyData.currency;
      if ('bestTime' in bodyData) updateData.bestTime = bodyData.bestTime || null;
      if ('idealFor' in bodyData) updateData.idealFor = bodyData.idealFor || null;
      if ('difficulty' in bodyData) updateData.difficulty = bodyData.difficulty || null;
      if ('cancellationPolicy' in bodyData) {
        updateData.cancellationPolicy = bodyData.cancellationPolicy || null;
      }
      if ('travelTips' in bodyData) updateData.travelTips = bodyData.travelTips || null;

      // Boolean fields
      if ('isActive' in bodyData) {
        const value = toBoolean(bodyData.isActive);
        if (value !== undefined) updateData.isActive = value;
      }
      if ('isFeatured' in bodyData) {
        const value = toBoolean(bodyData.isFeatured);
        if (value !== undefined) updateData.isFeatured = value;
      }

      // Relation fields
      if ('startCityId' in bodyData) {
        updateData.startCityId = bodyData.startCityId || null;
      }

      // Array fields
      if ('highlights' in bodyData) {
        updateData.highlights = parseJsonField(bodyData.highlights) || [];
      }
      if ('inclusions' in bodyData) {
        updateData.inclusions = parseJsonField(bodyData.inclusions) || [];
      }
      if ('exclusions' in bodyData) {
        updateData.exclusions = parseJsonField(bodyData.exclusions) || [];
      }

      // Add images to update data
      updateData.images = updatedImageUrls;

      // ==================== STEP 3: Update Basic Tour Data ====================
      console.log('💾 Updating basic tour data...');
      await TourService.updateTour(id, updateData);

      // ==================== STEP 4: Handle Related Data Updates ====================

      // Update Itinerary
      if ('itinerary' in bodyData) {
        console.log('📋 Updating itinerary...');
        const itineraryArray = parseJsonField(bodyData.itinerary);

        if (Array.isArray(itineraryArray) && itineraryArray.length > 0) {
          // Handle itinerary images if provided
          let itineraryImagesMap: { [key: string]: string } = {};
          if (files?.itineraryImages && files.itineraryImages.length > 0) {
            console.log('⬆️ Uploading itinerary images...');
            const itineraryImageKeys = await uploadMultipleImagesToS3(
              files.itineraryImages,
              S3Folder.TOUR_IMAGES
            );
            files.itineraryImages.forEach((file, index) => {
              itineraryImagesMap[index.toString()] = itineraryImageKeys[index];
            });
          }

          const itineraryData = prepareItineraryData(itineraryArray, itineraryImagesMap);
          await TourService.updateTourItinerary(id, itineraryData);
          console.log('✅ Itinerary updated');
        }
      }

      // Update Themes
      if ('themes' in bodyData) {
        console.log('🏷️ Updating themes...');
        const themes = parseJsonField(bodyData.themes);
        if (Array.isArray(themes) && themes.length > 0) {
          await TourService.updateTourThemes(id, themes);
          console.log('✅ Themes updated');
        }
      }

      // Update Cities
      if ('cities' in bodyData) {
        console.log('🏙️ Updating cities...');
        const cities = parseJsonField(bodyData.cities);
        if (Array.isArray(cities) && cities.length > 0) {
          const citiesData = cities.map((cityId: string, index: number) => ({
            cityId,
            order: index,
          }));
          await TourService.updateTourCities(id, citiesData);
          console.log('✅ Cities updated');
        }
      }

      // Update FAQs
      if ('faqs' in bodyData) {
        console.log('❓ Updating FAQs...');
        const faqs = parseJsonField(bodyData.faqs);
        if (Array.isArray(faqs) && faqs.length > 0) {
          await TourService.updateTourFaqs(id, faqs);
          console.log('✅ FAQs updated');
        }
      }

      // Update Price Guide
      if ('priceGuide' in bodyData) {
        console.log('💰 Updating price guide...');
        const priceGuide = parseJsonField(bodyData.priceGuide);
        if (Array.isArray(priceGuide) && priceGuide.length > 0) {
          await TourService.updateTourPriceGuide(id, priceGuide);
          console.log('✅ Price guide updated');
        }
      }

      // ==================== STEP 5: Fetch and Return Updated Tour ====================
      const updatedTour = await TourService.getTourById(id, true);

      console.log('✅ Tour updated successfully');
      return res.deliver(200, true, updatedTour, 'Tour updated successfully');
    } catch (error) {
      console.error('❌ Error updating tour:', error);
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

  static async handleRelatedDataUpdates(
    tourId: string,
    bodyData: any,
    files: { [fieldname: string]: Express.Multer.File[] }
  ) {
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

    if (bodyData.itinerary !== undefined) {
      console.log('📋 Updating itinerary...');

      let itineraryArray = parseJsonField(bodyData.itinerary);

      let itineraryImagesMap: { [key: string]: string } = {};
      if (files?.itineraryImages?.length > 0) {
        console.log(`📤 Uploading ${files.itineraryImages.length} itinerary images...`);
        const itineraryImageKeys = await uploadMultipleImagesToS3(
          files.itineraryImages,
          S3Folder.TOUR_IMAGES
        );
        files.itineraryImages.forEach((file, index) => {
          itineraryImagesMap[index.toString()] = itineraryImageKeys[index];
        });
      }

      const itineraryData = itineraryArray?.map((item: any, index: number) => ({
        day: parseInt(item.day) || index + 1,
        title: item.title,
        description: item.description,
        imageUrl: itineraryImagesMap[index.toString()] || item.imageUrl || null,
      }));

      if (itineraryData && itineraryData.length > 0) {
        await TourService.updateTourItinerary(tourId, itineraryData);
        console.log('✅ Itinerary updated');
      }
    }

    // Update themes if provided
    if (bodyData.themes !== undefined) {
      console.log('🏷️ Updating themes...');
      const themes = parseJsonField(bodyData.themes);
      if (Array.isArray(themes) && themes.length > 0) {
        await TourService.updateTourThemes(tourId, themes);
        console.log('✅ Themes updated');
      }
    }

    // Update cities if provided
    if (bodyData.cities !== undefined) {
      console.log('🏙️ Updating cities...');
      const cities = parseJsonField(bodyData.cities);
      if (Array.isArray(cities) && cities.length > 0) {
        const citiesData = cities.map((cityId: string, index: number) => ({
          cityId,
          order: index,
        }));
        await TourService.updateTourCities(tourId, citiesData);
        console.log('✅ Cities updated');
      }
    }

    // Update FAQs if provided
    if (bodyData.faqs !== undefined) {
      console.log('❓ Updating FAQs...');
      const faqs = parseJsonField(bodyData.faqs);
      if (Array.isArray(faqs) && faqs.length > 0) {
        await TourService.updateTourFaqs(tourId, faqs);
        console.log('✅ FAQs updated');
      }
    }

    // Update price guide if provided
    if (bodyData.priceGuide !== undefined) {
      console.log('💰 Updating price guide...');
      const priceGuide = parseJsonField(bodyData.priceGuide);
      if (Array.isArray(priceGuide) && priceGuide.length > 0) {
        await TourService.updateTourPriceGuide(tourId, priceGuide);
        console.log('✅ Price guide updated');
      }
    }
  }
}
