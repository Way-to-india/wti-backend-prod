import type { Request, Response } from 'express';
import prisma from '@/config/db';

export class LeadsController {
  /**
   * Get all leads with filters and pagination
   * GET /api/admin/leads
   */
  static async getAllLeads(req: Request, res: Response) {
    try {
      const {
        page = '1',
        limit = '20',
        status,
        source,
        priority,
        search,
        assignedTo,
        startDate,
        endDate,
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};

      if (status) where.status = status;
      if (source) where.source = source;
      if (priority) where.priority = parseInt(priority as string);
      if (assignedTo) where.assignedToId = assignedTo;

      if (search) {
        where.OR = [
          { fullName: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } },
          { phoneNumber: { contains: search as string } },
          { referenceNumber: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate as string);
        if (endDate) where.createdAt.lte = new Date(endDate as string);
      }

      const [leads, total] = await Promise.all([
        prisma.lead.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { createdAt: 'desc' },
          include: {
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        }),
        prisma.lead.count({ where }),
      ]);

      res.deliver(
        200,
        true,
        {
          leads,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
        'Leads fetched successfully'
      );
    } catch (error) {
      console.error('Get Leads Error:', error);
      res.deliver(500, false, null, 'Failed to fetch leads');
    }
  }

  /**
   * Get single lead by ID
   * GET /api/admin/leads/:id
   */
  static async getLeadById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const lead = await prisma.lead.findUnique({
        where: { id },
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          activities: {
            orderBy: { createdAt: 'desc' },
            include: {
              performedBy: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      if (!lead) {
        return res.deliver(404, false, null, 'Lead not found');
      }

      res.deliver(200, true, lead, 'Lead fetched successfully');
    } catch (error) {
      console.error('Get Lead Error:', error);
      res.deliver(500, false, null, 'Failed to fetch lead');
    }
  }

  /**
   * Update lead status
   * PATCH /api/admin/leads/:id/status
   */
  static async updateLeadStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      const adminId = (req as any).admin?.id;

      const lead = await prisma.lead.update({
        where: { id },
        data: {
          status,
          contactedAt: status !== 'NEW' ? new Date() : undefined,
        },
      });

      await prisma.leadActivity.create({
        data: {
          leadId: id,
          activityType: 'STATUS_CHANGED',
          description: `Status changed to ${status}${notes ? `: ${notes}` : ''}`,
          performedById: adminId,
        },
      });

      res.deliver(200, true, lead, 'Lead status updated successfully');
    } catch (error) {
      console.error('Update Lead Status Error:', error);
      res.deliver(500, false, null, 'Failed to update lead status');
    }
  }

