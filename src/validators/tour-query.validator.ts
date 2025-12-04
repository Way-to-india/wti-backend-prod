import z from 'zod';

export const tourEnquirySchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .trim()
    .refine((val) => val.length > 0, 'Name is required'),

  email: z
    .string()
    .email('Please enter a valid email address')
    .max(255, 'Email cannot exceed 255 characters')
    .trim()
    .toLowerCase()
    .refine((val) => val.length > 0, 'Email is required'),

  phone: z
    .string()
    .trim()
    .refine(
      (val) => /^[0-9]{10}$/.test(val.replace(/\s/g, '')),
      'Phone number must be exactly 10 digits'
    )
    .transform((val) => val.replace(/\s/g, '')),

  numberOfTravellers: z
    .union([z.string(), z.number()])
    .transform((val) => (typeof val === 'string' ? parseInt(val, 10) : val))
    .refine((val) => !isNaN(val) && val >= 1, 'At least 1 traveller is required')
    .refine((val) => val <= 50, 'Maximum 50 travellers allowed'),

  departureCity: z
    .string()
    .max(100, 'Departure city cannot exceed 100 characters')
    .trim()
    .optional()
    .nullable()
    .transform((val) => val || null),

  specialRequest: z
    .string()
    .max(2000, 'Special request cannot exceed 2000 characters')
    .trim()
    .optional()
    .nullable()
    .transform((val) => val || null),

  tourTitle: z
    .string()
    .min(1, 'Tour title is required')
    .max(255, 'Tour title cannot exceed 255 characters')
    .trim(),

  tourId: z
    .string()
    .min(1, 'Tour ID is required')
    .max(100, 'Tour ID cannot exceed 100 characters')
    .trim(),

  submittedAt: z
    .string()
    .datetime('Invalid datetime format')
    .optional()
    .default(() => new Date().toISOString()),
});
