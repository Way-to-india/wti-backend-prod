import { HeroSlideService } from '@/services/admin/hero-slide.service';
import type { Request, Response } from 'express';

export class HeroSlideController {
  /**
   * Get active hero slides for public consumption
   */
  static async getActiveHeroSlides(req: Request, res: Response) {
    try {
      const slides = await HeroSlideService.getActiveHeroSlides();

      return res.deliver(200, true, { slides });
    } catch (error) {
      console.error('Error fetching active hero slides:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch hero slides'
      );
    }
  }
}
