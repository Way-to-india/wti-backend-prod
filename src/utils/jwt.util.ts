import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || 'your-access-secret';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';

export interface TokenPayload {
  adminId: string;
  email: string;
  roleId: string;
}

export class JwtUtil {
  static generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: '7d' });
  }

  static generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
  }

  static verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, ACCESS_TOKEN_SECRET) as TokenPayload;
  }

  static verifyRefreshToken(token: string): TokenPayload {
    return jwt.verify(token, REFRESH_TOKEN_SECRET) as TokenPayload;
  }

  static getRefreshTokenExpiry(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date;
  }
}
