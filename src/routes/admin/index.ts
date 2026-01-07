import AppRoutes from '@/common/appRoutes';
import { Router } from 'express';
import AdminRouter from './admin.routes';
import AuthRouter from './auth.routes';
import DashboardRouter from './dashboard.routes';
import HeroSlideRouter from './hero-slide.routes';
import ModuleRouter from './module.routes';
import PermissionRouter from './permission.routes';
import PoiRouter from './poi.routes';
import RoleRouter from './role.routes';
import TourRouter from './tour.routes';
import TravelGuideRouter from './travel-guide.routes';
import ZohoRouter from './zoho.routes';

const router = Router();

router.use(AppRoutes.TOURS, TourRouter);
router.use(AppRoutes.ZOHO, ZohoRouter);
router.use(AppRoutes.AUTH, AuthRouter);
router.use(AppRoutes.ADMIN, AdminRouter);
router.use(AppRoutes.DASHBOARD, DashboardRouter);
router.use(AppRoutes.PERMISSION, PermissionRouter);
router.use(AppRoutes.ROLE, RoleRouter);
router.use(AppRoutes.MODULE, ModuleRouter);
router.use(AppRoutes.TRAVEL_GUIDE, TravelGuideRouter);
router.use(AppRoutes.POI, PoiRouter);
router.use(AppRoutes.HERO_SLIDES, HeroSlideRouter);

export default router;
