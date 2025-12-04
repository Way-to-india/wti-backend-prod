import { Router } from 'express';
import { TourController } from '@/controllers/admin/tour.controller';
import { validate } from '@/middlewares/validation.middleware';
import {
  createTourSchema,
  updateTourSchema,
  getTourQuerySchema,
  idParamSchema,
} from '@/validators/tour.validator';
import { uploadTourImages } from '@/middlewares/multer';

const router = Router();

router.get('/', validate(getTourQuerySchema, 'query'), TourController.getAllTours);

router.get('/:id', validate(idParamSchema, 'params'), TourController.getTourById);

router.post(
  '/',
  uploadTourImages.fields,
  validate(createTourSchema, 'body'),
  TourController.createTour
);

router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  uploadTourImages.fields,
  validate(updateTourSchema, 'body'),
  TourController.updateTour
);

router.delete('/:id', validate(idParamSchema, 'params'), TourController.deleteTour);

router.post(
  '/:id/images',
  validate(idParamSchema, 'params'),
  uploadTourImages.multiple,
  TourController.uploadGalleryImages
);

router.delete(
  '/:id/images/:imageKey',
  validate(idParamSchema, 'params'),
  TourController.deleteGalleryImage
);

router.post(
  '/:id/cover',
  validate(idParamSchema, 'params'),
  uploadTourImages.single,
  TourController.uploadCoverImage
);

router.post(
  '/:id/itinerary/images',
  validate(idParamSchema, 'params'),
  uploadTourImages.multiple,
  TourController.uploadItineraryImages
);

export default router;
