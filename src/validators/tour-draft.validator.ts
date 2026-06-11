import { z } from 'zod';

export const saveDraftSchema = z.object({
  draftName: z.string().min(3, 'Draft name must be at least 3 characters'),
  draftData: z.record(z.string(), z.any()),
});

export const updateDraftSchema = z.object({
  draftName: z.string().min(3).optional(),
  draftData: z.record(z.string(), z.any()).optional(),
});

export const idParamSchema = z.object({
  id: z.string(),
});

export const searchDraftsSchema = z.object({
  q: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});
