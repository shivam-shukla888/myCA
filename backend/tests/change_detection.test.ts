import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectDeterministicChanges, ChangeDetectionInput } from '../src/modules/finance/changeDetection.engine.js';
import { CanonicalFinancialState } from '../src/modules/finance/canonicalFinance.service.js';
import { CroreCalculation } from '../src/modules/crore/crore.schema.js';

function createMockState(overrides: Partial<CanonicalFinancialState> = {}): CanonicalFinancialState {
  return {
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
      annual_income_growth_pct: 7.0,
      formatted_income: '₹1,00,000',
    },
    expenses: {
      monthly_essential_expenses: 40000,
      monthly_debt_obligations: 10000,
      essential_monthly_expenses: 40000,
      debt_payments: 10000,
      discretionary_monthly_expenses: 10000,
      total_monthly_expenses: 50000,
      annual_expense_growth_pct: 6.0,
      formatted_expenses: '₹50,000',
      top_categories: [
        { category: 'Housing', amount: 25000, percentage: 50 },
        { category: 'Groceries', amount: 15000, percentage: 30 },
        { category: 'Dining Out', amount: 10000, percentage: 20 },
      ],
    },
    cashflow: {
      monthly_surplus: 50000,
      actual_monthly_surplus: 50000,
      savings_rate: 50.0,
      is_deficit: false,
      deficit_amount: 0,
      formatted_surplus: '₹50,000',
      formatted_savings_rate: '50%',
    },
    capital_and_savings: {
      liquid_savings: 150000,
      existing_investments: 500000,
      emergency_fund_target: 240000,
      emergency_fund_gap: 90000,
      emergency_coverage_months: 3.75,
      is_emergency_complete: false,
      current_investable_capital: 650000,
      monthly_investment_capacity: 35000,
    },
    planning_profile: {
      current_age: 30,
      target_retirement_age: 60,
      desired_monthly_lifestyle_income: 60000,
      dependents: 0,
      has_health_insurance: true,
      has_life_insurance: true,
    },
    goals: [
      {
        id: 'g1',
        title: 'Emergency Cushion',
        target_amount: 240000,
        current_amount: 150000,
        target_date: '2027-03',
        priority: 'high',
      },
    ],
    assumptions: {
      expected_return_pct: 12.0,
      inflation_rate_pct: 6.0,
      withdrawal_rate_pct: 4.0,
    },
    missing_fields: [],
    ...overrides,
  };
}

function createMockCrore(months: number, targetDate = '2036-05'): CroreCalculation {
  return {
    starting_capital: 500000,
    current_monthly_contribution: 35000,
    base_case: {
      target_date: targetDate,
      months_to_target: months,
      assumed_return_pct: 12,
      monthly_contribution: 35000,
    },
    improved_case: {
      target_date: targetDate,
      months_to_target: Math.max(1, months - 12),
      assumed_return_pct: 12,
      monthly_contribution: 40000,
    },
    accelerated_case: {
      target_date: targetDate,
      months_to_target: Math.max(1, months - 24),
      assumed_return_pct: 12,
      monthly_contribution: 45000,
    },
    shortest_modeled_path: {
      target_date: targetDate,
      months_to_target: Math.max(1, months - 24),
      assumed_return_pct: 12,
      monthly_contribution: 45000,
    },
    capital_only_case: {
      target_date: null,
      months_to_target: null,
      assumed_return_pct: 12,
      monthly_contribution: 0,
    },
    milestones: [],
    sensitivity_matrix: [],
    lever_analysis: {
      highest_impact_lever: 'SURPLUS_BOOST',
      recommended_change: 'Increase surplus',
    },
    one_next_action: 'Increase SIP contribution',
  };
}

