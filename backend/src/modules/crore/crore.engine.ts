import { round2 } from '../allocation/allocation.engine.js';

export const CRORE_TARGET = 10000000; // ₹1,00,00,000 (₹1 Crore)
export const MAX_PROJECTION_MONTHS = 720; // 60 years cap to prevent infinite loops
export const MAX_ALLOWED_RETURN_PCT = 15.0; // Strict educational safety bound

export interface ProjectionScenarioResult {
  scenario_name: string;
  scenario_label: string;
  monthly_contribution: number;
  annual_stepup_pct: number;
  assumed_return_pct: number;
  months_to_target: number | null; // null if unreachable within 60 years
  years_to_target: number | null;
  target_date: string | null; // e.g. "October 2034"
  target_month_iso: string | null; // e.g. "2034-10"
  projected_corpus_at_target: number;
  total_contributions: number;
  estimated_growth: number;
  growth_percentage: number;
  is_already_achieved: boolean;
  key_action: string;
  assumptions_summary: string;
}

export interface MilestoneItem {
  milestone_label: string;
  target_amount: number;
  formatted_target: string;
  estimated_months: number | null;
  estimated_date: string | null;
  status: 'ACHIEVED' | 'PROJECTED' | 'UNREACHABLE';
  required_monthly_contribution: number;
  corpus_at_milestone: number;
}

export interface SensitivityMatrixCell {
  contribution_multiplier: number; // e.g. 0.8, 1.0, 1.2, 1.5
  contribution_amount: number;
  income_growth_pct: number;
  months_to_target: number | null;
  years_to_target: number | null;
  target_date: string | null;
  time_saved_months: number; // compared to base case
}

export interface ControllableLeverAnalysis {
  highest_impact_lever: string;
  impact_summary: string;
  recommended_change: string;
  months_saved: number;
  surplus_boost_option: {
    boost_amount: number;
    new_monthly_surplus: number;
    months_saved: number;
    years_saved: string;
  };
  stepup_sip_option: {
    annual_stepup_pct: number;
    months_saved: number;
    years_saved: string;
  };
  unnecessary_expense_reduction_option: {
    reduction_amount: number;
    months_saved: number;
    years_saved: string;
  };
}

export interface CroreCalculationResult {
  target_amount: number;
  starting_capital: number;
  current_monthly_contribution: number;
  assumed_return_pct: number;
  is_already_achieved: boolean;
  base_case: ProjectionScenarioResult;
  capital_only_case: ProjectionScenarioResult;
  improved_case: ProjectionScenarioResult;
  accelerated_case: ProjectionScenarioResult;
  shortest_modeled_path: ProjectionScenarioResult;
  milestones: MilestoneItem[];
  sensitivity_matrix: SensitivityMatrixCell[];
  lever_analysis: ControllableLeverAnalysis;
  one_next_action: string;
  disclaimer: string;
  methodology_notes: string[];
}

export interface SimulateCroreParams {
  startingCapital: number;
  currentMonthlyContribution: number;
  assumedAnnualReturnPct?: number;
  annualStepupPct?: number;
  currentMonthlyIncome?: number;
  currentMonthlyExpenses?: number;
  startDate?: Date;
}

/**
 * Deterministic month-by-month simulation of compounding wealth.
 */
