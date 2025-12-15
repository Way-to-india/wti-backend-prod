import { Router } from 'express';
import { PermissionController } from '@/controllers/admin/permission.controller';
import { authMiddleware } from '@/middlewares/admin/auth.middleware';
import { checkPermission } from '@/middlewares/permission.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/', checkPermission('Permissions', 'create'), PermissionController.setPermissions);
router.get(
  '/role/:roleId',
  checkPermission('Permissions', 'view'),
  PermissionController.getPermissionsByRole
);
router.delete(
  '/:roleId/:moduleId',
  checkPermission('Permissions', 'delete'),
  PermissionController.deletePermission
);

export default router;
