import { z } from 'zod';

export type ChangeType =
  | 'income_change'
  | 'expense_change'
  | 'surplus_change'
  | 'savings_rate_change'
  | 'largest_category_movement'
  | 'emergency_fund_progress'
  | 'investment_contribution_change'
  | 'goal_progress'
  | 'crore_timeline_change';

export interface ChangeSourceData {
  data_source: 'OBSERVED_LEDGER' | 'STATED_BASELINE' | 'DETERMINISTIC_MODEL';
  current_period: string;
  previous_period: string | null;
  formula_or_derivation: string;
  underlying_fields: string[];
  confidence: number;
}

export interface DetectedChange {
  id: string;
  change_type: ChangeType;
  title: string;
  headline: string;
  direction: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  materiality_score: number;
  materiality_level: 'CRITICAL' | 'SIGNIFICANT' | 'MODERATE';
  rank: number; // 1, 2, or 3
  current_value: number | null;
  previous_value: number | null;
  delta: number | null;
  delta_pct: number | null;
  unit: 'INR' | 'PERCENT' | 'MONTHS';
  formatted_delta: string;
  source_data: ChangeSourceData;
  deterministic_explanation: string;
  llm_narrative?: string;
}

export interface ChangeDetectionResult {
  current_period: string;
  previous_period: string | null;
  has_sufficient_history: boolean;
  insufficient_history_reason?: string;
  status: 'ANALYSIS_COMPLETE' | 'INSUFFICIENT_HISTORY' | 'NO_MATERIAL_CHANGES';
  total_changes_detected: number;
  top_changes: DetectedChange[]; // Max 3
  evaluation_timestamp: string;
  disclaimer: string;
}

export const ChangeDetectionQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  previous_month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});
