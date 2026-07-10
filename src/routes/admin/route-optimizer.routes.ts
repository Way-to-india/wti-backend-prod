import { Router } from 'express';
import { RouteOptimizerController } from '@/controllers/admin/routeOptimizer.controller';
import { checkPermission } from '@/middlewares/permission.middleware';
import { authMiddleware } from '@/middlewares/admin/auth.middleware';

/**
 * Route Optimizer — /api/admin/route-optimizer/*
 * Self-contained (city-search + custom-city add live on RouteOptimizerController)
 * so it runs on any backend build without external controller dependencies.
 */
const router = Router();

router.use(authMiddleware);

router.get('/city-search', checkPermission('Tours', 'view'), RouteOptimizerController.searchCities);
router.post('/city', checkPermission('Tours', 'edit'), RouteOptimizerController.addCity);
router.post('/optimize', checkPermission('Tours', 'edit'), RouteOptimizerController.optimize);

export default router;
