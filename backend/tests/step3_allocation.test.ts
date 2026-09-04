import request from 'supertest';
import { createApp } from '../src/app.js';
import { testUserRoles } from '../src/middleware/auth.js';
import { calculateEmergencyFund, allocateMonthlySurplus } from '../src/modules/allocation/allocation.engine.js';

const app = createApp();

const USER_ALICE = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa';
const USER_BOB = 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb';

testUserRoles.set(USER_ALICE, 'USER');
testUserRoles.set(USER_BOB, 'USER');

const tokenAlice = `mock-test-token:${USER_ALICE}:alice@example.com`;
const tokenBob = `mock-test-token:${USER_BOB}:bob@example.com`;

async function runStep3AllocationTests() {
  console.log('=== RUNNING STEP 3: SAVINGS ALLOCATION & FINANCIAL FREEDOM TESTS ===\n');

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
    // ----------------------------------------------------------------------
    // TEST 1: Pure Engine Emergency Fund Calculation
    // ----------------------------------------------------------------------
    // Essential expenses: 30,000, target months: 6 -> Target = 180,000. Existing savings: 50,000 -> Gap = 130,000
    const ef1 = calculateEmergencyFund(30000, 6, 50000);
    assert(ef1.emergency_fund_target === 180000, `TEST 1A: Target is ₹1,80,000 (got ${ef1.emergency_fund_target})`);
    assert(ef1.emergency_fund_gap === 130000, `TEST 1B: Gap is ₹1,30,000 (got ${ef1.emergency_fund_gap})`);
    assert(ef1.coverage_months === 1.67, `TEST 1C: Coverage is 1.67 months (got ${ef1.coverage_months})`);
    assert(!ef1.is_complete, 'TEST 1D: Emergency fund is not complete');

    // ----------------------------------------------------------------------
    // TEST 2: Emergency Fund Already Complete (Existing Savings >= Target)
    // ----------------------------------------------------------------------
    const efComplete = calculateEmergencyFund(30000, 6, 200000);
    assert(efComplete.emergency_fund_target === 180000, 'TEST 2A: Target is ₹1,80,000');
    assert(efComplete.emergency_fund_gap === 0, `TEST 2B: Gap is 0 (got ${efComplete.emergency_fund_gap})`);
    assert(efComplete.coverage_months === 6.67, `TEST 2C: Coverage is 6.67 months (got ${efComplete.coverage_months})`);
    assert(efComplete.is_complete, 'TEST 2D: Emergency fund flagged as complete');

    // ----------------------------------------------------------------------
    // TEST 3: Different Emergency Target Months (3 vs 12)
    // ----------------------------------------------------------------------
    const ef3 = calculateEmergencyFund(40000, 3, 0);
    assert(ef3.emergency_fund_target === 120000 && ef3.emergency_fund_gap === 120000, 'TEST 3A: 3-month target is ₹1,20,000');

    const ef12 = calculateEmergencyFund(40000, 12, 100000);
    assert(ef12.emergency_fund_target === 480000 && ef12.emergency_fund_gap === 380000, 'TEST 3B: 12-month target is ₹4,80,000 with ₹3,80,000 gap');

    // ----------------------------------------------------------------------
    // TEST 4: Engine Deterministic Surplus Allocation & Mathematical Invariant
    // ----------------------------------------------------------------------
    // Monthly income: 70,000, Expenses: 45,000 -> Surplus = 25,000
    const profileAlice = {
      user_id: USER_ALICE,
      monthly_essential_expenses: 30000,
      existing_liquid_savings: 50000,
      emergency_fund_target_months: 6,
      existing_investments: 100000,
    };
    const goalsAlice = [
      {
        id: 'g1',
        user_id: USER_ALICE,
        title: 'Down Payment',
        target_amount: 500000,
        current_amount: 50000,
        currency: 'INR',
        goal_type: 'savings' as const,
        priority: 'high' as const,
        status: 'active' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const plan1 = allocateMonthlySurplus('2026-09', 70000, 45000, profileAlice, goalsAlice);
    assert(plan1.monthly_surplus === 25000, `TEST 4A: Surplus is ₹25,000 (got ${plan1.monthly_surplus})`);
    assert(plan1.allocations.emergency_fund > 0, `TEST 4B: Emergency fund gets allocation (got ${plan1.allocations.emergency_fund})`);
    assert(plan1.allocations.goals > 0, `TEST 4C: Goals get allocation (got ${plan1.allocations.goals})`);
    assert(plan1.allocations.long_term_wealth > 0, `TEST 4D: Long-term wealth gets allocation (got ${plan1.allocations.long_term_wealth})`);
    assert(plan1.allocations.flexible_buffer > 0, `TEST 4E: Flexible buffer gets allocation (got ${plan1.allocations.flexible_buffer})`);

    // INVARIANT CHECK
    const sumAlloc1 = plan1.allocations.emergency_fund +
      plan1.allocations.goals +
      plan1.allocations.long_term_wealth +
      plan1.allocations.flexible_buffer;
    assert(
      Math.abs(sumAlloc1 - plan1.monthly_surplus) < 0.001,
      `TEST 4F (CRITICAL INVARIANT): Allocations sum (${sumAlloc1}) exactly equals surplus (${plan1.monthly_surplus})`
    );

    // ----------------------------------------------------------------------
    // TEST 5: Allocation When Emergency Fund Is Already Complete
    // ----------------------------------------------------------------------
    const profileComplete = {
      ...profileAlice,
      existing_liquid_savings: 250000, // exceeds target 180,000
    };
    const planComplete = allocateMonthlySurplus('2026-09', 70000, 45000, profileComplete, goalsAlice);
    assert(planComplete.allocations.emergency_fund === 0, `TEST 5A: Emergency fund allocation is 0 (got ${planComplete.allocations.emergency_fund})`);
    assert(planComplete.allocations.goals > 0, 'TEST 5B: Goals received boosted allocation');
    assert(planComplete.allocations.long_term_wealth > 0, 'TEST 5C: Long-term wealth received boosted allocation');

    const sumAllocComplete = planComplete.allocations.emergency_fund +
      planComplete.allocations.goals +
      planComplete.allocations.long_term_wealth +
      planComplete.allocations.flexible_buffer;
    assert(
      Math.abs(sumAllocComplete - planComplete.monthly_surplus) < 0.001,
      `TEST 5D (CRITICAL INVARIANT): Complete EF allocations sum (${sumAllocComplete}) equals surplus (${planComplete.monthly_surplus})`
    );

    // ----------------------------------------------------------------------
    // TEST 6: Zero Surplus Handling
    // ----------------------------------------------------------------------
    const planZero = allocateMonthlySurplus('2026-09', 50000, 50000, profileAlice, goalsAlice);
    assert(planZero.monthly_surplus === 0, 'TEST 6A: Surplus is 0');
    assert(!planZero.is_deficit, 'TEST 6B: Zero surplus is not a deficit');
    assert(planZero.allocations.emergency_fund === 0, 'TEST 6C: Emergency allocation is 0');
    assert(planZero.allocations.goals === 0, 'TEST 6D: Goals allocation is 0');
    assert(planZero.allocations.long_term_wealth === 0, 'TEST 6E: Wealth allocation is 0');
    assert(planZero.allocations.flexible_buffer === 0, 'TEST 6F: Buffer allocation is 0');
    assert(planZero.allocations.total_allocated === 0, 'TEST 6G: Total allocated is 0');

    // ----------------------------------------------------------------------
    // TEST 7: Negative Surplus (Deficit) & Spending Pressure Analysis
    // ----------------------------------------------------------------------
    const planDeficit = allocateMonthlySurplus('2026-09', 40000, 55000, profileAlice, goalsAlice);
    assert(planDeficit.monthly_surplus === -15000, `TEST 7A: Surplus is -15,000 (got ${planDeficit.monthly_surplus})`);
    assert(planDeficit.is_deficit === true, 'TEST 7B: Flagged as deficit');
    assert(planDeficit.allocations.emergency_fund === 0, 'TEST 7C: Deficit halts emergency allocation');
    assert(planDeficit.allocations.goals === 0, 'TEST 7D: Deficit halts goals allocation');
    assert(planDeficit.allocations.long_term_wealth === 0, 'TEST 7E: Deficit halts wealth allocation');
    assert(planDeficit.allocations.flexible_buffer === 0, 'TEST 7F: Deficit halts buffer allocation');
    assert(planDeficit.explanation.deficit_pressure_analysis !== undefined, 'TEST 7G: Deficit pressure analysis provided');
    assert(planDeficit.explanation.primary_summary.includes('Monthly deficit'), 'TEST 7H: Primary summary explicitly notes deficit');

    // ----------------------------------------------------------------------
    // TEST 8: Financial Freedom Foundation Target Status
    // ----------------------------------------------------------------------
    assert(
      plan1.financial_freedom.target_corpus_status === 'Target corpus not calculated yet',
      `TEST 8: Target corpus status strictly displays 'Target corpus not calculated yet' (got ${plan1.financial_freedom.target_corpus_status})`
    );

    // ----------------------------------------------------------------------
    // TEST 9: HTTP API — Profile Management (PUT & GET /api/v1/allocation/profile)
    // ----------------------------------------------------------------------
    const putProfileRes = await request(app)
      .put('/api/v1/allocation/profile')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({
        age: 32,
        monthly_income: 80000,
        existing_liquid_savings: 120000,
        existing_investments: 250000,
        monthly_essential_expenses: 35000,
        monthly_debt_obligations: 5000,
        dependents: 1,
        has_health_insurance: true,
        has_life_insurance: true,
        emergency_fund_target_months: 6,
        target_retirement_age: 58,
        desired_monthly_lifestyle_income: 120000,
      });
    assert(putProfileRes.status === 200, 'TEST 9A: Profile updated successfully with 200 OK', putProfileRes.body);

    const getProfileRes = await request(app)
      .get('/api/v1/allocation/profile')
      .set('Authorization', `Bearer ${tokenAlice}`);
    assert(getProfileRes.status === 200, 'TEST 9B: Profile fetched with 200 OK');
    assert(getProfileRes.body.data.age === 32, 'TEST 9C: Profile age matches 32');
    assert(getProfileRes.body.data.existing_liquid_savings === 120000, 'TEST 9D: Liquid savings matches ₹1,20,000');

    // ----------------------------------------------------------------------
    // TEST 10: HTTP API — Goals CRUD (/api/v1/allocation/goals)
    // ----------------------------------------------------------------------
    const createGoalRes = await request(app)
      .post('/api/v1/allocation/goals')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({
        title: 'Emergency Buffer Top-up',
        target_amount: 100000,
        current_amount: 20000,
        goal_type: 'emergency_fund',
        priority: 'high',
      });
    assert(createGoalRes.status === 201, 'TEST 10A: Created goal with 201 Created');
    const goalId = createGoalRes.body.data.id;

    const listGoalsRes = await request(app)
      .get('/api/v1/allocation/goals')
      .set('Authorization', `Bearer ${tokenAlice}`);
    assert(listGoalsRes.status === 200, 'TEST 10B: Listed goals with 200 OK');
    assert(listGoalsRes.body.data.length >= 1, 'TEST 10C: Goals list contains Alice goal');

    const updateGoalRes = await request(app)
      .put(`/api/v1/allocation/goals/${goalId}`)
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({
        current_amount: 30000,
      });
    assert(updateGoalRes.status === 200 && updateGoalRes.body.data.current_amount === 30000, 'TEST 10D: Goal updated to ₹30,000');

    // ----------------------------------------------------------------------
    // TEST 11: HTTP API — Monthly Plan Generation & Invariant
    // ----------------------------------------------------------------------
    // Seed income and expenses for Alice in 2026-09
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({
        description: 'Alice Salary Inflow',
        amount: 80000,
        currency: 'INR',
        type: 'income',
        category: 'Salary',
        date: '2026-09-01',
      });

    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({
        description: 'Alice Living Expenses',
        amount: 50000,
        currency: 'INR',
        type: 'expense',
        category: 'Living',
        date: '2026-09-10',
      });

    const genPlanRes = await request(app)
      .post('/api/v1/allocation/plans/generate')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({
        month: '2026-09',
      });
    assert(genPlanRes.status === 201, 'TEST 11A: Plan generated successfully with 201 Created');
    const planData = genPlanRes.body.data;
    assert(planData.monthly_surplus === 30000, `TEST 11B: Monthly surplus is ₹30,000 (got ${planData.monthly_surplus})`);

    const totalAllocApi = planData.allocations.emergency_fund +
      planData.allocations.goals +
      planData.allocations.long_term_wealth +
      planData.allocations.flexible_buffer;
    assert(
      Math.abs(totalAllocApi - planData.monthly_surplus) < 0.001,
      `TEST 11C (CRITICAL INVARIANT): API plan allocations sum (${totalAllocApi}) equals surplus (${planData.monthly_surplus})`
    );

    // ----------------------------------------------------------------------
    // TEST 12: Historical Monthly Plans & Retrieval
    // ----------------------------------------------------------------------
    const historyRes = await request(app)
      .get('/api/v1/allocation/plans/history')
      .set('Authorization', `Bearer ${tokenAlice}`);
    assert(historyRes.status === 200, 'TEST 12A: Plan history returned with 200 OK');
    assert(historyRes.body.data.length >= 1, 'TEST 12B: History contains generated plan');

    const getPlanMonthRes = await request(app)
      .get('/api/v1/allocation/plans/2026-09')
      .set('Authorization', `Bearer ${tokenAlice}`);
    assert(getPlanMonthRes.status === 200, 'TEST 12C: Specific month plan retrieved with 200 OK');
    assert(getPlanMonthRes.body.data.month === '2026-09', 'TEST 12D: Retrieved plan matches 2026-09');

    // ----------------------------------------------------------------------
    // TEST 13: Strict Cross-User Data Isolation
    // ----------------------------------------------------------------------
    // Bob should not see Alice's profile
    const bobProfileRes = await request(app)
      .get('/api/v1/allocation/profile')
      .set('Authorization', `Bearer ${tokenBob}`);
    assert(bobProfileRes.body.data === null, 'TEST 13A: Bob profile is isolated (does not see Alice profile)');

    // Bob cannot delete Alice's goal
    const bobDeleteGoalRes = await request(app)
      .delete(`/api/v1/allocation/goals/${goalId}`)
      .set('Authorization', `Bearer ${tokenBob}`);
    assert(bobDeleteGoalRes.status === 404 || bobDeleteGoalRes.status === 403,
      `TEST 13B: Bob denied from deleting Alice goal (got ${bobDeleteGoalRes.status})`);

    // Bob cannot read Alice's 2026-09 plan
    const bobGetPlanRes = await request(app)
      .get('/api/v1/allocation/plans/2026-09')
      .set('Authorization', `Bearer ${tokenBob}`);
    assert(bobGetPlanRes.status === 404, `TEST 13C: Bob cannot access Alice plan (got ${bobGetPlanRes.status})`);

    // ----------------------------------------------------------------------
    // TEST 14: Strict Input Validation (Edge Cases & Malformed Payloads)
    // ----------------------------------------------------------------------
    const invalidAgeRes = await request(app)
      .put('/api/v1/allocation/profile')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({
        age: 12, // < 18
      });
    assert(invalidAgeRes.status === 400, 'TEST 14A: Age < 18 rejected with 400 Bad Request');

    const negExpensesRes = await request(app)
      .put('/api/v1/allocation/profile')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({
        monthly_essential_expenses: -5000,
      });
    assert(negExpensesRes.status === 400, 'TEST 14B: Negative expenses rejected with 400 Bad Request');

    const badMonthPlanRes = await request(app)
      .post('/api/v1/allocation/plans/generate')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({
        month: '2026-13',
      });
    assert(badMonthPlanRes.status === 400, 'TEST 14C: Out-of-bounds month 2026-13 rejected with 400 Bad Request');

    // ----------------------------------------------------------------------
    // TEST 15: Delete Goal Lifecycle
    // ----------------------------------------------------------------------
    const delGoalRes = await request(app)
      .delete(`/api/v1/allocation/goals/${goalId}`)
      .set('Authorization', `Bearer ${tokenAlice}`);
    assert(delGoalRes.status === 200, 'TEST 15: Alice goal deleted successfully');

  } catch (err: any) {
    console.error('Fatal error during Step 3 test run:', err);
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`STEP 3 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runStep3AllocationTests();
