import prisma from '@/config/db';
import type { UserTokenPayload } from '@/utils/jwt.util';
import { JwtUtil } from '@/utils/jwt.util';
import { PasswordUtil } from '@/utils/password.util';
import { ValidationUtil } from '@/utils/validation.util';
import { EmailService } from '../common/email.service';

export class AuthService {

  static async register(name: string, email: string, password: string, phone?: string) {

    const sanitizedEmail = ValidationUtil.sanitizeEmail(email); 

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: sanitizedEmail }, ...(phone ? [{ phone }] : [])],
      },
    });

    if (existingUser) {
      if (existingUser.email === sanitizedEmail) {
        throw new Error('Email already registered');
      }
      throw new Error('Phone number already registered');
    }

    const hashedPassword = await PasswordUtil.hash(password);

    const user = await prisma.user.create({
      data: {
        name,
        email: sanitizedEmail,
        password: hashedPassword,
        phone: phone || null,
        isEmailVerified: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    });

    const verificationToken = JwtUtil.generateEmailVerificationToken(user.id, user.email);

    try {
      await EmailService.sendVerificationEmail(user.email, verificationToken, user.name);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        createdAt: user.createdAt,
      },
    };
  }

  static async login(email: string, password: string) {
    const sanitizedEmail = ValidationUtil.sanitizeEmail(email);

    const user = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    const isPasswordValid = await PasswordUtil.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    const payload: UserTokenPayload = {
      userId: user.id,
      email: user.email,
    };

    const accessToken = JwtUtil.generateUserAccessToken(payload);
    const refreshToken = JwtUtil.generateUserRefreshToken(payload);

    const { password: _, ...userData } = user;

    return {
      user: {
        ...userData,
        isEmailVerified: user.isEmailVerified,
      },
      accessToken,
      refreshToken,
    };
  }

  static async refreshToken(token: string) {
    const payload = JwtUtil.verifyUserRefreshToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new Error('Invalid refresh token');
    }

    const newPayload: UserTokenPayload = {
      userId: user.id,
      email: user.email,
    };

    const accessToken = JwtUtil.generateUserAccessToken(newPayload);

    return { accessToken };
  }

  static async verifyEmail(token: string) {
    const decoded = JwtUtil.verifyEmailToken(token);

    if (decoded.type !== 'email-verification') {
      throw new Error('Invalid token type');
    }

    const user = await prisma.user.update({
      where: { id: decoded.userId },
      data: { isEmailVerified: true },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        profileImage: true,
        profileCoverImage: true,
        address: true,
        pinCode: true,
        bio: true,
        isEmailVerified: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const payload: UserTokenPayload = {
      userId: user.id,
      email: user.email,
    };

    const accessToken = JwtUtil.generateUserAccessToken(payload);
    const refreshToken = JwtUtil.generateUserRefreshToken(payload);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        profileImage: user.profileImage,
        profileCoverImage: user.profileCoverImage,
        address: user.address,
        pinCode: user.pinCode,
        bio: user.bio,
        isEmailVerified: user.isEmailVerified,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      accessToken,
      refreshToken,
    };
  }

  static async resendVerificationEmail(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        isEmailVerified: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.isEmailVerified) {
      throw new Error('Email is already verified');
    }

    const verificationToken = JwtUtil.generateEmailVerificationToken(user.id, user.email);

    await EmailService.sendVerificationEmail(user.email, verificationToken, user.name);
  }

  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        profileImage: true,
        profileCoverImage: true,
        address: true,
        pinCode: true,
        bio: true,
        isEmailVerified: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      ...user,
      isEmailVerified: user.isEmailVerified,
    };
  }
}
