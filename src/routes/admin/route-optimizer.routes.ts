import { Router } from 'express';
import { RouteOptimizerController } from '@/controllers/admin/routeOptimizer.controller';
import { RouteStopsController } from '@/controllers/admin/routeStops.controller';
import { checkPermission } from '@/middlewares/permission.middleware';
import { authMiddleware } from '@/middlewares/admin/auth.middleware';

/**
 * Route Optimizer — /api/admin/route-optimizer/*
 * Reuses the existing world_cities autosuggest (city-search) so the input picker
 * and the tour route editor share one endpoint contract.
 */
const router = Router();

router.use(authMiddleware);

router.get('/city-search', checkPermission('Tours', 'view'), RouteStopsController.searchCities);
router.post('/city', checkPermission('Tours', 'edit'), RouteStopsController.addCity);
router.post('/optimize', checkPermission('Tours', 'edit'), RouteOptimizerController.optimize);

export default router;
