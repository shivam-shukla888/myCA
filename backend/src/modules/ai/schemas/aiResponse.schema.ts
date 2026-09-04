import { z } from 'zod';

export const INTENT_CATEGORIES = [
  'TRANSACTION_ANALYSIS',
  'PERSONAL_FINANCE',
  'TAX_QUERY',
  'GST_QUERY',
  'BUSINESS_STRATEGY',
  'INVESTMENT_EDUCATION',
  'DOCUMENT_ANALYSIS',
  'GENERAL_FINANCE',
  'UNSUPPORTED_HIGH_RISK',
  'OTHER',
] as const;

export type IntentCategory = (typeof INTENT_CATEGORIES)[number];

export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const evidenceSourceSchema = z.object({
  source_type: z.enum(['transaction', 'goal', 'document', 'calculation', 'domain_knowledge']),
  source_id: z.string().optional(),
  claim: z.string().min(1),
});

export const aiStructuredResponseSchema = z.object({
  answer: z.string().min(1, 'Answer must not be empty'),
  intent: z.enum(INTENT_CATEGORIES),
  risk_level: z.enum(RISK_LEVELS),
  confidence_score: z.number().min(0).max(1),
  evidence: z.array(evidenceSourceSchema).default([]),
  missing_information: z.array(z.string()).default([]),
  disclaimer_required: z.boolean(),
  disclaimer: z.string().default(''),
  human_review_required: z.boolean(),
  refusal_or_limitation: z.string().nullable().default(null),
});

export type AIStructuredResponse = z.infer<typeof aiStructuredResponseSchema>;

/**
 * Standard JSON schema descriptor for Gemini responseSchema
 */
export const geminiResponseSchema = {
  type: 'object',
  properties: {
    answer: { type: 'string', description: 'Accurate, evidence-grounded response text' },
    intent: { type: 'string', enum: INTENT_CATEGORIES },
    risk_level: { type: 'string', enum: RISK_LEVELS },
    confidence_score: { type: 'number', description: 'Confidence between 0.0 and 1.0' },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          source_type: { type: 'string', enum: ['transaction', 'goal', 'document', 'calculation', 'domain_knowledge'] },
          source_id: { type: 'string' },
          claim: { type: 'string' },
        },
        required: ['source_type', 'claim'],
      },
    },
    missing_information: { type: 'array', items: { type: 'string' } },
    disclaimer_required: { type: 'boolean' },
    disclaimer: { type: 'string' },
    human_review_required: { type: 'boolean' },
    refusal_or_limitation: { type: 'string', nullable: true },
  },
  required: [
    'answer',
    'intent',
    'risk_level',
    'confidence_score',
    'evidence',
    'missing_information',
    'disclaimer_required',
    'human_review_required',
  ],
};
