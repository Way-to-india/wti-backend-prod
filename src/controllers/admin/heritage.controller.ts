/**
 * HERITAGE ADMIN — founder editor endpoints. ALL behind authMiddleware (router).
 * Legacy layers (unesco/sacred/circuits) + generic collections + the engine.
 */
import type { Request, Response } from 'express';
import {
  listLegacySites, saveLegacyContent, listCircuitContent, saveCircuitContent,
  createCollection, updateCollection, deleteCollection,
  createSite, updateSite, deleteSite, siteTourPreview, bustHeritageCaches,
  createSacredSite, deleteSacredSite,
  type LegacyLayer,
} from '@/services/admin/heritage-admin.service';
import {
  listCollections, getCollection, remapCollection, remapSacred, geocodeCandidates, contentGate,
} from '@/services/common/heritage.service';

function layerOf(req: Request): LegacyLayer | null {
  const l = String(req.params.layer);
  return l === 'unesco' || l === 'sacred' ? l : null;
}

export class HeritageAdminController {
  // ---- legacy layers ----
  static async getLegacySites(req: Request, res: Response) {
    try {
      const layer = layerOf(req);
      if (!layer) return res.deliver(400, false, undefined, 'layer must be unesco or sacred');
      return res.deliver(200, true, { sites: await listLegacySites(layer) });
    } catch (error) {
      console.error('Heritage admin getLegacySites error:', error);
      return res.deliver(500, false, undefined, 'Failed to list sites');
    }
  }

  static async putLegacySite(req: Request, res: Response) {
    try {
      const layer = layerOf(req);
      if (!layer) return res.deliver(400, false, undefined, 'layer must be unesco or sacred');
      const result = await saveLegacyContent(layer, Number(req.params.id), {
        content: req.body?.content,
        contentReviewed: req.body?.contentReviewed,
        blurb: req.body?.blurb,
        circuits: req.body?.circuits,
        deity: req.body?.deity,
        state: req.body?.state,
        nearestTown: req.body?.nearestTown,
        lat: req.body?.lat,
        lng: req.body?.lng,
        geocodedFrom: req.body?.geocodedFrom,
      });
      if (!result.ok) return res.deliver(422, false, { issues: result.issues }, 'Content did not pass the GOLD gate');
      return res.deliver(200, true, { saved: true, warnings: result.issues });
    } catch (error) {
      console.error('Heritage admin putLegacySite error:', error);
      return res.deliver(500, false, undefined, 'Failed to save');
    }
  }

  // ---- sacred temples: additive from admin ----
  static async postSacredSite(req: Request, res: Response) {
    try {
      const name = String(req.body?.name ?? '').trim();
      if (!name) return res.deliver(400, false, undefined, 'name is required');
      const created = await createSacredSite({
        name,
        circuits: Array.isArray(req.body?.circuits) ? req.body.circuits : [],
        deity: req.body?.deity ?? null,
        state: req.body?.state,
        nearestTown: req.body?.nearestTown,
        lat: req.body?.lat ?? null,
        lng: req.body?.lng ?? null,
        geocodedFrom: req.body?.geocodedFrom ?? null,
      });
      return res.deliver(201, true, created);
    } catch (error) {
      console.error('Heritage admin postSacredSite error:', error);
      return res.deliver(500, false, undefined, 'Failed to create temple');
    }
  }

  static async deleteSacredSite(req: Request, res: Response) {
    try {
      const result = await deleteSacredSite(Number(req.params.id));
      if (!result.ok) return res.deliver(409, false, undefined, result.reason);
      return res.deliver(200, true, { deleted: true });
    } catch (error) {
      console.error('Heritage admin deleteSacredSite error:', error);
      return res.deliver(500, false, undefined, 'Failed to delete temple');
    }
  }

  static async remapSacred(_req: Request, res: Response) {
    try {
      const result = await remapSacred();
      await bustHeritageCaches();
      return res.deliver(200, true, result);
    } catch (error) {
      console.error('Heritage admin remapSacred error:', error);
      return res.deliver(500, false, undefined, 'Remap failed');
    }
  }

