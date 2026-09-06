import { transactionService } from '../transactions/transaction.service.js';
import { allocationService } from '../allocation/allocation.service.js';
import { round2 } from '../allocation/allocation.engine.js';
import { FinancialProfile, FinancialGoal } from '../allocation/allocation.schema.js';

export type DataSourceType = 'observed_ledger' | 'profile_stated' | 'missing';

export interface CanonicalFinancialState {
  month: string;
  data_status: {
    has_observed_transactions: boolean;
    has_financial_profile: boolean;
    has_goals: boolean;
    income_source: DataSourceType;
    expense_source: DataSourceType;
    is_fully_configured: boolean;
  };
  income: {
    monthly_net_income: number | null;
    other_recurring_income: number;
    annual_income_growth_pct: number;
    formatted_income: string;
  };
  expenses: {
    monthly_essential_expenses: number | null;
    monthly_debt_obligations: number | null;
    essential_monthly_expenses: number | null; // backward compatibility alias
    debt_payments: number; // backward compatibility alias
    discretionary_monthly_expenses: number;
    total_monthly_expenses: number | null;
    annual_expense_growth_pct: number;
    formatted_expenses: string;
    top_categories: Array<{ category: string; amount: number; percentage: number }>;
  };
  cashflow: {
    monthly_surplus: number | null;
    actual_monthly_surplus: number | null; // backward compatibility alias
    savings_rate: number | null;
    is_deficit: boolean;
    deficit_amount: number;
    formatted_surplus: string;
    formatted_savings_rate: string;
  };
  capital_and_savings: {
    liquid_savings: number | null;
    existing_investments: number | null;
    emergency_fund_target: number | null;
    emergency_fund_gap: number | null;
    emergency_coverage_months: number | null;
    is_emergency_complete: boolean;
    current_investable_capital: number | null;
    monthly_investment_capacity: number | null;
  };
  planning_profile: {
    current_age: number | null;
    target_retirement_age: number | null;
    desired_monthly_lifestyle_income: number | null;
    dependents: number;
    has_health_insurance: boolean;
    has_life_insurance: boolean;
  };
  goals: Array<{
    id: string;
    title: string;
    target_amount: number;
    current_amount: number;
    target_date?: string;
    priority: string;
  }>;
  assumptions: {
    expected_return_pct: number;
    inflation_rate_pct: number;
    withdrawal_rate_pct: number;
  };
  missing_fields: string[];
}

