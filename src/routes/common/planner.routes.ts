// =============================================================================
// US-503 — public planner routes. Mounted at /api/common/planner (no auth —
// protection = rate limit + caps + sanitized payload, see the controller).
// =============================================================================
import { Router } from 'express';
import { PublicPlannerController } from '@/controllers/common/publicPlanner.controller';

const router = Router();

/** POST /api/common/planner/plan — anonymous solve, sanitized planner payload only. */
router.post('/plan', PublicPlannerController.plan);

/** GET /api/common/planner/plan/:token — re-open a shared plan. READ-ONLY: anyone with
 *  the link reads it (that is how it spreads); nobody with the link can change it. */
router.get('/plan/:token', PublicPlannerController.get);

/** POST /api/common/planner/plan/:token/share — he copied the link. A signal, not a gate. */
router.post('/plan/:token/share', PublicPlannerController.share);

export default router;
