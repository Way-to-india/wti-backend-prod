import z from 'zod';

export const LeadPriorityEnum = z.enum(['HOT', 'WARM', 'COLD']);
export const LeadQualityEnum = z.enum(['A', 'B', 'C']);
export const LeadServiceTypeEnum = z.enum(['TOUR', 'HOTEL', 'TRANSPORT', 'MIXED']);
export const CommunicationTypeEnum = z.enum([
  'CALL',
  'EMAIL',
  'WHATSAPP',
  'SMS',
  'MEETING',
  'OTHER',
]);
export const CommunicationDirectionEnum = z.enum(['INBOUND', 'OUTBOUND']);
export const ReminderTypeEnum = z.enum(['FOLLOW_UP', 'CALLBACK', 'QUOTE_FOLLOW_UP', 'GENERAL']);

// ============================================
// LEAD MANAGEMENT
// ============================================

export const createLeadSchema = z.object({
  // Customer Information
  fullName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(255, 'Name cannot exceed 255 characters')
    .trim(),

  email: z
    .string()
    .email('Please enter a valid email address')
    .max(255, 'Email cannot exceed 255 characters')
    .trim()
    .toLowerCase(),

  phoneNumber: z
    .string()
    .trim()
    .refine(
      (val) => /^[0-9]{10}$/.test(val.replace(/\s/g, '')),
      'Phone number must be exactly 10 digits'
    )
    .transform((val) => val.replace(/\s/g, ''))
    .optional()
    .nullable(),

  alternatePhone: z
    .string()
    .trim()
    .refine(
      (val) => /^[0-9]{10}$/.test(val.replace(/\s/g, '')),
      'Alternate phone must be exactly 10 digits'
    )
    .transform((val) => val.replace(/\s/g, ''))
    .optional()
    .nullable(),

  city: z.string().max(150).trim().optional().nullable(),

  // Service Requirements
  source: z.string().min(1, 'Source is required'),
  serviceType: LeadServiceTypeEnum.optional().nullable(),
  destination: z.string().max(255).trim().optional().nullable(),
  travelStartDate: z.string().datetime().optional().nullable(),
  travelEndDate: z.string().datetime().optional().nullable(),
  numberOfTravelers: z.number().int().min(1).max(100).optional().nullable(),
  numberOfAdults: z.number().int().min(0).max(100).optional().nullable(),
  numberOfChildren: z.number().int().min(0).max(100).optional().nullable(),
  budgetMin: z.number().int().min(0).optional().nullable(),
  budgetMax: z.number().int().min(0).optional().nullable(),
  specialRequests: z.string().max(2000).trim().optional().nullable(),

  // Classification
  priority: LeadPriorityEnum.default('WARM'),
  quality: LeadQualityEnum.optional().nullable(),
  tagId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),

  // Assignment
  assignedToId: z.string().optional().nullable(),

  // Legacy
  // details: z.record(z.any()).optional().nullable(),
  ipAddress: z.string().max(50).optional().nullable(),
  userAgent: z.string().max(500).optional().nullable(),
});

export const updateLeadSchema = z.object({
  fullName: z.string().min(2).max(255).trim().optional(),
  email: z.string().email().max(255).trim().toLowerCase().optional(),
  phoneNumber: z.string().trim().optional().nullable(),
  alternatePhone: z.string().trim().optional().nullable(),
  city: z.string().max(150).trim().optional().nullable(),

  source: z.string().optional(),
  serviceType: LeadServiceTypeEnum.optional().nullable(),
  destination: z.string().max(255).trim().optional().nullable(),
  travelStartDate: z.string().datetime().optional().nullable(),
  travelEndDate: z.string().datetime().optional().nullable(),
  numberOfTravelers: z.number().int().min(1).max(100).optional().nullable(),
  numberOfAdults: z.number().int().min(0).max(100).optional().nullable(),
  numberOfChildren: z.number().int().min(0).max(100).optional().nullable(),
  budgetMin: z.number().int().min(0).optional().nullable(),
  budgetMax: z.number().int().min(0).optional().nullable(),
  specialRequests: z.string().max(2000).trim().optional().nullable(),

  priority: LeadPriorityEnum.optional(),
  quality: LeadQualityEnum.optional().nullable(),
  tagId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),

  estimatedValue: z.number().int().min(0).optional().nullable(),
  actualValue: z.number().int().min(0).optional().nullable(),
  lostReason: z.string().max(1000).trim().optional().nullable(),
});

export const assignLeadSchema = z.object({
  leadId: z.string().min(1, 'Lead ID is required'),
  assignedToId: z.string().min(1, 'Admin ID is required'),
  notes: z.string().max(500).trim().optional().nullable(),
});

export const updateLeadStatusSchema = z.object({
  leadId: z.string().min(1, 'Lead ID is required'),
  status: z.string().min(1, 'Status is required'),
  tagId: z.string().optional().nullable(),
  notes: z.string().max(1000).trim().optional().nullable(),
});

export const filterLeadsSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),

  // Filters
  status: z.string().optional(),
  priority: LeadPriorityEnum.optional(),
  quality: LeadQualityEnum.optional(),
  source: z.string().optional(),
  serviceType: LeadServiceTypeEnum.optional(),
  assignedToId: z.string().optional(),
  tagId: z.string().optional(),
  categoryId: z.string().optional(),

  // Date filters
  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),
  travelDateFrom: z.string().datetime().optional(),
  travelDateTo: z.string().datetime().optional(),

  // Budget filter
  budgetMin: z.number().int().min(0).optional(),
  budgetMax: z.number().int().min(0).optional(),

  // Special filters
  isOverdue: z.boolean().optional(),
  hasFollowUpToday: z.boolean().optional(),

  // Search
  search: z.string().max(255).trim().optional(),

  // Sort
  sortBy: z
    .enum([
      'createdAt',
      'updatedAt',
      'priority',
      'leadScore',
      'nextFollowUpAt',
      'responseTimeMinutes',
      'estimatedValue',
    ])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const bulkUploadLeadsSchema = z.object({
  leads: z
    .array(createLeadSchema)
    .min(1, 'At least one lead is required')
    .max(1000, 'Maximum 1000 leads per upload'),
});

