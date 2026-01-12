import { ModuleController } from '@/controllers/admin/module.controller';
import { authMiddleware } from '@/middlewares/admin/auth.middleware';
import { checkSuperAdmin } from '@/middlewares/super-admin.middleware';
import { Router } from 'express';

const router = Router();

// All routes require authentication and super admin privileges
router.use(authMiddleware);
router.use(checkSuperAdmin);

router.post('/', ModuleController.createModule);

router.get('/', ModuleController.getAllModules);

router.get('/:id', ModuleController.getModuleById);

router.put('/:id', ModuleController.updateModule);

router.delete('/:id', ModuleController.deleteModule);

export default router;
