import AppRoutes from '@/common/appRoutes';
import { Router } from 'express';
import BlogRouter from './blog.routes';
import PlannerRouter from './planner.routes';
import CityRouter from './city.routes';
import HeroSlideRouter from './hero-slide.routes';
import PoiRouter from './poi.routes';
import QueryRouter from './query.routes';
import ThemeRouter from './theme.routes';
import TourRouter from './tour.routes';
import TravelGuideRouter from './travel-guide.routes';
import UnescoRouter from './unesco.routes';

const router = Router();

router.use(AppRoutes.TOUR, TourRouter);
router.use(AppRoutes.UNESCO, UnescoRouter);
router.use(AppRoutes.CITY, CityRouter);
router.use(AppRoutes.THEME, ThemeRouter);
router.use(AppRoutes.QUERY, QueryRouter);
router.use(AppRoutes.TRAVEL_GUIDE, TravelGuideRouter);
router.use(AppRoutes.POI, PoiRouter);
router.use(AppRoutes.HERO_SLIDES, HeroSlideRouter);
router.use(AppRoutes.BLOGS, BlogRouter);
router.use('/planner', PlannerRouter);

export default router;
