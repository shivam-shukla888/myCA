import { z } from 'zod';
import {
  IntentCategory,
  RiskLevel,
  EvidenceSourceType,
  INTENT_CATEGORIES,
  RISK_LEVELS,
  EVIDENCE_SOURCE_TYPES,
} from '../schemas/aiResponse.schema.js';
import { GroundedChunkResult } from '../../knowledge/retrieval/rag.schema.js';
import { ConfidenceDimensions } from '../evaluation/confidenceEngine.js';

export const STATEMENT_TYPES = [
  'FACT',
  'CALCULATION',
  'ASSUMPTION',
  'INTERPRETATION',
  'GENERAL_GUIDANCE',
] as const;

export type StatementType = (typeof STATEMENT_TYPES)[number];

export const structuredStatementSchema = z.object({
  type: z.enum(STATEMENT_TYPES),
  statement: z.string().min(1),
  source_reference: z.string().optional(),
});

export type StructuredStatement = z.infer<typeof structuredStatementSchema>;

export const reasoningBreakdownSchema = z.object({
  facts: z.array(z.string()).default([]),
  calculations: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  interpretations: z.array(z.string()).default([]),
  general_guidance: z.array(z.string()).default([]),
});

export type ReasoningBreakdown = z.infer<typeof reasoningBreakdownSchema>;

export interface OrchestratedAnswerRequest {
  userId: string;
  query: string;
  conversationId?: string;
  targetMonth?: string;
  provider?: any;
  riskOverrides?: {
    forceRiskLevel?: RiskLevel;
  };
}

export interface OrchestratedAnswerResponse {
  answer: string;
  intent: IntentCategory;
  risk_level: RiskLevel;
  confidence_score: number;
  confidence_breakdown?: ConfidenceDimensions;
  reasoning_breakdown: ReasoningBreakdown;
  statements: StructuredStatement[];
  evidence: Array<{
    source_type: EvidenceSourceType;
    source_id?: string;
    claim: string;
  }>;
  verified_facts?: GroundedChunkResult[];
  deterministic_calculations?: Record<string, any>;
  missing_information: string[];
  disclaimer_required: boolean;
  disclaimer: string;
  human_review_required: boolean;
  refusal_or_limitation: string | null;
  provider_used: string;
  conversation_id: string;
  timestamp: string;
}
