
import type { Request } from 'express';
import multer from 'multer';
import path from 'path';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heif',
  'image/tiff',
  'image/x-panasonic-raw',
];

const imageFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `File type not allowed. Only ${ALLOWED_MIME_TYPES.join(', ')} are accepted.`
      )
    );
  }
};


const storage = multer.memoryStorage();


const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, 
    files: 50, 
  },
});


export const uploadTourImages = {
  
  single: upload.single('image'),

  
  multiple: upload.array('images', 20),

  
  fields: upload.fields([
    { name: 'images', maxCount: 20 }, 
    { name: 'itineraryImages', maxCount: 15 }, 
    { name: 'coverImage', maxCount: 1 }, 
  ]),

  
  any: upload.any(),
};


export const uploadSingleImage = upload.single('image');
export const uploadMultipleImages = upload.array('images', 20);
export const uploadTourFields = upload.fields([
  { name: 'images', maxCount: 20 },
  { name: 'itineraryImages', maxCount: 15 },
  { name: 'coverImage', maxCount: 1 },
]);

export default upload;