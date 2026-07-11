import { Router } from 'express';
import { RouteOptimizerController } from '@/controllers/admin/routeOptimizer.controller';
import { verifyCity, addPlaceByCoords } from '@/services/route-optimizer/cityVerify';
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
/**
 * THE WAY OUT (founder ruling 2026-07-11). A place we have never heard of is not the
 * end of the road: the operator tells us where it is, and we CHECK it.
 *   added    → registered as HUMAN_VERIFIED, planning continues
 *   held     → nothing added, plan NOT built around it, queued for a human at Way to
 *              India, and the caller is asked to contact us
 *   rejected → those were not coordinates
 */
router.post('/city-locate', checkPermission('Tours', 'edit'), async (req, res) => {
  try {
    const b = req.body || {};
    const r = await addPlaceByCoords(
      String(b.name || ''), Number(b.lat), Number(b.lng),
      typeof b.region === 'string' ? b.region : null,
    );
    // a HELD place is not an error — it is an honest "we must check this first"
    return res.deliver(r.outcome === 'rejected' ? 400 : 200, r.outcome === 'added', r, r.message);
  } catch (e) {
    console.error('city-locate failed:', e);
    return res.deliver(500, false, undefined, 'We could not check that location just now. Please try once more.');
  }
});

router.post('/optimize', checkPermission('Tours', 'edit'), RouteOptimizerController.optimize);

export default router;
