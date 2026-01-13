import { LeadAnalyticsService } from '@/services/admin/lead-analytics.service';
import { LeadCommunicationService } from '@/services/admin/lead-communication.service';
import { LeadConfigService } from '@/services/admin/lead-config.service';
import { LeadCRMService } from '@/services/admin/lead-crm.service';
import { LeadNoteService } from '@/services/admin/lead-note.service';
import { LeadQuotationService } from '@/services/admin/lead-quotation.service';
import { LeadReminderService } from '@/services/admin/lead-reminder.service';
import type { Request, Response } from 'express';

export class LeadCRMController {
  /**
   * Get all leads with filters and pagination
   */
  static async getAllLeads(req: Request, res: Response) {
    try {
      const {
        page = '1',
        limit = '20',
        sortBy = 'createdAt',
        sortOrder = 'desc',
        ...filters
      } = req.query;

      const result = await LeadCRMService.getAllLeads(
        parseInt(page as string),
        parseInt(limit as string),
        filters as any,
        sortBy as string,
        sortOrder as 'asc' | 'desc'
      );

      return res.deliver(200, true, result);
    } catch (error) {
      console.error('Error fetching leads:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch leads'
      );
    }
  }

  /**
   * Get lead by ID with full details
   */
  static async getLeadById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const lead = await LeadCRMService.getLeadById(id);

