import { Router } from 'express';
import { AuthController } from '@/controllers/admin/auth.controller';
import { authMiddleware } from '@/middlewares/admin/auth.middleware';
import {
  loginRateLimiter,
  forgotPasswordRateLimiter,
  resetPasswordRateLimiter,
  changePasswordRateLimiter,
} from '@/middlewares/rate-limit.middleware';

const router = Router();

router.post('/login', loginRateLimiter, AuthController.login);
router.post('/refresh-token', AuthController.refreshToken);
router.post('/logout', authMiddleware, AuthController.logout);
router.get('/profile', authMiddleware, AuthController.getProfile);

// Password management (US-SEC-001)
router.post(
  '/change-password',
  changePasswordRateLimiter,
  authMiddleware,
  AuthController.changePassword
);
router.post('/forgot-password', forgotPasswordRateLimiter, AuthController.forgotPassword);
router.post('/reset-password', resetPasswordRateLimiter, AuthController.resetPassword);

export default router;
