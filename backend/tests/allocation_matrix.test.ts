import {
  allocateMonthlySurplus,
  calculateEmergencyFund,
} from '../src/modules/allocation/allocation.engine.js';
import { FinancialProfile, FinancialGoal } from '../src/modules/allocation/allocation.schema.js';

async function runAllocationMatrixTests() {
  console.log('=== RUNNING PHASE 18: SAVINGS ALLOCATION MATRIX TESTS ===\n');

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

  const sampleGoal: FinancialGoal = {
    id: 'g-1',
    user_id: 'u-1',
    title: 'Down Payment',
    target_amount: 500000,
    current_amount: 50000,
    target_date: '2028-12',
    category: 'house',
    priority: 'high',
    status: 'active',
    monthly_target_contribution: 10000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const month = '2026-10';

  // --------------------------------------------------------------------------
  // CASE 1: Positive Surplus + Incomplete Emergency Fund
  // --------------------------------------------------------------------------
  const profileIncompleteEmergency: FinancialProfile = {
    user_id: 'u-1',
    monthly_income: 100000,
    monthly_essential_expenses: 40000,
    existing_liquid_savings: 50000, // Target: 40k * 6 = 240k -> 190k gap
    emergency_fund_target_months: 6,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const result1 = allocateMonthlySurplus(
    month,
    100000,
    60000, // surplus = 40,000
    profileIncompleteEmergency,
    [sampleGoal]
  );

  assert(result1.monthly_surplus === 40000, 'CASE 1A: Surplus is 40,000');
  assert(result1.emergency_fund.is_complete === false, 'CASE 1B: Emergency fund is flagged as incomplete');
  assert(result1.allocations.emergency_fund > 0, 'CASE 1C: Emergency fund receives positive allocation');
  assert(result1.allocations.emergency_fund === 20000, 'CASE 1D: Emergency fund receives 50% priority (20,000)', result1.allocations);
  assert(result1.allocations.total_allocated === 40000, 'CASE 1E: Invariant holds: total_allocated === monthly_surplus');

  // --------------------------------------------------------------------------
  // CASE 2: Positive Surplus + Complete Emergency Fund
  // --------------------------------------------------------------------------
  const profileCompleteEmergency: FinancialProfile = {
    user_id: 'u-2',
    monthly_income: 100000,
    monthly_essential_expenses: 40000,
    existing_liquid_savings: 300000, // 300k >= 240k target
    emergency_fund_target_months: 6,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const result2 = allocateMonthlySurplus(
    month,
    100000,
    50000, // surplus = 50,000
    profileCompleteEmergency,
    [sampleGoal]
  );

  assert(result2.emergency_fund.is_complete === true, 'CASE 2A: Emergency fund is flagged complete');
  assert(result2.allocations.emergency_fund === 0, 'CASE 2B: Emergency fund receives 0 allocation when complete');
  assert(result2.allocations.goals > 0, 'CASE 2C: Goals receive positive allocation');
  assert(result2.allocations.long_term_wealth > 0, 'CASE 2D: Long term wealth receives positive allocation');
  assert(result2.allocations.total_allocated === 50000, 'CASE 2E: Invariant holds: total_allocated === monthly_surplus');

  // --------------------------------------------------------------------------
  // CASE 3: Zero Surplus
  // --------------------------------------------------------------------------
  const result3 = allocateMonthlySurplus(
    month,
    50000,
    50000, // surplus = 0
    profileIncompleteEmergency,
    [sampleGoal]
  );

  assert(result3.monthly_surplus === 0, 'CASE 3A: Surplus is 0');
  assert(result3.allocations.emergency_fund === 0, 'CASE 3B: Emergency fund allocation is 0');
  assert(result3.allocations.goals === 0, 'CASE 3C: Goals total allocation is 0');
  assert(result3.allocations.long_term_wealth === 0, 'CASE 3D: Long term wealth allocation is 0');
  assert(result3.allocations.total_allocated === 0, 'CASE 3E: Invariant holds: total_allocated === 0');

  // --------------------------------------------------------------------------
  // CASE 4: Negative Surplus (Deficit)
  // --------------------------------------------------------------------------
  const result4 = allocateMonthlySurplus(
    month,
    50000,
    70000, // surplus = -20,000
    profileIncompleteEmergency,
    [sampleGoal]
  );

  assert(result4.monthly_surplus === -20000, 'CASE 4A: Surplus is negative (-20,000)');
  assert(result4.is_deficit === true, 'CASE 4B: Deficit flag is true');
  assert(result4.allocations.emergency_fund === 0, 'CASE 4C: No savings allocated in deficit');
  assert(result4.allocations.goals === 0, 'CASE 4D: No goal funding in deficit');
  assert(result4.allocations.total_allocated === 0, 'CASE 4E: Total allocated is strictly 0 in deficit');

  // --------------------------------------------------------------------------
  // CASE 5: High Debt Obligations Handling
  // --------------------------------------------------------------------------
  const profileWithDebt: FinancialProfile = {
    user_id: 'u-5',
    monthly_income: 100000,
    monthly_essential_expenses: 30000,
    monthly_debt_obligations: 20000,
    existing_liquid_savings: 200000,
    emergency_fund_target_months: 6,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const result5 = allocateMonthlySurplus(
    month,
    100000,
    70000, // surplus = 30,000
    profileWithDebt,
    [sampleGoal]
  );

  assert(result5.monthly_surplus === 30000, 'CASE 5A: Surplus accounts for debt within expenses');
  assert(result5.allocations.total_allocated === 30000, 'CASE 5B: Invariant holds with debt profile (total === 30,000)');

  console.log(`\n========================================`);
  console.log(`ALLOCATION MATRIX: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAllocationMatrixTests();
