import { z } from 'zod';

export const TRANSACTION_TYPES = ['credit', 'debit', 'income', 'expense', 'transfer'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const baseTransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
  amount: z.number().finite('Amount must be a finite number').positive('Amount must be positive'),
  currency: z.string().length(3, 'Currency must be 3-letter ISO code').default('INR'),
  type: z.enum(TRANSACTION_TYPES),
  category: z.string().max(100).optional(),
  subcategory: z.string().max(100).optional(),
  merchant_name: z.string().max(200).optional(),
  account: z.string().max(100).optional(),
  is_tax_relevant: z.boolean().default(false),
  gst_applicable: z.boolean().default(false),
  gst_amount: z.number().nonnegative('GST amount cannot be negative').optional(),
  confidence_score: z.number().min(0).max(1).optional(),
  user_verified: z.boolean().default(false),
  notes: z.string().max(1000).optional(),
  document_id: z.string().uuid('Invalid document UUID').optional(),
});

export const createTransactionSchema = baseTransactionSchema.refine(
  (data) => !data.gst_applicable || data.gst_amount === undefined || data.gst_amount <= data.amount,
  {
    message: 'GST amount cannot exceed transaction amount',
    path: ['gst_amount'],
  }
);

export const updateTransactionSchema = baseTransactionSchema.partial().refine(
  (data) => !data.gst_applicable || data.gst_amount === undefined || data.amount === undefined || data.gst_amount <= data.amount,
  {
    message: 'GST amount cannot exceed transaction amount',
    path: ['gst_amount'],
  }
);

export const queryTransactionSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  category: z.string().optional(),
  is_tax_relevant: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const monthlySummaryQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be in YYYY-MM format with valid month (01-12)'),
});

export const transactionIdParamSchema = z.object({
  id: z.string().uuid('Transaction ID must be a valid UUID'),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type QueryTransactionInput = z.infer<typeof queryTransactionSchema>;
export type MonthlySummaryQuery = z.infer<typeof monthlySummaryQuerySchema>;

export interface MonthlyCategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

export interface MonthlyFinancialSummary {
  month: string; // YYYY-MM
  total_income: number;
  total_expenses: number;
  monthly_surplus: number;
  savings_rate: number; // percentage e.g. 35.71
  total_transfers: number;
  currency: string;
  categories: MonthlyCategoryBreakdown[];
  largest_expense_category: MonthlyCategoryBreakdown | null;
  transaction_count: {
    income: number;
    expenses: number;
    transfers: number;
    total: number;
  };
}
