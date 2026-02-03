import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { Readable } from 'stream';
import prisma from '../src/config/db';

/**
 * Script to convert tour images from JPG/PNG to WebP format
 * Images are organized in S3 by tour slug: tours/{tour-slug}/image.jpg
 * This script will:
 * 1. List all tour folders in S3
 * 2. For each folder, convert images to WebP
 * 3. Upload WebP versions
 * 4. Delete old JPG/PNG images
 * 5. Update database references
 */

interface ConversionStats {
  totalFolders: number;
  totalImages: number;
  convertedImages: number;
  failedImages: number;
  totalOriginalSize: number;
  totalWebpSize: number;
  errors: Array<{ folder: string; image: string; error: string }>;
}

const AWS_CONFIG = {
  accessKeyId: process.env.AWS_ACCESS_KEY?.trim() || '',
  secretAccessKey: process.env.AWS_SECRET_KEY?.trim() || '',
  region: process.env.AWS_DEFAULT_REGION?.trim() || 'ap-south-1',
  bucket: process.env.AWS_S3_BUCKET_NAME?.trim() || '',
};

const WEBP_QUALITY = 85; // Quality setting for WebP conversion
const DRY_RUN = process.argv.includes('--dry-run'); // Preview mode
const TOURS_PREFIX = 'tours/'; // S3 prefix for tour images

// Get tour slug from command line argument
function getTourSlugFromArgs(): string | null {
  const tourSlugArg = process.argv.find((arg) => arg.startsWith('--tour-slug='));
  if (tourSlugArg) {
    return tourSlugArg.split('=')[1];
  }
  return null;
}

// Helper function to convert stream to buffer
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

// Initialize S3 client
function getS3Client(): S3Client {
  return new S3Client({
    region: AWS_CONFIG.region,
    credentials: {
      accessKeyId: AWS_CONFIG.accessKeyId,
      secretAccessKey: AWS_CONFIG.secretAccessKey,
    },
  });
}

// Check if file is an image that needs conversion
function needsConversion(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return lowerKey.endsWith('.jpg') || lowerKey.endsWith('.jpeg') || lowerKey.endsWith('.png');
}

// Get WebP version of the key
function getWebpKey(key: string): string {
  const lastDotIndex = key.lastIndexOf('.');
  if (lastDotIndex === -1) return key + '.webp';
  return key.substring(0, lastDotIndex) + '.webp';
}

