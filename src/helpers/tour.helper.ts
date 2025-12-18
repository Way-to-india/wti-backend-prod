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
  if (queryFilters.minPrice) filters.minPrice = parseInt(queryFilters.minPrice as string);
  if (queryFilters.maxPrice) filters.maxPrice = parseInt(queryFilters.maxPrice as string);
  if (queryFilters.currency) filters.currency = queryFilters.currency as string;
  if (queryFilters.hasDiscount) filters.hasDiscount = queryFilters.hasDiscount === 'true';
  if (queryFilters.minDurationDays)
    filters.minDurationDays = parseInt(queryFilters.minDurationDays as string);
  if (queryFilters.maxDurationDays)
    filters.maxDurationDays = parseInt(queryFilters.maxDurationDays as string);
  if (queryFilters.minDurationNights)
    filters.minDurationNights = parseInt(queryFilters.minDurationNights as string);
  if (queryFilters.maxDurationNights)
    filters.maxDurationNights = parseInt(queryFilters.maxDurationNights as string);
  if (queryFilters.minGroupSize)
    filters.minGroupSize = parseInt(queryFilters.minGroupSize as string);
  if (queryFilters.maxGroupSize)
    filters.maxGroupSize = parseInt(queryFilters.maxGroupSize as string);
  if (queryFilters.minRating) filters.minRating = parseFloat(queryFilters.minRating as string);
  if (queryFilters.maxRating) filters.maxRating = parseFloat(queryFilters.maxRating as string);
  if (queryFilters.minReviewCount)
    filters.minReviewCount = parseInt(queryFilters.minReviewCount as string);
  if (queryFilters.minViewCount)
    filters.minViewCount = parseInt(queryFilters.minViewCount as string);
  if (queryFilters.minBookingCount)
    filters.minBookingCount = parseInt(queryFilters.minBookingCount as string);
  if (queryFilters.createdAfter)
    filters.createdAfter = new Date(queryFilters.createdAfter as string);
  if (queryFilters.createdBefore)
    filters.createdBefore = new Date(queryFilters.createdBefore as string);
  if (queryFilters.updatedAfter)
    filters.updatedAfter = new Date(queryFilters.updatedAfter as string);
  if (queryFilters.updatedBefore)
    filters.updatedBefore = new Date(queryFilters.updatedBefore as string);
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
  if (queryFilters.themeId) filters.themeId = queryFilters.themeId as string;
  if (queryFilters.themeSlug) filters.themeSlug = queryFilters.themeSlug as string;
  if (queryFilters.themeName) filters.themeName = queryFilters.themeName as string;
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

