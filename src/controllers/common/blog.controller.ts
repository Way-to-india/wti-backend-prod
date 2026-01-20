import { BlogService } from '@/services/admin/blog.service';
import type { Request, Response } from 'express';

export class BlogController {
  /**
   * Get active blogs for public consumption
   */
  static async getActiveBlogs(req: Request, res: Response) {
    try {
      const { limit = '6' } = req.query;
      const blogs = await BlogService.getActiveBlogs(parseInt(limit as string));

      return res.deliver(200, true, { blogs });
    } catch (error) {
      console.error('Error fetching active blogs:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch blogs'
      );
    }
  }

  /**
   * Get featured blogs
   */
  static async getFeaturedBlogs(req: Request, res: Response) {
    try {
      const { limit = '3' } = req.query;
      const blogs = await BlogService.getFeaturedBlogs(parseInt(limit as string));

      return res.deliver(200, true, { blogs });
    } catch (error) {
      console.error('Error fetching featured blogs:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch featured blogs'
      );
    }
  }

  /**
   * Get blog by slug
   */
  static async getBlogBySlug(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const blog = await BlogService.getBlogBySlug(slug);

      return res.deliver(200, true, blog);
    } catch (error) {
      console.error('Error fetching blog:', error);
      return res.deliver(
        404,
        false,
        undefined,
        error instanceof Error ? error.message : 'Blog not found'
      );
    }
  }
}