  /**
   * Assign lead to admin
   * PATCH /api/admin/leads/:id/assign
   */
  static async assignLead(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { assignedToId } = req.body;
      const adminId = (req as any).admin?.id;

      const lead = await prisma.lead.update({
        where: { id },
        data: {
          assignedToId,
        },
      });

      await prisma.leadActivity.create({
        data: {
          leadId: id,
          activityType: 'ASSIGNED',
          description: `Lead assigned to admin`,
          performedById: adminId,
        },
      });

      res.deliver(200, true, lead, 'Lead assigned successfully');
    } catch (error) {
      console.error('Assign Lead Error:', error);
      res.deliver(500, false, null, 'Failed to assign lead');
    }
  }

  /**
   * Add notes to lead
   * POST /api/admin/leads/:id/notes
   */
  static async addLeadNotes(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const adminId = (req as any).admin?.id;

      const lead = await prisma.lead.update({
        where: { id },
        data: {
          notes: notes,
        },
      });

      await prisma.leadActivity.create({
        data: {
          leadId: id,
          activityType: 'NOTED',
          description: notes,
          performedById: adminId,
        },
      });

      res.deliver(200, true, lead, 'Notes added successfully');
    } catch (error) {
      console.error('Add Notes Error:', error);
      res.deliver(500, false, null, 'Failed to add notes');
    }
  }

  /**
   * Update lead priority
   * PATCH /api/admin/leads/:id/priority
   */
  static async updateLeadPriority(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { priority } = req.body;
      const adminId = (req as any).admin?.id;

      const lead = await prisma.lead.update({
        where: { id },
        data: { priority },
      });

      const priorityLabels = ['Low', 'Medium', 'High'];

      await prisma.leadActivity.create({
        data: {
          leadId: id,
          activityType: 'PRIORITY_CHANGED',
          description: `Priority changed to ${priorityLabels[priority]}`,
          performedById: adminId,
        },
      });

      res.deliver(200, true, lead, 'Priority updated successfully');
    } catch (error) {
      console.error('Update Priority Error:', error);
      res.deliver(500, false, null, 'Failed to update priority');
    }
  }

  /**
   * Add activity to lead (call, email, etc.)
   * POST /api/admin/leads/:id/activity
   */
  static async addLeadActivity(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { activityType, description } = req.body;
      const adminId = (req as any).admin?.id;

      const activity = await prisma.leadActivity.create({
        data: {
          leadId: id,
          activityType,
          description,
          performedById: adminId,
        },
        include: {
          performedBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      res.deliver(200, true, activity, 'Activity added successfully');
    } catch (error) {
      console.error('Add Activity Error:', error);
      res.deliver(500, false, null, 'Failed to add activity');
    }
  }

  /**
   * Get lead statistics
   * GET /api/admin/leads/stats
   */
  static async getLeadStats(req: Request, res: Response) {
    try {
      const { timeRange = '30' } = req.query;
      const days = parseInt(timeRange as string);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [totalLeads, newLeads, contactedLeads, convertedLeads, bySource, byStatus, byPriority] =
        await Promise.all([
          prisma.lead.count(),
          prisma.lead.count({ where: { createdAt: { gte: startDate } } }),
          prisma.lead.count({ where: { status: 'CONTACTED' } }),
          prisma.lead.count({ where: { status: 'CONVERTED' } }),
          prisma.lead.groupBy({
            by: ['source'],
            _count: { id: true },
          }),
          prisma.lead.groupBy({
            by: ['status'],
            _count: { id: true },
          }),
          prisma.lead.groupBy({
            by: ['priority'],
            _count: { id: true },
          }),
        ]);

      const conversionRate =
        totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(2) : '0';

      res.deliver(
        200,
        true,
        {
          overview: {
            total: totalLeads,
            new: newLeads,
            contacted: contactedLeads,
            converted: convertedLeads,
            conversionRate: `${conversionRate}%`,
          },
          distributions: {
            bySource: bySource.map((item) => ({
              source: item.source,
              count: item._count.id,
            })),
            byStatus: byStatus.map((item) => ({
              status: item.status,
              count: item._count.id,
            })),
            byPriority: byPriority.map((item) => ({
              priority: item.priority,
              count: item._count.id,
            })),
          },
          timeRange: `${days} days`,
        },
        'Lead statistics fetched successfully'
      );
    } catch (error) {
      console.error('Get Lead Stats Error:', error);
      res.deliver(500, false, null, 'Failed to fetch lead statistics');
    }
  }

  /**
   * Delete lead
   * DELETE /api/admin/leads/:id
   */
  static async deleteLead(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await prisma.lead.delete({
        where: { id },
      });

      res.deliver(200, true, null, 'Lead deleted successfully');
    } catch (error) {
      console.error('Delete Lead Error:', error);
      res.deliver(500, false, null, 'Failed to delete lead');
    }
  }

  /**
   * Bulk update lead status
   * PATCH /api/admin/leads/bulk/status
   */
  static async bulkUpdateStatus(req: Request, res: Response) {
    try {
      const { leadIds, status } = req.body;
      const adminId = (req as any).admin?.id;

      await prisma.$transaction([
        prisma.lead.updateMany({
          where: { id: { in: leadIds } },
          data: { status },
        }),
        ...leadIds.map((leadId: string) =>
          prisma.leadActivity.create({
            data: {
              leadId,
              activityType: 'STATUS_CHANGED',
              description: `Bulk status update to ${status}`,
              performedById: adminId,
            },
          })
        ),
      ]);

      res.deliver(200, true, null, 'Leads updated successfully');
    } catch (error) {
      console.error('Bulk Update Error:', error);
      res.deliver(500, false, null, 'Failed to bulk update leads');
    }
  }
}

export default LeadsController;
