import { z } from 'zod';
import { AuthorityLevel, ChunkType, LicenseStatus, SourceType } from '../knowledge.schema.js';

export const RETRIEVAL_CATEGORIES = [
  'EDUCATIONAL',
  'PERSONAL_FINANCE',
  'BEHAVIORAL_FINANCE',
  'CURRENT_REGULATION',
  'TAX',
  'INVESTING_EDUCATION',
  'ECONOMIC',
  'FINANCIAL_INDEPENDENCE',
] as const;

export type RetrievalCategory = (typeof RETRIEVAL_CATEGORIES)[number];

export const RETRIEVAL_STATUSES = [
  'CONFIDENT',
  'PARTIAL_EVIDENCE',
  'INSUFFICIENT_EVIDENCE',
] as const;

export type RetrievalStatus = (typeof RETRIEVAL_STATUSES)[number];

export const retrievalQuerySchema = z.object({
  query: z.string().min(2, 'Query must be at least 2 characters').max(1000),
  category: z.enum(RETRIEVAL_CATEGORIES).optional(),
  jurisdiction: z.string().length(2).default('IN').optional(),
  max_chunks: z.number().int().min(1).max(10).default(5),
  min_authority_tier: z.number().int().min(1).max(6).optional(),
});

export type RetrievalQuery = z.infer<typeof retrievalQuerySchema>;

export interface GroundedChunkResult {
  chunk_id: string;
  source_id: string;
  source_title: string;
  author_or_organization: string;
  source_type: SourceType;
  source_version: number;
  authority_level: AuthorityLevel;
  country: string;
  publication_date?: string;
  last_verified_at: string;
  canonical_url?: string;
  license_status: LicenseStatus;
  chunk_type: ChunkType;
  headline: string;
  content: string;
  citation_page_or_section?: string;
  is_summary: boolean;
  summary_attribution?: string;
  relevance_score: number;
  authority_score: number;
  jurisdiction_score: number;
  recency_score: number;
  final_score: number;
}

export interface RetrievalResult {
  query: string;
  detected_category: RetrievalCategory;
  status: RetrievalStatus;
  confidence_score: number;
  chunks: GroundedChunkResult[];
  source_grounded_context: string;
  explanation: string;
  retrieved_at: string;
}
