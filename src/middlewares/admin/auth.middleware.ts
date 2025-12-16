import type { Request, Response, NextFunction } from 'express';
import { JwtUtil } from '@/utils/jwt.util';
import type { TokenPayload } from '@/utils/jwt.util';

declare global {
  namespace Express {
    interface Request {
      admin?: TokenPayload;
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.deliver(401, false, undefined, 'No token provided');
    }

    const token = authHeader.substring(7);
    const decoded = JwtUtil.verifyAccessToken(token);

    req.admin = decoded;
    console.log("middleware");
    next();
  } catch (error) {
    console.log(error);
    return res.deliver(401, false, undefined, 'Invalid or expired token');
  }
};
