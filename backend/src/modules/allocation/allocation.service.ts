import { v4 as uuidv4 } from 'uuid';
import {
  FinancialProfile,
  FinancialProfileInput,
  FinancialGoal,
  CreateGoalInput,
  UpdateGoalInput,
  MonthlyAllocationPlan,
} from './allocation.schema.js';
import { allocateMonthlySurplus } from './allocation.engine.js';
import { transactionService } from '../transactions/transaction.service.js';
import { getSupabaseAdminClient } from '../../config/supabase.js';
import { env } from '../../config/env.js';
import { AppError } from '../../middleware/errorHandler.js';

// Development/testing fallback in-memory stores
const inMemoryProfiles = new Map<string, FinancialProfile>();
const inMemoryGoals = new Map<string, FinancialGoal>();
const inMemoryPlans = new Map<string, MonthlyAllocationPlan>();

export class AllocationService {
  // -------------------------------------------------------------
  // 1. Financial Profile Management
  // -------------------------------------------------------------
  async getProfile(userId: string): Promise<FinancialProfile | null> {
    if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    const isProduction = env.NODE_ENV === 'production';

    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('financial_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        if (isProduction) {
          throw new AppError(`Failed to fetch financial profile: ${error.message}`, 500, 'DATABASE_QUERY_FAILED');
        }
      } else if (data) {
        return data as FinancialProfile;
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Failed to fetch financial profile from production database', 500, 'DATABASE_QUERY_FAILED');
      }
    }

    if (isProduction) return null;
    return inMemoryProfiles.get(userId) || null;
  }

  async upsertProfile(userId: string, input: FinancialProfileInput): Promise<FinancialProfile> {
    if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    const isProduction = env.NODE_ENV === 'production';
    const now = new Date().toISOString();

    const record: FinancialProfile = {
      ...input,
      user_id: userId,
      created_at: now,
      updated_at: now,
    };

    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('financial_profiles')
        .upsert(
          {
            user_id: userId,
            age: input.age ?? null,
            monthly_income: input.monthly_income,
            existing_liquid_savings: input.existing_liquid_savings,
            existing_investments: input.existing_investments,
            monthly_essential_expenses: input.monthly_essential_expenses,
            monthly_debt_obligations: input.monthly_debt_obligations,
            dependents: input.dependents,
            has_health_insurance: input.has_health_insurance,
            has_life_insurance: input.has_life_insurance,
            emergency_fund_target_months: input.emergency_fund_target_months,
            target_retirement_age: input.target_retirement_age ?? null,
            desired_monthly_lifestyle_income: input.desired_monthly_lifestyle_income,
            updated_at: now,
          },
          { onConflict: 'user_id' }
        )
        .select()
        .single();

      if (error) {
        if (isProduction) {
          throw new AppError(`Failed to save financial profile: ${error.message}`, 500, 'DATABASE_PERSISTENCE_FAILED');
        }
      } else if (data) {
        if (!isProduction) inMemoryProfiles.set(userId, data as FinancialProfile);
        return data as FinancialProfile;
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Profile persistence failed in production database', 500, 'DATABASE_PERSISTENCE_FAILED');
      }
    }

    if (isProduction) {
      throw new AppError('Profile persistence failed in production', 500, 'DATABASE_PERSISTENCE_FAILED');
    }

    inMemoryProfiles.set(userId, record);
    return record;
  }

  // -------------------------------------------------------------
  // 2. Financial Goals Management
  // -------------------------------------------------------------
  async listGoals(userId: string): Promise<FinancialGoal[]> {
    if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    const isProduction = env.NODE_ENV === 'production';

    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      const hasInMemory = !isProduction && Array.from(inMemoryGoals.values()).some((g) => g.user_id === userId);

      if (error) {
        if (isProduction) {
          throw new AppError(`Failed to fetch goals: ${error.message}`, 500, 'DATABASE_QUERY_FAILED');
        }
      } else if (data && (data.length > 0 || !hasInMemory)) {
        return data as FinancialGoal[];
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Goals query failed in production database', 500, 'DATABASE_QUERY_FAILED');
      }
    }

    if (isProduction) return [];
    return Array.from(inMemoryGoals.values()).filter((g) => g.user_id === userId);
  }

  async createGoal(userId: string, input: CreateGoalInput): Promise<FinancialGoal> {
    if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    const isProduction = env.NODE_ENV === 'production';
    const id = uuidv4();
    const now = new Date().toISOString();

    const record: FinancialGoal = {
      ...input,
      id,
      user_id: userId,
      status: 'active',
      created_at: now,
      updated_at: now,
    };

    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('goals')
        .insert({
          id: record.id,
          user_id: record.user_id,
          title: record.title,
          description: record.description || null,
          goal_type: record.goal_type,
          target_amount: record.target_amount,
          current_amount: record.current_amount,
          currency: record.currency,
          target_date: record.target_date || null,
          priority: record.priority,
          status: record.status,
        })
        .select()
        .single();

      if (error) {
        if (isProduction) {
          throw new AppError(`Failed to create goal: ${error.message}`, 500, 'DATABASE_PERSISTENCE_FAILED');
        }
      } else if (data) {
        if (!isProduction) inMemoryGoals.set(record.id, data as FinancialGoal);
        return data as FinancialGoal;
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Goal creation failed in production database', 500, 'DATABASE_PERSISTENCE_FAILED');
      }
    }

    if (isProduction) {
      throw new AppError('Goal creation failed in production database', 500, 'DATABASE_PERSISTENCE_FAILED');
    }

    inMemoryGoals.set(record.id, record);
    return record;
  }

  async getGoalById(userId: string, id: string): Promise<FinancialGoal> {
    if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    const isProduction = env.NODE_ENV === 'production';

    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        if (isProduction) {
          throw new AppError(`Failed to fetch goal: ${error.message}`, 500, 'DATABASE_QUERY_FAILED');
        }
      } else if (data) {
        if (data.user_id !== userId) {
          throw new AppError('Access denied: You do not have permission to access this goal', 403, 'FORBIDDEN');
        }
        return data as FinancialGoal;
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Goal query failed in production database', 500, 'DATABASE_QUERY_FAILED');
      }
    }

    const record = inMemoryGoals.get(id);
    if (!record) {
      throw new AppError('Goal not found', 404, 'GOAL_NOT_FOUND');
    }

    if (record.user_id !== userId) {
      throw new AppError('Access denied: You do not have permission to access this goal', 403, 'FORBIDDEN');
    }

    return record;
  }

  async updateGoal(userId: string, id: string, input: UpdateGoalInput): Promise<FinancialGoal> {
    if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    const existing = await this.getGoalById(userId, id);
    const isProduction = env.NODE_ENV === 'production';
    const now = new Date().toISOString();

    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('goals')
        .update({
          ...input,
          updated_at: now,
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        if (isProduction) {
          throw new AppError(`Failed to update goal: ${error.message}`, 500, 'DATABASE_PERSISTENCE_FAILED');
        }
      } else if (data) {
        if (!isProduction) inMemoryGoals.set(id, data as FinancialGoal);
        return data as FinancialGoal;
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Goal update failed in production database', 500, 'DATABASE_PERSISTENCE_FAILED');
      }
    }

    const updated: FinancialGoal = {
      ...existing,
      ...input,
      updated_at: now,
    };
    inMemoryGoals.set(id, updated);
    return updated;
  }

  async deleteGoal(userId: string, id: string): Promise<{ success: boolean; id: string }> {
    if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    await this.getGoalById(userId, id);
    const isProduction = env.NODE_ENV === 'production';

    try {
      const supabase = getSupabaseAdminClient();
      const { error } = await supabase.from('goals').delete().eq('id', id).eq('user_id', userId);
      if (error) {
        if (isProduction) {
          throw new AppError(`Failed to delete goal: ${error.message}`, 500, 'DATABASE_PERSISTENCE_FAILED');
        }
      } else {
        if (!isProduction) inMemoryGoals.delete(id);
        return { success: true, id };
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Goal deletion failed in production database', 500, 'DATABASE_PERSISTENCE_FAILED');
      }
    }

    inMemoryGoals.delete(id);
    return { success: true, id };
  }

  // -------------------------------------------------------------
  // 3. Monthly Allocation Planning & History
  // -------------------------------------------------------------
  async generatePlanForMonth(userId: string, month: string): Promise<MonthlyAllocationPlan> {
    if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    const isProduction = env.NODE_ENV === 'production';

    // 1. Fetch deterministic monthly financial summary from Phase 2
    const summary = await transactionService.getMonthlySummary(userId, month);

    // 2. Fetch financial profile
    const profile = (await this.getProfile(userId)) || {
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

    // 3. Fetch user goals
    const goals = await this.listGoals(userId);

    // 4. Run deterministic allocation engine
    const allocationResult = allocateMonthlySurplus(
      month,
      summary.total_income,
      summary.total_expenses,
      profile,
      goals
    );

    const now = new Date().toISOString();
    const planId = uuidv4();

    const plan: MonthlyAllocationPlan = {
      ...allocationResult,
      id: planId,
      user_id: userId,
      created_at: now,
      updated_at: now,
    };

    // Try Supabase persistence
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('monthly_allocation_plans')
        .upsert(
          {
            user_id: userId,
            month: plan.month,
            monthly_income: plan.monthly_income,
            monthly_expenses: plan.monthly_expenses,
            monthly_surplus: plan.monthly_surplus,
            emergency_fund_target: plan.emergency_fund.emergency_fund_target,
            emergency_fund_current: plan.emergency_fund.existing_liquid_savings,
            emergency_fund_gap: plan.emergency_fund.emergency_fund_gap,
            emergency_fund_allocation: plan.allocations.emergency_fund,
            goals_allocation: plan.allocations.goals,
            long_term_wealth_allocation: plan.allocations.long_term_wealth,
            flexible_buffer_allocation: plan.allocations.flexible_buffer,
            is_deficit: plan.is_deficit,
            explanation: plan.explanation.primary_summary,
            details: {
              explanation: plan.explanation,
              emergency_fund: plan.emergency_fund,
              allocations: plan.allocations,
              financial_freedom: plan.financial_freedom,
            },
            updated_at: now,
          },
          { onConflict: 'user_id,month' }
        )
        .select()
        .single();

      if (error) {
        if (isProduction) {
          throw new AppError(`Failed to persist allocation plan: ${error.message}`, 500, 'DATABASE_PERSISTENCE_FAILED');
        }
      } else if (data) {
        const persistedPlan: MonthlyAllocationPlan = {
          id: data.id,
          user_id: data.user_id,
          month: data.month,
          monthly_income: Number(data.monthly_income),
          monthly_expenses: Number(data.monthly_expenses),
          monthly_surplus: Number(data.monthly_surplus),
          is_deficit: data.is_deficit,
          emergency_fund: data.details.emergency_fund,
          allocations: data.details.allocations,
          explanation: data.details.explanation,
          financial_freedom: data.details.financial_freedom,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };

        if (!isProduction) inMemoryPlans.set(`${userId}:${month}`, persistedPlan);
        return persistedPlan;
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Plan persistence failed in production database', 500, 'DATABASE_PERSISTENCE_FAILED');
      }
    }

    if (isProduction) {
      throw new AppError('Plan persistence failed in production', 500, 'DATABASE_PERSISTENCE_FAILED');
    }

    inMemoryPlans.set(`${userId}:${month}`, plan);
    return plan;
  }

  async getPlanForMonth(userId: string, month: string): Promise<MonthlyAllocationPlan | null> {
    if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    const isProduction = env.NODE_ENV === 'production';

    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('monthly_allocation_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('month', month)
        .maybeSingle();

      if (error) {
        if (isProduction) {
          throw new AppError(`Failed to fetch allocation plan: ${error.message}`, 500, 'DATABASE_QUERY_FAILED');
        }
      } else if (data) {
        return {
          id: data.id,
          user_id: data.user_id,
          month: data.month,
          monthly_income: Number(data.monthly_income),
          monthly_expenses: Number(data.monthly_expenses),
          monthly_surplus: Number(data.monthly_surplus),
          is_deficit: data.is_deficit,
          emergency_fund: data.details.emergency_fund,
          allocations: data.details.allocations,
          explanation: data.details.explanation,
          financial_freedom: data.details.financial_freedom,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Failed to fetch plan from production database', 500, 'DATABASE_QUERY_FAILED');
      }
    }

    if (isProduction) return null;
    return inMemoryPlans.get(`${userId}:${month}`) || null;
  }

  async listPlanHistory(userId: string): Promise<MonthlyAllocationPlan[]> {
    if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    const isProduction = env.NODE_ENV === 'production';

    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('monthly_allocation_plans')
        .select('*')
        .eq('user_id', userId)
        .order('month', { ascending: false });

      const hasInMemory = !isProduction && Array.from(inMemoryPlans.values()).some((p) => p.user_id === userId);

      if (error) {
        if (isProduction) {
          throw new AppError(`Failed to fetch plan history: ${error.message}`, 500, 'DATABASE_QUERY_FAILED');
        }
      } else if (data && (data.length > 0 || !hasInMemory)) {
        return data.map((d: any) => ({
          id: d.id,
          user_id: d.user_id,
          month: d.month,
          monthly_income: Number(d.monthly_income),
          monthly_expenses: Number(d.monthly_expenses),
          monthly_surplus: Number(d.monthly_surplus),
          is_deficit: d.is_deficit,
          emergency_fund: d.details.emergency_fund,
          allocations: d.details.allocations,
          explanation: d.details.explanation,
          financial_freedom: d.details.financial_freedom,
          created_at: d.created_at,
          updated_at: d.updated_at,
        }));
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Plan history query failed in production database', 500, 'DATABASE_QUERY_FAILED');
      }
    }

    if (isProduction) return [];
    return Array.from(inMemoryPlans.values())
      .filter((p) => p.user_id === userId)
      .sort((a, b) => b.month.localeCompare(a.month));
  }
}

export const allocationService = new AllocationService();
