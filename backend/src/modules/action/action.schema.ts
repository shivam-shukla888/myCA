import { z } from 'zod';
import { FinancialProfile, FinancialGoal } from '../allocation/allocation.schema.js';

export const actionPriorityEnum = z.enum([
  'P0_DEFICIT',
  'P1_EMERGENCY_FUND',
  'P2_DEBT',
  'P3_GOALS',
  'P4_WEALTH',
  'P5_BUFFER',
]);

export type ActionPriority = z.infer<typeof actionPriorityEnum>;

export interface ActionItem {
  priority: ActionPriority;
  priority_label: string; // e.g., "P1 — Emergency Reserve"
  category: 'emergency_fund' | 'debt' | 'goals' | 'long_term_wealth' | 'flexible_buffer' | 'deficit_stabilization';
  title: string;
  allocated_amount: number;
  required_amount: number;
  target_gap: number;
  why_rationale: string;
  is_funded: boolean;
  metadata?: Record<string, any>;
}

export interface RankedGoalActionItem {
  id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  remaining_amount: number;
  target_date: string | null;
  months_remaining: number;
  required_monthly_contribution: number;
  priority_rank: number;
  allocated_amount: number;
  ranking_rationale: string;
  is_user_prioritized: boolean;
  is_paused: boolean;
}

export interface UserActionOverride {
  custom_emergency_allocation?: number;
  prioritized_goal_id?: string;
  goal_priority_order?: string[]; // goal IDs in order of preference
  paused_goal_ids?: string[];
  custom_buffer_amount?: number;
  custom_wealth_allocation?: number;
}

export const userActionOverrideSchema = z.object({
  custom_emergency_allocation: z.number().nonnegative().optional(),
  prioritized_goal_id: z.string().uuid().optional(),
  goal_priority_order: z.array(z.string().uuid()).optional(),
  paused_goal_ids: z.array(z.string().uuid()).optional(),
  custom_buffer_amount: z.number().nonnegative().optional(),
  custom_wealth_allocation: z.number().nonnegative().optional(),
});

export interface DeficitAnalysis {
  is_deficit: boolean;
  monthly_deficit: number;
  essential_expense_ratio: number;
  debt_pressure_ratio: number;
  largest_spending_category?: {
    category: string;
    amount: number;
    percentage: number;
  };
  recommended_actions: string[];
}

export interface ActionFreedomComparison {
  current_monthly_contribution: number;
  required_monthly_contribution: number;
  contribution_gap: number;
  on_track: boolean;
  target_corpus: number;
  projected_wealth: number;
  target_age: number;
  selected_scenario: string;
  assumption_disclaimer: string;
}

export interface ActionPlan {
  id?: string;
  user_id?: string;
  month: string;
  monthly_income: number;
  monthly_expenses: number;
  monthly_surplus: number;
  is_deficit: boolean;
  actions: ActionItem[];
  ranked_goals: RankedGoalActionItem[];
  allocations: {
    emergency_fund: number;
    goals: number;
    long_term_wealth: number;
    flexible_buffer: number;
    total_allocated: number;
  };
  invariant_verified: boolean;
  deficit_analysis?: DeficitAnalysis;
  financial_freedom: ActionFreedomComparison;
  user_override_applied: boolean;
  user_overrides?: UserActionOverride;
  baseline_plan?: Omit<ActionPlan, 'baseline_plan'>;
  primary_summary: string;
  confirmed_at?: string;
  created_at?: string;
  updated_at?: string;
}

export const generateActionPlanSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be in YYYY-MM format').optional(),
  overrides: userActionOverrideSchema.optional(),
});

export const simulateActionPlanSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be in YYYY-MM format').optional(),
  surplus_delta: z.number().optional().default(0),
  expense_delta: z.number().optional().default(0),
  simulated_emergency_months: z.number().int().min(1).max(36).optional(),
  overrides: userActionOverrideSchema.optional(),
});

export type GenerateActionPlanInput = z.infer<typeof generateActionPlanSchema>;
export type SimulateActionPlanInput = z.infer<typeof simulateActionPlanSchema>;