describe('MYCA P1 Deterministic Change Detection Engine Tests', () => {
  console.log('=== RUNNING DETERMINISTIC CHANGE DETECTION SUITE ===\n');

  it('1. Detects all 9 potential change types and ranks strictly to TOP 3 maximum', () => {
    const prevState = createMockState({
      month: '2026-08',
      income: {
        monthly_net_income: 90000,
        other_recurring_income: 0,
        annual_income_growth_pct: 7.0,
        formatted_income: '₹90,000',
      },
      expenses: {
        monthly_essential_expenses: 45000,
        monthly_debt_obligations: 15000,
        essential_monthly_expenses: 45000,
        debt_payments: 15000,
        discretionary_monthly_expenses: 12000,
        total_monthly_expenses: 60000,
        annual_expense_growth_pct: 6.0,
        formatted_expenses: '₹60,000',
        top_categories: [
          { category: 'Housing', amount: 25000, percentage: 41.7 },
          { category: 'Groceries', amount: 15000, percentage: 25 },
          { category: 'Dining Out', amount: 20000, percentage: 33.3 }, // Dining Out was 20k, now 10k (-10k)
        ],
      },
      cashflow: {
        monthly_surplus: 30000,
        actual_monthly_surplus: 30000,
        savings_rate: 33.3,
        is_deficit: false,
        deficit_amount: 0,
        formatted_surplus: '₹30,000',
        formatted_savings_rate: '33.3%',
      },
      capital_and_savings: {
        liquid_savings: 120000, // now 150000 (+30k)
        existing_investments: 480000,
        emergency_fund_target: 240000,
        emergency_fund_gap: 120000,
        emergency_coverage_months: 2.67,
        is_emergency_complete: false,
        current_investable_capital: 600000,
        monthly_investment_capacity: 25000, // now 35000 (+10k)
      },
      goals: [
        {
          id: 'g1',
          title: 'Emergency Cushion',
          target_amount: 240000,
          current_amount: 120000, // now 150000 (+30k)
          target_date: '2027-03',
          priority: 'high',
        },
      ],
    });

    const currState = createMockState({
      month: '2026-09',
      // income: 100k vs 90k (+10k)
      // expenses: 50k vs 60k (-10k)
      // surplus: 50k vs 30k (+20k)
      // savings_rate: 50% vs 33.3% (+16.7% pts)
      // largest_category_movement: Dining Out from 20k to 10k (-10k)
      // emergency_fund_progress: 150k vs 120k (+30k)
      // investment_contribution: 35k vs 25k (+10k)
      // goal_progress: 150k vs 120k (+30k)
    });

    // ₹1Cr timeline change: 114 months vs 120 months (6 months faster!)
    const prevCrore = createMockCrore(120, '2036-08');
    const currCrore = createMockCrore(114, '2036-02');

    const result = detectDeterministicChanges({
      currentMonth: currState,
      previousMonth: prevState,
      currentCrore: currCrore,
      previousCrore: prevCrore,
    });

    assert.equal(result.has_sufficient_history, true);
    assert.equal(result.status, 'ANALYSIS_COMPLETE');
    assert.ok(result.total_changes_detected >= 7, 'Detects multiple change dimensions');
    assert.equal(result.top_changes.length, 3, 'MUST strictly cap output to TOP 3 changes maximum');

    console.log(`[PASS] Detected ${result.total_changes_detected} total changes; capped to top ${result.top_changes.length}`);

    // Verify ranks are 1, 2, 3
    assert.equal(result.top_changes[0].rank, 1);
    assert.equal(result.top_changes[1].rank, 2);
    assert.equal(result.top_changes[2].rank, 3);

    // Verify descending materiality
    assert.ok(result.top_changes[0].materiality_score >= result.top_changes[1].materiality_score);
    assert.ok(result.top_changes[1].materiality_score >= result.top_changes[2].materiality_score);

    console.log('[PASS] Materiality ranking ordering verified');
  });

  it('2. Every detected change includes complete source data attribution', () => {
    const prevState = createMockState({
      month: '2026-08',
      income: { monthly_net_income: 90000, other_recurring_income: 0, annual_income_growth_pct: 7.0, formatted_income: '₹90,000' },
    });
    const currState = createMockState({
      month: '2026-09',
      income: { monthly_net_income: 110000, other_recurring_income: 0, annual_income_growth_pct: 7.0, formatted_income: '₹1,10,000' },
    });

    const result = detectDeterministicChanges({
      currentMonth: currState,
      previousMonth: prevState,
    });

    for (const change of result.top_changes) {
      assert.ok(change.source_data, 'Every change must include source_data');
      assert.ok(change.source_data.data_source, 'Source data must specify data_source');
      assert.equal(change.source_data.current_period, '2026-09');
      assert.equal(change.source_data.previous_period, '2026-08');
      assert.ok(change.source_data.formula_or_derivation.length > 5, 'Must provide mathematical derivation');
      assert.ok(change.source_data.underlying_fields.length > 0, 'Must provide underlying fields');
      assert.equal(change.source_data.confidence, 1.0, 'Deterministic confidence is 1.0');
    }

    console.log('[PASS] Source data attribution verified for all changes');
  });

  it('3. Returns explicit INSUFFICIENT_HISTORY state when previous period is unavailable', () => {
    const currState = createMockState({ month: '2026-09' });

    const result = detectDeterministicChanges({
      currentMonth: currState,
      previousMonth: null,
    });

    assert.equal(result.has_sufficient_history, false);
    assert.equal(result.status, 'INSUFFICIENT_HISTORY');
    assert.equal(result.top_changes.length, 0);
    assert.ok(result.insufficient_history_reason?.includes('Insufficient historical records'));

    console.log('[PASS] Explicit INSUFFICIENT_HISTORY state returned on null previous period');
  });

  it('4. Returns explicit INSUFFICIENT_HISTORY state when previous period has no verified data', () => {
    const currState = createMockState({ month: '2026-09' });
    const emptyPrevState = createMockState({
      month: '2026-08',
      data_status: {
        has_observed_transactions: false,
        has_financial_profile: false,
        has_goals: false,
        income_source: 'missing',
        expense_source: 'missing',
        is_fully_configured: false,
      },
      income: { monthly_net_income: null, other_recurring_income: 0, annual_income_growth_pct: 0, formatted_income: '—' },
      expenses: {
        monthly_essential_expenses: null,
        monthly_debt_obligations: null,
        essential_monthly_expenses: null,
        debt_payments: 0,
        discretionary_monthly_expenses: 0,
        total_monthly_expenses: null,
        annual_expense_growth_pct: 0,
        formatted_expenses: '—',
        top_categories: [],
      },
    });

    const result = detectDeterministicChanges({
      currentMonth: currState,
      previousMonth: emptyPrevState,
    });

    assert.equal(result.has_sufficient_history, false);
    assert.equal(result.status, 'INSUFFICIENT_HISTORY');
    assert.equal(result.top_changes.length, 0);

    console.log('[PASS] Empty previous period cleanly triggers INSUFFICIENT_HISTORY');
  });

  it('5. Detects deficit flip with CRITICAL materiality weighting', () => {
    const prevState = createMockState({
      month: '2026-08',
      cashflow: {
        monthly_surplus: -10000,
        actual_monthly_surplus: -10000,
        savings_rate: -10.0,
        is_deficit: true,
        deficit_amount: 10000,
        formatted_surplus: '-₹10,000',
        formatted_savings_rate: '-10%',
      },
    });
    const currState = createMockState({
      month: '2026-09',
      cashflow: {
        monthly_surplus: 20000,
        actual_monthly_surplus: 20000,
        savings_rate: 20.0,
        is_deficit: false,
        deficit_amount: 0,
        formatted_surplus: '₹20,000',
        formatted_savings_rate: '20%',
      },
    });

    const result = detectDeterministicChanges({
      currentMonth: currState,
      previousMonth: prevState,
    });

    const surplusChange = result.top_changes.find((c) => c.change_type === 'surplus_change');
    assert.ok(surplusChange, 'Surplus change must be detected in top changes');
    assert.equal(surplusChange.materiality_level, 'CRITICAL', 'Deficit flip must be marked CRITICAL');
    assert.ok(surplusChange.headline.includes('positive cashflow'));

    console.log('[PASS] Deficit-to-positive flip detected with CRITICAL materiality');
  });

  it('6. Detects emergency fund full completion milestone with bonus materiality', () => {
    const prevState = createMockState({
      month: '2026-08',
      capital_and_savings: {
        liquid_savings: 220000,
        existing_investments: 500000,
        emergency_fund_target: 240000,
        emergency_fund_gap: 20000,
        emergency_coverage_months: 5.5,
        is_emergency_complete: false,
        current_investable_capital: 720000,
        monthly_investment_capacity: 35000,
      },
    });
    const currState = createMockState({
      month: '2026-09',
      capital_and_savings: {
        liquid_savings: 240000,
        existing_investments: 500000,
        emergency_fund_target: 240000,
        emergency_fund_gap: 0,
        emergency_coverage_months: 6.0,
        is_emergency_complete: true,
        current_investable_capital: 740000,
        monthly_investment_capacity: 35000,
      },
    });

    const result = detectDeterministicChanges({
      currentMonth: currState,
      previousMonth: prevState,
    });

    const emergencyChange = result.top_changes.find((c) => c.change_type === 'emergency_fund_progress');
    assert.ok(emergencyChange, 'Emergency fund progress must be detected');
    assert.ok(emergencyChange.headline.includes('fully funded'));
    assert.equal(emergencyChange.materiality_level, 'CRITICAL');

    console.log('[PASS] Emergency fund completion detected with milestone headline');
  });

  it('7. Detects ₹1 Crore timeline acceleration', () => {
    const prevState = createMockState({ month: '2026-08' });
    const currState = createMockState({ month: '2026-09' });
    const prevCrore = createMockCrore(130, '2037-03');
    const currCrore = createMockCrore(122, '2036-07'); // 8 months earlier!

    const result = detectDeterministicChanges({
      currentMonth: currState,
      previousMonth: prevState,
      currentCrore: currCrore,
      previousCrore: prevCrore,
    });

    const croreChange = result.top_changes.find((c) => c.change_type === 'crore_timeline_change');
    assert.ok(croreChange, '₹1Cr timeline change must be in top changes');
    assert.equal(croreChange.direction, 'POSITIVE');
    assert.equal(croreChange.delta, -8);
    assert.ok(croreChange.formatted_delta.includes('8 months faster'));

    console.log('[PASS] ₹1 Crore timeline acceleration detected and formatted');
  });

  it('8. Returns NO_MATERIAL_CHANGES when data between periods is identical', () => {
    const prevState = createMockState({ month: '2026-08' });
    const currState = createMockState({ month: '2026-09' }); // exactly same values

    const result = detectDeterministicChanges({
      currentMonth: currState,
      previousMonth: prevState,
    });

    assert.equal(result.has_sufficient_history, true);
    assert.equal(result.status, 'NO_MATERIAL_CHANGES');
    assert.equal(result.top_changes.length, 0);

    console.log('[PASS] NO_MATERIAL_CHANGES returned when metrics are identical');
  });
});
