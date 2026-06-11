import type { Request, Response } from 'express';
import { AuthService } from '@/services/admin/auth.service';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@/validators/auth.validator';

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.deliver(400, false, undefined, 'Email and password are required');
      }

      console.log(email,password);

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

  static async logout(req: Request, res: Response) {
    try {
      const adminId = req.admin?.adminId;

      if (!adminId) {
        return res.deliver(401, false, undefined, 'Unauthorized');
      }

      await AuthService.logout(adminId);

      return res.deliver(200, true, undefined, 'Logout successful');
    } catch (error) {
      console.error('Logout error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Logout failed'
      );
    }
  }

  static async getProfile(req: Request, res: Response) {
    try {
      const adminId = req.admin?.adminId;

      if (!adminId) {
        return res.deliver(401, false, undefined, 'Unauthorized');
      }

      const profile = await AuthService.getProfile(adminId);

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

  static async changePassword(req: Request, res: Response) {
    try {
      const adminId = req.admin?.adminId;
      if (!adminId) {
        return res.deliver(401, false, undefined, 'Unauthorized');
      }

      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.deliver(
          400,
          false,
          undefined,
          parsed.error.issues[0]?.message || 'Invalid input'
        );
      }

      await AuthService.changePassword(
        adminId,
        parsed.data.currentPassword,
        parsed.data.newPassword
      );

      return res.deliver(
        200,
        true,
        undefined,
        'Password changed successfully. Please log in again on other devices.'
      );
    } catch (error) {
      console.error('Change password error:', error);
      return res.deliver(
        400,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to change password'
      );
    }
  }

  static async forgotPassword(req: Request, res: Response) {
    try {
      const parsed = forgotPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.deliver(
          400,
          false,
          undefined,
          parsed.error.issues[0]?.message || 'A valid email is required'
        );
      }

      await AuthService.forgotPassword(parsed.data.email);

      // Generic response regardless of whether the email exists (no enumeration).
      return res.deliver(
        200,
        true,
        undefined,
        'If an account exists for that email, a password reset link has been sent.'
      );
    } catch (error) {
      console.error('Forgot password error:', error);
      // Still respond generically to avoid leaking internal state.
      return res.deliver(
        200,
        true,
        undefined,
        'If an account exists for that email, a password reset link has been sent.'
      );
    }
  }

  static async resetPassword(req: Request, res: Response) {
    try {
      const parsed = resetPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.deliver(
          400,
          false,
          undefined,
          parsed.error.issues[0]?.message || 'Invalid input'
        );
      }

      await AuthService.resetPassword(parsed.data.token, parsed.data.newPassword);

      return res.deliver(
        200,
        true,
        undefined,
        'Password reset successfully. You can now log in with your new password.'
      );
    } catch (error) {
      console.error('Reset password error:', error);
      return res.deliver(
        400,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to reset password'
      );
    }
  }
}
