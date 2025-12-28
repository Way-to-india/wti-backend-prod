import type { Request, Response } from 'express';
import { AuthService } from '@/services/admin/auth.service';

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
}
