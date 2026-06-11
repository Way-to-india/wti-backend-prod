/**
 * AI Funnel Routes
 *
 * All AI-powered sales funnel endpoints.
 * Base path: /api/admin/ai-funnel
 */

import { AIFunnelController } from '@/controllers/admin/ai-funnel.controller';
import { authMiddleware } from '@/middlewares/admin/auth.middleware';
import { checkPermission } from '@/middlewares/permission.middleware';
import { Router } from 'express';

const router = Router();

// All AI funnel routes require authentication
router.use(authMiddleware);

// ============================================
// LEAD QUALIFICATION
// ============================================

// AI-qualify a specific lead
router.post(
  '/qualify/:leadId',
  checkPermission('CRM', 'edit'),
  AIFunnelController.qualifyLead
);

// AI-qualify all unqualified leads (batch)
router.post(
  '/qualify-batch',
  checkPermission('CRM', 'edit'),
  AIFunnelController.qualifyBatch
);

// Re-score all leads (one-time fix for existing leads)
router.post(
  '/rescore-all',
  checkPermission('CRM', 'edit'),
  AIFunnelController.rescoreAll
);

// ============================================
// AI-GENERATED RESPONSES
// ============================================

// Get AI-generated response for a lead
router.get(
  '/response/:leadId',
  checkPermission('CRM', 'view'),
  AIFunnelController.getLeadResponse
);

// ============================================
// SMART FOLLOW-UPS
// ============================================

// Get AI follow-up suggestion for a lead
router.get(
  '/follow-up/:leadId',
  checkPermission('CRM', 'view'),
  AIFunnelController.suggestFollowUp
);

// ============================================
// DAILY BRIEFING
// ============================================

// Generate today's AI sales briefing
router.get(
  '/daily-briefing',
  checkPermission('CRM', 'view'),
  AIFunnelController.getDailyBriefing
);

// ============================================
// TRAVEL STUDIO BRIDGE
// ============================================

// Generate Travel Studio itinerary request for a lead
router.post(
  '/travel-studio/:leadId',
  checkPermission('CRM', 'edit'),
  AIFunnelController.generateTravelStudioRequest
);

export default router;
