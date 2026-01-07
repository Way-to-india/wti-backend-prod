import { HeroSlideController } from '@/controllers/common/hero-slide.controller';
import { Router } from 'express';

const router = Router();

router.get('/', HeroSlideController.getActiveHeroSlides);

export default router;
