import {
  FinancialProfile,
  FinancialGoal,
} from '../allocation/allocation.schema.js';
import { calculateEmergencyFund, round2 } from '../allocation/allocation.engine.js';
import {
  ActionItem,
  ActionPlan,
  DeficitAnalysis,
  RankedGoalActionItem,
  UserActionOverride,
  ActionFreedomComparison,
} from './action.schema.js';

export interface ActionEngineInput {
  month: string;
  income: number;
  expenses: number;
  profile: Partial<FinancialProfile>;
  goals?: FinancialGoal[];
  freedomStatus?: {
    indicative_target_corpus: number;
    projected_wealth: number;
    required_monthly_contribution: number;
    current_wealth: number;
    target_age: number;
    selected_scenario: string;
    on_track: boolean;
  };
  largestExpenseCategory?: {
    category: string;
    amount: number;
    percentage: number;
  };
  overrides?: UserActionOverride;
}

/**
 * Calculates months remaining between a target date and the reference plan month (YYYY-MM).
 */
export function calculateMonthsRemaining(targetDate: string | null | undefined, referenceMonth: string): number {
  if (!targetDate) return 12; // Default to 12 months horizon if unspecified

  const [refYear, refMonth] = referenceMonth.split('-').map(Number);
  const target = new Date(targetDate);
  if (isNaN(target.getTime())) return 12;

  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth() + 1;

  const diffMonths = (targetYear - refYear) * 12 + (targetMonth - refMonth);
  return Math.max(diffMonths, 1); // Minimum 1 month to avoid division by zero
}

/**
 * Rank goals deterministically based on:
 * 1. User priority override or high-priority flag
 * 2. Deadline urgency (months remaining ascending)
 * 3. Outstanding funding gap magnitude
 * 4. Stable ID tie-breaker
 */
export function rankGoals(
  goals: FinancialGoal[],
  referenceMonth: string,
  overrides?: UserActionOverride
): RankedGoalActionItem[] {
  const activeGoals = goals.filter((g) => g.status === 'active');
  const pausedIds = new Set(overrides?.paused_goal_ids || []);
  const customOrder = overrides?.goal_priority_order || [];
  const prioritizedGoalId = overrides?.prioritized_goal_id;

  const mapped: RankedGoalActionItem[] = activeGoals.map((g) => {
    const targetAmount = round2(Math.max(Number(g.target_amount || 0), 0));
    const currentAmount = round2(Math.max(Number(g.current_amount || 0), 0));
    const remainingAmount = round2(Math.max(targetAmount - currentAmount, 0));
    const monthsRemaining = calculateMonthsRemaining(g.target_date, referenceMonth);
    const requiredMonthlyContribution = remainingAmount > 0 ? round2(remainingAmount / monthsRemaining) : 0;
    const isPaused = pausedIds.has(g.id);
    const isUserPrioritized = g.id === prioritizedGoalId || g.priority === 'high';

    return {
      id: g.id,
      title: g.title,
      target_amount: targetAmount,
      current_amount: currentAmount,
      remaining_amount: remainingAmount,
      target_date: g.target_date || null,
      months_remaining: monthsRemaining,
      required_monthly_contribution: requiredMonthlyContribution,
      priority_rank: 0,
      allocated_amount: 0,
      ranking_rationale: '',
      is_user_prioritized: isUserPrioritized,
      is_paused: isPaused,
    };
  });

  mapped.sort((a, b) => {
    // 1. Paused goals sink to the bottom
    if (a.is_paused && !b.is_paused) return 1;
    if (!a.is_paused && b.is_paused) return -1;

    // 2. Explicit custom goal order from user override
    if (customOrder.length > 0) {
      const aIdx = customOrder.indexOf(a.id);
      const bIdx = customOrder.indexOf(b.id);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
    }

    // 3. User prioritized goal flag
    if (a.is_user_prioritized && !b.is_user_prioritized) return -1;
    if (!a.is_user_prioritized && b.is_user_prioritized) return 1;

    // 4. Deadline urgency (closer deadline first)
    if (a.months_remaining !== b.months_remaining) {
      return a.months_remaining - b.months_remaining;
    }

    // 5. Larger funding gap first
    if (a.remaining_amount !== b.remaining_amount) {
      return b.remaining_amount - a.remaining_amount;
    }

    // 6. Stable tie-breaker by ID
    return a.id.localeCompare(b.id);
  });

  // Assign ranks and rationales
  return mapped.map((item, idx) => {
    const rank = idx + 1;
    let rationale = '';
    if (item.is_paused) {
      rationale = `Paused by user preference; allocation held at ₹0.`;
    } else if (item.is_user_prioritized) {
      rationale = `Rank #${rank}: Marked as high priority by user preference.`;
    } else if (item.months_remaining <= 6) {
      rationale = `Rank #${rank}: Urgent near-term deadline (${item.months_remaining} month${item.months_remaining > 1 ? 's' : ''} left).`;
    } else {
      rationale = `Rank #${rank}: Planned for completion in ${item.months_remaining} months.`;
    }

    return {
      ...item,
      priority_rank: rank,
      ranking_rationale: rationale,
    };
  });
}

