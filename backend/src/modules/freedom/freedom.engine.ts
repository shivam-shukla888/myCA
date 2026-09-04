import {
  SCENARIO_PRESETS,
  FreedomScenarioResult,
  FreedomAnalysisResponse,
} from './freedom.schema.js';

export const round2 = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

/**
 * Calculates future monthly expense adjusted for inflation:
 * Future = Current * (1 + r_inflation)^years
 */
export function calculateFutureExpense(currentExpense: number, inflationRatePct: number, years: number): number {
  const r = Math.max(inflationRatePct, 0) / 100;
  return round2(currentExpense * Math.pow(1 + r, Math.max(years, 0)));
}

/**
 * Calculates indicative target corpus:
 * Target Corpus = (Future Monthly * 12) / withdrawal_rate
 */
export function calculateTargetCorpus(futureMonthlyExpense: number, withdrawalRatePct: number): number {
  const rate = Math.max(withdrawalRatePct, 0.01) / 100;
  return round2((futureMonthlyExpense * 12) / rate);
}

/**
 * Calculates projected wealth at target age with monthly compounding
 */
export function calculateFutureWealth(
  initialWealth: number,
  monthlyContribution: number,
  annualReturnPct: number,
  years: number
): {
  projectedWealth: number;
  futureValueOfInvestableWealth: number;
  futureValueOfContributions: number;
} {
  const months = Math.max(years, 0) * 12;
  const annualRate = Math.max(annualReturnPct, 0) / 100;
  const monthlyRate = annualRate / 12;

  let futureValueOfInvestableWealth = 0;
  let futureValueOfContributions = 0;

  if (monthlyRate > 0) {
    const factor = Math.pow(1 + monthlyRate, months);
    futureValueOfInvestableWealth = round2(initialWealth * factor);
    futureValueOfContributions = round2(monthlyContribution * ((factor - 1) / monthlyRate));
  } else {
    futureValueOfInvestableWealth = round2(initialWealth);
    futureValueOfContributions = round2(monthlyContribution * months);
  }

  return {
    projectedWealth: round2(futureValueOfInvestableWealth + futureValueOfContributions),
    futureValueOfInvestableWealth,
    futureValueOfContributions,
  };
}

/**
 * Solves for required monthly contribution to reach target corpus:
 * C_req = (Target - FV_initial) * [ i / ((1+i)^n - 1) ]
 */
export function calculateRequiredMonthlyContribution(
  targetCorpus: number,
  initialWealth: number,
  annualReturnPct: number,
  years: number
): number {
  const months = Math.max(years, 0) * 12;
  const annualRate = Math.max(annualReturnPct, 0) / 100;
  const monthlyRate = annualRate / 12;

  let fvInitial = 0;
  if (monthlyRate > 0) {
    fvInitial = initialWealth * Math.pow(1 + monthlyRate, months);
  } else {
    fvInitial = initialWealth;
  }

  const remainingGap = Math.max(targetCorpus - fvInitial, 0);
  if (remainingGap <= 0) {
    return 0;
  }

  if (months <= 0) {
    return round2(remainingGap);
  }

  if (monthlyRate > 0) {
    return round2(remainingGap * (monthlyRate / (Math.pow(1 + monthlyRate, months) - 1)));
  } else {
    return round2(remainingGap / months);
  }
}

export interface CalculateScenarioParams {
  scenarioName: 'conservative' | 'base' | 'optimistic';
  currentAge: number;
  targetAge: number;
  desiredMonthlyLifestyleIncome: number;
  currentMonthlyContribution: number;
  initialInvestableWealth: number;
  expectedReturnPct: number;
  inflationRatePct: number;
  withdrawalRatePct: number;
}

/**
 * Calculates a single deterministic planning scenario
 */
