import { S3Folder } from '@/common/constants';
import { TourService } from '@/services/admin/tour.service';
import { uploadMultipleImagesToS3 } from '@/utils/s3';
import { parseJsonField, prepareItineraryData, toBoolean, toNumber } from './tour.helper';

export async function prepareBasicUpdateData(
  tourId: string,
  bodyData: any,
  files: { [fieldname: string]: Express.Multer.File[] }
) {
  if (!bodyData) {
    console.error('❌ bodyData is undefined');
    return {};
  }

  const updateData: any = {};

  // ========== Handle Images (FIXED: Prevent accidental deletion) ==========
  // Only update images if:
  // 1. New files are being uploaded, OR
  // 2. Images field is explicitly provided AND not empty

  if (files?.images && files.images.length > 0) {
    // Case 1: New images are being uploaded
    let existingImages: string[] = [];

    if (bodyData.images) {
      existingImages = parseJsonField(bodyData.images);
    } else {
      // If images field is missing, fetch from DB to preserve them
      console.log(
        '⚠️ No images field provided with new upload - fetching existing images from DB...'
      );
      existingImages = await TourService.getTourImages(tourId);
    }

    console.log(`📤 Uploading ${files.images.length} new images...`);
    console.log(`📦 Existing images: ${existingImages.length}`);

    const newImages = await uploadMultipleImagesToS3(files.images, S3Folder.TOUR_IMAGES);
    updateData.images = [...existingImages, ...newImages];

    console.log(`✅ Uploaded ${newImages.length} new images`);
    console.log(`📸 Final image count: ${updateData.images.length}`);
  } else if ('images' in bodyData && bodyData.images) {
    // Case 2: Images field is explicitly provided (for reordering/deletion)
    const parsedImages = parseJsonField(bodyData.images);

    if (Array.isArray(parsedImages) && parsedImages.length > 0) {
      updateData.images = parsedImages;
      console.log(`🔄 Updating images array: ${parsedImages.length} images`);
    } else {
      // Empty array sent - this is likely unintentional, so we DON'T update
      console.warn('⚠️ Empty images array received - ignoring to prevent accidental deletion');
    }
  }
  // If neither condition is met, don't touch the images field at all
  // This preserves existing images in the database

  const textFields = [
    'title',
    'slug',
    'metatitle',
    'metadesc',
    'overview',
    'description',
    'currency',
    'bestTime',
    'idealFor',
    'difficulty',
    'cancellationPolicy',
    'travelTips',
  ];

  textFields.forEach((field) => {
    if (field in bodyData) {
      updateData[field] = bodyData[field] || null;
    }
  });

  if ('travelTipsStructured' in bodyData) {
    updateData.travelTipsStructured = parseJsonField(bodyData.travelTipsStructured) ?? null;
  }

  const numericFields = [
    'durationDays',
    'durationNights',
    'price',
    'discountPrice',
    'minGroupSize',
    'maxGroupSize',
  ];

  numericFields.forEach((field) => {
    if (field in bodyData) {
      const value = toNumber(bodyData[field]);
      if (value !== undefined) updateData[field] = value;
    }
  });

  const booleanFields = ['isActive', 'isFeatured'];

  booleanFields.forEach((field) => {
    if (field in bodyData) {
      const value = toBoolean(bodyData[field]);
      if (value !== undefined) updateData[field] = value;
    }
  });

  if ('startCityId' in bodyData) {
    updateData.startCityId = bodyData.startCityId || null;
  }

  const arrayFields = ['highlights', 'inclusions', 'exclusions'];
  arrayFields.forEach((field) => {
    if (field in bodyData) {
      updateData[field] = parseJsonField(bodyData[field]) || [];
    }
  });

  console.log('📦 Update data prepared with', Object.keys(updateData).length, 'fields');
  return updateData;
}

export async function handleRelatedDataUpdates(
  tourId: string,
  bodyData: any,
  files: { [fieldname: string]: Express.Multer.File[] }
) {
  const updates = [
    { key: 'itinerary', handler: updateItinerary, withFiles: true },
    { key: 'themes', handler: updateThemes, withFiles: false },
    { key: 'cities', handler: updateCities, withFiles: false },
    { key: 'faqs', handler: updateFaqs, withFiles: false },
    { key: 'priceGuide', handler: updatePriceGuide, withFiles: false },
  ];

  for (const update of updates) {
    if (update.key in bodyData) {
      await update.handler(tourId, bodyData[update.key], update.withFiles ? files : undefined);
    }
  }
}

async function updateItinerary(
  tourId: string,
  itinerary: any,
  files?: { [fieldname: string]: Express.Multer.File[] }
) {
  console.log('📋 Updating itinerary...');

  const itineraryArray = parseJsonField(itinerary);
  if (!Array.isArray(itineraryArray) || itineraryArray.length === 0) return;

  let itineraryImagesMap: { [key: string]: string } = {};

  if (files?.itineraryImages && files.itineraryImages.length > 0) {
    console.log(`⬆️ Uploading ${files.itineraryImages.length} itinerary images...`);
    const imageKeys = await uploadMultipleImagesToS3(files.itineraryImages, S3Folder.TOUR_IMAGES);

    files.itineraryImages.forEach((file, index) => {
      itineraryImagesMap[index.toString()] = imageKeys[index];
    });
  }

  const itineraryData = prepareItineraryData(itineraryArray, itineraryImagesMap);
  await TourService.updateTourItinerary(tourId, itineraryData);

  console.log('✅ Itinerary updated');
}

async function updateThemes(tourId: string, themes: any) {
  console.log('🏷️ Updating themes...');

  const themesArray = parseJsonField(themes);
  if (!Array.isArray(themesArray) || themesArray.length === 0) return;

  await TourService.updateTourThemes(tourId, themesArray);
  console.log('✅ Themes updated');
}

async function updateCities(tourId: string, cities: any) {
  console.log('🏙️ Updating cities...');

  const citiesArray = parseJsonField(cities);
  if (!Array.isArray(citiesArray) || citiesArray.length === 0) return;

  const citiesData = citiesArray.map((cityId: string, index: number) => ({
    cityId,
    order: index,
  }));

  await TourService.updateTourCities(tourId, citiesData);
  console.log('✅ Cities updated');
}

async function updateFaqs(tourId: string, faqs: any) {
  console.log('❓ Updating FAQs...');

  const faqsArray = parseJsonField(faqs);
  if (!Array.isArray(faqsArray) || faqsArray.length === 0) return;

  await TourService.updateTourFaqs(tourId, faqsArray);
  console.log('✅ FAQs updated');
}

async function updatePriceGuide(tourId: string, priceGuide: any) {
  console.log('💰 Updating price guide...');

  const priceGuideArray = parseJsonField(priceGuide);
  if (!Array.isArray(priceGuideArray) || priceGuideArray.length === 0) return;

  await TourService.updateTourPriceGuide(tourId, priceGuideArray);
  console.log('✅ Price guide updated');
}