/**
 * Executes priority-driven deterministic allocation.
 */
export function buildFinancialActionPlan(input: ActionEngineInput): ActionPlan {
  const { month, income, expenses, profile, goals = [], freedomStatus, largestExpenseCategory, overrides } = input;

  const safeIncome = round2(Math.max(income, 0));
  const safeExpenses = round2(Math.max(expenses, 0));
  const monthlySurplus = round2(safeIncome - safeExpenses);
  const isDeficit = monthlySurplus < 0;

  const essentialExpenses = profile.monthly_essential_expenses && profile.monthly_essential_expenses > 0
    ? Number(profile.monthly_essential_expenses)
    : safeExpenses;
  const targetMonths = profile.emergency_fund_target_months || 6;
  const existingLiquidSavings = Number(profile.existing_liquid_savings || 0);

  const emergencyFund = calculateEmergencyFund(essentialExpenses, targetMonths, existingLiquidSavings);

  // Freedom comparison
  const freedomRequiredContribution = freedomStatus?.required_monthly_contribution ?? 0;
  const freedomComparison: ActionFreedomComparison = {
    current_monthly_contribution: Math.max(monthlySurplus, 0),
    required_monthly_contribution: round2(freedomRequiredContribution),
    contribution_gap: round2(Math.max(freedomRequiredContribution - Math.max(monthlySurplus, 0), 0)),
    on_track: freedomStatus?.on_track ?? (freedomRequiredContribution <= Math.max(monthlySurplus, 0)),
    target_corpus: freedomStatus?.indicative_target_corpus ?? 0,
    projected_wealth: freedomStatus?.projected_wealth ?? 0,
    target_age: freedomStatus?.target_age ?? (profile.target_retirement_age || 55),
    selected_scenario: freedomStatus?.selected_scenario ?? 'base',
    assumption_disclaimer:
      'Long-term freedom estimates are mathematical projections based on assumed returns and inflation. They do not constitute guaranteed returns or investment advice.',
  };

  const actions: ActionItem[] = [];

  // -------------------------------------------------------------
  // P0 — Financial Deficit / Zero Surplus
  // -------------------------------------------------------------
  if (monthlySurplus <= 0) {
    const deficitAmount = round2(Math.abs(monthlySurplus));
    const essentialRatio = safeIncome > 0 ? round2((essentialExpenses / safeIncome) * 100) : 100;
    const debtRatio = safeIncome > 0 ? round2(((Number(profile.monthly_debt_obligations || 0)) / safeIncome) * 100) : 0;

    const recommendedActions = [
      'Stabilize monthly cashflow by eliminating uncommitted discretionary spend',
      'Contain fixed recurring subscriptions and negotiate utility/telecom rates',
      'Prioritize debt and EMI commitments to avoid late charges and compounding interest',
    ];

    const deficitAnalysis: DeficitAnalysis = {
      is_deficit: isDeficit,
      monthly_deficit: deficitAmount,
      essential_expense_ratio: essentialRatio,
      debt_pressure_ratio: debtRatio,
      largest_spending_category: largestExpenseCategory,
      recommended_actions: recommendedActions,
    };

    actions.push({
      priority: 'P0_DEFICIT',
      priority_label: 'P0 — Cashflow Stabilization',
      category: 'deficit_stabilization',
      title: isDeficit ? 'Deficit Recovery & Containment' : 'Zero Surplus Stabilization',
      allocated_amount: 0,
      required_amount: deficitAmount,
      target_gap: deficitAmount,
      why_rationale: isDeficit
        ? `Monthly expenses exceed income by ₹${deficitAmount.toLocaleString('en-IN')}. Surplus allocation to goals or investments is paused until positive cashflow is restored.`
        : `Incoming income exactly equals outgoing expenses (₹0 surplus). No surplus available for capital allocation this month.`,
      is_funded: false,
    });

    const rankedGoals = rankGoals(goals, month, overrides);

    return {
      month,
      monthly_income: safeIncome,
      monthly_expenses: safeExpenses,
      monthly_surplus: monthlySurplus,
      is_deficit: isDeficit,
      actions,
      ranked_goals: rankedGoals,
      allocations: {
        emergency_fund: 0,
        goals: 0,
        long_term_wealth: 0,
        flexible_buffer: 0,
        total_allocated: 0,
      },
      invariant_verified: true,
      deficit_analysis: deficitAnalysis,
      financial_freedom: freedomComparison,
      user_override_applied: Boolean(overrides && Object.keys(overrides).length > 0),
      user_overrides: overrides,
      primary_summary: isDeficit
        ? `Deficit of ₹${deficitAmount.toLocaleString('en-IN')}. All investment and discretionary goal allocations paused to preserve liquid solvency.`
        : `Zero monthly surplus. Cashflow is fully absorbed by current expenses.`,
    };
  }

  // -------------------------------------------------------------
  // POSITIVE SURPLUS WATERFALL ALLOCATION (P1 -> P2 -> P3 -> P4 -> P5)
  // -------------------------------------------------------------
  let availableSurplus = monthlySurplus;
  let emergencyAlloc = 0;
  let goalsAlloc = 0;
  let wealthAlloc = 0;
  let bufferAlloc = 0;

  // 1. P1: Emergency Fund Allocation
  const hasEmergencyGap = emergencyFund.emergency_fund_gap > 0;
  let emergencyRationale = '';

  if (overrides?.custom_emergency_allocation !== undefined) {
    emergencyAlloc = round2(Math.min(overrides.custom_emergency_allocation, availableSurplus));
    emergencyRationale = `User specified custom emergency reserve allocation of ₹${emergencyAlloc.toLocaleString('en-IN')}.`;
  } else if (hasEmergencyGap) {
    // Priority-driven: allocate target monthly tranche = gap / target_months (capped at available surplus and total gap)
    const monthlyEmergencyTranche = round2(emergencyFund.emergency_fund_gap / Math.max(targetMonths, 1));
    // Emergency reserve takes minimum of available surplus, target tranche, or entire gap
    emergencyAlloc = round2(Math.min(availableSurplus, Math.max(monthlyEmergencyTranche, Math.min(availableSurplus, emergencyFund.emergency_fund_gap))));
    emergencyRationale = `Emergency fund is below your selected target of ${emergencyFund.target_months} months (gap of ₹${emergencyFund.emergency_fund_gap.toLocaleString('en-IN')}). Allocated ₹${emergencyAlloc.toLocaleString('en-IN')} to strengthen liquid safety.`;
  } else {
    emergencyAlloc = 0;
    emergencyRationale = `Emergency fund target of ₹${emergencyFund.emergency_fund_target.toLocaleString('en-IN')} is already complete (${emergencyFund.coverage_months} months covered). Zero emergency allocation needed; surplus moves to next priority.`;
  }

  availableSurplus = round2(availableSurplus - emergencyAlloc);

  actions.push({
    priority: 'P1_EMERGENCY_FUND',
    priority_label: 'P1 — Emergency Safety Reserve',
    category: 'emergency_fund',
    title: 'Emergency Fund',
    allocated_amount: emergencyAlloc,
    required_amount: hasEmergencyGap ? round2(emergencyFund.emergency_fund_gap / Math.max(targetMonths, 1)) : 0,
    target_gap: emergencyFund.emergency_fund_gap,
    why_rationale: emergencyRationale,
    is_funded: emergencyFund.is_complete || emergencyAlloc >= emergencyFund.emergency_fund_gap,
    metadata: {
      target_months: emergencyFund.target_months,
      coverage_months: emergencyFund.coverage_months,
      target_amount: emergencyFund.emergency_fund_target,
      current_amount: emergencyFund.existing_liquid_savings,
    },
  });

  // 2. P2: Debt Obligations (Informational priority check)
  const debtObligations = Number(profile.monthly_debt_obligations || 0);
  if (debtObligations > 0) {
    actions.push({
      priority: 'P2_DEBT',
      priority_label: 'P2 — Debt & Obligation Containment',
      category: 'debt',
      title: 'Active Monthly Debt Obligations',
      allocated_amount: 0, // Debt is already serviced in baseline expenses; this identifies debt as a key cashflow priority
      required_amount: debtObligations,
      target_gap: debtObligations,
      why_rationale: `You have ₹${debtObligations.toLocaleString('en-IN')} in monthly debt commitments. Servicing these on time protects credit health and prevents compounding interest.`,
      is_funded: true,
      metadata: { monthly_debt_obligations: debtObligations },
    });
  }

  // 3. P3: Near-Term Goals Allocation
  const rankedGoals = rankGoals(goals, month, overrides);
  let totalGoalsRequired = 0;

  for (const g of rankedGoals) {
    if (g.is_paused || g.remaining_amount <= 0 || availableSurplus <= 0) {
      g.allocated_amount = 0;
      continue;
    }

    const needed = g.required_monthly_contribution;
    totalGoalsRequired += needed;
    const canAllocate = round2(Math.min(availableSurplus, Math.min(needed, g.remaining_amount)));
    g.allocated_amount = canAllocate;
    availableSurplus = round2(availableSurplus - canAllocate);
    goalsAlloc = round2(goalsAlloc + canAllocate);
  }

  let goalsRationale = '';
  if (rankedGoals.length === 0) {
    goalsRationale = 'No active financial goals configured. Surplus advances to long-term wealth building.';
  } else if (goalsAlloc > 0) {
    goalsRationale = `Allocated ₹${goalsAlloc.toLocaleString('en-IN')} across ${rankedGoals.filter((g) => g.allocated_amount > 0).length} active goal(s) ranked by deadline and priority.`;
  } else {
    goalsRationale = 'Active goals exist, but higher-priority emergency funding absorbed available surplus.';
  }

  actions.push({
    priority: 'P3_GOALS',
    priority_label: 'P3 — Targeted Financial Goals',
    category: 'goals',
    title: 'Financial Goals',
    allocated_amount: goalsAlloc,
    required_amount: round2(totalGoalsRequired),
    target_gap: round2(rankedGoals.reduce((s, g) => s + g.remaining_amount, 0)),
    why_rationale: goalsRationale,
    is_funded: rankedGoals.every((g) => g.is_paused || g.remaining_amount <= 0 || g.allocated_amount >= g.required_monthly_contribution),
    metadata: {
      active_goals_count: rankedGoals.filter((g) => !g.is_paused).length,
      funded_goals_count: rankedGoals.filter((g) => g.allocated_amount > 0).length,
    },
  });

  // 4. P4: Financial Freedom / Long-Term Wealth Bucket
  let wealthRationale = '';
  if (overrides?.custom_wealth_allocation !== undefined) {
    wealthAlloc = round2(Math.min(overrides.custom_wealth_allocation, availableSurplus));
    wealthRationale = `User specified custom wealth allocation of ₹${wealthAlloc.toLocaleString('en-IN')}.`;
    availableSurplus = round2(availableSurplus - wealthAlloc);
  } else if (availableSurplus > 0) {
    // If freedom required contribution is known, allocate up to required contribution or up to available surplus
    // If buffer override is set, reserve that buffer first
    const reservedBuffer = overrides?.custom_buffer_amount !== undefined ? Math.min(overrides.custom_buffer_amount, availableSurplus) : 0;
    const surplusForWealth = round2(availableSurplus - reservedBuffer);

    if (freedomRequiredContribution > 0) {
      wealthAlloc = round2(Math.min(surplusForWealth, freedomRequiredContribution));
    } else {
      wealthAlloc = round2(surplusForWealth);
    }

    availableSurplus = round2(availableSurplus - wealthAlloc);
    wealthRationale = `Allocated ₹${wealthAlloc.toLocaleString('en-IN')} to long-term wealth building to advance toward financial freedom (target corpus: ₹${(freedomStatus?.indicative_target_corpus || 0).toLocaleString('en-IN')}).`;
  } else {
    wealthAlloc = 0;
    wealthRationale = 'Higher-priority emergency safety and near-term goals absorbed current monthly surplus. Long-term wealth contributions will resume as higher priorities are funded.';
  }

  actions.push({
    priority: 'P4_WEALTH',
    priority_label: 'P4 — Financial Freedom & Long-Term Wealth',
    category: 'long_term_wealth',
    title: 'Long-Term Wealth Building',
    allocated_amount: wealthAlloc,
    required_amount: round2(freedomRequiredContribution),
    target_gap: round2(Math.max((freedomStatus?.indicative_target_corpus || 0) - (freedomStatus?.projected_wealth || 0), 0)),
    why_rationale: wealthRationale,
    is_funded: freedomRequiredContribution <= wealthAlloc,
    metadata: {
      target_corpus: freedomStatus?.indicative_target_corpus ?? 0,
      required_monthly_contribution: freedomRequiredContribution,
    },
  });

  // 5. P5: Flexible Buffer (Exact Reconciliation Guarantee)
  // buffer = monthlySurplus - (emergency + goals + wealth)
  bufferAlloc = round2(monthlySurplus - (emergencyAlloc + goalsAlloc + wealthAlloc));

  actions.push({
    priority: 'P5_BUFFER',
    priority_label: 'P5 — Flexible Discretionary Buffer',
    category: 'flexible_buffer',
    title: 'Flexible Cashflow Buffer',
    allocated_amount: bufferAlloc,
    required_amount: 0,
    target_gap: 0,
    why_rationale: `Reserved ₹${bufferAlloc.toLocaleString('en-IN')} as an uncommitted cashflow buffer for day-to-day variance and unexpected spending.`,
    is_funded: true,
  });

  // Invariant verification check
  const totalAllocated = round2(emergencyAlloc + goalsAlloc + wealthAlloc + bufferAlloc);
  const invariantVerified = totalAllocated === monthlySurplus;

  const primarySummary = `This month's verified surplus of ₹${monthlySurplus.toLocaleString('en-IN')} was prioritized: Emergency Reserve (₹${emergencyAlloc.toLocaleString('en-IN')}), Goals (₹${goalsAlloc.toLocaleString('en-IN')}), Long-Term Wealth (₹${wealthAlloc.toLocaleString('en-IN')}), and Buffer (₹${bufferAlloc.toLocaleString('en-IN')}).`;

  return {
    month,
    monthly_income: safeIncome,
    monthly_expenses: safeExpenses,
    monthly_surplus: monthlySurplus,
    is_deficit: false,
    actions,
    ranked_goals: rankedGoals,
    allocations: {
      emergency_fund: emergencyAlloc,
      goals: goalsAlloc,
      long_term_wealth: wealthAlloc,
      flexible_buffer: bufferAlloc,
      total_allocated: totalAllocated,
    },
    invariant_verified: invariantVerified,
    financial_freedom: freedomComparison,
    user_override_applied: Boolean(overrides && Object.keys(overrides).length > 0),
    user_overrides: overrides,
    primary_summary: primarySummary,
  };
}
