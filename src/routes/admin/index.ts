import AppRoutes from '@/common/appRoutes';
import { Router } from 'express';
import TourRouter from './tour.routes';
import ZohoRouter from './zoho.routes';
import AuthRouter from './auth.routes';
import AdminRouter from './admin.routes';
import DashboardRouter from './dashboard.routes';
import RoleRouter from './role.routes';
import PermissionRouter from './permission.routes';
import ModuleRouter from './module.routes';

const router = Router();

router.use(AppRoutes.TOURS,TourRouter);
router.use(AppRoutes.ZOHO,ZohoRouter);
router.use(AppRoutes.AUTH,AuthRouter);
router.use(AppRoutes.ADMIN,AdminRouter);
router.use(AppRoutes.DASHBOARD,DashboardRouter)
router.use(AppRoutes.PERMISSION,PermissionRouter);
router.use(AppRoutes.ROLE,RoleRouter);
router.use(AppRoutes.MODULE,ModuleRouter);

export default router;
