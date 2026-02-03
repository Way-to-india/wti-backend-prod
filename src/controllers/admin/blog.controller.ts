import { S3Folder } from '@/common/constants';
import { BlogService } from '@/services/admin/blog.service';
import { deleteImagesFromS3, uploadImageToS3 } from '@/utils/s3';
import type { Request, Response } from 'express';

export class BlogController {
  /**
   * Get all blogs (admin)
   */
  static async getAllBlogs(req: Request, res: Response) {
    try {
      const { page = '1', limit = '10', sortBy = 'publishedAt', sortOrder = 'desc' } = req.query;

      const result = await BlogService.getAllBlogs(
        parseInt(page as string),
        parseInt(limit as string),
        sortBy as string,
        sortOrder as string
      );

      return res.deliver(200, true, result);
    } catch (error) {
      console.error('Error fetching blogs:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch blogs'
      );
    }
  }

  /**
   * Get blog by ID
   */
  static async getBlogById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const blog = await BlogService.getBlogById(id);

      return res.deliver(200, true, blog);
    } catch (error) {
      console.error('Error fetching blog:', error);
      return res.deliver(
        404,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch blog'
      );
    }
  }

  /**
   * Create a new blog
   */
  static async createBlog(req: Request, res: Response) {
    try {
      console.log('📝 Creating blog...');

      const bodyData = req.validated?.body || req.body;
      const file = req.file;

      if (!file) {
        return res.deliver(400, false, undefined, 'Image is required');
      }

      // Upload image to S3
      const imageKey = await uploadImageToS3(file, S3Folder.TOUR_IMAGES);
      const imageUrl = `${process.env.AWS_CLOUDFRONT_ENDPOINT}/${imageKey}`;

      const blog = await BlogService.createBlog({
        title: bodyData.title,
        slug: bodyData.slug,
        excerpt: bodyData.excerpt,
        content: bodyData.content,
        author: bodyData.author,
        imageKey,
        imageUrl,
        ctaText: bodyData.ctaText,
        ctaLink: bodyData.ctaLink,
        isActive: bodyData.isActive,
        isFeatured: bodyData.isFeatured,
        order: bodyData.order,
        publishedAt: bodyData.publishedAt ? new Date(bodyData.publishedAt) : undefined,
      });

      console.log('✅ Blog created successfully:', blog.id);
      return res.deliver(201, true, blog, 'Blog created successfully');
    } catch (error) {
      console.error('❌ Error creating blog:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to create blog'
      );
    }
  }

  /**
   * Update a blog
   */
  static async updateBlog(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const bodyData = req.validated?.body || req.body;
      const file = req.file;

      console.log('🔄 Updating blog:', id);

      const updateData: any = { ...bodyData };

      // Handle image update if new file is uploaded
      if (file) {
        const existingBlog = await BlogService.getBlogById(id);

        const imageKey = await uploadImageToS3(file, S3Folder.TOUR_IMAGES);
        const imageUrl = `${process.env.AWS_CLOUDFRONT_ENDPOINT}/${imageKey}`;

        updateData.imageKey = imageKey;
        updateData.imageUrl = imageUrl;

        // Delete old image
        if (existingBlog.imageKey) {
          await deleteImagesFromS3([existingBlog.imageKey]);
        }
      }

      // Handle publishedAt date conversion
      if (updateData.publishedAt) {
        updateData.publishedAt = new Date(updateData.publishedAt);
      }

      const blog = await BlogService.updateBlog(id, updateData);

      console.log('✅ Blog updated successfully');
      return res.deliver(200, true, blog, 'Blog updated successfully');
    } catch (error) {
      console.error('❌ Error updating blog:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to update blog'
      );
    }
  }

  /**
   * Delete a blog
   */
  static async deleteBlog(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const imageKey = await BlogService.deleteBlog(id);

      // Delete image from S3
      if (imageKey) {
        await deleteImagesFromS3([imageKey]);
      }

      return res.deliver(200, true, undefined, 'Blog deleted successfully');
    } catch (error) {
      console.error('Error deleting blog:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to delete blog'
      );
    }
  }

  /**
   * Reorder blogs
   */
  static async reorderBlogs(req: Request, res: Response) {
    try {
      const bodyData = req.validated?.body || req.body;
      const { blogs } = bodyData;

      const updatedBlogs = await BlogService.updateBlogOrders(blogs);

      return res.deliver(200, true, updatedBlogs, 'Blogs reordered successfully');
    } catch (error) {
      console.error('Error reordering blogs:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to reorder blogs'
      );
    }
  }
}
