import { TourDraftController } from '@/controllers/admin/tour-draft.controller';
import { authMiddleware } from '@/middlewares/admin/auth.middleware';
import { checkPermission } from '@/middlewares/permission.middleware';
import { validate } from '@/middlewares/validation.middleware';
import { idParamSchema, saveDraftSchema } from '@/validators/tour-draft.validator';
import { Router } from 'express';

const router = Router();

router.use(authMiddleware);

router.get('/', checkPermission('Tours', 'view'), TourDraftController.getAllDrafts);

router.get(
  '/view/:id',
  checkPermission('Tours', 'view'),
  validate(idParamSchema, 'params'),
  TourDraftController.getDraftById
);

router.post(
  '/save',
  checkPermission('Tours', 'create'),
  validate(saveDraftSchema, 'body'),
  TourDraftController.saveDraft
);

router.delete(
  '/delete/:id',
  checkPermission('Tours', 'delete'),
  validate(idParamSchema, 'params'),
  TourDraftController.deleteDraft
);

export default router;
