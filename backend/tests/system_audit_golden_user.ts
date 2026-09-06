import request from 'supertest';
import { createApp } from '../src/app.js';
import { testUserRoles } from '../src/middleware/auth.js';
import { canonicalFinanceService } from '../src/modules/finance/canonicalFinance.service.js';
import { croreService } from '../src/modules/crore/crore.service.js';
import { freedomService } from '../src/modules/freedom/freedom.service.js';
import { allocationService } from '../src/modules/allocation/allocation.service.js';
import { actionService } from '../src/modules/action/action.service.js';
import { financialContextService } from '../src/modules/ai/financialContext.service.js';
import { documentService } from '../src/modules/documents/document.service.js';

const app = createApp();

const GOLDEN_USER = '55555555-5555-5555-5555-555555555555';
testUserRoles.set(GOLDEN_USER, 'USER');
const goldenToken = `mock-test-token:${GOLDEN_USER}:golden@example.com`;

const USER_B = '66666666-6666-6666-6666-666666666666';
testUserRoles.set(USER_B, 'USER');
const userBToken = `mock-test-token:${USER_B}:userb@example.com`;

export interface AuditLogEntry {
  phase: string;
  testName: string;
  expected: any;
  actual: any;
  status: 'PASS' | 'FAIL' | 'DISCREPANCY';
  notes?: string;
}

const auditLogs: AuditLogEntry[] = [];

function record(entry: AuditLogEntry) {
  auditLogs.push(entry);
  const tag = entry.status === 'PASS' ? '[PASS]' : entry.status === 'FAIL' ? '[FAIL]' : '[DISCREPANCY]';
  console.log(`${tag} [${entry.phase}] ${entry.testName}`);
  if (entry.status !== 'PASS') {
    console.log(`   Expected:`, JSON.stringify(entry.expected));
    console.log(`   Actual:  `, JSON.stringify(entry.actual));
    if (entry.notes) console.log(`   Notes:   `, entry.notes);
  }
}

