import { AppError } from '../../middleware/errorHandler.js';
import { canonicalFinanceService, CanonicalFinancialState } from '../finance/canonicalFinance.service.js';
import { calculateCroreShortestPath, CroreCalculationResult } from './crore.engine.js';
import { SimulateCroreInput } from './crore.schema.js';

export interface UserCroreStatusResponse {
  canonical_state: CanonicalFinancialState;
  calculation: CroreCalculationResult;
  missing_inputs: string[];
  is_available: boolean;
  status: 'READY' | 'INSUFFICIENT_DATA';
}

export class CroreService {
  /**
   * Generates live ₹1 Crore shortest path analysis based on the user's canonical financial context.
   * If required baseline inputs are unknown, flags status as INSUFFICIENT_DATA and avoids fabricating target dates.
   */
  async getUserCroreStatus(userId: string, targetMonth?: string): Promise<UserCroreStatusResponse> {
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const state = await canonicalFinanceService.getCanonicalFinancialState(userId, targetMonth);

    const hasSufficientData = Boolean(
      state.data_status.has_observed_transactions ||
      state.income.monthly_net_income !== null ||
      state.expenses.total_monthly_expenses !== null ||
      state.capital_and_savings.existing_investments !== null
    );

    // Starting capital = existing investments + excess liquid savings (over emergency fund)
    const startingCapital = state.capital_and_savings.current_investable_capital ?? 0;

    // Monthly contribution = investment capacity or positive surplus
    const monthlyContribution = state.capital_and_savings.monthly_investment_capacity ?? (
      state.cashflow.monthly_surplus !== null && state.cashflow.monthly_surplus > 0
        ? state.cashflow.monthly_surplus
        : 0
    );

    const calculation = calculateCroreShortestPath({
      startingCapital,
      currentMonthlyContribution: monthlyContribution,
      assumedAnnualReturnPct: state.assumptions.expected_return_pct,
      currentMonthlyIncome: state.income.monthly_net_income ?? undefined,
      currentMonthlyExpenses: state.expenses.total_monthly_expenses ?? undefined,
    });

    if (!hasSufficientData) {
      calculation.base_case.target_date = null;
      calculation.base_case.months_to_target = null;
      calculation.base_case.years_to_target = null;
      calculation.shortest_modeled_path.target_date = null;
      calculation.shortest_modeled_path.months_to_target = null;
      calculation.shortest_modeled_path.years_to_target = null;
      calculation.improved_case.target_date = null;
      calculation.improved_case.months_to_target = null;
      calculation.accelerated_case.target_date = null;
      calculation.accelerated_case.months_to_target = null;
      calculation.capital_only_case.target_date = null;
      calculation.capital_only_case.months_to_target = null;
      calculation.one_next_action = 'Set up your financial baseline or record transactions to unlock your ₹1 Crore trajectory.';
    }

    return {
      canonical_state: state,
      calculation,
      missing_inputs: state.missing_fields,
      is_available: hasSufficientData,
      status: hasSufficientData ? 'READY' : 'INSUFFICIENT_DATA',
    };
  }

  /**
   * Runs what-if simulation without mutating persistent profile.
   */
  async simulateShortestPath(userId: string, input: SimulateCroreInput): Promise<CroreCalculationResult> {
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const state = await canonicalFinanceService.getCanonicalFinancialState(userId);

    const startingCapital = input.starting_capital !== undefined
      ? input.starting_capital
      : (state.capital_and_savings.current_investable_capital ?? 0);

    const monthlyContribution = input.monthly_contribution !== undefined
      ? input.monthly_contribution
      : (state.capital_and_savings.monthly_investment_capacity ?? (state.cashflow.actual_monthly_surplus && state.cashflow.actual_monthly_surplus > 0 ? state.cashflow.actual_monthly_surplus : 0));

    const annualReturn = input.annual_return_pct !== undefined
      ? input.annual_return_pct
      : state.assumptions.expected_return_pct;

    return calculateCroreShortestPath({
      startingCapital,
      currentMonthlyContribution: monthlyContribution,
      assumedAnnualReturnPct: annualReturn,
      annualStepupPct: input.annual_stepup_pct,
      currentMonthlyIncome: input.monthly_income ?? (state.income.monthly_net_income ?? undefined),
      currentMonthlyExpenses: input.monthly_expenses ?? (state.expenses.total_monthly_expenses ?? undefined),
    });
  }
}

export const croreService = new CroreService();
