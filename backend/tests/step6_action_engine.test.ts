import request from 'supertest';
import { createApp } from '../src/app.js';
import { testUserRoles } from '../src/middleware/auth.js';
import {
  buildFinancialActionPlan,
  rankGoals,
  calculateMonthsRemaining,
} from '../src/modules/action/action.engine.js';
import { actionService } from '../src/modules/action/action.service.js';
import { allocationService } from '../src/modules/allocation/allocation.service.js';
import { transactionService } from '../src/modules/transactions/transaction.service.js';
import { FinancialGoal } from '../src/modules/allocation/allocation.schema.js';

const app = createApp();

const USER_ALICE = 'a1111111-1111-1111-1111-111111111111';
const USER_BOB = 'b2222222-2222-2222-2222-222222222222';

testUserRoles.set(USER_ALICE, 'USER');
testUserRoles.set(USER_BOB, 'USER');

const tokenAlice = `mock-test-token:${USER_ALICE}:alice@example.com`;
const tokenBob = `mock-test-token:${USER_BOB}:bob@example.com`;

async function runStep6ActionEngineTests() {
  console.log('=== RUNNING STEP 6: FINANCIAL ACTION ENGINE TEST SUITE ===\n');

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

  try {
    // ======================================================================
    // 1. POSITIVE SURPLUS & INVARIANT GUARANTEE
    // ======================================================================
    const planPositive = buildFinancialActionPlan({
      month: '2026-09',
      income: 70000,
      expenses: 45000,
      profile: {
        monthly_essential_expenses: 30000,
        emergency_fund_target_months: 6,
        existing_liquid_savings: 120000, // Target = 180,000, gap = 60,000
      },
      goals: [],
      freedomStatus: {
        indicative_target_corpus: 50000000,
        projected_wealth: 2000000,
        required_monthly_contribution: 10000,
        current_wealth: 2000000,
        target_age: 55,
        selected_scenario: 'base',
        on_track: false,
      },
    });

    assert(planPositive.monthly_surplus === 25000, 'TEST 1.1: Verified positive surplus is ₹25,000');
    assert(!planPositive.is_deficit, 'TEST 1.2: Positive surplus is not marked as deficit');
    assert(planPositive.invariant_verified, 'TEST 1.3: Invariant verified flag is true');
    assert(
      planPositive.allocations.total_allocated === 25000,
      `TEST 1.4: Exact allocation invariant holds: total (${planPositive.allocations.total_allocated}) === surplus (25000)`
    );

    // ======================================================================
    // 2. ZERO SURPLUS
    // ======================================================================
    const planZero = buildFinancialActionPlan({
      month: '2026-09',
      income: 50000,
      expenses: 50000,
      profile: { monthly_essential_expenses: 40000 },
    });

    assert(planZero.monthly_surplus === 0, 'TEST 2.1: Monthly surplus is ₹0');
    assert(!planZero.is_deficit, 'TEST 2.2: Zero surplus is not a deficit');
    assert(planZero.allocations.total_allocated === 0, 'TEST 2.3: Zero surplus yields 0 total allocated');
    assert(planZero.allocations.emergency_fund === 0, 'TEST 2.4: Zero surplus yields 0 emergency allocation');
    assert(planZero.allocations.long_term_wealth === 0, 'TEST 2.5: Zero surplus yields 0 wealth allocation');

    // ======================================================================
    // 3. DEFICIT MODE
    // ======================================================================
    const planDeficit = buildFinancialActionPlan({
      month: '2026-09',
      income: 40000,
      expenses: 60000,
      profile: {
        monthly_essential_expenses: 35000,
        monthly_debt_obligations: 5000,
      },
      largestExpenseCategory: { category: 'Rent', amount: 30000, percentage: 50 },
    });

    assert(planDeficit.is_deficit === true, 'TEST 3.1: Income < Expenses flagged as deficit');
    assert(planDeficit.monthly_surplus === -20000, 'TEST 3.2: Deficit is exactly -₹20,000');
    assert(planDeficit.allocations.total_allocated === 0, 'TEST 3.3: In deficit, zero money allocated to investments/goals');
    assert(Boolean(planDeficit.deficit_analysis), 'TEST 3.4: Deficit analysis populated');
    assert(planDeficit.deficit_analysis?.monthly_deficit === 20000, 'TEST 3.5: Deficit analysis reports ₹20,000 deficit');
    assert(
      planDeficit.deficit_analysis?.recommended_actions.length === 3,
      'TEST 3.6: Deficit analysis provides 3 actionable stabilization directives'
    );
    assert(
      planDeficit.actions[0].priority === 'P0_DEFICIT',
      'TEST 3.7: Priority 0 (Deficit Stabilization) is the primary action'
    );

    // ======================================================================
    // 4. EMERGENCY GAP ALLOCATION
    // ======================================================================
    // Target = 30,000 * 6 = 180,000. Existing = 60,000. Gap = 120,000.
    const planEmergencyGap = buildFinancialActionPlan({
      month: '2026-09',
      income: 80000,
      expenses: 50000,
      profile: {
        monthly_essential_expenses: 30000,
        emergency_fund_target_months: 6,
        existing_liquid_savings: 60000,
      },
    });

    assert(planEmergencyGap.allocations.emergency_fund > 0, 'TEST 4.1: Emergency fund receives positive allocation when gap exists');
    const emergencyAction = planEmergencyGap.actions.find((a) => a.category === 'emergency_fund');
    assert(emergencyAction !== undefined, 'TEST 4.2: P1 Emergency Fund action item exists');
    assert(
      emergencyAction?.why_rationale.includes('Emergency fund is below your selected target'),
      'TEST 4.3: Deterministic explanation explains emergency gap'
    );

    // ======================================================================
    // 5. EMERGENCY COMPLETE
    // ======================================================================
    // Target = 30,000 * 6 = 180,000. Existing = 200,000. Gap = 0.
    const planEmergencyComplete = buildFinancialActionPlan({
      month: '2026-09',
      income: 80000,
      expenses: 50000,
      profile: {
        monthly_essential_expenses: 30000,
        emergency_fund_target_months: 6,
        existing_liquid_savings: 200000,
      },
    });

    assert(planEmergencyComplete.allocations.emergency_fund === 0, 'TEST 5.1: Fully funded emergency reserve receives ₹0 allocation');
    const completeAction = planEmergencyComplete.actions.find((a) => a.category === 'emergency_fund');
    assert(
      completeAction?.why_rationale.includes('already complete'),
      'TEST 5.2: Complete emergency fund explains zero allocation and surplus pass-through'
    );
    assert(planEmergencyComplete.allocations.long_term_wealth > 0, 'TEST 5.3: Surplus flows to wealth building when emergency is complete');

    // ======================================================================
    // 6. ONE GOAL FUNDING
    // ======================================================================
    const sampleGoal: FinancialGoal = {
      id: 'g1111111-1111-1111-1111-111111111111',
      user_id: USER_ALICE,
      title: 'Bike Down Payment',
      target_amount: 60000,
      current_amount: 10000, // remaining = 50,000
      target_date: '2027-03-01', // ~6 months from 2026-09 => ~8,333/mo
      goal_type: 'vehicle',
      priority: 'medium',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const planOneGoal = buildFinancialActionPlan({
      month: '2026-09',
      income: 90000,
      expenses: 50000, // surplus = 40,000
      profile: {
        monthly_essential_expenses: 30000,
        emergency_fund_target_months: 6,
        existing_liquid_savings: 200000, // complete EF
      },
      goals: [sampleGoal],
    });

    assert(planOneGoal.allocations.goals > 0, 'TEST 6.1: Active goal receives allocation from surplus');
    assert(planOneGoal.ranked_goals.length === 1, 'TEST 6.2: Ranked goals list contains the goal');
    assert(
      planOneGoal.ranked_goals[0].allocated_amount > 0,
      `TEST 6.3: Goal allocated amount is positive (got ₹${planOneGoal.ranked_goals[0].allocated_amount})`
    );

    // ======================================================================
    // 7. MULTIPLE GOALS
    // ======================================================================
    const goalA: FinancialGoal = {
      id: 'gaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      user_id: USER_ALICE,
      title: 'Vacation',
      target_amount: 50000,
      current_amount: 10000,
      target_date: '2027-01-01', // ~4 months
      goal_type: 'travel',
      priority: 'medium',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const goalB: FinancialGoal = {
      id: 'gbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      user_id: USER_ALICE,
      title: 'Home Renovation',
      target_amount: 300000,
      current_amount: 50000,
      target_date: '2028-09-01', // ~24 months
      goal_type: 'home',
      priority: 'medium',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const planMultiGoals = buildFinancialActionPlan({
      month: '2026-09',
      income: 100000,
      expenses: 60000, // surplus = 40,000
      profile: {
        monthly_essential_expenses: 30000,
        existing_liquid_savings: 250000,
      },
      goals: [goalA, goalB],
    });

    assert(planMultiGoals.ranked_goals.length === 2, 'TEST 7.1: Both goals are ranked');
    assert(planMultiGoals.allocations.goals > 0, 'TEST 7.2: Total goals allocation accounts for both goals');

    // ======================================================================
    // 8. GOAL DEADLINE RANKING (Shorter deadline ranked higher)
    // ======================================================================
    const ranked = rankGoals([goalB, goalA], '2026-09');
    assert(
      ranked[0].id === goalA.id,
      `TEST 8.1: Goal with nearer deadline (${ranked[0].title}) is ranked #1 before distant deadline (${ranked[1].title})`
    );
    assert(ranked[0].priority_rank === 1, 'TEST 8.2: First goal has priority_rank 1');
    assert(ranked[1].priority_rank === 2, 'TEST 8.3: Second goal has priority_rank 2');

    // ======================================================================
    // 9. GOAL PRIORITY OVERRIDE
    // ======================================================================
    // Even though goalB has a farther deadline, user marks goalB as prioritized
    const rankedWithOverride = rankGoals([goalA, goalB], '2026-09', {
      prioritized_goal_id: goalB.id,
    });
    assert(
      rankedWithOverride[0].id === goalB.id,
      `TEST 9.1: User-prioritized goal (${rankedWithOverride[0].title}) moves to rank #1 despite farther deadline`
    );
    assert(
      rankedWithOverride[0].ranking_rationale.includes('user preference'),
      'TEST 9.2: Rationale explicitly reflects user preference priority'
    );

    // ======================================================================
    // 10. FINANCIAL FREEDOM CONTRIBUTION GAP
    // ======================================================================
    const planFreedom = buildFinancialActionPlan({
      month: '2026-09',
      income: 70000,
      expenses: 50000, // surplus = 20,000
      profile: {
        monthly_essential_expenses: 30000,
        existing_liquid_savings: 200000,
      },
      freedomStatus: {
        indicative_target_corpus: 60000000,
        projected_wealth: 10000000,
        required_monthly_contribution: 35000, // gap = 35k - 20k = 15k
        current_wealth: 2000000,
        target_age: 55,
        selected_scenario: 'base',
        on_track: false,
      },
    });

    assert(
      planFreedom.financial_freedom.required_monthly_contribution === 35000,
      'TEST 10.1: Freedom required monthly contribution is ₹35,000'
    );
    assert(
      planFreedom.financial_freedom.contribution_gap === 15000,
      'TEST 10.2: Financial freedom contribution gap is ₹15,000 (35,000 required - 20,000 surplus)'
    );
    assert(
      planFreedom.financial_freedom.on_track === false,
      'TEST 10.3: Freedom on_track is false due to contribution gap'
    );

    // ======================================================================
    // 11. FULLY FUNDED HIGHER PRIORITY FLOW-THROUGH
    // ======================================================================
    // When emergency fund is complete and there are no goals, surplus moves to wealth
    const planFlowThrough = buildFinancialActionPlan({
      month: '2026-09',
      income: 100000,
      expenses: 60000, // surplus = 40,000
      profile: {
        monthly_essential_expenses: 30000,
        existing_liquid_savings: 300000, // complete
      },
      goals: [],
      freedomStatus: {
        indicative_target_corpus: 50000000,
        projected_wealth: 5000000,
        required_monthly_contribution: 30000,
        current_wealth: 5000000,
        target_age: 55,
        selected_scenario: 'base',
        on_track: false,
      },
    });

    assert(planFlowThrough.allocations.emergency_fund === 0, 'TEST 11.1: Emergency allocation is 0');
    assert(planFlowThrough.allocations.goals === 0, 'TEST 11.2: Goals allocation is 0');
    assert(
      planFlowThrough.allocations.long_term_wealth === 30000,
      `TEST 11.3: Long-term wealth receives required ₹30,000 allocation (got ${planFlowThrough.allocations.long_term_wealth})`
    );
    assert(
      planFlowThrough.allocations.flexible_buffer === 10000,
      `TEST 11.4: Remaining ₹10,000 absorbed by flexible buffer (got ${planFlowThrough.allocations.flexible_buffer})`
    );

    // ======================================================================
    // 12. BUFFER RECONCILIATION & EXACT INVARIANT
    // ======================================================================
    // Test various odd numbers to verify zero rounding drift
    const oddNumbers = [
      { inc: 73456.78, exp: 41234.56 },
      { inc: 100000.33, exp: 66666.67 },
      { inc: 55555.55, exp: 33333.33 },
    ];

    oddNumbers.forEach((odd, idx) => {
      const p = buildFinancialActionPlan({
        month: '2026-09',
        income: odd.inc,
        expenses: odd.exp,
        profile: { monthly_essential_expenses: 25000, existing_liquid_savings: 50000 },
      });
      const sum = p.allocations.emergency_fund + p.allocations.goals + p.allocations.long_term_wealth + p.allocations.flexible_buffer;
      const expectedSurplus = p.monthly_surplus;
      assert(
        Math.abs(sum - expectedSurplus) < 0.001,
        `TEST 12.${idx + 1}: Odd numbers buffer reconciliation exact: sum (${sum}) === surplus (${expectedSurplus})`
      );
    });

    // ======================================================================
    // 13. EXACT ALLOCATION INVARIANT ON ALL PLANS
    // ======================================================================
    assert(
      planPositive.allocations.total_allocated === planPositive.monthly_surplus,
      'TEST 13.1: Plan Positive sum(all allocations) === monthly surplus'
    );
    assert(
      planFlowThrough.allocations.total_allocated === planFlowThrough.monthly_surplus,
      'TEST 13.2: Plan Flow-Through sum(all allocations) === monthly surplus'
    );
    assert(
      planMultiGoals.allocations.total_allocated === planMultiGoals.monthly_surplus,
      'TEST 13.3: Plan Multi-Goals sum(all allocations) === monthly surplus'
    );

    // ======================================================================
    // 14. USER OVERRIDE & BASELINE RECOVERABILITY
    // ======================================================================
    // User wants custom emergency allocation of ₹5,000 and custom buffer of ₹3,000
    const planOverridden = buildFinancialActionPlan({
      month: '2026-09',
      income: 70000,
      expenses: 45000, // surplus = 25,000
      profile: { monthly_essential_expenses: 30000, existing_liquid_savings: 50000 },
      overrides: {
        custom_emergency_allocation: 5000,
        custom_buffer_amount: 3000,
      },
    });

    assert(planOverridden.user_override_applied === true, 'TEST 14.1: User override applied flag is true');
    assert(
      planOverridden.allocations.emergency_fund === 5000,
      `TEST 14.2: Emergency allocation matches override ₹5,000 (got ${planOverridden.allocations.emergency_fund})`
    );
    assert(
      planOverridden.allocations.total_allocated === 25000,
      'TEST 14.3: Overridden plan preserves exact surplus invariant'
    );

    // ======================================================================
    // 15. WHAT-IF SIMULATION WITHOUT MUTATION
    // ======================================================================
    // Set baseline profile via allocationService
    await allocationService.upsertProfile(USER_ALICE, {
      age: 30,
      monthly_income: 70000,
      monthly_essential_expenses: 30000,
      existing_liquid_savings: 100000,
      existing_investments: 500000,
      emergency_fund_target_months: 6,
    });

    // Record baseline transaction for 2026-09
    await transactionService.createTransaction(USER_ALICE, {
      amount: 70000,
      type: 'income',
      category: 'Salary',
      description: 'September Salary',
      date: '2026-09-01',
    });

    await transactionService.createTransaction(USER_ALICE, {
      amount: 45000,
      type: 'expense',
      category: 'Living',
      description: 'Living Expenses',
      date: '2026-09-05',
    });

    // Run what-if simulation: "What if I save ₹5,000 more?" (surplus_delta: +5000)
    const simulated = await actionService.simulateActionPlan(USER_ALICE, {
      month: '2026-09',
      surplus_delta: 5000,
    });

    assert(simulated.monthly_surplus === 30000, `TEST 15.1: Simulated surplus reflects +₹5,000 delta (got ₹${simulated.monthly_surplus})`);
    assert(simulated.allocations.total_allocated === 30000, 'TEST 15.2: Simulated plan maintains total allocated invariant');

    // Verify real record unmutated
    const actualPlan = await actionService.generateActionPlan(USER_ALICE, '2026-09');
    assert(actualPlan.monthly_surplus === 25000, 'TEST 15.3: Actual plan surplus remains unmutated at ₹25,000');

    // ======================================================================
    // 16. HISTORICAL PLAN IMMUTABILITY
    // ======================================================================
    // Confirm September 2026 plan
    const confirmedSept = await actionService.confirmActionPlan(USER_ALICE, '2026-09');
    assert(confirmedSept.confirmed_at !== undefined, 'TEST 16.1: September plan has confirmed_at timestamp');
    const septAllocated = confirmedSept.allocations.emergency_fund;

    // Mutate Alice's profile today (e.g. liquid savings increased to ₹1,000,000)
    await allocationService.upsertProfile(USER_ALICE, {
      age: 30,
      monthly_income: 150000,
      monthly_essential_expenses: 60000,
      existing_liquid_savings: 1000000, // huge savings
      existing_investments: 2000000,
      emergency_fund_target_months: 6,
    });

    // Fetch confirmed September plan again
    const fetchedSept = await actionService.getActionPlanForMonth(USER_ALICE, '2026-09');
    assert(
      fetchedSept.allocations.emergency_fund === septAllocated,
      `TEST 16.2: Historical confirmed September plan remained immutable despite profile change (got ${fetchedSept.allocations.emergency_fund})`
    );

    // ======================================================================
    // 17. CROSS-USER ISOLATION
    // ======================================================================
    // Set Bob profile and transactions
    await allocationService.upsertProfile(USER_BOB, {
      age: 28,
      monthly_income: 40000,
      monthly_essential_expenses: 25000,
      existing_liquid_savings: 10000,
      existing_investments: 0,
    });

    await transactionService.createTransaction(USER_BOB, {
      amount: 40000,
      type: 'income',
      category: 'Salary',
      description: 'Bob Salary',
      date: '2026-09-01',
    });

    await transactionService.createTransaction(USER_BOB, {
      amount: 25000,
      type: 'expense',
      category: 'Living',
      description: 'Bob Rent',
      date: '2026-09-05',
    });

    const bobPlan = await actionService.generateActionPlan(USER_BOB, '2026-09');
    assert(bobPlan.monthly_surplus === 15000, 'TEST 17.1: Bob plan reflects Bob surplus of ₹15,000');
    assert(bobPlan.monthly_surplus !== actualPlan.monthly_surplus, 'TEST 17.2: Bob plan is strictly isolated from Alice');

    // Cross-user API test: Bob queries his own plan via HTTP
    const resBob = await request(app)
      .get('/api/v1/action/plan?month=2026-09')
      .set('Authorization', `Bearer ${tokenBob}`);
    assert(resBob.status === 200, 'TEST 17.3: Bob GET /api/v1/action/plan returns 200 OK');
    assert(resBob.body.monthly_surplus === 15000, 'TEST 17.4: Bob API response contains Bob data only');

    // ======================================================================
    // 18. HTTP ENDPOINT & INVALID INPUT VALIDATION
    // ======================================================================
    // Unauthenticated request
    const resUnauth = await request(app).get('/api/v1/action/plan');
    assert(resUnauth.status === 401, 'TEST 18.1: Unauthenticated request rejected with 401 Unauthorized');

    // Invalid month format
    const resBadMonth = await request(app)
      .get('/api/v1/action/plan?month=2026-13')
      .set('Authorization', `Bearer ${tokenAlice}`);
    assert(resBadMonth.status === 400, 'TEST 18.2: Out-of-bounds month (2026-13) rejected with 400 Bad Request');

    const resBadTextMonth = await request(app)
      .get('/api/v1/action/plan?month=september-2026')
      .set('Authorization', `Bearer ${tokenAlice}`);
    assert(resBadTextMonth.status === 400, 'TEST 18.3: Invalid month text rejected with 400 Bad Request');

    // Valid simulation via HTTP POST
    const resSim = await request(app)
      .post('/api/v1/action/simulate')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({
        month: '2026-09',
        surplus_delta: 2000,
      });
    assert(resSim.status === 200, 'TEST 18.4: POST /api/v1/action/simulate returns 200 OK');
    assert(resSim.body.invariant_verified === true, 'TEST 18.5: Simulation result maintains verified invariant');

    // Valid confirm via HTTP POST
    const resConfirm = await request(app)
      .post('/api/v1/action/confirm')
      .set('Authorization', `Bearer ${tokenBob}`)
      .send({ month: '2026-09' });
    assert(resConfirm.status === 201, 'TEST 18.6: POST /api/v1/action/confirm returns 201 Created');
    assert(resConfirm.body.confirmed_at !== undefined, 'TEST 18.7: Confirmed plan includes confirmed_at timestamp');

    // History check
    const resHist = await request(app)
      .get('/api/v1/action/history')
      .set('Authorization', `Bearer ${tokenBob}`);
    assert(resHist.status === 200, 'TEST 18.8: GET /api/v1/action/history returns 200 OK');
    assert(resHist.body.length >= 1, 'TEST 18.9: History contains Bob confirmed plan');

    console.log(`\n=== STEP 6 SUMMARY: ${passed} PASSED, ${failed} FAILED ===\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Unexpected test error:', err);
    process.exit(1);
  }
}

runStep6ActionEngineTests();
