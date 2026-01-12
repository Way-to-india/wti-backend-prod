import {
  getAllUsers,
  getUserById,
  getUserStats,
  sendEmailToUser,
  updateUserStatus,
} from '@/controllers/admin/user.controller';
import { authMiddleware } from '@/middlewares/admin/auth.middleware';
import { checkPermission } from '@/middlewares/permission.middleware';
import { Router } from 'express';

const router = Router();

router.use(authMiddleware);

router.get('/stats', checkPermission('Users', 'view'), getUserStats);

router.get('/', checkPermission('Users', 'view'), getAllUsers);

router.get('/:id', checkPermission('Users', 'view'), getUserById);

router.patch('/:id/status', checkPermission('Users', 'edit'), updateUserStatus);

router.post('/:id/send-email', checkPermission('Users', 'edit'), sendEmailToUser);

export default router;
