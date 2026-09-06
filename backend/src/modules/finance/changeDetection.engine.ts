import { CanonicalFinancialState } from './canonicalFinance.service.js';
import { CroreCalculationResult } from '../crore/crore.engine.js';
import {
  ChangeDetectionResult,
  DetectedChange,
  ChangeSourceData,
} from './changeDetection.schema.js';

export interface ChangeDetectionInput {
  currentMonth: CanonicalFinancialState;
  previousMonth: CanonicalFinancialState | null;
  currentCrore?: CroreCalculationResult | null;
  previousCrore?: CroreCalculationResult | null;
}

function formatCurrency(amount: number): string {
  const abs = Math.abs(amount);
  return `₹${abs.toLocaleString('en-IN')}`;
}

export function detectDeterministicChanges(input: ChangeDetectionInput): ChangeDetectionResult {
  const { currentMonth, previousMonth, currentCrore, previousCrore } = input;
  const currentPeriod = currentMonth.month;
  const previousPeriod = previousMonth ? previousMonth.month : null;
  const timestamp = new Date().toISOString();
  const disclaimer =
    'Deterministic change detection compares verified accounting snapshots between two periods without speculative estimation.';

  // 1. Insufficient History Verification
  // If previousMonth is missing or lacks basic financial configuration, return explicit insufficient state
  const prevHasData =
    previousMonth &&
    (previousMonth.data_status.has_observed_transactions ||
      previousMonth.data_status.has_financial_profile ||
      previousMonth.income.monthly_net_income !== null ||
      previousMonth.expenses.total_monthly_expenses !== null);

  if (!previousMonth || !prevHasData) {
    return {
      current_period: currentPeriod,
      previous_period: previousPeriod,
      has_sufficient_history: false,
      insufficient_history_reason: `Insufficient historical records for comparative audit. At least two consecutive periods are required. Baseline established for ${currentPeriod}.`,
      status: 'INSUFFICIENT_HISTORY',
      total_changes_detected: 0,
      top_changes: [],
      evaluation_timestamp: timestamp,
      disclaimer,
    };
  }

  const candidates: Array<Omit<DetectedChange, 'rank' | 'materiality_level'>> = [];

  const currSource: 'OBSERVED_LEDGER' | 'STATED_BASELINE' =
    currentMonth.data_status.income_source === 'observed_ledger' ||
    currentMonth.data_status.expense_source === 'observed_ledger'
      ? 'OBSERVED_LEDGER'
      : 'STATED_BASELINE';

  // -------------------------------------------------------------
  // 1. INCOME CHANGE
  // -------------------------------------------------------------
  const currIncome = currentMonth.income.monthly_net_income;
  const prevIncome = previousMonth.income.monthly_net_income;
  if (currIncome !== null && prevIncome !== null) {
    const delta = Math.round(currIncome - prevIncome);
    const absDelta = Math.abs(delta);
    const deltaPct = prevIncome > 0 ? Number(((delta / prevIncome) * 100).toFixed(1)) : null;

    if (absDelta >= 1000 || (deltaPct !== null && Math.abs(deltaPct) >= 2.0)) {
      const isPositive = delta > 0;
      const formatted = `${isPositive ? '+' : '-'}${formatCurrency(delta)}${deltaPct !== null ? ` (${deltaPct > 0 ? '+' : ''}${deltaPct}%)` : ''}`;
      
      candidates.push({
        id: 'income_change',
        change_type: 'income_change',
        title: 'Monthly Income Shift',
        headline: isPositive
          ? `Income expanded by ${formatCurrency(delta)} to ${formatCurrency(currIncome)}`
          : `Income contracted by ${formatCurrency(absDelta)} to ${formatCurrency(currIncome)}`,
        direction: isPositive ? 'POSITIVE' : 'NEGATIVE',
        materiality_score: absDelta * 1.0,
        current_value: currIncome,
        previous_value: prevIncome,
        delta,
        delta_pct: deltaPct,
        unit: 'INR',
        formatted_delta: formatted,
        source_data: {
          data_source: currSource,
          current_period: currentPeriod,
          previous_period: previousPeriod,
          formula_or_derivation: `Current Net Income (${formatCurrency(currIncome)}) - Prior Net Income (${formatCurrency(prevIncome)}) = ${formatted}`,
          underlying_fields: ['monthly_net_income'],
          confidence: 1.0,
        },
        deterministic_explanation: isPositive
          ? `Verified monthly earnings grew by ${formatCurrency(delta)} compared to ${previousPeriod}.`
          : `Verified monthly earnings decreased by ${formatCurrency(absDelta)} compared to ${previousPeriod}.`,
      });
    }
  }

  // -------------------------------------------------------------
  // 2. EXPENSE CHANGE
  // -------------------------------------------------------------
  const currExpenses = currentMonth.expenses.total_monthly_expenses;
  const prevExpenses = previousMonth.expenses.total_monthly_expenses;
  if (currExpenses !== null && prevExpenses !== null) {
    const delta = Math.round(currExpenses - prevExpenses);
    const absDelta = Math.abs(delta);
    const deltaPct = prevExpenses > 0 ? Number(((delta / prevExpenses) * 100).toFixed(1)) : null;

    if (absDelta >= 1000 || (deltaPct !== null && Math.abs(deltaPct) >= 2.0)) {
      // For expenses: lower is positive for financial health, higher is negative
      const isLower = delta < 0;
      const formatted = `${delta > 0 ? '+' : '-'}${formatCurrency(absDelta)}${deltaPct !== null ? ` (${deltaPct > 0 ? '+' : ''}${deltaPct}%)` : ''}`;

      candidates.push({
        id: 'expense_change',
        change_type: 'expense_change',
        title: 'Total Expenditure Movement',
        headline: isLower
          ? `Monthly expenses reduced by ${formatCurrency(absDelta)} down to ${formatCurrency(currExpenses)}`
          : `Monthly expenses increased by ${formatCurrency(delta)} up to ${formatCurrency(currExpenses)}`,
        direction: isLower ? 'POSITIVE' : 'NEGATIVE',
        materiality_score: absDelta * 1.05,
        current_value: currExpenses,
        previous_value: prevExpenses,
        delta,
        delta_pct: deltaPct,
        unit: 'INR',
        formatted_delta: formatted,
        source_data: {
          data_source: currSource,
          current_period: currentPeriod,
          previous_period: previousPeriod,
          formula_or_derivation: `Current Expenses (${formatCurrency(currExpenses)}) - Prior Expenses (${formatCurrency(prevExpenses)}) = ${formatted}`,
          underlying_fields: ['total_monthly_expenses', 'monthly_essential_expenses', 'monthly_debt_obligations'],
          confidence: 1.0,
        },
        deterministic_explanation: isLower
          ? `Expenditures contracted by ${formatCurrency(absDelta)} (${deltaPct}%). Essential expenses and debt payments absorbed less cashflow.`
          : `Expenditures expanded by ${formatCurrency(delta)} (${deltaPct}%). Total outflow increased across essential or discretionary categories.`,
      });
    }
  }

  // -------------------------------------------------------------
  // 3. SURPLUS CHANGE
  // -------------------------------------------------------------
  const currSurplus = currentMonth.cashflow.monthly_surplus;
  const prevSurplus = previousMonth.cashflow.monthly_surplus;
  if (currSurplus !== null && prevSurplus !== null) {
    const delta = Math.round(currSurplus - prevSurplus);
    const absDelta = Math.abs(delta);
    const deltaPct = prevSurplus !== 0 ? Number(((delta / Math.abs(prevSurplus)) * 100).toFixed(1)) : null;

    if (absDelta >= 500) {
      const isPositive = delta > 0;
      const formatted = `${isPositive ? '+' : '-'}${formatCurrency(absDelta)}`;
      
      // Bonus materiality if deficit state flipped
      const flippedToSurplus = prevSurplus < 0 && currSurplus >= 0;
      const flippedToDeficit = prevSurplus >= 0 && currSurplus < 0;
      const flipBonus = flippedToSurplus || flippedToDeficit ? 15000 : 0;

      candidates.push({
        id: 'surplus_change',
        change_type: 'surplus_change',
        title: 'Monthly Surplus Dynamics',
        headline: flippedToSurplus
          ? `Returned to positive cashflow: +${formatCurrency(currSurplus)} monthly surplus`
          : flippedToDeficit
          ? `Fell into cashflow deficit: ${formatCurrency(currSurplus)} monthly deficit`
          : isPositive
          ? `Monthly surplus increased by ${formatCurrency(delta)} to ${formatCurrency(currSurplus)}`
          : `Monthly surplus declined by ${formatCurrency(absDelta)} to ${formatCurrency(currSurplus)}`,
        direction: isPositive ? 'POSITIVE' : 'NEGATIVE',
        materiality_score: absDelta * 1.3 + flipBonus,
        current_value: currSurplus,
        previous_value: prevSurplus,
        delta,
        delta_pct: deltaPct,
        unit: 'INR',
        formatted_delta: formatted,
        source_data: {
          data_source: currSource,
          current_period: currentPeriod,
          previous_period: previousPeriod,
          formula_or_derivation: `Current Surplus (${formatCurrency(currSurplus)}) - Prior Surplus (${formatCurrency(prevSurplus)}) = ${formatted}`,
          underlying_fields: ['monthly_surplus', 'monthly_net_income', 'total_monthly_expenses'],
          confidence: 1.0,
        },
        deterministic_explanation: flippedToSurplus
          ? `Cashflow flipped from a ${formatCurrency(Math.abs(prevSurplus))} deficit to a positive ${formatCurrency(currSurplus)} monthly surplus.`
          : isPositive
          ? `Net cash left over after essential living and debt increased by ${formatCurrency(delta)}.`
          : `Monthly cash cushion shrank by ${formatCurrency(absDelta)}.`,
      });
    }
  }

  // -------------------------------------------------------------
  // 4. SAVINGS RATE CHANGE
  // -------------------------------------------------------------
  const currSavingsRate = currentMonth.cashflow.savings_rate;
  const prevSavingsRate = previousMonth.cashflow.savings_rate;
  if (currSavingsRate !== null && prevSavingsRate !== null) {
    const delta = Number((currSavingsRate - prevSavingsRate).toFixed(1));
    const absDelta = Math.abs(delta);

    if (absDelta >= 1.0) {
      const isPositive = delta > 0;
      const formatted = `${isPositive ? '+' : ''}${delta}% pts`;

      candidates.push({
        id: 'savings_rate_change',
        change_type: 'savings_rate_change',
        title: 'Savings Rate Shift',
        headline: isPositive
          ? `Savings rate improved by ${delta}% points to ${currSavingsRate}%`
          : `Savings rate dropped by ${absDelta}% points to ${currSavingsRate}%`,
        direction: isPositive ? 'POSITIVE' : 'NEGATIVE',
        materiality_score: absDelta * 1000,
        current_value: currSavingsRate,
        previous_value: prevSavingsRate,
        delta,
        delta_pct: null,
        unit: 'PERCENT',
        formatted_delta: formatted,
        source_data: {
          data_source: currSource,
          current_period: currentPeriod,
          previous_period: previousPeriod,
          formula_or_derivation: `Current Rate (${currSavingsRate}%) - Prior Rate (${prevSavingsRate}%) = ${formatted}`,
          underlying_fields: ['savings_rate'],
          confidence: 1.0,
        },
        deterministic_explanation: isPositive
          ? `You converted ${currSavingsRate}% of net income to savings and wealth building, up from ${prevSavingsRate}%.`
          : `Savings conversion softened from ${prevSavingsRate}% to ${currSavingsRate}%.`,
      });
    }
  }

  // -------------------------------------------------------------
  // 5. LARGEST CATEGORY MOVEMENT
  // -------------------------------------------------------------
  const currCategories = currentMonth.expenses.top_categories || [];
  const prevCategories = previousMonth.expenses.top_categories || [];

  const categoryMap = new Map<string, { curr: number; prev: number }>();
  for (const c of currCategories) {
    categoryMap.set(c.category, { curr: c.amount, prev: 0 });
  }
  for (const p of prevCategories) {
    const existing = categoryMap.get(p.category);
    if (existing) {
      existing.prev = p.amount;
    } else {
      categoryMap.set(p.category, { curr: 0, prev: p.amount });
    }
  }

  let largestCatMovement: { category: string; curr: number; prev: number; delta: number; absDelta: number } | null = null;
  for (const [catName, vals] of categoryMap.entries()) {
    const delta = Math.round(vals.curr - vals.prev);
    const absDelta = Math.abs(delta);
    if (!largestCatMovement || absDelta > largestCatMovement.absDelta) {
      largestCatMovement = { category: catName, curr: vals.curr, prev: vals.prev, delta, absDelta };
    }
  }

  if (largestCatMovement && largestCatMovement.absDelta >= 500) {
    const isIncrease = largestCatMovement.delta > 0;
    const formatted = `${isIncrease ? '+' : '-'}${formatCurrency(largestCatMovement.absDelta)}`;

    candidates.push({
      id: 'largest_category_movement',
      change_type: 'largest_category_movement',
      title: `Category Outlier: ${largestCatMovement.category}`,
      headline: isIncrease
        ? `${largestCatMovement.category} increased by ${formatCurrency(largestCatMovement.delta)} to ${formatCurrency(largestCatMovement.curr)}`
        : `${largestCatMovement.category} spending dropped by ${formatCurrency(largestCatMovement.absDelta)} to ${formatCurrency(largestCatMovement.curr)}`,
      direction: isIncrease ? 'NEGATIVE' : 'POSITIVE',
      materiality_score: largestCatMovement.absDelta * 0.9,
      current_value: largestCatMovement.curr,
      previous_value: largestCatMovement.prev,
      delta: largestCatMovement.delta,
      delta_pct: largestCatMovement.prev > 0 ? Number(((largestCatMovement.delta / largestCatMovement.prev) * 100).toFixed(1)) : null,
      unit: 'INR',
      formatted_delta: formatted,
      source_data: {
        data_source: 'OBSERVED_LEDGER',
        current_period: currentPeriod,
        previous_period: previousPeriod,
        formula_or_derivation: `Category ${largestCatMovement.category}: Current (${formatCurrency(largestCatMovement.curr)}) - Prior (${formatCurrency(largestCatMovement.prev)}) = ${formatted}`,
        underlying_fields: ['top_categories'],
        confidence: 1.0,
      },
      deterministic_explanation: isIncrease
        ? `${largestCatMovement.category} was the single largest expenditure escalation this cycle.`
        : `${largestCatMovement.category} recorded the largest reduction in outflows this cycle.`,
    });
  }

  // -------------------------------------------------------------
  // 6. EMERGENCY FUND PROGRESS
  // -------------------------------------------------------------
  const currLiquid = currentMonth.capital_and_savings.liquid_savings;
  const prevLiquid = previousMonth.capital_and_savings.liquid_savings;
  const currCoverage = currentMonth.capital_and_savings.emergency_coverage_months;
  const prevCoverage = previousMonth.capital_and_savings.emergency_coverage_months;
  const isNowComplete = currentMonth.capital_and_savings.is_emergency_complete;
  const wasComplete = previousMonth.capital_and_savings.is_emergency_complete;

  if (currLiquid !== null && prevLiquid !== null) {
    const delta = Math.round(currLiquid - prevLiquid);
    const absDelta = Math.abs(delta);

    if (absDelta >= 1000 || (currCoverage !== null && prevCoverage !== null && Math.abs(currCoverage - prevCoverage) >= 0.2)) {
      const isPositive = delta > 0;
      const formatted = `${isPositive ? '+' : '-'}${formatCurrency(absDelta)}`;
      const completionBonus = isNowComplete && !wasComplete ? 12000 : 0;

      candidates.push({
        id: 'emergency_fund_progress',
        change_type: 'emergency_fund_progress',
        title: 'Emergency Cushion Trajectory',
        headline: isNowComplete && !wasComplete
          ? `Emergency fund milestone reached: fully funded at ${formatCurrency(currLiquid)}`
          : isPositive
          ? `Added ${formatCurrency(delta)} to emergency reserves (${currCoverage ?? '—'} mo coverage)`
          : `Emergency reserves drew down by ${formatCurrency(absDelta)} (${currCoverage ?? '—'} mo coverage)`,
        direction: isPositive ? 'POSITIVE' : 'NEGATIVE',
        materiality_score: absDelta * 1.15 + completionBonus,
        current_value: currLiquid,
        previous_value: prevLiquid,
        delta,
        delta_pct: prevLiquid > 0 ? Number(((delta / prevLiquid) * 100).toFixed(1)) : null,
        unit: 'INR',
        formatted_delta: formatted,
        source_data: {
          data_source: currSource,
          current_period: currentPeriod,
          previous_period: previousPeriod,
          formula_or_derivation: `Liquid Savings (${formatCurrency(currLiquid)}) - Prior Liquid Savings (${formatCurrency(prevLiquid)}) = ${formatted}`,
          underlying_fields: ['liquid_savings', 'emergency_fund_target', 'emergency_coverage_months'],
          confidence: 1.0,
        },
        deterministic_explanation: isNowComplete && !wasComplete
          ? `Liquid emergency reserve reached 100% of target (${currentMonth.capital_and_savings.emergency_fund_target ? formatCurrency(currentMonth.capital_and_savings.emergency_fund_target) : ''}). Essential living expenses are fully safeguarded.`
          : isPositive
          ? `Liquid reserves strengthened by ${formatCurrency(delta)}, advancing runway to ${currCoverage} months.`
          : `Liquid safety buffer decreased by ${formatCurrency(absDelta)}.`,
      });
    }
  }

  // -------------------------------------------------------------
  // 7. INVESTMENT CONTRIBUTION CHANGE
  // -------------------------------------------------------------
  const currInvestCap = currentMonth.capital_and_savings.monthly_investment_capacity;
  const prevInvestCap = previousMonth.capital_and_savings.monthly_investment_capacity;
  if (currInvestCap !== null && prevInvestCap !== null) {
    const delta = Math.round(currInvestCap - prevInvestCap);
    const absDelta = Math.abs(delta);

    if (absDelta >= 1000) {
      const isPositive = delta > 0;
      const formatted = `${isPositive ? '+' : '-'}${formatCurrency(absDelta)}`;

      candidates.push({
        id: 'investment_contribution_change',
        change_type: 'investment_contribution_change',
        title: 'Monthly Investment Capacity',
        headline: isPositive
          ? `Deployable investment capacity grew by ${formatCurrency(delta)} to ${formatCurrency(currInvestCap)}/mo`
          : `Deployable investment capacity tightened by ${formatCurrency(absDelta)} to ${formatCurrency(currInvestCap)}/mo`,
        direction: isPositive ? 'POSITIVE' : 'NEGATIVE',
        materiality_score: absDelta * 1.0,
        current_value: currInvestCap,
        previous_value: prevInvestCap,
        delta,
        delta_pct: prevInvestCap > 0 ? Number(((delta / prevInvestCap) * 100).toFixed(1)) : null,
        unit: 'INR',
        formatted_delta: formatted,
        source_data: {
          data_source: currSource,
          current_period: currentPeriod,
          previous_period: previousPeriod,
          formula_or_derivation: `Current Capacity (${formatCurrency(currInvestCap)}) - Prior Capacity (${formatCurrency(prevInvestCap)}) = ${formatted}`,
          underlying_fields: ['monthly_investment_capacity'],
          confidence: 1.0,
        },
        deterministic_explanation: isPositive
          ? `Long-term compounding capacity expanded by ${formatCurrency(delta)} monthly.`
          : `Deployable monthly compounding allocation reduced by ${formatCurrency(absDelta)}.`,
      });
    }
  }

  // -------------------------------------------------------------
  // 8. GOAL PROGRESS
  // -------------------------------------------------------------
  const currGoalsTotal = currentMonth.goals.reduce((acc, g) => acc + (g.current_amount || 0), 0);
  const prevGoalsTotal = previousMonth.goals.reduce((acc, g) => acc + (g.current_amount || 0), 0);
  if (currentMonth.goals.length > 0 && (currGoalsTotal > 0 || prevGoalsTotal > 0)) {
    const delta = Math.round(currGoalsTotal - prevGoalsTotal);
    const absDelta = Math.abs(delta);

    if (absDelta >= 1000) {
      const isPositive = delta > 0;
      const formatted = `${isPositive ? '+' : '-'}${formatCurrency(absDelta)}`;

      candidates.push({
        id: 'goal_progress',
        change_type: 'goal_progress',
        title: 'Financial Goals Accumulation',
        headline: isPositive
          ? `Total goal balances grew by ${formatCurrency(delta)} to ${formatCurrency(currGoalsTotal)}`
          : `Goal allocations decreased by ${formatCurrency(absDelta)} to ${formatCurrency(currGoalsTotal)}`,
        direction: isPositive ? 'POSITIVE' : 'NEGATIVE',
        materiality_score: absDelta * 0.95,
        current_value: currGoalsTotal,
        previous_value: prevGoalsTotal,
        delta,
        delta_pct: prevGoalsTotal > 0 ? Number(((delta / prevGoalsTotal) * 100).toFixed(1)) : null,
        unit: 'INR',
        formatted_delta: formatted,
        source_data: {
          data_source: currSource,
          current_period: currentPeriod,
          previous_period: previousPeriod,
          formula_or_derivation: `Goal Balances (${formatCurrency(currGoalsTotal)}) - Prior Balances (${formatCurrency(prevGoalsTotal)}) = ${formatted}`,
          underlying_fields: ['goals.current_amount'],
          confidence: 1.0,
        },
        deterministic_explanation: isPositive
          ? `Cumulative contributions towards your active targets grew by ${formatCurrency(delta)}.`
          : `Active goal reserves reduced by ${formatCurrency(absDelta)}.`,
      });
    }
  }

  // -------------------------------------------------------------
  // 9. ₹1 CRORE TIMELINE CHANGE
  // -------------------------------------------------------------
  const currCroreMonths = currentCrore?.base_case?.months_to_target ?? null;
  const prevCroreMonths = previousCrore?.base_case?.months_to_target ?? null;

  if (currCroreMonths !== null && prevCroreMonths !== null) {
    const deltaMonths = currCroreMonths - prevCroreMonths;
    const absMonths = Math.abs(deltaMonths);

    if (absMonths >= 1) {
      // For months to target: negative delta means reached sooner (accelerated!)
      const isAccelerated = deltaMonths < 0;
      const formatted = isAccelerated
        ? `${absMonths} months faster`
        : `${absMonths} months delayed`;

      candidates.push({
        id: 'crore_timeline_change',
        change_type: 'crore_timeline_change',
        title: '₹1 Crore Wealth Timeline Shift',
        headline: isAccelerated
          ? `₹1 Crore path accelerated by ${absMonths} months (target: ${currentCrore?.base_case?.target_date ?? 'earlier'})`
          : `₹1 Crore path slowed down by ${absMonths} months (target: ${currentCrore?.base_case?.target_date ?? 'later'})`,
        direction: isAccelerated ? 'POSITIVE' : 'NEGATIVE',
        materiality_score: absMonths * 6000,
        current_value: currCroreMonths,
        previous_value: prevCroreMonths,
        delta: deltaMonths,
        delta_pct: prevCroreMonths > 0 ? Number(((deltaMonths / prevCroreMonths) * 100).toFixed(1)) : null,
        unit: 'MONTHS',
        formatted_delta: formatted,
        source_data: {
          data_source: 'DETERMINISTIC_MODEL',
          current_period: currentPeriod,
          previous_period: previousPeriod,
          formula_or_derivation: `Current Timeline (${currCroreMonths} mo) - Prior Timeline (${prevCroreMonths} mo) = ${formatted}`,
          underlying_fields: ['crore.base_case.months_to_target'],
          confidence: 1.0,
        },
        deterministic_explanation: isAccelerated
          ? `Higher surplus or capital efficiency brought your ₹1 Crore milestone ${absMonths} months closer.`
          : `Lower monthly surplus or spending pressure extended your ₹1 Crore timeline by ${absMonths} months.`,
      });
    }
  }

  // -------------------------------------------------------------
  // RANK BY MATERIALITY & RETURN TOP 3 MAXIMUM
  // -------------------------------------------------------------
  candidates.sort((a, b) => b.materiality_score - a.materiality_score);

  const top3 = candidates.slice(0, 3).map((item, idx) => {
    let level: 'CRITICAL' | 'SIGNIFICANT' | 'MODERATE' = 'MODERATE';
    if (item.materiality_score >= 18000) {
      level = 'CRITICAL';
    } else if (item.materiality_score >= 4500) {
      level = 'SIGNIFICANT';
    }

    return {
      ...item,
      rank: idx + 1,
      materiality_level: level,
    };
  });

  const status = top3.length > 0 ? 'ANALYSIS_COMPLETE' : 'NO_MATERIAL_CHANGES';

  return {
    current_period: currentPeriod,
    previous_period: previousPeriod,
    has_sufficient_history: true,
    status,
    total_changes_detected: candidates.length,
    top_changes: top3,
    evaluation_timestamp: timestamp,
    disclaimer,
  };
}
