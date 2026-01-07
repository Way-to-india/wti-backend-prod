import prisma from '@/config/db';
import type { Prisma } from 'prisma/generated/prisma/client';

export class HeroSlideService {
  /**
   * Get all hero slides (admin)
   */
  static async getAllHeroSlides(
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'order',
    sortOrder: string = 'asc'
  ) {
    const skip = (page - 1) * limit;

    const orderBy: Prisma.HeroSlideOrderByWithRelationInput = {
      [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc',
    };

    const [slides, total] = await Promise.all([
      prisma.heroSlide.findMany({
        orderBy,
        skip,
        take: limit,
      }),
      prisma.heroSlide.count(),
    ]);

    return {
      slides,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get active hero slides for public display
   */
  static async getActiveHeroSlides() {
    const slides = await prisma.heroSlide.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });

    return slides;
  }

  /**
   * Get hero slide by ID
   */
  static async getHeroSlideById(id: string) {
    const slide = await prisma.heroSlide.findUnique({
      where: { id },
    });

    if (!slide) {
      throw new Error('Hero slide not found');
    }

    return slide;
  }

  /**
   * Create a new hero slide
   */
  static async createHeroSlide(data: {
    title: string;
    subtitle?: string | null;
    location?: string | null;
    duration?: string | null;
    imageKey: string;
    imageUrl: string;
    ctaText?: string;
    ctaLink?: string;
    isActive?: boolean;
    order?: number;
  }) {
    // If order is not provided or conflicts, find the next available order
    if (data.order === undefined || data.order === 0) {
      const maxOrder = await prisma.heroSlide.findFirst({
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      data.order = (maxOrder?.order ?? -1) + 1;
    }

    const slide = await prisma.heroSlide.create({
      data: {
        title: data.title,
        subtitle: data.subtitle,
        location: data.location,
        duration: data.duration,
        imageKey: data.imageKey,
        imageUrl: data.imageUrl,
        ctaText: data.ctaText || 'Explore Tours',
        ctaLink: data.ctaLink || '/india-tour-packages',
        isActive: data.isActive ?? true,
        order: data.order,
      },
    });

    return slide;
  }

  /**
   * Update a hero slide
   */
  static async updateHeroSlide(
    id: string,
    data: {
      title?: string;
      subtitle?: string | null;
      location?: string | null;
      duration?: string | null;
      imageKey?: string;
      imageUrl?: string;
      ctaText?: string;
      ctaLink?: string;
      isActive?: boolean;
      order?: number;
    }
  ) {
    const existingSlide = await prisma.heroSlide.findUnique({ where: { id } });

    if (!existingSlide) {
      throw new Error('Hero slide not found');
    }

    const updateData: Prisma.HeroSlideUpdateInput = {};

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        (updateData as any)[key] = value;
      }
    });

    const slide = await prisma.heroSlide.update({
      where: { id },
      data: updateData,
    });

    return slide;
  }

  /**
   * Delete a hero slide
   */
  static async deleteHeroSlide(id: string) {
    const slide = await prisma.heroSlide.findUnique({
      where: { id },
      select: { imageKey: true },
    });

    if (!slide) {
      throw new Error('Hero slide not found');
    }

    await prisma.heroSlide.delete({ where: { id } });

    return slide.imageKey;
  }

  /**
   * Bulk update slide orders
   */
  static async updateSlideOrders(slides: Array<{ id: string; order: number }>) {
    const updatePromises = slides.map((slide) =>
      prisma.heroSlide.update({
        where: { id: slide.id },
        data: { order: slide.order },
      })
    );

    await Promise.all(updatePromises);

    return this.getActiveHeroSlides();
  }
}
