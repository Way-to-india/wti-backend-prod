import { uploadImageToS3, uploadMultipleImagesToS3 } from '@/utils/s3';
import type { TourFilters, TourIncludes } from './tour-query.helper';
import { S3Folder } from '@/common/constants';

export function parseFilters(queryFilters: any): TourFilters {
  const filters: TourFilters = {};

  if (queryFilters.search) filters.search = queryFilters.search as string;
  if (queryFilters.id) filters.id = queryFilters.id as string;
  if (queryFilters.slug) filters.slug = queryFilters.slug as string;
  if (queryFilters.title) filters.title = queryFilters.title as string;

  if (queryFilters.isActive !== undefined) filters.isActive = queryFilters.isActive === 'true';
  if (queryFilters.isFeatured !== undefined)
    filters.isFeatured = queryFilters.isFeatured === 'true';
  if (queryFilters.hasDiscount) filters.hasDiscount = queryFilters.hasDiscount === 'true';

  // Price filters
  if (queryFilters.minPrice) filters.minPrice = parseInt(queryFilters.minPrice as string);
  if (queryFilters.maxPrice) filters.maxPrice = parseInt(queryFilters.maxPrice as string);
  if (queryFilters.currency) filters.currency = queryFilters.currency as string;

  // Duration filters
  if (queryFilters.minDurationDays)
    filters.minDurationDays = parseInt(queryFilters.minDurationDays as string);
  if (queryFilters.maxDurationDays)
    filters.maxDurationDays = parseInt(queryFilters.maxDurationDays as string);
  if (queryFilters.minDurationNights)
    filters.minDurationNights = parseInt(queryFilters.minDurationNights as string);
  if (queryFilters.maxDurationNights)
    filters.maxDurationNights = parseInt(queryFilters.maxDurationNights as string);

  // Group size filters
  if (queryFilters.minGroupSize)
    filters.minGroupSize = parseInt(queryFilters.minGroupSize as string);
  if (queryFilters.maxGroupSize)
    filters.maxGroupSize = parseInt(queryFilters.maxGroupSize as string);

  // Rating and engagement filters
  if (queryFilters.minRating) filters.minRating = parseFloat(queryFilters.minRating as string);
  if (queryFilters.maxRating) filters.maxRating = parseFloat(queryFilters.maxRating as string);
  if (queryFilters.minReviewCount)
    filters.minReviewCount = parseInt(queryFilters.minReviewCount as string);
  if (queryFilters.minViewCount)
    filters.minViewCount = parseInt(queryFilters.minViewCount as string);
  if (queryFilters.minBookingCount)
    filters.minBookingCount = parseInt(queryFilters.minBookingCount as string);

  // Date filters
  if (queryFilters.createdAfter)
    filters.createdAfter = new Date(queryFilters.createdAfter as string);
  if (queryFilters.createdBefore)
    filters.createdBefore = new Date(queryFilters.createdBefore as string);
  if (queryFilters.updatedAfter)
    filters.updatedAfter = new Date(queryFilters.updatedAfter as string);
  if (queryFilters.updatedBefore)
    filters.updatedBefore = new Date(queryFilters.updatedBefore as string);

  // Location filters
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

  // Theme filters
  if (queryFilters.themeId) filters.themeId = queryFilters.themeId as string;
  if (queryFilters.themeSlug) filters.themeSlug = queryFilters.themeSlug as string;
  if (queryFilters.themeName) filters.themeName = queryFilters.themeName as string;

  // Other filters
  if (queryFilters.difficulty) filters.difficulty = queryFilters.difficulty as string;
  if (queryFilters.bestTime) filters.bestTime = queryFilters.bestTime as string;
  if (queryFilters.idealFor) filters.idealFor = queryFilters.idealFor as string;

  return filters;
}

export function parseIncludes(queryFilters: any): TourIncludes {
  return {
    includeStartCity: queryFilters.includeStartCity === 'true',
    includeItinerary: queryFilters.includeItinerary === 'true',
    includeThemes: queryFilters.includeThemes === 'true',
    includeCities: queryFilters.includeCities === 'true',
    includeFaqs: queryFilters.includeFaqs === 'true',
    includeReviews: queryFilters.includeReviews === 'true',
    includePriceGuide: queryFilters.includePriceGuide === 'true',
  };
}

/**
 * Parse JSON field safely - handles both string and object inputs
 */
export function parseJsonField(field: any): any {
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch (e) {
      return field;
    }
  }
  return field;
}

