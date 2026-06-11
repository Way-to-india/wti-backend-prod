import { Router } from 'express';
import { uploadSingleImage } from '@/middlewares/multer';
import { authMiddleware } from '@/middlewares/admin/auth.middleware';
import { checkPermission } from '@/middlewares/permission.middleware';
import { UploadController } from '@/controllers/admin/upload.controller';

const router = Router();
router.use(authMiddleware);

// POST /api/admin/upload/image  (multipart, field "image")  -> { url }
router.post('/image', checkPermission('Tours', 'edit'), uploadSingleImage, UploadController.uploadImage);

export default router;
