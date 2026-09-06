import { z } from 'zod';

export interface FinancialMetricChange {
  current: number | null;
  previous: number | null;
  delta: number | null;
  delta_pct: number | null;
  direction: 'IMPROVED' | 'DEGRADED' | 'UNCHANGED' | 'BASELINE';
}

export interface ReviewMilestone {
  id:
    | 'first_positive_surplus'
    | 'emergency_fund_fully_funded'
    | 'savings_rate_improvement'
    | 'target_acceleration'
    | 'debt_reduction'
    | 'consistent_positive_cashflow';
  title: string;
  status: 'ACHIEVED' | 'IN_PROGRESS' | 'LOCKED';
  description: string;
  progress_pct?: number;
  achieved_date?: string | null;
}

export interface StructuredMonthlyReview {
  month: string;
  has_prior_month_data: boolean;
  prior_month_note?: string;

  // 1. What changed?
  what_changed: {
    summary: string;
    income: FinancialMetricChange;
    expenses: FinancialMetricChange;
    surplus: FinancialMetricChange;
    savings_rate: FinancialMetricChange;
  };

  // 2. Why did it change?
  why_it_changed: {
    summary: string;
    top_category_drivers: Array<{
      category: string;
      current_amount: number;
      previous_amount: number | null;
      delta: number | null;
      percentage_of_total_change?: number;
    }>;
  };

  // 3. What improved?
  what_improved: {
    items: string[];
    summary: string;
  };

  // 4. What got worse?
  what_got_worse: {
    items: string[];
    summary: string;
  };

  // 5. What is my current surplus?
  current_surplus: {
    amount: number | null;
    formatted: string;
    is_deficit: boolean;
    formula_breakdown: string;
    status_label: string;
  };

  // 6. How is my savings rate changing?
  savings_rate_trend: {
    current_rate: number | null;
    previous_rate: number | null;
    delta_percentage_points: number | null;
    trend_description: string;
  };

  // 7. How is my emergency fund progressing?
  emergency_fund_progress: {
    current_amount: number;
    target_amount: number;
    gap_amount: number;
    coverage_months: number;
    progress_pct: number;
    status: 'FULLY_FUNDED' | 'IN_PROGRESS' | 'NEEDS_ATTENTION';
    month_over_month_change?: string;
  };

  // 8. Did my ₹1Cr path accelerate or slow down?
  crore_path_trajectory: {
    status: 'ACCELERATED' | 'SLOWED_DOWN' | 'PACE_MAINTAINED' | 'BASELINE_ESTABLISHED' | 'UNAVAILABLE';
    current_target_date: string | null;
    previous_target_date: string | null;
    current_months_to_target: number | null;
    previous_months_to_target: number | null;
    months_delta: number | null; // negative means reached earlier (faster)
    summary: string;
  };

  // 9. What ONE action matters next?
  one_action_matters_next: {
    action: string;
    reason: string;
    priority_area: 'EMERGENCY_RESERVE' | 'HIGH_COST_DEBT' | 'EXPENSE_DISCIPLINE' | 'COMPOUNDING_SIP' | 'CAPITAL_PRESERVATION';
  };

  // Meaningful milestones
  milestones: ReviewMilestone[];

  // Anti-Dark Pattern Guarantees
  anti_dark_pattern_compliance: {
    no_streak_anxiety: boolean;
    no_shaming: boolean;
    no_fear: boolean;
    no_fomo: boolean;
    no_fake_urgency: boolean;
    no_excessive_notifications: boolean;
  };
}

export const MonthlyReviewQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});