/**
 * Convert value to number safely - returns undefined if invalid
 */
export function toNumber(value: any): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  return isNaN(num) ? undefined : num;
}

/**
 * Convert value to boolean safely - handles string and boolean inputs
 */
export function toBoolean(value: any): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return Boolean(value);
}

// ============================================================================
// IMAGE UPLOAD FUNCTIONS
// ============================================================================

/**
 * Handle all image uploads for tour creation
 * Returns uploaded image URLs and itinerary image mappings
 */
export async function handleImageUploads(files: { [fieldname: string]: Express.Multer.File[] }) {
  let uploadedCoverImage: string | null = null;
  let uploadedGalleryImages: string[] = [];
  let itineraryImagesMap: { [key: string]: string } = {};

  console.log('📦 Files received:', {
    images: files?.images?.length || 0,
    itineraryImages: files?.itineraryImages?.length || 0,
    coverImage: files?.coverImage?.length || 0,
  });

  // Upload cover image
  if (files?.coverImage?.length > 0) {
    console.log('📤 Uploading cover image...');
    uploadedCoverImage = await uploadImageToS3(files.coverImage[0], S3Folder.TOUR_IMAGES);
    console.log('✅ Uploaded cover image');
  }

  // Upload regular gallery images
  if (files?.images?.length > 0) {
    console.log(`📤 Uploading ${files.images.length} gallery images...`);
    uploadedGalleryImages = await uploadMultipleImagesToS3(files.images, S3Folder.TOUR_IMAGES);
    console.log(`✅ Uploaded ${uploadedGalleryImages.length} gallery images`);
  }

  // Upload itinerary images
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

  return { uploadedCoverImage, uploadedGalleryImages, itineraryImagesMap };
}

// ============================================================================
// ITINERARY DATA PREPARATION
// ============================================================================

/**
 * Prepare itinerary data for database insertion
 * Handles JSON parsing and image URL mapping
 */
export function prepareItineraryData(
  itinerary: any,
  itineraryImagesMap: { [key: string]: string } = {}
) {
  let itineraryArray = itinerary;

  // Parse JSON if needed
  if (typeof itineraryArray === 'string') {
    try {
      itineraryArray = JSON.parse(itineraryArray);
      console.log('📋 Parsed itinerary JSON');
    } catch (e) {
      console.error('❌ Failed to parse itinerary JSON:', e);
      throw new Error('Invalid itinerary format');
    }
  }

  // Map and format itinerary data
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
  return itineraryData;
}

// ============================================================================
// TOUR DATA PREPARATION FOR CREATION
// ============================================================================

/**
 * Prepare complete tour data for creation
 * Combines form data with uploaded images and itinerary
 */
export function prepareTourData(
  bodyData: any,
  uploadedCoverImage: string | null,
  uploadedGalleryImages: string[],
  itineraryData: any
) {
  // Handle Images Logic
  const existingGalleryImages = bodyData.images ? parseJsonField(bodyData.images) : [];
  // Ensure existingGalleryImages is an array
  const galleryImages = Array.isArray(existingGalleryImages)
    ? existingGalleryImages
    : [existingGalleryImages];

  const finalGalleryImages = [...galleryImages, ...uploadedGalleryImages];

  const coverImage = uploadedCoverImage || bodyData.coverImage || null;

  const finalImages = [];
  if (coverImage) {
    finalImages.push(coverImage);
  }
  finalImages.push(...finalGalleryImages);

  return {
    // Basic information
    title: bodyData.title,
    slug: bodyData.slug,
    metatitle: bodyData.metatitle || null,
    metadesc: bodyData.metadesc || null,
    overview: bodyData.overview || null,
    description: bodyData.description || null,

    // Duration
    durationDays: toNumber(bodyData.durationDays) || 0,
    durationNights: toNumber(bodyData.durationNights) || 0,

    // Pricing
    price: toNumber(bodyData.price) || 0,
    discountPrice: bodyData.discountPrice ? toNumber(bodyData.discountPrice) : undefined,
    currency: bodyData.currency || 'INR',

    // Group size
    minGroupSize: toNumber(bodyData.minGroupSize) || 1,
    maxGroupSize: toNumber(bodyData.maxGroupSize) || 50,

    // Status
    isActive: toBoolean(bodyData.isActive) || false,
    isFeatured: toBoolean(bodyData.isFeatured) || false,

    // Additional details
    bestTime: bodyData.bestTime || null,
    idealFor: bodyData.idealFor || null,
    difficulty: bodyData.difficulty || null,
    cancellationPolicy: bodyData.cancellationPolicy || null,
    travelTips: bodyData.travelTips || null,
    travelTipsStructured: parseJsonField(bodyData.travelTipsStructured) ?? null,

    // Relations
    startCityId: bodyData.startCityId || null,

    // Arrays
    highlights: parseJsonField(bodyData.highlights) || [],
    inclusions: parseJsonField(bodyData.inclusions) || [],
    exclusions: parseJsonField(bodyData.exclusions) || [],
    themes: parseJsonField(bodyData.themes) || [],
    cities: parseJsonField(bodyData.cities) || [],
    images: finalImages,
    itinerary: itineraryData,
  };
}