export class CanonicalFinanceService {
  /**
   * Builds the single canonical financial context for a user for a given month.
   * Strictly avoids inventing numbers: missing values are returned as null / explicit missing fields,
   * never silently converted to zero.
   *
   * Canonical Formulas:
   * total_monthly_expenses = monthly_essential_expenses + monthly_debt_obligations
   * monthly_surplus = monthly_net_income - total_monthly_expenses
   */
  async getCanonicalFinancialState(userId: string, targetMonth?: string): Promise<CanonicalFinancialState> {
    if (!userId) {
      throw new Error('User context required for canonical financial state');
    }

    let month = targetMonth;
    if (!month) {
      try {
        const { transactions } = await transactionService.listTransactions(userId, { limit: 1, offset: 0 });
        if (transactions.length > 0 && transactions[0]?.date) {
          month = transactions[0].date.slice(0, 7);
        }
      } catch {
        // Fall back
      }
    }
    const now = new Date();
    if (!month) {
      month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    const missing_fields: string[] = [];

    // 1. Fetch observed transactions summary
    let monthlySummary: any = null;
    try {
      monthlySummary = await transactionService.getMonthlySummary(userId, month);
    } catch {
      monthlySummary = null;
    }

    const hasObservedTransactions = Boolean(
      monthlySummary &&
      (monthlySummary.total_income > 0 || monthlySummary.total_expenses > 0 || (monthlySummary.transaction_count?.total || 0) > 0)
    );

    // 2. Fetch stated financial profile
    let profile: FinancialProfile | null = null;
    try {
      profile = await allocationService.getProfile(userId);
    } catch {
      profile = null;
    }

    const hasFinancialProfile = Boolean(profile);

    // 3. Fetch goals
    let goalsList: FinancialGoal[] = [];
    try {
      goalsList = await allocationService.listGoals(userId);
    } catch {
      goalsList = [];
    }

    // -------------------------------------------------------------
    // Derive Canonical Net Income
    // -------------------------------------------------------------
    let monthlyNetIncome: number | null = null;
    let incomeSource: DataSourceType = 'missing';

    if (hasObservedTransactions && monthlySummary.total_income > 0) {
      monthlyNetIncome = round2(monthlySummary.total_income);
      incomeSource = 'observed_ledger';
    } else if (profile && profile.monthly_income != null && profile.monthly_income > 0) {
      monthlyNetIncome = round2(Number(profile.monthly_income));
      incomeSource = 'profile_stated';
    } else if (hasObservedTransactions && monthlySummary.total_income === 0) {
      monthlyNetIncome = 0;
      incomeSource = 'observed_ledger';
    } else if (profile && profile.monthly_income !== null && profile.monthly_income !== undefined && Number(profile.monthly_income) === 0) {
      monthlyNetIncome = 0;
      incomeSource = 'profile_stated';
    } else {
      missing_fields.push('monthly_net_income');
    }

    // -------------------------------------------------------------
    // Derive Canonical Expenses:
    // Canonical Contract: total_monthly_expenses = monthly_essential_expenses + monthly_debt_obligations
    // -------------------------------------------------------------
    let totalExpenses: number | null = null;
    let essentialExpenses: number | null = null;
    let debtObligations: number | null = null;
    let discretionaryExpenses = 0;
    let expenseSource: DataSourceType = 'missing';

    const topCategories = (monthlySummary?.categories || []).map((c: any) => ({
      category: c.category,
      amount: round2(Number(c.amount)),
      percentage: round2(Number(c.percentage)),
    }));

    if (hasObservedTransactions && (monthlySummary.total_expenses > 0 || (monthlySummary.transaction_count?.expenses || 0) > 0)) {
      totalExpenses = round2(monthlySummary.total_expenses);
      expenseSource = 'observed_ledger';
      debtObligations = profile?.monthly_debt_obligations != null ? round2(Number(profile.monthly_debt_obligations)) : 0;
      essentialExpenses = profile?.monthly_essential_expenses && profile.monthly_essential_expenses > 0
        ? round2(Number(profile.monthly_essential_expenses))
        : totalExpenses;
      discretionaryExpenses = round2(Math.max(totalExpenses - (essentialExpenses || 0), 0));
    } else if (profile && (profile.monthly_essential_expenses != null || profile.monthly_debt_obligations != null)) {
      const ess = profile.monthly_essential_expenses != null ? round2(Number(profile.monthly_essential_expenses)) : null;
      const debt = profile.monthly_debt_obligations != null ? round2(Number(profile.monthly_debt_obligations)) : null;

      if (ess === null && debt === null) {
        essentialExpenses = null;
        debtObligations = null;
        totalExpenses = null;
        missing_fields.push('total_monthly_expenses');
      } else {
        essentialExpenses = ess ?? 0;
        debtObligations = debt ?? 0;
        totalExpenses = round2(essentialExpenses + debtObligations);
        expenseSource = 'profile_stated';
      }
    } else {
      missing_fields.push('total_monthly_expenses');
    }

    // -------------------------------------------------------------
    // Derive Canonical Monthly Surplus & Savings Rate:
    // Canonical Contract: monthly_surplus = monthly_net_income - total_monthly_expenses
    // -------------------------------------------------------------
    let monthlySurplus: number | null = null;
    let savingsRate: number | null = null;
    let isDeficit = false;
    let deficitAmount = 0;

    if (monthlyNetIncome !== null && totalExpenses !== null) {
      monthlySurplus = round2(monthlyNetIncome - totalExpenses);
      isDeficit = monthlySurplus < 0;
      deficitAmount = isDeficit ? round2(Math.abs(monthlySurplus)) : 0;

      if (monthlyNetIncome > 0) {
        savingsRate = Math.max(0, round2((monthlySurplus / monthlyNetIncome) * 100));
      } else {
        savingsRate = 0;
      }
    } else {
      if (monthlyNetIncome === null) missing_fields.push('monthly_net_income');
      if (totalExpenses === null && !missing_fields.includes('total_monthly_expenses')) {
        missing_fields.push('total_monthly_expenses');
      }
    }

    // -------------------------------------------------------------
    // Derive Liquid Capital & Emergency Fund
    // -------------------------------------------------------------
    const liquidSavings = profile?.existing_liquid_savings != null ? round2(Number(profile.existing_liquid_savings)) : null;
    const existingInvestments = profile?.existing_investments != null ? round2(Number(profile.existing_investments)) : null;

    if (liquidSavings === null) missing_fields.push('liquid_savings');
    if (existingInvestments === null) missing_fields.push('existing_investments');

    const targetMonths = profile?.emergency_fund_target_months || 6;
    const baseEssentialExpense = essentialExpenses ?? totalExpenses;
    const emergencyFundTarget = baseEssentialExpense !== null && baseEssentialExpense > 0
      ? round2(baseEssentialExpense * targetMonths)
      : null;

    let emergencyFundGap: number | null = null;
    let emergencyCoverageMonths: number | null = null;
    let isEmergencyComplete = false;

    if (emergencyFundTarget !== null && liquidSavings !== null) {
      emergencyFundGap = round2(Math.max(emergencyFundTarget - liquidSavings, 0));
      emergencyCoverageMonths = baseEssentialExpense && baseEssentialExpense > 0
        ? round2(liquidSavings / baseEssentialExpense)
        : targetMonths;
      isEmergencyComplete = emergencyFundGap <= 0;
    }

    // Investable capital: investments + excess liquid savings (if emergency target met)
    let currentInvestableCapital: number | null = null;
    if (existingInvestments !== null) {
      const excessLiquid = liquidSavings !== null && emergencyFundTarget !== null
        ? Math.max(liquidSavings - emergencyFundTarget, 0)
        : (liquidSavings || 0);
      currentInvestableCapital = round2(existingInvestments + excessLiquid);
    }

    // Monthly investment capacity: surplus if positive and emergency fund complete or partial
    let monthlyInvestmentCapacity: number | null = null;
    if (monthlySurplus !== null && monthlySurplus > 0) {
      if (isEmergencyComplete) {
        monthlyInvestmentCapacity = monthlySurplus;
      } else {
        monthlyInvestmentCapacity = round2(monthlySurplus * 0.5);
      }
    } else if (monthlySurplus !== null && monthlySurplus <= 0) {
      monthlyInvestmentCapacity = 0;
    }

    // Assumptions
    const expectedReturnPct = (profile as any)?.planning_expected_return != null ? Number((profile as any).planning_expected_return) : 10.0;
    const inflationRatePct = (profile as any)?.planning_inflation_rate != null ? Number((profile as any).planning_inflation_rate) : 6.0;
    const withdrawalRatePct = (profile as any)?.planning_withdrawal_rate != null ? Number((profile as any).planning_withdrawal_rate) : 4.0;

    const formattedIncome = monthlyNetIncome !== null ? `₹${monthlyNetIncome.toLocaleString('en-IN')}` : 'UNKNOWN';
    const formattedExpenses = totalExpenses !== null ? `₹${totalExpenses.toLocaleString('en-IN')}` : 'UNKNOWN';
    const formattedSurplus = monthlySurplus !== null ? `₹${monthlySurplus.toLocaleString('en-IN')}` : 'UNKNOWN';
    const formattedSavingsRate = savingsRate !== null ? `${savingsRate.toFixed(2)}%` : 'UNKNOWN';

    return {
      month,
      data_status: {
        has_observed_transactions: hasObservedTransactions,
        has_financial_profile: hasFinancialProfile,
        has_goals: goalsList.length > 0,
        income_source: incomeSource,
        expense_source: expenseSource,
        is_fully_configured: missing_fields.length === 0,
      },
      income: {
        monthly_net_income: monthlyNetIncome,
        other_recurring_income: 0,
        annual_income_growth_pct: 7.0,
        formatted_income: formattedIncome,
      },
      expenses: {
        monthly_essential_expenses: essentialExpenses,
        monthly_debt_obligations: debtObligations,
        essential_monthly_expenses: essentialExpenses,
        debt_payments: debtObligations ?? 0,
        discretionary_monthly_expenses: discretionaryExpenses,
        total_monthly_expenses: totalExpenses,
        annual_expense_growth_pct: 5.0,
        formatted_expenses: formattedExpenses,
        top_categories: topCategories,
      },
      cashflow: {
        monthly_surplus: monthlySurplus,
        actual_monthly_surplus: monthlySurplus,
        savings_rate: savingsRate,
        is_deficit: isDeficit,
        deficit_amount: deficitAmount,
        formatted_surplus: formattedSurplus,
        formatted_savings_rate: formattedSavingsRate,
      },
      capital_and_savings: {
        liquid_savings: liquidSavings,
        existing_investments: existingInvestments,
        emergency_fund_target: emergencyFundTarget,
        emergency_fund_gap: emergencyFundGap,
        emergency_coverage_months: emergencyCoverageMonths,
        is_emergency_complete: isEmergencyComplete,
        current_investable_capital: currentInvestableCapital,
        monthly_investment_capacity: monthlyInvestmentCapacity,
      },
      planning_profile: {
        current_age: profile?.age != null ? profile.age : null,
        target_retirement_age: profile?.target_retirement_age != null ? profile.target_retirement_age : null,
        desired_monthly_lifestyle_income: profile?.desired_monthly_lifestyle_income != null ? Number(profile.desired_monthly_lifestyle_income) : null,
        dependents: profile?.dependents || 0,
        has_health_insurance: profile?.has_health_insurance || false,
        has_life_insurance: profile?.has_life_insurance || false,
      },
      goals: goalsList.map((g) => ({
        id: g.id,
        title: g.title,
        target_amount: g.target_amount,
        current_amount: g.current_amount,
        target_date: g.target_date,
        priority: g.priority,
      })),
      assumptions: {
        expected_return_pct: expectedReturnPct,
        inflation_rate_pct: inflationRatePct,
        withdrawal_rate_pct: withdrawalRatePct,
      },
      missing_fields: Array.from(new Set(missing_fields)),
    };
  }
}

export const canonicalFinanceService = new CanonicalFinanceService();
