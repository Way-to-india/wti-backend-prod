import { Router } from 'express';
import { RouteOptimizerController } from '@/controllers/admin/routeOptimizer.controller';
import { verifyCity } from '@/services/route-optimizer/cityVerify';
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
// existence ladder: DB exact -> pg_trgm spelling fix -> AI verification + registration
router.post('/city-verify', checkPermission('Tours', 'edit'), async (req, res) => {
  try {
    const r = await verifyCity(String((req.body || {}).name || ''));
    return res.deliver(200, true, r);
  } catch (e) {
    console.error('city-verify failed:', e);
    return res.deliver(500, false, undefined, 'Verification failed');
  }
});
router.post('/optimize', checkPermission('Tours', 'edit'), RouteOptimizerController.optimize);

export default router;
