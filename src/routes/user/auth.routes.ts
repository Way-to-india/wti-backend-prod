import { Router } from 'express';
import { AuthController } from '@/controllers/user/tour.controller';
import { authenticate } from '@/middlewares/user/auth.middleware';

const router = Router();

// Public routes
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.get('/verify-email', AuthController.verifyEmail);
router.post('/refresh-token', AuthController.refreshToken);

// Protected routes
router.post('/resend-verification', authenticate, AuthController.resendVerification);
router.get('/me', authenticate, AuthController.getProfile);

export default router;
