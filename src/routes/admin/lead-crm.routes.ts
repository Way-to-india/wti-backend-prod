import { LeadCRMController } from '@/controllers/admin/lead-crm.controller';
import { authMiddleware } from '@/middlewares/admin/auth.middleware';
import { checkPermission } from '@/middlewares/permission.middleware';
import { validate } from '@/middlewares/validation.middleware';
import {
  addNoteSchema,
  assignLeadSchema,
  bulkUploadLeadsSchema,
  completeReminderSchema,
  createLeadSchema,
  createLeadTagSchema,
  createReminderSchema,
  logCommunicationSchema,
  markQuotationAcceptedSchema,
  snoozeReminderSchema,
  updateLeadSchema,
  updateLeadStatusSchema,
  updateLeadTagSchema,
  updateNoteSchema,
  uploadQuotationSchema,
} from '@/validators/lead-crm.validator';
import { Router } from 'express';
import type { ZodType } from 'zod';

const validateRequest = (schema: ZodType) => validate(schema, 'body');

const router = Router();

router.use(authMiddleware);

router.get('/leads', checkPermission('CRM', 'view'), LeadCRMController.getAllLeads);
router.get('/leads/:id', checkPermission('CRM', 'view'), LeadCRMController.getLeadById);
router.post(
  '/leads',
  checkPermission('CRM', 'create'),
  validateRequest(createLeadSchema),
  LeadCRMController.createLead
);
router.put(
  '/leads/:id',
  checkPermission('CRM', 'edit'),
  validateRequest(updateLeadSchema),
  LeadCRMController.updateLead
);
router.delete('/leads/:id', checkPermission('CRM', 'delete'), LeadCRMController.deleteLead);

router.post(
  '/leads/assign',
  checkPermission('CRM', 'edit'),
  validateRequest(assignLeadSchema),
  LeadCRMController.assignLead
);

// Update lead status
router.post(
  '/leads/status',
  checkPermission('CRM', 'edit'),
  validateRequest(updateLeadStatusSchema),
  LeadCRMController.updateLeadStatus
);

// Bulk create leads
router.post(
  '/leads/bulk',
  checkPermission('CRM', 'create'),
  validateRequest(bulkUploadLeadsSchema),
  LeadCRMController.bulkCreateLeads
);

// ============================================
// NOTES
// ============================================
// Add note
router.post(
  '/notes',
  checkPermission('CRM', 'edit'),
  validateRequest(addNoteSchema),
  LeadCRMController.addNote
);

// Get notes for lead
router.get(
  '/notes/lead/:leadId',
  checkPermission('CRM', 'view'),
  LeadCRMController.getNotesByLeadId
);

// Update note
router.put(
  '/notes/:noteId',
  checkPermission('CRM', 'edit'),
  validateRequest(updateNoteSchema),
  LeadCRMController.updateNote
);

// Delete note
router.delete('/notes/:noteId', checkPermission('CRM', 'edit'), LeadCRMController.deleteNote);

// ============================================
// REMINDERS & FOLLOW-UPS
// ============================================
// Create reminder
router.post(
  '/reminders',
  checkPermission('CRM', 'edit'),
  validateRequest(createReminderSchema),
  LeadCRMController.createReminder
);

// Get today's follow-ups
router.get(
  '/reminders/today',
  checkPermission('CRM', 'view'),
  LeadCRMController.getTodaysFollowups
);

// Get overdue follow-ups
router.get(
  '/reminders/overdue',
  checkPermission('CRM', 'view'),
  LeadCRMController.getOverdueFollowups
);

// Complete reminder
router.post(
  '/reminders/complete',
  checkPermission('CRM', 'edit'),
  validateRequest(completeReminderSchema),
  LeadCRMController.completeReminder
);

// Snooze reminder
router.post(
  '/reminders/snooze',
  checkPermission('CRM', 'edit'),
  validateRequest(snoozeReminderSchema),
  LeadCRMController.snoozeReminder
);

// ============================================
// QUOTATIONS
// ============================================
// Upload quotation
router.post(
  '/quotations',
  checkPermission('CRM', 'edit'),
  validateRequest(uploadQuotationSchema),
  LeadCRMController.uploadQuotation
);

// Get quotations for lead
router.get(
  '/quotations/lead/:leadId',
  checkPermission('CRM', 'view'),
  LeadCRMController.getQuotationsByLeadId
);

// Mark quotation as accepted
router.post(
  '/quotations/accept',
  checkPermission('CRM', 'edit'),
  validateRequest(markQuotationAcceptedSchema),
  LeadCRMController.markQuotationAccepted
);

// ============================================
// COMMUNICATIONS
// ============================================
// Log communication
router.post(
  '/communications',
  checkPermission('CRM', 'edit'),
  validateRequest(logCommunicationSchema),
  LeadCRMController.logCommunication
);

// Get communications for lead
router.get(
  '/communications/lead/:leadId',
  checkPermission('CRM', 'view'),
  LeadCRMController.getCommunicationsByLeadId
);

// ============================================
// CONFIGURATION (Super Admin Only)
// ============================================
// Get all configuration
router.get('/config', checkPermission('CRM', 'view'), LeadCRMController.getAllConfig);

// Lead Tags
router.get('/config/tags', checkPermission('CRM', 'view'), LeadCRMController.getAllLeadTags);
router.post(
  '/config/tags',
  checkPermission('CRM', 'create'),
  validateRequest(createLeadTagSchema),
  LeadCRMController.createLeadTag
);
router.put(
  '/config/tags/:id',
  checkPermission('CRM', 'edit'),
  validateRequest(updateLeadTagSchema),
  LeadCRMController.updateLeadTag
);
router.delete(
  '/config/tags/:id',
  checkPermission('CRM', 'delete'),
  LeadCRMController.deleteLeadTag
);

// ============================================
// ANALYTICS & REPORTS
// ============================================
router.get(
  '/analytics/dashboard',
  checkPermission('CRM', 'view'),
  LeadCRMController.getDashboardSummary
);
router.get(
  '/analytics/conversion',
  checkPermission('CRM', 'view'),
  LeadCRMController.getConversionMetrics
);
router.get(
  '/analytics/performance',
  checkPermission('CRM', 'view'),
  LeadCRMController.getAdminPerformance
);
router.get('/analytics/source-roi', checkPermission('CRM', 'view'), LeadCRMController.getSourceROI);
router.get(
  '/analytics/pipeline',
  checkPermission('CRM', 'view'),
  LeadCRMController.getLeadPipeline
);

export default router;
