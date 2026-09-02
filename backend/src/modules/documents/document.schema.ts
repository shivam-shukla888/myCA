import { z } from 'zod';

export const ALLOWED_DOCUMENT_TYPES = [
  'bank_statement',
  'tax_form_itr',
  'invoice',
  'receipt',
  'gst_return',
  'salary_slip',
  'form_16',
  'form_26as',
  'other',
] as const;

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/csv',
  'image/png',
  'image/jpeg',
] as const;

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

export const createDocumentSchema = z.object({
  file_name: z.string().min(1, 'File name is required').max(255, 'File name too long'),
  file_type: z.string().min(1).max(20),
  file_size_bytes: z.number().int().positive('File size must be positive').max(MAX_FILE_SIZE_BYTES, 'File size exceeds 10MB limit'),
  mime_type: z.enum(ALLOWED_MIME_TYPES, {
    errorMap: () => ({ message: `Unsupported MIME type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}` }),
  }),
  document_type: z.enum(ALLOWED_DOCUMENT_TYPES, {
    errorMap: () => ({ message: `Invalid document type. Allowed types: ${ALLOWED_DOCUMENT_TYPES.join(', ')}` }),
  }),
  financial_year: z.string().regex(/^\d{4}-\d{2}$/, 'Financial year must be format YYYY-YY (e.g. 2025-26)').optional(),
});

export const documentIdParamSchema = z.object({
  id: z.string().uuid('Document ID must be a valid UUID'),
});

export const queryDocumentSchema = z.object({
  document_type: z.enum(ALLOWED_DOCUMENT_TYPES).optional(),
  financial_year: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type QueryDocumentInput = z.infer<typeof queryDocumentSchema>;
