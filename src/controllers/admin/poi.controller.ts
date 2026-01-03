import { PoiService } from '@/services/admin/poi.service';
import type { Request, Response } from 'express';

export class PoiController {
  // ============================================
  // CATEGORIES ENDPOINTS
  // ============================================

  /**
   * Get all categories with pagination
   * GET /admin/poi/categories
   */
  static async getAllCategories(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const sortBy = (req.query.sortBy as string) || 'monumentCount';
      const sortOrder = (req.query.sortOrder as string) || 'desc';

      const result = await PoiService.getAllCategories(page, limit, sortBy, sortOrder);

      return res.deliver(200, true, result, 'Categories fetched successfully');
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
   * Get category by ID
   * GET /admin/poi/categories/:id
   */
  static async getCategoryById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const category = await PoiService.getCategoryById(id);

      return res.deliver(200, true, category, 'Category fetched successfully');
    } catch (error) {
      console.error('Get category error:', error);
      return res.deliver(
        404,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch category'
      );
    }
  }

  /**
   * Create new category
   * POST /admin/poi/categories
   */
  static async createCategory(req: Request, res: Response) {
    try {
      const { name, slug } = req.body;

      if (!name) {
        return res.deliver(400, false, undefined, 'Category name is required');
      }

      const category = await PoiService.createCategory({ name, slug });

      return res.deliver(201, true, category, 'Category created successfully');
    } catch (error) {
      console.error('Create category error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to create category'
      );
    }
  }

  /**
   * Update category
   * PUT /admin/poi/categories/:id
   */
  static async updateCategory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, slug } = req.body;

      const category = await PoiService.updateCategory(id, { name, slug });

      return res.deliver(200, true, category, 'Category updated successfully');
    } catch (error) {
      console.error('Update category error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to update category'
      );
    }
  }

  /**
   * Delete category
   * DELETE /admin/poi/categories/:id
   */
  static async deleteCategory(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await PoiService.deleteCategory(id);

      return res.deliver(200, true, undefined, 'Category deleted successfully');
    } catch (error) {
      console.error('Delete category error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to delete category'
      );
    }
  }

  /**
   * Sync category monument counts
   * POST /admin/poi/categories/sync-counts
   */
  static async syncCategoryCounts(req: Request, res: Response) {
    try {
      const result = await PoiService.syncCategoryCounts();

      return res.deliver(200, true, result, result.message);
    } catch (error) {
      console.error('Sync category counts error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to sync category counts'
      );
    }
  }

  // ============================================
  // STATES ENDPOINTS
  // ============================================

  /**
   * Get all states with pagination
   * GET /admin/poi/states
   */
  static async getAllStates(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const sortBy = (req.query.sortBy as string) || 'name';
      const sortOrder = (req.query.sortOrder as string) || 'asc';

      const result = await PoiService.getAllStates(page, limit, sortBy, sortOrder);

      return res.deliver(200, true, result, 'States fetched successfully');
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
   * Get state by ID
   * GET /admin/poi/states/:id
   */
  static async getStateById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const state = await PoiService.getStateById(id);

      return res.deliver(200, true, state, 'State fetched successfully');
    } catch (error) {
      console.error('Get state error:', error);
      return res.deliver(
        404,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch state'
      );
    }
  }

  /**
   * Create new state
   * POST /admin/poi/states
   */
  static async createState(req: Request, res: Response) {
    try {
      const { name, slug } = req.body;

      if (!name) {
        return res.deliver(400, false, undefined, 'State name is required');
      }

      const state = await PoiService.createState({ name, slug });

      return res.deliver(201, true, state, 'State created successfully');
    } catch (error) {
      console.error('Create state error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to create state'
      );
    }
  }

  /**
   * Update state
   * PUT /admin/poi/states/:id
   */
  static async updateState(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, slug } = req.body;

      const state = await PoiService.updateState(id, { name, slug });

      return res.deliver(200, true, state, 'State updated successfully');
    } catch (error) {
      console.error('Update state error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to update state'
      );
    }
  }

  /**
   * Delete state
   * DELETE /admin/poi/states/:id
   */
  static async deleteState(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await PoiService.deleteState(id);

      return res.deliver(200, true, undefined, 'State deleted successfully');
    } catch (error) {
      console.error('Delete state error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to delete state'
      );
    }
  }

  /**
   * Sync state monument and city counts
   * POST /admin/poi/states/sync-counts
   */
  static async syncStateCounts(req: Request, res: Response) {
    try {
      const result = await PoiService.syncStateCounts();

      return res.deliver(200, true, result, result.message);
    } catch (error) {
      console.error('Sync state counts error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to sync state counts'
      );
    }
  }

  // ============================================
  // CITIES ENDPOINTS
  // ============================================

  /**
   * Get all cities with pagination and filters
   * GET /admin/poi/cities
   */
  static async getAllCities(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const sortBy = (req.query.sortBy as string) || 'name';
      const sortOrder = (req.query.sortOrder as string) || 'asc';

      const filters = {
        stateId: req.query.stateId as string,
        search: req.query.search as string,
      };

      const result = await PoiService.getAllCities(page, limit, filters, sortBy, sortOrder);

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
   * Get city by ID
   * GET /admin/poi/cities/:id
   */
  static async getCityById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const city = await PoiService.getCityById(id);

      return res.deliver(200, true, city, 'City fetched successfully');
    } catch (error) {
      console.error('Get city error:', error);
      return res.deliver(
        404,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch city'
      );
    }
  }

  /**
   * Create new city
   * POST /admin/poi/cities
   */
  static async createCity(req: Request, res: Response) {
    try {
      const { name, slug, stateId } = req.body;

      if (!name || !slug || !stateId) {
        return res.deliver(400, false, undefined, 'Name, slug, and stateId are required');
      }

      const city = await PoiService.createCity({ name, slug, stateId });

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

  /**
   * Update city
   * PUT /admin/poi/cities/:id
   */
  static async updateCity(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, slug, stateId } = req.body;

      const city = await PoiService.updateCity(id, { name, slug, stateId });

      return res.deliver(200, true, city, 'City updated successfully');
    } catch (error) {
      console.error('Update city error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to update city'
      );
    }
  }

  /**
   * Delete city
   * DELETE /admin/poi/cities/:id
   */
  static async deleteCity(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await PoiService.deleteCity(id);

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

  /**
   * Sync city monument counts
   * POST /admin/poi/cities/sync-counts
   */
  static async syncCityCounts(req: Request, res: Response) {
    try {
      const result = await PoiService.syncCityCounts();

      return res.deliver(200, true, result, result.message);
    } catch (error) {
      console.error('Sync city counts error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to sync city counts'
      );
    }
  }

  // ============================================
  // MONUMENTS ENDPOINTS
  // ============================================

  /**
   * Get all monuments with pagination and filters
   * GET /admin/poi/monuments
   */
  static async getAllMonuments(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const sortBy = (req.query.sortBy as string) || 'createdAt';
      const sortOrder = (req.query.sortOrder as string) || 'desc';

      const filters = {
        cityId: req.query.cityId as string,
        typeofPlace: req.query.typeofPlace as string,
        search: req.query.search as string,
      };

      const result = await PoiService.getAllMonuments(page, limit, filters, sortBy, sortOrder);

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
   * Get monument by ID
   * GET /admin/poi/monuments/:id
   */
  static async getMonumentById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const monument = await PoiService.getMonumentById(id);

      return res.deliver(200, true, monument, 'Monument fetched successfully');
    } catch (error) {
      console.error('Get monument error:', error);
      return res.deliver(
        404,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch monument'
      );
    }
  }

  /**
   * Create new monument
   * POST /admin/poi/monuments
   */
  static async createMonument(req: Request, res: Response) {
    try {
      const {
        monumentName,
        slug,
        cityId,
        typeofPlace,
        description,
        besttime,
        openingtime,
        clossingtime,
        weeklyoff,
        entryFees,
        weather,
        connectivity,
        location,
        rating,
        totalRatings,
        website,
        phone,
      } = req.body;

      if (!monumentName || !cityId) {
        return res.deliver(400, false, undefined, 'Monument name and cityId are required');
      }

      const monument = await PoiService.createMonument({
        monumentName,
        slug,
        cityId,
        typeofPlace,
        description,
        besttime,
        openingtime,
        clossingtime,
        weeklyoff,
        entryFees,
        weather,
        connectivity,
        location,
        rating,
        totalRatings,
        website,
        phone,
      });

      return res.deliver(201, true, monument, 'Monument created successfully');
    } catch (error) {
      console.error('Create monument error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to create monument'
      );
    }
  }

  /**
   * Update monument
   * PUT /admin/poi/monuments/:id
   */
  static async updateMonument(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const {
        monumentName,
        slug,
        cityId,
        typeofPlace,
        description,
        besttime,
        openingtime,
        clossingtime,
        weeklyoff,
        entryFees,
        weather,
        connectivity,
        location,
        rating,
        totalRatings,
        website,
        phone,
      } = req.body;

      const monument = await PoiService.updateMonument(id, {
        monumentName,
        slug,
        cityId,
        typeofPlace,
        description,
        besttime,
        openingtime,
        clossingtime,
        weeklyoff,
        entryFees,
        weather,
        connectivity,
        location,
        rating,
        totalRatings,
        website,
        phone,
      });

      return res.deliver(200, true, monument, 'Monument updated successfully');
    } catch (error) {
      console.error('Update monument error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to update monument'
      );
    }
  }

  /**
   * Delete monument
   * DELETE /admin/poi/monuments/:id
   */
  static async deleteMonument(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await PoiService.deleteMonument(id);

      return res.deliver(200, true, undefined, 'Monument deleted successfully');
    } catch (error) {
      console.error('Delete monument error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to delete monument'
      );
    }
  }
}
