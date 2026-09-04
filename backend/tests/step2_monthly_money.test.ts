import request from 'supertest';
import { createApp } from '../src/app.js';
import { testUserRoles } from '../src/middleware/auth.js';

const app = createApp();

const USER_1 = '11111111-1111-1111-1111-111111111111';
const USER_2 = '22222222-2222-2222-2222-222222222222';

testUserRoles.set(USER_1, 'USER');
testUserRoles.set(USER_2, 'USER');

const token1 = `mock-test-token:${USER_1}:user1@example.com`;
const token2 = `mock-test-token:${USER_2}:user2@example.com`;

async function runMonthlyMoneyTests() {
  console.log('=== RUNNING STEP 2: CORE MONTHLY MONEY SYSTEM TESTS ===\n');

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
    // TEST 1: Deterministic Monthly Calculation (₹70k Income, ₹45k Expenses)
    // ----------------------------------------------------------------------
    // Add ₹70,000 Salary
    const incRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        description: 'Tech Consulting Salary',
        amount: 70000,
        currency: 'INR',
        type: 'income',
        category: 'Salary',
        account: 'HDFC Bank',
        date: '2026-09-05',
      });
    assert(incRes.status === 201, 'TEST 1A: Recorded ₹70,000 income transaction', incRes.body);

    // Add ₹25,000 Rent
    const exp1 = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        description: 'House Rent',
        amount: 25000,
        currency: 'INR',
        type: 'expense',
        category: 'Rent',
        account: 'HDFC Bank',
        date: '2026-09-08',
      });
    assert(exp1.status === 201, 'TEST 1B: Recorded ₹25,000 Rent expense');

    // Add ₹15,000 Groceries
    const exp2 = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        description: 'Monthly Groceries & Supermarket',
        amount: 15000,
        currency: 'INR',
        type: 'expense',
        category: 'Groceries',
        account: 'Credit Card',
        date: '2026-09-12',
      });
    assert(exp2.status === 201, 'TEST 1C: Recorded ₹15,000 Groceries expense');

    // Add ₹5,000 Utilities
    const exp3 = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        description: 'Electricity & Internet Bills',
        amount: 5000,
        currency: 'INR',
        type: 'expense',
        category: 'Utilities',
        account: 'Primary Bank',
        date: '2026-09-15',
      });
    assert(exp3.status === 201, 'TEST 1D: Recorded ₹5,000 Utilities expense');

    // Fetch Monthly Summary for 2026-09
    const summaryRes1 = await request(app)
      .get('/api/v1/transactions/summary/monthly?month=2026-09')
      .set('Authorization', `Bearer ${token1}`);

    assert(summaryRes1.status === 200, 'TEST 1E: Monthly summary returned 200 OK', summaryRes1.body);
    const s1 = summaryRes1.body.data;

    assert(s1.total_income === 70000, `TEST 1F: total_income is ₹70,000 (got ${s1.total_income})`);
    assert(s1.total_expenses === 45000, `TEST 1G: total_expenses is ₹45,000 (got ${s1.total_expenses})`);
    assert(s1.monthly_surplus === 25000, `TEST 1H: monthly_surplus is ₹25,000 (got ${s1.monthly_surplus})`);
    assert(s1.savings_rate === 35.71, `TEST 1I: savings_rate is deterministic 35.71% (got ${s1.savings_rate})`);
    assert(s1.total_transfers === 0, 'TEST 1J: total_transfers is 0');
    assert(s1.transaction_count.income === 1, 'TEST 1K: income transaction count is 1');
    assert(s1.transaction_count.expenses === 3, 'TEST 1L: expense transaction count is 3');

    // ----------------------------------------------------------------------
    // TEST 2: Account Transfers Excluded from Income & Expenses
    // ----------------------------------------------------------------------
    const transferRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        description: 'Transfer to Emergency Fund',
        amount: 15000,
        currency: 'INR',
        type: 'transfer',
        category: 'Savings Transfer',
        account: 'HDFC to ICICI',
        date: '2026-09-18',
      });
    assert(transferRes.status === 201, 'TEST 2A: Recorded ₹15,000 transfer');

    const summaryRes2 = await request(app)
      .get('/api/v1/transactions/summary/monthly?month=2026-09')
      .set('Authorization', `Bearer ${token1}`);
    const s2 = summaryRes2.body.data;

    assert(s2.total_income === 70000, `TEST 2B: Transfer excluded from total_income (still 70,000, got ${s2.total_income})`);
    assert(s2.total_expenses === 45000, `TEST 2C: Transfer excluded from total_expenses (still 45,000, got ${s2.total_expenses})`);
    assert(s2.monthly_surplus === 25000, `TEST 2D: Transfer excluded from monthly_surplus (still 25,000, got ${s2.monthly_surplus})`);
    assert(s2.savings_rate === 35.71, `TEST 2E: Transfer excluded from savings_rate (still 35.71%, got ${s2.savings_rate})`);
    assert(s2.total_transfers === 15000, `TEST 2F: total_transfers properly tracked as ₹15,000 (got ${s2.total_transfers})`);
    assert(s2.transaction_count.transfers === 1, 'TEST 2G: transfer transaction count is 1');
    assert(s2.transaction_count.total === 5, 'TEST 2H: total transaction count is 5');

    // ----------------------------------------------------------------------
    // TEST 3: Category Breakdown & Largest Expense Category
    // ----------------------------------------------------------------------
    assert(Array.isArray(s2.categories) && s2.categories.length === 3, 'TEST 3A: Exactly 3 expense categories returned');
    assert(s2.largest_expense_category !== null, 'TEST 3B: largest_expense_category is present');
    assert(s2.largest_expense_category.category === 'Rent', `TEST 3C: largest_expense_category is Rent (got ${s2.largest_expense_category?.category})`);
    assert(s2.largest_expense_category.amount === 25000, `TEST 3D: largest_expense_category amount is 25000 (got ${s2.largest_expense_category?.amount})`);
    assert(s2.largest_expense_category.percentage === 55.56, `TEST 3E: largest_expense_category percentage is 55.56% (got ${s2.largest_expense_category?.percentage})`);

    const groceriesCat = s2.categories.find((c: any) => c.category === 'Groceries');
    assert(groceriesCat && groceriesCat.amount === 15000 && groceriesCat.percentage === 33.33,
      `TEST 3F: Groceries breakdown is ₹15,000 (33.33%), got ${JSON.stringify(groceriesCat)}`);

    const utilitiesCat = s2.categories.find((c: any) => c.category === 'Utilities');
    assert(utilitiesCat && utilitiesCat.amount === 5000 && utilitiesCat.percentage === 11.11,
      `TEST 3G: Utilities breakdown is ₹5,000 (11.11%), got ${JSON.stringify(utilitiesCat)}`);

    // ----------------------------------------------------------------------
    // TEST 4: Month Boundary Date Filtering
    // ----------------------------------------------------------------------
    // Add tx on Aug 31 (previous month)
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        description: 'August Last Day Expense',
        amount: 8000,
        currency: 'INR',
        type: 'expense',
        category: 'Shopping',
        date: '2026-08-31',
      });

    // Add tx on Oct 1 (next month)
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        description: 'October First Day Expense',
        amount: 9000,
        currency: 'INR',
        type: 'expense',
        category: 'Shopping',
        date: '2026-10-01',
      });

    const boundaryRes = await request(app)
      .get('/api/v1/transactions/summary/monthly?month=2026-09')
      .set('Authorization', `Bearer ${token1}`);
    const sb = boundaryRes.body.data;
    assert(sb.total_expenses === 45000, `TEST 4A: Boundary transactions outside 2026-09 strictly ignored (total_expenses is ${sb.total_expenses})`);

    // Check August summary
    const augRes = await request(app)
      .get('/api/v1/transactions/summary/monthly?month=2026-08')
      .set('Authorization', `Bearer ${token1}`);
    assert(augRes.body.data.total_expenses === 8000, `TEST 4B: August contains the ₹8,000 expense`);

    // ----------------------------------------------------------------------
    // TEST 5: Zero Income & Deficit Handling
    // ----------------------------------------------------------------------
    // For USER 2: create an expense with 0 income
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token2}`)
      .send({
        description: 'Unplanned Expense',
        amount: 10000,
        currency: 'INR',
        type: 'expense',
        category: 'Medical',
        date: '2026-09-02',
      });

    const u2Summary1 = await request(app)
      .get('/api/v1/transactions/summary/monthly?month=2026-09')
      .set('Authorization', `Bearer ${token2}`);
    const u2s1 = u2Summary1.body.data;

    assert(u2s1.total_income === 0, 'TEST 5A: User 2 total_income is 0');
    assert(u2s1.total_expenses === 10000, 'TEST 5B: User 2 total_expenses is 10,000');
    assert(u2s1.monthly_surplus === -10000, `TEST 5C: User 2 monthly_surplus is -10,000 (deficit), got ${u2s1.monthly_surplus}`);
    assert(u2s1.savings_rate === 0, `TEST 5D: Zero income gives 0% savings rate (no NaN/division by zero), got ${u2s1.savings_rate}`);

    // Now give User 2 Income: 30,000 and Expenses: 45,000 (adding 35k more expenses)
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token2}`)
      .send({
        description: 'Freelance Inflow',
        amount: 30000,
        currency: 'INR',
        type: 'income',
        category: 'Freelance',
        date: '2026-09-04',
      });

    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token2}`)
      .send({
        description: 'Additional Outflow',
        amount: 35000,
        currency: 'INR',
        type: 'expense',
        category: 'Equipment',
        date: '2026-09-10',
      });

    const u2Summary2 = await request(app)
      .get('/api/v1/transactions/summary/monthly?month=2026-09')
      .set('Authorization', `Bearer ${token2}`);
    const u2s2 = u2Summary2.body.data;

    assert(u2s2.total_income === 30000, 'TEST 5E: User 2 income is 30,000');
    assert(u2s2.total_expenses === 45000, 'TEST 5F: User 2 expenses is 45,000');
    assert(u2s2.monthly_surplus === -15000, `TEST 5G: User 2 surplus is -15,000 (got ${u2s2.monthly_surplus})`);
    assert(u2s2.savings_rate === -50, `TEST 5H: User 2 savings rate is -50.00% (got ${u2s2.savings_rate})`);

    // ----------------------------------------------------------------------
    // TEST 6: Strict Amount & Query Validation
    // ----------------------------------------------------------------------
    const zeroAmtRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        description: 'Zero Amount Item',
        amount: 0,
        currency: 'INR',
        type: 'expense',
        date: '2026-09-10',
      });
    assert(zeroAmtRes.status === 400, 'TEST 6A: Amount = 0 is rejected with 400 Bad Request');

    const negAmtRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        description: 'Negative Amount Item',
        amount: -500,
        currency: 'INR',
        type: 'expense',
        date: '2026-09-10',
      });
    assert(negAmtRes.status === 400, 'TEST 6B: Amount < 0 is rejected with 400 Bad Request');

    const nanAmtRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        description: 'NaN Amount Item',
        amount: NaN,
        currency: 'INR',
        type: 'expense',
        date: '2026-09-10',
      });
    assert(nanAmtRes.status === 400, 'TEST 6C: NaN amount is rejected with 400 Bad Request');

    const invalidMonthRes = await request(app)
      .get('/api/v1/transactions/summary/monthly?month=2026-13')
      .set('Authorization', `Bearer ${token1}`);
    assert(invalidMonthRes.status === 400, 'TEST 6D: Month 2026-13 (out of range 01-12) rejected with 400 Bad Request');

    const badFormatMonth = await request(app)
      .get('/api/v1/transactions/summary/monthly?month=september-2026')
      .set('Authorization', `Bearer ${token1}`);
    assert(badFormatMonth.status === 400, 'TEST 6E: Invalid month string format rejected with 400 Bad Request');

    // ----------------------------------------------------------------------
    // TEST 7: Cross-User Data Isolation
    // ----------------------------------------------------------------------
    assert(s2.total_income === 70000, 'TEST 7A: User 1 summary unaffected by User 2 transactions');
    const u1List = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${token1}`);
    const u1HasU2 = u1List.body.data.some((tx: any) => tx.description === 'Unplanned Expense');
    assert(!u1HasU2, 'TEST 7B: User 1 cannot see User 2 transactions in list');

    // ----------------------------------------------------------------------
    // TEST 8: Update & Delete Lifecycle Recalculates Summary
    // ----------------------------------------------------------------------
    const rentId = exp1.body.data.id;
    // Update rent from 25,000 to 35,000
    const updateRentRes = await request(app)
      .put(`/api/v1/transactions/${rentId}`)
      .set('Authorization', `Bearer ${token1}`)
      .send({
        amount: 35000,
      });
    assert(updateRentRes.status === 200, 'TEST 8A: Rent updated to ₹35,000');

    const afterUpdateSummary = await request(app)
      .get('/api/v1/transactions/summary/monthly?month=2026-09')
      .set('Authorization', `Bearer ${token1}`);
    const su = afterUpdateSummary.body.data;
    // 70000 income, expenses: 35000 + 15000 + 5000 = 55000. Surplus: 15000. Savings rate: 15000/70000*100 = 21.43%
    assert(su.total_expenses === 55000, `TEST 8B: Total expenses updated to ₹55,000 (got ${su.total_expenses})`);
    assert(su.monthly_surplus === 15000, `TEST 8C: Monthly surplus updated to ₹15,000 (got ${su.monthly_surplus})`);
    assert(su.savings_rate === 21.43, `TEST 8D: Savings rate updated to 21.43% (got ${su.savings_rate})`);

    // Now delete the rent transaction
    const delRes = await request(app)
      .delete(`/api/v1/transactions/${rentId}`)
      .set('Authorization', `Bearer ${token1}`);
    assert(delRes.status === 200, 'TEST 8E: Rent transaction deleted successfully');

    const afterDeleteSummary = await request(app)
      .get('/api/v1/transactions/summary/monthly?month=2026-09')
      .set('Authorization', `Bearer ${token1}`);
    const sd = afterDeleteSummary.body.data;
    // 70000 income, expenses: 15000 + 5000 = 20000. Surplus: 50000. Savings rate: 50000/70000*100 = 71.43%
    assert(sd.total_expenses === 20000, `TEST 8F: Total expenses after deletion is ₹20,000 (got ${sd.total_expenses})`);
    assert(sd.monthly_surplus === 50000, `TEST 8G: Monthly surplus after deletion is ₹50,000 (got ${sd.monthly_surplus})`);
    assert(sd.savings_rate === 71.43, `TEST 8H: Savings rate after deletion is 71.43% (got ${sd.savings_rate})`);

  } catch (err: any) {
    console.error('Fatal error during test run:', err);
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runMonthlyMoneyTests();
