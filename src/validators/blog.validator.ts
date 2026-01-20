import { z } from 'zod';

export const createBlogSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  slug: z.string().min(1, 'Slug is required').max(300),
  excerpt: z.string().max(500).optional(),
  content: z.string().optional(),
  author: z.string().max(150).default('Way to India'),
  ctaText: z.string().max(100).default('Read More'),
  ctaLink: z.string().max(500).optional().nullable(),
  isActive: z
    .union([z.boolean(), z.string()])
    .transform((val) => val === true || val === 'true')
    .default(true),
  isFeatured: z
    .union([z.boolean(), z.string()])
    .transform((val) => val === true || val === 'true')
    .default(false),
  order: z
    .union([z.number(), z.string()])
    .transform((val) => (typeof val === 'string' ? parseInt(val) : val))
    .pipe(z.number().int().min(0).max(32767))
    .default(0),
  publishedAt: z.string().optional(),
});

export const updateBlogSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    slug: z.string().min(1).max(300).optional(),
    excerpt: z.string().max(500).optional(),
    content: z.string().optional(),
    author: z.string().max(150).optional(),
    ctaText: z.string().max(100).optional(),
    ctaLink: z.string().max(500).optional().nullable(),
    isActive: z
      .union([z.boolean(), z.string()])
      .transform((val) => val === true || val === 'true')
      .optional(),
    isFeatured: z
      .union([z.boolean(), z.string()])
      .transform((val) => val === true || val === 'true')
      .optional(),
    order: z
      .union([z.number(), z.string()])
      .transform((val) => (typeof val === 'string' ? parseInt(val) : val))
      .pipe(z.number().int().min(0).max(32767))
      .optional(),
    publishedAt: z.string().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const reorderBlogsSchema = z.object({
  blogs: z
    .array(
      z.object({
        id: z.string().min(1, 'Blog ID is required'),
        order: z.number().int().min(0).max(32767),
      })
    )
    .min(1, 'At least one blog is required'),
});

export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

export const slugParamSchema = z.object({
  slug: z.string().min(1, 'Slug is required'),
});
