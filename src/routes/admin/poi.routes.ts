import { PoiController } from '@/controllers/admin/poi.controller';
import { authMiddleware } from '@/middlewares/admin/auth.middleware';
import { Router } from 'express';

const router = Router();

// SECURITY: every POI admin endpoint is authenticated. The public site reads POI
// data from /api/common/poi/* only. (This router was previously unauthenticated.)
router.use(authMiddleware);

// ============================================
// CATEGORIES ROUTES
// ============================================
router.get('/categories', PoiController.getAllCategories);
router.get('/categories/:id', PoiController.getCategoryById);
router.post('/categories', PoiController.createCategory);
router.put('/categories/:id', PoiController.updateCategory);
router.delete('/categories/:id', PoiController.deleteCategory);
router.post('/categories/sync-counts', PoiController.syncCategoryCounts);

// ============================================
// STATES ROUTES
// ============================================
router.get('/states', PoiController.getAllStates);
router.get('/states/:id', PoiController.getStateById);
router.post('/states', PoiController.createState);
router.put('/states/:id', PoiController.updateState);
router.delete('/states/:id', PoiController.deleteState);
router.post('/states/sync-counts', PoiController.syncStateCounts);

// ============================================
// CITIES ROUTES
// ============================================
router.get('/cities', PoiController.getAllCities);
router.get('/cities/:id', PoiController.getCityById);
router.post('/cities', PoiController.createCity);
router.put('/cities/:id', PoiController.updateCity);
router.delete('/cities/:id', PoiController.deleteCity);
router.post('/cities/sync-counts', PoiController.syncCityCounts);

// ============================================
// MONUMENTS ROUTES
// ============================================
router.get('/monuments', PoiController.getAllMonuments);
router.get('/monuments/:id', PoiController.getMonumentById);
router.post('/monuments', PoiController.createMonument);
router.put('/monuments/:id', PoiController.updateMonument);
router.delete('/monuments/:id', PoiController.deleteMonument);

export default router;
