import { z } from 'zod';

export const saveDraftSchema = z.object({
  draftData: z.record(z.string(), z.any()),
  title: z.string().optional(),
});

export const updateDraftSchema = z.object({
  draftData: z.record(z.string(), z.any()).optional(),
  title: z.string().optional(),
});

export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});
