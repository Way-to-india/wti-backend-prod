import type { Request, Response, NextFunction } from 'express';
import prisma from '@/config/db';
import { JwtUtil } from '@/utils/jwt.util';

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.deliver(401, false, undefined, 'No token provided');
    }

    const token = authHeader.substring(7);

    try {
        
      const decoded = JwtUtil.verifyUserAccessToken(token);

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          isActive: true,
          isPhoneVerified: true,
        },
      });

      if (!user) {
        return res.deliver(401, false, undefined, 'User not found');
      }

      if (!user.isActive) {
        return res.deliver(401, false, undefined, 'Account is inactive');
      }

      req.user = {
        userId: user.id,
        email: user.email,
        isEmailVerified: user.isPhoneVerified,
      };

      next();
    } catch (error) {
      return res.deliver(401, false, undefined, 'Invalid or expired token');
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.deliver(500, false, undefined, 'Authentication error');
  }
};
