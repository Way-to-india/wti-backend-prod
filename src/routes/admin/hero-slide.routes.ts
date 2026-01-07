import { HeroSlideController } from '@/controllers/admin/hero-slide.controller';
import { authMiddleware } from '@/middlewares/admin/auth.middleware';
import upload from '@/middlewares/multer';
import { checkPermission } from '@/middlewares/permission.middleware';
import { validate } from '@/middlewares/validation.middleware';
import {
  createHeroSlideSchema,
  reorderHeroSlidesSchema,
  updateHeroSlideSchema,
} from '@/validators/hero-slide.validator';
import { Router } from 'express';

const router = Router();

router.use(authMiddleware);

router.get('/', 
  // checkPermission('Homepage', 'view'), 
  HeroSlideController.getAllHeroSlides
);

router.get('/view/:id', 
  checkPermission('Homepage', 'view'), 
  HeroSlideController.getHeroSlideById
);

router.post(
  '/create',
  checkPermission('Homepage', 'create'),
  upload.single('image'),
  validate(createHeroSlideSchema, 'body'),
  HeroSlideController.createHeroSlide
);

router.put(
  '/edit/:id',
  checkPermission('Homepage', 'edit'),
  upload.single('image'),
  validate(updateHeroSlideSchema, 'body'),
  HeroSlideController.updateHeroSlide
);

router.delete(
  '/delete/:id',
  checkPermission('Homepage', 'delete'),
  HeroSlideController.deleteHeroSlide
);

router.patch(
  '/reorder',
  checkPermission('Homepage', 'edit'),
  validate(reorderHeroSlidesSchema, 'body'),
  HeroSlideController.reorderHeroSlides
);

export default router;
