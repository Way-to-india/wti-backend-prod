import { ReviewService } from '@/services/user/review.service';
import {
  createReviewSchema,
  listReviewsSchema,
  updateReviewSchema,
} from '@/validators/review.validator';
import type { Request, Response } from 'express';

export class ReviewController {
  /**
   * Create a new review
   * POST /api/reviews
   */
  static async createReview(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.deliver(401, false, undefined, 'Unauthorized');
      }

      const validationResult = createReviewSchema.safeParse({
        ...req.body,
        rating: parseInt(req.body.rating, 10),
      });

      if (!validationResult.success) {
        const errors = validationResult.error.message;
        return res.deliver(400, false, undefined, errors);
      }

      const data = validationResult.data;

      const images = req.files as Express.Multer.File[] | undefined;

      const review = await ReviewService.createReview(userId, data, images);

      return res.deliver(201, true, review, 'Review created successfully');
    } catch (error) {
      console.error('Create review error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to create review'
      );
    }
  }

  /**
   * Update an existing review
   * PUT /api/reviews/:id
   */
  static async updateReview(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const reviewId = req.params.id;

      if (!userId) {
        return res.deliver(401, false, undefined, 'Unauthorized');
      }

      if (!reviewId) {
        return res.deliver(400, false, undefined, 'Review ID is required');
      }

      const validationResult = updateReviewSchema.safeParse({
        ...req.body,
        rating: req.body.rating ? parseInt(req.body.rating, 10) : undefined,
        removeImageIds: req.body.removeImageIds ? JSON.parse(req.body.removeImageIds) : undefined,
      });

      if (!validationResult.success) {
        const errors = validationResult.error.message;
        return res.deliver(400, false, undefined, errors);
      }

      const data = validationResult.data;

      const images = req.files as Express.Multer.File[] | undefined;

      const review = await ReviewService.updateReview(userId, reviewId, data, images);

      return res.deliver(200, true, review, 'Review updated successfully');
    } catch (error) {
      console.error('Update review error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to update review'
      );
    }
  }

  /**
   * List reviews with filters
   * GET /api/reviews
   */
  static async listReviews(req: Request, res: Response) {
    try {
      const validationResult = listReviewsSchema.safeParse(req.query);

      if (!validationResult.success) {
        const errors = validationResult.error.message;
        return res.deliver(400, false, undefined, errors);
      }

      const filters = validationResult.data;

      const result = await ReviewService.listReviews(filters);

      return res.deliver(200, true, result);
    } catch (error) {
      console.error('List reviews error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch reviews'
      );
    }
  }

  /**
   * Get a single review by ID
   * GET /api/reviews/:id
   */
  static async getReview(req: Request, res: Response) {
    try {
      const reviewId = req.params.id;

      if (!reviewId) {
        return res.deliver(400, false, undefined, 'Review ID is required');
      }

      const review = await ReviewService.getReviewById(reviewId);

      if (!review) {
        return res.deliver(404, false, undefined, 'Review not found');
      }

      return res.deliver(200, true, review);
    } catch (error) {
      console.error('Get review error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch review'
      );
    }
  }

  /**
   * Delete a review
   * DELETE /api/reviews/:id
   */
  static async deleteReview(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const reviewId = req.params.id;

      if (!userId) {
        return res.deliver(401, false, undefined, 'Unauthorized');
      }

      if (!reviewId) {
        return res.deliver(400, false, undefined, 'Review ID is required');
      }

      await ReviewService.deleteReview(userId, reviewId);

      return res.deliver(200, true, undefined, 'Review deleted successfully');
    } catch (error) {
      console.error('Delete review error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to delete review'
      );
    }
  }
}
