import { TravelGuideService } from '@/services/common/travel-guide.service';
import type { Request, Response } from 'express';

export class TravelGuideController {
  /**
   * Get all states with their cities
   * GET /api/travel-guide/states
   */
  static async getAllStatesWithCities(req: Request, res: Response) {
    try {
      const states = await TravelGuideService.getAllStatesWithCities();

      return res.deliver(200, true, states, 'States fetched successfully');
    } catch (error) {
      console.error('Get states error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch states'
      );
    }
  }

  /**
   * Get city details by slug
   * GET /api/travel-guide/cities/:slug
   */
  static async getCityBySlug(req: Request, res: Response) {
    try {
      const { slug } = req.params;

      if (!slug) {
        return res.deliver(400, false, undefined, 'City slug is required');
      }

      const city = await TravelGuideService.getCityBySlug(slug);

      if (!city) {
        return res.deliver(404, false, undefined, 'City not found');
      }

      return res.deliver(200, true, city, 'City details fetched successfully');
    } catch (error) {
      console.error('Get city error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch city details'
      );
    }
  }

  /**
   * Get all cities for a specific state
   * GET /api/travel-guide/states/:slug/cities
   */
  static async getCitiesByState(req: Request, res: Response) {
    try {
      const { slug } = req.params;

      if (!slug) {
        return res.deliver(400, false, undefined, 'State slug is required');
      }

      const state = await TravelGuideService.getCitiesByState(slug);

      if (!state) {
        return res.deliver(404, false, undefined, 'State not found');
      }

      return res.deliver(200, true, state, 'State cities fetched successfully');
    } catch (error) {
      console.error('Get state cities error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch state cities'
      );
    }
  }

  /**
   * Search cities by name
   * GET /api/travel-guide/search?q=cityName
   */
  static async searchCities(req: Request, res: Response) {
    try {
      const { q } = req.query;

      if (!q || typeof q !== 'string') {
        return res.deliver(400, false, undefined, 'Search query is required');
      }

      const cities = await TravelGuideService.searchCities(q);

      return res.deliver(200, true, cities, 'Search results fetched successfully');
    } catch (error) {
      console.error('Search cities error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to search cities'
      );
    }
  }
}
