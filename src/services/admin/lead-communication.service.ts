import prisma from '@/config/db';

interface LogCommunicationInput {
  leadId: string;
  type: 'CALL' | 'EMAIL' | 'WHATSAPP' | 'SMS' | 'MEETING' | 'OTHER';
  direction: 'INBOUND' | 'OUTBOUND';
  subject?: string | null;
  content?: string | null;
  duration?: number | null;
  status?: string | null;
  metadata?: any;
  performedById: string;
}

export class LeadCommunicationService {
  /**
   * Log communication
   */
  static async logCommunication(data: LogCommunicationInput) {
    const lead = await prisma.lead.findUnique({ where: { id: data.leadId } });

    if (!lead) {
      throw new Error('Lead not found');
    }

    const communication = await prisma.leadCommunication.create({
      data: {
        leadId: data.leadId,
        type: data.type as any,
        direction: data.direction as any,
        subject: data.subject,
        content: data.content,
        duration: data.duration,
        status: data.status,
        metadata: data.metadata,
        performedById: data.performedById,
      },
      include: {
        performedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Update lead's last activity and contacted date
    const updateData: any = {
      lastActivityAt: new Date(),
    };

    // If this is the first contact, update contactedAt and calculate response time
    if (!lead.contactedAt) {
      updateData.contactedAt = new Date();
      updateData.firstResponseAt = new Date();

      const responseTimeMs = new Date().getTime() - lead.createdAt.getTime();
      updateData.responseTimeMinutes = Math.round(responseTimeMs / (1000 * 60));
    }

    await prisma.lead.update({
      where: { id: data.leadId },
      data: updateData,
    });

    // Create activity log
    const activityDescription = this.generateActivityDescription(data);
    await prisma.leadActivity.create({
      data: {
        leadId: data.leadId,
        activityType: `COMMUNICATION_${data.type}`,
        description: activityDescription,
        performedById: data.performedById,
        metadata: {
          communicationType: data.type,
          direction: data.direction,
        },
      },
    });

    return communication;
  }

  /**
   * Get communication history for a lead
   */
  static async getCommunicationsByLeadId(leadId: string) {
    const communications = await prisma.leadCommunication.findMany({
      where: { leadId },
      include: {
        performedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return communications;
  }

  /**
   * Get communication by ID
   */
  static async getCommunicationById(communicationId: string) {
    const communication = await prisma.leadCommunication.findUnique({
      where: { id: communicationId },
      include: {
        lead: true,
        performedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!communication) {
      throw new Error('Communication not found');
    }

    return communication;
  }

  /**
   * Delete communication
   */
  static async deleteCommunication(communicationId: string) {
    const communication = await prisma.leadCommunication.findUnique({
      where: { id: communicationId },
    });

    if (!communication) {
      throw new Error('Communication not found');
    }

    await prisma.leadCommunication.delete({
      where: { id: communicationId },
    });

    return { success: true };
  }

  /**
   * Get communication statistics for a lead
   */
  static async getCommunicationStats(leadId: string) {
    const communications = await prisma.leadCommunication.findMany({
      where: { leadId },
    });

    const stats = {
      total: communications.length,
      byType: {} as Record<string, number>,
      byDirection: {
        INBOUND: 0,
        OUTBOUND: 0,
      },
      totalCallDuration: 0,
      lastCommunication: communications[0]?.createdAt || null,
    };

    communications.forEach((comm) => {
      // Count by type
      stats.byType[comm.type] = (stats.byType[comm.type] || 0) + 1;

      // Count by direction
      stats.byDirection[comm.direction]++;

      // Sum call durations
      if (comm.type === 'CALL' && comm.duration) {
        stats.totalCallDuration += comm.duration;
      }
    });

    return stats;
  }

  /**
   * Generate activity description based on communication type
   */
  private static generateActivityDescription(data: LogCommunicationInput): string {
    const direction = data.direction === 'INBOUND' ? 'Received' : 'Made';

    switch (data.type) {
      case 'CALL':
        const duration = data.duration
          ? ` (${Math.floor(data.duration / 60)}m ${data.duration % 60}s)`
          : '';
        return `${direction} phone call${duration}`;

      case 'EMAIL':
        return `${direction} email${data.subject ? `: ${data.subject}` : ''}`;

      case 'WHATSAPP':
        return `${direction} WhatsApp message`;

      case 'SMS':
        return `${direction} SMS`;

      case 'MEETING':
        return `${direction === 'INBOUND' ? 'Had' : 'Scheduled'} meeting${data.subject ? `: ${data.subject}` : ''}`;

      default:
        return `${direction} communication`;
    }
  }

  /**
   * Get recent communications across all leads (for admin dashboard)
   */
  static async getRecentCommunications(adminId: string, limit: number = 10) {
    const communications = await prisma.leadCommunication.findMany({
      where: {
        performedById: adminId,
      },
      include: {
        lead: {
          select: {
            id: true,
            referenceNumber: true,
            fullName: true,
            priority: true,
            status: true,
          },
        },
        performedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return communications;
  }
}