// List all tour folders in S3
async function listTourFolders(s3Client: S3Client): Promise<string[]> {
  console.log('📂 Listing tour folders in S3...\n');
  const folders = new Set<string>();

  let continuationToken: string | undefined;
  do {
    const command = new ListObjectsV2Command({
      Bucket: AWS_CONFIG.bucket,
      Prefix: TOURS_PREFIX,
      ContinuationToken: continuationToken,
      Delimiter: '/',
    });

    const response = await s3Client.send(command);

    // Get folder prefixes
    if (response.CommonPrefixes) {
      response.CommonPrefixes.forEach((prefix) => {
        if (prefix.Prefix) {
          folders.add(prefix.Prefix);
        }
      });
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return Array.from(folders);
}

// List all images in a specific folder
async function listImagesInFolder(s3Client: S3Client, folderPrefix: string): Promise<string[]> {
  const images: string[] = [];
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: AWS_CONFIG.bucket,
      Prefix: folderPrefix,
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(command);

    if (response.Contents) {
      response.Contents.forEach((obj) => {
        if (obj.Key && needsConversion(obj.Key)) {
          images.push(obj.Key);
        }
      });
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return images;
}

// Convert a single image to WebP
async function convertImageToWebp(
  s3Client: S3Client,
  imageKey: string,
  stats: ConversionStats
): Promise<{ success: boolean; webpKey?: string; originalSize?: number; webpSize?: number }> {
  try {
    console.log(`   📥 Downloading: ${imageKey}`);

    // Download original image
    const getCommand = new GetObjectCommand({
      Bucket: AWS_CONFIG.bucket,
      Key: imageKey,
    });

    const response = await s3Client.send(getCommand);
    if (!response.Body) {
      throw new Error('No body in S3 response');
    }

    const imageBuffer = await streamToBuffer(response.Body as Readable);
    const originalSize = imageBuffer.length;

    console.log(`   🔄 Converting to WebP...`);

    // Convert to WebP
    const webpBuffer = await sharp(imageBuffer)
      .webp({ quality: WEBP_QUALITY, lossless: false })
      .toBuffer();

    const webpSize = webpBuffer.length;
    const webpKey = getWebpKey(imageKey);

    console.log(
      `   📊 Size: ${(originalSize / 1024).toFixed(2)}KB → ${(webpSize / 1024).toFixed(2)}KB (${(((originalSize - webpSize) / originalSize) * 100).toFixed(1)}% reduction)`
    );

    if (!DRY_RUN) {
      // Upload WebP version
      console.log(`   📤 Uploading: ${webpKey}`);
      const putCommand = new PutObjectCommand({
        Bucket: AWS_CONFIG.bucket,
        Key: webpKey,
        Body: webpBuffer,
        ContentType: 'image/webp',
      });
      await s3Client.send(putCommand);

      // Delete original image
      console.log(`   🗑️  Deleting: ${imageKey}`);
      const deleteCommand = new DeleteObjectCommand({
        Bucket: AWS_CONFIG.bucket,
        Key: imageKey,
      });
      await s3Client.send(deleteCommand);
    } else {
      console.log(`   [DRY RUN] Would upload: ${webpKey}`);
      console.log(`   [DRY RUN] Would delete: ${imageKey}`);
    }

    console.log(`   ✅ Completed\n`);

    return { success: true, webpKey, originalSize, webpSize };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`   ❌ Error: ${errorMessage}\n`);
    stats.errors.push({
      folder: imageKey.split('/').slice(0, -1).join('/'),
      image: imageKey,
      error: errorMessage,
    });
    return { success: false };
  }
}

// Process a single tour folder
async function processTourFolder(
  s3Client: S3Client,
  folderPrefix: string,
  stats: ConversionStats
): Promise<void> {
  const folderName = folderPrefix.replace(TOURS_PREFIX, '').replace('/', '');
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📁 Processing folder: ${folderName}`);
  console.log(`${'='.repeat(80)}\n`);

  // List all images in this folder
  const images = await listImagesInFolder(s3Client, folderPrefix);

  if (images.length === 0) {
    console.log(`   ℹ️  No images to convert in this folder\n`);
    return;
  }

  console.log(`   Found ${images.length} image(s) to convert\n`);

  // Convert each image
  for (let i = 0; i < images.length; i++) {
    const imageKey = images[i];
    const imageName = imageKey.split('/').pop() || imageKey;

    console.log(`   [${i + 1}/${images.length}] ${imageName}`);

    const result = await convertImageToWebp(s3Client, imageKey, stats);

    if (result.success) {
      stats.convertedImages++;
      if (result.originalSize) stats.totalOriginalSize += result.originalSize;
      if (result.webpSize) stats.totalWebpSize += result.webpSize;
    } else {
      stats.failedImages++;
    }

    stats.totalImages++;
  }

  console.log(
    `   ✨ Folder completed: ${stats.convertedImages} converted, ${stats.failedImages} failed\n`
  );
}

// Update database references from old extensions to .webp
async function updateDatabaseReferences(tourSlug?: string | null): Promise<void> {
  if (DRY_RUN) {
    console.log('\n[DRY RUN] Skipping database updates\n');
    return;
  }

  console.log('\n📝 Updating database references...\n');

  try {
    // Get tours to update
    const tours = tourSlug
      ? await prisma.tour.findMany({
          where: { slug: tourSlug },
          select: {
            id: true,
            slug: true,
            images: true,
          },
        })
      : await prisma.tour.findMany({
          select: {
            id: true,
            slug: true,
            images: true,
          },
        });

    if (tourSlug && tours.length === 0) {
      console.log(`   ⚠️  Tour not found in database: ${tourSlug}\n`);
      return;
    }

    let updatedTours = 0;

    for (const tour of tours) {
      if (!tour.images || tour.images.length === 0) continue;

      // Convert image paths to WebP
      const updatedImages = tour.images.map((img) => {
        if (needsConversion(img)) {
          return getWebpKey(img);
        }
        return img;
      });

      // Check if any changes were made
      const hasChanges = updatedImages.some((img, idx) => img !== tour.images[idx]);

      if (hasChanges) {
        await prisma.tour.update({
          where: { id: tour.id },
          data: { images: updatedImages },
        });
        updatedTours++;
        console.log(`   ✅ Updated tour: ${tour.slug} (${updatedImages.length} images)`);
      }
    }

    console.log(`\n   📊 Updated ${updatedTours} tour(s) in database\n`);
  } catch (error) {
    console.error('❌ Error updating database:', error);
    throw error;
  }
}

// Main function
async function main(): Promise<void> {
  console.log('🚀 Starting tour image conversion to WebP format\n');

  const tourSlug = getTourSlugFromArgs();

  if (tourSlug) {
    console.log(`   🎯 Processing single tour: ${tourSlug}`);
  }

  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (preview only)' : 'LIVE (will make changes)'}`);
  console.log(`   WebP Quality: ${WEBP_QUALITY}`);
  console.log(`   S3 Bucket: ${AWS_CONFIG.bucket}`);
  console.log(`   Region: ${AWS_CONFIG.region}\n`);

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE: No changes will be made to S3 or database\n');
  }

  const stats: ConversionStats = {
    totalFolders: 0,
    totalImages: 0,
    convertedImages: 0,
    failedImages: 0,
    totalOriginalSize: 0,
    totalWebpSize: 0,
    errors: [],
  };

  try {
    const s3Client = getS3Client();

    let tourFolders: string[];

    if (tourSlug) {
      // Process only the specified tour
      const tourFolder = `${TOURS_PREFIX}${tourSlug}/`;
      console.log(`📂 Processing single tour folder: ${tourFolder}\n`);
      tourFolders = [tourFolder];
      stats.totalFolders = 1;
    } else {
      // List all tour folders
      tourFolders = await listTourFolders(s3Client);
      stats.totalFolders = tourFolders.length;

      console.log(`📊 Found ${tourFolders.length} tour folder(s)\n`);

      if (tourFolders.length === 0) {
        console.log('ℹ️  No tour folders found. Exiting.\n');
        return;
      }
    }

    // Process each folder
    for (let i = 0; i < tourFolders.length; i++) {
      const folder = tourFolders[i];
      if (!tourSlug) {
        console.log(
          `\n[${i + 1}/${tourFolders.length}] Processing folder ${i + 1} of ${tourFolders.length}`
        );
      }
      await processTourFolder(s3Client, folder, stats);
    }

    // Update database
    await updateDatabaseReferences(tourSlug);

    // Print final statistics
    console.log('\n' + '='.repeat(80));
    console.log('📊 CONVERSION SUMMARY');
    console.log('='.repeat(80) + '\n');
    console.log(`   Total folders processed: ${stats.totalFolders}`);
    console.log(`   Total images found: ${stats.totalImages}`);
    console.log(`   Successfully converted: ${stats.convertedImages}`);
    console.log(`   Failed conversions: ${stats.failedImages}`);

    if (stats.totalOriginalSize > 0 && stats.totalWebpSize > 0) {
      const savedBytes = stats.totalOriginalSize - stats.totalWebpSize;
      const savedPercentage = ((savedBytes / stats.totalOriginalSize) * 100).toFixed(1);
      console.log(
        `\n   Original total size: ${(stats.totalOriginalSize / 1024 / 1024).toFixed(2)} MB`
      );
      console.log(`   WebP total size: ${(stats.totalWebpSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(
        `   Space saved: ${(savedBytes / 1024 / 1024).toFixed(2)} MB (${savedPercentage}%)`
      );
    }

    if (stats.errors.length > 0) {
      console.log(`\n   ⚠️  Errors encountered: ${stats.errors.length}`);
      console.log('\n   Error details:');
      stats.errors.forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err.image}`);
        console.log(`      Error: ${err.error}`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log(DRY_RUN ? '✨ Dry run completed!' : '✨ Conversion completed successfully!');
    console.log('='.repeat(80) + '\n');
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