// ============================================
// NOTES
// ============================================

export const addNoteSchema = z.object({
  leadId: z.string().min(1, 'Lead ID is required'),
  content: z
    .string()
    .min(1, 'Note content is required')
    .max(5000, 'Note cannot exceed 5000 characters')
    .trim(),
  attachments: z
    .array(z.string().url())
    .max(10, 'Maximum 10 attachments allowed')
    .optional()
    .default([]),
});

export const updateNoteSchema = z.object({
  noteId: z.string().min(1, 'Note ID is required'),
  content: z
    .string()
    .min(1, 'Note content is required')
    .max(5000, 'Note cannot exceed 5000 characters')
    .trim(),
  attachments: z.array(z.string().url()).max(10, 'Maximum 10 attachments allowed').optional(),
});

// ============================================
// REMINDERS
// ============================================

export const createReminderSchema = z.object({
  leadId: z.string().min(1, 'Lead ID is required'),
  scheduledFor: z.string().datetime('Invalid datetime format'),
  reminderType: ReminderTypeEnum.default('FOLLOW_UP'),
  notes: z.string().max(1000).trim().optional().nullable(),
  assignedToId: z.string().optional().nullable(), // If not provided, assign to current user
});

export const updateReminderSchema = z.object({
  reminderId: z.string().min(1, 'Reminder ID is required'),
  scheduledFor: z.string().datetime().optional(),
  reminderType: ReminderTypeEnum.optional(),
  notes: z.string().max(1000).trim().optional().nullable(),
});

export const snoozeReminderSchema = z.object({
  reminderId: z.string().min(1, 'Reminder ID is required'),
  snoozedUntil: z.string().datetime('Invalid datetime format'),
  snoozeReason: z.string().max(500).trim().optional().nullable(),
});

export const completeReminderSchema = z.object({
  reminderId: z.string().min(1, 'Reminder ID is required'),
  notes: z.string().max(1000).trim().optional().nullable(),
});

// ============================================
// QUOTATIONS
// ============================================

export const uploadQuotationSchema = z.object({
  leadId: z.string().min(1, 'Lead ID is required'),
  fileName: z.string().min(1).max(255),
  fileKey: z.string().min(1).max(500),
  fileUrl: z.string().url().max(1000),
  fileSize: z
    .number()
    .int()
    .min(1)
    .max(50 * 1024 * 1024), // Max 50MB
  fileType: z.string().max(50),
  description: z.string().max(1000).trim().optional().nullable(),
  amount: z.number().int().min(0).optional().nullable(),
});

export const markQuotationAcceptedSchema = z.object({
  quotationId: z.string().min(1, 'Quotation ID is required'),
});

// ============================================
// COMMUNICATIONS
// ============================================

export const logCommunicationSchema = z.object({
  leadId: z.string().min(1, 'Lead ID is required'),
  type: CommunicationTypeEnum,
  direction: CommunicationDirectionEnum,
  subject: z.string().max(255).trim().optional().nullable(),
  content: z.string().max(5000).trim().optional().nullable(),
  duration: z.number().int().min(0).optional().nullable(), // in seconds
  status: z.string().max(50).optional().nullable(),
  // metadata: z.record(z.any()).optional().nullable(),
});

// ============================================
// CONFIGURATION (Super Admin)
// ============================================

export const createLeadTagSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  label: z.string().min(1).max(150).trim(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code'),
  icon: z.string().max(50).optional().nullable(),
  description: z.string().max(500).trim().optional().nullable(),
  order: z.number().int().min(0).default(0),
});

export const updateLeadTagSchema = createLeadTagSchema.partial();

export const createLeadSourceSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  label: z.string().min(1).max(150).trim(),
  icon: z.string().max(50).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code')
    .optional()
    .nullable(),
  description: z.string().max(500).trim().optional().nullable(),
  order: z.number().int().min(0).default(0),
});

export const updateLeadSourceSchema = createLeadSourceSchema.partial();

export const createLeadCategorySchema = z.object({
  name: z.string().min(1).max(100).trim(),
  label: z.string().min(1).max(150).trim(),
  icon: z.string().max(50).optional().nullable(),
  description: z.string().max(500).trim().optional().nullable(),
  order: z.number().int().min(0).default(0),
});

export const updateLeadCategorySchema = createLeadCategorySchema.partial();

// ============================================
// ANALYTICS & REPORTS
// ============================================

export const analyticsDateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  adminId: z.string().optional(),
  source: z.string().optional(),
  categoryId: z.string().optional(),
});

export const exportLeadsSchema = z.object({
  format: z.enum(['excel', 'csv', 'pdf']).default('excel'),

  // Filters (same as filterLeadsSchema)
  status: z.string().optional(),
  priority: LeadPriorityEnum.optional(),
  quality: LeadQualityEnum.optional(),
  source: z.string().optional(),
  serviceType: LeadServiceTypeEnum.optional(),
  assignedToId: z.string().optional(),
  tagId: z.string().optional(),
  categoryId: z.string().optional(),

  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),

  // Include options
  includeNotes: z.boolean().default(false),
  includeActivities: z.boolean().default(false),
  includeCommunications: z.boolean().default(false),
});
