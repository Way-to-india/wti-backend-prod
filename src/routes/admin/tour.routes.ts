import { Router } from 'express';
import { TourController } from '@/controllers/admin/tour.controller';
import { uploadTourImages } from '@/middlewares/multer';
import { checkPermission } from '@/middlewares/permission.middleware';
import { authMiddleware } from '@/middlewares/admin/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post(
  '/create',
  checkPermission('Tours', 'create'),
  uploadTourImages.fields,
  TourController.createTour
);

router.get('/', checkPermission('Tours', 'view'), TourController.getAllTours);

router.get('/view/:id', checkPermission('Tours', 'view'), TourController.getTourById);

router.put(
  '/edit/:id',
  checkPermission('Tours', 'edit'),
  uploadTourImages.fields,
  TourController.updateTour
);

router.delete('/delete/:id', checkPermission('Tours', 'delete'), TourController.deleteTour);

// Nested updates
// router.put('/:id/itinerary', checkPermission('Tours', 'edit'), TourController.updateTourItinerary);
// router.put('/:id/themes', checkPermission('Tours', 'edit'), TourController.updateTourThemes);
// router.put('/:id/cities', checkPermission('Tours', 'edit'), TourController.updateTourCities);
// router.put('/:id/faqs', checkPermission('Tours', 'edit'), TourController.updateTourFaqs);
// router.put(
//   '/:id/price-guide',
//   checkPermission('Tours', 'edit'),
//   TourController.updateTourPriceGuide
// );

// Image management
router.post('/:id/images', checkPermission('Tours', 'edit'), TourController.uploadGalleryImages);

router.delete(
  '/:id/images/:imageKey',
  checkPermission('Tours', 'edit'),
  TourController.deleteGalleryImage
);

router.post('/:id/cover-image', checkPermission('Tours', 'edit'), TourController.uploadCoverImage);

router.post(
  '/:id/itinerary-images',
  checkPermission('Tours', 'edit'),
  TourController.uploadItineraryImages
);

export default router;
