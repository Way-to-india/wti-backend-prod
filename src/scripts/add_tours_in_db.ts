import fs from 'fs';
import path from 'path';
import prisma from '@/config/db';
import * as Papa from 'papaparse';
import mime from 'mime-types';
import { Upload } from '@aws-sdk/lib-storage';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

interface CSVRow {
  URL: string;
  PackageTitle: string;
  PackageDescription: string;
  TotalDays: string;
  TotalNights: string;
  PackagePrice: string;
  isActive: string;
  isFeatured: string;
  package_title: string;
  package_meta_desc: string;
  shortDesc: string;
  Highlights: string;
  PackageInclusion: string;
  PackageExclusion: string;
  DayNumber: string;
  ItineraryHead: string;
  ItineraryDetail: string;
  Slider1: string;
  Slider2: string;
  Slider3: string;
  Slider4: string;
  Slider5: string;
  Slider6: string;
  Slider7: string;
  Slider8: string;
  Slider9: string;
  Slider10: string;
  Slider11: string;
  Slider12: string;
  Slider13: string;
  Slider14: string;
  Slider15: string;
  Slider16: string;
  Slider17: string;
  Slider18: string;
  [key: string]: string;
}

interface MigrationResult {
  tourId: string;
  success: boolean;
  created: boolean;
  alreadyExists: boolean;
  imagesUploaded: number;
  imagesSkipped: number;
  errors: string[];
  warnings: string[];
}

interface BatchSummary {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  totalImagesUploaded: number;
  totalImagesSkipped: number;
  errors: Array<{ tourId: string; errors: string[] }>;
}

function cleanHTML(html: string | null | undefined): string | null {
  if (!html || typeof html !== 'string') return null;
  try {
    let cleaned = html;
    cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
    cleaned = cleaned.replace(/<\/p>/gi, '\n\n');
    cleaned = cleaned.replace(/<\/div>/gi, '\n');
    cleaned = cleaned.replace(/<[^>]+>/g, '');
    cleaned = cleaned
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&rdquo;/g, '"')
      .replace(/&ldquo;/g, '"');
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
    return cleaned || null;
  } catch (error) {
    console.error('Error cleaning HTML:', error);
    return null;
  }
}

function parseListItems(content: string | null | undefined): string[] {
  if (!content || typeof content !== 'string') return [];
  try {
    let cleaned = content;
    cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
    cleaned = cleaned.replace(/<\/li>/gi, '\n');
    cleaned = cleaned.replace(/<\/p>/gi, '\n');
    cleaned = cleaned.replace(/<\/div>/gi, '\n');
    cleaned = cleaned.replace(/<[^>]+>/g, '');
    cleaned = cleaned
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&rsquo;/gi, "'")
      .replace(/&lsquo;/gi, "'");
    const lines = cleaned.split('\n');
    const items: string[] = [];
    for (let line of lines) {
      line = line.trim();
      if (!line || line.length === 0) continue;
      line = line.replace(/^[-•*➤►▪︎⦿○●]\s*/g, '');
      line = line.replace(/^\d+\.\s*/g, '');
      line = line.trim();
      if (line.length < 3) continue;
      if (/^(br|nbsp|amp)$/i.test(line)) continue;
      items.push(line);
    }
    const seen = new Set<string>();
    const uniqueItems: string[] = [];
    for (const item of items) {
      const normalized = item.toLowerCase().trim();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        uniqueItems.push(item);
      }
    }
    return uniqueItems;
  } catch (error) {
    console.error('Error parsing list items:', error);
    return [];
  }
}

function parseHighlights(highlights: string | null | undefined): string[] {
  if (!highlights || typeof highlights !== 'string') return [];
  try {
    const items = highlights
      .split(/\n|Visit\s+/gi)
      .map((item) => item.trim())
      .filter((item) => item && item.length > 2);
    return items.map((item) => {
      if (!item.toLowerCase().startsWith('visit')) {
        return `Visit ${item}`;
      }
      return item;
    });
  } catch (error) {
    console.error('Error parsing highlights:', error);
    return [];
  }
}

