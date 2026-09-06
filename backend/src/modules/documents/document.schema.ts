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

export const ALLOWED_SOURCE_TYPES = ['DOCUMENT', 'IMAGE', 'VIDEO'] as const;

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
] as const;

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit for documents & photos
export const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50MB limit for video evidence
export const MAX_FILE_SIZE_BYTES = MAX_VIDEO_SIZE_BYTES;

const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.sh', '.msi', '.bin', '.dll', '.com', '.vbs', '.js', '.mjs',
  '.jar', '.war', '.php', '.py', '.rb', '.ps1', '.html', '.htm', '.svg', '.scr',
];

export const createDocumentSchema = z
  .object({
    file_name: z.string().min(1, 'File name is required').max(255, 'File name too long'),
    file_type: z.string().min(1).max(20),
    file_size_bytes: z.number().int().positive('File size must be positive').max(MAX_VIDEO_SIZE_BYTES, 'File size exceeds maximum limit'),
    mime_type: z.enum(ALLOWED_MIME_TYPES, {
      errorMap: () => ({ message: `Unsupported MIME type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}` }),
    }),
    document_type: z.enum(ALLOWED_DOCUMENT_TYPES, {
      errorMap: () => ({ message: `Invalid document type. Allowed types: ${ALLOWED_DOCUMENT_TYPES.join(', ')}` }),
    }),
    source_type: z.enum(ALLOWED_SOURCE_TYPES).optional(),
    title: z.string().max(255).nullish(),
    financial_year: z.string().regex(/^\d{4}-\d{2}$/, 'Financial year must be format YYYY-YY (e.g. 2025-26)').optional(),
  })
  .superRefine((data, ctx) => {
    const lowerName = data.file_name.toLowerCase();

    // Check dangerous extensions
    for (const ext of DANGEROUS_EXTENSIONS) {
      if (lowerName.endsWith(ext)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Executable or script extension ${ext} is strictly prohibited for evidence security`,
          path: ['file_name'],
        });
        return;
      }
    }

    // Size limit check per source type
    const isVideo = data.mime_type.startsWith('video/');
    if (!isVideo && data.file_size_bytes > MAX_DOCUMENT_SIZE_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `File size exceeds 10MB limit for non-video evidence (${(data.file_size_bytes / (1024 * 1024)).toFixed(1)}MB provided)`,
        path: ['file_size_bytes'],
      });
    }

    // Validate MIME vs Extension correlation
    if (data.mime_type === 'application/pdf' && !lowerName.endsWith('.pdf')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MIME type application/pdf requires .pdf file extension',
        path: ['file_name'],
      });
    } else if (data.mime_type === 'image/png' && !lowerName.endsWith('.png')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MIME type image/png requires .png file extension',
        path: ['file_name'],
      });
    } else if (data.mime_type === 'image/jpeg' && !lowerName.endsWith('.jpg') && !lowerName.endsWith('.jpeg')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MIME type image/jpeg requires .jpg or .jpeg file extension',
        path: ['file_name'],
      });
    } else if (data.mime_type === 'image/webp' && !lowerName.endsWith('.webp')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MIME type image/webp requires .webp file extension',
        path: ['file_name'],
      });
    } else if (data.mime_type === 'video/mp4' && !lowerName.endsWith('.mp4')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MIME type video/mp4 requires .mp4 file extension',
        path: ['file_name'],
      });
    } else if (data.mime_type === 'video/quicktime' && !lowerName.endsWith('.mov')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MIME type video/quicktime requires .mov file extension',
        path: ['file_name'],
      });
    } else if (data.mime_type === 'video/webm' && !lowerName.endsWith('.webm')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MIME type video/webm requires .webm file extension',
        path: ['file_name'],
      });
    }
  });

export const documentIdParamSchema = z.object({
  id: z.string().uuid('Document ID must be a valid UUID'),
});

export const queryDocumentSchema = z.object({
  document_type: z.enum(ALLOWED_DOCUMENT_TYPES).optional(),
  source_type: z.enum(ALLOWED_SOURCE_TYPES).optional(),
  verification_status: z.enum(['unverified', 'draft_ready', 'user_confirmed', 'rejected']).optional(),
  financial_year: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type QueryDocumentInput = z.infer<typeof queryDocumentSchema>;
