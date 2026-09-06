import { generateStructuredMonthlyReview } from '../src/modules/finance/monthlyReview.engine.js';
import { CanonicalFinancialState } from '../src/modules/finance/canonicalFinance.service.js';
import { CroreCalculationResult } from '../src/modules/crore/crore.engine.js';

async function runMonthlyReviewTests() {
  console.log('=== RUNNING RETENTION LOOP & MONTHLY FINANCIAL REVIEW DETERMINISTIC TESTS ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`, detail !== undefined ? JSON.stringify(detail, null, 2) : '');
      failed++;
    }
  }

  const mockBaseCanonicalState = (overrides: Partial<CanonicalFinancialState> = {}): CanonicalFinancialState => ({
    month: '2026-09',
    data_status: {
      has_observed_transactions: true,
      has_financial_profile: true,
      has_goals: true,
      income_source: 'observed_ledger',
      expense_source: 'observed_ledger',
      is_fully_configured: true,
    },
    income: {
      monthly_net_income: 100000,
      other_recurring_income: 0,
      annual_income_growth_pct: 10,
      formatted_income: '₹1,00,000',
    },
    expenses: {
      monthly_essential_expenses: 40000,
      monthly_debt_obligations: 10000,
      essential_monthly_expenses: 40000,
      debt_payments: 10000,
      discretionary_monthly_expenses: 10000,
      total_monthly_expenses: 50000,
      annual_expense_growth_pct: 6,
      formatted_expenses: '₹50,000',
      top_categories: [
        { category: 'Rent', amount: 25000, percentage: 50 },
        { category: 'Groceries', amount: 15000, percentage: 30 },
        { category: 'Dining', amount: 10000, percentage: 20 },
      ],
    },
    cashflow: {
      monthly_surplus: 50000,
      actual_monthly_surplus: 50000,
      savings_rate: 50.0,
      is_deficit: false,
      deficit_amount: 0,
      formatted_surplus: '₹50,000',
      formatted_savings_rate: '50.0%',
    },
    capital_and_savings: {
      liquid_savings: 150000,
      existing_investments: 500000,
      emergency_fund_target: 240000,
      emergency_fund_gap: 90000,
      emergency_coverage_months: 3.75,
      is_emergency_complete: false,
      current_investable_capital: 500000,
      monthly_investment_capacity: 50000,
    },
    planning_profile: {
      current_age: 30,
      target_retirement_age: 60,
      desired_monthly_lifestyle_income: 50000,
      dependents: 0,
      has_health_insurance: true,
      has_life_insurance: true,
    },
    goals: [],
    assumptions: {
      expected_return_pct: 12,
      inflation_rate_pct: 6,
      withdrawal_rate_pct: 4,
    },
    missing_fields: [],
    ...overrides,
  });

  const mockCroreResult = (monthsToTarget: number, targetDate: string): CroreCalculationResult => ({
    target_amount: 10000000,
    starting_capital: 500000,
    current_monthly_contribution: 50000,
    assumed_return_pct: 12,
    is_already_achieved: false,
    base_case: {
      scenario_name: 'BASE_CASE',
      scenario_label: 'Base Case',
      monthly_contribution: 50000,
      annual_stepup_pct: 0,
      assumed_return_pct: 12,
      months_to_target: monthsToTarget,
      years_to_target: Math.round((monthsToTarget / 12) * 10) / 10,
      target_date: targetDate,
      target_month_iso: '2036-05',
      projected_corpus_at_target: 10000000,
      total_contributions: 6000000,
      estimated_growth: 4000000,
      growth_percentage: 40,
      is_already_achieved: false,
      key_action: 'Keep investing',
      assumptions_summary: '12% p.a.',
    },
    capital_only_case: {} as any,
    improved_case: {} as any,
    accelerated_case: {} as any,
    shortest_modeled_path: {} as any,
    milestones: [],
    sensitivity_matrix: [],
    lever_analysis: {} as any,
    acceleration_levers: [],
    largest_impact_variable: 'Monthly investment volume',
    one_next_action: 'Keep investing',
    disclaimer: 'Disclaimer',
    methodology_notes: [],
  });

  // -----------------------------------------------------------------------------------------------
  // TEST SCENARIO 1: FULL MONTH-OVER-MONTH COMPARISON AVAILABLE
  // -----------------------------------------------------------------------------------------------
  const currentMonthState = mockBaseCanonicalState({
    month: '2026-09',
    income: { monthly_net_income: 110000, other_recurring_income: 0, annual_income_growth_pct: 10, formatted_income: '₹1,10,000' },
    expenses: {
      monthly_essential_expenses: 42000,
      monthly_debt_obligations: 8000, // debt reduced from 10k to 8k
      essential_monthly_expenses: 42000,
      debt_payments: 8000,
      discretionary_monthly_expenses: 12000,
      total_monthly_expenses: 50000,
      annual_expense_growth_pct: 6,
      formatted_expenses: '₹50,000',
      top_categories: [
        { category: 'Rent', amount: 25000, percentage: 50 },
        { category: 'Groceries', amount: 17000, percentage: 34 },
        { category: 'Dining', amount: 8000, percentage: 16 },
      ],
    },
    cashflow: {
      monthly_surplus: 60000, // increased from 50k to 60k
      actual_monthly_surplus: 60000,
      savings_rate: 54.5, // increased from 50%
      is_deficit: false,
      deficit_amount: 0,
      formatted_surplus: '₹60,000',
      formatted_savings_rate: '54.5%',
    },
    capital_and_savings: {
      liquid_savings: 180000, // increased by 30k
      existing_investments: 550000,
      emergency_fund_target: 240000,
      emergency_fund_gap: 60000, // gap narrowed
      emergency_coverage_months: 4.28,
      is_emergency_complete: false,
      current_investable_capital: 550000,
      monthly_investment_capacity: 60000,
    },
  });

  const previousMonthState = mockBaseCanonicalState({
    month: '2026-08',
  });

  const currCrore = mockCroreResult(114, 'March 2036'); // accelerated from 120 months
  const prevCrore = mockCroreResult(120, 'September 2036');

  const review1 = generateStructuredMonthlyReview({
    currentMonth: currentMonthState,
    previousMonth: previousMonthState,
    currentCrore: currCrore,
    previousCrore: prevCrore,
    historicalStates: [previousMonthState],
  });

  // Question 1: What changed?
  assert(review1.has_prior_month_data === true, 'TEST 1A: has_prior_month_data is true');
  assert(review1.what_changed.income.delta === 10000, 'TEST 1B: Income delta is +₹10,000', review1.what_changed.income.delta);
  assert(review1.what_changed.surplus.delta === 10000, 'TEST 1C: Surplus delta is +₹10,000', review1.what_changed.surplus.delta);
  assert(review1.what_changed.savings_rate.delta === 4.5, 'TEST 1D: Savings rate improved by +4.5% points', review1.what_changed.savings_rate.delta);
  assert(review1.what_changed.summary.includes('increased by ₹10,000'), 'TEST 1E: Summary mentions income increase', review1.what_changed.summary);

  // Question 2: Why did it change?
  assert(review1.why_it_changed.top_category_drivers.length > 0, 'TEST 2A: Category drivers populated', review1.why_it_changed.top_category_drivers.length);
  assert(review1.why_it_changed.summary.length > 10, 'TEST 2B: Why it changed provides explanation', review1.why_it_changed.summary);

  // Question 3: What improved?
  assert(review1.what_improved.items.length >= 3, 'TEST 3A: Multiple improvements detected (surplus, savings rate, debt reduction)', review1.what_improved.items);
  assert(review1.what_improved.summary.includes('surplus expanded'), 'TEST 3B: What improved summary details surplus expansion', review1.what_improved.summary);

  // Question 4: What got worse?
  assert(review1.what_got_worse.items.length === 0, 'TEST 4A: Zero items worsened in scenario 1', review1.what_got_worse.items);
  assert(review1.what_got_worse.summary.includes('No financial indicators degraded'), 'TEST 4B: What got worse summary is constructive and non-shaming', review1.what_got_worse.summary);

  // Question 5: What is my current surplus?
  assert(review1.current_surplus.amount === 60000, 'TEST 5A: Current surplus is exactly ₹60,000', review1.current_surplus.amount);
  assert(review1.current_surplus.is_deficit === false, 'TEST 5B: is_deficit is false', review1.current_surplus.is_deficit);
  assert(review1.current_surplus.formula_breakdown.includes('1,10,000 Net Income'), 'TEST 5C: Canonical formula breakdown displayed', review1.current_surplus.formula_breakdown);

  // Question 6: How is my savings rate changing?
  assert(review1.savings_rate_trend.current_rate === 54.5, 'TEST 6A: Current savings rate is 54.5%');
  assert(review1.savings_rate_trend.delta_percentage_points === 4.5, 'TEST 6B: Delta is +4.5% points');
  assert(review1.savings_rate_trend.trend_description.includes('improved by +4.5%'), 'TEST 6C: Trend description is clear and affirmative');

  // Question 7: How is my emergency fund progressing?
  assert(review1.emergency_fund_progress.current_amount === 180000, 'TEST 7A: Emergency reserve current amount is ₹1,80,000');
  assert(review1.emergency_fund_progress.progress_pct === 75, 'TEST 7B: Emergency progress is 75% (180k/240k)');
  assert(review1.emergency_fund_progress.status === 'IN_PROGRESS', 'TEST 7C: Emergency status is IN_PROGRESS');
  assert(review1.emergency_fund_progress.month_over_month_change?.includes('+₹30,000'), 'TEST 7D: MoM change reflects +₹30,000 addition');

  // Question 8: Did my ₹1Cr path accelerate or slow down?
  assert(review1.crore_path_trajectory.status === 'ACCELERATED', 'TEST 8A: Crore path trajectory status is ACCELERATED');
  assert(review1.crore_path_trajectory.months_delta === -6, 'TEST 8B: Months delta is -6 (6 months earlier)', review1.crore_path_trajectory.months_delta);
  assert(review1.crore_path_trajectory.summary.includes('accelerated by 6 months'), 'TEST 8C: Summary mentions 6 months acceleration', review1.crore_path_trajectory.summary);

  // Question 9: What ONE action matters next?
  assert(review1.one_action_matters_next.priority_area === 'EMERGENCY_RESERVE', 'TEST 9A: Priority area is emergency reserve when gap > 0');
  assert(review1.one_action_matters_next.action.includes('emergency fund gap'), 'TEST 9B: Action targets emergency gap closure', review1.one_action_matters_next.action);

  // Milestones Verification
  const mSurplus = review1.milestones.find((m) => m.id === 'first_positive_surplus')!;
  const mSavings = review1.milestones.find((m) => m.id === 'savings_rate_improvement')!;
  const mAccel = review1.milestones.find((m) => m.id === 'target_acceleration')!;
  const mDebt = review1.milestones.find((m) => m.id === 'debt_reduction')!;
  const mCashflow = review1.milestones.find((m) => m.id === 'consistent_positive_cashflow')!;

  assert(mSurplus.status === 'ACHIEVED', 'TEST 10A: first_positive_surplus is ACHIEVED');
  assert(mSavings.status === 'ACHIEVED', 'TEST 10B: savings_rate_improvement is ACHIEVED');
  assert(mAccel.status === 'ACHIEVED', 'TEST 10C: target_acceleration is ACHIEVED');
  assert(mDebt.status === 'ACHIEVED', 'TEST 10D: debt_reduction is ACHIEVED');
  assert(mCashflow.status === 'IN_PROGRESS', 'TEST 10E: consistent_positive_cashflow is IN_PROGRESS (2 of 3 months)');

  // Anti-Dark Pattern Compliance
  assert(review1.anti_dark_pattern_compliance.no_streak_anxiety === true, 'TEST 11A: no_streak_anxiety is guaranteed');
  assert(review1.anti_dark_pattern_compliance.no_shaming === true, 'TEST 11B: no_shaming is guaranteed');
  assert(review1.anti_dark_pattern_compliance.no_fear === true, 'TEST 11C: no_fear is guaranteed');
  assert(review1.anti_dark_pattern_compliance.no_fomo === true, 'TEST 11D: no_fomo is guaranteed');
  assert(review1.anti_dark_pattern_compliance.no_fake_urgency === true, 'TEST 11E: no_fake_urgency is guaranteed');
  assert(review1.anti_dark_pattern_compliance.no_excessive_notifications === true, 'TEST 11F: no_excessive_notifications is guaranteed');

  // -----------------------------------------------------------------------------------------------
  // TEST SCENARIO 2: PRIOR MONTH DATA UNAVAILABLE (NO INVENTED COMPARISONS)
  // -----------------------------------------------------------------------------------------------
  const review2 = generateStructuredMonthlyReview({
    currentMonth: currentMonthState,
    previousMonth: null, // First month user
    currentCrore: currCrore,
    previousCrore: null,
  });

  assert(review2.has_prior_month_data === false, 'TEST 12A: has_prior_month_data is false when previousMonth is null');
  assert(review2.prior_month_note !== undefined, 'TEST 12B: prior_month_note is populated explicitly');
  assert(review2.what_changed.summary.includes('Prior month data is unavailable'), 'TEST 12C: what_changed explicitly states prior month is unavailable');
  assert(review2.what_changed.income.direction === 'BASELINE', 'TEST 12D: Income direction is BASELINE');
  assert(review2.why_it_changed.summary.includes('Prior month category data is unavailable'), 'TEST 12E: Category variance does not invent fake drivers');
  assert(review2.crore_path_trajectory.status === 'BASELINE_ESTABLISHED', 'TEST 12F: Crore trajectory status is BASELINE_ESTABLISHED');

  // -----------------------------------------------------------------------------------------------
  // TEST SCENARIO 3: CASHFLOW DEFICIT & SLOWED DOWN CRORE PATH
  // -----------------------------------------------------------------------------------------------
  const deficitState = mockBaseCanonicalState({
    month: '2026-09',
    income: { monthly_net_income: 60000, other_recurring_income: 0, annual_income_growth_pct: 0, formatted_income: '₹60,000' },
    expenses: {
      monthly_essential_expenses: 50000,
      monthly_debt_obligations: 20000,
      essential_monthly_expenses: 50000,
      debt_payments: 20000,
      discretionary_monthly_expenses: 10000,
      total_monthly_expenses: 70000, // ₹70k total expenses vs ₹60k income = -₹10k deficit
      annual_expense_growth_pct: 0,
      formatted_expenses: '₹70,000',
      top_categories: [],
    },
    cashflow: {
      monthly_surplus: -10000,
      actual_monthly_surplus: -10000,
      savings_rate: 0,
      is_deficit: true,
      deficit_amount: 10000,
      formatted_surplus: '-₹10,000',
      formatted_savings_rate: '0.0%',
    },
  });

  const slowedCrore = mockCroreResult(140, 'November 2037'); // slowed from 120 months
  const priorCrore = mockCroreResult(120, 'September 2036');

  const review3 = generateStructuredMonthlyReview({
    currentMonth: deficitState,
    previousMonth: previousMonthState,
    currentCrore: slowedCrore,
    previousCrore: priorCrore,
  });

  assert(review3.current_surplus.is_deficit === true, 'TEST 13A: is_deficit is true');
  assert(review3.current_surplus.status_label === 'CASHFLOW DEFICIT', 'TEST 13B: status_label is CASHFLOW DEFICIT');
  assert(review3.crore_path_trajectory.status === 'SLOWED_DOWN', 'TEST 13C: Crore trajectory is SLOWED_DOWN');
  assert(review3.crore_path_trajectory.months_delta === 20, 'TEST 13D: Months delta is +20 months');
  assert(review3.one_action_matters_next.priority_area === 'EXPENSE_DISCIPLINE', 'TEST 13E: Priority area is EXPENSE_DISCIPLINE on deficit');
  assert(!review3.what_got_worse.summary.includes('guilty'), 'TEST 13F: Deficit summary contains zero shame/guilt');

  // -----------------------------------------------------------------------------------------------
  // TEST SCENARIO 4: EMERGENCY FUND FULLY FUNDED
  // -----------------------------------------------------------------------------------------------
  const fullyFundedEmergencyState = mockBaseCanonicalState({
    capital_and_savings: {
      liquid_savings: 300000,
      existing_investments: 500000,
      emergency_fund_target: 240000,
      emergency_fund_gap: 0,
      emergency_coverage_months: 6.5,
      is_emergency_complete: true,
      current_investable_capital: 500000,
      monthly_investment_capacity: 50000,
    },
    expenses: {
      monthly_essential_expenses: 40000,
      monthly_debt_obligations: 0, // No debt
      essential_monthly_expenses: 40000,
      debt_payments: 0,
      discretionary_monthly_expenses: 10000,
      total_monthly_expenses: 40000,
      annual_expense_growth_pct: 0,
      formatted_expenses: '₹40,000',
      top_categories: [],
    },
  });

  const review4 = generateStructuredMonthlyReview({
    currentMonth: fullyFundedEmergencyState,
    previousMonth: previousMonthState,
    currentCrore: currCrore,
    previousCrore: prevCrore,
  });

  assert(review4.emergency_fund_progress.status === 'FULLY_FUNDED', 'TEST 14A: Emergency status is FULLY_FUNDED');
  assert(review4.emergency_fund_progress.progress_pct === 100, 'TEST 14B: Emergency progress is 100%');
  assert(review4.one_action_matters_next.priority_area === 'COMPOUNDING_SIP', 'TEST 14C: Priority area shifts to COMPOUNDING_SIP when emergency & debt clear');

  const mEmergency = review4.milestones.find((m) => m.id === 'emergency_fund_fully_funded')!;
  assert(mEmergency.status === 'ACHIEVED', 'TEST 14D: emergency_fund_fully_funded milestone is ACHIEVED');

  console.log(`\n========================================`);
  console.log(`MONTHLY REVIEW TESTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runMonthlyReviewTests();
