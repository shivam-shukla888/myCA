import { getSupabaseAdminClient } from '../../config/supabase.js';
import { env } from '../../config/env.js';
import { AppError } from '../../middleware/errorHandler.js';
import { transactionService } from '../transactions/transaction.service.js';
import { allocationService } from '../allocation/allocation.service.js';
import { runFreedomAnalysis } from './freedom.engine.js';
import {
  FreedomAnalysisResponse,
  FreedomSimulationInput,
  PlanningScenarioName,
  SCENARIO_PRESETS,
} from './freedom.schema.js';

// Fallback in-memory storage for test/development environments without live DB
const inMemoryAssumptions = new Map<
  string,
  Partial<{
    planning_inflation_rate: number;
    planning_expected_return: number;
    planning_withdrawal_rate: number;
    planning_scenario: PlanningScenarioName;
  }>
>();

export class FreedomService {
  /**
   * Retrieves full financial freedom status based on stored profile and live transaction surplus
   */
  async getFreedomStatus(userId: string): Promise<FreedomAnalysisResponse> {
    if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    // 1. Fetch user's profile via allocationService
    const profile = await allocationService.getProfile(userId);

    // Baseline inputs from profile (or defaults)
    const currentAge = profile?.age ?? 30;
    const targetAge = profile?.target_retirement_age ?? 55;
    const existingInvestments = Number(profile?.existing_investments ?? 0);
    const liquidSavings = Number(profile?.existing_liquid_savings ?? 0);
    const emergencyMonthsTarget = Number(profile?.emergency_fund_target_months ?? 6);

    // 2. Fetch current month's transaction summary to determine baseline monthly expenses and surplus
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthlySummary = await transactionService.getMonthlySummary(userId, currentMonthStr);

    const monthlyExpenses = monthlySummary.total_expenses > 0
      ? monthlySummary.total_expenses
      : (profile?.monthly_essential_expenses ? Number(profile.monthly_essential_expenses) : 50000);

    const desiredMonthlyLifestyleIncome = Number(profile?.desired_monthly_lifestyle_income) > 0
      ? Number(profile?.desired_monthly_lifestyle_income)
      : monthlyExpenses;

    const monthlySurplus = monthlySummary.monthly_surplus;

    // Compute emergency fund target in currency
    const emergencyFundTarget = (profile?.monthly_essential_expenses ? Number(profile.monthly_essential_expenses) : monthlyExpenses) * emergencyMonthsTarget;

    // 3. Extract planning assumptions (from profile or inMemoryAssumptions or fallback to Base preset)
    const storedAssumptions = inMemoryAssumptions.get(userId);
    const activeScenario: PlanningScenarioName =
      storedAssumptions?.planning_scenario ||
      ((profile as any)?.planning_scenario as PlanningScenarioName) ||
      'base';
    const preset = SCENARIO_PRESETS[activeScenario] || SCENARIO_PRESETS.base;

    const returnPct = storedAssumptions?.planning_expected_return ??
      ((profile as any)?.planning_expected_return != null
        ? Number((profile as any).planning_expected_return)
        : preset.expected_return);

    const inflationPct = storedAssumptions?.planning_inflation_rate ??
      ((profile as any)?.planning_inflation_rate != null
        ? Number((profile as any).planning_inflation_rate)
        : preset.inflation_rate);

    const withdrawalPct = storedAssumptions?.planning_withdrawal_rate ??
      ((profile as any)?.planning_withdrawal_rate != null
        ? Number((profile as any).planning_withdrawal_rate)
        : preset.withdrawal_rate);

    return runFreedomAnalysis({
      currentAge,
      targetAge,
      desiredMonthlyLifestyleIncome,
      monthlyContribution: monthlySurplus,
      existingLiquidSavings: liquidSavings,
      existingInvestments,
      emergencyFundTarget,
      activeScenarioName: activeScenario,
      customReturnPct: returnPct,
      customInflationPct: inflationPct,
      customWithdrawalPct: withdrawalPct,
    });
  }

