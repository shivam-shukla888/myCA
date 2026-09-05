import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email('Valid email address required'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  full_name: z.string().min(1, 'Full name is required').max(100),
});

export const loginSchema = z.object({
  email: z.string().email('Valid email address required'),
  password: z.string().min(1, 'Password is required'),
});

export const magicLinkSchema = z.object({
  email: z.string().email('Valid email address required'),
  redirect_to: z.string().url('Redirect URL must be a valid URL').optional(),
});

export const updateProfileSchema = z.object({
  full_name: z.string().min(1, 'Full name cannot be empty').max(100).optional(),
  phone: z.string().max(20).nullable().optional(),
  business_type: z.string().max(50).optional(),
  preferred_language: z.string().max(10).optional(),
  financial_year_start: z.number().int().min(1).max(12).optional(),
  onboarding_completed: z.boolean().optional(),
}).strict();

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

