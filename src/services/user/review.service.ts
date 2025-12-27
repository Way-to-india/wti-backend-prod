import { S3Folder } from '@/common/constants';
import prisma from '@/config/db';
import { prependCloudFrontURL } from '@/services/common/s3.service';
import { deleteImagesFromS3, uploadMultipleImagesToS3 } from '@/utils/s3';
import type {
  CreateReviewInput,
  ListReviewsInput,
  UpdateReviewInput,
} from '@/validators/review.validator';

export class ReviewService {
  /**
   * Create a new review with optional images
   */
  static async createReview(
    userId: string,
    data: CreateReviewInput,
    images?: Express.Multer.File[]
  ) {
    const { tourId, rating, title, comment } = data;

    // Check if tour exists
    const tour = await prisma.tour.findUnique({
      where: { id: tourId },
      select: { id: true, isActive: true },
    });

    if (!tour) {
      throw new Error('Tour not found');
    }

    if (!tour.isActive) {
      throw new Error('Tour is not active');
    }

    // Check if user already reviewed this tour
    const existingReview = await prisma.tourReview.findUnique({
      where: {
        userId_tourId: {
          userId,
          tourId,
        },
      },
    });

    if (existingReview) {
      throw new Error('You have already reviewed this tour');
    }

    // Upload images to S3 if provided
    let uploadedImageKeys: string[] = [];
    if (images && images.length > 0) {
      try {
        uploadedImageKeys = await uploadMultipleImagesToS3(images, S3Folder.REVIEW_IMAGES);
      } catch (error) {
        console.error('Error uploading review images:', error);
        throw new Error('Failed to upload images');
      }
    }

    try {
      // Create review and images in a transaction
      const review = await prisma.$transaction(async (tx) => {
        // Create the review
        const newReview = await tx.tourReview.create({
          data: {
            userId,
            tourId,
            rating,
            title,
            comment,
            isActive: true,
            isVerified: false,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profileImage: true,
              },
            },
            images: true,
          },
        });

        // Create review images if any
        if (uploadedImageKeys.length > 0) {
          await tx.reviewImage.createMany({
            data: uploadedImageKeys.map((key) => ({
              reviewId: newReview.id,
              key,
              url: prependCloudFrontURL(key),
              thumbnail: prependCloudFrontURL(key), // You can generate thumbnails if needed
            })),
          });
        }

        // Update tour rating and review count
        await this.updateTourRating(tx, tourId);

        return newReview;
      });

