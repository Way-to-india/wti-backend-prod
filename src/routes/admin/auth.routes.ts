import { Router } from 'express';
import { AuthController } from '@/controllers/admin/auth.controller';
import { authMiddleware } from '@/middlewares/admin/auth.middleware';

const router = Router();

router.post('/login', AuthController.login);
router.post('/refresh-token', AuthController.refreshToken);
router.post('/logout', authMiddleware, AuthController.logout);
router.get('/profile', authMiddleware, AuthController.getProfile);

export default router;