export async function handleImageUploads(files: { [fieldname: string]: Express.Multer.File[] }) {
  let uploadedImages: string[] = [];
  let itineraryImagesMap: { [key: string]: string } = {};

  console.log('📦 Files received:', {
    images: files?.images?.length || 0,
    itineraryImages: files?.itineraryImages?.length || 0,
    coverImage: files?.coverImage?.length || 0,
  });

  // Upload regular images
  if (files?.images?.length > 0) {
    console.log(`📤 Uploading ${files.images.length} regular images...`);
    uploadedImages = await uploadMultipleImagesToS3(files.images, S3Folder.TOUR_IMAGES);
    console.log(`✅ Uploaded ${uploadedImages.length} regular images`);
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

  // Upload cover image
  if (files?.coverImage?.length > 0) {
    console.log('📤 Uploading cover image...');
    const coverImageKey = await uploadImageToS3(files.coverImage[0], S3Folder.TOUR_IMAGES);
    uploadedImages.unshift(coverImageKey);
    console.log('✅ Uploaded cover image');
  }

  return { uploadedImages, itineraryImagesMap };
}

export function prepareItineraryData(
  itinerary: any,
  itineraryImagesMap: { [key: string]: string }
) {
  let itineraryArray = itinerary;

  if (typeof itineraryArray === 'string') {
    try {
      itineraryArray = JSON.parse(itineraryArray);
      console.log('📋 Parsed itinerary JSON');
    } catch (e) {
      console.error('❌ Failed to parse itinerary JSON:', e);
      throw new Error('Invalid itinerary format');
    }
  }

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

export function prepareTourData(bodyData: any, uploadedImages: string[], itineraryData: any) {
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

  const toNumber = (value: any): number => {
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  };

  const toBoolean = (value: any): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return Boolean(value);
  };

  return {
    title: bodyData.title,
    slug: bodyData.slug,
    durationDays: toNumber(bodyData.durationDays),
    durationNights: toNumber(bodyData.durationNights),
    price: toNumber(bodyData.price),
    currency: bodyData.currency,
    minGroupSize: toNumber(bodyData.minGroupSize),
    maxGroupSize: toNumber(bodyData.maxGroupSize),
    isActive: toBoolean(bodyData.isActive),
    isFeatured: toBoolean(bodyData.isFeatured),
    metatitle: bodyData.metatitle,
    metadesc: bodyData.metadesc,
    overview: bodyData.overview,
    description: bodyData.description,
    discountPrice: bodyData.discountPrice ? toNumber(bodyData.discountPrice) : undefined,
    bestTime: bodyData.bestTime,
    idealFor: bodyData.idealFor,
    difficulty: bodyData.difficulty,
    cancellationPolicy: bodyData.cancellationPolicy,
    travelTips: bodyData.travelTips,
    startCityId: bodyData.startCityId,
    highlights: parseJsonField(bodyData.highlights),
    inclusions: parseJsonField(bodyData.inclusions),
    exclusions: parseJsonField(bodyData.exclusions),
    themes: parseJsonField(bodyData.themes),
    cities: parseJsonField(bodyData.cities),
    images: uploadedImages,
    itinerary: itineraryData,
  };
}

export async function prepareUpdateData(
  bodyData: any,
  files: { [fieldname: string]: Express.Multer.File[] }
) {
  // Safety check
  if (!bodyData) {
    console.error('❌ bodyData is undefined or null');
    return {};
  }

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

  const toNumber = (value: any): number | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  };

  const toBoolean = (value: any): boolean | undefined => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return Boolean(value);
  };

  // Handle new image uploads
  let newImages: string[] = [];
  if (files?.images?.length > 0) {
    console.log(`📤 Uploading ${files.images.length} new images...`);
    newImages = await uploadMultipleImagesToS3(files.images, S3Folder.TOUR_IMAGES);
    console.log(`✅ Uploaded ${newImages.length} new images`);
  }

  // Build update data object
  const updateData: any = {};

  // Basic fields - check if property exists in bodyData
  if ('title' in bodyData && bodyData.title !== undefined) updateData.title = bodyData.title;
  if ('slug' in bodyData && bodyData.slug !== undefined) updateData.slug = bodyData.slug;
  if ('metatitle' in bodyData && bodyData.metatitle !== undefined)
    updateData.metatitle = bodyData.metatitle;
  if ('metadesc' in bodyData && bodyData.metadesc !== undefined)
    updateData.metadesc = bodyData.metadesc;
  if ('overview' in bodyData && bodyData.overview !== undefined)
    updateData.overview = bodyData.overview;
  if ('description' in bodyData && bodyData.description !== undefined)
    updateData.description = bodyData.description;

  // Numeric fields
  if ('durationDays' in bodyData) {
    const durationDays = toNumber(bodyData.durationDays);
    if (durationDays !== undefined) updateData.durationDays = durationDays;
  }

  if ('durationNights' in bodyData) {
    const durationNights = toNumber(bodyData.durationNights);
    if (durationNights !== undefined) updateData.durationNights = durationNights;
  }

  if ('price' in bodyData) {
    const price = toNumber(bodyData.price);
    if (price !== undefined) updateData.price = price;
  }

  if ('discountPrice' in bodyData) {
    const discountPrice = toNumber(bodyData.discountPrice);
    if (discountPrice !== undefined) updateData.discountPrice = discountPrice;
  }

  if ('minGroupSize' in bodyData) {
    const minGroupSize = toNumber(bodyData.minGroupSize);
    if (minGroupSize !== undefined) updateData.minGroupSize = minGroupSize;
  }

  if ('maxGroupSize' in bodyData) {
    const maxGroupSize = toNumber(bodyData.maxGroupSize);
    if (maxGroupSize !== undefined) updateData.maxGroupSize = maxGroupSize;
  }

  // String fields
  if ('currency' in bodyData && bodyData.currency !== undefined)
    updateData.currency = bodyData.currency;
  if ('bestTime' in bodyData && bodyData.bestTime !== undefined)
    updateData.bestTime = bodyData.bestTime;
  if ('idealFor' in bodyData && bodyData.idealFor !== undefined)
    updateData.idealFor = bodyData.idealFor;
  if ('difficulty' in bodyData && bodyData.difficulty !== undefined)
    updateData.difficulty = bodyData.difficulty;
  if ('cancellationPolicy' in bodyData && bodyData.cancellationPolicy !== undefined)
    updateData.cancellationPolicy = bodyData.cancellationPolicy;
  if ('travelTips' in bodyData && bodyData.travelTips !== undefined)
    updateData.travelTips = bodyData.travelTips;

  // Boolean fields
  if ('isActive' in bodyData) {
    const isActive = toBoolean(bodyData.isActive);
    if (isActive !== undefined) updateData.isActive = isActive;
  }

  if ('isFeatured' in bodyData) {
    const isFeatured = toBoolean(bodyData.isFeatured);
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
  }

  // Relation fields
  if ('startCityId' in bodyData) {
    updateData.startCityId = bodyData.startCityId || null;
  }

  // Array fields
  if ('highlights' in bodyData && bodyData.highlights !== undefined) {
    updateData.highlights = parseJsonField(bodyData.highlights);
  }
  if ('inclusions' in bodyData && bodyData.inclusions !== undefined) {
    updateData.inclusions = parseJsonField(bodyData.inclusions);
  }
  if ('exclusions' in bodyData && bodyData.exclusions !== undefined) {
    updateData.exclusions = parseJsonField(bodyData.exclusions);
  }

  // Handle images - merge existing with new
  if ('images' in bodyData || newImages.length > 0) {
    const existingImages = bodyData.images ? parseJsonField(bodyData.images) : [];
    updateData.images = [...existingImages, ...newImages];
  }

  console.log('📦 Update data prepared:', Object.keys(updateData));
  return updateData;
}