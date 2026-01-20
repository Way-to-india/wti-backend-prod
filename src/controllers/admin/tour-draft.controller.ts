import { TourDraftService } from '@/services/admin/tour-draft.service';
import { Request, Response } from 'express';

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
  static async saveDraft(req: Request, res: Response) {
    try {
      const bodyData = req.validated?.body || req.body;
      const { id } = req.query; // Optional ID for update
      const adminId = req.admin?.id || 'unknown';
      const adminName = req.admin?.name;

      let draft;

      if (id) {
        // Update existing draft
        draft = await TourDraftService.updateDraft(id as string, {
          draftData: bodyData.draftData,
          title: bodyData.title,
        });
      } else {
        // Create new draft
        draft = await TourDraftService.createDraft({
          adminId,
          adminName,
          draftData: bodyData.draftData,
          title: bodyData.title,
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
