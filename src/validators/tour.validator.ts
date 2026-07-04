import { z } from 'zod';

// Helper to parse JSON strings or return the value as-is
const jsonArraySchema = z.preprocess((val) => {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}, z.array(z.any()).default([]));

const jsonObjectArraySchema = (schema: z.ZodTypeAny) =>
  z.preprocess((val) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    }
    return val;
  }, z.array(schema).optional());

export const createTourSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  slug: z.string().min(1, 'Slug is required').max(300),
  metatitle: z.string().max(255).optional().nullable(),
  metadesc: z.string().max(500).optional().nullable(),
  overview: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  durationDays: z.coerce.number().int().min(0).default(0),
  durationNights: z.coerce.number().int().min(0).default(0),
  price: z.coerce.number().int().min(0).default(0),
  discountPrice: z.coerce.number().int().min(0).optional().nullable(),
  currency: z.string().max(3).default('INR'),
  minGroupSize: z.coerce.number().int().min(1).default(1),
  maxGroupSize: z.coerce.number().int().min(1).default(50),
  bestTime: z.string().max(255).optional().nullable(),
  idealFor: z.string().max(255).optional().nullable(),
  difficulty: z.string().max(50).optional().nullable(),
  isActive: z.preprocess((val) => val === 'true' || val === true, z.boolean().default(true)),
  isFeatured: z.preprocess((val) => val === 'true' || val === true, z.boolean().default(false)),
  showPricing: z.preprocess((val) => val === "true" || val === true, z.boolean().default(true)),
  cancellationPolicy: z.string().optional().nullable(),
  travelTips: z.string().optional().nullable(),
  travelTipsStructured: z.any().optional().nullable(),
  startCityId: z.string().optional().nullable(),
  images: jsonArraySchema,
  highlights: jsonArraySchema,
  inclusions: jsonArraySchema,
  exclusions: jsonArraySchema,
  itinerary: jsonObjectArraySchema(
    z.object({
      day: z.coerce.number().int().min(1).optional(),
      title: z.string().min(1, 'Itinerary title is required').max(255),
      description: z.string().min(1, 'Itinerary description is required'),
      imageUrl: z.string().max(1000).optional().nullable(),
    })
  ),
  themes: jsonArraySchema,
  cities: jsonObjectArraySchema(
    z.object({
      cityId: z.string().min(1, 'City ID is required'),
      order: z.coerce.number().int().min(0).optional(),
    })
  ),
  faqs: jsonObjectArraySchema(
    z.object({
      isActive: z.preprocess((val) => val === 'true' || val === true, z.boolean().default(true)),
      questions: z
        .array(
          z.object({
            question: z.string().min(1, 'Question is required'),
            answer: z.string().min(1, 'Answer is required'),
            order: z.coerce.number().int().min(0).optional(),
          })
        )
        .min(1, 'At least one question is required'),
    })
  ),
  priceGuide: jsonObjectArraySchema(
    z.object({
      title: z.string().min(1, 'Price guide title is required').max(255),
      value: z.coerce.number().int().min(0).default(0),
      order: z.coerce.number().int().min(0).optional(),
    })
  ),
});

export const updateTourSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    slug: z.string().min(1).max(300).optional(),
    metatitle: z.string().max(255).optional().nullable(),
    metadesc: z.string().max(500).optional().nullable(),
    overview: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    durationDays: z.coerce.number().int().min(0).optional(),
    durationNights: z.coerce.number().int().min(0).optional(),
    price: z.coerce.number().int().min(0).optional(),
    discountPrice: z.coerce.number().int().min(0).optional().nullable(),
    currency: z.string().max(3).optional(),
    minGroupSize: z.coerce.number().int().min(1).optional(),
    maxGroupSize: z.coerce.number().int().min(1).optional(),
    bestTime: z.string().max(255).optional().nullable(),
    idealFor: z.string().max(255).optional().nullable(),
    difficulty: z.string().max(50).optional().nullable(),
    rating: z.coerce.number().min(0).max(5).optional(),
    reviewCount: z.coerce.number().int().min(0).optional(),
    viewCount: z.coerce.number().int().min(0).optional(),
    bookingCount: z.coerce.number().int().min(0).optional(),
    isActive: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
    isFeatured: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
    showPricing: z.preprocess((val) => val === "true" || val === true, z.boolean()).optional(),
    cancellationPolicy: z.string().optional().nullable(),
    travelTips: z.string().optional().nullable(),
    travelTipsStructured: z.any().optional().nullable(),
    startCityId: z.string().optional().nullable(),
    images: jsonArraySchema.optional(),
    highlights: jsonArraySchema.optional(),
    inclusions: jsonArraySchema.optional(),
    exclusions: jsonArraySchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const getTourQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('10'),
  search: z.string().optional(),
  id: z.string().optional(),
  slug: z.string().optional(),
  title: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  isFeatured: z.enum(['true', 'false']).optional(),
  minPrice: z.string().regex(/^\d+$/).optional(),
  maxPrice: z.string().regex(/^\d+$/).optional(),
  currency: z.string().optional(),
  hasDiscount: z.enum(['true', 'false']).optional(),
  minDurationDays: z.string().regex(/^\d+$/).optional(),
  maxDurationDays: z.string().regex(/^\d+$/).optional(),
  minDurationNights: z.string().regex(/^\d+$/).optional(),
  maxDurationNights: z.string().regex(/^\d+$/).optional(),
  minGroupSize: z.string().regex(/^\d+$/).optional(),
  maxGroupSize: z.string().regex(/^\d+$/).optional(),
  minRating: z.string().regex(/^\d+\.?\d*$/).optional(),
  maxRating: z.string().regex(/^\d+\.?\d*$/).optional(),
  minReviewCount: z.string().regex(/^\d+$/).optional(),
  minViewCount: z.string().regex(/^\d+$/).optional(),
  minBookingCount: z.string().regex(/^\d+$/).optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  updatedAfter: z.string().datetime().optional(),
  updatedBefore: z.string().datetime().optional(),
  startCityId: z.string().optional(),
  startCitySlug: z.string().optional(),
  startCityName: z.string().optional(),
  cityId: z.string().optional(),
  citySlug: z.string().optional(),
  cityName: z.string().optional(),
  stateId: z.string().optional(),
  stateName: z.string().optional(),
  countryId: z.string().optional(),
  countryName: z.string().optional(),
  themeId: z.string().optional(),
  themeSlug: z.string().optional(),
  themeName: z.string().optional(),
  difficulty: z.string().optional(),
  bestTime: z.string().optional(),
  idealFor: z.string().optional(),
  sortBy: z
    .enum([
      'createdAt',
      'updatedAt',
      'title',
      'price',
      'rating',
      'reviewCount',
      'viewCount',
      'bookingCount',
      'durationDays',
    ])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  includeStartCity: z.enum(['true', 'false']).optional(),
  includeItinerary: z.enum(['true', 'false']).optional(),
  includeThemes: z.enum(['true', 'false']).optional(),
  includeCities: z.enum(['true', 'false']).optional(),
  includeFaqs: z.enum(['true', 'false']).optional(),
  includeReviews: z.enum(['true', 'false']).optional(),
  includePriceGuide: z.enum(['true', 'false']).optional(),
});

export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});
