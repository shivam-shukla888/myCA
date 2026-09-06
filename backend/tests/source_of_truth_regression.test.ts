import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { testUserRoles } from '../src/middleware/auth.js';
import { canonicalFinanceService } from '../src/modules/finance/canonicalFinance.service.js';
import { allocationService } from '../src/modules/allocation/allocation.service.js';
import { actionService } from '../src/modules/action/action.service.js';
import { freedomService } from '../src/modules/freedom/freedom.service.js';
import { financialContextService } from '../src/modules/ai/financialContext.service.js';
import { croreService } from '../src/modules/crore/crore.service.js';
import { contextBuilder } from '../src/modules/ai/orchestrator/contextBuilder.js';

const app = createApp();

async function runRegressionSuite() {
  console.log('================================================================');
  console.log('STARTING SOURCE-OF-TRUTH REGRESSION TEST SUITE');
  console.log('================================================================\n');

  // ====================================================================
  // BUG-P1-01: Allocation Service Bypasses Canonical Finance Service
  // ====================================================================
  console.log('--- TEST 1: BUG-P1-01 Allocation Service Canonical State ---');
  const userAlloc = '11111111-1111-1111-1111-111111111111';
  testUserRoles.set(userAlloc, 'USER');
  const userAllocToken = `mock-test-token:${userAlloc}:alloc@example.com`;
  const month1 = '2026-09';

  // Profile: Income = ₹1,00,000, Expenses = ₹60,000, No transactions
  await request(app)
    .put('/api/v1/allocation/profile')
    .set('Authorization', `Bearer ${userAllocToken}`)
    .send({
      monthly_income: 100000,
      monthly_essential_expenses: 60000,
      monthly_debt_obligations: 0,
      existing_liquid_savings: 50000,
      existing_investments: 100000,
      emergency_fund_target_months: 6,
    });

  const planNoTx = await request(app)
    .post('/api/v1/allocation/plans/generate')
    .set('Authorization', `Bearer ${userAllocToken}`)
    .send({ month: month1 });

  assert.strictEqual(planNoTx.status, 201, 'Plan generation succeeds (201)');
  assert.strictEqual(planNoTx.body.data.monthly_income, 100000, 'Allocation income = 100,000');
  assert.strictEqual(planNoTx.body.data.monthly_expenses, 60000, 'Allocation expenses = 60,000');
  assert.strictEqual(planNoTx.body.data.monthly_surplus, 40000, 'Allocation surplus = 40,000 (MUST NOT BE 0)');
  assert.strictEqual(planNoTx.body.data.is_deficit, false, 'is_deficit = false');
  console.log('[PASS] BUG-P1-01 Part 1: Allocation correctly derives ₹40,000 surplus from profile baseline without transactions');

  // Add transactions: Observed ledger takes precedence
  await request(app)
    .post('/api/v1/transactions')
    .set('Authorization', `Bearer ${userAllocToken}`)
    .send({
      description: 'Consulting Income',
      amount: 120000,
      currency: 'INR',
      type: 'income',
      category: 'Salary',
      account: 'HDFC',
      date: `${month1}-01`,
    });

  await request(app)
    .post('/api/v1/transactions')
    .set('Authorization', `Bearer ${userAllocToken}`)
    .send({
      description: 'Actual Living Expense',
      amount: 70000,
      currency: 'INR',
      type: 'expense',
      category: 'Living',
      account: 'HDFC',
      date: `${month1}-05`,
    });

  const planWithTx = await request(app)
    .post('/api/v1/allocation/plans/generate')
    .set('Authorization', `Bearer ${userAllocToken}`)
    .send({ month: month1 });

  assert.strictEqual(planWithTx.body.data.monthly_income, 120000, 'Ledger income takes precedence (120k)');
  assert.strictEqual(planWithTx.body.data.monthly_expenses, 70000, 'Ledger expenses take precedence (70k)');
  assert.strictEqual(planWithTx.body.data.monthly_surplus, 50000, 'Ledger surplus takes precedence (50k)');
  console.log('[PASS] BUG-P1-01 Part 2: Observed ledger takes precedence over profile stated baseline');

  // ====================================================================
  // BUG-P1-02: Action Engine Bypasses Canonical Finance Service
  // ====================================================================
  console.log('\n--- TEST 2: BUG-P1-02 Action Engine Canonical State ---');
  const userAction = '22222222-2222-2222-2222-222222222222';
  testUserRoles.set(userAction, 'USER');
  const userActionToken = `mock-test-token:${userAction}:action@example.com`;

  await request(app)
    .put('/api/v1/allocation/profile')
    .set('Authorization', `Bearer ${userActionToken}`)
    .send({
      monthly_income: 100000,
      monthly_essential_expenses: 60000,
      monthly_debt_obligations: 0,
      existing_liquid_savings: 200000,
      existing_investments: 300000,
      emergency_fund_target_months: 6,
    });

  const actionPlanNoTx = await request(app)
    .post('/api/v1/action/plan')
    .set('Authorization', `Bearer ${userActionToken}`)
    .send({ month: month1 });

  assert.strictEqual(actionPlanNoTx.status, 200, 'Action plan generation returns 200');
  assert.strictEqual(actionPlanNoTx.body.data.monthly_income, 100000, 'Action engine income is 100k');
  assert.strictEqual(actionPlanNoTx.body.data.monthly_expenses, 60000, 'Action engine expenses is 60k');
  assert.strictEqual(actionPlanNoTx.body.data.monthly_surplus, 40000, 'Action engine surplus is 40k (No false zero surplus)');
  assert.strictEqual(actionPlanNoTx.body.data.is_deficit, false, 'Action engine is_deficit is false');
  assert(actionPlanNoTx.body.data.actions.length > 0, 'Actions generated from positive surplus');
  console.log('[PASS] BUG-P1-02: Action engine correctly uses canonical surplus (₹40,000) with zero transactions');

  // ====================================================================
  // BUG-P1-03: Financial Freedom Target Month Propagation
  // ====================================================================
  console.log('\n--- TEST 3: BUG-P1-03 Financial Freedom Target Month Flow ---');
  const userFreedom = '33333333-3333-3333-3333-333333333333';
  testUserRoles.set(userFreedom, 'USER');
  const userFreedomToken = `mock-test-token:${userFreedom}:freedom@example.com`;

  await request(app)
    .put('/api/v1/allocation/profile')
    .set('Authorization', `Bearer ${userFreedomToken}`)
    .send({
      age: 28,
      monthly_income: 90000,
      monthly_essential_expenses: 40000,
      existing_liquid_savings: 100000,
      existing_investments: 200000,
      target_retirement_age: 50,
      desired_monthly_lifestyle_income: 50000,
    });

  const monthsToTest = ['2026-09', '2026-10', '2027-01'];
  for (const m of monthsToTest) {
    const res = await request(app)
      .get(`/api/v1/freedom/status?month=${m}`)
      .set('Authorization', `Bearer ${userFreedomToken}`);

    assert.strictEqual(res.status, 200, `Freedom status for ${m} returns 200`);
    assert.strictEqual(res.body.target_month, m, `Returned target_month matches requested ${m}`);
    assert(res.body.indicative_target_corpus > 0 || res.body.active_scenario.indicative_target_corpus > 0, 'Target corpus calculated');
  }

  // Also test query via targetMonth parameter
  const resTargetMonth = await request(app)
    .get(`/api/v1/freedom/status?targetMonth=2027-01`)
    .set('Authorization', `Bearer ${userFreedomToken}`);
  assert.strictEqual(resTargetMonth.body.target_month, '2027-01', 'query.targetMonth respected');
  console.log('[PASS] BUG-P1-03: Financial Freedom respects targetMonth (2026-09, 2026-10, 2027-01) and returns target_month');

  // ====================================================================
  // BUG-P1-04: Ask CA Financial Context Canonical Property Names
  // ====================================================================
  console.log('\n--- TEST 4: BUG-P1-04 Ask CA Financial Context Canonical Names ---');
  const userContext = '44444444-4444-4444-4444-444444444444';
  testUserRoles.set(userContext, 'USER');
  const userContextToken = `mock-test-token:${userContext}:context@example.com`;

  await request(app)
    .put('/api/v1/allocation/profile')
    .set('Authorization', `Bearer ${userContextToken}`)
    .send({
      age: 32,
      monthly_income: 100000,
      monthly_essential_expenses: 50000,
      monthly_debt_obligations: 10000,
      dependents: 2,
      has_health_insurance: true,
      has_life_insurance: true,
      existing_liquid_savings: 150000,
      existing_investments: 400000,
      emergency_fund_target_months: 6,
    });

  const ctx = await financialContextService.buildDeterministicContext(userContext, '2026-09');

  assert.strictEqual(ctx.financial_profile?.monthly_debt_obligations, 10000, 'Context has monthly_debt_obligations = 10000');
  assert.strictEqual(ctx.financial_profile?.dependents, 2, 'Context has dependents = 2');
  assert.strictEqual(ctx.financial_profile?.has_life_insurance, true, 'Context has has_life_insurance = true');
  assert.strictEqual(ctx.financial_profile?.has_health_insurance, true, 'Context has has_health_insurance = true');
  assert.strictEqual(ctx.financial_profile?.monthly_essential_expenses, 50000, 'Context has monthly_essential_expenses = 50000');
  assert.strictEqual(ctx.financial_profile?.monthly_income, 100000, 'Context has monthly_income = 100000');

  // Verify backward-compatibility aliases still exist
  assert.strictEqual(ctx.financial_profile?.debt_obligations, 10000, 'Backward alias debt_obligations = 10000');
  assert.strictEqual(ctx.financial_profile?.insurance_status?.has_term_life_insurance, true, 'Backward alias has_term_life_insurance = true');

  // Verify contextBuilder formats <financial_profile>
  const prompt = contextBuilder.buildStructuredPrompt({
    query: 'Mera debt aur insurance status kya hai?',
    intent: 'PERSONAL_FINANCE',
    financialContext: ctx,
  });

  assert(prompt.includes('<monthly_debt_obligations currency="INR">10000.00</monthly_debt_obligations>'), 'Prompt contains canonical debt obligation');
  assert(prompt.includes('<dependents>2</dependents>'), 'Prompt contains dependents');
  assert(prompt.includes('<has_life_insurance>true</has_life_insurance>'), 'Prompt contains has_life_insurance');
  console.log('[PASS] BUG-P1-04: Ask CA financial context receives exact canonical profile properties and embeds them into LLM prompt');

  // ====================================================================
  // BUG-P2-01: Savings Rate Consistency on Deficit
  // ====================================================================
  console.log('\n--- TEST 5: BUG-P2-01 Deficit Savings Rate Consistency ---');
  const userDeficit = '99999999-9999-9999-9999-999999999999';
  testUserRoles.set(userDeficit, 'USER');
  const userDeficitToken = `mock-test-token:${userDeficit}:deficit@example.com`;
  const deficitMonth = '2026-09';

  // Record deficit: Income = 50,000, Expenses = 70,000
  await request(app)
    .post('/api/v1/transactions')
    .set('Authorization', `Bearer ${userDeficitToken}`)
    .send({
      description: 'Stipend',
      amount: 50000,
      currency: 'INR',
      type: 'income',
      category: 'Salary',
      account: 'SBI',
      date: `${deficitMonth}-01`,
    });

  await request(app)
    .post('/api/v1/transactions')
    .set('Authorization', `Bearer ${userDeficitToken}`)
    .send({
      description: 'Rent + Emergency Medical',
      amount: 70000,
      currency: 'INR',
      type: 'expense',
      category: 'Medical',
      account: 'SBI',
      date: `${deficitMonth}-02`,
    });

  const mmSummary = await request(app)
    .get(`/api/v1/transactions/summary/monthly?month=${deficitMonth}`)
    .set('Authorization', `Bearer ${userDeficitToken}`);

  assert.strictEqual(mmSummary.body.data.monthly_surplus, -20000, 'Deficit surplus is exactly -₹20,000');
  assert.strictEqual(mmSummary.body.data.savings_rate, 0, 'Savings rate is strictly clamped to 0% (NOT -40%)');
  assert.strictEqual(mmSummary.body.data.is_deficit, true, 'is_deficit flag is strictly true');

  const canonicalDeficit = await canonicalFinanceService.getCanonicalFinancialState(userDeficit, deficitMonth);
  assert.strictEqual(canonicalDeficit.cashflow.actual_monthly_surplus, -20000, 'Canonical surplus is -20000');
  assert.strictEqual(canonicalDeficit.cashflow.savings_rate, 0, 'Canonical savings rate is 0%');
  assert.strictEqual(canonicalDeficit.cashflow.is_deficit, true, 'Canonical is_deficit is true');
  console.log('[PASS] BUG-P2-01: Deficit state consistently maintains surplus = -₹20,000, savings_rate = 0%, is_deficit = true');

  // ====================================================================
  // TEST 6: Debt Handling & Non-Double-Counting
  // ====================================================================
  console.log('\n--- TEST 6: Canonical Debt Handling (No Double Counting) ---');
  const userDebt = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  testUserRoles.set(userDebt, 'USER');
  const userDebtToken = `mock-test-token:${userDebt}:debt@example.com`;

  await request(app)
    .put('/api/v1/allocation/profile')
    .set('Authorization', `Bearer ${userDebtToken}`)
    .send({
      monthly_income: 100000,
      monthly_essential_expenses: 50000,
      monthly_debt_obligations: 10000,
      existing_liquid_savings: 100000,
      existing_investments: 200000,
    });

  const debtState = await canonicalFinanceService.getCanonicalFinancialState(userDebt, '2026-09');
  assert.strictEqual(debtState.expenses.essential_monthly_expenses, 50000, 'Essential expenses = 50,000');
  assert.strictEqual(debtState.expenses.debt_payments, 10000, 'Debt payment = 10,000');
  assert.strictEqual(debtState.expenses.total_monthly_expenses, 60000, 'Total expenses = 60,000 (50k + 10k)');
  assert.strictEqual(debtState.cashflow.actual_monthly_surplus, 40000, 'Surplus = 40,000 (100k - 60k). Debt is NOT double-subtracted!');
  console.log('[PASS] TEST 6: Debt is correctly counted once in total expenses, never double-subtracted from surplus');

  // ====================================================================
  // TEST 7: Emergency Fund Target Uniformity
  // ====================================================================
  console.log('\n--- TEST 7: Emergency Fund Target Uniformity Across Modules ---');
  // Essential expenses = 50,000, Target months = 6 => Target = 300,000
  const expectedEfTarget = 300000;
  assert.strictEqual(debtState.capital_and_savings.emergency_fund_target, expectedEfTarget, 'Canonical EF target = 300,000');

  const allocPlan = await allocationService.generatePlanForMonth(userDebt, '2026-09');
  assert.strictEqual(allocPlan.emergency_fund.emergency_fund_target, expectedEfTarget, 'Allocation EF target = 300,000');

  const freedomRes = await freedomService.getFreedomStatus(userDebt, '2026-09');
  assert.strictEqual(freedomRes.emergency_fund_target, expectedEfTarget, 'Freedom EF target = 300,000');

  const aiCtx = await financialContextService.buildDeterministicContext(userDebt, '2026-09');
  assert.strictEqual(aiCtx.allocation?.emergency_fund_target, expectedEfTarget, 'Ask CA EF target = 300,000');
  console.log('[PASS] TEST 7: Canonical, Allocation, Freedom, and Ask CA all share exact same emergency target (₹3,00,000)');

  // ====================================================================
  // TEST 8: Two-User Isolation (User A vs User B)
  // ====================================================================
  console.log('\n--- TEST 8: Two-User Complete Isolation ---');
  const userA = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const userB = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  testUserRoles.set(userA, 'USER');
  testUserRoles.set(userB, 'USER');
  const tokenA = `mock-test-token:${userA}:usera@example.com`;
  const tokenB = `mock-test-token:${userB}:userb@example.com`;

  // User A: Income 1L, Capital 5L
  await request(app)
    .put('/api/v1/allocation/profile')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      monthly_income: 100000,
      monthly_essential_expenses: 60000,
      existing_investments: 500000,
      existing_liquid_savings: 100000,
    });

  // User B: Income 5L, Capital 50L
  await request(app)
    .put('/api/v1/allocation/profile')
    .set('Authorization', `Bearer ${tokenB}`)
    .send({
      monthly_income: 500000,
      monthly_essential_expenses: 200000,
      existing_investments: 5000000,
      existing_liquid_savings: 1000000,
    });

  const stateA = await canonicalFinanceService.getCanonicalFinancialState(userA);
  const stateB = await canonicalFinanceService.getCanonicalFinancialState(userB);

  assert.strictEqual(stateA.income.monthly_net_income, 100000, 'User A income is 100k');
  assert.strictEqual(stateA.cashflow.actual_monthly_surplus, 40000, 'User A surplus is 40k');
  assert.strictEqual(stateB.income.monthly_net_income, 500000, 'User B income is 500k');
  assert.strictEqual(stateB.cashflow.actual_monthly_surplus, 300000, 'User B surplus is 300k');

  const croreA = await croreService.getUserCroreStatus(userA);
  const croreB = await croreService.getUserCroreStatus(userB);
  assert.strictEqual(croreA.calculation.starting_capital, 500000, 'User A crore starting capital = 5L');
  assert.strictEqual(croreB.calculation.starting_capital, 5000000, 'User B crore starting capital = 50L');
  console.log('[PASS] TEST 8: Strict multi-tenant isolation: User A sees User A; User B sees User B');

  console.log('\n================================================================');
  console.log('ALL REGRESSION TESTS PASSED (8/8 CATEGORIES)');
  console.log('================================================================');
}

runRegressionSuite().catch((err) => {
  console.error('[REGRESSION SUITE FAILED]', err);
  process.exit(1);
});
