import type { Request, Response } from 'express';
import { VerificationService } from '@/services/user/verification.service';

export class VerificationController {

  /**
   * Send email OTP
   * POST /api/user/verify/send-email-otp
   */
  static async sendEmailOtp(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.deliver(400, false, undefined, 'Email is required');
      }

      const result = await VerificationService.sendEmailOtp(email);

      return res.deliver(200, true, result, result.message);
    } catch (error) {
      console.error('Send email OTP error:', error);
      return res.deliver(
        400,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to send email OTP'
      );
    }
  }

  /**
   * Verify email OTP
   * POST /api/user/verify/check-email-otp
   */
  static async checkEmailOtp(req: Request, res: Response) {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.deliver(400, false, undefined, 'Email and OTP are required');
      }

      const result = await VerificationService.verifyEmailOtp(email, otp);

      return res.deliver(200, true, result, result.message);
    } catch (error) {
      console.error('Verify email OTP error:', error);
      return res.deliver(
        400,
        false,
        undefined,
        error instanceof Error ? error.message : 'Email verification failed'
      );
    }
  }

  /**
   * Send phone OTP
   * POST /api/user/verify/send-phone-otp
   */
  static async sendPhoneOtp(req: Request, res: Response) {
    try {
      const { email, phone } = req.body;

      if (!email || !phone) {
        return res.deliver(400, false, undefined, 'Email and phone are required');
      }

      const result = await VerificationService.sendPhoneOtp(email, phone);

      return res.deliver(200, true, result, result.message);
    } catch (error) {
      console.error('Send phone OTP error:', error);
      return res.deliver(
        400,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to send phone OTP'
      );
    }
  }

  /**
   * Verify phone OTP
   * POST /api/user/verify/check-phone-otp
   */
  static async checkPhoneOtp(req: Request, res: Response) {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.deliver(400, false, undefined, 'Email and OTP are required');
      }

      const result = await VerificationService.verifyPhoneOtp(email, otp);

      return res.deliver(200, true, result, result.message);
    } catch (error) {
      console.error('Verify phone OTP error:', error);
      return res.deliver(
        400,
        false,
        undefined,
        error instanceof Error ? error.message : 'Phone verification failed'
      );
    }
  }

  /**
   * Get verification status
   * GET /api/user/verify/status?email=xxx
   */
  static async getStatus(req: Request, res: Response) {
    try {
      const { email } = req.query;

      if (!email || typeof email !== 'string') {
        return res.deliver(400, false, undefined, 'Email is required');
      }

      const result = await VerificationService.getStatus(email);

      return res.deliver(200, true, result);
    } catch (error) {
      console.error('Verification status error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to get verification status'
      );
    }
  }
}