      // Fetch the complete review with images
      const completeReview = await prisma.tourReview.findUnique({
        where: { id: review.id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              profileImage: true,
            },
          },
          images: true,
        },
      });

      return completeReview;
    } catch (error) {
      // Cleanup uploaded images if review creation failed
      if (uploadedImageKeys.length > 0) {
        await deleteImagesFromS3(uploadedImageKeys);
      }
      throw error;
    }
  }

  /**
   * Update an existing review
   */
  static async updateReview(
    userId: string,
    reviewId: string,
    data: UpdateReviewInput,
    newImages?: Express.Multer.File[]
  ) {
    const { rating, title, comment, removeImageIds } = data;

    // Find the review and verify ownership
    const existingReview = await prisma.tourReview.findUnique({
      where: { id: reviewId },
      include: {
        images: true,
      },
    });

    if (!existingReview) {
      throw new Error('Review not found');
    }

    if (existingReview.userId !== userId) {
      throw new Error('You are not authorized to update this review');
    }

    // Upload new images if provided
    let uploadedImageKeys: string[] = [];
    if (newImages && newImages.length > 0) {
      // Check total image count
      const currentImageCount = existingReview.images.length;
      const imagesToRemoveCount = removeImageIds?.length || 0;
      const finalImageCount = currentImageCount - imagesToRemoveCount + newImages.length;

      if (finalImageCount > 10) {
        throw new Error('Maximum 10 images allowed per review');
      }

      try {
        uploadedImageKeys = await uploadMultipleImagesToS3(newImages, S3Folder.REVIEW_IMAGES);
      } catch (error) {
        console.error('Error uploading review images:', error);
        throw new Error('Failed to upload images');
      }
    }

    try {
      // Update review in a transaction
      const updatedReview = await prisma.$transaction(async (tx) => {
        // Update the review
        const review = await tx.tourReview.update({
          where: { id: reviewId },
          data: {
            ...(rating !== undefined && { rating }),
            ...(title !== undefined && { title }),
            ...(comment !== undefined && { comment }),
            updatedAt: new Date(),
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profileImage: true,
              },
            },
            images: true,
          },
        });

        // Remove specified images
        if (removeImageIds && removeImageIds.length > 0) {
          const imagesToDelete = existingReview.images.filter((img) =>
            removeImageIds.includes(img.id)
          );
          const keysToDelete = imagesToDelete.map((img) => img.key);

          await tx.reviewImage.deleteMany({
            where: {
              id: { in: removeImageIds },
              reviewId,
            },
          });

          // Delete from S3
          if (keysToDelete.length > 0) {
            await deleteImagesFromS3(keysToDelete);
          }
        }

        // Add new images
        if (uploadedImageKeys.length > 0) {
          await tx.reviewImage.createMany({
            data: uploadedImageKeys.map((key) => ({
              reviewId,
              key,
              url: prependCloudFrontURL(key),
              thumbnail: prependCloudFrontURL(key),
            })),
          });
        }

        // Update tour rating if rating changed
        if (rating !== undefined && rating !== existingReview.rating) {
          await this.updateTourRating(tx, existingReview.tourId);
        }

        return review;
      });

      // Fetch the complete updated review
      const completeReview = await prisma.tourReview.findUnique({
        where: { id: reviewId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              profileImage: true,
            },
          },
          images: true,
        },
      });

      return completeReview;
    } catch (error) {
      // Cleanup uploaded images if update failed
      if (uploadedImageKeys.length > 0) {
        await deleteImagesFromS3(uploadedImageKeys);
      }
      throw error;
    }
  }

  /**
   * List reviews with filters and pagination
   */
  static async listReviews(filters: ListReviewsInput) {
    const { tourId, userId, page = 1, limit = 10, sortBy = 'createdAt', order = 'desc' } = filters;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      isActive: true,
    };

    if (tourId) {
      where.tourId = tourId;
    }

    if (userId) {
      where.userId = userId;
    }

    // Build orderBy clause
    const orderBy: any = {};
    orderBy[sortBy] = order;

    // Fetch reviews and total count
    const [reviews, total] = await Promise.all([
      prisma.tourReview.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              profileImage: true,
            },
          },
          images: true,
          tour: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
      }),
      prisma.tourReview.count({ where }),
    ]);

    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    };
  }

  /**
   * Helper method to update tour rating and review count
   */
  private static async updateTourRating(tx: any, tourId: string) {
    // Calculate average rating
    const aggregation = await tx.tourReview.aggregate({
      where: {
        tourId,
        isActive: true,
      },
      _avg: {
        rating: true,
      },
      _count: {
        id: true,
      },
    });

    const averageRating = aggregation._avg.rating || 0;
    const reviewCount = aggregation._count.id || 0;

    // Update tour
    await tx.tour.update({
      where: { id: tourId },
      data: {
        rating: averageRating,
        reviewCount,
      },
    });
  }

  /**
   * Delete review images (helper method)
   */
  static async deleteReviewImages(reviewId: string, imageIds: string[]) {
    const images = await prisma.reviewImage.findMany({
      where: {
        id: { in: imageIds },
        reviewId,
      },
    });

    if (images.length === 0) {
      return;
    }

    const keys = images.map((img) => img.key);

    // Delete from database
    await prisma.reviewImage.deleteMany({
      where: {
        id: { in: imageIds },
      },
    });

    // Delete from S3
    await deleteImagesFromS3(keys);
  }

  /**
   * Get a single review by ID
   */
  static async getReviewById(reviewId: string) {
    const review = await prisma.tourReview.findUnique({
      where: { id: reviewId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profileImage: true,
          },
        },
        images: true,
        tour: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    return review;
  }

  /**
   * Delete a review
   */
  static async deleteReview(userId: string, reviewId: string) {
    // Find the review and verify ownership
    const review = await prisma.tourReview.findUnique({
      where: { id: reviewId },
      include: {
        images: true,
      },
    });

    if (!review) {
      throw new Error('Review not found');
    }

    if (review.userId !== userId) {
      throw new Error('You are not authorized to delete this review');
    }

    // Delete in transaction
    await prisma.$transaction(async (tx) => {
      // Delete review images from database
      await tx.reviewImage.deleteMany({
        where: { reviewId },
      });

      // Delete the review
      await tx.tourReview.delete({
        where: { id: reviewId },
      });

      // Update tour rating
      await this.updateTourRating(tx, review.tourId);
    });

    // Delete images from S3
    if (review.images.length > 0) {
      const keys = review.images.map((img) => img.key);
      await deleteImagesFromS3(keys);
    }
  }
}
