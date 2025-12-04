import AppRoutes from '@/common/appRoutes';
import TourRouter from './tour.routes';
import CityRouter from './city.routes';
import ThemeRouter from './theme.routes';
import QueryRouter from './query.routes';
import { Router } from 'express';

const router = Router();

router.use(AppRoutes.TOUR, TourRouter);
router.use(AppRoutes.CITY, CityRouter);
router.use(AppRoutes.THEME, ThemeRouter);
router.use(AppRoutes.QUERY, QueryRouter);

export default router;
