import type { Request, Response } from 'express';
import { AuthService } from '@/services/user/auth.service';
import { ValidationUtil } from '@/utils/validation.util';

export class AuthController {
  /**
   * Register new user
   * POST /api/auth/register
   */
  static async register(req: Request, res: Response) {
    try {
      const { name, email, password, phone } = req.body;

      if (!name || !email || !password) {
        return res.deliver(400, false, undefined, 'Name, email, and password are required');
      }

      if (!ValidationUtil.isValidEmail(email)) {
        return res.deliver(400, false, undefined, 'Invalid email format');
      }

      if (!ValidationUtil.isValidPassword(password)) {
        return res.deliver(400, false, undefined, 'Password must be at least 8 characters');
      }

      if (phone && !ValidationUtil.isValidPhone(phone)) {
        return res.deliver(400, false, undefined, 'Invalid phone format');
      }

      const result = await AuthService.register(name, email, password, phone);

      return res.deliver(
        201,
        true,
        result,
        'Registration successful. Please check your email to verify your account.'
      );
    } catch (error) {
      console.error('Registration error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Registration failed'
      );
    }
  }

  /**
   * Login user
   * POST /api/auth/login
   */
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.deliver(400, false, undefined, 'Email and password are required');
      }

      const result = await AuthService.login(email, password);

      return res.deliver(200, true, result, 'Login successful');
    } catch (error) {
      console.error('Login error:', error);
      return res.deliver(
        401,
        false,
        undefined,
        error instanceof Error ? error.message : 'Login failed'
      );
    }
  }

  /**
   * Verify email with token
   * GET /api/auth/verify-email?token=xxx
   */
  static async verifyEmail(req: Request, res: Response) {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.deliver(400, false, undefined, 'Verification token is required');
      }

      const result = await AuthService.verifyEmail(token);

      return res.deliver(200, true, result, 'Email verified successfully');
    } catch (error: any) {
      console.error('Verification error:', error);

      if (error.name === 'JsonWebTokenError') {
        return res.deliver(400, false, undefined, 'Invalid verification token');
      }

      if (error.name === 'TokenExpiredError') {
        return res.deliver(
          400,
          false,
          undefined,
          'Verification token has expired. Please request a new one.'
        );
      }

      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Email verification failed'
      );
    }
  }

  /**
   * Resend verification email
   * POST /api/auth/resend-verification
   */
  static async resendVerification(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.deliver(401, false, undefined, 'Unauthorized');
      }

      await AuthService.resendVerificationEmail(userId);

      return res.deliver(200, true, undefined, 'Verification email sent successfully');
    } catch (error) {
      console.error('Resend verification error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to resend verification email'
      );
    }
  }

  /**
   * Refresh access token
   * POST /api/auth/refresh-token
   */
  static async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.deliver(400, false, undefined, 'Refresh token is required');
      }

      const result = await AuthService.refreshToken(refreshToken);

      return res.deliver(200, true, result, 'Token refreshed successfully');
    } catch (error) {
      console.error('Refresh token error:', error);
      return res.deliver(
        401,
        false,
        undefined,
        error instanceof Error ? error.message : 'Token refresh failed'
      );
    }
  }

  /**
   * Get current user profile
   * GET /api/auth/me
   */
  static async getProfile(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.deliver(401, false, undefined, 'Unauthorized');
      }

      const profile = await AuthService.getProfile(userId);

      return res.deliver(200, true, profile);
    } catch (error) {
      console.error('Get profile error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch profile'
      );
    }
  }
}
