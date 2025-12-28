import prisma from '@/config/db';
import { PasswordUtil } from '@/utils/password.util';
import { JwtUtil } from '@/utils/jwt.util';

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
}
