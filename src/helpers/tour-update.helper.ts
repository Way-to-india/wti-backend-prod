import { uploadMultipleImagesToS3 } from '@/utils/s3';
import { S3Folder } from '@/common/constants';
import { TourService } from '@/services/admin/tour.service';
import { parseJsonField, toNumber, toBoolean, prepareItineraryData } from './tour.helper';

export async function prepareBasicUpdateData(
  bodyData: any,
  files: { [fieldname: string]: Express.Multer.File[] }
) {
  if (!bodyData) {
    console.error('❌ bodyData is undefined');
    return {};
  }

  const updateData: any = {};

  const existingImages = bodyData.images ? parseJsonField(bodyData.images) : [];

  console.log(` Existing images from frontend: ${existingImages.length}`);
  console.log(`New files being uploaded: ${files?.images?.length || 0}`);

  if (files?.images && files.images.length > 0) {
    console.log(`Uploading ${files.images.length} new images...`);
    const newImages = await uploadMultipleImagesToS3(files.images, S3Folder.TOUR_IMAGES);
    console.log(`Uploaded ${newImages.length} new images`);

    updateData.images = [...existingImages, ...newImages];
  } else {
    updateData.images = existingImages;
  }

  console.log(`Final image count: ${updateData.images.length}`);

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
