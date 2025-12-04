import type { Request, Response } from 'express';
import prisma from '@/config/db';
import type { Prisma } from 'prisma/generated/prisma/client';

export class ThemeController {
  static async getAllThemes(req: Request, res: Response) {
    try {
      const {
        page = '1',
        limit = '100',
        search,
        id,
        slug,
        name,
        isActive,
        minTourCount,
        sortBy = 'order',
        sortOrder = 'asc',
      } = req.query;

      const where: Prisma.ThemeWhereInput = { AND: [] };

      if (search) {
        (where.AND as Prisma.ThemeWhereInput[]).push({
          OR: [
            { name: { contains: search as string, mode: 'insensitive' } },
            { label: { contains: search as string, mode: 'insensitive' } },
            { slug: { contains: search as string, mode: 'insensitive' } },
          ],
        });
      }

      if (id) (where.AND as Prisma.ThemeWhereInput[]).push({ id: id as string });
      if (slug) (where.AND as Prisma.ThemeWhereInput[]).push({ slug: slug as string });
      if (name)
        (where.AND as Prisma.ThemeWhereInput[]).push({
          name: { contains: name as string, mode: 'insensitive' },
        });
      if (isActive !== undefined)
        (where.AND as Prisma.ThemeWhereInput[]).push({ isActive: isActive === 'true' });
      if (minTourCount)
        (where.AND as Prisma.ThemeWhereInput[]).push({
          tourCount: { gte: parseInt(minTourCount as string) },
        });

      if ((where.AND as Prisma.ThemeWhereInput[]).length === 0) delete where.AND;

      const orderBy: Prisma.ThemeOrderByWithRelationInput = {};
      orderBy[sortBy as keyof Prisma.ThemeOrderByWithRelationInput] =
        sortOrder === 'asc' ? 'asc' : 'desc';

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const [themes, total] = await Promise.all([
        prisma.theme.findMany({
          where,
          select: {
            id: true,
            name: true,
            label: true,
            slug: true,
            icon: true,
            description: true,
            imageUrl: true,
            tourCount: true,
            order: true,
            isActive: true,
          },
          orderBy,
          skip,
          take: limitNum,
        }),
        prisma.theme.count({ where }),
      ]);

      return res.deliver(200, true, {
        themes,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error('Error fetching themes:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch themes'
      );
    }
  }

  static async getThemeById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const theme = await prisma.theme.findFirst({
        where: {
          OR: [{ id }, { slug: id }],
        },
        select: {
          id: true,
          name: true,
          label: true,
          slug: true,
          icon: true,
          description: true,
          imageUrl: true,
          tourCount: true,
          order: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!theme) {
        return res.deliver(404, false, undefined, 'Theme not found');
      }

      return res.deliver(200, true, { theme });
    } catch (error) {
      console.error('Error fetching theme:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch theme'
      );
    }
  }
}