function generateSlug(title: string): string {
  if (!title || typeof title !== 'string') {
    return `tour-${Date.now()}`;
  }
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractImageFilename(imagePath: string | null | undefined): string | null {
  if (!imagePath || typeof imagePath !== 'string') return null;
  try {
    const normalized = imagePath.replace(/\\/g, '/');
    const parts = normalized.split('/');
    const filename = parts[parts.length - 1];
    if (!filename || filename.length === 0) return null;
    if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(filename)) return null;
    return filename;
  } catch (error) {
    console.error('Error extracting filename:', error);
    return null;
  }
}

function findImageInFolder(filename: string, imagesFolder: string): string | null {
  try {
    if (!fs.existsSync(imagesFolder)) {
      console.warn(`Images folder not found: ${imagesFolder}`);
      return null;
    }
    const files = fs.readdirSync(imagesFolder);
    const normalizedFilename = filename.toLowerCase();
    if (files.includes(filename)) {
      return path.join(imagesFolder, filename);
    }
    const matchedFile = files.find((file) => file.toLowerCase() === normalizedFilename);
    if (matchedFile) {
      return path.join(imagesFolder, matchedFile);
    }
    return null;
  } catch (error) {
    console.error(`Error finding image ${filename}:`, error);
    return null;
  }
}

async function checkTourFolderExists(tourId: string): Promise<string[]> {
  try {
    const s3Client = new S3Client({
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY as string,
        secretAccessKey: process.env.AWS_SECRET_KEY as string,
      },
      region: process.env.AWS_DEFAULT_REGION as string,
    });

    const command = new ListObjectsV2Command({
      Bucket: process.env.AWS_S3_BUCKET_NAME as string,
      Prefix: `tour-images/${tourId}/`,
      MaxKeys: 100,
    });

    const response = await s3Client.send(command);

    if (!response.Contents || response.Contents.length === 0) {
      return [];
    }

    return response.Contents.filter((obj) => obj.Key && !obj.Key.endsWith('/'))
      .map((obj) => obj.Key!)
      .filter((key) => /\.(jpg|jpeg|png|gif|webp)$/i.test(key));
  } catch (error) {
    console.error('Error checking S3 folder:', error);
    return [];
  }
}

async function uploadImageToS3(
  filePath: string,
  tourId: string,
  filename: string
): Promise<string | null> {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return null;
    }
    const fileBuffer = fs.readFileSync(filePath);
    const contentType = mime.lookup(filename) || 'image/jpeg';
    const s3Client = new S3Client({
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY as string,
        secretAccessKey: process.env.AWS_SECRET_KEY as string,
      },
      region: process.env.AWS_DEFAULT_REGION as string,
    });
    const s3Key = `tour-images/${tourId}/${filename}`;
    const upload = new Upload({
      client: s3Client,
      params: {
        Key: s3Key,
        Bucket: process.env.AWS_S3_BUCKET_NAME as string,
        Body: fileBuffer,
        ContentType: contentType,
      },
    });
    await upload.done();
    return s3Key;
  } catch (error: any) {
    console.error(`    ✗ Failed to upload ${filename}:`, error.message);
    return null;
  }
}

async function parseCSVFile(csvFilePath: string): Promise<CSVRow[]> {
  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(csvFilePath)) {
        reject(new Error(`CSV file not found: ${csvFilePath}`));
        return;
      }
      const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
      Papa.parse<CSVRow>(fileContent, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        transformHeader: (header: string) => header.trim(),
        complete: (results) => {
          if (results.errors.length > 0) {
            console.warn('CSV parsing warnings:', results.errors);
          }
          resolve(results.data);
        },
        error: (error: any) => reject(error),
      });
    } catch (error: any) {
      reject(error);
    }
  });
}

