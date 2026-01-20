import { BlogController } from '@/controllers/admin/blog.controller';
import { authMiddleware } from '@/middlewares/admin/auth.middleware';
import upload from '@/middlewares/multer';
import { checkPermission } from '@/middlewares/permission.middleware';
import { validate } from '@/middlewares/validation.middleware';
import {
  createBlogSchema,
  reorderBlogsSchema,
  updateBlogSchema,
} from '@/validators/blog.validator';
import { Router } from 'express';

const router = Router();

router.use(authMiddleware);

router.get(
  '/',
  // checkPermission('Blog', 'view'),
  BlogController.getAllBlogs
);

router.get('/view/:id', checkPermission('Blog', 'view'), BlogController.getBlogById);

router.post(
  '/create',
  checkPermission('Blog', 'create'),
  upload.single('image'),
  validate(createBlogSchema, 'body'),
  BlogController.createBlog
);

router.put(
  '/edit/:id',
  checkPermission('Blog', 'edit'),
  upload.single('image'),
  validate(updateBlogSchema, 'body'),
  BlogController.updateBlog
);

router.delete('/delete/:id', checkPermission('Blog', 'delete'), BlogController.deleteBlog);

router.patch(
  '/reorder',
  checkPermission('Blog', 'edit'),
  validate(reorderBlogsSchema, 'body'),
  BlogController.reorderBlogs
);

export default router;
