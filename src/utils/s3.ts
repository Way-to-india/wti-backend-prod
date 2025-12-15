import { S3Folder } from '@/common/constants';
import S3Service from '@/services/common/s3.service';

const s3Service = new S3Service();

export async function uploadImageToS3(
  file: Express.Multer.File,
  folder: string = S3Folder.TOUR_IMAGES
): Promise<string> {
  try {
    const key = await s3Service.uploadFile(
      file.buffer,
      folder as S3Folder,
      file.originalname,
      file.mimetype
    );
    return key;
  } catch (error) {
    console.error('Error uploading image to S3:', error);
    throw new Error('Failed to upload image');
  }
}

export async function uploadMultipleImagesToS3(
  files: Express.Multer.File[],
  folder: string = S3Folder.TOUR_IMAGES
): Promise<string[]> {
  const uploadPromises = files.map((file) => uploadImageToS3(file, folder));
  return await Promise.all(uploadPromises);
}

export async function deleteImagesFromS3(keys: string[]): Promise<void> {
  try {
    const s3Service = new S3Service();
    await s3Service.S3BulkDelete(keys);
  } catch (error) {
    console.error('Error deleting images from S3:', error);
  }
}