export function simulateCompoundingPath(params: {
  startingCapital: number;
  monthlyContribution: number;
  annualReturnPct: number;
  annualStepupPct?: number;
  targetAmount?: number;
  startDate?: Date;
}): {
  months: number | null;
  targetDate: string | null;
  targetMonthIso: string | null;
  finalCorpus: number;
  totalContributed: number;
  estimatedGrowth: number;
} {
  const target = params.targetAmount ?? CRORE_TARGET;
  const initial = Math.max(round2(params.startingCapital), 0);
  const baseMonthlyContribution = Math.max(round2(params.monthlyContribution), 0);
  // Strictly clamp return between 0 and MAX_ALLOWED_RETURN_PCT (15%)
  const effectiveAnnualReturn = Math.max(Math.min(params.annualReturnPct, MAX_ALLOWED_RETURN_PCT), 0);
  const monthlyRate = (effectiveAnnualReturn / 100) / 12;
  const stepup = Math.max((params.annualStepupPct || 0) / 100, 0);
  const startDate = params.startDate || new Date();

  // Already achieved
  if (initial >= target) {
    const dStr = formatMonthYear(startDate);
    const isoStr = formatMonthIso(startDate);
    return {
      months: 0,
      targetDate: dStr,
      targetMonthIso: isoStr,
      finalCorpus: initial,
      totalContributed: 0,
      estimatedGrowth: 0,
    };
  }

  // If no initial capital, no contribution, and no return: cannot reach
  if (initial === 0 && baseMonthlyContribution === 0) {
    return {
      months: null,
      targetDate: null,
      targetMonthIso: null,
      finalCorpus: 0,
      totalContributed: 0,
      estimatedGrowth: 0,
    };
  }

  // If no contribution and return is 0: cannot reach if initial < target
  if (baseMonthlyContribution === 0 && effectiveAnnualReturn === 0) {
    return {
      months: null,
      targetDate: null,
      targetMonthIso: null,
      finalCorpus: initial,
      totalContributed: 0,
      estimatedGrowth: 0,
    };
  }

  let currentCorpus = initial;
  let totalContributed = 0;
  let currentMonthly = baseMonthlyContribution;
  let monthsElapsed = 0;

  while (currentCorpus < target && monthsElapsed < MAX_PROJECTION_MONTHS) {
    monthsElapsed++;

    // Compounding growth on existing balance
    currentCorpus = currentCorpus * (1 + monthlyRate);

    // Contribution added at month end
    currentCorpus += currentMonthly;
    totalContributed += currentMonthly;

    // Apply annual step-up after every 12 months
    if (stepup > 0 && monthsElapsed % 12 === 0) {
      currentMonthly = round2(currentMonthly * (1 + stepup));
    }
  }

  if (currentCorpus >= target) {
    const targetD = addMonthsToDate(startDate, monthsElapsed);
    const growth = round2(Math.max(currentCorpus - (initial + totalContributed), 0));
    return {
      months: monthsElapsed,
      targetDate: formatMonthYear(targetD),
      targetMonthIso: formatMonthIso(targetD),
      finalCorpus: round2(currentCorpus),
      totalContributed: round2(totalContributed),
      estimatedGrowth: growth,
    };
  }

  return {
    months: null,
    targetDate: null,
    targetMonthIso: null,
    finalCorpus: round2(currentCorpus),
    totalContributed: round2(totalContributed),
    estimatedGrowth: round2(Math.max(currentCorpus - (initial + totalContributed), 0)),
  };
}

/**
 * Calculates the required monthly contribution to reach a specific target in N months.
 */
export function calculateRequiredMonthlySIP(
  targetAmount: number,
  startingCapital: number,
  months: number,
  annualReturnPct: number
): number {
  if (months <= 0) return 0;
  const initial = Math.max(startingCapital, 0);
  if (initial >= targetAmount) return 0;

  const rate = Math.max(Math.min(annualReturnPct, MAX_ALLOWED_RETURN_PCT), 0) / 100;
  const monthlyRate = rate / 12;

  let fvInitial = initial;
  if (monthlyRate > 0) {
    fvInitial = initial * Math.pow(1 + monthlyRate, months);
  }

  const remainingGap = Math.max(targetAmount - fvInitial, 0);
  if (remainingGap <= 0) return 0;

  if (monthlyRate > 0) {
    const denominator = Math.pow(1 + monthlyRate, months) - 1;
    return round2(remainingGap * (monthlyRate / denominator));
  } else {
    return round2(remainingGap / months);
  }
}

/**
 * Full deterministic calculation for ₹1 Crore shortest path engine.
 */