  /**
   * Runs pure what-if simulation without mutating persistent records
   */
  async simulate(userId: string, input: FreedomSimulationInput): Promise<FreedomAnalysisResponse> {
    if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    const profile = await allocationService.getProfile(userId);

    const currentAge = input.current_age ?? profile?.age ?? 30;
    const targetAge = input.target_age ?? profile?.target_retirement_age ?? 55;
    if (targetAge <= currentAge) {
      throw new AppError('Target financial freedom age must be strictly greater than current age', 400, 'INVALID_INPUT');
    }

    const existingInvestments = input.existing_investments ?? Number(profile?.existing_investments ?? 0);
    const liquidSavings = input.existing_liquid_savings ?? Number(profile?.existing_liquid_savings ?? 0);
    const emergencyMonthsTarget = Number(profile?.emergency_fund_target_months ?? 6);

    let monthlyContribution = input.monthly_contribution;
    let desiredMonthlyLifestyleIncome = input.desired_monthly_lifestyle_income;

    if (monthlyContribution === undefined || desiredMonthlyLifestyleIncome === undefined) {
      const now = new Date();
      const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const summary = await transactionService.getMonthlySummary(userId, currentMonthStr);

      const baselineExpenses = summary.total_expenses > 0
        ? summary.total_expenses
        : (profile?.monthly_essential_expenses ? Number(profile.monthly_essential_expenses) : 50000);

      if (desiredMonthlyLifestyleIncome === undefined) {
        desiredMonthlyLifestyleIncome = Number(profile?.desired_monthly_lifestyle_income) > 0
          ? Number(profile?.desired_monthly_lifestyle_income)
          : baselineExpenses;
      }

      if (monthlyContribution === undefined) {
        monthlyContribution = summary.monthly_surplus;
      }
    }

    const emergencyTarget = input.emergency_fund_target ??
      ((profile?.monthly_essential_expenses ? Number(profile.monthly_essential_expenses) : 50000) * emergencyMonthsTarget);

    const storedAssumptions = inMemoryAssumptions.get(userId);
    const activeScenario: PlanningScenarioName =
      input.scenario ||
      storedAssumptions?.planning_scenario ||
      ((profile as any)?.planning_scenario as PlanningScenarioName) ||
      'base';
    const preset = SCENARIO_PRESETS[activeScenario] || SCENARIO_PRESETS.base;

    const returnPct = input.expected_return ??
      storedAssumptions?.planning_expected_return ??
      ((profile as any)?.planning_expected_return != null ? Number((profile as any).planning_expected_return) : preset.expected_return);

    const inflationPct = input.inflation_rate ??
      storedAssumptions?.planning_inflation_rate ??
      ((profile as any)?.planning_inflation_rate != null ? Number((profile as any).planning_inflation_rate) : preset.inflation_rate);

    const withdrawalPct = input.withdrawal_rate ??
      storedAssumptions?.planning_withdrawal_rate ??
      ((profile as any)?.planning_withdrawal_rate != null ? Number((profile as any).planning_withdrawal_rate) : preset.withdrawal_rate);

    return runFreedomAnalysis({
      currentAge,
      targetAge,
      desiredMonthlyLifestyleIncome,
      monthlyContribution,
      existingLiquidSavings: liquidSavings,
      existingInvestments,
      emergencyFundTarget: emergencyTarget,
      activeScenarioName: activeScenario,
      customReturnPct: returnPct,
      customInflationPct: inflationPct,
      customWithdrawalPct: withdrawalPct,
    });
  }

  /**
   * Persists planning assumptions to public.financial_profiles (with dev fallback)
   */
  async saveAssumptions(
    userId: string,
    assumptions: {
      planning_inflation_rate?: number;
      planning_expected_return?: number;
      planning_withdrawal_rate?: number;
      planning_scenario?: PlanningScenarioName;
    }
  ): Promise<any> {
    if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    const isProduction = env.NODE_ENV === 'production';
    const now = new Date().toISOString();

    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('financial_profiles')
        .update({
          planning_inflation_rate: assumptions.planning_inflation_rate,
          planning_expected_return: assumptions.planning_expected_return,
          planning_withdrawal_rate: assumptions.planning_withdrawal_rate,
          planning_scenario: assumptions.planning_scenario,
          updated_at: now,
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        if (isProduction) {
          throw new AppError(`Failed to save planning assumptions: ${error.message}`, 500, 'DATABASE_PERSISTENCE_FAILED');
        }
      } else if (data) {
        inMemoryAssumptions.set(userId, assumptions);
        return data;
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Failed to save assumptions in production database', 500, 'DATABASE_PERSISTENCE_FAILED');
      }
    }

    inMemoryAssumptions.set(userId, assumptions);
    return {
      user_id: userId,
      ...assumptions,
      updated_at: now,
    };
  }

  /**
   * Helper for tests to inspect inMemoryAssumptions
   */
  getInMemoryAssumptions(userId: string) {
    return inMemoryAssumptions.get(userId);
  }
}

export const freedomService = new FreedomService();
