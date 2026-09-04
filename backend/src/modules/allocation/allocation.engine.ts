import {
  FinancialProfile,
  FinancialGoal,
  EmergencyFundCalculation,
  AllocationBuckets,
  MonthlyAllocationPlan,
} from './allocation.schema.js';

export const round2 = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

export function calculateEmergencyFund(
  essentialMonthlyExpenses: number,
  targetMonths: number,
  existingLiquidSavings: number
): EmergencyFundCalculation {
  const safeExpenses = Math.max(essentialMonthlyExpenses, 0);
  const safeMonths = Math.max(targetMonths, 1);
  const safeSavings = Math.max(existingLiquidSavings, 0);

  const emergency_fund_target = round2(safeExpenses * safeMonths);
  const emergency_fund_gap = round2(Math.max(emergency_fund_target - safeSavings, 0));
  const coverage_months = safeExpenses > 0 ? round2(safeSavings / safeExpenses) : safeMonths;
  const is_complete = emergency_fund_gap <= 0;

  return {
    essential_monthly_expenses: round2(safeExpenses),
    target_months: safeMonths,
    emergency_fund_target,
    existing_liquid_savings: round2(safeSavings),
    emergency_fund_gap,
    coverage_months,
    is_complete,
  };
}

export function allocateMonthlySurplus(
  month: string,
  income: number,
  expenses: number,
  profile: Partial<FinancialProfile>,
  goals: FinancialGoal[] = []
): Omit<MonthlyAllocationPlan, 'id' | 'user_id' | 'created_at' | 'updated_at'> {
  const safeIncome = round2(Math.max(income, 0));
  const safeExpenses = round2(Math.max(expenses, 0));
  const monthly_surplus = round2(safeIncome - safeExpenses);
  const is_deficit = monthly_surplus < 0;

  // Derive essential expenses: use profile value if provided, else fallback to safeExpenses
  const essentialExpenses = profile.monthly_essential_expenses && profile.monthly_essential_expenses > 0
    ? profile.monthly_essential_expenses
    : safeExpenses;
  const targetMonths = profile.emergency_fund_target_months || 6;
  const existingSavings = profile.existing_liquid_savings || 0;

  const emergencyFund = calculateEmergencyFund(essentialExpenses, targetMonths, existingSavings);

  // Active goals
  const activeGoals = goals.filter((g) => g.status === 'active');

  // Handle Deficit or Zero Surplus
  if (monthly_surplus <= 0) {
    const deficitAmount = Math.abs(monthly_surplus);
    const essentialRatio = safeIncome > 0 ? round2((essentialExpenses / safeIncome) * 100) : 100;
    const debtRatio = safeIncome > 0 ? round2(((profile.monthly_debt_obligations || 0) / safeIncome) * 100) : 0;

    const spendingPressure = is_deficit
      ? `High spending pressure: Monthly expenses exceed income by ₹${deficitAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`
      : `Zero surplus: Monthly expenses exactly equal incoming revenue.`;

    const summary = is_deficit
      ? `Monthly deficit of ₹${deficitAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}. Surplus allocation cannot proceed until positive surplus exists.`
      : `Zero surplus available this month. Surplus allocation cannot proceed without positive surplus.`;

    return {
      month,
      monthly_income: safeIncome,
      monthly_expenses: safeExpenses,
      monthly_surplus,
      is_deficit,
      emergency_fund: emergencyFund,
      allocations: {
        emergency_fund: 0,
        goals: 0,
        long_term_wealth: 0,
        flexible_buffer: 0,
        total_allocated: 0,
      },
      explanation: {
        primary_summary: summary,
        priority_order: [
          '1. Essential monthly expenses',
          '2. Debt & EMI containment',
          '3. Positive surplus restoration',
        ],
        emergency_fund_rationale: 'Allocation halted due to non-positive cashflow. Emergency fund cannot be funded from a deficit.',
        goals_rationale: 'Goal contributions paused until positive surplus is restored.',
        long_term_wealth_rationale: 'Wealth allocation paused to protect current liquidity.',
        buffer_rationale: 'No flexible buffer available under current cashflow.',
        deficit_pressure_analysis: {
          spending_pressure: spendingPressure,
          essential_expense_ratio: essentialRatio,
          debt_obligation_ratio: debtRatio,
          recommendation: 'Review discretionary expenses and debt obligations to restore positive cashflow.',
        },
      },
      financial_freedom: {
        current_savings_investments: round2((profile.existing_liquid_savings || 0) + (profile.existing_investments || 0)),
        monthly_surplus,
        emergency_fund_progress_pct: emergencyFund.emergency_fund_target > 0
          ? Math.min(round2((existingSavings / emergencyFund.emergency_fund_target) * 100), 100)
          : 100,
        target_corpus_status: 'Target corpus not calculated yet',
        desired_monthly_lifestyle_income: profile.desired_monthly_lifestyle_income || 0,
        target_age: profile.target_retirement_age || null,
        current_age: profile.age || null,
      },
    };
  }

  // Positive Surplus Allocation Engine
  let emergency_alloc = 0;
  let goals_alloc = 0;
  let long_term_alloc = 0;
  let buffer_alloc = 0;

  // 1. Emergency Fund Priority
  if (emergencyFund.emergency_fund_gap > 0) {
    // Allocate up to 50% of surplus towards emergency gap
    const targetEmergencyShare = round2(monthly_surplus * 0.5);
    emergency_alloc = Math.min(targetEmergencyShare, emergencyFund.emergency_fund_gap);
  }

  const remainingAfterEmergency = round2(monthly_surplus - emergency_alloc);

  // 2. Near-Term Goals Priority
  if (activeGoals.length > 0 && remainingAfterEmergency > 0) {
    const goalsRemainingGap = activeGoals.reduce((sum, g) => {
      const gTarget = g.target_amount || 0;
      const gCurrent = g.current_amount || 0;
      return sum + Math.max(gTarget - gCurrent, 0);
    }, 0);

    // If emergency gap existed, take 35% of remaining, otherwise 40%
    const goalRatio = emergency_alloc > 0 ? 0.35 : 0.40;
    const targetGoalShare = round2(remainingAfterEmergency * goalRatio);
    goals_alloc = goalsRemainingGap > 0 ? Math.min(targetGoalShare, goalsRemainingGap) : targetGoalShare;
  }

  const remainingAfterGoals = round2(remainingAfterEmergency - goals_alloc);

  // 3. Long-Term Wealth Building Priority
  if (remainingAfterGoals > 0) {
    // 80% of remainder to long-term wealth bucket
    long_term_alloc = round2(remainingAfterGoals * 0.80);
  }

  // 4. Flexible Buffer (Exact Reconciliation Guarantee)
  // buffer = monthly_surplus - (emergency + goals + long_term)
  buffer_alloc = round2(monthly_surplus - (emergency_alloc + goals_alloc + long_term_alloc));

  // Invariant reconciliation check
  const total_allocated = round2(emergency_alloc + goals_alloc + long_term_alloc + buffer_alloc);

  // Formulate deterministic explainability rationale
  const emergencyRationale = emergencyFund.is_complete
    ? `Your emergency fund target of ₹${emergencyFund.emergency_fund_target.toLocaleString('en-IN')} is already complete (${emergencyFund.coverage_months} months covered). Zero emergency allocation needed; surplus prioritized for goals and wealth.`
    : `Your emergency fund is below your selected target of ${emergencyFund.target_months} months (gap of ₹${emergencyFund.emergency_fund_gap.toLocaleString('en-IN')}). Allocated ₹${emergency_alloc.toLocaleString('en-IN')} to increase safety buffer.`;

  const goalsRationale = activeGoals.length > 0
    ? `Allocated ₹${goals_alloc.toLocaleString('en-IN')} distributed across ${activeGoals.length} active goal(s).`
    : `No active financial goals found; surplus channeled to long-term wealth building and cashflow buffer.`;

  const longTermRationale = `Allocated ₹${long_term_alloc.toLocaleString('en-IN')} to your long-term wealth building bucket for financial freedom.`;
  const bufferRationale = `Reserved ₹${buffer_alloc.toLocaleString('en-IN')} as an uncommitted cashflow buffer for day-to-day variance.`;

  return {
    month,
    monthly_income: safeIncome,
    monthly_expenses: safeExpenses,
    monthly_surplus,
    is_deficit: false,
    emergency_fund: emergencyFund,
    allocations: {
      emergency_fund: emergency_alloc,
      goals: goals_alloc,
      long_term_wealth: long_term_alloc,
      flexible_buffer: buffer_alloc,
      total_allocated,
    },
    explanation: {
      primary_summary: `This month's positive surplus of ₹${monthly_surplus.toLocaleString('en-IN')} was deterministically distributed across emergency safety, goals, long-term wealth, and buffer.`,
      priority_order: [
        '1. Essential monthly expenses (cleared)',
        '2. Emergency safety coverage',
        '3. Near-term financial goals',
        '4. Long-term wealth building',
        '5. Flexible discretionary buffer',
      ],
      emergency_fund_rationale: emergencyRationale,
      goals_rationale: goalsRationale,
      long_term_wealth_rationale: longTermRationale,
      buffer_rationale: bufferRationale,
    },
    financial_freedom: {
      current_savings_investments: round2((profile.existing_liquid_savings || 0) + (profile.existing_investments || 0)),
      monthly_surplus,
      emergency_fund_progress_pct: emergencyFund.emergency_fund_target > 0
        ? Math.min(round2((existingSavings / emergencyFund.emergency_fund_target) * 100), 100)
        : 100,
      target_corpus_status: 'Target corpus not calculated yet',
      desired_monthly_lifestyle_income: profile.desired_monthly_lifestyle_income || 0,
      target_age: profile.target_retirement_age || null,
      current_age: profile.age || null,
    },
  };
}