export function calculateCroreShortestPath(params: SimulateCroreParams): CroreCalculationResult {
  const startingCapital = Math.max(round2(params.startingCapital), 0);
  const currentMonthlyContribution = Math.max(round2(params.currentMonthlyContribution), 0);
  const assumedReturn = Math.max(Math.min(params.assumedAnnualReturnPct ?? 12.0, MAX_ALLOWED_RETURN_PCT), 0);
  const startDate = params.startDate || new Date();
  const isAlreadyAchieved = startingCapital >= CRORE_TARGET;

  // 1. Scenario A: Capital-only growth (no contributions)
  const capOnlySim = simulateCompoundingPath({
    startingCapital,
    monthlyContribution: 0,
    annualReturnPct: assumedReturn,
    startDate,
  });

  const capitalOnlyCase: ProjectionScenarioResult = {
    scenario_name: 'CAPITAL_ONLY',
    scenario_label: 'Current Capital Only (Zero Contribution)',
    monthly_contribution: 0,
    annual_stepup_pct: 0,
    assumed_return_pct: assumedReturn,
    months_to_target: capOnlySim.months,
    years_to_target: capOnlySim.months !== null ? round2(capOnlySim.months / 12) : null,
    target_date: capOnlySim.targetDate,
    target_month_iso: capOnlySim.targetMonthIso,
    projected_corpus_at_target: capOnlySim.finalCorpus,
    total_contributions: 0,
    estimated_growth: capOnlySim.estimatedGrowth,
    growth_percentage: capOnlySim.finalCorpus > 0 ? round2((capOnlySim.estimatedGrowth / capOnlySim.finalCorpus) * 100) : 0,
    is_already_achieved: isAlreadyAchieved,
    key_action: 'Leave existing capital invested without further deposits',
    assumptions_summary: `${assumedReturn}% p.a. compounded monthly, ₹0 monthly contribution`,
  };

  // 2. Scenario B: Base Case (Current monthly contribution continues)
  const baseSim = simulateCompoundingPath({
    startingCapital,
    monthlyContribution: currentMonthlyContribution,
    annualReturnPct: assumedReturn,
    startDate,
  });

  const baseCase: ProjectionScenarioResult = {
    scenario_name: 'BASE_CASE',
    scenario_label: 'Base Case (Current Contribution)',
    monthly_contribution: currentMonthlyContribution,
    annual_stepup_pct: 0,
    assumed_return_pct: assumedReturn,
    months_to_target: baseSim.months,
    years_to_target: baseSim.months !== null ? round2(baseSim.months / 12) : null,
    target_date: baseSim.targetDate,
    target_month_iso: baseSim.targetMonthIso,
    projected_corpus_at_target: baseSim.finalCorpus,
    total_contributions: baseSim.totalContributed,
    estimated_growth: baseSim.estimatedGrowth,
    growth_percentage: baseSim.finalCorpus > 0 ? round2((baseSim.estimatedGrowth / baseSim.finalCorpus) * 100) : 0,
    is_already_achieved: isAlreadyAchieved,
    key_action: 'Maintain current investment pace consistently each month',
    assumptions_summary: `₹${currentMonthlyContribution.toLocaleString('en-IN')}/mo at ${assumedReturn}% p.a. compounded monthly`,
  };

  // 3. Scenario C: Improved Case (Optimized Surplus, e.g. +30% contribution)
  const improvedMonthly = currentMonthlyContribution > 0
    ? round2(currentMonthlyContribution * 1.30)
    : round2(Math.max((params.currentMonthlyIncome || 50000) * 0.20, 10000));

  const improvedSim = simulateCompoundingPath({
    startingCapital,
    monthlyContribution: improvedMonthly,
    annualReturnPct: assumedReturn,
    startDate,
  });

  const improvedCase: ProjectionScenarioResult = {
    scenario_name: 'IMPROVED_CASE',
    scenario_label: 'Improved Case (Optimized Surplus)',
    monthly_contribution: improvedMonthly,
    annual_stepup_pct: 0,
    assumed_return_pct: assumedReturn,
    months_to_target: improvedSim.months,
    years_to_target: improvedSim.months !== null ? round2(improvedSim.months / 12) : null,
    target_date: improvedSim.targetDate,
    target_month_iso: improvedSim.targetMonthIso,
    projected_corpus_at_target: improvedSim.finalCorpus,
    total_contributions: improvedSim.totalContributed,
    estimated_growth: improvedSim.estimatedGrowth,
    growth_percentage: improvedSim.finalCorpus > 0 ? round2((improvedSim.estimatedGrowth / improvedSim.finalCorpus) * 100) : 0,
    is_already_achieved: isAlreadyAchieved,
    key_action: `Increase monthly investment by ₹${(improvedMonthly - currentMonthlyContribution).toLocaleString('en-IN')} by curbing discretionary leakage`,
    assumptions_summary: `₹${improvedMonthly.toLocaleString('en-IN')}/mo (+30% boost) at ${assumedReturn}% p.a.`,
  };

  // 4. Scenario D: Accelerated Case (10% Annual Step-up SIP)
  const acceleratedSim = simulateCompoundingPath({
    startingCapital,
    monthlyContribution: currentMonthlyContribution > 0 ? currentMonthlyContribution : improvedMonthly,
    annualReturnPct: assumedReturn,
    annualStepupPct: 10.0,
    startDate,
  });

  const acceleratedCase: ProjectionScenarioResult = {
    scenario_name: 'ACCELERATED_CASE',
    scenario_label: 'Accelerated Case (10% Annual Step-Up)',
    monthly_contribution: currentMonthlyContribution > 0 ? currentMonthlyContribution : improvedMonthly,
    annual_stepup_pct: 10.0,
    assumed_return_pct: assumedReturn,
    months_to_target: acceleratedSim.months,
    years_to_target: acceleratedSim.months !== null ? round2(acceleratedSim.months / 12) : null,
    target_date: acceleratedSim.targetDate,
    target_month_iso: acceleratedSim.targetMonthIso,
    projected_corpus_at_target: acceleratedSim.finalCorpus,
    total_contributions: acceleratedSim.totalContributed,
    estimated_growth: acceleratedSim.estimatedGrowth,
    growth_percentage: acceleratedSim.finalCorpus > 0 ? round2((acceleratedSim.estimatedGrowth / acceleratedSim.finalCorpus) * 100) : 0,
    is_already_achieved: isAlreadyAchieved,
    key_action: 'Increase your monthly investment by 10% each year as income grows',
    assumptions_summary: `Starting at ₹${(currentMonthlyContribution > 0 ? currentMonthlyContribution : improvedMonthly).toLocaleString('en-IN')}/mo with 10% annual step-up at ${assumedReturn}% p.a.`,
  };

  // 5. Scenario E: Combined Shortest Modeled Path (Optimized Surplus + 10% Annual Step-up)
  const shortestSim = simulateCompoundingPath({
    startingCapital,
    monthlyContribution: improvedMonthly,
    annualReturnPct: assumedReturn,
    annualStepupPct: 10.0,
    startDate,
  });

  const shortestModeledPath: ProjectionScenarioResult = {
    scenario_name: 'COMBINED_SHORTEST_PATH',
    scenario_label: 'Fastest Modeled Path (Optimized Surplus + Step-Up)',
    monthly_contribution: improvedMonthly,
    annual_stepup_pct: 10.0,
    assumed_return_pct: assumedReturn,
    months_to_target: shortestSim.months,
    years_to_target: shortestSim.months !== null ? round2(shortestSim.months / 12) : null,
    target_date: shortestSim.targetDate,
    target_month_iso: shortestSim.targetMonthIso,
    projected_corpus_at_target: shortestSim.finalCorpus,
    total_contributions: shortestSim.totalContributed,
    estimated_growth: shortestSim.estimatedGrowth,
    growth_percentage: shortestSim.finalCorpus > 0 ? round2((shortestSim.estimatedGrowth / shortestSim.finalCorpus) * 100) : 0,
    is_already_achieved: isAlreadyAchieved,
    key_action: 'Optimize current surplus and commit to a 10% annual step-up SIP',
    assumptions_summary: `₹${improvedMonthly.toLocaleString('en-IN')}/mo initial + 10% annual step-up at ${assumedReturn}% p.a.`,
  };

  // -------------------------------------------------------------
  // 6. Milestone Engine (₹1L, ₹5L, ₹10L, ₹25L, ₹50L, ₹75L, ₹1Cr)
  // -------------------------------------------------------------
  const milestoneTargets = [
    { label: '₹1L', amount: 100000, formatted: '₹1,00,000' },
    { label: '₹5L', amount: 500000, formatted: '₹5,00,000' },
    { label: '₹10L', amount: 1000000, formatted: '₹10,00,000' },
    { label: '₹25L', amount: 2500000, formatted: '₹25,00,000' },
    { label: '₹50L', amount: 5000000, formatted: '₹50,00,000' },
    { label: '₹75L', amount: 7500000, formatted: '₹75,00,000' },
    { label: '₹1Cr', amount: 10000000, formatted: '₹1,00,00,000' },
  ];

  const milestones: MilestoneItem[] = milestoneTargets.map((m) => {
    if (startingCapital >= m.amount) {
      return {
        milestone_label: m.label,
        target_amount: m.amount,
        formatted_target: m.formatted,
        estimated_months: 0,
        estimated_date: 'Achieved',
        status: 'ACHIEVED',
        required_monthly_contribution: 0,
        corpus_at_milestone: startingCapital,
      };
    }

    const sim = simulateCompoundingPath({
      startingCapital,
      monthlyContribution: currentMonthlyContribution > 0 ? currentMonthlyContribution : improvedMonthly,
      annualReturnPct: assumedReturn,
      targetAmount: m.amount,
      startDate,
    });

    const status = sim.months !== null ? 'PROJECTED' : 'UNREACHABLE';
    const reqSip = sim.months !== null
      ? calculateRequiredMonthlySIP(m.amount, startingCapital, sim.months, assumedReturn)
      : calculateRequiredMonthlySIP(m.amount, startingCapital, 60, assumedReturn);

    return {
      milestone_label: m.label,
      target_amount: m.amount,
      formatted_target: m.formatted,
      estimated_months: sim.months,
      estimated_date: sim.targetDate,
      status,
      required_monthly_contribution: reqSip,
      corpus_at_milestone: sim.finalCorpus,
    };
  });

  // -------------------------------------------------------------
  // 7. Sensitivity Matrix (-20%, current, +20%, +50%)
  // -------------------------------------------------------------
  const contributionMultipliers = [0.8, 1.0, 1.2, 1.5];
  const incomeGrowthVariations = [0, 5, 10];
  const sensitivity_matrix: SensitivityMatrixCell[] = [];

  const baseMonths = baseCase.months_to_target ?? MAX_PROJECTION_MONTHS;

  for (const mult of contributionMultipliers) {
    const cAmount = round2(currentMonthlyContribution * mult);
    for (const gIncome of incomeGrowthVariations) {
      const sim = simulateCompoundingPath({
        startingCapital,
        monthlyContribution: cAmount,
        annualReturnPct: assumedReturn,
        annualStepupPct: gIncome,
        startDate,
      });

      const m = sim.months;
      const timeSaved = m !== null && baseMonths !== null ? Math.max(baseMonths - m, 0) : 0;

      sensitivity_matrix.push({
        contribution_multiplier: mult,
        contribution_amount: cAmount,
        income_growth_pct: gIncome,
        months_to_target: m,
        years_to_target: m !== null ? round2(m / 12) : null,
        target_date: sim.targetDate,
        time_saved_months: timeSaved,
      });
    }
  }

  // -------------------------------------------------------------
  // 8. Controllable Lever Analysis
  // -------------------------------------------------------------
  const surplusBoostDelta = Math.max(round2(currentMonthlyContribution * 0.35), 5000);
  const surplusBoostSim = simulateCompoundingPath({
    startingCapital,
    monthlyContribution: currentMonthlyContribution + surplusBoostDelta,
    annualReturnPct: assumedReturn,
    startDate,
  });
  const surplusMonthsSaved = baseSim.months && surplusBoostSim.months ? Math.max(baseSim.months - surplusBoostSim.months, 0) : 0;

  const stepupSim = simulateCompoundingPath({
    startingCapital,
    monthlyContribution: currentMonthlyContribution,
    annualReturnPct: assumedReturn,
    annualStepupPct: 10.0,
    startDate,
  });
  const stepupMonthsSaved = baseSim.months && stepupSim.months ? Math.max(baseSim.months - stepupSim.months, 0) : 0;

  const expenseCutDelta = Math.max(round2((params.currentMonthlyExpenses || 30000) * 0.15), 5000);
  const expenseCutSim = simulateCompoundingPath({
    startingCapital,
    monthlyContribution: currentMonthlyContribution + expenseCutDelta,
    annualReturnPct: assumedReturn,
    startDate,
  });
  const expenseCutMonthsSaved = baseSim.months && expenseCutSim.months ? Math.max(baseSim.months - expenseCutSim.months, 0) : 0;

  let highestImpact = 'INCREASING_MONTHLY_SURPLUS';
  let monthsSavedMax = surplusMonthsSaved;
  let recommendedChange = `Increase monthly surplus by ₹${surplusBoostDelta.toLocaleString('en-IN')} towards long-term wealth`;

  if (stepupMonthsSaved > monthsSavedMax) {
    highestImpact = 'ANNUAL_STEP_UP_SIP';
    monthsSavedMax = stepupMonthsSaved;
    recommendedChange = 'Adopt an annual 10% step-up SIP to harness compounding with income increments';
  }

  const formatYearsMonths = (m: number) => {
    const y = Math.floor(m / 12);
    const remM = m % 12;
    if (y > 0 && remM > 0) return `${y}y ${remM}m`;
    if (y > 0) return `${y} year${y > 1 ? 's' : ''}`;
    return `${remM} month${remM > 1 ? 's' : ''}`;
  };

  const lever_analysis: ControllableLeverAnalysis = {
    highest_impact_lever: highestImpact,
    impact_summary: monthsSavedMax > 0
      ? `Your highest-impact controllable lever is ${recommendedChange.toLowerCase()}, saving approximately ${formatYearsMonths(monthsSavedMax)}.`
      : 'Maintain consistent monthly investing while preserving your emergency safety reserve.',
    recommended_change: recommendedChange,
    months_saved: monthsSavedMax,
    surplus_boost_option: {
      boost_amount: surplusBoostDelta,
      new_monthly_surplus: currentMonthlyContribution + surplusBoostDelta,
      months_saved: surplusMonthsSaved,
      years_saved: formatYearsMonths(surplusMonthsSaved),
    },
    stepup_sip_option: {
      annual_stepup_pct: 10.0,
      months_saved: stepupMonthsSaved,
      years_saved: formatYearsMonths(stepupMonthsSaved),
    },
    unnecessary_expense_reduction_option: {
      reduction_amount: expenseCutDelta,
      months_saved: expenseCutMonthsSaved,
      years_saved: formatYearsMonths(expenseCutMonthsSaved),
    },
  };

  // ONE NEXT ACTION (Phase 14)
  let oneNextAction = 'Start investing your monthly surplus consistently each month.';
  if (isAlreadyAchieved) {
    oneNextAction = 'Your portfolio has already crossed ₹1 Crore. Focus on capital preservation and tax-efficient asset allocation.';
  } else if (currentMonthlyContribution <= 0) {
    oneNextAction = 'Allocate at least ₹5,000 from your monthly cashflow into long-term wealth compounding.';
  } else if (surplusMonthsSaved >= 12) {
    oneNextAction = `Increase your monthly surplus allocation by ₹${surplusBoostDelta.toLocaleString('en-IN')} to reach ₹1 Cr ${formatYearsMonths(surplusMonthsSaved)} earlier.`;
  } else if (stepupMonthsSaved > 0) {
    oneNextAction = 'Set an annual calendar reminder to step up your monthly SIP by 10% upon your next annual appraisal.';
  }

  return {
    target_amount: CRORE_TARGET,
    starting_capital: startingCapital,
    current_monthly_contribution: currentMonthlyContribution,
    assumed_return_pct: assumedReturn,
    is_already_achieved: isAlreadyAchieved,
    base_case: baseCase,
    capital_only_case: capitalOnlyCase,
    improved_case: improvedCase,
    accelerated_case: acceleratedCase,
    shortest_modeled_path: shortestModeledPath,
    milestones,
    sensitivity_matrix,
    lever_analysis,
    one_next_action: oneNextAction,
    disclaimer: 'DISCLAIMER: This is an educational mathematical projection based on explicit compounding assumptions. Returns are not guaranteed. Actual investment performance fluctuates with market volatility. This is not regulated personal investment advice.',
    methodology_notes: [
      'Target = ₹1,00,00,000 (One Crore Indian Rupees).',
      `Assumed annual compounding rate: ${assumedReturn}% p.a. (monthly compounding factor (1 + r/12)).`,
      'Step-up contributions applied at the conclusion of each 12-month cycle.',
      'Emergency fund capital is excluded from investable wealth to maintain liquid safety.',
      'Inflation, taxes, and transaction fees are not subtracted from the nominal corpus target.',
    ],
  };
}

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function formatMonthIso(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function addMonthsToDate(baseDate: Date, months: number): Date {
  const d = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}
