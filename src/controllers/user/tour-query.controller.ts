import type { Request, Response } from 'express';
import ZohoCRMService from '@/services/zohoCRM.service';
import { BadRequestError } from '@/middlewares/handlers/errorHandler';

export class TourQueryController {

  static async createLead(req: Request, res: Response) {
    try {
      const {
        name,
        email,
        phone,
        numberOfTravellers,
        departureCity,
        specialRequest,
        tourTitle,
        tourId,
        submittedAt,
      } = req.validated?.body || req.body;

      console.log(`📝 Processing lead enquiry for: ${name} (${email})`);

      const zohoService = new ZohoCRMService();

      const existingLeads = await zohoService.searchLeadByEmail(email);

      if (existingLeads && existingLeads.length > 0) {
        const leadId = existingLeads[0].id;
        const existingLeadName = existingLeads[0].Full_Name || name;

        console.log(`📋 Existing lead found: ${leadId}. Adding note for new enquiry.`);

        const noteData = {
          Note_Title: `New Tour Enquiry: ${tourTitle}`,
          Note_Content: `
            Tour Package: ${tourTitle}
            Tour ID: ${tourId}
            Number of Travellers: ${numberOfTravellers}${departureCity ? `\nDeparture City: ${departureCity}` : ''}${
            specialRequest
                        ? `

            Special Request:
            ${specialRequest}`
                        : ''
                    }

            Enquiry Date: ${new Date(submittedAt).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                    })}
          `.trim(),
          Parent_Id: leadId,
          se_module: 'Leads',
        };

        await zohoService.addNoteToLead(leadId, noteData);

        return res.deliver(
          200,
          true,
          {
            leadId: leadId,
            status: 'Updated',
            isExisting: true,
            message: `Enquiry added to existing lead: ${existingLeadName}`,
          },
          'Enquiry added to existing lead successfully'
        );
      }

      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '.';

      const leadData = {
        First_Name: firstName,
        Last_Name: lastName,
        Email: email,
        Phone: phone,
        Company: 'Tour Enquiry',
        Lead_Source: 'Website',
        Lead_Status: 'Not Contacted',
        Description: `
Tour Package: ${tourTitle}
Tour ID: ${tourId}
Number of Travellers: ${numberOfTravellers}${departureCity ? `\nDeparture City: ${departureCity}` : ''}${
          specialRequest
            ? `

Special Request:
${specialRequest}`
            : ''
        }

Enquiry Date: ${new Date(submittedAt).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
        })}
        `.trim(),
      };

      console.log(`✨ Creating new lead in Zoho CRM...`);

      // Create lead in Zoho CRM
      const result = await zohoService.createLead(leadData);

      return res.deliver(
        201,
        true,
        {
          leadId: result.id,
          status: result.status,
          isExisting: false,
        },
        'Lead created successfully in Zoho CRM'
      );
    } catch (error: any) {
      console.error('❌ Error creating Zoho lead:', error);

      // Handle specific error cases
      if (error.message?.includes('INVALID_DATA')) {
        return res.deliver(400, false, undefined, 'Invalid data format for Zoho CRM');
      }

      if (error.message?.includes('DUPLICATE_DATA')) {
        return res.deliver(400, false, undefined, 'Duplicate lead entry detected');
      }

      if (error.message?.includes('authentication') || error.message?.includes('authenticate')) {
        return res.deliver(500, false, undefined, 'Zoho CRM authentication failed');
      }

      return res.deliver(
        500,
        false,
        undefined,
        error.message || 'Failed to create lead in Zoho CRM'
      );
    }
  }


  static async searchLeadByEmail(req: Request, res: Response) {
    try {
      const { email } = req.query;

      if (!email || typeof email !== 'string') {
        return res.deliver(400, false, undefined, 'Email parameter is required');
      }

      const zohoService = new ZohoCRMService();
      const leads = await zohoService.searchLeadByEmail(email);

      return res.deliver(
        200,
        true,
        {
          email,
          leads,
          count: leads.length,
        },
        leads.length > 0 ? 'Leads found' : 'No leads found'
      );
    } catch (error: any) {
      console.error('❌ Error searching leads:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error.message || 'Failed to search leads in Zoho CRM'
      );
    }
  }

  /**
   * Get lead details by ID
   * GET /api/zoho/lead/:id
   */
  static async getLeadById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.deliver(400, false, undefined, 'Lead ID is required');
      }

      const zohoService = new ZohoCRMService();
      const lead = await zohoService.getLeadById(id);

      if (!lead) {
        return res.deliver(404, false, undefined, 'Lead not found');
      }

      return res.deliver(200, true, lead, 'Lead details fetched successfully');
    } catch (error: any) {
      console.error('❌ Error fetching lead details:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error.message || 'Failed to fetch lead details from Zoho CRM'
      );
    }
  }

  /**
   * Update lead
   * PATCH /api/zoho/lead/:id
   */
  static async updateLead(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.deliver(400, false, undefined, 'Lead ID is required');
      }

      if (!updateData || Object.keys(updateData).length === 0) {
        return res.deliver(400, false, undefined, 'Update data is required');
      }

      const zohoService = new ZohoCRMService();
      const success = await zohoService.updateLead(id, updateData);

      if (!success) {
        return res.deliver(400, false, undefined, 'Failed to update lead');
      }

      return res.deliver(200, true, { leadId: id }, 'Lead updated successfully');
    } catch (error: any) {
      console.error('❌ Error updating lead:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error.message || 'Failed to update lead in Zoho CRM'
      );
    }
  }

  /**
   * Add note to lead
   * POST /api/zoho/lead/:id/note
   */
  static async addNoteToLead(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { title, content } = req.body;

      if (!id) {
        return res.deliver(400, false, undefined, 'Lead ID is required');
      }

      if (!title || !content) {
        return res.deliver(400, false, undefined, 'Note title and content are required');
      }

      const noteData = {
        Note_Title: title,
        Note_Content: content,
        Parent_Id: id,
        se_module: 'Leads',
      };

      const zohoService = new ZohoCRMService();
      const success = await zohoService.addNoteToLead(id, noteData);

      if (!success) {
        return res.deliver(400, false, undefined, 'Failed to add note to lead');
      }

      return res.deliver(200, true, { leadId: id }, 'Note added to lead successfully');
    } catch (error: any) {
      console.error('❌ Error adding note to lead:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error.message || 'Failed to add note to lead in Zoho CRM'
      );
    }
  }

  /**
   * Health check for Zoho CRM integration
   * GET /api/zoho/health
   */
  static async healthCheck(req: Request, res: Response) {
    try {
      const zohoService = new ZohoCRMService();

      // Test authentication by searching for a non-existent email
      await zohoService.searchLeadByEmail('health-check-test@example.com');

      return res.deliver(
        200,
        true,
        {
          status: 'healthy',
          service: 'Zoho CRM',
          timestamp: new Date().toISOString(),
        },
        'Zoho CRM integration is healthy'
      );
    } catch (error: any) {
      console.error('❌ Zoho CRM health check failed:', error);
      return res.deliver(
        503,
        false,
        {
          status: 'unhealthy',
          service: 'Zoho CRM',
          timestamp: new Date().toISOString(),
          error: error.message,
        },
        'Zoho CRM integration is not available'
      );
    }
  }
}