  static async getCircuits(_req: Request, res: Response) {
    try {
      return res.deliver(200, true, { circuits: await listCircuitContent() });
    } catch (error) {
      console.error('Heritage admin getCircuits error:', error);
      return res.deliver(500, false, undefined, 'Failed to list circuits');
    }
  }

  static async putCircuit(req: Request, res: Response) {
    try {
      const result = await saveCircuitContent(String(req.params.circuit), {
        content: req.body?.content,
        contentReviewed: req.body?.contentReviewed,
      });
      if (!result.ok) return res.deliver(422, false, { issues: result.issues }, 'Content did not pass the GOLD gate');
      return res.deliver(200, true, { saved: true });
    } catch (error) {
      console.error('Heritage admin putCircuit error:', error);
      return res.deliver(500, false, undefined, 'Failed to save');
    }
  }

  // ---- generic collections ----
  static async getCollections(_req: Request, res: Response) {
    try {
      return res.deliver(200, true, { collections: await listCollections(false) });
    } catch (error) {
      console.error('Heritage admin getCollections error:', error);
      return res.deliver(500, false, undefined, 'Failed to list collections');
    }
  }

  static async postCollection(req: Request, res: Response) {
    try {
      const name = String(req.body?.name ?? '').trim();
      if (!name) return res.deliver(400, false, undefined, 'name is required');
      const created = await createCollection({
        name, slug: req.body?.slug, kind: req.body?.kind,
        eyebrow: req.body?.eyebrow, heroIntro: req.body?.heroIntro,
      });
      return res.deliver(201, true, created);
    } catch (error: any) {
      if (String(error?.message ?? '').includes('duplicate key')) {
        return res.deliver(409, false, undefined, 'A collection with this slug already exists');
      }
      console.error('Heritage admin postCollection error:', error);
      return res.deliver(500, false, undefined, 'Failed to create collection');
    }
  }

  static async putCollection(req: Request, res: Response) {
    try {
      await updateCollection(Number(req.params.id), req.body ?? {});
      return res.deliver(200, true, { saved: true });
    } catch (error) {
      console.error('Heritage admin putCollection error:', error);
      return res.deliver(500, false, undefined, 'Failed to update collection');
    }
  }

  static async deleteCollection(req: Request, res: Response) {
    try {
      const result = await deleteCollection(Number(req.params.id));
      if (!result.ok) return res.deliver(409, false, undefined, result.reason);
      return res.deliver(200, true, { deleted: true });
    } catch (error) {
      console.error('Heritage admin deleteCollection error:', error);
      return res.deliver(500, false, undefined, 'Failed to delete collection');
    }
  }

  static async getCollectionDetail(req: Request, res: Response) {
    try {
      const all = await listCollections(false);
      const meta = all.find((c: any) => c.id === Number(req.params.id));
      if (!meta) return res.deliver(404, false, undefined, 'Collection not found');
      const full = await getCollection(meta.slug, false);
      return res.deliver(200, true, { collection: full });
    } catch (error) {
      console.error('Heritage admin getCollectionDetail error:', error);
      return res.deliver(500, false, undefined, 'Failed to load collection');
    }
  }

  // ---- sites ----
  static async postSite(req: Request, res: Response) {
    try {
      const name = String(req.body?.name ?? '').trim();
      if (!name) return res.deliver(400, false, undefined, 'name is required');
      const created = await createSite(Number(req.params.id), {
        name, slug: req.body?.slug, state: req.body?.state, nearestTown: req.body?.nearestTown,
        lat: req.body?.lat ?? null, lng: req.body?.lng ?? null, geocodedFrom: req.body?.geocodedFrom ?? null,
      });
      return res.deliver(201, true, created);
    } catch (error: any) {
      if (String(error?.message ?? '').includes('duplicate key')) {
        return res.deliver(409, false, undefined, 'A site with this slug already exists in this collection');
      }
      console.error('Heritage admin postSite error:', error);
      return res.deliver(500, false, undefined, 'Failed to create site');
    }
  }

