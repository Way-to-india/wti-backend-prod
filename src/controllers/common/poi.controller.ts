import { PoiService } from '@/services/common/poi.service';
import type { Request, Response } from 'express';

export class PoiController {
  /**
   * Get all categories
   * GET /api/poi/categories
   */
  static async getAllCategories(req: Request, res: Response) {
    try {
      const categories = await PoiService.getAllCategories();
      return res.deliver(200, true, categories, 'Categories fetched successfully');
    } catch (error) {
      console.error('Get categories error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch categories'
      );
    }
  }

  /**
   * Get category by slug with monuments
   * GET /api/poi/categories/:slug
   */
  static async getCategoryBySlug(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!slug) {
        return res.deliver(400, false, undefined, 'Category slug is required');
      }

      const result = await PoiService.getCategoryBySlug(slug, page, limit);

      if (!result) {
        return res.deliver(404, false, undefined, 'Category not found');
      }

      return res.deliver(200, true, result, 'Category details fetched successfully');
    } catch (error) {
      console.error('Get category error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch category details'
      );
    }
  }

  /**
   * Get all states
   * GET /api/poi/states
   */
  static async getAllStates(req: Request, res: Response) {
    try {
      const states = await PoiService.getAllStates();
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
   * Get state by slug with cities
   * GET /api/poi/states/:slug
   */
  static async getStateBySlug(req: Request, res: Response) {
    try {
      const { slug } = req.params;

      if (!slug) {
        return res.deliver(400, false, undefined, 'State slug is required');
      }

      const state = await PoiService.getStateBySlug(slug);

      if (!state) {
        return res.deliver(404, false, undefined, 'State not found');
      }

      return res.deliver(200, true, state, 'State details fetched successfully');
    } catch (error) {
      console.error('Get state error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch state details'
      );
    }
  }

  /**
   * Get all cities in a state
   * GET /api/poi/states/:slug/cities
   */
  static async getCitiesByState(req: Request, res: Response) {
    try {
      const { slug } = req.params;

      if (!slug) {
        return res.deliver(400, false, undefined, 'State slug is required');
      }

      const result = await PoiService.getCitiesByState(slug);

      if (!result) {
        return res.deliver(404, false, undefined, 'State not found');
      }

      return res.deliver(200, true, result, 'State cities fetched successfully');
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
   * Get all monuments in a state
   * GET /api/poi/states/:slug/monuments
   */
  static async getMonumentsByState(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!slug) {
        return res.deliver(400, false, undefined, 'State slug is required');
      }

      const result = await PoiService.getMonumentsByState(slug, page, limit);

      if (!result) {
        return res.deliver(404, false, undefined, 'State not found');
      }

      return res.deliver(200, true, result, 'State monuments fetched successfully');
    } catch (error) {
      console.error('Get state monuments error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch state monuments'
      );
    }
  }

  /**
   * Get all cities with pagination
   * GET /api/poi/cities
   */
  static async getAllCities(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await PoiService.getAllCities(page, limit);
      return res.deliver(200, true, result, 'Cities fetched successfully');
    } catch (error) {
      console.error('Get cities error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch cities'
      );
    }
  }

  /**
   * Get city by slug with monuments
   * GET /api/poi/cities/:slug
   */
  static async getCityBySlug(req: Request, res: Response) {
    try {
      const { slug } = req.params;

      if (!slug) {
        return res.deliver(400, false, undefined, 'City slug is required');
      }

      const city = await PoiService.getCityBySlug(slug);

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
   * Get all monuments in a city
   * GET /api/poi/cities/:slug/monuments
   */
  static async getMonumentsByCity(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!slug) {
        return res.deliver(400, false, undefined, 'City slug is required');
      }

      const result = await PoiService.getMonumentsByCity(slug, page, limit);

      if (!result) {
        return res.deliver(404, false, undefined, 'City not found');
      }

      return res.deliver(200, true, result, 'City monuments fetched successfully');
    } catch (error) {
      console.error('Get city monuments error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch city monuments'
      );
    }
  }

  /**
   * Get all monuments with filters
   * GET /api/poi/monuments
   */
  static async getAllMonuments(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const category = req.query.category as string | undefined;
      const stateSlug = req.query.state as string | undefined;
      const citySlug = req.query.city as string | undefined;
      const minRating = req.query.minRating ? parseFloat(req.query.minRating as string) : undefined;

      const result = await PoiService.getAllMonuments({
        page,
        limit,
        category,
        stateSlug,
        citySlug,
        minRating,
      });

      return res.deliver(200, true, result, 'Monuments fetched successfully');
    } catch (error) {
      console.error('Get monuments error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch monuments'
      );
    }
  }

  /**
   * Get monument by slug
   * GET /api/poi/monuments/:slug
   */
  static async getMonumentBySlug(req: Request, res: Response) {
    try {
      const { slug } = req.params;

      if (!slug) {
        return res.deliver(400, false, undefined, 'Monument slug is required');
      }

      const monument = await PoiService.getMonumentBySlug(slug);

      if (!monument) {
        return res.deliver(404, false, undefined, 'Monument not found');
      }

      return res.deliver(200, true, monument, 'Monument details fetched successfully');
    } catch (error) {
      console.error('Get monument error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch monument details'
      );
    }
  }

  /**
   * Search monuments by name
   * GET /api/poi/search?q=query
   */
  static async searchMonuments(req: Request, res: Response) {
    try {
      const { q } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!q || typeof q !== 'string') {
        return res.deliver(400, false, undefined, 'Search query is required');
      }

      const result = await PoiService.searchMonuments(q, page, limit);
      return res.deliver(200, true, result, 'Search results fetched successfully');
    } catch (error) {
      console.error('Search monuments error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to search monuments'
      );
    }
  }
}
