import AppRoutes from '@/common/appRoutes';
import { Router } from 'express';
import TourRouter from './tour.routes';
import ZohoRouter from './zoho.routes';
import AuthRouter from './auth.routes';
import AdminRouter from './admin.routes';
import DashboardRouter from './dashboard.routes';

const router = Router();

router.use(AppRoutes.TOURS,TourRouter);
router.use(AppRoutes.ZOHO,ZohoRouter);
router.use(AppRoutes.AUTH,AuthRouter);
router.use(AppRoutes.ADMIN,AdminRouter);
router.use(AppRoutes.DASHBOARD,DashboardRouter)
;

export default router;
