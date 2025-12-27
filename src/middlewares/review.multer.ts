import type { Request } from 'express';
import multer from 'multer';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heif',
  'image/tiff',
];

const imageFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Only ${ALLOWED_MIME_TYPES.join(', ')} are accepted.`));
  }
};

// Use memory storage for S3 upload
const storage = multer.memoryStorage();

// Configure multer for review images
const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per image
    files: 10, // Maximum 10 images per review
  },
});

// Export middleware for review image uploads
export const uploadReviewImages = upload.array('images', 10);

export default upload;
