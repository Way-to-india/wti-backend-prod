import { TourDraftService } from '@/services/admin/tour-draft.service';
import type { Request, Response } from 'express';

export class TourDraftController {
  /**
   * Get all drafts
   */
  static async getAllDrafts(req: Request, res: Response) {
    try {
      const { page = '1', limit = '20', sortOrder = 'desc' } = req.query;

      const result = await TourDraftService.getAllDrafts(
        parseInt(page as string),
        parseInt(limit as string),
        sortOrder as 'asc' | 'desc'
      );

      return res.deliver(200, true, result);
    } catch (error) {
      console.error('Error fetching drafts:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch drafts'
      );
    }
  }

  /**
   * Get draft by ID
   */
  static async getDraftById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const draft = await TourDraftService.getDraftById(id);

      return res.deliver(200, true, draft);
    } catch (error) {
      console.error('Error fetching draft:', error);
      return res.deliver(
        error instanceof Error && error.message === 'Draft not found' ? 404 : 500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch draft'
      );
    }
  }

  /**
   * Save draft (create or update)
   */
  static async searchDrafts(req: Request, res: Response) {
    try {
      const { q, page, limit, sortBy, sortOrder } = req.query;

      const result = await TourDraftService.searchDrafts(
        q as string,
        parseInt(page as string) || 1,
        parseInt(limit as string) || 20,
        sortBy as 'createdAt' | 'updatedAt',
        sortOrder as 'asc' | 'desc'
      );

      return res.deliver(200, true, result);
    } catch (error) {
      console.error('Error searching drafts:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to search drafts'
      );
    }
  }

  static async uploadImages(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.deliver(400, false, undefined, 'No files uploaded');
      }

      const imageUrls = files.map((file) => {
        return (file as any).location || (file as any).key;
      });

      return res.deliver(200, true, { images: imageUrls }, 'Images uploaded successfully');
    } catch (error) {
      console.error('Error uploading draft images:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to upload images'
      );
    }
  }

  /**
   * Save draft (create or update)
   */
  static async saveDraft(req: Request, res: Response) {
    try {
      const bodyData = req.validated?.body || req.body;
      const { id } = req.query;
      const adminId = req.admin?.adminId || 'unknown';
      const adminName = req.admin?.email;

      let draft;

      if (id) {
        draft = await TourDraftService.updateDraft(id as string, {
          draftData: bodyData.draftData,
          draftName: bodyData.draftName,
        });
      } else {
        draft = await TourDraftService.createDraft({
          adminId,
          adminName,
          draftData: bodyData.draftData,
          draftName: bodyData.draftName,
        });
      }

      return res.deliver(
        id ? 200 : 201,
        true,
        draft,
        id ? 'Draft updated successfully' : 'Draft saved successfully'
      );
    } catch (error) {
      console.error('Error saving draft:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to save draft'
      );
    }
  }

  /**
   * Delete draft
   */
  static async deleteDraft(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await TourDraftService.deleteDraft(id);

      return res.deliver(200, true, undefined, 'Draft deleted successfully');
    } catch (error) {
      console.error('Error deleting draft:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to delete draft'
      );
    }
  }
}
