/**
 * UNESCO WORLD HERITAGE LAYER — public controller (U3).
 *
 * Three read endpoints, all under /api/common/unesco:
 *   GET /sites                 → every UNESCO site + how many tours reach it + collection JSON-LD
 *   GET /tours                 → the collection: all active tours that cover a UNESCO site (paged)
 *   GET /sites/:idOrSlug/tours → per-site tour list (the tours that take you to one site)
 *
 * All fail closed: an empty layer returns an empty (200) result, never a 500.
 */
import type { Request, Response } from 'express';
import {
  listUnescoSites, collectionJsonLd, toursCoveringUnesco, getSite, toursForSite,
} from '@/services/common/unesco.service';

export class UnescoController {
  /** The collection landing data: all sites (with tour counts) + ready-to-inject JSON-LD. */
  static async getSites(_req: Request, res: Response) {
    try {
      const sites = await listUnescoSites();
      const jsonLd = collectionJsonLd(sites);
      const withTours = sites.filter((s) => s.tourCount > 0).length;
      return res.deliver(200, true, {
        sites,
        summary: { total: sites.length, withTours },
        jsonLd,
      });
    } catch (error) {
      console.error('UNESCO getSites error:', error);
      // fail closed — never break the destinations page
      return res.deliver(200, true, { sites: [], summary: { total: 0, withTours: 0 }, jsonLd: null });
    }
  }

  /** The collection of tours that cover at least one UNESCO site, richest first. */
  static async getTours(req: Request, res: Response) {
    try {
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
      const limit = Math.min(48, Math.max(1, parseInt(String(req.query.limit ?? '12'), 10) || 12));
      const { tours, total } = await toursCoveringUnesco(page, limit);
      return res.deliver(200, true, {
        tours,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      console.error('UNESCO getTours error:', error);
      return res.deliver(200, true, { tours: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } });
    }
  }

  /** The tours that take a traveller to one specific UNESCO site. */
  static async getSiteTours(req: Request, res: Response) {
    try {
      const site = await getSite(String(req.params.idOrSlug));
      if (!site) return res.deliver(404, false, undefined, 'UNESCO site not found');
      const tours = await toursForSite(site.id);
      return res.deliver(200, true, { site, tours, total: tours.length });
    } catch (error) {
      console.error('UNESCO getSiteTours error:', error);
      return res.deliver(500, false, undefined, error instanceof Error ? error.message : 'Failed');
    }
  }
}
