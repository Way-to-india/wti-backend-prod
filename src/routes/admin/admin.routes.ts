import { Router } from 'express';
import { AdminController } from '@/controllers/admin/admin.controller';
import { authMiddleware } from '@/middlewares/admin/auth.middleware';
import { checkPermission } from '@/middlewares/permission.middleware';

const router = Router();

router.use(authMiddleware);
  
router.post('/create', checkPermission('Admins', 'create'), AdminController.createAdmin);
router.get('/', checkPermission('Admins', 'view'), AdminController.getAllAdmins);
router.get('/:id', checkPermission('Admins', 'view'), AdminController.getAdminById);
router.put('/:id', checkPermission('Admins', 'edit'), AdminController.updateAdmin);
router.delete('/:id', checkPermission('Admins', 'delete'), AdminController.deleteAdmin);
router.patch(
  '/:id/toggle-status',
  checkPermission('Admins', 'edit'),
  AdminController.toggleAdminStatus
);

export default router;
