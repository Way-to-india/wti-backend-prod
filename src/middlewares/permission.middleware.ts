import type { Request, Response, NextFunction } from 'express';
import prisma from '@/config/db';

type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

export const checkPermission = (moduleName: string, action: PermissionAction): any => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roleId = req.admin?.roleId;

      if (!roleId) {
        return res.deliver(401, false, undefined, 'Unauthorized');
      }

      const permission = await prisma.permission.findFirst({
        where: {
          roleId,
          module: { name: moduleName },
        },
      });

      if (!permission || !permission[action]) {
        return res.deliver(
          403,
          false,
          undefined,
          'You do not have permission to perform this action'
        );
      }
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.deliver(500, false, undefined, 'Permission check failed');
    }
  };
};
