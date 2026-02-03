import prisma from '@/config/db';
import type { Prisma } from 'prisma/generated/prisma/client';

export class TourDraftService {

  static async getAllDrafts(
    page: number = 1,
    limit: number = 20,
    sortOrder: 'asc' | 'desc' = 'desc'
  ) {
    const skip = (page - 1) * limit;

    const [drafts, total] = await Promise.all([
      prisma.tourDraft.findMany({
        skip,
        take: limit,
        orderBy: {
          createdAt: sortOrder,
        },
      }),
      prisma.tourDraft.count(),
    ]);

    return {
      drafts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getDraftById(id: string) {
    const draft = await prisma.tourDraft.findUnique({
      where: { id },
    });

    if (!draft) {
      throw new Error('Draft not found');
    }

    return draft;
  }

  static async createDraft(data: {
    adminId: string;
    adminName?: string;
    draftData: Prisma.InputJsonValue;
    title?: string;
  }) {
    return await prisma.tourDraft.create({
      data: {
        adminId: data.adminId,
        adminName: data.adminName,
        draftData: data.draftData,
        title: data.title,
      },
    });
  }

  static async updateDraft(
    id: string,
    data: {
      draftData?: Prisma.InputJsonValue;
      title?: string;
    }
  ) {
    return await prisma.tourDraft.update({
      where: { id },
      data,
    });
  }

  static async deleteDraft(id: string) {
    await prisma.tourDraft.delete({
      where: { id },
    });

    return { success: true };
  }

  static async getDraftsByAdminId(adminId: string) {
    return await prisma.tourDraft.findMany({
      where: { adminId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
