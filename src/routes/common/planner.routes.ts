// =============================================================================
// US-503 — public planner routes. Mounted at /api/common/planner (no auth —
// protection = rate limit + caps + sanitized payload, see the controller).
// =============================================================================
import { Router } from 'express';
import { PublicPlannerController } from '@/controllers/common/publicPlanner.controller';

const router = Router();

/** POST /api/common/planner/plan — anonymous solve, sanitized planner payload only. */
router.post('/plan', PublicPlannerController.plan);

export default router;
