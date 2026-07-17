/**
 * HERITAGE COLLECTIONS — public controller. Fails closed (empty 200 / 404, never 500).
 *   GET /api/common/heritage/collections
 *   GET /api/common/heritage/collections/:slug
 *   GET /api/common/heritage/collections/:slug/sites/:site/tours
 */
import type { Request, Response } from 'express';
import { listCollections, getCollection, getCollectionSiteTours } from '@/services/common/heritage.service';

export class HeritageController {
  static async getCollections(_req: Request, res: Response) {
    try {
      const collections = await listCollections(true);
      return res.deliver(200, true, { collections });
    } catch (error) {
      console.error('Heritage getCollections error:', error);
      return res.deliver(200, true, { collections: [] });
    }
  }

  static async getCollection(req: Request, res: Response) {
    try {
      const collection = await getCollection(String(req.params.slug), true);
      if (!collection) return res.deliver(404, false, undefined, 'Collection not found');
      return res.deliver(200, true, { collection });
    } catch (error) {
      console.error('Heritage getCollection error:', error);
      return res.deliver(404, false, undefined, 'Collection not found');
    }
  }

  static async getSiteTours(req: Request, res: Response) {
    try {
      const data = await getCollectionSiteTours(String(req.params.slug), String(req.params.site));
      if (!data) return res.deliver(404, false, undefined, 'Site not found');
      return res.deliver(200, true, data);
    } catch (error) {
      console.error('Heritage getSiteTours error:', error);
      return res.deliver(404, false, undefined, 'Site not found');
    }
  }
}
