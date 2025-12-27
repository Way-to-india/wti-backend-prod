import { TravelGuideController } from '@/controllers/common/travel-guide.controller';
import { Router } from 'express';

const router = Router();

/**
 * @route   GET /api/travel-guide/states
 * @desc    Get all states with their cities
 * @access  Public
 */
router.get('/states', TravelGuideController.getAllStatesWithCities);

/**
 * @route   GET /api/travel-guide/states/:slug/cities
 * @desc    Get all cities for a specific state
 * @access  Public
 */
router.get('/states/:slug/cities', TravelGuideController.getCitiesByState);

/**
 * @route   GET /api/travel-guide/cities/:slug
 * @desc    Get city details by slug
 * @access  Public
 */
router.get('/cities/:slug', TravelGuideController.getCityBySlug);

/**
 * @route   GET /api/travel-guide/search
 * @desc    Search cities by name
 * @access  Public
 */
router.get('/search', TravelGuideController.searchCities);

export default router;
