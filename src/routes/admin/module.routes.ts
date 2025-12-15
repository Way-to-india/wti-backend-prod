import { Router } from 'express';
import { ModuleController } from '@/controllers/admin/module.controller';
import { authMiddleware } from '@/middlewares/admin/auth.middleware';
import { checkPermission } from '@/middlewares/permission.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/', checkPermission('Modules', 'create'), ModuleController.createModule);
router.get('/', checkPermission('Modules', 'view'), ModuleController.getAllModules);
router.get('/:id', checkPermission('Modules', 'view'), ModuleController.getModuleById);
router.put('/:id', checkPermission('Modules', 'edit'), ModuleController.updateModule);
router.delete('/:id', checkPermission('Modules', 'delete'), ModuleController.deleteModule);

export default router;
