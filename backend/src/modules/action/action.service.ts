import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../../middleware/errorHandler.js';
import { getSupabaseAdminClient } from '../../config/supabase.js';
import { env } from '../../config/env.js';
import { transactionService } from '../transactions/transaction.service.js';
import { allocationService } from '../allocation/allocation.service.js';
import { freedomService } from '../freedom/freedom.service.js';
import {
  ActionPlan,
  UserActionOverride,
  SimulateActionPlanInput,
} from './action.schema.js';
import { buildFinancialActionPlan, ActionEngineInput } from './action.engine.js';
import { round2 } from '../allocation/allocation.engine.js';

// Fallback in-memory cache for development/testing environments without live DB
const inMemoryConfirmedActionPlans = new Map<string, ActionPlan>();

export class ActionService {
  /**
   * Generates deterministic action plan for a specific month.
   */
  async generateActionPlan(
    userId: string,
    month: string,
    overrides?: UserActionOverride
  ): Promise<ActionPlan> {
    if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    const isProduction = env.NODE_ENV === 'production';

    // 1. Fetch Phase 2 monthly summary
    const summary = await transactionService.getMonthlySummary(userId, month);

    // 2. Fetch Phase 3 profile and goals
    const profile = (await allocationService.getProfile(userId)) || {
      user_id: userId,
      monthly_income: summary.total_income,
      monthly_essential_expenses: summary.total_expenses,
      existing_liquid_savings: 0,
      existing_investments: 0,
      monthly_debt_obligations: 0,
      dependents: 0,
      has_health_insurance: false,
      has_life_insurance: false,
      emergency_fund_target_months: 6,
      desired_monthly_lifestyle_income: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const goals = await allocationService.listGoals(userId);

    // 3. Fetch Phase 4 freedom status
    let freedomStatus: ActionEngineInput['freedomStatus'] = undefined;
    try {
      const freedom = await freedomService.getFreedomStatus(userId);
      freedomStatus = {
        indicative_target_corpus: freedom.active_scenario.indicative_target_corpus,
        projected_wealth: freedom.active_scenario.projected_wealth_at_target_age,
        required_monthly_contribution: freedom.active_scenario.required_monthly_contribution,
        current_wealth: freedom.initial_investable_wealth,
        target_age: freedom.target_age,
        selected_scenario: freedom.active_scenario_name,
        on_track: freedom.active_scenario.status !== 'Behind Target',
      };
    } catch (err) {
      // Safe fallback if freedom calculator has no profile age/targets yet
      freedomStatus = {
        indicative_target_corpus: 0,
        projected_wealth: Number(profile.existing_investments || 0),
        required_monthly_contribution: 0,
        current_wealth: Number(profile.existing_investments || 0),
        target_age: profile.target_retirement_age || 55,
        selected_scenario: 'base',
        on_track: true,
      };
    }

    // Extract largest spending category
    let largestExpenseCategory: ActionEngineInput['largestExpenseCategory'] = undefined;
    if (summary.largest_expense_category) {
      largestExpenseCategory = summary.largest_expense_category;
    } else if (summary.categories && summary.categories.length > 0) {
      const top = summary.categories[0];
      largestExpenseCategory = {
        category: top.category,
        amount: top.amount,
        percentage: top.percentage,
      };
    }

    const baseInput: ActionEngineInput = {
      month,
      income: summary.total_income,
      expenses: summary.total_expenses,
      profile,
      goals,
      freedomStatus,
      largestExpenseCategory,
    };

    // Calculate baseline plan
    const baselinePlan = buildFinancialActionPlan(baseInput);

    // If overrides are requested, calculate user-adjusted plan and attach baseline
    if (overrides && Object.keys(overrides).length > 0) {
      const overriddenPlan = buildFinancialActionPlan({
        ...baseInput,
        overrides,
      });

      return {
        ...overriddenPlan,
        baseline_plan: baselinePlan,
      };
    }

    return baselinePlan;
  }

  /**
   * Confirms and locks a monthly action plan into the historical record.
   * Ensures historical immutability: once confirmed, changing today's profile does not mutate the past.
   */
  async confirmActionPlan(
    userId: string,
    month: string,
    overrides?: UserActionOverride
  ): Promise<ActionPlan> {
    if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    const plan = await this.generateActionPlan(userId, month, overrides);
    const now = new Date().toISOString();
    const planId = uuidv4();

    const confirmedPlan: ActionPlan = {
      ...plan,
      id: planId,
      user_id: userId,
      confirmed_at: now,
      created_at: now,
      updated_at: now,
    };

    const isProduction = env.NODE_ENV === 'production';

    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('monthly_allocation_plans')
        .upsert(
          {
            user_id: userId,
            month: confirmedPlan.month,
            monthly_income: confirmedPlan.monthly_income,
            monthly_expenses: confirmedPlan.monthly_expenses,
            monthly_surplus: confirmedPlan.monthly_surplus,
            emergency_fund_target: confirmedPlan.actions.find((a) => a.category === 'emergency_fund')?.target_gap || 0,
            emergency_fund_current: Number(confirmedPlan.actions.find((a) => a.category === 'emergency_fund')?.metadata?.current_amount || 0),
            emergency_fund_gap: confirmedPlan.actions.find((a) => a.category === 'emergency_fund')?.target_gap || 0,
            emergency_fund_allocation: confirmedPlan.allocations.emergency_fund,
            goals_allocation: confirmedPlan.allocations.goals,
            long_term_wealth_allocation: confirmedPlan.allocations.long_term_wealth,
            flexible_buffer_allocation: confirmedPlan.allocations.flexible_buffer,
            is_deficit: confirmedPlan.is_deficit,
            explanation: confirmedPlan.primary_summary,
            details: {
              action_plan: confirmedPlan,
            },
            updated_at: now,
          },
          { onConflict: 'user_id,month' }
        )
        .select()
        .single();

      if (error) {
        if (isProduction) {
          throw new AppError(`Failed to persist confirmed action plan: ${error.message}`, 500, 'DATABASE_PERSISTENCE_FAILED');
        }
      } else if (data && data.details?.action_plan) {
        const persisted = data.details.action_plan as ActionPlan;
        if (!isProduction) inMemoryConfirmedActionPlans.set(`${userId}:${month}`, persisted);
        return persisted;
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Action plan persistence failed in production database', 500, 'DATABASE_PERSISTENCE_FAILED');
      }
    }

    if (isProduction) {
      throw new AppError('Action plan persistence failed in production', 500, 'DATABASE_PERSISTENCE_FAILED');
    }

    inMemoryConfirmedActionPlans.set(`${userId}:${month}`, confirmedPlan);
    return confirmedPlan;
  }

