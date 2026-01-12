import { PermissionController } from '@/controllers/admin/permission.controller';
import { authMiddleware } from '@/middlewares/admin/auth.middleware';
import { checkSuperAdmin } from '@/middlewares/super-admin.middleware';
import { Router } from 'express';

const router = Router();

// All routes require authentication and super admin privileges
router.use(authMiddleware);
router.use(checkSuperAdmin);

router.post('/', PermissionController.setPermissions);

router.get('/role/:roleId', PermissionController.getPermissionsByRole);

router.delete('/:roleId/:moduleId', PermissionController.deletePermission);

export default router;
