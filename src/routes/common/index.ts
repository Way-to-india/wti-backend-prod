import AppRoutes from '@/common/appRoutes';
import { Router } from 'express';
import CityRouter from './city.routes';
import HeroSlideRouter from './hero-slide.routes';
import PoiRouter from './poi.routes';
import QueryRouter from './query.routes';
import ThemeRouter from './theme.routes';
import TourRouter from './tour.routes';
import TravelGuideRouter from './travel-guide.routes';

const router = Router();

router.use(AppRoutes.TOUR, TourRouter);
router.use(AppRoutes.CITY, CityRouter);
router.use(AppRoutes.THEME, ThemeRouter);
router.use(AppRoutes.QUERY, QueryRouter);
router.use(AppRoutes.TRAVEL_GUIDE, TravelGuideRouter);
router.use(AppRoutes.POI, PoiRouter);
router.use(AppRoutes.HERO_SLIDES, HeroSlideRouter);

export default router;
