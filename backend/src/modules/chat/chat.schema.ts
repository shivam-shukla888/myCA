import { z } from 'zod';

export const sendChatSchema = z.object({
  message: z.string().min(1, 'Message is required').max(2000, 'Message cannot exceed 2000 characters'),
  conversation_id: z.string().uuid('Invalid conversation UUID').optional(),
  context_type: z.enum([
    'transaction_analysis',
    'tax_query',
    'financial_planning',
    'document_review',
    'gst_query',
    'general',
  ]).default('general'),
});

export type SendChatInput = z.infer<typeof sendChatSchema>;

export const monthlyReviewSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format')
    .optional(),
  conversation_id: z.string().uuid('Invalid conversation UUID').optional(),
});

export type MonthlyReviewInput = z.infer<typeof monthlyReviewSchema>;
