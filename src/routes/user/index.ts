import AppRoutes from '@/common/appRoutes';
import { Router } from 'express';
import AuthRouter from './auth.routes';
import TourRouter from './tour.routes';

const router = Router();

router.use(AppRoutes.AUTH, AuthRouter);
router.use(AppRoutes.TOUR, TourRouter);

export default router;