export function calculateScenario(params: CalculateScenarioParams): FreedomScenarioResult {
  const {
    scenarioName,
    currentAge,
    targetAge,
    desiredMonthlyLifestyleIncome,
    currentMonthlyContribution,
    initialInvestableWealth,
    expectedReturnPct,
    inflationRatePct,
    withdrawalRatePct,
  } = params;

  const years = Math.max(targetAge - currentAge, 0);

  // 1. Inflation adjustment
  const futureMonthlyLifestyleNeed = calculateFutureExpense(desiredMonthlyLifestyleIncome, inflationRatePct, years);
  const futureAnnualLifestyleNeed = round2(futureMonthlyLifestyleNeed * 12);

  // 2. Indicative target corpus
  const indicativeTargetCorpus = calculateTargetCorpus(futureMonthlyLifestyleNeed, withdrawalRatePct);

  // 3. Projected wealth at target age (monthly compounding)
  const wealthGrowth = calculateFutureWealth(
    initialInvestableWealth,
    currentMonthlyContribution,
    expectedReturnPct,
    years
  );
  const projectedWealthAtTargetAge = wealthGrowth.projectedWealth;

  // 4. Funding gap / surplus
  const fundingGap = round2(Math.max(indicativeTargetCorpus - projectedWealthAtTargetAge, 0));
  const fundingSurplus = round2(Math.max(projectedWealthAtTargetAge - indicativeTargetCorpus, 0));

  // 5. Required monthly contribution
  const requiredMonthlyContribution = calculateRequiredMonthlyContribution(
    indicativeTargetCorpus,
    initialInvestableWealth,
    expectedReturnPct,
    years
  );

  // 6. Status determination
  let status: 'Ahead of Target' | 'On Track' | 'Behind Target' = 'Behind Target';
  if (requiredMonthlyContribution === 0 || currentMonthlyContribution >= requiredMonthlyContribution * 1.05) {
    status = 'Ahead of Target';
  } else if (currentMonthlyContribution >= requiredMonthlyContribution * 0.95) {
    status = 'On Track';
  } else {
    status = 'Behind Target';
  }

  // 7. Deterministic explanation
  let explanation = '';
  if (status === 'Ahead of Target') {
    explanation = `Under ${scenarioName} assumptions, your current savings capacity (₹${currentMonthlyContribution.toLocaleString('en-IN')}/mo) exceeds the required contribution of ₹${requiredMonthlyContribution.toLocaleString('en-IN')}/mo, projecting a surplus of ₹${fundingSurplus.toLocaleString('en-IN')} by age ${targetAge}.`;
  } else if (status === 'On Track') {
    explanation = `Under ${scenarioName} assumptions, your current savings capacity (₹${currentMonthlyContribution.toLocaleString('en-IN')}/mo) is on track to fund your indicative corpus of ₹${indicativeTargetCorpus.toLocaleString('en-IN')} by age ${targetAge}.`;
  } else {
    explanation = `Under ${scenarioName} assumptions, an estimated funding gap of ₹${fundingGap.toLocaleString('en-IN')} remains by age ${targetAge}. A monthly contribution of ₹${requiredMonthlyContribution.toLocaleString('en-IN')} (additional ₹${round2(Math.max(requiredMonthlyContribution - currentMonthlyContribution, 0)).toLocaleString('en-IN')}/mo) is indicated to close this gap.`;
  }

  return {
    scenario_name: scenarioName,
    expected_return_pct: expectedReturnPct,
    inflation_rate_pct: inflationRatePct,
    withdrawal_rate_pct: withdrawalRatePct,
    future_monthly_lifestyle_need: futureMonthlyLifestyleNeed,
    future_annual_lifestyle_need: futureAnnualLifestyleNeed,
    indicative_target_corpus: indicativeTargetCorpus,
    initial_investable_wealth: initialInvestableWealth,
    projected_wealth_at_target_age: projectedWealthAtTargetAge,
    funding_gap: fundingGap,
    funding_surplus: fundingSurplus,
    required_monthly_contribution: requiredMonthlyContribution,
    current_monthly_contribution: currentMonthlyContribution,
    status,
    explanation,
  };
}

export interface RunFreedomAnalysisParams {
  currentAge: number;
  targetAge: number;
  desiredMonthlyLifestyleIncome: number;
  monthlyContribution: number;
  existingLiquidSavings: number;
  existingInvestments: number;
  emergencyFundTarget: number;
  activeScenarioName?: 'conservative' | 'base' | 'optimistic';
  customReturnPct?: number;
  customInflationPct?: number;
  customWithdrawalPct?: number;
}

/**
 * Runs multi-scenario deterministic financial freedom analysis
 */
