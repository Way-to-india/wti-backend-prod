import { getDashboardAnalytics } from '@/controllers/admin/dashboard.controller';
import { authMiddleware } from '@/middlewares/admin/auth.middleware';
import { Router } from 'express';

const router = Router();

router.use(authMiddleware);

router.get('/', getDashboardAnalytics);

export default router;
