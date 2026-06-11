import crypto from 'crypto';
import prisma from '@/config/db';
import redis from '@/config/redis';
import { PasswordUtil } from '@/utils/password.util';
import { JwtUtil } from '@/utils/jwt.util';
import { EmailService } from '@/services/common/email.service';

const RESET_TOKEN_TTL_SECONDS = 30 * 60; // 30 minutes
const RESET_TOKEN_PREFIX = 'admin:pwreset:';

export class AuthService {
  static async login(email: string, password: string) {

    const admin = await prisma.admin.findUnique({
      where: { email },
      include: { role: true },
    });

    console.log(admin);

    if (!admin) {
      throw new Error('Invalid credentials');
    }

    if (!admin.isActive) {
      throw new Error('Account is inactive');
    }

    const isPasswordValid = await PasswordUtil.compare(password, admin.password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    const payload = {
      adminId: admin.id,
      email: admin.email,
      roleId: admin.roleId,
    };

    const accessToken = JwtUtil.generateAdminAccessToken(payload);
    const refreshToken = JwtUtil.generateAdminRefreshToken(payload);

    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        refreshToken,
        refreshTokenExpiry: JwtUtil.getRefreshTokenExpiry(),
        lastLoginAt: new Date(),
      },
    });

    const { password: _, refreshToken: __, ...adminData } = admin;

    return {
      admin: adminData,
      accessToken,
      refreshToken,
    };
  }

  static async refreshToken(token: string) {
    const payload = JwtUtil.verifyAdminRefreshToken(token);

    const admin = await prisma.admin.findUnique({
      where: { id: payload.adminId },
    });

    if (!admin || admin.refreshToken !== token) {
      throw new Error('Invalid refresh token');
    }

    if (admin.refreshTokenExpiry && admin.refreshTokenExpiry < new Date()) {
      throw new Error('Refresh token expired');
    }

    const newPayload = {
      adminId: admin.id,
      email: admin.email,
      roleId: admin.roleId,
    };

    const accessToken = JwtUtil.generateAdminAccessToken(newPayload);

    return { accessToken };
  }

  static async logout(adminId: string) {
    await prisma.admin.update({
      where: { id: adminId },
      data: {
        refreshToken: null,
        refreshTokenExpiry: null,
      },
    });
  }

  static async getProfile(adminId: string) {
    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                module: true,
              },
            },
          },
        },
      },
    });

    if (!admin) {
      throw new Error('Admin not found');
    }

    const { password: _, refreshToken: __, ...adminData } = admin;
    return adminData;
  }

  /**
   * Change password for a logged-in admin.
   * Verifies the current password, enforces strength, stores a new bcrypt hash,
   * and clears the refresh token so other sessions can no longer be refreshed.
   */
  static async changePassword(adminId: string, currentPassword: string, newPassword: string) {
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });

    if (!admin) {
      throw new Error('Admin not found');
    }

    const isCurrentValid = await PasswordUtil.compare(currentPassword, admin.password);
    if (!isCurrentValid) {
      throw new Error('Current password is incorrect');
    }

    const strengthError = PasswordUtil.validateStrength(newPassword);
    if (strengthError) {
      throw new Error(strengthError);
    }

    const isSame = await PasswordUtil.compare(newPassword, admin.password);
    if (isSame) {
      throw new Error('New password must be different from the current password');
    }

    const hashed = await PasswordUtil.hash(newPassword);

    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        password: hashed,
        // Invalidate other sessions: refresh will fail, forcing re-login.
        refreshToken: null,
        refreshTokenExpiry: null,
      },
    });

    return { success: true };
  }

  /**
   * Begin a password reset. Always resolves successfully (no user enumeration).
   * If the email matches an active admin, a single-use token is stored in Redis
   * (30-min TTL) and a reset link is emailed.
   */
  static async forgotPassword(email: string) {
    const admin = await prisma.admin.findUnique({ where: { email } });

    // Only send when the account exists and is active. Either way, return success.
    if (admin && admin.isActive) {
      const token = crypto.randomBytes(32).toString('hex');
      await redis.setex(`${RESET_TOKEN_PREFIX}${token}`, RESET_TOKEN_TTL_SECONDS, admin.id);

      try {
        await EmailService.sendPasswordResetEmail(admin.email, token, admin.name);
      } catch (error) {
        // Don't leak delivery failures to the caller; log for ops.
        console.error('Failed to send admin password reset email:', error);
      }
    }

    return { success: true };
  }

  /**
   * Complete a password reset using a single-use token from forgotPassword().
   * Validates the token in Redis, enforces strength, sets the new hash,
   * invalidates the token, and clears the refresh token (logs out other sessions).
   */
  static async resetPassword(token: string, newPassword: string) {
    const key = `${RESET_TOKEN_PREFIX}${token}`;
    const adminId = await redis.get(key);

    if (!adminId) {
      throw new Error('This reset link is invalid or has expired. Please request a new one.');
    }

    const strengthError = PasswordUtil.validateStrength(newPassword);
    if (strengthError) {
      throw new Error(strengthError);
    }

    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin) {
      await redis.del(key);
      throw new Error('Account no longer exists');
    }

    const hashed = await PasswordUtil.hash(newPassword);

    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        password: hashed,
        refreshToken: null,
        refreshTokenExpiry: null,
      },
    });

    // Single-use: invalidate the token immediately.
    await redis.del(key);

    return { success: true };
  }
}
