import { z } from 'zod';

export type BehavioralDimension =
  | 'SPENDING_CHANGES'
  | 'LIFESTYLE_INFLATION'
  | 'IMPULSE_SPENDING'
  | 'DECISION_FATIGUE'
  | 'PROCRASTINATION'
  | 'SOCIAL_COMPARISON'
  | 'EMOTIONAL_SPENDING'
  | 'GOAL_FATIGUE';

export const BEHAVIORAL_DIMENSIONS: BehavioralDimension[] = [
  'SPENDING_CHANGES',
  'LIFESTYLE_INFLATION',
  'IMPULSE_SPENDING',
  'DECISION_FATIGUE',
  'PROCRASTINATION',
  'SOCIAL_COMPARISON',
  'EMOTIONAL_SPENDING',
  'GOAL_FATIGUE',
];

export interface BehavioralInsight {
  dimension: BehavioralDimension;
  title: string;
  status: 'SUFFICIENT_DATA' | 'INSUFFICIENT_EVIDENCE';
  fact: string;
  calculation: string;
  interpretation: string;
  guidance: string;
  metric_delta?: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  data_points_analyzed: number;
  flagged_misleading_correlation: boolean;
  misleading_reason?: string;
  guardrails_passed: boolean;
}

export interface BehavioralAnalysisReport {
  month: string;
  overall_status: 'ANALYSIS_COMPLETE' | 'PARTIAL_DATA' | 'INSUFFICIENT_EVIDENCE';
  dimensions: Record<BehavioralDimension, BehavioralInsight>;
  disclaimer: string;
  ethical_guardrails: {
    no_mental_health_diagnosis: boolean;
    no_shaming: boolean;
    no_fear_mongering: boolean;
    no_guilt: boolean;
    no_manufactured_urgency: boolean;
  };
  sufficient_dimensions_count: number;
  insufficient_dimensions_count: number;
}

export const BehavioralInsightsQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});
