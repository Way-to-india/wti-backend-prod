import { PoiController } from '@/controllers/common/poi.controller';
import { Router } from 'express';

const router = Router();

// ============================================
// CATEGORY ROUTES
// ============================================

/**
 * @route   GET /api/poi/categories
 * @desc    Get all categories with monument counts
 * @access  Public
 */
router.get('/categories', PoiController.getAllCategories);

/**
 * @route   GET /api/poi/categories/:slug
 * @desc    Get category details with monuments (paginated)
 * @query   page, limit
 * @access  Public
 */
router.get('/categories/:slug', PoiController.getCategoryBySlug);

// ============================================
// STATE ROUTES
// ============================================

/**
 * @route   GET /api/poi/states
 * @desc    Get all states with counts
 * @access  Public
 */
router.get('/states', PoiController.getAllStates);

/**
 * @route   GET /api/poi/states/:slug
 * @desc    Get state details with cities
 * @access  Public
 */
router.get('/states/:slug', PoiController.getStateBySlug);

/**
 * @route   GET /api/poi/states/:slug/cities
 * @desc    Get all cities in a state
 * @access  Public
 */
router.get('/states/:slug/cities', PoiController.getCitiesByState);

/**
 * @route   GET /api/poi/states/:slug/monuments
 * @desc    Get all monuments in a state (paginated)
 * @query   page, limit
 * @access  Public
 */
router.get('/states/:slug/monuments', PoiController.getMonumentsByState);

// ============================================
// CITY ROUTES
// ============================================

/**
 * @route   GET /api/poi/cities
 * @desc    Get all cities (paginated)
 * @query   page, limit
 * @access  Public
 */
router.get('/cities', PoiController.getAllCities);

/**
 * @route   GET /api/poi/cities/:slug
 * @desc    Get city details with monuments
 * @access  Public
 */
router.get('/cities/:slug', PoiController.getCityBySlug);

/**
 * @route   GET /api/poi/cities/:slug/monuments
 * @desc    Get all monuments in a city (paginated)
 * @query   page, limit
 * @access  Public
 */
router.get('/cities/:slug/monuments', PoiController.getMonumentsByCity);

// ============================================
// MONUMENT ROUTES
// ============================================

/**
 * @route   GET /api/poi/monuments
 * @desc    Get all monuments with filters (paginated)
 * @query   page, limit, category, state, city, minRating
 * @access  Public
 */
router.get('/monuments', PoiController.getAllMonuments);

/**
 * @route   GET /api/poi/monuments/:slug
 * @desc    Get monument details by slug
 * @access  Public
 */
router.get('/monuments/:slug', PoiController.getMonumentBySlug);

// ============================================
// SEARCH ROUTES
// ============================================

/**
 * @route   GET /api/poi/search
 * @desc    Search monuments by name
 * @query   q (search query), page, limit
 * @access  Public
 */
router.get('/search', PoiController.searchMonuments);

export default router;