      return res.deliver(200, true, lead);
    } catch (error) {
      console.error('Error fetching lead:', error);
      return res.deliver(
        404,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch lead'
      );
    }
  }

  /**
   * Create new lead
   */
  static async createLead(req: Request, res: Response) {
    try {
      const bodyData = req.validated?.body || req.body;
      const createdById = req.admin?.adminId;

      const lead = await LeadCRMService.createLead(bodyData, createdById);

      console.log('✅ Lead created successfully:', lead.referenceNumber);
      return res.deliver(201, true, lead, 'Lead created successfully');
    } catch (error) {
      console.error('❌ Error creating lead:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to create lead'
      );
    }
  }

  /**
   * Update lead
   */
  static async updateLead(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const bodyData = req.validated?.body || req.body;
      const updatedById = req.admin?.adminId;

      if (!bodyData || Object.keys(bodyData).length === 0) {
        return res.deliver(400, false, undefined, 'No data provided for update');
      }

      const lead = await LeadCRMService.updateLead(id, bodyData, updatedById!);

      console.log('✅ Lead updated successfully:', lead.referenceNumber);
      return res.deliver(200, true, lead, 'Lead updated successfully');
    } catch (error) {
      console.error('❌ Error updating lead:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to update lead'
      );
    }
  }

  /**
   * Assign lead to admin
   */
  static async assignLead(req: Request, res: Response) {
    try {
      const bodyData = req.validated?.body || req.body;
      const { leadId, assignedToId, notes } = bodyData;
      const assignedById = req.admin?.adminId;

      const lead = await LeadCRMService.assignLead(leadId, assignedToId, assignedById!, notes);

      return res.deliver(200, true, lead, 'Lead assigned successfully');
    } catch (error) {
      console.error('Error assigning lead:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to assign lead'
      );
    }
  }

  /**
   * Update lead status
   */
  static async updateLeadStatus(req: Request, res: Response) {
    try {
      const bodyData = req.validated?.body || req.body;
      const { leadId, status, tagId, notes } = bodyData;
      const updatedById = req.admin?.adminId;

      const lead = await LeadCRMService.updateLeadStatus(
        leadId,
        status,
        tagId,
        updatedById!,
        notes
      );

      return res.deliver(200, true, lead, 'Lead status updated successfully');
    } catch (error) {
      console.error('Error updating lead status:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to update lead status'
      );
    }
  }

  /**
   * Delete lead
   */
  static async deleteLead(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const deletedById = req.admin?.adminId;

      const result = await LeadCRMService.deleteLead(id, deletedById!);

      return res.deliver(200, true, result, 'Lead deleted successfully');
    } catch (error) {
      console.error('Error deleting lead:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to delete lead'
      );
    }
  }

  /**
   * Bulk create leads
   */
  static async bulkCreateLeads(req: Request, res: Response) {
    try {
      const bodyData = req.validated?.body || req.body;
      const { leads } = bodyData;
      const createdById = req.admin?.adminId;

      const result = await LeadCRMService.bulkCreateLeads(leads, createdById!);

      return res.deliver(
        201,
        true,
        result,
        `Bulk upload completed. ${result.successful.length} successful, ${result.failed.length} failed`
      );
    } catch (error) {
      console.error('Error bulk creating leads:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to bulk create leads'
      );
    }
  }

  // ============================================
  // NOTES
  // ============================================

  /**
   * Add note to lead
   */
  static async addNote(req: Request, res: Response) {
    try {
      const bodyData = req.validated?.body || req.body;
      const createdById = req.admin?.adminId;

      const note = await LeadNoteService.addNote({
        ...bodyData,
        createdById: createdById!,
      });

      return res.deliver(201, true, note, 'Note added successfully');
    } catch (error) {
      console.error('Error adding note:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to add note'
      );
    }
  }

  /**
   * Get notes for lead
   */
  static async getNotesByLeadId(req: Request, res: Response) {
    try {
      const { leadId } = req.params;
      const notes = await LeadNoteService.getNotesByLeadId(leadId);

      return res.deliver(200, true, notes);
    } catch (error) {
      console.error('Error fetching notes:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch notes'
      );
    }
  }

  /**
   * Update note
   */
  static async updateNote(req: Request, res: Response) {
    try {
      const bodyData = req.validated?.body || req.body;
      const note = await LeadNoteService.updateNote(bodyData);

      return res.deliver(200, true, note, 'Note updated successfully');
    } catch (error) {
      console.error('Error updating note:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to update note'
      );
    }
  }

  /**
   * Delete note
   */
  static async deleteNote(req: Request, res: Response) {
    try {
      const { noteId } = req.params;
      const result = await LeadNoteService.deleteNote(noteId);

      return res.deliver(200, true, result, 'Note deleted successfully');
    } catch (error) {
      console.error('Error deleting note:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to delete note'
      );
    }
  }

  // ============================================
  // REMINDERS
  // ============================================

  /**
   * Create reminder
   */
  static async createReminder(req: Request, res: Response) {
    try {
      const bodyData = req.validated?.body || req.body;
      const createdById = req.admin?.adminId;

      const reminder = await LeadReminderService.createReminder({
        ...bodyData,
        createdById: createdById!,
      });

      return res.deliver(201, true, reminder, 'Reminder created successfully');
    } catch (error) {
      console.error('Error creating reminder:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to create reminder'
      );
    }
  }

  /**
   * Get today's follow-ups
   */
  static async getTodaysFollowups(req: Request, res: Response) {
    try {
      const adminId = req.admin?.adminId;
      const reminders = await LeadReminderService.getTodaysFollowups(adminId!);

      return res.deliver(200, true, reminders);
    } catch (error) {
      console.error("Error fetching today's follow-ups:", error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch follow-ups'
      );
    }
  }

  /**
   * Get overdue follow-ups
   */
  static async getOverdueFollowups(req: Request, res: Response) {
    try {
      const adminId = req.admin?.adminId;
      const reminders = await LeadReminderService.getOverdueFollowups(adminId!);

      return res.deliver(200, true, reminders);
    } catch (error) {
      console.error('Error fetching overdue follow-ups:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch overdue follow-ups'
      );
    }
  }

  /**
   * Complete reminder
   */
  static async completeReminder(req: Request, res: Response) {
    try {
      const bodyData = req.validated?.body || req.body;
      const { reminderId, notes } = bodyData;

      const reminder = await LeadReminderService.completeReminder(reminderId, notes);

      return res.deliver(200, true, reminder, 'Follow-up completed successfully');
    } catch (error) {
      console.error('Error completing reminder:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to complete reminder'
      );
    }
  }

  /**
   * Snooze reminder
   */
  static async snoozeReminder(req: Request, res: Response) {
    try {
      const bodyData = req.validated?.body || req.body;
      const reminder = await LeadReminderService.snoozeReminder(bodyData);

      return res.deliver(200, true, reminder, 'Reminder snoozed successfully');
    } catch (error) {
      console.error('Error snoozing reminder:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to snooze reminder'
      );
    }
  }

  // ============================================
  // QUOTATIONS
  // ============================================

  /**
   * Upload quotation
   */
  static async uploadQuotation(req: Request, res: Response) {
    try {
      const bodyData = req.validated?.body || req.body;
      const uploadedById = req.admin?.adminId;

      const quotation = await LeadQuotationService.uploadQuotation({
        ...bodyData,
        uploadedById: uploadedById!,
      });

      return res.deliver(201, true, quotation, 'Quotation uploaded successfully');
    } catch (error) {
      console.error('Error uploading quotation:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to upload quotation'
      );
    }
  }

  /**
   * Get quotations for lead
   */
  static async getQuotationsByLeadId(req: Request, res: Response) {
    try {
      const { leadId } = req.params;
      const quotations = await LeadQuotationService.getQuotationsByLeadId(leadId);

      return res.deliver(200, true, quotations);
    } catch (error) {
      console.error('Error fetching quotations:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch quotations'
      );
    }
  }

  /**
   * Mark quotation as accepted
   */
  static async markQuotationAccepted(req: Request, res: Response) {
    try {
      const bodyData = req.validated?.body || req.body;
      const { quotationId } = bodyData;
      const acceptedById = req.admin?.adminId;

      const quotation = await LeadQuotationService.markQuotationAccepted(
        quotationId,
        acceptedById!
      );

      return res.deliver(200, true, quotation, 'Quotation marked as accepted');
    } catch (error) {
      console.error('Error marking quotation as accepted:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to mark quotation as accepted'
      );
    }
  }

  // ============================================
  // COMMUNICATIONS
  // ============================================

  /**
   * Log communication
   */
  static async logCommunication(req: Request, res: Response) {
    try {
      const bodyData = req.validated?.body || req.body;
      const performedById = req.admin?.adminId;

      const communication = await LeadCommunicationService.logCommunication({
        ...bodyData,
        performedById: performedById!,
      });

      return res.deliver(201, true, communication, 'Communication logged successfully');
    } catch (error) {
      console.error('Error logging communication:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to log communication'
      );
    }
  }

  /**
   * Get communications for lead
   */
  static async getCommunicationsByLeadId(req: Request, res: Response) {
    try {
      const { leadId } = req.params;
      const communications = await LeadCommunicationService.getCommunicationsByLeadId(leadId);

      return res.deliver(200, true, communications);
    } catch (error) {
      console.error('Error fetching communications:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch communications'
      );
    }
  }

  // ============================================
  // CONFIGURATION
  // ============================================

  /**
   * Get all configuration
   */
  static async getAllConfig(req: Request, res: Response) {
    try {
      const config = await LeadConfigService.getAllConfig();
      return res.deliver(200, true, config);
    } catch (error) {
      console.error('Error fetching configuration:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch configuration'
      );
    }
  }

  /**
   * Create lead tag
   */
  static async createLeadTag(req: Request, res: Response) {
    try {
      const bodyData = req.validated?.body || req.body;
      const tag = await LeadConfigService.createLeadTag(bodyData);

      return res.deliver(201, true, tag, 'Lead tag created successfully');
    } catch (error) {
      console.error('Error creating lead tag:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to create lead tag'
      );
    }
  }

  /**
   * Get all lead tags
   */
  static async getAllLeadTags(req: Request, res: Response) {
    try {
      const { includeInactive } = req.query;
      const tags = await LeadConfigService.getAllLeadTags(includeInactive === 'true');

      return res.deliver(200, true, tags);
    } catch (error) {
      console.error('Error fetching lead tags:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch lead tags'
      );
    }
  }

  /**
   * Update lead tag
   */
  static async updateLeadTag(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const bodyData = req.validated?.body || req.body;
      const tag = await LeadConfigService.updateLeadTag(id, bodyData);

      return res.deliver(200, true, tag, 'Lead tag updated successfully');
    } catch (error) {
      console.error('Error updating lead tag:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to update lead tag'
      );
    }
  }

  /**
   * Delete lead tag
   */
  static async deleteLeadTag(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await LeadConfigService.deleteLeadTag(id);

      return res.deliver(200, true, result, 'Lead tag deleted successfully');
    } catch (error) {
      console.error('Error deleting lead tag:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to delete lead tag'
      );
    }
  }

  // Similar methods for LeadSource and LeadCategory...
  // (I'll create separate controller files for better organization)

  // ============================================
  // ANALYTICS
  // ============================================

  /**
   * Get dashboard summary
   */
  static async getDashboardSummary(req: Request, res: Response) {
    try {
      const adminId = req.admin?.adminId;
      const summary = await LeadAnalyticsService.getDashboardSummary(adminId);

      return res.deliver(200, true, summary);
    } catch (error) {
      console.error('Error fetching dashboard summary:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch dashboard summary'
      );
    }
  }

  /**
   * Get conversion metrics
   */
  static async getConversionMetrics(req: Request, res: Response) {
    try {
      const filters = req.query;
      const metrics = await LeadAnalyticsService.getConversionMetrics(filters as any);

      return res.deliver(200, true, metrics);
    } catch (error) {
      console.error('Error fetching conversion metrics:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch conversion metrics'
      );
    }
  }

  /**
   * Get admin performance
   */
  static async getAdminPerformance(req: Request, res: Response) {
    try {
      const { adminId, ...dateRange } = req.query;
      const performance = await LeadAnalyticsService.getAdminPerformance(
        adminId as string,
        dateRange as any
      );

      return res.deliver(200, true, performance);
    } catch (error) {
      console.error('Error fetching admin performance:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch admin performance'
      );
    }
  }

  /**
   * Get source ROI
   */
  static async getSourceROI(req: Request, res: Response) {
    try {
      const dateRange = req.query;
      const roi = await LeadAnalyticsService.getSourceROI(dateRange as any);

      return res.deliver(200, true, roi);
    } catch (error) {
      console.error('Error fetching source ROI:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch source ROI'
      );
    }
  }

  /**
   * Get lead pipeline
   */
  static async getLeadPipeline(req: Request, res: Response) {
    try {
      const { adminId, ...dateRange } = req.query;
      const pipeline = await LeadAnalyticsService.getLeadPipeline(
        adminId as string,
        dateRange as any
      );

      return res.deliver(200, true, pipeline);
    } catch (error) {
      console.error('Error fetching lead pipeline:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch lead pipeline'
      );
    }
  }
}
