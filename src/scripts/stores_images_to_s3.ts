import fs from 'fs';
import path from 'path';
import prisma from '@/config/db';
import mime from 'mime-types';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

interface UploadResult {
  tourId: string;
  tourSlug: string;
  uploadedImages: string[];
  errors: string[];
  success: boolean;
}

function createS3Client(): S3Client {
  return new S3Client({
    region: process.env.AWS_DEFAULT_REGION?.trim() || 'ap-south-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY?.trim() || '',
      secretAccessKey: process.env.AWS_SECRET_KEY?.trim() || '',
    },
  });
}

async function uploadFileToS3(
  s3Client: S3Client,
  fileBuffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const bucketName = process.env.AWS_S3_BUCKET_NAME?.trim();

  if (!bucketName) {
    throw new Error('AWS_S3_BUCKET_NAME is not defined in environment variables');
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await s3Client.send(command);
  return key;
}

async function reUploadTourImages(
  tourId: string,
  tourSlug: string,
  existingImagePaths: string[],
  localFolderPath: string
): Promise<UploadResult> {
  const result: UploadResult = {
    tourId,
    tourSlug,
    uploadedImages: [],
    errors: [],
    success: false,
  };

  let s3Client: S3Client | null = null;

  try {
    console.log(`📦 Processing tour: ${tourSlug}`);

    if (!fs.existsSync(localFolderPath)) {
      result.errors.push(`Local folder not found: ${localFolderPath}`);
      return result;
    }

    const files = fs.readdirSync(localFolderPath);
    const imageFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
    });

    if (imageFiles.length === 0) {
      result.errors.push('No image files found in folder');
      return result;
    }

    console.log(`📸 Found ${imageFiles.length} images to upload`);

    if (!process.env.AWS_ACCESS_KEY?.trim() || !process.env.AWS_SECRET_KEY?.trim()) {
      result.errors.push('AWS credentials not found in environment variables');
      return result;
    }

    s3Client = createS3Client();
    const newImagePaths: string[] = [];

    for (const fileName of imageFiles) {
      try {
        const filePath = path.join(localFolderPath, fileName);
        const fileBuffer = fs.readFileSync(filePath);
        const contentType = mime.lookup(fileName) || 'image/jpeg';

        // Use the same S3 key structure as before
        const s3Key = `tour-images/${tourId}/${fileName}`;

        console.log(`  ⬆️  Uploading: ${fileName}...`);
        await uploadFileToS3(s3Client, fileBuffer, s3Key, contentType);

        newImagePaths.push(s3Key);
        result.uploadedImages.push(s3Key);
        console.log(`  ✅ Uploaded: ${s3Key}`);
      } catch (uploadError: any) {
        const errorMsg = `Failed to upload ${fileName}: ${uploadError.message}`;
        console.error(`  ❌ ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

    if (newImagePaths.length > 0) {
      try {
        // Update database with new S3 paths (same paths, new AWS account)
        await prisma.tour.update({
          where: { id: tourId },
          data: {
            images: newImagePaths,
            updatedAt: new Date(),
          },
        });

        console.log(`✅ Database updated with ${newImagePaths.length} image paths`);
        console.log(`   (Re-uploaded to new AWS account)`);
        result.success = true;
      } catch (dbError: any) {
        result.errors.push(`Database update failed: ${dbError.message}`);
        console.error(`❌ Database update failed:`, dbError);
      }
    } else {
      result.errors.push('No images were successfully uploaded');
    }
  } catch (error: any) {
    result.errors.push(`Unexpected error: ${error.message}`);
    console.error('❌ Unexpected error:', error);
  }

  return result;
}

async function testAWSCredentials(): Promise<boolean> {
  console.log('🔍 Testing AWS credentials...\n');

  const accessKey = process.env.AWS_ACCESS_KEY?.trim();
  const secretKey = process.env.AWS_SECRET_KEY?.trim();
  const region = process.env.AWS_DEFAULT_REGION?.trim();
  const bucket = process.env.AWS_S3_BUCKET_NAME?.trim();

  console.log('AWS Configuration:');
  console.log(`  Access Key: ${accessKey ? accessKey.substring(0, 8) + '...' : 'MISSING'}`);
  console.log(
    `  Secret Key: ${secretKey ? '****' + secretKey.substring(secretKey.length - 4) : 'MISSING'}`
  );
  console.log(`  Region: ${region || 'MISSING'}`);
  console.log(`  Bucket: ${bucket || 'MISSING'}\n`);

  if (!accessKey || !secretKey || !region || !bucket) {
    console.error('❌ Missing AWS credentials in environment variables!');
    return false;
  }

  try {
    const s3Client = createS3Client();
    const testKey = 'test-upload.txt';
    const testContent = Buffer.from('Test upload');

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
    });

    await s3Client.send(command);
    console.log('✅ AWS credentials are valid!\n');
    return true;
  } catch (error: any) {
    console.error('❌ AWS credentials test failed:', error.message);
    return false;
  }
}

async function reUploadAllTourImages() {
  console.log('🚀 Starting re-upload of all tour images to new AWS account...\n');

  try {
    const credentialsValid = await testAWSCredentials();
    if (!credentialsValid) {
      console.error('❌ Aborting upload due to invalid AWS credentials');
      return;
    }

    const IMAGES_ROOT = path.join(__dirname, '../../downloaded_images/downloaded_images');

    if (!fs.existsSync(IMAGES_ROOT)) {
      console.error(`❌ Images root directory not found: ${IMAGES_ROOT}`);
      return;
    }

    // Get all folders (slugs) from downloaded_images directory
    const allFolders = fs.readdirSync(IMAGES_ROOT).filter((item) => {
      const fullPath = path.join(IMAGES_ROOT, item);
      return fs.statSync(fullPath).isDirectory();
    });

    console.log(`📋 Found ${allFolders.length} folders in downloaded_images\n`);

    const results: UploadResult[] = [];
    const notFoundInDB: string[] = [];
    const alreadyEmpty: string[] = [];
    let processedCount = 0;

    for (const slug of allFolders) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Processing [${++processedCount}/${allFolders.length}]: ${slug}`);
      console.log('='.repeat(60));

      // Find tour in database by slug
      const tour = await prisma.tour.findUnique({
        where: { slug: slug },
        select: { id: true, slug: true, title: true, images: true },
      });

      if (!tour) {
        console.log(`⚠️  Tour not found in database: ${slug}`);
        notFoundInDB.push(slug);
        continue;
      }

      console.log(`✓ Found in DB: ${tour.title}`);
      console.log(`  Current image paths in DB: ${tour.images.length}`);

      if (tour.images.length === 0) {
        console.log(`ℹ️  No existing images in DB (skipping, might be new tour)`);
        alreadyEmpty.push(slug);
        continue;
      }

      // Get folder path
      const folderPath = path.join(IMAGES_ROOT, slug);

      // Re-upload images to new AWS account
      const result = await reUploadTourImages(tour.id, slug, tour.images, folderPath);
      results.push(result);

      // Small delay between uploads to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Print comprehensive summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 RE-UPLOAD SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total folders found: ${allFolders.length}`);
    console.log(`Tours processed: ${results.length}`);
    console.log(`Successfully re-uploaded: ${results.filter((r) => r.success).length}`);
    console.log(`Failed re-uploads: ${results.filter((r) => !r.success).length}`);
    console.log(`Tours not found in DB: ${notFoundInDB.length}`);
    console.log(`Tours with no images (skipped): ${alreadyEmpty.length}`);
    console.log(
      `Total images re-uploaded: ${results.reduce((sum, r) => sum + r.uploadedImages.length, 0)}`
    );

    if (notFoundInDB.length > 0) {
      console.log('\n⚠️  Folders found but tours not in database:');
      notFoundInDB.forEach((slug) => console.log(`   - ${slug}`));
    }

    if (alreadyEmpty.length > 0) {
      console.log('\n ℹ️  Tours with no existing images (skipped):');
      alreadyEmpty.forEach((slug) => console.log(`   - ${slug}`));
    }

    if (results.length > 0) {
      console.log('\n✅ Successfully re-uploaded tours:');
      results
        .filter((r) => r.success)
        .forEach((r) => {
          console.log(`   - ${r.tourSlug}: ${r.uploadedImages.length} images`);
        });
    }

    if (results.some((r) => !r.success)) {
      console.log('\n❌ Failed re-uploads:');
      results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`   - ${r.tourSlug}:`);
          r.errors.forEach((err) => console.log(`     • ${err}`));
        });
    }

    console.log('='.repeat(80) + '\n');
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the re-upload
if (require.main === module) {
  reUploadAllTourImages()
    .then(() => {
      console.log('✅ Re-upload completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Re-upload failed:', error);
      process.exit(1);
    });
}

export { reUploadAllTourImages };
