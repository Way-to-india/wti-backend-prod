import prisma from '@/config/db';
import type { NextFunction, Request, Response } from 'express';

/**
 * Middleware to check if the authenticated admin has Super Admin role
 * Must be used after authMiddleware
 */
export const checkSuperAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // @ts-ignore - admin is added by authMiddleware
    const adminPayload = req.admin;

    if (!adminPayload || !adminPayload.adminId) {
      return res.deliver(401, false, undefined, 'Authentication required');
    }

    // Fetch full admin details with role
    const admin = await prisma.admin.findUnique({
      where: { id: adminPayload.adminId },
      include: {
        role: true,
      },
    });

    if (!admin) {
      return res.deliver(401, false, undefined, 'Admin not found');
    }

    // Check if admin has Super Admin role
    if (admin.role?.name !== 'Super Admin') {
      return res.deliver(403, false, undefined, 'Access denied. Super Admin privileges required.');
    }

    next();
  } catch (error) {
    console.error('Super admin check error:', error);
    return res.deliver(500, false, undefined, 'Authorization check failed');
  }
};
