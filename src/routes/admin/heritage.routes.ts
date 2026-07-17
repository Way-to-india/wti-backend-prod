import { Router } from 'express';
import { authMiddleware } from '@/middlewares/admin/auth.middleware';
import { HeritageAdminController } from '@/controllers/admin/heritage.controller';

const router = Router();

// SECURITY: every heritage admin endpoint is authenticated. The public site reads
// heritage data from /api/common/* routers only.
router.use(authMiddleware);

// sacred temples: additive from admin (declared before the generic :layer
// routes so the literal "sacred" segment is unambiguous)
router.post('/legacy/sacred/sites', HeritageAdminController.postSacredSite);
router.delete('/legacy/sacred/sites/:id', HeritageAdminController.deleteSacredSite);
router.post('/legacy/sacred/remap', HeritageAdminController.remapSacred);

// legacy layers (unesco_sites / sacred_sites / circuit overviews)
router.get('/legacy/:layer/sites', HeritageAdminController.getLegacySites);
router.put('/legacy/:layer/sites/:id', HeritageAdminController.putLegacySite);
router.get('/legacy/circuits', HeritageAdminController.getCircuits);
router.put('/legacy/circuits/:circuit', HeritageAdminController.putCircuit);

// generic collections
router.get('/collections', HeritageAdminController.getCollections);
router.post('/collections', HeritageAdminController.postCollection);
router.get('/collections/:id', HeritageAdminController.getCollectionDetail);
router.put('/collections/:id', HeritageAdminController.putCollection);
router.delete('/collections/:id', HeritageAdminController.deleteCollection);
router.post('/collections/:id/sites', HeritageAdminController.postSite);
router.post('/collections/:id/remap', HeritageAdminController.remap);

// sites
router.get('/sites/:id', HeritageAdminController.getSiteDetail);
router.put('/sites/:id', HeritageAdminController.putSite);
router.delete('/sites/:id', HeritageAdminController.deleteSite);
router.get('/sites/:id/tours', HeritageAdminController.getSiteTours);

// helpers
router.get('/geocode', HeritageAdminController.geocode);
router.post('/check-content', HeritageAdminController.checkContent);

export default router;
