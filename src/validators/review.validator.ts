import { z } from 'zod';

/**
 * Schema for creating a new review
 */
export const createReviewSchema = z.object({
  tourId: z.string().min(1, 'Tour ID is required'),
  rating: z
    .number()
    .int('Rating must be an integer')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(255, 'Title must not exceed 255 characters'),
  comment: z
    .string()
    .min(10, 'Comment must be at least 10 characters')
    .max(5000, 'Comment must not exceed 5000 characters'),
});

/**
 * Schema for updating an existing review
 */
export const updateReviewSchema = z.object({
  rating: z
    .number()
    .int('Rating must be an integer')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5')
    .optional(),
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(255, 'Title must not exceed 255 characters')
    .optional(),
  comment: z
    .string()
    .min(10, 'Comment must be at least 10 characters')
    .max(5000, 'Comment must not exceed 5000 characters')
    .optional(),
  removeImageIds: z.array(z.string()).optional(),
});

/**
 * Schema for listing reviews with filters
 */
export const listReviewsSchema = z.object({
  tourId: z.string().optional(),
  userId: z.string().optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => val > 0, 'Page must be greater than 0'),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .refine((val) => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
  sortBy: z.enum(['rating', 'createdAt', 'helpfulCount']).optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export type ListReviewsInput = z.infer<typeof listReviewsSchema>;
