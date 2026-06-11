/**
 * AI Funnel Controller
 *
 * Handles all AI-powered sales funnel endpoints.
 */

import { AIFunnelService } from '@/services/ai/ai-funnel.service';
import type { Request, Response } from 'express';

export class AIFunnelController {

  /**
   * POST /api/admin/ai-funnel/qualify/:leadId
   * AI-qualify a specific lead
   */
  static async qualifyLead(req: Request, res: Response) {
    try {
      const { leadId } = req.params;
      const result = await AIFunnelService.qualifyLead(leadId);
      return res.deliver(200, true, result, 'Lead qualified successfully by AI');
    } catch (error) {
      console.error('[ai-funnel] Qualify error:', error);
      return res.deliver(
        error instanceof Error && 'statusCode' in error ? (error as any).statusCode : 500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to qualify lead'
      );
    }
  }

  /**
   * POST /api/admin/ai-funnel/qualify-batch
   * AI-qualify all unqualified leads
   */
  static async qualifyBatch(req: Request, res: Response) {
    try {
      const result = await AIFunnelService.qualifyUnqualifiedLeads();
      return res.deliver(200, true, result, `Batch qualification complete: ${result.qualified} qualified, ${result.errors} errors`);
    } catch (error) {
      console.error('[ai-funnel] Batch qualify error:', error);
      return res.deliver(500, false, undefined, 'Failed to run batch qualification');
    }
  }

  /**
   * GET /api/admin/ai-funnel/follow-up/:leadId
   * Get AI-suggested follow-up for a lead
   */
  static async suggestFollowUp(req: Request, res: Response) {
    try {
      const { leadId } = req.params;
      const suggestion = await AIFunnelService.suggestFollowUp(leadId);
      return res.deliver(200, true, suggestion, 'Follow-up suggestion generated');
    } catch (error) {
      console.error('[ai-funnel] Follow-up suggestion error:', error);
      return res.deliver(
        error instanceof Error && 'statusCode' in error ? (error as any).statusCode : 500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to generate follow-up suggestion'
      );
    }
  }

  /**
   * GET /api/admin/ai-funnel/daily-briefing
   * Generate today's AI sales briefing
   */
  static async getDailyBriefing(req: Request, res: Response) {
    try {
      const briefing = await AIFunnelService.generateDailyBriefing();
      return res.deliver(200, true, briefing, 'Daily briefing generated');
    } catch (error) {
      console.error('[ai-funnel] Daily briefing error:', error);
      return res.deliver(500, false, undefined, 'Failed to generate daily briefing');
    }
  }

  /**
   * POST /api/admin/ai-funnel/rescore-all
   * Re-score all existing leads (one-time fix)
   */
  static async rescoreAll(req: Request, res: Response) {
    try {
      const result = await AIFunnelService.rescoreAllLeads();
      return res.deliver(200, true, result, `Rescore complete: ${result.updated} updated, ${result.errors} errors`);
    } catch (error) {
      console.error('[ai-funnel] Rescore error:', error);
      return res.deliver(500, false, undefined, 'Failed to rescore leads');
    }
  }

  /**
   * GET /api/admin/ai-funnel/response/:leadId
   * Get AI-generated response for a lead
   */
  static async getLeadResponse(req: Request, res: Response) {
    try {
      const { leadId } = req.params;
      const result = await AIFunnelService.getLeadResponse(leadId);
      return res.deliver(200, true, result, 'Response generated');
    } catch (error) {
      console.error('[ai-funnel] Response generation error:', error);
      return res.deliver(
        error instanceof Error && 'statusCode' in error ? (error as any).statusCode : 500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to generate response'
      );
    }
  }

  /**
   * POST /api/admin/ai-funnel/travel-studio/:leadId
   * Generate Travel Studio itinerary request for a lead
   */
  static async generateTravelStudioRequest(req: Request, res: Response) {
    try {
      const { leadId } = req.params;
      const request = await AIFunnelService.generateTravelStudioRequest(leadId);
      return res.deliver(200, true, request, 'Travel Studio request generated');
    } catch (error) {
      console.error('[ai-funnel] Travel Studio request error:', error);
      return res.deliver(
        error instanceof Error && 'statusCode' in error ? (error as any).statusCode : 500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to generate Travel Studio request'
      );
    }
  }
}
