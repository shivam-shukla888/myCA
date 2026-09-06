import { CanonicalFinancialState } from './canonicalFinance.service.js';
import { CroreCalculationResult } from '../crore/crore.engine.js';
import {
  StructuredMonthlyReview,
  FinancialMetricChange,
  ReviewMilestone,
} from './monthlyReview.schema.js';
import { round2 } from '../allocation/allocation.engine.js';

export interface MonthlyReviewEngineInput {
  currentMonth: CanonicalFinancialState;
  previousMonth: CanonicalFinancialState | null;
  currentCrore: CroreCalculationResult | null;
  previousCrore: CroreCalculationResult | null;
  historicalStates?: CanonicalFinancialState[];
}

export function generateStructuredMonthlyReview(input: MonthlyReviewEngineInput): StructuredMonthlyReview {
  const { currentMonth, previousMonth, currentCrore, previousCrore, historicalStates = [] } = input;
  const hasPriorData = previousMonth !== null && (
    previousMonth.income.monthly_net_income !== null ||
    previousMonth.expenses.total_monthly_expenses !== null
  );

  // ---------------------------------------------------------------------------
  // 1. WHAT CHANGED?
  // ---------------------------------------------------------------------------
  const currIncome = currentMonth.income.monthly_net_income;
  const prevIncome = hasPriorData ? previousMonth!.income.monthly_net_income : null;
  const incomeChange = computeMetricChange(currIncome, prevIncome, 'higher_is_better');

  const currExp = currentMonth.expenses.total_monthly_expenses;
  const prevExp = hasPriorData ? previousMonth!.expenses.total_monthly_expenses : null;
  const expChange = computeMetricChange(currExp, prevExp, 'lower_is_better');

  const currSurplus = currentMonth.cashflow.monthly_surplus;
  const prevSurplus = hasPriorData ? previousMonth!.cashflow.monthly_surplus : null;
  const surplusChange = computeMetricChange(currSurplus, prevSurplus, 'higher_is_better');

  const currSavingsRate = currentMonth.cashflow.savings_rate;
  const prevSavingsRate = hasPriorData ? previousMonth!.cashflow.savings_rate : null;
  const savingsRateChange = computeMetricChange(currSavingsRate, prevSavingsRate, 'higher_is_better');

  let whatChangedSummary = '';
  if (!hasPriorData) {
    whatChangedSummary = `Prior month data is unavailable. Baseline established for ${currentMonth.month}: Net Income is ₹${(currIncome ?? 0).toLocaleString('en-IN')}, Total Expenses are ₹${(currExp ?? 0).toLocaleString('en-IN')}, and Monthly Surplus is ₹${(currSurplus ?? 0).toLocaleString('en-IN')}.`;
  } else {
    const parts: string[] = [];
    if (incomeChange.delta !== null && incomeChange.delta !== 0) {
      parts.push(`Income ${incomeChange.delta > 0 ? 'increased' : 'decreased'} by ₹${Math.abs(incomeChange.delta).toLocaleString('en-IN')}`);
    }
    if (expChange.delta !== null && expChange.delta !== 0) {
      parts.push(`expenses ${expChange.delta > 0 ? 'increased' : 'decreased'} by ₹${Math.abs(expChange.delta).toLocaleString('en-IN')}`);
    }
    if (surplusChange.delta !== null && surplusChange.delta !== 0) {
      parts.push(`surplus ${surplusChange.delta > 0 ? 'grew' : 'contracted'} by ₹${Math.abs(surplusChange.delta).toLocaleString('en-IN')}`);
    }
    whatChangedSummary = parts.length > 0
      ? `Compared to last month, ${parts.join(', ')}.`
      : `Your income, expenses, and surplus remained virtually identical to last month.`;
  }

  // ---------------------------------------------------------------------------
  // 2. WHY DID IT CHANGE?
  // ---------------------------------------------------------------------------
  const currCategories = currentMonth.expenses.top_categories || [];
  const prevCategories = (hasPriorData && previousMonth!.expenses.top_categories) ? previousMonth!.expenses.top_categories : [];

  const categoryDrivers: Array<{
    category: string;
    current_amount: number;
    previous_amount: number | null;
    delta: number | null;
    percentage_of_total_change?: number;
  }> = [];

  const totalExpDelta = expChange.delta ?? 0;

  for (const currCat of currCategories) {
    const prevCat = prevCategories.find((c) => c.category.toLowerCase() === currCat.category.toLowerCase());
    const prevAmt = prevCat ? prevCat.amount : null;
    const catDelta = prevAmt !== null ? round2(currCat.amount - prevAmt) : null;
    const pctOfChange = (totalExpDelta !== 0 && catDelta !== null) ? round2((catDelta / totalExpDelta) * 100) : undefined;

    categoryDrivers.push({
      category: currCat.category,
      current_amount: currCat.amount,
      previous_amount: prevAmt,
      delta: catDelta,
      percentage_of_total_change: pctOfChange,
    });
  }

  let whyItChangedSummary = '';
  if (!hasPriorData) {
    const topLead = currCategories[0];
    whyItChangedSummary = topLead
      ? `Prior month category data is unavailable. In ${currentMonth.month}, your primary spending was led by ${topLead.category} (₹${topLead.amount.toLocaleString('en-IN')}, accounting for ${topLead.percentage}% of total expenses).`
      : 'Prior month data is unavailable to calculate category spending variance.';
  } else {
    const significantDriver = categoryDrivers
      .filter((c) => c.delta !== null && Math.abs(c.delta) > 1000)
      .sort((a, b) => Math.abs(b.delta || 0) - Math.abs(a.delta || 0))[0];

    if (significantDriver && significantDriver.delta) {
      const direction = significantDriver.delta > 0 ? 'an increase' : 'a decrease';
      whyItChangedSummary = `The primary driver of the spending variance was ${direction} of ₹${Math.abs(significantDriver.delta).toLocaleString('en-IN')} in ${significantDriver.category}.`;
    } else {
      whyItChangedSummary = 'Spending changes were distributed evenly across multiple routine categories without a single dominant spike.';
    }
  }

  // ---------------------------------------------------------------------------
  // 3. WHAT IMPROVED?
  // ---------------------------------------------------------------------------
  const improvedItems: string[] = [];
  if (hasPriorData) {
    if (surplusChange.delta !== null && surplusChange.delta > 0) {
      improvedItems.push(`Monthly surplus expanded by +₹${surplusChange.delta.toLocaleString('en-IN')}.`);
    }
    if (savingsRateChange.delta !== null && savingsRateChange.delta > 0) {
      improvedItems.push(`Savings rate improved by +${savingsRateChange.delta}% percentage points.`);
    }
    if (expChange.delta !== null && expChange.delta < 0) {
      improvedItems.push(`Total monthly expenses decreased by ₹${Math.abs(expChange.delta).toLocaleString('en-IN')}.`);
    }
    const currDebt = currentMonth.expenses.monthly_debt_obligations ?? 0;
    const prevDebt = previousMonth!.expenses.monthly_debt_obligations ?? 0;
    if (currDebt < prevDebt) {
      improvedItems.push(`Debt obligations reduced by ₹${(prevDebt - currDebt).toLocaleString('en-IN')}/mo.`);
    }
  } else {
    if (currSurplus !== null && currSurplus > 0) {
      improvedItems.push(`Achieved a positive baseline monthly cashflow surplus of ₹${currSurplus.toLocaleString('en-IN')}.`);
    }
    if (currSavingsRate !== null && currSavingsRate > 0) {
      improvedItems.push(`Established a baseline savings rate of ${currSavingsRate}%.`);
    }
  }

  if (currentMonth.capital_and_savings.is_emergency_complete) {
    improvedItems.push('Your liquid emergency reserve is fully funded (100% target achieved).');
  }

  const whatImprovedSummary = improvedItems.length > 0
    ? improvedItems.join(' ')
    : 'Core commitments and emergency reserves were preserved without debt expansion.';

  // ---------------------------------------------------------------------------
  // 4. WHAT GOT WORSE? (Constructive, non-shaming, objective)
  // ---------------------------------------------------------------------------
  const worsenedItems: string[] = [];
  if (hasPriorData) {
    if (surplusChange.delta !== null && surplusChange.delta < 0) {
      worsenedItems.push(`Monthly surplus contracted by ₹${Math.abs(surplusChange.delta).toLocaleString('en-IN')}.`);
    }
    if (savingsRateChange.delta !== null && savingsRateChange.delta < 0) {
      worsenedItems.push(`Savings rate decreased by ${Math.abs(savingsRateChange.delta)}% points.`);
    }
    if (expChange.delta !== null && expChange.delta > 0) {
      worsenedItems.push(`Expenses rose by ₹${expChange.delta.toLocaleString('en-IN')}.`);
    }
  } else {
    worsenedItems.push('No prior month data is available to evaluate declines.');
  }

  const whatGotWorseSummary = worsenedItems.length > 0 && hasPriorData
    ? worsenedItems.join(' ')
    : 'No financial indicators degraded this month; expenses remained within planned parameters.';

  // ---------------------------------------------------------------------------
  // 5. WHAT IS MY CURRENT SURPLUS?
  // ---------------------------------------------------------------------------
  const netIncome = currIncome ?? 0;
  const essentialExp = currentMonth.expenses.monthly_essential_expenses ?? (currentMonth.expenses.essential_monthly_expenses ?? (currExp ?? 0));
  const debtObligations = currentMonth.expenses.monthly_debt_obligations ?? (currentMonth.expenses.debt_payments ?? 0);
  const totalExpenses = essentialExp + debtObligations;
  const computedSurplus = currSurplus !== null ? currSurplus : (netIncome - totalExpenses);
  const isDeficit = currentMonth.cashflow.is_deficit || computedSurplus < 0;

  const currentSurplusObj = {
    amount: computedSurplus,
    formatted: `₹${Math.abs(computedSurplus).toLocaleString('en-IN')}`,
    is_deficit: isDeficit,
    formula_breakdown: `₹${netIncome.toLocaleString('en-IN')} Net Income - ₹${essentialExp.toLocaleString('en-IN')} Essentials - ₹${debtObligations.toLocaleString('en-IN')} Debt = ${computedSurplus >= 0 ? '+' : '-'}₹${Math.abs(computedSurplus).toLocaleString('en-IN')}`,
    status_label: isDeficit ? 'CASHFLOW DEFICIT' : 'POSITIVE SURPLUS',
  };

  // ---------------------------------------------------------------------------
  // 6. HOW IS MY SAVINGS RATE CHANGING?
  // ---------------------------------------------------------------------------
  const savingsRateTrend = {
    current_rate: currSavingsRate,
    previous_rate: prevSavingsRate,
    delta_percentage_points: savingsRateChange.delta,
    trend_description: hasPriorData && savingsRateChange.delta !== null
      ? (savingsRateChange.delta > 0
          ? `Your savings rate improved by +${savingsRateChange.delta}% points (from ${prevSavingsRate}% to ${currSavingsRate}%).`
          : savingsRateChange.delta < 0
          ? `Your savings rate changed by ${savingsRateChange.delta}% points (from ${prevSavingsRate}% to ${currSavingsRate}%).`
          : `Your savings rate remained steady at ${currSavingsRate}%.`)
      : (currSavingsRate !== null ? `Current savings rate is established at ${currSavingsRate}%.` : 'Savings rate is not yet established.'),
  };

  // ---------------------------------------------------------------------------
  // 7. HOW IS MY EMERGENCY FUND PROGRESSING?
  // ---------------------------------------------------------------------------
  const currentLiquid = currentMonth.capital_and_savings.liquid_savings ?? 0;
  const emergencyTarget = currentMonth.capital_and_savings.emergency_fund_target ?? 0;
  const emergencyGap = currentMonth.capital_and_savings.emergency_fund_gap ?? Math.max(emergencyTarget - currentLiquid, 0);
  const coverageMonths = currentMonth.capital_and_savings.emergency_coverage_months ?? (essentialExp > 0 ? round2(currentLiquid / essentialExp) : 0);
  const emergencyPct = emergencyTarget > 0 ? Math.min(round2((currentLiquid / emergencyTarget) * 100), 100) : 100;

  const emergencyStatus = emergencyPct >= 100
    ? 'FULLY_FUNDED'
    : emergencyPct >= 50
    ? 'IN_PROGRESS'
    : 'NEEDS_ATTENTION';

  let emergencyMoM = 'Baseline reserve established.';
  if (hasPriorData && previousMonth!.capital_and_savings.liquid_savings !== null) {
    const prevLiquid = previousMonth!.capital_and_savings.liquid_savings ?? 0;
    const deltaLiquid = round2(currentLiquid - prevLiquid);
    if (deltaLiquid > 0) {
      emergencyMoM = `Reserve grew by +₹${deltaLiquid.toLocaleString('en-IN')} compared to last month.`;
    } else if (deltaLiquid < 0) {
      emergencyMoM = `Reserve decreased by ₹${Math.abs(deltaLiquid).toLocaleString('en-IN')} to absorb outlays.`;
    } else {
      emergencyMoM = 'Reserve balance held constant.';
    }
  }

  const emergencyFundProgress = {
    current_amount: currentLiquid,
    target_amount: emergencyTarget,
    gap_amount: emergencyGap,
    coverage_months: coverageMonths,
    progress_pct: emergencyPct,
    status: emergencyStatus as 'FULLY_FUNDED' | 'IN_PROGRESS' | 'NEEDS_ATTENTION',
    month_over_month_change: emergencyMoM,
  };

  // ---------------------------------------------------------------------------
  // 8. DID MY ₹1CR PATH ACCELERATE OR SLOW DOWN?
  // ---------------------------------------------------------------------------
  let croreTrajectoryStatus: 'ACCELERATED' | 'SLOWED_DOWN' | 'PACE_MAINTAINED' | 'BASELINE_ESTABLISHED' | 'UNAVAILABLE' = 'UNAVAILABLE';
  let croreMonthsDelta: number | null = null;
  let croreSummary = '₹1 Crore trajectory unavailable; requires verified monthly surplus or capital.';

  const currTargetMonths = currentCrore?.base_case.months_to_target ?? null;
  const currTargetDate = currentCrore?.base_case.target_date ?? null;
  const prevTargetMonths = previousCrore?.base_case.months_to_target ?? null;
  const prevTargetDate = previousCrore?.base_case.target_date ?? null;

  if (currTargetMonths !== null && prevTargetMonths !== null) {
    croreMonthsDelta = currTargetMonths - prevTargetMonths; // Negative means reached earlier (faster)
    if (croreMonthsDelta < 0) {
      croreTrajectoryStatus = 'ACCELERATED';
      croreSummary = `Your ₹1 Crore path accelerated by ${Math.abs(croreMonthsDelta)} months (${round2(Math.abs(croreMonthsDelta) / 12)} years earlier), moving arrival from ${prevTargetDate} to ${currTargetDate}.`;
    } else if (croreMonthsDelta > 0) {
      croreTrajectoryStatus = 'SLOWED_DOWN';
      croreSummary = `Your ₹1 Crore path extended by ${croreMonthsDelta} months, adjusting arrival from ${prevTargetDate} to ${currTargetDate}.`;
    } else {
      croreTrajectoryStatus = 'PACE_MAINTAINED';
      croreSummary = `Your ₹1 Crore path maintained steady pace, on track for arrival in ${currTargetDate} (${currTargetMonths} months).`;
    }
  } else if (currTargetMonths !== null) {
    croreTrajectoryStatus = 'BASELINE_ESTABLISHED';
    croreSummary = `Projected arrival is ${currTargetDate} (${currTargetMonths} months / ${round2(currTargetMonths / 12)} years) based on current compounding pace.`;
  }

  const croreTrajectory = {
    status: croreTrajectoryStatus,
    current_target_date: currTargetDate,
    previous_target_date: prevTargetDate,
    current_months_to_target: currTargetMonths,
    previous_months_to_target: prevTargetMonths,
    months_delta: croreMonthsDelta,
    summary: croreSummary,
  };

  // ---------------------------------------------------------------------------
  // 9. WHAT ONE ACTION MATTERS NEXT?
  // ---------------------------------------------------------------------------
  let oneAction = '';
  let oneReason = '';
  let priorityArea: 'EMERGENCY_RESERVE' | 'HIGH_COST_DEBT' | 'EXPENSE_DISCIPLINE' | 'COMPOUNDING_SIP' | 'CAPITAL_PRESERVATION' = 'COMPOUNDING_SIP';

  if (isDeficit) {
    priorityArea = 'EXPENSE_DISCIPLINE';
    oneAction = `Address discretionary spending to eliminate your ₹${Math.abs(computedSurplus).toLocaleString('en-IN')} cashflow deficit.`;
    oneReason = 'A positive monthly surplus is the mathematical foundation for safety and wealth compounding.';
  } else if (emergencyGap > 0) {
    priorityArea = 'EMERGENCY_RESERVE';
    const suggestedAllocation = Math.min(computedSurplus > 0 ? computedSurplus : 5000, emergencyGap);
    oneAction = `Allocate ₹${suggestedAllocation.toLocaleString('en-IN')} from your monthly surplus toward your emergency fund gap.`;
    oneReason = `Closing the remaining ₹${emergencyGap.toLocaleString('en-IN')} reserve gap guarantees you never liquidate long-term investments during unexpected shocks.`;
  } else if (debtObligations > 0) {
    priorityArea = 'HIGH_COST_DEBT';
    oneAction = `Direct ₹${Math.min(computedSurplus, debtObligations).toLocaleString('en-IN')} toward accelerating debt elimination.`;
    oneReason = 'Retiring debt frees recurring cashflow immediately into investable surplus.';
  } else {
    priorityArea = 'COMPOUNDING_SIP';
    const sipAmount = computedSurplus > 0 ? computedSurplus : 10000;
    oneAction = `Set up an automated systematic investment of ₹${sipAmount.toLocaleString('en-IN')}/mo scheduled on salary day.`;
    oneReason = 'Automating compounding early each month protects your surplus from incidental lifestyle drift.';
  }

  const oneActionMattersNext = {
    action: oneAction,
    reason: oneReason,
    priority_area: priorityArea,
  };

  // ---------------------------------------------------------------------------
  // MEANINGFUL MILESTONES
  // ---------------------------------------------------------------------------
  const allMonths = [...historicalStates, currentMonth];
  const positiveSurplusMonthsCount = allMonths.filter(m => (m.cashflow.monthly_surplus ?? 0) > 0).length;

  const milestones: ReviewMilestone[] = [
    {
      id: 'first_positive_surplus',
      title: 'First Positive Surplus',
      status: (currSurplus !== null && currSurplus > 0) || positiveSurplusMonthsCount > 0 ? 'ACHIEVED' : 'IN_PROGRESS',
      description: 'Record a month where verified net income exceeds total expenses.',
      achieved_date: (currSurplus !== null && currSurplus > 0) ? currentMonth.month : null,
    },
    {
      id: 'emergency_fund_fully_funded',
      title: 'Emergency Fund Fully Funded',
      status: emergencyPct >= 100 ? 'ACHIEVED' : 'IN_PROGRESS',
      progress_pct: emergencyPct,
      description: `Maintain liquid savings covering 6 months of essential living expenses (₹${emergencyTarget.toLocaleString('en-IN')}).`,
      achieved_date: emergencyPct >= 100 ? currentMonth.month : null,
    },
    {
      id: 'savings_rate_improvement',
      title: 'Savings Rate Improvement',
      status: (hasPriorData && savingsRateChange.delta !== null && savingsRateChange.delta > 0) ? 'ACHIEVED' : 'IN_PROGRESS',
      progress_pct: currSavingsRate ?? 0,
      description: 'Increase your monthly savings rate relative to the prior baseline.',
      achieved_date: (hasPriorData && savingsRateChange.delta !== null && savingsRateChange.delta > 0) ? currentMonth.month : null,
    },
    {
      id: 'target_acceleration',
      title: '₹1 Crore Target Acceleration',
      status: croreTrajectoryStatus === 'ACCELERATED' ? 'ACHIEVED' : (croreTrajectoryStatus === 'BASELINE_ESTABLISHED' ? 'IN_PROGRESS' : 'LOCKED'),
      description: 'Shorten the projected time to ₹1 Crore by increasing monthly investments or capital efficiency.',
      achieved_date: croreTrajectoryStatus === 'ACCELERATED' ? currentMonth.month : null,
    },
    {
      id: 'debt_reduction',
      title: 'Debt Reduction',
      status: debtObligations === 0 ? 'ACHIEVED' : (hasPriorData && (previousMonth!.expenses.monthly_debt_obligations ?? 0) > debtObligations ? 'ACHIEVED' : 'IN_PROGRESS'),
      description: 'Reduce or eliminate monthly debt obligations to expand free surplus.',
      achieved_date: debtObligations === 0 ? currentMonth.month : null,
    },
    {
      id: 'consistent_positive_cashflow',
      title: 'Consistent Positive Cashflow',
      status: positiveSurplusMonthsCount >= 3 ? 'ACHIEVED' : (positiveSurplusMonthsCount > 0 ? 'IN_PROGRESS' : 'LOCKED'),
      progress_pct: Math.min(round2((positiveSurplusMonthsCount / 3) * 100), 100),
      description: 'Sustain positive monthly surplus across at least 3 consecutive review periods.',
      achieved_date: positiveSurplusMonthsCount >= 3 ? currentMonth.month : null,
    },
  ];

  return {
    month: currentMonth.month,
    has_prior_month_data: hasPriorData,
    prior_month_note: !hasPriorData ? 'Prior month data is unavailable; comparisons will unlock after recording multiple periods.' : undefined,
    what_changed: {
      summary: whatChangedSummary,
      income: incomeChange,
      expenses: expChange,
      surplus: surplusChange,
      savings_rate: savingsRateChange,
    },
    why_it_changed: {
      summary: whyItChangedSummary,
      top_category_drivers: categoryDrivers,
    },
    what_improved: {
      items: improvedItems,
      summary: whatImprovedSummary,
    },
    what_got_worse: {
      items: worsenedItems,
      summary: whatGotWorseSummary,
    },
    current_surplus: currentSurplusObj,
    savings_rate_trend: savingsRateTrend,
    emergency_fund_progress: emergencyFundProgress,
    crore_path_trajectory: croreTrajectory,
    one_action_matters_next: oneActionMattersNext,
    milestones,
    anti_dark_pattern_compliance: {
      no_streak_anxiety: true,
      no_shaming: true,
      no_fear: true,
      no_fomo: true,
      no_fake_urgency: true,
      no_excessive_notifications: true,
    },
  };
}

function computeMetricChange(
  current: number | null,
  previous: number | null,
  polarity: 'higher_is_better' | 'lower_is_better'
): FinancialMetricChange {
  if (current === null && previous === null) {
    return { current: null, previous: null, delta: null, delta_pct: null, direction: 'BASELINE' };
  }
  if (previous === null) {
    return { current, previous: null, delta: null, delta_pct: null, direction: 'BASELINE' };
  }
  if (current === null) {
    return { current: null, previous, delta: null, delta_pct: null, direction: 'BASELINE' };
  }

  const delta = round2(current - previous);
  const delta_pct = previous !== 0 ? round2((delta / Math.abs(previous)) * 100) : null;

  let direction: 'IMPROVED' | 'DEGRADED' | 'UNCHANGED' = 'UNCHANGED';
  if (delta === 0) {
    direction = 'UNCHANGED';
  } else if (polarity === 'higher_is_better') {
    direction = delta > 0 ? 'IMPROVED' : 'DEGRADED';
  } else {
    direction = delta < 0 ? 'IMPROVED' : 'DEGRADED';
  }

  return {
    current,
    previous,
    delta,
    delta_pct,
    direction,
  };
}
