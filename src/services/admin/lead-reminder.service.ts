import prisma from '@/config/db';
import { suggestNextFollowUp } from '@/utils/lead-scoring.util';

interface CreateReminderInput {
  leadId: string;
  scheduledFor: string;
  reminderType: 'FOLLOW_UP' | 'CALLBACK' | 'QUOTE_FOLLOW_UP' | 'GENERAL';
  notes?: string | null;
  assignedToId?: string | null;
  createdById: string;
}

interface UpdateReminderInput {
  reminderId: string;
  scheduledFor?: string;
  reminderType?: 'FOLLOW_UP' | 'CALLBACK' | 'QUOTE_FOLLOW_UP' | 'GENERAL';
  notes?: string | null;
}

interface SnoozeReminderInput {
  reminderId: string;
  snoozedUntil: string;
  snoozeReason?: string | null;
}

export class LeadReminderService {
  /**
   * Create reminder
   */
  static async createReminder(data: CreateReminderInput) {
    const lead = await prisma.lead.findUnique({ where: { id: data.leadId } });

    if (!lead) {
      throw new Error('Lead not found');
    }

    // If no assignedToId provided, use lead's assigned admin or creator
    const assignedToId = data.assignedToId || lead.assignedToId || data.createdById;

    const reminder = await prisma.leadReminder.create({
      data: {
        leadId: data.leadId,
        scheduledFor: new Date(data.scheduledFor),
        reminderType: data.reminderType as any,
        notes: data.notes,
        assignedToId,
        createdById: data.createdById,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Update lead's next follow-up date
    await prisma.lead.update({
      where: { id: data.leadId },
      data: {
        nextFollowUpAt: new Date(data.scheduledFor),
        lastActivityAt: new Date(),
      },
    });

    // Create activity log
    await prisma.leadActivity.create({
      data: {
        leadId: data.leadId,
        activityType: 'REMINDER_CREATED',
        description: `${data.reminderType} reminder scheduled for ${new Date(data.scheduledFor).toLocaleString()}`,
        performedById: data.createdById,
      },
    });

    return reminder;
  }

  /**
   * Get today's follow-ups for an admin
   */
  static async getTodaysFollowups(adminId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const reminders = await prisma.leadReminder.findMany({
      where: {
        assignedToId: adminId,
        scheduledFor: {
          gte: startOfDay,
          lte: endOfDay,
        },
        isCompleted: false,
        isSnoozed: false,
      },
      include: {
        lead: {
          include: {
            tag: true,
            category: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { scheduledFor: 'asc' },
    });

    return reminders;
  }

  /**
   * Get overdue follow-ups for an admin
   */
  static async getOverdueFollowups(adminId: string) {
    const now = new Date();

    const reminders = await prisma.leadReminder.findMany({
      where: {
        assignedToId: adminId,
        scheduledFor: { lt: now },
        isCompleted: false,
        isSnoozed: false,
      },
      include: {
        lead: {
          include: {
            tag: true,
            category: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { scheduledFor: 'asc' },
    });

    return reminders;
  }

  /**
   * Get all reminders for a lead
   */
  static async getRemindersByLeadId(leadId: string) {
    const reminders = await prisma.leadReminder.findMany({
      where: { leadId },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { scheduledFor: 'asc' },
    });

    return reminders;
  }

  /**
   * Update reminder
   */
  static async updateReminder(data: UpdateReminderInput) {
    const existingReminder = await prisma.leadReminder.findUnique({
      where: { id: data.reminderId },
    });

    if (!existingReminder) {
      throw new Error('Reminder not found');
    }

    const reminder = await prisma.leadReminder.update({
      where: { id: data.reminderId },
      data: {
        scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : undefined,
        reminderType: data.reminderType as any,
        notes: data.notes !== undefined ? data.notes : undefined,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Update lead's next follow-up if this is the nearest one
    if (data.scheduledFor) {
      const nearestReminder = await prisma.leadReminder.findFirst({
        where: {
          leadId: existingReminder.leadId,
          isCompleted: false,
          isSnoozed: false,
        },
        orderBy: { scheduledFor: 'asc' },
      });

      if (nearestReminder) {
        await prisma.lead.update({
          where: { id: existingReminder.leadId },
          data: { nextFollowUpAt: nearestReminder.scheduledFor },
        });
      }
    }

    return reminder;
  }

  /**
   * Complete reminder
   */
  static async completeReminder(reminderId: string, notes?: string | null) {
    const reminder = await prisma.leadReminder.findUnique({
      where: { id: reminderId },
    });

    if (!reminder) {
      throw new Error('Reminder not found');
    }

    const completedReminder = await prisma.leadReminder.update({
      where: { id: reminderId },
      data: {
        isCompleted: true,
        completedAt: new Date(),
        notes: notes || reminder.notes,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Update lead's follow-up count
    await prisma.lead.update({
      where: { id: reminder.leadId },
      data: {
        followUpCount: { increment: 1 },
        lastActivityAt: new Date(),
      },
    });

    // Update next follow-up date to the next pending reminder
    const nextReminder = await prisma.leadReminder.findFirst({
      where: {
        leadId: reminder.leadId,
        isCompleted: false,
        isSnoozed: false,
      },
      orderBy: { scheduledFor: 'asc' },
    });

    await prisma.lead.update({
      where: { id: reminder.leadId },
      data: {
        nextFollowUpAt: nextReminder?.scheduledFor || null,
        isOverdue: nextReminder ? nextReminder.scheduledFor < new Date() : false,
      },
    });

    // Create activity log
    await prisma.leadActivity.create({
      data: {
        leadId: reminder.leadId,
        activityType: 'FOLLOW_UP_COMPLETED',
        description: `Follow-up completed${notes ? `: ${notes}` : ''}`,
        performedById: reminder.assignedToId,
      },
    });

    return completedReminder;
  }

  /**
   * Snooze reminder
   */
  static async snoozeReminder(data: SnoozeReminderInput) {
    const reminder = await prisma.leadReminder.findUnique({
      where: { id: data.reminderId },
    });

    if (!reminder) {
      throw new Error('Reminder not found');
    }

    const snoozedReminder = await prisma.leadReminder.update({
      where: { id: data.reminderId },
      data: {
        isSnoozed: true,
        snoozedUntil: new Date(data.snoozedUntil),
        snoozeReason: data.snoozeReason,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Update lead's next follow-up to snoozed time
    await prisma.lead.update({
      where: { id: reminder.leadId },
      data: {
        nextFollowUpAt: new Date(data.snoozedUntil),
      },
    });

    return snoozedReminder;
  }

  /**
   * Unsnooze reminder
   */
  static async unsnoozeReminder(reminderId: string) {
    const reminder = await prisma.leadReminder.findUnique({
      where: { id: reminderId },
    });

    if (!reminder) {
      throw new Error('Reminder not found');
    }

    const unsnoozedReminder = await prisma.leadReminder.update({
      where: { id: reminderId },
      data: {
        isSnoozed: false,
        snoozedUntil: null,
        snoozeReason: null,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return unsnoozedReminder;
  }

  /**
   * Delete reminder
   */
  static async deleteReminder(reminderId: string) {
    const reminder = await prisma.leadReminder.findUnique({
      where: { id: reminderId },
    });

    if (!reminder) {
      throw new Error('Reminder not found');
    }

    await prisma.leadReminder.delete({
      where: { id: reminderId },
    });

    // Update lead's next follow-up
    const nextReminder = await prisma.leadReminder.findFirst({
      where: {
        leadId: reminder.leadId,
        isCompleted: false,
        isSnoozed: false,
      },
      orderBy: { scheduledFor: 'asc' },
    });

    await prisma.lead.update({
      where: { id: reminder.leadId },
      data: {
        nextFollowUpAt: nextReminder?.scheduledFor || null,
      },
    });

    return { success: true };
  }

  /**
   * Auto-create follow-up reminder based on lead status
   */
  static async autoCreateFollowUp(leadId: string, createdById: string) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });

    if (!lead) {
      throw new Error('Lead not found');
    }

    const nextFollowUpDate = suggestNextFollowUp(
      lead.status,
      lead.priority,
      lead.lastActivityAt || lead.createdAt
    );

    return this.createReminder({
      leadId,
      scheduledFor: nextFollowUpDate.toISOString(),
      reminderType: 'FOLLOW_UP',
      notes: 'Auto-generated follow-up reminder',
      assignedToId: lead.assignedToId,
      createdById,
    });
  }
}
