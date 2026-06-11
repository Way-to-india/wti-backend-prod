import { Router } from 'express';
import { VerificationController } from '@/controllers/user/verification.controller';

const router = Router();

// All routes are public (pre-registration)
router.post('/send-email-otp', VerificationController.sendEmailOtp);
router.post('/check-email-otp', VerificationController.checkEmailOtp);
router.post('/send-phone-otp', VerificationController.sendPhoneOtp);
router.post('/check-phone-otp', VerificationController.checkPhoneOtp);
router.get('/status', VerificationController.getStatus);

export default router;
