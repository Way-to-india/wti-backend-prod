import { Request, Response } from 'express';
import { uploadImageToS3 } from '@/utils/s3';
import { S3Folder } from '@/common/constants';

/**
 * Generic single-image upload for the admin (Travel Tips builder image fields).
 * Accepts multipart field "image", uploads to S3, returns a full CloudFront URL.
 */
export class UploadController {
  static async uploadImage(req: Request, res: Response) {
    try {
      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file) {
        return res.deliver(400, false, undefined, 'No image provided');
      }
      const key = await uploadImageToS3(file, S3Folder.TOUR_IMAGES);
      const base = (process.env.AWS_CLOUDFRONT_ENDPOINT || '').replace(/\/$/, '');
      const url = /^https?:\/\//i.test(key)
        ? key
        : base
          ? `${base}/${key.replace(/^\//, '')}`
          : key;
      return res.deliver(200, true, { url, key }, 'Uploaded');
    } catch (error) {
      console.error('uploadImage error:', error);
      return res.deliver(500, false, undefined, 'Upload failed');
    }
  }
}
