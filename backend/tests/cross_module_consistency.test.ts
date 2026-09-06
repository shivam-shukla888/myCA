import request from 'supertest';
import { createApp } from '../src/app.js';
import { testUserRoles } from '../src/middleware/auth.js';
import { ocrService } from '../src/modules/ocr/ocr.service.js';
import { getOCRProvider } from '../src/modules/ocr/ocr.provider.js';
import { documentService } from '../src/modules/documents/document.service.js';

const app = createApp();

const TEST_USER = '44444444-4444-4444-4444-444444444444';
testUserRoles.set(TEST_USER, 'USER');
const token = `mock-test-token:${TEST_USER}:consistency@example.com`;

async function runCrossModuleConsistencyTests() {
  console.log('=== RUNNING PHASE 16: CROSS-MODULE DATA CONSISTENCY INTEGRATION TESTS ===\n');

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

  const targetMonth = '2026-10';

  // 1. Initial State: Set up User Financial Profile
  const profRes = await request(app)
    .put('/api/v1/allocation/profile')
    .set('Authorization', `Bearer ${token}`)
    .send({
      age: 29,
      monthly_income: 80000,
      monthly_essential_expenses: 45000,
      existing_liquid_savings: 150000,
      existing_investments: 500000, // ₹5L
      monthly_debt_obligations: 5000,
      emergency_fund_target_months: 6,
    });
  assert(profRes.status === 200, 'STEP 1: Stated financial profile created (200 OK)', profRes.body);

  // 2. Initial ₹1 Crore Projection based on Profile Baseline
  const croreInitialRes = await request(app)
    .get(`/api/v1/crore/status?month=${targetMonth}`)
    .set('Authorization', `Bearer ${token}`);
  assert(croreInitialRes.status === 200, 'STEP 2A: ₹1 Cr status retrieved (200 OK)');
  const initialCrore = croreInitialRes.body.data.calculation;
  assert(initialCrore.starting_capital === 500000, 'STEP 2B: Starting capital matches ₹5L profile investments', initialCrore.starting_capital);
  const initialTargetDate = initialCrore.base_case.target_date;
  const initialBaseMonths = initialCrore.base_case.months_to_target;
  assert(initialBaseMonths > 0, `STEP 2C: Initial projection calculated (${initialTargetDate}, ${initialBaseMonths} months)`);

  // 3. Record Actual Ledger Income (₹1,00,000 Salary) & Expenses (₹50,000)
  const txInc = await request(app)
    .post('/api/v1/transactions')
    .set('Authorization', `Bearer ${token}`)
    .send({
      description: 'October Tech Salary',
      amount: 100000,
      currency: 'INR',
      type: 'income',
      category: 'Salary',
      account: 'ICICI Bank',
      date: '2026-10-05',
    });
  assert(txInc.status === 201, 'STEP 3A: Recorded ₹1,00,000 income transaction');

  const txExp = await request(app)
    .post('/api/v1/transactions')
    .set('Authorization', `Bearer ${token}`)
    .send({
      description: 'October Rent & Living',
      amount: 50000,
      currency: 'INR',
      type: 'expense',
      category: 'Housing',
      account: 'ICICI Bank',
      date: '2026-10-06',
    });
  assert(txExp.status === 201, 'STEP 3B: Recorded ₹50,000 expense transaction');

  // 4. Verify Monthly Money Engine Updated
  const mmRes = await request(app)
    .get(`/api/v1/transactions/summary/monthly?month=${targetMonth}`)
    .set('Authorization', `Bearer ${token}`);
  assert(mmRes.status === 200, 'STEP 4A: Monthly Money returns 200 OK');
  assert(mmRes.body.data.total_income === 100000, 'STEP 4B: Monthly Money total_income updated to ₹1,00,000');
  assert(mmRes.body.data.total_expenses === 50000, 'STEP 4C: Monthly Money total_expenses updated to ₹50,000');
  assert(mmRes.body.data.monthly_surplus === 50000, 'STEP 4D: Monthly Money surplus updated to ₹50,000 (100k - 50k)');
  assert(mmRes.body.data.savings_rate === 50, 'STEP 4E: Monthly Money savings rate is 50.00%');

  // 5. Verify Savings Allocation Reflects the Updated Actual Surplus
  const allocRes = await request(app)
    .post('/api/v1/allocation/plans/generate')
    .set('Authorization', `Bearer ${token}`)
    .send({ month: targetMonth });
  assert(allocRes.status === 201, 'STEP 5A: Allocation Plan generated (201 Created)');
  assert(allocRes.body.data.monthly_income === 100000, 'STEP 5B: Allocation uses verified ₹1,00,000 income');
  assert(allocRes.body.data.monthly_expenses === 50000, 'STEP 5C: Allocation uses verified ₹50,000 expenses');
  assert(allocRes.body.data.monthly_surplus === 50000, 'STEP 5D: Allocation uses verified ₹50,000 surplus');
  assert(allocRes.body.data.allocations.total_allocated === 50000, 'STEP 5E: Allocation total equals surplus ₹50,000 (Invariant Holds)');

  // 6. Verify ₹1 Crore Engine Updated with New Higher Surplus
  const croreUpdatedRes = await request(app)
    .get(`/api/v1/crore/status?month=${targetMonth}`)
    .set('Authorization', `Bearer ${token}`);
  assert(croreUpdatedRes.status === 200, 'STEP 6A: ₹1 Cr status retrieved after income increase');
  const updatedCrore = croreUpdatedRes.body.data.calculation;
  assert(updatedCrore.current_monthly_contribution > 0, 'STEP 6B: Monthly investment contribution is positive');
  assert(
    updatedCrore.base_case.months_to_target! < initialBaseMonths,
    `STEP 6C: Timeline shortened with higher surplus (${updatedCrore.base_case.months_to_target} months vs ${initialBaseMonths} months)`,
    { before: initialBaseMonths, after: updatedCrore.base_case.months_to_target }
  );

  // 7. Verify Ask CA Receives the Synchronized Context
  const chatRes = await request(app)
    .post('/api/v1/chat')
    .set('Authorization', `Bearer ${token}`)
    .send({
      message: 'Mera surplus kitna hai aur 1 crore kab tak hoga?',
    });
  assert(chatRes.status === 200, 'STEP 7A: Ask CA responds with 200 OK');
  assert(chatRes.body.data.answer.includes('50,000'), 'STEP 7B: Ask CA quotes exact verified surplus ₹50,000');
  assert(chatRes.body.data.deterministic_calculations?.surplus === 50000, 'STEP 7C: Deterministic calculations include surplus 50,000');

  // 8. OCR Transaction Extraction: Unconfirmed draft creates ZERO ledger changes
  process.env.ENABLE_TEST_OCR_MOCK = 'true';
  const aliceDoc = await documentService.createDocumentMetadata(TEST_USER, {
    file_name: 'bank_statement_october.pdf',
    file_type: 'pdf',
    file_size_bytes: 102400,
    mime_type: 'application/pdf',
    document_type: 'bank_statement',
    financial_year: '2026-27',
  });
  const docId = aliceDoc.id;

  // Extract OCR (Draft Ready)
  const extractRes = await request(app)
    .post(`/api/v1/ocr/extract/${docId}`)
    .set('Authorization', `Bearer ${token}`);
  assert(extractRes.status === 200, 'STEP 8A: OCR extraction produced draft');

  // Verify Ledger has NOT changed yet
  const mmCheck = await request(app)
    .get(`/api/v1/transactions/summary/monthly?month=${targetMonth}`)
    .set('Authorization', `Bearer ${token}`);
  assert(mmCheck.body.data.total_income === 100000, 'STEP 8B: Unconfirmed OCR draft created ZERO ledger income (Still ₹100,000)');

  // 9. OCR Transaction Confirmation: Ledger changes and dependent calculations update
  const confirmRes = await request(app)
    .post('/api/v1/ocr/confirm')
    .set('Authorization', `Bearer ${token}`)
    .send({
      document_id: docId,
      reviewed_data: {
        transactions: [
          {
            date: `${targetMonth}-20`,
            description: 'Consulting Honorarium Bonus',
            amount: 25000,
            direction: 'credit',
            category: 'freelance',
          },
        ],
      },
      import_target: 'transactions',
    });
  assert(confirmRes.status === 200, 'STEP 9A: Confirmed OCR document into ledger');

  // Ledger must now include the imported transaction
  const mmAfterOcr = await request(app)
    .get(`/api/v1/transactions/summary/monthly?month=${targetMonth}`)
    .set('Authorization', `Bearer ${token}`);
  assert(mmAfterOcr.body.data.total_income === 125000, `STEP 9B: Confirmed OCR increased ledger total income to ₹1,25,000 (now ₹${mmAfterOcr.body.data.total_income})`);

  console.log(`\n========================================`);
  console.log(`CROSS-MODULE CONSISTENCY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runCrossModuleConsistencyTests();
