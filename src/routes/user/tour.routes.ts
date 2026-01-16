import { ReviewController } from '@/controllers/user/review.controller';
import { uploadReviewImages } from '@/middlewares/review.multer';
import { authenticate } from '@/middlewares/user/auth.middleware';
import { Router } from 'express';

const router = Router();

/**
 * @route   POST /api/user/tour/review
 * @desc    Create a new review
 * @access  Private (authenticated users only)
 */
router.post('/review', authenticate, uploadReviewImages, ReviewController.createReview);

/**
 * @route   PUT /api/user/tour/review/:id
 * @desc    Update an existing review
 * @access  Private (authenticated users only, owner only)
 */
router.put('/review/:id', authenticate, uploadReviewImages, ReviewController.updateReview);

/**
 * @route   GET /api/user/tour/review
 * @desc    List reviews with filters
 * @access  Public
 */
router.get('/review', ReviewController.listReviews);

/**
 * @route   GET /api/user/tour/review/:id
 * @desc    Get a single review by ID
 * @access  Public
 */
router.get('/review/:id', ReviewController.getReview);

/**
 * @route   DELETE /api/user/tour/review/:id
 * @desc    Delete a review
 * @access  Private (authenticated users only, owner only)
 */
router.delete('/review/:id', authenticate, ReviewController.deleteReview);

export default router;
