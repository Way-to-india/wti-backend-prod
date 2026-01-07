import { z } from 'zod';

export const createHeroSlideSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  subtitle: z.string().max(500).optional().nullable(),
  location: z.string().max(150).optional().nullable(),
  duration: z.string().max(100).optional().nullable(),
  ctaText: z.string().max(100).default('Explore Tours'),
  ctaLink: z.string().max(500).default('/india-tour-packages'),
  isActive: z.boolean().default(true),
  order: z.number().int().min(0).max(32767).default(0),
});

export const updateHeroSlideSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    subtitle: z.string().max(500).optional().nullable(),
    location: z.string().max(150).optional().nullable(),
    duration: z.string().max(100).optional().nullable(),
    ctaText: z.string().max(100).optional(),
    ctaLink: z.string().max(500).optional(),
    isActive: z.boolean().optional(),
    order: z.number().int().min(0).max(32767).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const reorderHeroSlidesSchema = z.object({
  slides: z
    .array(
      z.object({
        id: z.string().min(1, 'Slide ID is required'),
        order: z.number().int().min(0).max(32767),
      })
    )
    .min(1, 'At least one slide is required'),
});

export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});
