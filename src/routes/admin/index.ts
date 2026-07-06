import AppRoutes from '@/common/appRoutes';
import { Router } from 'express';
import AdminRouter from './admin.routes';
import AuthRouter from './auth.routes';
import BlogRouter from './blog.routes';
import DashboardRouter from './dashboard.routes';
import HeroSlideRouter from './hero-slide.routes';
import LeadCRMRouter from './lead-crm.routes';
import AIFunnelRouter from './ai-funnel.routes';
import ModuleRouter from './module.routes';
import PermissionRouter from './permission.routes';
import NotificationRouter from './notification.routes';
import PoiRouter from './poi.routes';
import RoleRouter from './role.routes';
import TourRouter from './tour.routes';
import TravelGuideRouter from './travel-guide.routes';
import UserRouter from './user.routes';
import TourDraftRouter from './tour-draft.routes'
import UploadRouter from './upload.routes';
import CityAdminRouter from './city.routes';
import RouteOptimizerRouter from './route-optimizer.routes';

const router = Router();

router.use(AppRoutes.TOURS, TourRouter);
router.use(AppRoutes.AUTH, AuthRouter);
router.use(AppRoutes.ADMIN, AdminRouter);
router.use(AppRoutes.DASHBOARD, DashboardRouter);
router.use(AppRoutes.PERMISSION, PermissionRouter);
router.use(AppRoutes.ROLE, RoleRouter);
router.use(AppRoutes.MODULE, ModuleRouter);
router.use(AppRoutes.TRAVEL_GUIDE, TravelGuideRouter);
router.use(AppRoutes.POI, PoiRouter);
router.use(AppRoutes.HERO_SLIDES, HeroSlideRouter);
router.use(AppRoutes.BLOGS, BlogRouter);
router.use(AppRoutes.TOUR_DRAFTS, TourDraftRouter);
router.use(AppRoutes.USERS, UserRouter);
router.use(AppRoutes.NOTIFICATIONS, NotificationRouter);
router.use(AppRoutes.CRM, LeadCRMRouter);
router.use('/ai-funnel', AIFunnelRouter);

router.use(AppRoutes.CITY, CityAdminRouter);
router.use('/upload', UploadRouter);
router.use(AppRoutes.ROUTE_OPTIMIZER, RouteOptimizerRouter);

export default router;
