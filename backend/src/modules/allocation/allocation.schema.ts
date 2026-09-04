import { z } from 'zod';

export const financialProfileSchema = z.object({
  age: z.number().int().min(18, 'Age must be at least 18').max(120, 'Age must be at most 120').optional(),
  monthly_income: z.number().nonnegative('Monthly income cannot be negative').default(0),
  existing_liquid_savings: z.number().nonnegative('Liquid savings cannot be negative').default(0),
  existing_investments: z.number().nonnegative('Investments value cannot be negative').default(0),
  monthly_essential_expenses: z.number().nonnegative('Essential expenses cannot be negative').default(0),
  monthly_debt_obligations: z.number().nonnegative('Debt obligations cannot be negative').default(0),
  dependents: z.number().int().nonnegative('Dependents cannot be negative').default(0),
  has_health_insurance: z.boolean().default(false),
  has_life_insurance: z.boolean().default(false),
  emergency_fund_target_months: z.number().int().min(1, 'Target months must be at least 1').max(36, 'Target months must be at most 36').default(6),
  target_retirement_age: z.number().int().min(18, 'Target retirement age must be at least 18').max(120).optional(),
  desired_monthly_lifestyle_income: z.number().nonnegative('Desired lifestyle income cannot be negative').default(0),
});

export const updateFinancialProfileSchema = financialProfileSchema.partial();

export const goalSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(1000).optional(),
  goal_type: z.enum(['savings', 'investment', 'tax_planning', 'debt_reduction', 'emergency_fund', 'retirement', 'custom']).default('savings'),
  target_amount: z.number().positive('Target amount must be positive'),
  current_amount: z.number().nonnegative('Current amount cannot be negative').default(0),
  currency: z.string().length(3).default('INR'),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});

export const updateGoalSchema = goalSchema.partial();

export const generatePlanSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be in YYYY-MM format (01-12)'),
});

export type FinancialProfileInput = z.infer<typeof financialProfileSchema>;
export type UpdateFinancialProfileInput = z.infer<typeof updateFinancialProfileSchema>;
export type CreateGoalInput = z.infer<typeof goalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type GeneratePlanInput = z.infer<typeof generatePlanSchema>;

export interface FinancialProfile extends FinancialProfileInput {
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface FinancialGoal extends CreateGoalInput {
  id: string;
  user_id: string;
  status: 'active' | 'completed' | 'paused' | 'abandoned';
  created_at: string;
  updated_at: string;
}

export interface EmergencyFundCalculation {
  essential_monthly_expenses: number;
  target_months: number;
  emergency_fund_target: number;
  existing_liquid_savings: number;
  emergency_fund_gap: number;
  coverage_months: number;
  is_complete: boolean;
}

export interface AllocationBuckets {
  emergency_fund: number;
  goals: number;
  long_term_wealth: number;
  flexible_buffer: number;
  total_allocated: number;
}

export interface MonthlyAllocationPlan {
  id: string;
  user_id: string;
  month: string;
  monthly_income: number;
  monthly_expenses: number;
  monthly_surplus: number;
  is_deficit: boolean;
  emergency_fund: EmergencyFundCalculation;
  allocations: AllocationBuckets;
  explanation: {
    primary_summary: string;
    priority_order: string[];
    emergency_fund_rationale: string;
    goals_rationale: string;
    long_term_wealth_rationale: string;
    buffer_rationale: string;
    deficit_pressure_analysis?: {
      spending_pressure: string;
      essential_expense_ratio: number;
      debt_obligation_ratio: number;
      recommendation: string;
    };
  };
  financial_freedom: {
    current_savings_investments: number;
    monthly_surplus: number;
    emergency_fund_progress_pct: number;
    target_corpus_status: string; // "Target corpus not calculated yet"
    desired_monthly_lifestyle_income: number;
    target_age: number | null;
    current_age: number | null;
  };
  created_at: string;
  updated_at: string;
}
