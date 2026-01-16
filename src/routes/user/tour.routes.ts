import { ReviewController } from '@/controllers/user/review.controller';
import { uploadReviewImages } from '@/middlewares/review.multer';
import { authenticate } from '@/middlewares/user/auth.middleware';
import { Router } from 'express';

const router = Router();

/**
 * @route   POST /api/reviews
 * @desc    Create a new review
 * @access  Private (authenticated users only)
 */
router.post('/', authenticate, uploadReviewImages, ReviewController.createReview);

/**
 * @route   PUT /api/reviews/:id
 * @desc    Update an existing review
 * @access  Private (authenticated users only, owner only)
 */
router.put('/:id', authenticate, uploadReviewImages, ReviewController.updateReview);

/**
 * @route   GET /api/reviews
 * @desc    List reviews with filters
 * @access  Public
 */
router.get('/', ReviewController.listReviews);

/**
 * @route   GET /api/reviews/:id
 * @desc    Get a single review by ID
 * @access  Public
 */
router.get('/:id', ReviewController.getReview);

/**
 * @route   DELETE /api/reviews/:id
 * @desc    Delete a review
 * @access  Private (authenticated users only, owner only)
 */
router.delete('/:id', authenticate, ReviewController.deleteReview);

export default router;
