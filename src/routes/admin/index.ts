import AppRoutes from '@/common/appRoutes';
import { Router } from 'express';
import TourRouter from './tour.routes';
import ZohoRouter from './zoho.routes';

const router = Router();

router.use(AppRoutes.TOUR,TourRouter);
router.use(AppRoutes.ZOHO,ZohoRouter);

export default router;