async function runAudit() {
  console.log('================================================================');
  console.log('STARTING MYCA COMPREHENSIVE END-TO-END AUDIT & TEST SUITE');
  console.log('================================================================\n');

  const targetMonth = '2026-11';

  // -------------------------------------------------------------
  // PHASE 5: GOLDEN USER PROFILE SETUP
  // -------------------------------------------------------------
  console.log('--- PHASE 5: Setting up Golden User Profile ---');
  const profRes = await request(app)
    .put('/api/v1/allocation/profile')
    .set('Authorization', `Bearer ${goldenToken}`)
    .send({
      age: 30,
      monthly_income: 100000,
      monthly_essential_expenses: 50000,
      monthly_debt_obligations: 10000,
      existing_liquid_savings: 200000,
      existing_investments: 500000,
      emergency_fund_target_months: 6,
      target_retirement_age: 55,
      desired_monthly_lifestyle_income: 60000,
      has_health_insurance: true,
      has_life_insurance: true,
      dependents: 2,
    });

  record({
    phase: 'PHASE 5',
    testName: 'Stated Profile API returns 200 OK',
    expected: 200,
    actual: profRes.status,
    status: profRes.status === 200 ? 'PASS' : 'FAIL',
  });

  // -------------------------------------------------------------
  // PHASE 6A: BEFORE OBSERVED TRANSACTIONS (PROFILE STATED ONLY)
  // -------------------------------------------------------------
  console.log('\n--- PHASE 6A: Profile Baseline Trace (No Ledger Transactions Yet) ---');
  const canonicalBeforeTx = await canonicalFinanceService.getCanonicalFinancialState(GOLDEN_USER, targetMonth);
  record({
    phase: 'PHASE 6A',
    testName: 'Canonical State Income (Profile Stated)',
    expected: 100000,
    actual: canonicalBeforeTx.income.monthly_net_income,
    status: canonicalBeforeTx.income.monthly_net_income === 100000 ? 'PASS' : 'FAIL',
  });
  record({
    phase: 'PHASE 6A',
    testName: 'Canonical State Total Expenses (Essential 50k + Debt 10k)',
    expected: 60000,
    actual: canonicalBeforeTx.expenses.total_monthly_expenses,
    status: canonicalBeforeTx.expenses.total_monthly_expenses === 60000 ? 'PASS' : 'FAIL',
  });
  record({
    phase: 'PHASE 6A',
    testName: 'Canonical State Surplus',
    expected: 40000,
    actual: canonicalBeforeTx.cashflow.actual_monthly_surplus,
    status: canonicalBeforeTx.cashflow.actual_monthly_surplus === 40000 ? 'PASS' : 'FAIL',
  });

  const allocBeforeTx = await request(app)
    .post('/api/v1/allocation/plans/generate')
    .set('Authorization', `Bearer ${goldenToken}`)
    .send({ month: targetMonth });
  const allocSurplusBeforeTx = allocBeforeTx.body.data?.monthly_surplus;
  record({
    phase: 'PHASE 6A',
    testName: 'Savings Allocation Plan surplus before transactions exist',
    expected: 40000,
    actual: allocSurplusBeforeTx,
    status: allocSurplusBeforeTx === 40000 ? 'PASS' : 'DISCREPANCY',
    notes: allocSurplusBeforeTx === 0
      ? 'CRITICAL DISCREPANCY: AllocationService queried transactionService directly instead of canonicalFinanceService, yielding surplus=0 despite stated profile having surplus=40000!'
      : undefined,
  });

  const freedomBeforeTx = await request(app)
    .get(`/api/v1/freedom/status?month=${targetMonth}`)
    .set('Authorization', `Bearer ${goldenToken}`);
  const freedomContributionBeforeTx = freedomBeforeTx.body.current_monthly_surplus;
  record({
    phase: 'PHASE 6A',
    testName: 'Financial Freedom monthly contribution before transactions exist (matches ₹20k investment capacity)',
    expected: 20000,
    actual: freedomContributionBeforeTx,
    status: freedomContributionBeforeTx === 20000 ? 'PASS' : 'DISCREPANCY',
    notes: freedomContributionBeforeTx === undefined || freedomContributionBeforeTx === 0
      ? 'CRITICAL DISCREPANCY: FreedomService returned 0 contribution!'
      : undefined,
  });

  // Verify Freedom uses requested targetMonth across multiple cycles (2026-09, 2026-10, 2027-01)
  const freedomSep = await request(app).get('/api/v1/freedom/status?month=2026-09').set('Authorization', `Bearer ${goldenToken}`);
  const freedomOct = await request(app).get('/api/v1/freedom/status?month=2026-10').set('Authorization', `Bearer ${goldenToken}`);
  const freedomJan = await request(app).get('/api/v1/freedom/status?month=2027-01').set('Authorization', `Bearer ${goldenToken}`);
  record({
    phase: 'PHASE 4',
    testName: 'Freedom respects requested months 2026-09, 2026-10, 2027-01 (all 200 OK)',
    expected: true,
    actual: freedomSep.status === 200 && freedomOct.status === 200 && freedomJan.status === 200,
    status: freedomSep.status === 200 && freedomOct.status === 200 && freedomJan.status === 200 ? 'PASS' : 'FAIL',
  });

  const actionBeforeTx = await request(app)
    .post('/api/v1/action/plan')
    .set('Authorization', `Bearer ${goldenToken}`)
    .send({ month: targetMonth });
  const actionSurplusBefore = actionBeforeTx.body.data?.monthly_surplus;
  record({
    phase: 'PHASE 6A',
    testName: 'Action Engine surplus before transactions exist',
    expected: 40000,
    actual: actionSurplusBefore,
    status: actionSurplusBefore === 40000 ? 'PASS' : 'DISCREPANCY',
    notes: actionSurplusBefore === 0
      ? 'CRITICAL DISCREPANCY: ActionService queried transactionService directly, yielding surplus=0!'
      : undefined,
  });

  // 7. Ask CA Financial Context before transactions
  const askContextBefore = await financialContextService.buildDeterministicContext(GOLDEN_USER, targetMonth);
  record({
    phase: 'PHASE 6A',
    testName: 'Ask CA Context Income before transactions (falls back to canonical)',
    expected: 100000,
    actual: askContextBefore.current_month.income,
    status: askContextBefore.current_month.income === 100000 ? 'PASS' : 'FAIL',
  });
  record({
    phase: 'PHASE 6A',
    testName: 'Ask CA Context Expenses before transactions',
    expected: 60000,
    actual: askContextBefore.current_month.expenses,
    status: askContextBefore.current_month.expenses === 60000 ? 'PASS' : 'FAIL',
  });
  record({
    phase: 'PHASE 6A',
    testName: 'Ask CA Context Surplus before transactions',
    expected: 40000,
    actual: askContextBefore.current_month.surplus,
    status: askContextBefore.current_month.surplus === 40000 ? 'PASS' : 'FAIL',
  });
  record({
    phase: 'PHASE 5',
    testName: 'Ask CA Context Profile Debt = ₹10,000/month',
    expected: 10000,
    actual: askContextBefore.financial_profile?.debt_obligations,
    status: askContextBefore.financial_profile?.debt_obligations === 10000 ? 'PASS' : 'FAIL',
  });
  record({
    phase: 'PHASE 5',
    testName: 'Ask CA Context Profile Dependents = 2',
    expected: 2,
    actual: askContextBefore.financial_profile?.dependents,
    status: askContextBefore.financial_profile?.dependents === 2 ? 'PASS' : 'FAIL',
  });
  record({
    phase: 'PHASE 5',
    testName: 'Ask CA Context Profile Life Insurance = true',
    expected: true,
    actual: askContextBefore.financial_profile?.insurance_status?.has_term_life_insurance,
    status: askContextBefore.financial_profile?.insurance_status?.has_term_life_insurance === true ? 'PASS' : 'FAIL',
  });
  record({
    phase: 'PHASE 5',
    testName: 'Ask CA Context Emergency Fund Target is configured (> 0)',
    expected: true,
    actual: (askContextBefore.allocation?.emergency_fund_target ?? 0) > 0,
    status: (askContextBefore.allocation?.emergency_fund_target ?? 0) > 0 ? 'PASS' : 'FAIL',
  });

  // -------------------------------------------------------------
  // PHASE 6B: RECORD OBSERVED TRANSACTIONS MATCHING GOLDEN USER
  // -------------------------------------------------------------
  console.log('\n--- PHASE 6B: Recording Observed Ledger Transactions ---');
  await request(app)
    .post('/api/v1/transactions')
    .set('Authorization', `Bearer ${goldenToken}`)
    .send({
      description: 'Golden Tech Salary',
      amount: 100000,
      currency: 'INR',
      type: 'income',
      category: 'Salary',
      account: 'HDFC Bank',
      date: `${targetMonth}-01`,
    });

  await request(app)
    .post('/api/v1/transactions')
    .set('Authorization', `Bearer ${goldenToken}`)
    .send({
      description: 'Golden Essential Living Expenses',
      amount: 50000,
      currency: 'INR',
      type: 'expense',
      category: 'Housing',
      account: 'HDFC Bank',
      date: `${targetMonth}-02`,
    });

  await request(app)
    .post('/api/v1/transactions')
    .set('Authorization', `Bearer ${goldenToken}`)
    .send({
      description: 'Golden Debt EMI',
      amount: 10000,
      currency: 'INR',
      type: 'expense',
      category: 'Debt',
      account: 'HDFC Bank',
      date: `${targetMonth}-03`,
    });

  const mmWithTx = await request(app)
    .get(`/api/v1/transactions/summary/monthly?month=${targetMonth}`)
    .set('Authorization', `Bearer ${goldenToken}`);
  record({
    phase: 'PHASE 6B',
    testName: 'Monthly Money Income (Observed ₹1,00,000)',
    expected: 100000,
    actual: mmWithTx.body.data.total_income,
    status: mmWithTx.body.data.total_income === 100000 ? 'PASS' : 'FAIL',
  });
  record({
    phase: 'PHASE 6B',
    testName: 'Monthly Money Expenses (Observed ₹60,000)',
    expected: 60000,
    actual: mmWithTx.body.data.total_expenses,
    status: mmWithTx.body.data.total_expenses === 60000 ? 'PASS' : 'FAIL',
  });
  record({
    phase: 'PHASE 6B',
    testName: 'Monthly Money Surplus (Observed ₹40,000)',
    expected: 40000,
    actual: mmWithTx.body.data.monthly_surplus,
    status: mmWithTx.body.data.monthly_surplus === 40000 ? 'PASS' : 'FAIL',
  });

  const allocWithTx = await request(app)
    .post('/api/v1/allocation/plans/generate')
    .set('Authorization', `Bearer ${goldenToken}`)
    .send({ month: targetMonth });
  record({
    phase: 'PHASE 6B',
    testName: 'Allocation Plan Surplus (Observed ₹40,000)',
    expected: 40000,
    actual: allocWithTx.body.data.monthly_surplus,
    status: allocWithTx.body.data.monthly_surplus === 40000 ? 'PASS' : 'FAIL',
  });
  record({
    phase: 'PHASE 6B',
    testName: 'Allocation Total Allocated <= Available Surplus (Invariant)',
    expected: true,
    actual: allocWithTx.body.data.allocations.total_allocated <= 40000,
    status: allocWithTx.body.data.allocations.total_allocated <= 40000 ? 'PASS' : 'FAIL',
  });

  const croreWithTx = await request(app)
    .get(`/api/v1/crore/status?month=${targetMonth}`)
    .set('Authorization', `Bearer ${goldenToken}`);
  const croreCalc = croreWithTx.body.data?.calculation;
  record({
    phase: 'PHASE 6B',
    testName: '₹1 Crore Starting Capital matches ₹5L invested capital',
    expected: 500000,
    actual: croreCalc.starting_capital,
    status: croreCalc.starting_capital === 500000 ? 'PASS' : 'FAIL',
  });
  record({
    phase: 'PHASE 6B',
    testName: '₹1 Crore Target Amount is strictly ₹1,00,00,000',
    expected: 10000000,
    actual: croreCalc.target_amount,
    status: croreCalc.target_amount === 10000000 ? 'PASS' : 'FAIL',
  });

  // -------------------------------------------------------------
  // PHASE 7: SINGLE-VARIABLE SENSITIVITY PROPAGATION
  // -------------------------------------------------------------
  console.log('\n--- PHASE 7: Single-Variable Sensitivity Tests ---');
  // Mutate Income: +20k (100k -> 120k)
  await request(app)
    .post('/api/v1/transactions')
    .set('Authorization', `Bearer ${goldenToken}`)
    .send({
      description: 'Bonus consulting income',
      amount: 20000,
      currency: 'INR',
      type: 'income',
      category: 'Freelance',
      account: 'HDFC Bank',
      date: `${targetMonth}-10`,
    });

  const mmAfterInc = await request(app)
    .get(`/api/v1/transactions/summary/monthly?month=${targetMonth}`)
    .set('Authorization', `Bearer ${goldenToken}`);
  record({
    phase: 'PHASE 7',
    testName: 'Income update propagates to Monthly Money (₹1,20,000)',
    expected: 120000,
    actual: mmAfterInc.body.data.total_income,
    status: mmAfterInc.body.data.total_income === 120000 ? 'PASS' : 'FAIL',
  });
  record({
    phase: 'PHASE 7',
    testName: 'Income update propagates to Surplus (₹60,000)',
    expected: 60000,
    actual: mmAfterInc.body.data.monthly_surplus,
    status: mmAfterInc.body.data.monthly_surplus === 60000 ? 'PASS' : 'FAIL',
  });

  const croreAfterInc = await request(app)
    .get(`/api/v1/crore/status?month=${targetMonth}`)
    .set('Authorization', `Bearer ${goldenToken}`);
  const monthsAfterInc = croreAfterInc.body.data.calculation.base_case.months_to_target;
  record({
    phase: 'PHASE 7',
    testName: '₹1 Crore timeline shortened after income increase',
    expected: true,
    actual: monthsAfterInc < croreCalc.base_case.months_to_target,
    status: monthsAfterInc < croreCalc.base_case.months_to_target ? 'PASS' : 'FAIL',
  });

  // -------------------------------------------------------------
  // PHASE 8: NEGATIVE / DEFICIT / UNKNOWN DATA HANDLING
  // -------------------------------------------------------------
  console.log('\n--- PHASE 8: Negative / Deficit / Unknown Data ---');
  const UNCONFIGURED_USER = '77777777-7777-7777-7777-777777777777';
  testUserRoles.set(UNCONFIGURED_USER, 'USER');
  const canonicalUnconfigured = await canonicalFinanceService.getCanonicalFinancialState(UNCONFIGURED_USER, targetMonth);
  record({
    phase: 'PHASE 8',
    testName: 'Unconfigured user monthly_net_income is null',
    expected: null,
    actual: canonicalUnconfigured.income.monthly_net_income,
    status: canonicalUnconfigured.income.monthly_net_income === null ? 'PASS' : 'FAIL',
  });
  record({
    phase: 'PHASE 8',
    testName: 'Unconfigured user formatted income is UNKNOWN',
    expected: 'UNKNOWN',
    actual: canonicalUnconfigured.income.formatted_income,
    status: canonicalUnconfigured.income.formatted_income === 'UNKNOWN' ? 'PASS' : 'FAIL',
  });

  const DEFICIT_USER = '88888888-8888-8888-8888-888888888888';
  testUserRoles.set(DEFICIT_USER, 'USER');
  const deficitToken = `mock-test-token:${DEFICIT_USER}:deficit@example.com`;

  await request(app)
    .post('/api/v1/transactions')
    .set('Authorization', `Bearer ${deficitToken}`)
    .send({
      description: 'Part-time salary',
      amount: 50000,
      currency: 'INR',
      type: 'income',
      category: 'Salary',
      account: 'SBI Bank',
      date: `${targetMonth}-01`,
    });

  await request(app)
    .post('/api/v1/transactions')
    .set('Authorization', `Bearer ${deficitToken}`)
    .send({
      description: 'Rent and emergency expense',
      amount: 70000,
      currency: 'INR',
      type: 'expense',
      category: 'Medical',
      account: 'SBI Bank',
      date: `${targetMonth}-02`,
    });

  const mmDeficit = await request(app)
    .get(`/api/v1/transactions/summary/monthly?month=${targetMonth}`)
    .set('Authorization', `Bearer ${deficitToken}`);
  record({
    phase: 'PHASE 8',
    testName: 'Deficit calculation: Surplus is -₹20,000',
    expected: -20000,
    actual: mmDeficit.body.data.monthly_surplus,
    status: mmDeficit.body.data.monthly_surplus === -20000 ? 'PASS' : 'FAIL',
  });
  record({
    phase: 'PHASE 8',
    testName: 'Deficit calculation: Savings rate clamped to 0% (not negative)',
    expected: 0,
    actual: mmDeficit.body.data.savings_rate,
    status: mmDeficit.body.data.savings_rate === 0 ? 'PASS' : 'FAIL',
  });
  record({
    phase: 'PHASE 8',
    testName: 'Deficit calculation: is_deficit flag is true',
    expected: true,
    actual: mmDeficit.body.data.is_deficit,
    status: mmDeficit.body.data.is_deficit === true ? 'PASS' : 'FAIL',
  });

  const croreDeficit = await request(app)
    .get(`/api/v1/crore/status?month=${targetMonth}`)
    .set('Authorization', `Bearer ${deficitToken}`);
  record({
    phase: 'PHASE 8',
    testName: '₹1 Crore engine clamps monthly contribution to 0 when in deficit',
    expected: 0,
    actual: croreDeficit.body.data.calculation.current_monthly_contribution,
    status: croreDeficit.body.data.calculation.current_monthly_contribution === 0 ? 'PASS' : 'FAIL',
  });
  record({
    phase: 'PHASE 8',
    testName: '₹1 Crore target unreachable (months_to_target is null) when capital=0 and contribution=0',
    expected: null,
    actual: croreDeficit.body.data.calculation.base_case.months_to_target,
    status: croreDeficit.body.data.calculation.base_case.months_to_target === null ? 'PASS' : 'FAIL',
  });

  // -------------------------------------------------------------
  // PHASE 10: DETERMINISTIC MULTI-RUN CONSISTENCY
  // -------------------------------------------------------------
  console.log('\n--- PHASE 10: ₹1 Crore Engine Determinism ---');
  const croreStatus1 = await croreService.getUserCroreStatus(GOLDEN_USER, targetMonth);
  const croreStatus2 = await croreService.getUserCroreStatus(GOLDEN_USER, targetMonth);
  const croreStatus3 = await croreService.getUserCroreStatus(GOLDEN_USER, targetMonth);

  record({
    phase: 'PHASE 10',
    testName: 'Multi-run 1 vs 2 identical target date',
    expected: croreStatus1.calculation.base_case.target_date,
    actual: croreStatus2.calculation.base_case.target_date,
    status: croreStatus1.calculation.base_case.target_date === croreStatus2.calculation.base_case.target_date ? 'PASS' : 'FAIL',
  });
  record({
    phase: 'PHASE 10',
    testName: 'Multi-run 1 vs 3 identical projected corpus',
    expected: croreStatus1.calculation.base_case.projected_corpus_at_target,
    actual: croreStatus3.calculation.base_case.projected_corpus_at_target,
    status: croreStatus1.calculation.base_case.projected_corpus_at_target === croreStatus3.calculation.base_case.projected_corpus_at_target ? 'PASS' : 'FAIL',
  });

  // -------------------------------------------------------------
  // PHASE 12: ASK CA CONSISTENCY WITH DETERMINISTIC ENGINES
  // -------------------------------------------------------------
  console.log('\n--- PHASE 12: Ask CA Consistency Queries ---');
  const chatQueries = [
    { query: 'Mera monthly surplus kitna hai?', check: (ans: string) => ans.includes('60,000') || ans.includes('40,000') },
    { query: 'Main ₹1 crore kab banaunga?', check: (ans: string) => ans.toLowerCase().includes('crore') || ans.toLowerCase().includes('₹1') || ans.toLowerCase().includes('month') || ans.toLowerCase().includes('target') },
    { query: 'Meri savings rate kya hai?', check: (ans: string) => ans.includes('%') },
  ];

  for (const q of chatQueries) {
    const res = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${goldenToken}`)
      .send({ message: q.query });
    record({
      phase: 'PHASE 12',
      testName: `Ask CA Query: "${q.query}"`,
      expected: true,
      actual: res.status === 200 && q.check(res.body.data?.answer || ''),
      status: res.status === 200 && q.check(res.body.data?.answer || '') ? 'PASS' : 'FAIL',
      notes: res.body.data?.answer?.slice(0, 100),
    });
  }

  // -------------------------------------------------------------
  // PHASE 14: OCR CONSISTENCY (UNCONFIRMED VS CONFIRMED)
  // -------------------------------------------------------------
  console.log('\n--- PHASE 14: OCR Consistency ---');
  process.env.ENABLE_TEST_OCR_MOCK = 'true';
  const ocrDoc = await documentService.createDocumentMetadata(GOLDEN_USER, {
    file_name: 'test_receipt.pdf',
    file_type: 'pdf',
    file_size_bytes: 51200,
    mime_type: 'application/pdf',
    document_type: 'receipt',
    financial_year: '2026-27',
  });

  // Extract (draft)
  await request(app)
    .post(`/api/v1/ocr/extract/${ocrDoc.id}`)
    .set('Authorization', `Bearer ${goldenToken}`);

  // Check ledger income before confirmation (Must remain ₹1,20,000)
  const mmOcrBefore = await request(app)
    .get(`/api/v1/transactions/summary/monthly?month=${targetMonth}`)
    .set('Authorization', `Bearer ${goldenToken}`);
  record({
    phase: 'PHASE 14',
    testName: 'Unconfirmed OCR draft creates ZERO ledger changes',
    expected: 120000,
    actual: mmOcrBefore.body.data.total_income,
    status: mmOcrBefore.body.data.total_income === 120000 ? 'PASS' : 'FAIL',
  });

  // Confirm OCR transaction
  await request(app)
    .post('/api/v1/ocr/confirm')
    .set('Authorization', `Bearer ${goldenToken}`)
    .send({
      document_id: ocrDoc.id,
      reviewed_data: {
        transactions: [
          {
            date: `${targetMonth}-25`,
            description: 'Confirmed Dividend Payout',
            amount: 5000,
            direction: 'credit',
            category: 'dividend',
          },
        ],
      },
      import_target: 'transactions',
    });

  const mmOcrAfter = await request(app)
    .get(`/api/v1/transactions/summary/monthly?month=${targetMonth}`)
    .set('Authorization', `Bearer ${goldenToken}`);
  record({
    phase: 'PHASE 14',
    testName: 'Confirmed OCR propagates to ledger income (₹1,25,000)',
    expected: 125000,
    actual: mmOcrAfter.body.data.total_income,
    status: mmOcrAfter.body.data.total_income === 125000 ? 'PASS' : 'FAIL',
  });

  // -------------------------------------------------------------
  // PHASE 17: AUTHENTICATION & MULTI-USER ISOLATION
  // -------------------------------------------------------------
  console.log('\n--- PHASE 17: Multi-User Isolation ---');
  await request(app)
    .put('/api/v1/allocation/profile')
    .set('Authorization', `Bearer ${userBToken}`)
    .send({
      age: 42,
      monthly_income: 500000,
      monthly_essential_expenses: 150000,
      monthly_debt_obligations: 50000,
      existing_liquid_savings: 1000000,
      existing_investments: 5000000,
    });

  const profUserA = await request(app)
    .get('/api/v1/allocation/profile')
    .set('Authorization', `Bearer ${goldenToken}`);
  const profUserB = await request(app)
    .get('/api/v1/allocation/profile')
    .set('Authorization', `Bearer ${userBToken}`);

  record({
    phase: 'PHASE 17',
    testName: 'User A income is isolated from User B',
    expected: 100000,
    actual: profUserA.body.data.monthly_income,
    status: profUserA.body.data.monthly_income === 100000 ? 'PASS' : 'FAIL',
  });
  record({
    phase: 'PHASE 17',
    testName: 'User B income is isolated from User A',
    expected: 500000,
    actual: profUserB.body.data.monthly_income,
    status: profUserB.body.data.monthly_income === 500000 ? 'PASS' : 'FAIL',
  });

  console.log('\n================================================================');
  const passCount = auditLogs.filter((l) => l.status === 'PASS').length;
  const failCount = auditLogs.filter((l) => l.status === 'FAIL').length;
  const discCount = auditLogs.filter((l) => l.status === 'DISCREPANCY').length;

  console.log(`AUDIT COMPLETE: ${passCount} PASSED, ${failCount} FAILED, ${discCount} DISCREPANCIES DETECTED`);
  console.log('================================================================\n');

  if (failCount > 0 || discCount > 0) {
    console.log('DISCREPANCIES AND FAILURES DETECTED:');
    for (const d of auditLogs.filter((l) => l.status !== 'PASS')) {
      console.log(`- [${d.phase}] ${d.testName}`);
      console.log(`    Expected:`, JSON.stringify(d.expected));
      console.log(`    Actual:  `, JSON.stringify(d.actual));
      if (d.notes) console.log(`    Notes:   `, d.notes);
    }
  }
}

runAudit().catch((err) => {
  console.error('Audit crashed with error:', err);
  process.exit(1);
});
