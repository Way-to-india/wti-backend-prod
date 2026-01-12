import { NotificationController } from '@/controllers/admin/notification.controller';
import { authMiddleware } from '@/middlewares/admin/auth.middleware';
import { Router } from 'express';

const router = Router();

// All notification routes require authentication
router.use(authMiddleware);

router.get('/my', NotificationController.getMyNotifications);
router.patch('/:id/read', NotificationController.markAsRead);
router.patch('/read-all', NotificationController.markAllAsRead);

export default router;