  static async putSite(req: Request, res: Response) {
    try {
      const result = await updateSite(Number(req.params.id), req.body ?? {});
      if (!result.ok) return res.deliver(422, false, { issues: result.issues }, 'Content did not pass the GOLD gate');
      return res.deliver(200, true, { saved: true, warnings: result.issues });
    } catch (error) {
      console.error('Heritage admin putSite error:', error);
      return res.deliver(500, false, undefined, 'Failed to save site');
    }
  }

  static async deleteSite(req: Request, res: Response) {
    try {
      await deleteSite(Number(req.params.id));
      return res.deliver(200, true, { deleted: true });
    } catch (error) {
      console.error('Heritage admin deleteSite error:', error);
      return res.deliver(500, false, undefined, 'Failed to delete site');
    }
  }

  /** One site with its full content JSON, for the admin editor. */
  static async getSiteDetail(req: Request, res: Response) {
    try {
      const prisma = (await import('@/config/db')).default;
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT hs.*, hc.slug AS collection_slug, hc.name AS collection_name, hc.kind AS collection_kind
           FROM heritage_sites hs JOIN heritage_collections hc ON hc.id = hs.collection_id
          WHERE hs.id = $1`, Number(req.params.id));
      if (!rows.length) return res.deliver(404, false, undefined, 'Site not found');
      const s = rows[0];
      return res.deliver(200, true, { site: {
        id: Number(s.id), collectionId: Number(s.collection_id), name: String(s.name), slug: String(s.slug),
        state: String(s.state), nearestTown: String(s.nearest_town),
        lat: s.lat == null ? null : Number(s.lat), lng: s.lng == null ? null : Number(s.lng),
        geocodedFrom: s.geocoded_from == null ? null : String(s.geocoded_from),
        blurb: s.blurb == null ? null : String(s.blurb),
        content: s.content ?? null, contentReviewed: s.content_reviewed === true,
        isActive: s.is_active === true,
        collection: { slug: String(s.collection_slug), name: String(s.collection_name), kind: String(s.collection_kind) },
      }});
    } catch (error) {
      console.error('Heritage admin getSiteDetail error:', error);
      return res.deliver(500, false, undefined, 'Failed to load site');
    }
  }

  static async getSiteTours(req: Request, res: Response) {
    try {
      return res.deliver(200, true, { tours: await siteTourPreview(Number(req.params.id)) });
    } catch (error) {
      console.error('Heritage admin getSiteTours error:', error);
      return res.deliver(500, false, undefined, 'Failed to load tours');
    }
  }

  // ---- the engine ----
  static async remap(req: Request, res: Response) {
    try {
      const result = await remapCollection(Number(req.params.id));
      await bustHeritageCaches();
      return res.deliver(200, true, result);
    } catch (error) {
      console.error('Heritage admin remap error:', error);
      return res.deliver(500, false, undefined, 'Remap failed');
    }
  }

  static async geocode(req: Request, res: Response) {
    try {
      const town = String(req.query.town ?? '').trim();
      if (!town) return res.deliver(400, false, undefined, 'town is required');
      return res.deliver(200, true, { candidates: await geocodeCandidates(town) });
    } catch (error) {
      console.error('Heritage admin geocode error:', error);
      return res.deliver(500, false, undefined, 'Geocode failed');
    }
  }

  /** Dry-run gate check so the editor can validate as the founder types. */
  static async checkContent(req: Request, res: Response) {
    try {
      const issues = contentGate(req.body?.content ?? null, req.body?.forReview === true);
      return res.deliver(200, true, { issues });
    } catch (error) {
      console.error('Heritage admin checkContent error:', error);
      return res.deliver(500, false, undefined, 'Check failed');
    }
  }
}
