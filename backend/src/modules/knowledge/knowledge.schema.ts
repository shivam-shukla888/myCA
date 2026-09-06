import { z } from 'zod';

export const SOURCE_TYPES = [
  'BOOK',
  'PODCAST',
  'DOCUMENTARY',
  'ACADEMIC_RESEARCH',
  'OFFICIAL_REGULATORY',
  'GOVERNMENT',
  'EDUCATIONAL_ARTICLE',
  'OTHER_TRUSTED_SOURCE',
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export const AUTHORITY_LEVELS = [1, 2, 3, 4, 5, 6] as const;
export type AuthorityLevel = (typeof AUTHORITY_LEVELS)[number];

export const LICENSE_STATUSES = [
  'PUBLIC_DOMAIN',
  'OFFICIAL_GOVERNMENT_DOCUMENT',
  'PERMITTED_EXCERPT',
  'LICENSED_CONTENT',
  'INTERNAL_SUMMARY',
  'METADATA_ONLY',
] as const;

export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

export const SOURCE_STATUSES = [
  'ACTIVE',
  'PENDING_REVIEW',
  'ARCHIVED',
  'RETRACTED',
  'OUTDATED',
] as const;

export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export const CHUNK_TYPES = [
  'ORIGINAL_TEXT',
  'PERMITTED_EXCERPT',
  'SUMMARY',
  'REGULATORY_PROVISION',
  'KEY_TAKEAWAY',
] as const;

export type ChunkType = (typeof CHUNK_TYPES)[number];

// Input chunk schema for direct batch chunk ingestion
export const ingestChunkItemSchema = z.object({
  headline: z.string().min(1, 'Chunk headline is required').max(255),
  content: z.string().min(10, 'Chunk content must be at least 10 characters').max(10000),
  chunk_type: z.enum(CHUNK_TYPES),
  citation_page_or_section: z.string().optional(),
  is_summary: z.boolean().default(false),
  summary_attribution: z.string().optional(),
}).refine(
  (data) => {
    // If chunk_type is SUMMARY or is_summary is true, summary_attribution must be provided
    if (data.chunk_type === 'SUMMARY' || data.is_summary) {
      return Boolean(data.summary_attribution && data.summary_attribution.trim().length > 0);
    }
    return true;
  },
  {
    message: 'Summary chunks must explicitly provide summary_attribution (e.g. author/agent who generated it)',
    path: ['summary_attribution'],
  }
);

export type IngestChunkItem = z.infer<typeof ingestChunkItemSchema>;

export const ingestKnowledgeSourceSchema = z.object({
  source_id: z
    .string()
    .min(3, 'source_id slug must be at least 3 characters')
    .max(100)
    .regex(/^[a-z0-9_-]+$/, 'source_id must contain only lowercase letters, numbers, hyphens, and underscores'),
  title: z.string().min(3, 'Title must be at least 3 characters').max(500),
  author_or_organization: z.string().min(2, 'Author or organization must be at least 2 characters').max(300),
  source_type: z.enum(SOURCE_TYPES, {
    errorMap: () => ({ message: `Invalid source_type. Must be one of: ${SOURCE_TYPES.join(', ')}` }),
  }),
  topic: z.string().min(2, 'Topic is required').max(100),
  country: z.string().length(2, 'Country must be a 2-letter ISO code (e.g., IN)').default('IN'),
  publication_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'publication_date must be YYYY-MM-DD format')
    .optional(),
  last_verified_at: z.string().datetime({ offset: true }).optional(),
  authority_level: z
    .number()
    .int()
    .min(1, 'authority_level must be between 1 and 6')
    .max(6, 'authority_level must be between 1 and 6'),
  license_status: z.enum(LICENSE_STATUSES, {
    errorMap: () => ({ message: `Invalid license_status. Must be one of: ${LICENSE_STATUSES.join(', ')}` }),
  }),
  canonical_url: z.string().url('canonical_url must be a valid URL').optional().or(z.literal('')),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  status: z.enum(SOURCE_STATUSES).default('ACTIVE'),
  // Optional raw text to be auto-chunked OR pre-defined chunks
  raw_content: z.string().max(200000).optional(),
  chunks: z.array(ingestChunkItemSchema).optional(),
}).refine(
  (data) => {
    // If license_status is METADATA_ONLY, cannot ingest raw content or chunks
    if (data.license_status === 'METADATA_ONLY' && ((data.raw_content && data.raw_content.trim().length > 0) || (data.chunks && data.chunks.length > 0))) {
      return false;
    }
    return true;
  },
  {
    message: 'Sources with license_status METADATA_ONLY cannot store full text content or chunks',
    path: ['license_status'],
  }
);

export type IngestKnowledgeSourceInput = z.infer<typeof ingestKnowledgeSourceSchema>;

export const updateKnowledgeSourceStatusSchema = z.object({
  status: z.enum(SOURCE_STATUSES),
  reason: z.string().min(5, 'Reason for status update must be provided').max(500),
});

export type UpdateKnowledgeSourceStatusInput = z.infer<typeof updateKnowledgeSourceStatusSchema>;

export const queryKnowledgeSourceSchema = z.object({
  topic: z.string().optional(),
  source_type: z.enum(SOURCE_TYPES).optional(),
  authority_level: z.coerce.number().int().min(1).max(6).optional(),
  status: z.enum(SOURCE_STATUSES).default('ACTIVE'),
  country: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type QueryKnowledgeSourceInput = z.infer<typeof queryKnowledgeSourceSchema>;

export interface KnowledgeChunkRecord {
  id: string;
  chunk_id: string;
  source_id: string;
  source_slug: string;
  source_version: number;
  chunk_index: number;
  chunk_type: ChunkType;
  headline: string;
  content: string;
  content_hash: string;
  citation_page_or_section?: string;
  is_summary: boolean;
  summary_attribution?: string;
  prompt_injection_flagged: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeSourceRecord {
  id: string;
  source_id: string;
  version: number;
  title: string;
  author_or_organization: string;
  source_type: SourceType;
  topic: string;
  country: string;
  publication_date?: string;
  last_verified_at: string;
  authority_level: AuthorityLevel;
  license_status: LicenseStatus;
  canonical_url?: string;
  description: string;
  status: SourceStatus;
  content_hash?: string;
  chunks?: KnowledgeChunkRecord[];
  created_at: string;
  updated_at: string;
}

export interface ChunkProvenance {
  chunk_id: string;
  source_id: string;
  source_title: string;
  author_or_organization: string;
  source_type: SourceType;
  source_version: number;
  authority_level: AuthorityLevel;
  license_status: LicenseStatus;
  country: string;
  publication_date?: string;
  last_verified_at: string;
  canonical_url?: string;
  chunk_type: ChunkType;
  citation_page_or_section?: string;
  is_summary: boolean;
  summary_attribution?: string;
  content_hash: string;
}
