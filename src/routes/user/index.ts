import AppRoutes from '@/common/appRoutes';
import { Router } from 'express';
import AuthRouter from './auth.routes';
import ReviewRouter from './review.routes';
import TourRouter from './tour.routes';

const router = Router();

router.use(AppRoutes.AUTH, AuthRouter);
router.use(AppRoutes.TOUR, TourRouter);
router.use(AppRoutes.REVIEW, ReviewRouter);

export default router;
