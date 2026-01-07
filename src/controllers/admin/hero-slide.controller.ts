import { S3Folder } from '@/common/constants';
import { HeroSlideService } from '@/services/admin/hero-slide.service';
import { deleteImagesFromS3, uploadImageToS3 } from '@/utils/s3';
import type { Request, Response } from 'express';

export class HeroSlideController {
    
  /**
   * Get all hero slides (admin)
   */
  static async getAllHeroSlides(req: Request, res: Response) {
    try {
      const { page = '1', limit = '10', sortBy = 'order', sortOrder = 'asc' } = req.query;

      const result = await HeroSlideService.getAllHeroSlides(
        parseInt(page as string),
        parseInt(limit as string),
        sortBy as string,
        sortOrder as string
      );

      return res.deliver(200, true, result);
    } catch (error) {
      console.error('Error fetching hero slides:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch hero slides'
      );
    }
  }

  /**
   * Get hero slide by ID
   */
  static async getHeroSlideById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const slide = await HeroSlideService.getHeroSlideById(id);

      return res.deliver(200, true, slide);
    } catch (error) {
      console.error('Error fetching hero slide:', error);
      return res.deliver(
        404,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch hero slide'
      );
    }
  }

  /**
   * Create a new hero slide
   */
  static async createHeroSlide(req: Request, res: Response) {
    try {
      console.log('📝 Creating hero slide...');

      const bodyData = req.validated?.body || req.body;
      const file = req.file;

      if (!file) {
        return res.deliver(400, false, undefined, 'Image is required');
      }

      // Upload image to S3
      const imageKey = await uploadImageToS3(file, S3Folder.TOUR_IMAGES);
      const imageUrl = `${process.env.AWS_CLOUDFRONT_ENDPOINT}/${imageKey}`;

      const slide = await HeroSlideService.createHeroSlide({
        title: bodyData.title,
        subtitle: bodyData.subtitle,
        location: bodyData.location,
        duration: bodyData.duration,
        imageKey,
        imageUrl,
        ctaText: bodyData.ctaText,
        ctaLink: bodyData.ctaLink,
        isActive: bodyData.isActive,
        order: bodyData.order,
      });

      console.log('✅ Hero slide created successfully:', slide.id);
      return res.deliver(201, true, slide, 'Hero slide created successfully');
    } catch (error) {
      console.error('❌ Error creating hero slide:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to create hero slide'
      );
    }
  }

  /**
   * Update a hero slide
   */
  static async updateHeroSlide(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const bodyData = req.validated?.body || req.body;
      const file = req.file;

      console.log('🔄 Updating hero slide:', id);

      const updateData: any = { ...bodyData };

      // Handle image update if new file is uploaded
      if (file) {
        const existingSlide = await HeroSlideService.getHeroSlideById(id);

        const imageKey = await uploadImageToS3(file, S3Folder.TOUR_IMAGES);
        const imageUrl = `${process.env.AWS_CLOUDFRONT_ENDPOINT}/${imageKey}`;

        updateData.imageKey = imageKey;
        updateData.imageUrl = imageUrl;

        // Delete old image
        if (existingSlide.imageKey) {
          await deleteImagesFromS3([existingSlide.imageKey]);
        }
      }

      const slide = await HeroSlideService.updateHeroSlide(id, updateData);

      console.log('✅ Hero slide updated successfully');
      return res.deliver(200, true, slide, 'Hero slide updated successfully');
    } catch (error) {
      console.error('❌ Error updating hero slide:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to update hero slide'
      );
    }
  }

  /**
   * Delete a hero slide
   */
  static async deleteHeroSlide(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const imageKey = await HeroSlideService.deleteHeroSlide(id);

      // Delete image from S3
      if (imageKey) {
        await deleteImagesFromS3([imageKey]);
      }

      return res.deliver(200, true, undefined, 'Hero slide deleted successfully');
    } catch (error) {
      console.error('Error deleting hero slide:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to delete hero slide'
      );
    }
  }

  /**
   * Reorder hero slides
   */
  static async reorderHeroSlides(req: Request, res: Response) {
    try {
      const bodyData = req.validated?.body || req.body;
      const { slides } = bodyData;

      const updatedSlides = await HeroSlideService.updateSlideOrders(slides);

      return res.deliver(200, true, updatedSlides, 'Hero slides reordered successfully');
    } catch (error) {
      console.error('Error reordering hero slides:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to reorder hero slides'
      );
    }
  }
}