// ============================================================================
// TOUR DATA PREPARATION FOR UPDATE
// ============================================================================

/**
 * Prepare tour data for update operation
 * Only includes fields that are explicitly provided
 * Handles image uploads and merging with existing images
 */
export async function prepareUpdateData(
  bodyData: any,
  files: { [fieldname: string]: Express.Multer.File[] }
) {
  // Safety check
  if (!bodyData) {
    console.error('❌ bodyData is undefined or null');
    return {};
  }

  const updateData: any = {};

  // ========== Upload New Images ==========
  let newImages: string[] = [];
  if (files?.images?.length > 0) {
    console.log(`📤 Uploading ${files.images.length} new images...`);
    newImages = await uploadMultipleImagesToS3(files.images, S3Folder.TOUR_IMAGES);
    console.log(`✅ Uploaded ${newImages.length} new images`);
  }

  // ========== Basic Text Fields ==========
  if ('title' in bodyData && bodyData.title !== undefined) {
    updateData.title = bodyData.title;
  }
  if ('slug' in bodyData && bodyData.slug !== undefined) {
    updateData.slug = bodyData.slug;
  }
  if ('metatitle' in bodyData) {
    updateData.metatitle = bodyData.metatitle || null;
  }
  if ('metadesc' in bodyData) {
    updateData.metadesc = bodyData.metadesc || null;
  }
  if ('overview' in bodyData) {
    updateData.overview = bodyData.overview || null;
  }
  if ('description' in bodyData) {
    updateData.description = bodyData.description || null;
  }

  // ========== Numeric Fields ==========
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

  // ========== String Fields ==========
  if ('currency' in bodyData) {
    updateData.currency = bodyData.currency;
  }
  if ('bestTime' in bodyData) {
    updateData.bestTime = bodyData.bestTime || null;
  }
  if ('idealFor' in bodyData) {
    updateData.idealFor = bodyData.idealFor || null;
  }
  if ('difficulty' in bodyData) {
    updateData.difficulty = bodyData.difficulty || null;
  }
  if ('cancellationPolicy' in bodyData) {
    updateData.cancellationPolicy = bodyData.cancellationPolicy || null;
  }
  if ('travelTips' in bodyData) {
    updateData.travelTips = bodyData.travelTips || null;
  }
  if ('travelTipsStructured' in bodyData) {
    updateData.travelTipsStructured = parseJsonField(bodyData.travelTipsStructured) ?? null;
  }

  // ========== Boolean Fields ==========
  if ('isActive' in bodyData) {
    const value = toBoolean(bodyData.isActive);
    if (value !== undefined) updateData.isActive = value;
  }
  if ('isFeatured' in bodyData) {
    const value = toBoolean(bodyData.isFeatured);
    if (value !== undefined) updateData.isFeatured = value;
  }

  // ========== Relation Fields ==========
  if ('startCityId' in bodyData) {
    updateData.startCityId = bodyData.startCityId || null;
  }

  // ========== Array Fields ==========
  if ('highlights' in bodyData) {
    updateData.highlights = parseJsonField(bodyData.highlights) || [];
  }
  if ('inclusions' in bodyData) {
    updateData.inclusions = parseJsonField(bodyData.inclusions) || [];
  }
  if ('exclusions' in bodyData) {
    updateData.exclusions = parseJsonField(bodyData.exclusions) || [];
  }

  // ========== Images (Merge Existing + New) ==========
  if ('images' in bodyData || newImages.length > 0) {
    const existingImages = bodyData.images ? parseJsonField(bodyData.images) : [];
    updateData.images = [...existingImages, ...newImages];
  }

  console.log('📦 Update data prepared:', Object.keys(updateData));
  return updateData;
}
