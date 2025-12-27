import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || 'your-access-secret';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';

export interface AdminTokenPayload {
  adminId: string;
  email: string;
  roleId: string;
}

export interface UserTokenPayload {
  userId: string;
  email: string;
}

export interface EmailVerificationPayload {
  userId: string;
  email: string;
  type: 'email-verification';
}

export class JwtUtil {
  // ============================================
  // ADMIN METHODS (Keep your existing code)
  // ============================================
  static generateAdminAccessToken(payload: AdminTokenPayload): string {
    return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: '7d' });
  }

  static generateAdminRefreshToken(payload: AdminTokenPayload): string {
    return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
  }

  static verifyAdminAccessToken(token: string): AdminTokenPayload {
    return jwt.verify(token, ACCESS_TOKEN_SECRET) as AdminTokenPayload;
  }

  static verifyAdminRefreshToken(token: string): AdminTokenPayload {
    return jwt.verify(token, REFRESH_TOKEN_SECRET) as AdminTokenPayload;
  }

  static generateUserAccessToken(payload: UserTokenPayload): string {
    return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
  }

  static generateUserRefreshToken(payload: UserTokenPayload): string {
    return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
  }

  static verifyUserAccessToken(token: string): UserTokenPayload {
    return jwt.verify(token, ACCESS_TOKEN_SECRET) as UserTokenPayload;
  }

  static verifyUserRefreshToken(token: string): UserTokenPayload {
    return jwt.verify(token, REFRESH_TOKEN_SECRET) as UserTokenPayload;
  }

  // Email verification token
  static generateEmailVerificationToken(userId: string, email: string): string {
    const payload: EmailVerificationPayload = {
      userId,
      email,
      type: 'email-verification',
    };
    return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: '24h' });
  }

  static verifyEmailToken(token: string): EmailVerificationPayload {
    return jwt.verify(token, ACCESS_TOKEN_SECRET) as EmailVerificationPayload;
  }

  // ============================================
  // SHARED UTILITY
  // ============================================
  static getRefreshTokenExpiry(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date;
  }
}
