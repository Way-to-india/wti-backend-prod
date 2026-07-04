import { S3Folder } from '@/common/constants';
import { handleRelatedDataUpdates, prepareBasicUpdateData } from '@/helpers/tour-update.helper';
import {
  handleImageUploads,
  parseFilters,
  parseIncludes,
  prepareItineraryData,
  prepareTourData,
} from '@/helpers/tour.helper';
import { TourService } from '@/services/admin/tour.service';
import { deleteImagesFromS3, uploadImageToS3, uploadMultipleImagesToS3 } from '@/utils/s3';
import type { Request, Response } from 'express';

export class TourController {
  static async getAllTours(req: Request, res: Response) {
    try {
      const {
        page = '1',
        limit = '10',
        sortBy = 'createdAt',
        sortOrder = 'desc',
        routeMap,
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
        sortOrder as string,
        routeMap as string | undefined
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
      console.log('📝 Creating tour...');

      const bodyData = req.validated?.body || req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      const { uploadedCoverImage, uploadedGalleryImages, itineraryImagesMap } =
        await handleImageUploads(files);

      const itineraryData = prepareItineraryData(bodyData.itinerary, itineraryImagesMap);
      const tourData = prepareTourData(
        bodyData,
        uploadedCoverImage,
        uploadedGalleryImages,
        itineraryData
      );

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

      if (!bodyData || Object.keys(bodyData).length === 0) {
        return res.deliver(400, false, undefined, 'No data provided for update');
      }

      const updateData = await prepareBasicUpdateData(id, bodyData, files);

      if (Object.keys(updateData).length > 0) {
        await TourService.updateTour(id, updateData);
      }

      await handleRelatedDataUpdates(id, bodyData, files);

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
}
