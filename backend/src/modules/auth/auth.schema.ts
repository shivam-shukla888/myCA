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

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;
