import { z } from 'zod';

export const ALLOWED_REPORT_TYPES = [
  'tax_summary',
  'expense_breakdown',
  'gst_input_tax_credit',
  'financial_health',
  'checklist_itr',
] as const;

export const generateReportSchema = z.object({
  report_type: z.enum(ALLOWED_REPORT_TYPES, {
    errorMap: () => ({ message: `Invalid report type. Allowed: ${ALLOWED_REPORT_TYPES.join(', ')}` }),
  }),
  financial_year: z.string().regex(/^\d{4}-\d{2}$/, 'Financial year format must be YYYY-YY (e.g. 2025-26)').optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type GenerateReportInput = z.infer<typeof generateReportSchema>;
