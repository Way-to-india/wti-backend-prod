import { BlogController } from '@/controllers/common/blog.controller';
import { Router } from 'express';

const router = Router();

// Get active blogs for public display
router.get('/', BlogController.getActiveBlogs);

// Get featured blogs
router.get('/featured', BlogController.getFeaturedBlogs);

// Get blog by slug
router.get('/:slug', BlogController.getBlogBySlug);

export default router;
