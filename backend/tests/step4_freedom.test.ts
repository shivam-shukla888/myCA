import request from 'supertest';
import { createApp } from '../src/app.js';
import { testUserRoles } from '../src/middleware/auth.js';
import {
  calculateFutureExpense,
  calculateTargetCorpus,
  calculateFutureWealth,
  calculateRequiredMonthlyContribution,
  runFreedomAnalysis,
} from '../src/modules/freedom/freedom.engine.js';
import { freedomService } from '../src/modules/freedom/freedom.service.js';
import { allocationService } from '../src/modules/allocation/allocation.service.js';

const app = createApp();

const TEST_USER = 'cccccccc-3333-3333-3333-cccccccccccc';
testUserRoles.set(TEST_USER, 'USER');
const tokenTestUser = `mock-test-token:${TEST_USER}:carol@example.com`;

async function runStep4FreedomTests() {
  console.log('=== RUNNING STEP 4: FINANCIAL FREEDOM CALCULATOR & WHAT-IF ENGINE TESTS ===\n');

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
    // TEST 1: Pure Math — Inflation adjustment
    // ----------------------------------------------------------------------
    const fvExpense = calculateFutureExpense(50000, 6.0, 25);
    assert(
      fvExpense > 214590 && fvExpense < 214600,
      `TEST 1: Future monthly need at 6% inflation across 25 years (~214,593.54, got ${fvExpense})`
    );

    // ----------------------------------------------------------------------
    // TEST 2: Pure Math — Target Corpus
    // ----------------------------------------------------------------------
    const targetCorpus = calculateTargetCorpus(200000, 4.0);
    assert(
      targetCorpus === 60000000,
      `TEST 2: Target corpus for ₹2,00,000/mo at 4% SWR is ₹6,00,00,000 (got ${targetCorpus})`
    );

    // ----------------------------------------------------------------------
    // TEST 3: Zero Inflation Edge Case
    // ----------------------------------------------------------------------
    const zeroInf = calculateFutureExpense(75000, 0, 20);
    assert(zeroInf === 75000, `TEST 3: Zero inflation leaves future expense identical (got ${zeroInf})`);

    // ----------------------------------------------------------------------
    // TEST 4: Zero Return Edge Case (i = 0)
    // ----------------------------------------------------------------------
    const zeroRet = calculateFutureWealth(100000, 10000, 0, 10);
    assert(
      zeroRet.projectedWealth === 1300000 &&
      zeroRet.futureValueOfInvestableWealth === 100000 &&
      zeroRet.futureValueOfContributions === 1200000,
      `TEST 4: Zero return accumulates wealth linearly (got ${zeroRet.projectedWealth})`
    );

    // ----------------------------------------------------------------------
    // TEST 5: Zero Starting Wealth Edge Case
    // ----------------------------------------------------------------------
    const zeroWealth = calculateFutureWealth(0, 15000, 10.0, 15);
    assert(
      zeroWealth.futureValueOfInvestableWealth === 0 &&
      zeroWealth.projectedWealth === zeroWealth.futureValueOfContributions,
      `TEST 5: Zero starting wealth relies exclusively on future contributions (got ${zeroWealth.projectedWealth})`
    );

    // ----------------------------------------------------------------------
    // TEST 6: Zero Contribution Edge Case
    // ----------------------------------------------------------------------
    const zeroContrib = calculateFutureWealth(500000, 0, 12.0, 10);
    assert(
      zeroContrib.futureValueOfContributions === 0 &&
      zeroContrib.projectedWealth > 1650000 && zeroContrib.projectedWealth < 1651000,
      `TEST 6: Zero contribution compounds existing wealth only (~1,650,193.45, got ${zeroContrib.projectedWealth})`
    );

    // ----------------------------------------------------------------------
    // TEST 7: Positive Monthly Compounding Annuity
    // ----------------------------------------------------------------------
    const annuity = calculateFutureWealth(0, 10000, 12.0, 1);
    assert(
      annuity.projectedWealth > 126820 && annuity.projectedWealth < 126830,
      `TEST 7: Monthly annuity formula matches standard actuarial table (got ${annuity.projectedWealth})`
    );

    // ----------------------------------------------------------------------
    // TEST 8: Required Monthly Contribution Invariant
    // ----------------------------------------------------------------------
    const target = 50000000;
    const initial = 1000000;
    const rate = 10.0;
    const years = 20;
    const reqMonthly = calculateRequiredMonthlyContribution(target, initial, rate, years);
    const verifyWealth = calculateFutureWealth(initial, reqMonthly, rate, years);
    assert(
      Math.abs(verifyWealth.projectedWealth - target) < 10,
      `TEST 8: Required monthly contribution (₹${reqMonthly}) compiles forward precisely to target corpus`
    );

    // ----------------------------------------------------------------------
    // TEST 9: Already Funded Scenario
    // ----------------------------------------------------------------------
    const reqFunded = calculateRequiredMonthlyContribution(10000000, 20000000, 10.0, 15);
    assert(reqFunded === 0, `TEST 9: Already funded position yields 0 required contribution (got ${reqFunded})`);

    // ----------------------------------------------------------------------
    // TEST 10: Funding Gap and Mathematical Formula Transparency
    // ----------------------------------------------------------------------
    const analysis10 = runFreedomAnalysis({
      currentAge: 30,
      targetAge: 50,
      desiredMonthlyLifestyleIncome: 40000,
      monthlyContribution: 25000,
      existingInvestments: 500000,
      existingLiquidSavings: 300000,
      emergencyFundTarget: 240000,
      activeScenarioName: 'base',
    });
    const expectedGap = Math.max(0, Math.round((analysis10.active_scenario.indicative_target_corpus - analysis10.active_scenario.projected_wealth_at_target_age) * 100) / 100);
    assert(
      Math.abs(analysis10.active_scenario.funding_gap - expectedGap) < 0.05,
      `TEST 10A: Funding gap matches target corpus minus projected wealth (gap: ${analysis10.active_scenario.funding_gap}, expected: ${expectedGap})`
    );
    assert(
      analysis10.formula_transparency.future_expense_formula.includes('(1 + r_inflation)^years'),
      `TEST 10B: Formula transparency exposed in output metadata`
    );
    assert(
      analysis10.assumptions_disclaimer.includes('These are planning estimates based on user-calibrated economic assumptions'),
      `TEST 10C: Strict regulatory disclaimer present`
    );

    // ----------------------------------------------------------------------
    // TEST 11: Emergency Fund Isolation (No Double-Counting)
    // ----------------------------------------------------------------------
    const analysis11 = runFreedomAnalysis({
      currentAge: 30,
      targetAge: 55,
      desiredMonthlyLifestyleIncome: 50000,
      monthlyContribution: 20000,
      existingInvestments: 500000,
      existingLiquidSavings: 350000,
      emergencyFundTarget: 300000,
      activeScenarioName: 'base',
    });
    assert(
      analysis11.emergency_fund_target === 300000 &&
      analysis11.emergency_fund_reserve === 300000 &&
      analysis11.initial_investable_wealth === 550000,
      `TEST 11: Emergency cash is strictly protected; investable wealth = 500k + 50k excess = 550k (got ${analysis11.initial_investable_wealth})`
    );

    // ----------------------------------------------------------------------
    // TEST 12: Three Explicit Scenarios (Conservative, Base, Optimistic)
    // ----------------------------------------------------------------------
    const analysis12 = runFreedomAnalysis({
      currentAge: 28,
      targetAge: 55,
      desiredMonthlyLifestyleIncome: 60000,
      monthlyContribution: 35000,
      existingInvestments: 800000,
      existingLiquidSavings: 500000,
      emergencyFundTarget: 360000,
      activeScenarioName: 'base',
    });
    assert(
      analysis12.scenarios.conservative.indicative_target_corpus > analysis12.scenarios.base.indicative_target_corpus &&
      analysis12.scenarios.optimistic.indicative_target_corpus < analysis12.scenarios.base.indicative_target_corpus,
      `TEST 12: Three explicit planning scenarios evaluated and ordered correctly`
    );

    // ----------------------------------------------------------------------
    // Setup Profile for HTTP APIs
    // ----------------------------------------------------------------------
    await allocationService.upsertProfile(TEST_USER, {
      age: 30,
      target_retirement_age: 55,
      monthly_essential_expenses: 50000,
      existing_liquid_savings: 400000,
      existing_investments: 1000000,
      emergency_fund_target_months: 6,
      monthly_income: 100000,
      monthly_debt_obligations: 0,
      dependents: 0,
      has_health_insurance: true,
      has_life_insurance: true,
      desired_monthly_lifestyle_income: 80000,
    });

    // ----------------------------------------------------------------------
    // TEST 13: HTTP GET /api/v1/freedom/status
    // ----------------------------------------------------------------------
    const getStatusRes = await request(app)
      .get('/api/v1/freedom/status')
      .set('Authorization', `Bearer ${tokenTestUser}`);

    assert(getStatusRes.status === 200, 'TEST 13A: GET /api/v1/freedom/status returns 200 OK');
    assert(getStatusRes.body.current_age === 30, 'TEST 13B: Current age matches profile (30)');
    assert(getStatusRes.body.target_age === 55, 'TEST 13C: Target age matches profile (55)');
    assert(getStatusRes.body.active_scenario.indicative_target_corpus > 0, 'TEST 13D: Target corpus calculated');
    assert(
      ['Ahead of Target', 'On Track', 'Behind Target'].includes(getStatusRes.body.active_scenario.status),
      `TEST 13E: Status categorized (${getStatusRes.body.active_scenario.status})`
    );

    // ----------------------------------------------------------------------
    // TEST 14: HTTP POST /api/v1/freedom/simulate (Ephemeral What-If)
    // ----------------------------------------------------------------------
    const simRes = await request(app)
      .post('/api/v1/freedom/simulate')
      .set('Authorization', `Bearer ${tokenTestUser}`)
      .send({
        target_age: 50,
        expected_return: 12.0,
        inflation_rate: 5.0,
        withdrawal_rate: 4.0,
      });

    assert(simRes.status === 200, 'TEST 14A: POST /api/v1/freedom/simulate returns 200 OK');
    assert(simRes.body.target_age === 50, 'TEST 14B: Simulation reflects simulated target age 50');
    assert(simRes.body.active_scenario.expected_return_pct === 12.0, 'TEST 14C: Simulation reflects 12% return');

    // Confirm persistent profile remained unchanged
    const currentProf = await allocationService.getProfile(TEST_USER);
    assert(
      currentProf?.target_retirement_age === 55,
      `TEST 14D: Simulate did NOT mutate persistent profile (target_age still ${currentProf?.target_retirement_age})`
    );

    // ----------------------------------------------------------------------
    // TEST 15: Validation Rejection — target_age <= current_age
    // ----------------------------------------------------------------------
    const invalidAgeRes = await request(app)
      .post('/api/v1/freedom/simulate')
      .set('Authorization', `Bearer ${tokenTestUser}`)
      .send({
        current_age: 45,
        target_age: 40,
      });

    assert(invalidAgeRes.status === 400, 'TEST 15A: Returns 400 Bad Request when target_age <= current_age');
    assert(
      JSON.stringify(invalidAgeRes.body).includes('Target financial freedom age must be strictly greater than current age'),
      'TEST 15B: Descriptive error message returned'
    );

    // ----------------------------------------------------------------------
    // TEST 16: Validation Rejection — Negative Rates
    // ----------------------------------------------------------------------
    const invalidRateRes = await request(app)
      .post('/api/v1/freedom/simulate')
      .set('Authorization', `Bearer ${tokenTestUser}`)
      .send({
        expected_return: -5,
      });

    assert(invalidRateRes.status === 400, 'TEST 16: Returns 400 Bad Request for negative return assumption');

    // ----------------------------------------------------------------------
    // TEST 17: HTTP PUT /api/v1/freedom/assumptions (Persistent Assumptions)
    // ----------------------------------------------------------------------
    const putAssumptionsRes = await request(app)
      .put('/api/v1/freedom/assumptions')
      .set('Authorization', `Bearer ${tokenTestUser}`)
      .send({
        planning_inflation_rate: 6.5,
        planning_expected_return: 11.0,
        planning_withdrawal_rate: 3.8,
        planning_scenario: 'conservative',
      });

    assert(putAssumptionsRes.status === 200, 'TEST 17A: PUT /api/v1/freedom/assumptions returns 200 OK');

    const updatedAssumptions = freedomService.getInMemoryAssumptions(TEST_USER);
    assert(
      updatedAssumptions?.planning_expected_return === 11.0 &&
      updatedAssumptions?.planning_scenario === 'conservative',
      'TEST 17B: Planning assumptions successfully updated and persisted'
    );

  } catch (err: any) {
    console.error('Unhandled test execution error:', err);
    failed++;
  }

  console.log('\n==================================================');
  console.log(`STEP 4 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep4FreedomTests();
