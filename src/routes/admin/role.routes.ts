import { RoleController } from '@/controllers/admin/role.controller';
import { authMiddleware } from '@/middlewares/admin/auth.middleware';
import { checkSuperAdmin } from '@/middlewares/super-admin.middleware';
import { Router } from 'express';

const router = Router();

// All routes require authentication and super admin privileges
router.use(authMiddleware);
router.use(checkSuperAdmin);

router.post('/', RoleController.createRole);

router.get('/', RoleController.getAllRoles);

router.get('/:id', RoleController.getRoleById);

router.put('/:id', RoleController.updateRole);

router.delete('/:id', RoleController.deleteRole);

export default router;