  /**
   * Retrieves confirmed plan for month, or generates dynamic preview if not yet confirmed.
   */
  async getActionPlanForMonth(userId: string, month: string): Promise<ActionPlan> {
    if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    const isProduction = env.NODE_ENV === 'production';

    // 1. Check if confirmed historical plan exists in database
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('monthly_allocation_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('month', month)
        .maybeSingle();

      if (!error && data?.details?.action_plan) {
        return data.details.action_plan as ActionPlan;
      }
    } catch {
      // Continue to in-memory check
    }

    // 2. Check in-memory store
    const cached = inMemoryConfirmedActionPlans.get(`${userId}:${month}`);
    if (cached) return cached;

    // 3. If no confirmed plan exists, dynamically generate preview
    return this.generateActionPlan(userId, month);
  }

  /**
   * Retrieves confirmed historical action plans for user.
   */
  async getActionPlanHistory(userId: string): Promise<ActionPlan[]> {
    if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    const isProduction = env.NODE_ENV === 'production';

    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('monthly_allocation_plans')
        .select('*')
        .eq('user_id', userId)
        .order('month', { ascending: false });

      if (!error && data && data.length > 0) {
        const plans = data
          .map((d: any) => d.details?.action_plan)
          .filter(Boolean) as ActionPlan[];
        if (plans.length > 0) return plans;
      }
    } catch {
      // Continue to in-memory fallback
    }

    return Array.from(inMemoryConfirmedActionPlans.values())
      .filter((p) => p.user_id === userId)
      .sort((a, b) => b.month.localeCompare(a.month));
  }

  /**
   * Runs pure transient what-if simulation without mutating database records.
   */
  async simulateActionPlan(userId: string, input: SimulateActionPlanInput): Promise<ActionPlan> {
    if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    const now = new Date();
    const month = input.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 1. Base monthly summary
    const summary = await transactionService.getMonthlySummary(userId, month);

    // 2. Base profile
    const profile = (await allocationService.getProfile(userId)) || {
      user_id: userId,
      monthly_income: summary.total_income,
      monthly_essential_expenses: summary.total_expenses,
      existing_liquid_savings: 0,
      existing_investments: 0,
      monthly_debt_obligations: 0,
      dependents: 0,
      has_health_insurance: false,
      has_life_insurance: false,
      emergency_fund_target_months: 6,
      desired_monthly_lifestyle_income: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const goals = await allocationService.listGoals(userId);

    // 3. Apply simulated deltas
    const surplusDelta = Number(input.surplus_delta) || 0;
    const expenseDelta = Number(input.expense_delta) || 0;
    const simulatedIncome = round2(summary.total_income + (surplusDelta > 0 ? surplusDelta : 0));
    const simulatedExpenses = round2(
      summary.total_expenses + expenseDelta - (surplusDelta < 0 ? surplusDelta : 0)
    );

    const simulatedProfile: Partial<typeof profile> = {
      ...profile,
      emergency_fund_target_months: input.simulated_emergency_months ?? profile.emergency_fund_target_months,
    };

    let freedomStatus: ActionEngineInput['freedomStatus'] = undefined;
    try {
      const freedom = await freedomService.getFreedomStatus(userId);
      freedomStatus = {
        indicative_target_corpus: freedom.active_scenario.indicative_target_corpus,
        projected_wealth: freedom.active_scenario.projected_wealth_at_target_age,
        required_monthly_contribution: freedom.active_scenario.required_monthly_contribution,
        current_wealth: freedom.initial_investable_wealth,
        target_age: freedom.target_age,
        selected_scenario: freedom.active_scenario_name,
        on_track: freedom.active_scenario.status !== 'Behind Target',
      };
    } catch {
      freedomStatus = {
        indicative_target_corpus: 0,
        projected_wealth: Number(profile.existing_investments || 0),
        required_monthly_contribution: 0,
        current_wealth: Number(profile.existing_investments || 0),
        target_age: profile.target_retirement_age || 55,
        selected_scenario: 'base',
        on_track: true,
      };
    }

    return buildFinancialActionPlan({
      month,
      income: simulatedIncome,
      expenses: simulatedExpenses,
      profile: simulatedProfile,
      goals,
      freedomStatus,
      overrides: input.overrides,
    });
  }
}

export const actionService = new ActionService();