async function migrateTourFromCSV(
  tourId: string,
  allCSVData: CSVRow[],
  imagesFolder: string,
  batchMode: boolean = false
): Promise<MigrationResult> {
  const result: MigrationResult = {
    tourId,
    success: false,
    created: false,
    alreadyExists: false,
    imagesUploaded: 0,
    imagesSkipped: 0,
    errors: [],
    warnings: [],
  };

  if (!batchMode) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔄 PROCESSING: ${tourId}`);
    console.log('='.repeat(80));
  }

  try {
    let existingTour;
    try {
      existingTour = await prisma.tour.findUnique({
        where: { id: tourId },
        select: { id: true, title: true },
      });
    } catch (dbError: any) {
      result.errors.push(`DB query failed: ${dbError.message}`);
      return result;
    }

    if (existingTour) {
      result.alreadyExists = true;
      result.success = true;
      return result;
    }

    const tourRows = allCSVData.filter(
      (row) => row.URL && row.URL.toLowerCase().trim() === tourId.toLowerCase().trim()
    );

    if (tourRows.length === 0) {
      result.errors.push('No CSV data found');
      return result;
    }

    const firstRow = tourRows[0];

    if (!firstRow.PackageTitle || !firstRow.PackageTitle.trim()) {
      result.errors.push('Missing PackageTitle');
      return result;
    }

    if (!firstRow.TotalDays || !firstRow.TotalNights) {
      result.errors.push('Missing duration fields');
      return result;
    }

    const title = firstRow.PackageTitle.trim();
    const slug = generateSlug(title);
    const durationDays = parseInt(firstRow.TotalDays) || 0;
    const durationNights = parseInt(firstRow.TotalNights) || 0;
    const price = firstRow.PackagePrice ? Math.round(parseFloat(firstRow.PackagePrice)) : 0;
    const isActive = firstRow.isActive === '1' || firstRow.isActive?.toLowerCase() === 'true';

    const itineraries = tourRows
      .filter((row) => row.DayNumber && row.ItineraryHead)
      .map((row) => ({
        day: parseInt(row.DayNumber),
        title: row.ItineraryHead.trim(),
        description: cleanHTML(row.ItineraryDetail) || '',
      }))
      .filter((item) => !isNaN(item.day) && item.day > 0)
      .sort((a, b) => a.day - b.day);

    const sliderKeys = Array.from({ length: 18 }, (_, i) => `Slider${i + 1}`);
    const imageFilenames: string[] = [];

    for (const key of sliderKeys) {
      const sliderValue = firstRow[key];
      if (sliderValue && sliderValue.trim()) {
        const filename = extractImageFilename(sliderValue);
        if (filename && !imageFilenames.includes(filename)) {
          imageFilenames.push(filename);
        }
      }
    }

    const uploadedImagePaths: string[] = [];

    if (imageFilenames.length > 0) {
      const existingS3Images = await checkTourFolderExists(tourId);

      if (existingS3Images.length > 0) {
        for (const filename of imageFilenames) {
          const s3Path = `tour-images/${tourId}/${filename}`;
          const exists = existingS3Images.some((s3Key) => s3Key === s3Path);

          if (exists) {
            uploadedImagePaths.push(s3Path);
            result.imagesSkipped++;
          } else {
            const imagePath = findImageInFolder(filename, imagesFolder);
            if (imagePath) {
              const uploaded = await uploadImageToS3(imagePath, tourId, filename);
              if (uploaded) {
                uploadedImagePaths.push(uploaded);
                result.imagesUploaded++;
              }
            } else {
              result.warnings.push(`Image not found: ${filename}`);
            }
          }
        }
      } else {
        for (const filename of imageFilenames) {
          const imagePath = findImageInFolder(filename, imagesFolder);
          if (!imagePath) {
            result.warnings.push(`Image not found: ${filename}`);
            continue;
          }

          const s3Path = await uploadImageToS3(imagePath, tourId, filename);
          if (s3Path) {
            uploadedImagePaths.push(s3Path);
            result.imagesUploaded++;
          } else {
            result.warnings.push(`Upload failed: ${filename}`);
          }
        }
      }
    }

    const tourData: any = {
      id: tourId,
      title,
      slug,
      durationDays,
      durationNights,
      price,
      isActive,
      images: uploadedImagePaths,
    };

    const description = cleanHTML(firstRow.PackageDescription);
    const overview = cleanHTML(firstRow.shortDesc);

    if (description) tourData.description = description;
    if (overview) tourData.overview = overview;
    if (firstRow.package_title?.trim()) tourData.metatitle = firstRow.package_title.trim();
    if (firstRow.package_meta_desc?.trim()) tourData.metadesc = firstRow.package_meta_desc.trim();

    const highlights = parseHighlights(firstRow.Highlights);
    const inclusions = parseListItems(firstRow.PackageInclusion);
    const exclusions = parseListItems(firstRow.PackageExclusion);

    if (highlights.length > 0) tourData.highlights = highlights;
    if (inclusions.length > 0) tourData.inclusions = inclusions;
    if (exclusions.length > 0) tourData.exclusions = exclusions;

    try {
      await prisma.tour.create({ data: tourData });
    } catch (createError: any) {
      result.errors.push(`DB create failed: ${createError.message}`);
      return result;
    }

    if (itineraries.length > 0) {
      for (const itinerary of itineraries) {
        try {
          await prisma.tourItinerary.create({
            data: {
              tourId,
              day: itinerary.day,
              title: itinerary.title,
              description: itinerary.description,
            },
          });
        } catch (err: any) {
          result.warnings.push(`Itinerary Day ${itinerary.day} failed`);
        }
      }
    }

    result.success = true;
    result.created = true;

    return result;
  } catch (error: any) {
    result.errors.push(`Unexpected error: ${error.message}`);
    return result;
  }
}

async function migrateAllTours(
  tourIds: string[],
  allCSVData: CSVRow[],
  imagesFolder: string
): Promise<BatchSummary> {
  const summary: BatchSummary = {
    total: tourIds.length,
    successful: 0,
    failed: 0,
    skipped: 0,
    totalImagesUploaded: 0,
    totalImagesSkipped: 0,
    errors: [],
  };

  console.log(`\n${'='.repeat(80)}`);
  console.log(`🚀 BATCH MIGRATION: ${tourIds.length} TOURS`);
  console.log('='.repeat(80));

  for (let i = 0; i < tourIds.length; i++) {
    const tourId = tourIds[i];
    const progress = `[${i + 1}/${tourIds.length}]`;

    console.log(`\n${progress} Processing: ${tourId}`);

    const result = await migrateTourFromCSV(tourId, allCSVData, imagesFolder, true);

    if (result.alreadyExists) {
      summary.skipped++;
      console.log(`   ⏭️  Already exists - skipped`);
    } else if (result.success && result.created) {
      summary.successful++;
      summary.totalImagesUploaded += result.imagesUploaded;
      summary.totalImagesSkipped += result.imagesSkipped;
      console.log(
        `   ✅ Created | Images: ${result.imagesUploaded} uploaded, ${result.imagesSkipped} skipped`
      );
    } else {
      summary.failed++;
      summary.errors.push({ tourId, errors: result.errors });
      console.log(`   ❌ Failed: ${result.errors.join(', ')}`);
    }

    // Small delay to avoid overwhelming the system
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return summary;
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 BATCH CSV TO DATABASE MIGRATION');
  console.log('='.repeat(80));

  const toursToAdd = [
    'golden-triangle-with-ranthambore',
    'kashmir-holiday-package',
    'beach-honeymoon-tour-@-resort',
    'vaishno-devi-yatra-with-helicopter',
    'trip-to-golden-temple',
    'jaipur-package',
    'this-is-name-of-package',
    'ranthambore-from-delhi',
    'wildlife-safari-near-delhi',
    'best-of-leh-ladakh',
    'trip-to-dehradun',
    'trip-to-shimla',
    'udaipur-and-mount-abu-tour-package',
    'jim-corbett-park-weekend-tour-package-[by-rail]',
    'bird-watching-in-jim-corbett-park',
    'uttarakhand-tour-package',
    'best-of-kashmir',
    'ladakh-with-pangong-lake',
    'udaipur-mount-abu-tour',
    'trip-to-dalhousie-from-delhi',
    'north-east-vacation',
    'best-of-kerala',
    'kerala-nature-trails',
    'beaches-of-kerala',
    'mumbai---goa-tour',
    'mumbai---goa-beach-tour',
    'kumbh-mela-–-haridwar',
    'pushkar-camel-fair',
    'konark-dance-festival',
    'golden-triangle--khajuraho-dance-festival-tour',
    'thrissur-elephant-festival-kerala',
    'dussehra-festival-kullu',
    'varanasi-tour-by-air',
    'udaipur-tour-package',
    'delhi--neemrana-tour',
    'delhi---sultanpur-tour',
    'yogita',
    'uttranchal-5-days-tours',
    'latest-wildlife-tour',
    'honey-moon-in-kerala',
    'desert-festival-jaisalmer',
    'golden-triangle-with-ranthambore--bharatpur-luxury-group-tour',
    'jaisalmer-desert-festival',
    'kashmir-ltc-tour',
    'uttarakhand-holidays',
    'glimpse-of-nepal',
    'leh-ladakh-by-air',
    'treasures-of-south-india',
    'bandhavgarh-national-park',
    'kajiranga-national-park',
    'manas-national-park',
    'kaziranga-national-park-tour',
    'nameri-national-park-tour',
    'bandipur-national-park-tour',
    'eravikulam-national-park',
    'periyar-national-park-tour',
    'pench-national-park-tour',
    'panna-national-park-tour',
    'nagarhole-national-park-tour',
    'ranthambore-wildlife-safari-tour',
    'jim-corbett-national-park',
    'bharatpur-tour',
    'mudumalai-national-park-tour',
    'rajaji-national-park-safari',
    'sariska-national-park-tour',
    'gir-national-park-tour',
    'kanha-national-park-tour',
    'tadoba-national-park-tour-package',
    'sundarbans-tour',
    'testing-national-park',
    'silent-valley-national-park',
    'a-visit-to-karnataka',
    'pancha-bootha-sthalam-tour',
    'srinagar-to-amarnath-helicopter',
    'shimla-test-trip',
    '3days-kashmir-tours-for-indian',
    'ranthambore-tour-package1',
    'gangaur-festival-jaipur',
    'kagbhushudi-lake-trek',
    'valley-of-flowers-trekking-tour',
    'udaipur-city-tour-package',
    'udaipur-tour-package-for-couples',
    'valley-of-flowers-uttarakhand-package',
  ];

  const CSV_FILE_PATH = path.join(__dirname, 'scripts', '../tours.csv');
  const IMAGES_FOLDER = path.join(__dirname, '../../images');

  try {
    if (!fs.existsSync(CSV_FILE_PATH)) throw new Error(`CSV not found: ${CSV_FILE_PATH}`);
    if (!fs.existsSync(IMAGES_FOLDER)) throw new Error(`Images folder not found: ${IMAGES_FOLDER}`);

    const required = [
      'AWS_ACCESS_KEY',
      'AWS_SECRET_KEY',
      'AWS_DEFAULT_REGION',
      'AWS_S3_BUCKET_NAME',
    ];
    for (const env of required) {
      if (!process.env[env]) throw new Error(`Missing: ${env}`);
    }

    console.log(`\n📂 Loading CSV data...`);
    const allCSVData = await parseCSVFile(CSV_FILE_PATH);
    console.log(`✅ Loaded ${allCSVData.length} CSV rows`);

    const summary = await migrateAllTours(toursToAdd, allCSVData, IMAGES_FOLDER);

    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Tours: ${summary.total}`);
    console.log(`✅ Successful: ${summary.successful}`);
    console.log(`⏭️  Skipped: ${summary.skipped}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`📸 Total Images Uploaded: ${summary.totalImagesUploaded}`);
    console.log(`📸 Total Images Skipped: ${summary.totalImagesSkipped}`);

    if (summary.errors.length > 0) {
      console.log('\n❌ FAILED TOURS:');
      summary.errors.forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err.tourId}`);
        err.errors.forEach((e) => console.log(`      - ${e}`));
      });
    }

    console.log('='.repeat(80));
    console.log(`\n✅ Batch migration completed!`);
    console.log(`   ${summary.successful} tours added to database`);
    console.log(`   ${summary.skipped} tours already existed\n`);
  } catch (error: any) {
    console.error('\n❌ FATAL:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal:', error);
      process.exit(1);
    });
}

export { migrateTourFromCSV, parseCSVFile, uploadImageToS3, migrateAllTours };
