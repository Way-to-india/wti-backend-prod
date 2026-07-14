// =============================================================================
// US-503 — public planner routes. Mounted at /api/common/planner (no auth —
// protection = rate limit + caps + sanitized payload, see the controller).
// =============================================================================
import { Router } from 'express';
import { PublicPlannerController } from '@/controllers/common/publicPlanner.controller';
import { RouteOptimizerController } from '@/controllers/admin/routeOptimizer.controller';

const router = Router();

/** POST /api/common/planner/plan — anonymous solve, sanitized planner payload only. */
router.post('/plan', PublicPlannerController.plan);

/** GET /api/common/planner/cities?q= — the ORIGIN BOX types against this
 *  (FRONTEND-ADAPTATION-SPEC 2026-07-14 §1). A public mirror of the optimizer's
 *  world_cities autosuggest: read-only, India-preferred, 12 rows, no PII, and the
 *  query itself is a two-character-minimum ILIKE — nothing here is worth guarding
 *  behind auth, and a traveller answering "where do you start from?" must not need
 *  a login to type his own city. */
router.get('/cities', RouteOptimizerController.searchCities);

/** GET /api/common/planner/plan/:token — re-open a shared plan. READ-ONLY: anyone with
 *  the link reads it (that is how it spreads); nobody with the link can change it. */
router.get('/plan/:token', PublicPlannerController.get);

/** POST /api/common/planner/plan/:token/share — he copied the link. A signal, not a gate. */
router.post('/plan/:token/share', PublicPlannerController.share);

export default router;
