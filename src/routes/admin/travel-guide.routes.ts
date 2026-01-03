import { TravelGuideController } from '@/controllers/admin/travel-guide.controller';
import { Router } from 'express';

const router = Router();

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
router.post('/guide-data', TravelGuideController.createGuideData);
router.put('/guide-data/:id', TravelGuideController.updateGuideData);
router.delete('/guide-data/:id', TravelGuideController.deleteGuideData);

export default router;
