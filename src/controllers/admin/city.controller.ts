import type { Request, Response } from 'express';
import prisma from '@/config/db';

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export class AdminCityController {
  static async createCity(req: Request, res: Response) {
    try {
      const { name, slug, stateName, countryName, isActive } = req.body;
      if (!name || !String(name).trim()) {
        return res.deliver(400, false, undefined, 'City name is required');
      }
      const finalSlug =
        slug && String(slug).trim() ? slugify(String(slug)) : slugify(String(name));
      const existing = await prisma.city.findUnique({ where: { slug: finalSlug } });
      if (existing) {
        return res.deliver(409, false, undefined, `A city with slug "${finalSlug}" already exists`);
      }
      const city = await prisma.city.create({
        data: {
          name: String(name).trim(),
          label: String(name).trim(),
          slug: finalSlug,
          stateName: stateName ? String(stateName).trim() : null,
          countryName: countryName ? String(countryName).trim() : 'India',
          isActive: isActive === undefined ? true : Boolean(isActive),
        },
      });
      return res.deliver(201, true, city, 'City created successfully');
    } catch (error) {
      console.error('Create city error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to create city'
      );
    }
  }

  static async deleteCity(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await prisma.city.delete({ where: { id } });
      return res.deliver(200, true, undefined, 'City deleted successfully');
    } catch (error) {
      console.error('Delete city error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to delete city'
      );
    }
  }
}
