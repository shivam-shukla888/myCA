import { z } from 'zod';

export const SCENARIO_PRESETS = {
  conservative: {
    expected_return: 8.0,
    inflation_rate: 7.0,
    withdrawal_rate: 3.5,
  },
  base: {
    expected_return: 10.0,
    inflation_rate: 6.0,
    withdrawal_rate: 4.0,
  },
  optimistic: {
    expected_return: 12.0,
    inflation_rate: 5.0,
    withdrawal_rate: 4.5,
  },
} as const;

export type PlanningScenarioName = 'conservative' | 'base' | 'optimistic';

export const planningAssumptionsSchema = z.object({
  planning_inflation_rate: z.number().min(0, 'Inflation rate cannot be negative').max(30, 'Inflation rate cannot exceed 30%').default(6.0),
  planning_expected_return: z.number().min(0, 'Expected return cannot be negative').max(40, 'Expected return cannot exceed 40%').default(10.0),
  planning_withdrawal_rate: z.number().positive('Withdrawal rate must be positive').max(20, 'Withdrawal rate cannot exceed 20%').default(4.0),
  planning_scenario: z.enum(['conservative', 'base', 'optimistic']).default('base'),
});

export const updatePlanningAssumptionsSchema = planningAssumptionsSchema.partial();

export const freedomSimulationInputSchema = z
  .object({
    current_age: z.number().int().min(18, 'Current age must be at least 18').max(120, 'Current age must be at most 120').optional(),
    target_age: z.number().int().min(18, 'Target age must be at least 18').max(120, 'Target age must be at most 120').optional(),
    desired_monthly_lifestyle_income: z.number().nonnegative('Desired monthly lifestyle income cannot be negative').optional(),
    monthly_contribution: z.number().nonnegative('Monthly contribution cannot be negative').optional(),
    existing_liquid_savings: z.number().nonnegative('Liquid savings cannot be negative').optional(),
    existing_investments: z.number().nonnegative('Investments cannot be negative').optional(),
    emergency_fund_target: z.number().nonnegative('Emergency fund target cannot be negative').optional(),
    inflation_rate: z.number().min(0, 'Inflation rate cannot be negative').max(30).optional(),
    expected_return: z.number().min(0, 'Expected return cannot be negative').max(40).optional(),
    withdrawal_rate: z.number().positive('Withdrawal rate must be positive').max(20).optional(),
    scenario: z.enum(['conservative', 'base', 'optimistic']).optional(),
  })
  .refine(
    (data) => {
      if (data.current_age !== undefined && data.target_age !== undefined) {
        return data.target_age > data.current_age;
      }
      return true;
    },
    {
      message: 'Target financial freedom age must be strictly greater than current age',
      path: ['target_age'],
    }
  );

export type PlanningAssumptionsInput = z.infer<typeof planningAssumptionsSchema>;
export type UpdatePlanningAssumptionsInput = z.infer<typeof updatePlanningAssumptionsSchema>;
export type FreedomSimulationInput = z.infer<typeof freedomSimulationInputSchema>;

export type FreedomStatusLevel = 'Ahead of Target' | 'On Track' | 'Behind Target';

export interface FreedomScenarioResult {
  scenario_name: 'conservative' | 'base' | 'optimistic';
  expected_return_pct: number;
  inflation_rate_pct: number;
  withdrawal_rate_pct: number;
  future_monthly_lifestyle_need: number;
  future_annual_lifestyle_need: number;
  indicative_target_corpus: number;
  initial_investable_wealth: number;
  projected_wealth_at_target_age: number;
  funding_gap: number;
  funding_surplus: number;
  required_monthly_contribution: number;
  current_monthly_contribution: number;
  status: FreedomStatusLevel;
  explanation: string;
}

export interface FreedomAnalysisResponse {
  current_age: number;
  target_age: number;
  years_to_freedom: number;
  months_to_freedom: number;
  current_monthly_surplus: number;
  existing_liquid_savings: number;
  existing_investments: number;
  emergency_fund_target: number;
  emergency_fund_reserve: number;
  initial_investable_wealth: number;
  active_scenario_name: 'conservative' | 'base' | 'optimistic';
  active_scenario: FreedomScenarioResult;
  scenarios: {
    conservative: FreedomScenarioResult;
    base: FreedomScenarioResult;
    optimistic: FreedomScenarioResult;
  };
  formula_transparency: {
    future_expense_formula: string;
    target_corpus_formula: string;
    future_wealth_formula: string;
    required_contribution_formula: string;
  };
  assumptions_disclaimer: string;
}
