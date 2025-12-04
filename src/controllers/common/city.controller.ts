import type { Request, Response } from 'express';
import prisma from '@/config/db';
import type { Prisma } from 'prisma/generated/prisma/client';

export class CityController {
  static async getAllCities(req: Request, res: Response) {
    try {
      const {
        page = '1',
        limit = '100',
        search,
        id,
        slug,
        name,
        isActive,
        stateId,
        stateName,
        countryId,
        countryName,
        minTourCount,
        sortBy = 'name',
        sortOrder = 'asc',
      } = req.query;

      const where: Prisma.CityWhereInput = { AND: [] };

      if (search) {
        (where.AND as Prisma.CityWhereInput[]).push({
          OR: [
            { name: { contains: search as string, mode: 'insensitive' } },
            { label: { contains: search as string, mode: 'insensitive' } },
            { slug: { contains: search as string, mode: 'insensitive' } },
          ],
        });
      }

      if (id) (where.AND as Prisma.CityWhereInput[]).push({ id: id as string });
      if (slug) (where.AND as Prisma.CityWhereInput[]).push({ slug: slug as string });
      if (name)
        (where.AND as Prisma.CityWhereInput[]).push({
          name: { contains: name as string, mode: 'insensitive' },
        });
      if (isActive !== undefined)
        (where.AND as Prisma.CityWhereInput[]).push({ isActive: isActive === 'true' });
      if (stateId) (where.AND as Prisma.CityWhereInput[]).push({ stateId: stateId as string });
      if (stateName)
        (where.AND as Prisma.CityWhereInput[]).push({
          stateName: { contains: stateName as string, mode: 'insensitive' },
        });
      if (countryId)
        (where.AND as Prisma.CityWhereInput[]).push({ countryId: countryId as string });
      if (countryName)
        (where.AND as Prisma.CityWhereInput[]).push({
          countryName: { contains: countryName as string, mode: 'insensitive' },
        });
      if (minTourCount)
        (where.AND as Prisma.CityWhereInput[]).push({
          tourCount: { gte: parseInt(minTourCount as string) },
        });

      if ((where.AND as Prisma.CityWhereInput[]).length === 0) delete where.AND;

      const orderBy: Prisma.CityOrderByWithRelationInput = {};
      orderBy[sortBy as keyof Prisma.CityOrderByWithRelationInput] =
        sortOrder === 'asc' ? 'asc' : 'desc';

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const [cities, total] = await Promise.all([
        prisma.city.findMany({
          where,
          select: {
            id: true,
            name: true,
            label: true,
            slug: true,
            stateId: true,
            stateName: true,
            countryId: true,
            countryName: true,
            imageUrl: true,
            tourCount: true,
            isActive: true,
          },
          orderBy,
          skip,
          take: limitNum,
        }),
        prisma.city.count({ where }),
      ]);

      return res.deliver(200, true, {
        cities,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error('Error fetching cities:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch cities'
      );
    }
  }

  static async getCityById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const city = await prisma.city.findFirst({
        where: {
          OR: [{ id }, { slug: id }],
        },
        select: {
          id: true,
          name: true,
          label: true,
          slug: true,
          stateId: true,
          stateName: true,
          countryId: true,
          countryName: true,
          latitude: true,
          longitude: true,
          imageUrl: true,
          description: true,
          tourCount: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!city) {
        return res.deliver(404, false, undefined, 'City not found');
      }

      return res.deliver(200, true, { city });
    } catch (error) {
      console.error('Error fetching city:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch city'
      );
    }
  }
}
