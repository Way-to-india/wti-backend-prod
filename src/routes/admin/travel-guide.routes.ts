import { TravelGuideController } from '@/controllers/admin/travel-guide.controller';
import { Router } from 'express';
import upload from '@/middlewares/multer';
import { authMiddleware } from '@/middlewares/admin/auth.middleware';

const router = Router();

// SECURITY: these admin endpoints were completely unauthenticated — anyone on the
// internet could create, edit or delete travel guide content. The public site reads
// travel guides from the separate /api/travel-guide router, so this is safe.
router.use(authMiddleware);

// ============================================
// STATES ROUTES
// ============================================
router.get('/states', TravelGuideController.getAllStates);
router.get('/states/:id', TravelGuideController.getStateById);
router.post('/states', TravelGuideController.createState);
router.put('/states/:id', TravelGuideController.updateState);
router.delete('/states/:id', TravelGuideController.deleteState);

// ============================================
// CITIES ROUTES
// ============================================
router.get('/cities', TravelGuideController.getAllCities);
router.get('/cities/:id', TravelGuideController.getCityById);
router.post('/cities', TravelGuideController.createCity);
router.put('/cities/:id', TravelGuideController.updateCity);
router.delete('/cities/:id', TravelGuideController.deleteCity);
router.get('/guide-data', TravelGuideController.getAllGuideData);
router.get('/guide-data/:id', TravelGuideController.getGuideDataById);
router.post('/guide-data', upload.single('cityImage'), TravelGuideController.createGuideData);
router.put('/guide-data/:id', upload.single('cityImage'), TravelGuideController.updateGuideData);
router.delete('/guide-data/:id', TravelGuideController.deleteGuideData);

export default router;
