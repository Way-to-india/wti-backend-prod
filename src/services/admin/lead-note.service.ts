import prisma from '@/config/db';

interface CreateNoteInput {
  leadId: string;
  content: string;
  attachments?: string[];
  createdById: string;
}

interface UpdateNoteInput {
  noteId: string;
  content: string;
  attachments?: string[];
}

export class LeadNoteService {
  /**
   * Add note to lead
   */
  static async addNote(data: CreateNoteInput) {
    const lead = await prisma.lead.findUnique({ where: { id: data.leadId } });

    if (!lead) {
      throw new Error('Lead not found');
    }

    const note = await prisma.leadNote.create({
      data: {
        leadId: data.leadId,
        content: data.content,
        attachments: data.attachments || [],
        createdById: data.createdById,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Update lead's last activity
    await prisma.lead.update({
      where: { id: data.leadId },
      data: { lastActivityAt: new Date() },
    });

    // Create activity log
    await prisma.leadActivity.create({
      data: {
        leadId: data.leadId,
        activityType: 'NOTE_ADDED',
        description: 'Note added to lead',
        performedById: data.createdById,
      },
    });

    return note;
  }

  /**
   * Get all notes for a lead
   */
  static async getNotesByLeadId(leadId: string) {
    const notes = await prisma.leadNote.findMany({
      where: { leadId },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return notes;
  }

  /**
   * Update note
   */
  static async updateNote(data: UpdateNoteInput) {
    const existingNote = await prisma.leadNote.findUnique({
      where: { id: data.noteId },
    });

    if (!existingNote) {
      throw new Error('Note not found');
    }

    const note = await prisma.leadNote.update({
      where: { id: data.noteId },
      data: {
        content: data.content,
        attachments: data.attachments !== undefined ? data.attachments : undefined,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Update lead's last activity
    await prisma.lead.update({
      where: { id: existingNote.leadId },
      data: { lastActivityAt: new Date() },
    });

    return note;
  }

  /**
   * Delete note
   */
  static async deleteNote(noteId: string) {
    const note = await prisma.leadNote.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      throw new Error('Note not found');
    }

    await prisma.leadNote.delete({
      where: { id: noteId },
    });

    return { success: true, attachments: note.attachments };
  }
}
