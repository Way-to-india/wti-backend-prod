import { Router } from 'express';
import { RoleController } from '@/controllers/admin/role.controller';
import { authMiddleware } from '@/middlewares/admin/auth.middleware';
import { checkPermission } from '@/middlewares/permission.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/', checkPermission('Roles', 'create'), RoleController.createRole);
router.get('/', checkPermission('Roles', 'view'), RoleController.getAllRoles);
router.get('/:id', checkPermission('Roles', 'view'), RoleController.getRoleById);
router.put('/:id', checkPermission('Roles', 'edit'), RoleController.updateRole);
router.delete('/:id', checkPermission('Roles', 'delete'), RoleController.deleteRole);

export default router;
