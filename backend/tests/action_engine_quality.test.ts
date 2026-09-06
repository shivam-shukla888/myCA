import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  buildFinancialActionPlan,
  determineHighestPriorityAction,
} from '../src/modules/action/action.engine.js';
import { ActionPlan, HighestPriorityAction } from '../src/modules/action/action.schema.js';

describe('MYCA P1 Action Engine Quality Tests', () => {
  // Common manipulative words that must NEVER appear in actions
  const MANIPULATIVE_PATTERNS = [
    /\bshame\b/i,
    /\bguilt\b/i,
    /\bfailure\b/i,
    /\blazy\b/i,
    /\bdisaster\b/i,
    /\bcatastrophe\b/i,
    /\bpanic\b/i,
    /\bact now or else\b/i,
    /\bdoom\b/i,
    /\byou must hurry\b/i,
    /\bterrible\b/i,
  ];

  function verifyActionStructure(action: HighestPriorityAction) {
    // 1. Must have valid title
    assert(action.title && action.title.trim().length > 5, 'Action must have a descriptive title');
    // 2. Must explain why it matters
    assert(action.why_it_matters && action.why_it_matters.trim().length > 15, 'Action must explain why it matters');
    // 3. Must have exact supporting numbers
    assert(action.exact_data_supporting_it, 'Action must have exact supporting data');
    assert(typeof action.exact_data_supporting_it.monthly_income === 'number', 'Supporting data must include income');
    assert(typeof action.exact_data_supporting_it.monthly_expenses === 'number', 'Supporting data must include expenses');
    assert(typeof action.exact_data_supporting_it.monthly_surplus === 'number', 'Supporting data must include surplus');
    // 4. Expected measurable effect must be concrete and calculable (must contain currency and numbers)
    assert(
      action.expected_measurable_effect && action.expected_measurable_effect.includes('₹'),
      'Expected measurable effect must include specific rupee calculations'
    );
    // 5. Must NOT be vague (e.g. reject "Save more", "Spend less")
    const vaguePhrases = ['save more', 'spend less', 'cut back', 'invest wisely'];
    const lowerEffect = action.expected_measurable_effect.toLowerCase();
    for (const vague of vaguePhrases) {
      assert(
        lowerEffect !== vague,
        `Action must avoid bare vague phrases like "${vague}"`
      );
    }
    // 6. CTA must be structured
    assert(action.cta && action.cta.label && action.cta.destination, 'Action must have structured CTA');
    // 7. Confidence & source must be structured
    assert(action.confidence_source && action.confidence_source.data_source, 'Action must have source/confidence');
    assert(action.confidence_source.confidence_score > 0, 'Confidence score must be positive');

    // 8. No manipulative language
    const combinedText = `${action.title} ${action.why_it_matters} ${action.expected_measurable_effect}`;
    for (const pattern of MANIPULATIVE_PATTERNS) {
      assert(!pattern.test(combinedText), `Action must not contain manipulative language matching ${pattern}`);
    }
  }

  it('Tier 1: Returns Deficit action (P0_DEFICIT) when expenses exceed income', () => {
    const plan = buildFinancialActionPlan({
      month: '2026-09',
      income: 50000,
      expenses: 65000,
      profile: {
        monthly_essential_expenses: 45000,
        monthly_debt_obligations: 5000,
        existing_liquid_savings: 30000,
      },
      largestExpenseCategory: {
        category: 'Dining',
        amount: 12000,
        percentage: 18.5,
      },
    });

    const action = plan.highest_priority_action;
    assert.strictEqual(action.priority_type, 'P0_DEFICIT');
    assert.strictEqual(action.priority_rank, 1);
    assert.strictEqual(action.title, 'Eliminate Monthly Cashflow Deficit');
    assert.strictEqual(action.exact_data_supporting_it.monthly_surplus, -15000);
    assert.strictEqual(action.exact_data_supporting_it.is_deficit, true);
    assert(action.expected_measurable_effect.includes('₹15,000'), 'Effect mentions exact ₹15,000 deficit');
    assert(action.expected_measurable_effect.includes('Dining'), 'Effect mentions largest expense category');
    assert.strictEqual(action.cta.destination, '/ledger');
    assert.strictEqual(action.confidence_source.data_source, 'OBSERVED_LEDGER');

    verifyActionStructure(action);
  });

  it('Tier 2: Returns Emergency Fund action (P1_EMERGENCY_GAP) with exact formulaic calculation', () => {
    // Exact prompt example: surplus ₹40,000, allocating ₹10,000/month closes ₹60,000 gap in ~6 months
    const plan = buildFinancialActionPlan({
      month: '2026-09',
      income: 100000,
      expenses: 60000,
      profile: {
        monthly_essential_expenses: 40000,
        emergency_fund_target_months: 6, // target = 240,000
        existing_liquid_savings: 180000, // gap = 60,000
        monthly_debt_obligations: 0,
      },
      overrides: {
        custom_emergency_allocation: 10000,
      },
    });

    const action = plan.highest_priority_action;
    assert.strictEqual(action.priority_type, 'P1_EMERGENCY_GAP');
    assert.strictEqual(action.priority_rank, 1);
    assert.strictEqual(action.title, 'Fund Emergency Safety Reserve');
    assert.strictEqual(action.exact_data_supporting_it.monthly_surplus, 40000);
    assert.strictEqual(action.exact_data_supporting_it.emergency_fund_gap, 60000);
    assert.strictEqual(action.exact_data_supporting_it.allocated_amount, 10000);

    // Exact expected format:
    // "Your current surplus is ₹40,000. Allocating ₹10,000/month to your emergency fund would close the ₹60,000 remaining gap in approximately 6 months."
    assert(
      action.expected_measurable_effect.includes('Your current surplus is ₹40,000'),
      'Effect specifies verified surplus'
    );
    assert(
      action.expected_measurable_effect.includes('Allocating ₹10,000/month to your emergency fund would close the ₹60,000 remaining gap in approximately 6 months'),
      `Effect matches exact calculable closing formula. Got: ${action.expected_measurable_effect}`
    );
    assert.strictEqual(action.cta.destination, '/plan');

    verifyActionStructure(action);
  });

  it('Tier 3: Returns Debt action (P2_HIGH_COST_OBLIGATIONS) when emergency fund is complete but debt exists', () => {
    const plan = buildFinancialActionPlan({
      month: '2026-09',
      income: 80000,
      expenses: 50000,
      profile: {
        monthly_essential_expenses: 30000,
        emergency_fund_target_months: 3,
        existing_liquid_savings: 150000, // Target = 90,000 => gap = 0 (100% funded)
        monthly_debt_obligations: 12000, // Verified active debt obligations
      },
    });

    const action = plan.highest_priority_action;
    assert.strictEqual(action.priority_type, 'P2_HIGH_COST_OBLIGATIONS');
    assert.strictEqual(action.priority_rank, 1);
    assert.strictEqual(action.title, 'Retire High-Cost Debt Obligations');
    assert.strictEqual(action.exact_data_supporting_it.monthly_debt_obligations, 12000);
    assert.strictEqual(action.exact_data_supporting_it.emergency_fund_gap, 0);
    assert(action.expected_measurable_effect.includes('₹12,000/month'), 'Mentions ₹12,000 debt');
    assert(action.expected_measurable_effect.includes('15.0% of net income'), 'Mentions DTI percentage');
    assert.strictEqual(action.cta.destination, '/plan');

    verifyActionStructure(action);
  });

  it('Tier 4: Returns Savings Buffer action (P3_INSUFFICIENT_BUFFER) when emergency and debt are clear but cashflow buffer is thin', () => {
    const plan = buildFinancialActionPlan({
      month: '2026-09',
      income: 50000,
      expenses: 48500, // Surplus = 1500 (3% savings rate < 10% threshold)
      profile: {
        monthly_essential_expenses: 25000,
        emergency_fund_target_months: 3,
        existing_liquid_savings: 100000, // Target = 75,000 => gap = 0
        monthly_debt_obligations: 0,
      },
    });

    const action = plan.highest_priority_action;
    assert.strictEqual(action.priority_type, 'P3_INSUFFICIENT_BUFFER');
    assert.strictEqual(action.priority_rank, 1);
    assert.strictEqual(action.title, 'Expand Monthly Savings Buffer');
    assert.strictEqual(action.exact_data_supporting_it.monthly_surplus, 1500);
    assert.strictEqual(action.exact_data_supporting_it.savings_rate_pct, 3);
    assert(action.expected_measurable_effect.includes('₹1,500 (3% savings rate)'), 'Effect states exact surplus and rate');
    assert(action.expected_measurable_effect.includes('expand your savings buffer to ₹7,500/month'), 'Effect states target buffer');
    assert.strictEqual(action.cta.destination, '/ledger');

    verifyActionStructure(action);
  });

  it('Tier 5: Returns Goal action (P4_GOAL_CONTRIBUTION) when buffer is healthy and active goals exist', () => {
    const plan = buildFinancialActionPlan({
      month: '2026-09',
      income: 100000,
      expenses: 60000, // Surplus = 40,000 (40% savings rate)
      profile: {
        monthly_essential_expenses: 30000,
        emergency_fund_target_months: 3,
        existing_liquid_savings: 120000, // Target = 90,000 => gap = 0
        monthly_debt_obligations: 0,
      },
      goals: [
        {
          id: 'goal-laptop-1',
          user_id: 'u1',
          title: 'Workstation Setup',
          target_amount: 60000,
          current_amount: 20000, // gap = 40,000
          target_date: '2027-01-01', // 4 months
          status: 'active',
          priority: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });

    const action = plan.highest_priority_action;
    assert.strictEqual(action.priority_type, 'P4_GOAL_CONTRIBUTION');
    assert.strictEqual(action.priority_rank, 1);
    assert.strictEqual(action.title, 'Fund Priority Goal: Workstation Setup');
    assert.strictEqual(action.exact_data_supporting_it.goal_title, 'Workstation Setup');
    assert.strictEqual(action.exact_data_supporting_it.goal_remaining_gap, 40000);
    // 40,000 gap / 4 months = 10,000/mo needed => funded in 4 months
    assert(action.expected_measurable_effect.includes('Workstation Setup'), 'Mentions goal title');
    assert(action.expected_measurable_effect.includes('₹40,000 remaining gap'), 'Mentions remaining gap');
    assert(action.expected_measurable_effect.includes('approximately 4 months'), 'Calculates months needed');
    assert.strictEqual(action.cta.destination, '/plan');

    verifyActionStructure(action);
  });

  it('Tier 6: Returns Wealth Acceleration action (P5_WEALTH_ACCELERATION) when emergency, debt, buffer, and goals are satisfied', () => {
    const plan = buildFinancialActionPlan({
      month: '2026-09',
      income: 120000,
      expenses: 70000, // Surplus = 50,000 (41.67% savings rate)
      profile: {
        monthly_essential_expenses: 40000,
        emergency_fund_target_months: 6,
        existing_liquid_savings: 300000, // Target = 240,000 => gap = 0
        monthly_debt_obligations: 0,
      },
      goals: [], // No goal gaps
      freedomStatus: {
        indicative_target_corpus: 10000000,
        projected_wealth: 2500000,
        required_monthly_contribution: 25000,
        current_wealth: 2500000,
        target_age: 50,
        selected_scenario: 'base',
        on_track: true,
      },
    });

    const action = plan.highest_priority_action;
    assert.strictEqual(action.priority_type, 'P5_WEALTH_ACCELERATION');
    assert.strictEqual(action.priority_rank, 1);
    assert.strictEqual(action.title, 'Accelerate ₹1 Crore Wealth Path');
    assert.strictEqual(action.exact_data_supporting_it.monthly_surplus, 50000);
    assert(action.expected_measurable_effect.includes('₹50,000'), 'Mentions surplus');
    assert(action.expected_measurable_effect.includes('accumulates ₹3,00,000 annually'), 'Calculates annual deployment');
    assert.strictEqual(action.cta.destination, '/crore');

    verifyActionStructure(action);
  });

  it('Strict Priority Ordering: Deficit overrides Emergency gap', () => {
    const plan = buildFinancialActionPlan({
      month: '2026-09',
      income: 40000,
      expenses: 55000, // Deficit of 15,000
      profile: {
        monthly_essential_expenses: 35000,
        emergency_fund_target_months: 6,
        existing_liquid_savings: 0, // Gap of 210,000
        monthly_debt_obligations: 5000,
      },
    });

    // Despite emergency gap of 210,000 and debt of 5,000, deficit is Priority 1
    assert.strictEqual(plan.highest_priority_action.priority_type, 'P0_DEFICIT');
  });

  it('Strict Priority Ordering: Emergency gap overrides Debt and Goals', () => {
    const plan = buildFinancialActionPlan({
      month: '2026-09',
      income: 80000,
      expenses: 50000, // Surplus = 30,000
      profile: {
        monthly_essential_expenses: 30000,
        emergency_fund_target_months: 6,
        existing_liquid_savings: 50000, // Target = 180,000 => Gap = 130,000
        monthly_debt_obligations: 8000, // Has debt
      },
      goals: [
        {
          id: 'g-1',
          user_id: 'u1',
          title: 'Car Purchase',
          target_amount: 300000,
          current_amount: 50000,
          target_date: '2027-06-01',
          status: 'active',
          priority: 'high',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });

    // Emergency gap takes precedence over debt and goals
    assert.strictEqual(plan.highest_priority_action.priority_type, 'P1_EMERGENCY_GAP');
  });

  it('Rejects vague actions and ensures non-manipulative phrasing across all variants', () => {
    // Generate multiple test states and assert clean tone
    const scenarios = [
      { inc: 30000, exp: 40000, emSaved: 0, debt: 0 },
      { inc: 60000, exp: 40000, emSaved: 50000, debt: 5000 },
      { inc: 70000, exp: 40000, emSaved: 200000, debt: 6000 },
      { inc: 50000, exp: 48000, emSaved: 200000, debt: 0 },
      { inc: 90000, exp: 50000, emSaved: 300000, debt: 0 },
    ];

    for (const sc of scenarios) {
      const plan = buildFinancialActionPlan({
        month: '2026-09',
        income: sc.inc,
        expenses: sc.exp,
        profile: {
          monthly_essential_expenses: 30000,
          emergency_fund_target_months: 6,
          existing_liquid_savings: sc.emSaved,
          monthly_debt_obligations: sc.debt,
        },
      });

      verifyActionStructure(plan.highest_priority_action);
    }
  });
});
