import { TravelGuideService } from '@/services/admin/travel-guide.service';
import type { Request, Response } from 'express';

export class TravelGuideController {
  /**
   * Get all states with pagination
   * GET /admin/travel-guide/states
   */
  static async getAllStates(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const sortBy = (req.query.sortBy as string) || 'name';
      const sortOrder = (req.query.sortOrder as string) || 'asc';

      const result = await TravelGuideService.getAllStates(page, limit, sortBy, sortOrder);

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
   * GET /admin/travel-guide/states/:id
   */
  static async getStateById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const state = await TravelGuideService.getStateById(id);

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
   * POST /admin/travel-guide/states
   */
  static async createState(req: Request, res: Response) {
    try {
      const { name, slug } = req.body;

      if (!name) {
        return res.deliver(400, false, undefined, 'State name is required');
      }

      const state = await TravelGuideService.createState({ name, slug });

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
   * PUT /admin/travel-guide/states/:id
   */
  static async updateState(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, slug } = req.body;

      const state = await TravelGuideService.updateState(id, { name, slug });

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
   * DELETE /admin/travel-guide/states/:id
   */
  static async deleteState(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await TravelGuideService.deleteState(id);

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

  // ============================================
  // CITIES ENDPOINTS
  // ============================================

  /**
   * Get all cities with pagination and filters
   * GET /admin/travel-guide/cities
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

      const result = await TravelGuideService.getAllCities(page, limit, filters, sortBy, sortOrder);

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
   * GET /admin/travel-guide/cities/:id
   */
  static async getCityById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const city = await TravelGuideService.getCityById(id);

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
   * POST /admin/travel-guide/cities
   */
  static async createCity(req: Request, res: Response) {
    try {
      const { name, slug, stateId, stateName } = req.body;

      if (!name || !stateId || !stateName) {
        return res.deliver(400, false, undefined, 'Name, stateId, and stateName are required');
      }

      const city = await TravelGuideService.createCity({ name, slug, stateId, stateName });

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
   * PUT /admin/travel-guide/cities/:id
   */
  static async updateCity(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, slug, stateId, stateName } = req.body;

      const city = await TravelGuideService.updateCity(id, { name, slug, stateId, stateName });

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
   * DELETE /admin/travel-guide/cities/:id
   */
  static async deleteCity(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await TravelGuideService.deleteCity(id);

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

  // ============================================
  // GUIDE DATA ENDPOINTS
  // ============================================

  /**
   * Get all guide data with pagination and filters
   * GET /admin/travel-guide/guide-data
   */
  static async getAllGuideData(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const sortBy = (req.query.sortBy as string) || 'createdAt';
      const sortOrder = (req.query.sortOrder as string) || 'desc';

      const filters = {
        cityId: req.query.cityId as string,
        stateId: req.query.stateId as string,
        isActive:
          req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      };

      const result = await TravelGuideService.getAllGuideData(
        page,
        limit,
        filters,
        sortBy,
        sortOrder
      );

      return res.deliver(200, true, result, 'Guide data fetched successfully');
    } catch (error) {
      console.error('Get guide data error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch guide data'
      );
    }
  }

  /**
   * Get guide data by ID
   * GET /admin/travel-guide/guide-data/:id
   */
  static async getGuideDataById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const guideData = await TravelGuideService.getGuideDataById(id);

      return res.deliver(200, true, guideData, 'Guide data fetched successfully');
    } catch (error) {
      console.error('Get guide data error:', error);
      return res.deliver(
        404,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch guide data'
      );
    }
  }

  /**
   * Create new guide data
   * POST /admin/travel-guide/guide-data
   */
  static async createGuideData(req: Request, res: Response) {
    try {
      const {
        cityId,
        citySlug,
        stateId,
        stateSlug,
        originalCityId,
        menuId,
        isActive,
        introduction,
        facts,
        foodAndDining,
        shopping,
        nearbyPlaces,
        gettingAround,
        historyCulture,
        otherDetails,
        bestTimeToVisit,
        placesToSeeTop,
        placesToSeeBottom,
        hotelDetails,
        cityImage,
      } = req.body;

      if (!cityId || !stateId) {
        return res.deliver(400, false, undefined, 'cityId and stateId are required');
      }

      const guideData = await TravelGuideService.createGuideData({
        cityId,
        citySlug,
        stateId,
        stateSlug,
        originalCityId,
        menuId,
        isActive,
        introduction,
        facts,
        foodAndDining,
        shopping,
        nearbyPlaces,
        gettingAround,
        historyCulture,
        otherDetails,
        bestTimeToVisit,
        placesToSeeTop,
        placesToSeeBottom,
        hotelDetails,
        cityImage,
      });

      return res.deliver(201, true, guideData, 'Guide data created successfully');
    } catch (error) {
      console.error('Create guide data error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to create guide data'
      );
    }
  }

  /**
   * Update guide data
   * PUT /admin/travel-guide/guide-data/:id
   */
  static async updateGuideData(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const {
        cityId,
        citySlug,
        stateId,
        stateSlug,
        originalCityId,
        menuId,
        isActive,
        introduction,
        facts,
        foodAndDining,
        shopping,
        nearbyPlaces,
        gettingAround,
        historyCulture,
        otherDetails,
        bestTimeToVisit,
        placesToSeeTop,
        placesToSeeBottom,
        hotelDetails,
        cityImage,
      } = req.body;

      const guideData = await TravelGuideService.updateGuideData(id, {
        cityId,
        citySlug,
        stateId,
        stateSlug,
        originalCityId,
        menuId,
        isActive,
        introduction,
        facts,
        foodAndDining,
        shopping,
        nearbyPlaces,
        gettingAround,
        historyCulture,
        otherDetails,
        bestTimeToVisit,
        placesToSeeTop,
        placesToSeeBottom,
        hotelDetails,
        cityImage,
      });

      return res.deliver(200, true, guideData, 'Guide data updated successfully');
    } catch (error) {
      console.error('Update guide data error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to update guide data'
      );
    }
  }

  /**
   * Delete guide data
   * DELETE /admin/travel-guide/guide-data/:id
   */
  static async deleteGuideData(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await TravelGuideService.deleteGuideData(id);

      return res.deliver(200, true, undefined, 'Guide data deleted successfully');
    } catch (error) {
      console.error('Delete guide data error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to delete guide data'
      );
    }
  }
}