export function runFreedomAnalysis(params: RunFreedomAnalysisParams): FreedomAnalysisResponse {
  const {
    currentAge,
    targetAge,
    desiredMonthlyLifestyleIncome,
    monthlyContribution,
    existingLiquidSavings,
    existingInvestments,
    emergencyFundTarget,
    activeScenarioName = 'base',
    customReturnPct,
    customInflationPct,
    customWithdrawalPct,
  } = params;

  // Emergency Fund Isolation: protect emergency target from being double-counted into freedom corpus
  const emergencyReserve = round2(Math.min(existingLiquidSavings, emergencyFundTarget));
  const excessLiquidSavings = round2(Math.max(existingLiquidSavings - emergencyFundTarget, 0));
  const initialInvestableWealth = round2(existingInvestments + excessLiquidSavings);

  const years = Math.max(targetAge - currentAge, 0);
  const months = years * 12;

  // Compute Conservative Scenario
  const conservativeResult = calculateScenario({
    scenarioName: 'conservative',
    currentAge,
    targetAge,
    desiredMonthlyLifestyleIncome,
    currentMonthlyContribution: monthlyContribution,
    initialInvestableWealth,
    expectedReturnPct: SCENARIO_PRESETS.conservative.expected_return,
    inflationRatePct: SCENARIO_PRESETS.conservative.inflation_rate,
    withdrawalRatePct: SCENARIO_PRESETS.conservative.withdrawal_rate,
  });

  // Compute Base Scenario
  const baseResult = calculateScenario({
    scenarioName: 'base',
    currentAge,
    targetAge,
    desiredMonthlyLifestyleIncome,
    currentMonthlyContribution: monthlyContribution,
    initialInvestableWealth,
    expectedReturnPct: customReturnPct ?? SCENARIO_PRESETS.base.expected_return,
    inflationRatePct: customInflationPct ?? SCENARIO_PRESETS.base.inflation_rate,
    withdrawalRatePct: customWithdrawalPct ?? SCENARIO_PRESETS.base.withdrawal_rate,
  });

  // Compute Optimistic Scenario
  const optimisticResult = calculateScenario({
    scenarioName: 'optimistic',
    currentAge,
    targetAge,
    desiredMonthlyLifestyleIncome,
    currentMonthlyContribution: monthlyContribution,
    initialInvestableWealth,
    expectedReturnPct: SCENARIO_PRESETS.optimistic.expected_return,
    inflationRatePct: SCENARIO_PRESETS.optimistic.inflation_rate,
    withdrawalRatePct: SCENARIO_PRESETS.optimistic.withdrawal_rate,
  });

  const activeScenario = activeScenarioName === 'conservative'
    ? conservativeResult
    : activeScenarioName === 'optimistic'
      ? optimisticResult
      : baseResult;

  return {
    current_age: currentAge,
    target_age: targetAge,
    years_to_freedom: years,
    months_to_freedom: months,
    current_monthly_surplus: monthlyContribution,
    existing_liquid_savings: round2(existingLiquidSavings),
    existing_investments: round2(existingInvestments),
    emergency_fund_target: round2(emergencyFundTarget),
    emergency_fund_reserve: emergencyReserve,
    initial_investable_wealth: initialInvestableWealth,
    active_scenario_name: activeScenarioName,
    active_scenario: activeScenario,
    scenarios: {
      conservative: conservativeResult,
      base: baseResult,
      optimistic: optimisticResult,
    },
    formula_transparency: {
      future_expense_formula: 'FV = Current_Monthly_Need * (1 + r_inflation)^years',
      target_corpus_formula: 'Target_Corpus = (FV_Monthly * 12) / r_withdrawal',
      future_wealth_formula: 'Projected_Wealth = Initial_Wealth*(1+i)^n + Monthly_Contribution*(((1+i)^n - 1)/i)',
      required_contribution_formula: 'Req_Monthly = (Target_Corpus - Initial_Wealth*(1+i)^n) * (i / ((1+i)^n - 1))',
    },
    assumptions_disclaimer:
      'These are planning estimates based on user-calibrated economic assumptions, not market return guarantees. Actual future returns and inflation will vary.',
  };
}
