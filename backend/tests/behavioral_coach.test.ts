import {
  analyzeBehavioralDimensions,
  validateGuardrails,
  BehavioralEngineInput,
  MonthlyFinancialSummary,
  TransactionRecord,
} from '../src/modules/behavioral/behavioral.engine.js';
import { BEHAVIORAL_DIMENSIONS } from '../src/modules/behavioral/behavioral.schema.js';

async function runBehavioralCoachTests() {
  console.log('=== RUNNING BEHAVIORAL FINANCE COACH DETERMINISTIC TESTS ===\n');

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

  // -----------------------------------------------------------------------------------------------
  // SUITE 1: ETHICAL GUARDRAILS VALIDATOR
  // -----------------------------------------------------------------------------------------------
  assert(validateGuardrails('Review your largest dining transactions before updating your budget.'), 'TEST 1A: Constructive guidance passes guardrails');
  assert(!validateGuardrails('This is a clinical depression symptom and you are a compulsive spender.'), 'TEST 1B: Clinical mental health diagnosis is strictly rejected');
  assert(!validateGuardrails('You should feel shameful and irresponsible for this reckless purchase.'), 'TEST 1C: Shaming language is strictly rejected');
  assert(!validateGuardrails('Your finances will be a total catastrophe and you will be bankrupt.'), 'TEST 1D: Fear-mongering is strictly rejected');
  assert(!validateGuardrails('You are guilty of wasted money.'), 'TEST 1E: Guilt-inducing phrasing is strictly rejected');
  assert(!validateGuardrails('Act now before it is too late, you are running out of time!'), 'TEST 1F: Manufactured urgency is strictly rejected');

  // -----------------------------------------------------------------------------------------------
  // SUITE 2: INSUFFICIENT DATA TESTS (Zero & Minimal Data)
  // -----------------------------------------------------------------------------------------------
  const emptyInput: BehavioralEngineInput = {
    currentMonth: {
      month: '2026-09',
      income: 0,
      essential_expenses: 0,
      discretionary_expenses: 0,
      total_expenses: 0,
      surplus: 0,
      transactions: [],
    },
    previousMonths: [],
    goals: [],
  };

  const emptyReport = analyzeBehavioralDimensions(emptyInput);
  assert(emptyReport.overall_status === 'INSUFFICIENT_EVIDENCE', 'TEST 2A: Fresh user with 0 transactions returns INSUFFICIENT_EVIDENCE overall');
  assert(emptyReport.insufficient_dimensions_count === 8, 'TEST 2B: All 8 dimensions report INSUFFICIENT_EVIDENCE when no data exists', emptyReport.insufficient_dimensions_count);
  assert(emptyReport.sufficient_dimensions_count === 0, 'TEST 2C: Zero dimensions report sufficient data without inputs');

  for (const dim of BEHAVIORAL_DIMENSIONS) {
    const item = emptyReport.dimensions[dim];
    assert(item.status === 'INSUFFICIENT_EVIDENCE', `TEST 2D [${dim}]: Status is INSUFFICIENT_EVIDENCE on empty profile`);
    assert(item.confidence === 'INSUFFICIENT', `TEST 2E [${dim}]: Confidence is INSUFFICIENT on empty profile`);
    assert(item.guardrails_passed === true, `TEST 2F [${dim}]: Insufficient data fallback message satisfies ethical guardrails`);
  }

  // Minimal data: 2 transactions only (below thresholds)
  const minimalInput: BehavioralEngineInput = {
    currentMonth: {
      month: '2026-09',
      income: 60000,
      essential_expenses: 30000,
      discretionary_expenses: 5000,
      total_expenses: 35000,
      surplus: 25000,
      transactions: [
        { id: '1', amount: 3000, type: 'expense', category: 'Groceries', date: '2026-09-02' },
        { id: '2', amount: 2000, type: 'expense', category: 'Electricity', date: '2026-09-05' },
      ],
    },
    previousMonths: [],
    goals: [],
  };

  const minimalReport = analyzeBehavioralDimensions(minimalInput);
  assert(minimalReport.dimensions.SPENDING_CHANGES.status === 'INSUFFICIENT_EVIDENCE', 'TEST 3A: SPENDING_CHANGES returns INSUFFICIENT_EVIDENCE without prior month');
  assert(minimalReport.dimensions.LIFESTYLE_INFLATION.status === 'INSUFFICIENT_EVIDENCE', 'TEST 3B: LIFESTYLE_INFLATION returns INSUFFICIENT_EVIDENCE without prior month');
  assert(minimalReport.dimensions.IMPULSE_SPENDING.status === 'INSUFFICIENT_EVIDENCE', 'TEST 3C: IMPULSE_SPENDING returns INSUFFICIENT_EVIDENCE with < 8 transactions');
  assert(minimalReport.dimensions.DECISION_FATIGUE.status === 'INSUFFICIENT_EVIDENCE', 'TEST 3D: DECISION_FATIGUE returns INSUFFICIENT_EVIDENCE with < 10 transactions');
  assert(minimalReport.dimensions.EMOTIONAL_SPENDING.status === 'INSUFFICIENT_EVIDENCE', 'TEST 3E: EMOTIONAL_SPENDING returns INSUFFICIENT_EVIDENCE with < 10 transactions');
  assert(minimalReport.dimensions.GOAL_FATIGUE.status === 'INSUFFICIENT_EVIDENCE', 'TEST 3F: GOAL_FATIGUE returns INSUFFICIENT_EVIDENCE with 0 active goals');

  // -----------------------------------------------------------------------------------------------
  // SUITE 3: MISLEADING CORRELATIONS PROTECTION
  // -----------------------------------------------------------------------------------------------

  // 3.1: One-Off Large Tax Payment should NOT be classified as lifestyle habit shift
  const oneOffTaxInput: BehavioralEngineInput = {
    currentMonth: {
      month: '2026-09',
      income: 100000,
      essential_expenses: 40000,
      discretionary_expenses: 15000,
      total_expenses: 95000, // +₹40k increase due to advance tax
      surplus: 5000,
      transactions: [
        { id: '1', amount: 35000, type: 'expense', category: 'Advance Income Tax', date: '2026-09-15', description: 'Advance Tax Q2' },
        { id: '2', amount: 5000, type: 'expense', category: 'Groceries', date: '2026-09-02' },
        { id: '3', amount: 4000, type: 'expense', category: 'Utilities', date: '2026-09-05' },
        { id: '4', amount: 3000, type: 'expense', category: 'Dining', date: '2026-09-08' },
      ],
    },
    previousMonths: [{
      month: '2026-08',
      income: 100000,
      essential_expenses: 40000,
      discretionary_expenses: 15000,
      total_expenses: 55000,
      surplus: 45000,
    }],
    goals: [],
  };

  const taxReport = analyzeBehavioralDimensions(oneOffTaxInput);
  const spendingChangeInsight = taxReport.dimensions.SPENDING_CHANGES;
  assert(spendingChangeInsight.flagged_misleading_correlation === true, 'TEST 4A: SPENDING_CHANGES correctly flags advance tax as misleading correlation');
  assert(spendingChangeInsight.interpretation.includes('Advance Income Tax'), 'TEST 4B: Interpretation explicitly identifies Advance Income Tax rather than lifestyle creep', spendingChangeInsight.interpretation);

  // 3.2: Essential Inflation (Rent increase) when Income Increases should NOT be called Lifestyle Inflation
  const rentHikeInput: BehavioralEngineInput = {
    currentMonth: {
      month: '2026-09',
      income: 120000, // +₹20k income
      essential_expenses: 60000, // +₹15k rent increase
      discretionary_expenses: 20000, // unchanged
      total_expenses: 80000,
      surplus: 40000,
      transactions: [
        { id: '1', amount: 45000, type: 'expense', category: 'Rent', date: '2026-09-01' },
        { id: '2', amount: 5000, type: 'expense', category: 'Groceries', date: '2026-09-03' },
        { id: '3', amount: 3000, type: 'expense', category: 'Utilities', date: '2026-09-07' },
      ],
    },
    previousMonths: [{
      month: '2026-08',
      income: 100000,
      essential_expenses: 45000,
      discretionary_expenses: 20000,
      total_expenses: 65000,
      surplus: 35000,
    }],
    goals: [],
  };

  const rentReport = analyzeBehavioralDimensions(rentHikeInput);
  const lifestyleInsight = rentReport.dimensions.LIFESTYLE_INFLATION;
  assert(lifestyleInsight.flagged_misleading_correlation === true, 'TEST 4C: Essential rent increase is flagged as misleading correlation rather than lifestyle inflation');
  assert(lifestyleInsight.interpretation.includes('essential living costs'), 'TEST 4D: Interpretation notes essential living costs rather than discretionary creep');

  // 3.3: Routine Daily Essentials (Milk/Groceries/Medicine) should NOT be called Impulse Spending
  const dailyGroceryInput: BehavioralEngineInput = {
    currentMonth: {
      month: '2026-09',
      income: 80000,
      essential_expenses: 30000,
      discretionary_expenses: 8000,
      total_expenses: 38000,
      surplus: 42000,
      transactions: [
        { id: '1', amount: 150, type: 'expense', category: 'Food', date: '2026-09-01', description: 'Milk delivery' },
        { id: '2', amount: 200, type: 'expense', category: 'Food', date: '2026-09-02', description: 'Daily milk' },
        { id: '3', amount: 300, type: 'expense', category: 'Food', date: '2026-09-03', description: 'Grocery vegetables' },
        { id: '4', amount: 450, type: 'expense', category: 'Food', date: '2026-09-04', description: 'Pharmacy medicine' },
        { id: '5', amount: 180, type: 'expense', category: 'Food', date: '2026-09-05', description: 'Milk' },
        { id: '6', amount: 220, type: 'expense', category: 'Food', date: '2026-09-06', description: 'Daily bread' },
        { id: '7', amount: 500, type: 'expense', category: 'Food', date: '2026-09-07', description: 'Grocery items' },
        { id: '8', amount: 350, type: 'expense', category: 'Food', date: '2026-09-08', description: 'Medicine' },
        { id: '9', amount: 2000, type: 'expense', category: 'Utilities', date: '2026-09-09' },
      ],
    },
    previousMonths: [],
    goals: [],
  };

  const groceryReport = analyzeBehavioralDimensions(dailyGroceryInput);
  const impulseInsight = groceryReport.dimensions.IMPULSE_SPENDING;
  assert(impulseInsight.flagged_misleading_correlation === true, 'TEST 4E: Routine small grocery/medicine purchases are flagged as misleading correlation rather than impulse spending');
  assert(impulseInsight.interpretation.includes('daily essentials and groceries'), 'TEST 4F: Interpretation accurately clarifies daily necessities');

  // 3.4: Emergency Hospitalization/Repair Cluster should NOT be called Emotional Retail Therapy
  const medicalClusterInput: BehavioralEngineInput = {
    currentMonth: {
      month: '2026-09',
      income: 100000,
      essential_expenses: 40000,
      discretionary_expenses: 10000,
      total_expenses: 50000,
      surplus: 50000,
      transactions: [
        { id: '1', amount: 15000, type: 'expense', category: 'Medical Emergency', date: '2026-09-10' },
        { id: '2', amount: 3500, type: 'expense', category: 'Medical Clinic', date: '2026-09-10' },
        { id: '3', amount: 2000, type: 'expense', category: 'Medical Pharmacy', date: '2026-09-11' },
        { id: '4', amount: 1200, type: 'expense', category: 'Medical Tests', date: '2026-09-11' },
        { id: '5', amount: 5000, type: 'expense', category: 'Groceries', date: '2026-09-02' },
        { id: '6', amount: 2000, type: 'expense', category: 'Utilities', date: '2026-09-03' },
        { id: '7', amount: 1500, type: 'expense', category: 'Internet', date: '2026-09-04' },
        { id: '8', amount: 1000, type: 'expense', category: 'Fuel', date: '2026-09-05' },
        { id: '9', amount: 800, type: 'expense', category: 'Books', date: '2026-09-06' },
        { id: '10', amount: 400, type: 'expense', category: 'Coffee', date: '2026-09-07' },
      ],
    },
    previousMonths: [],
    goals: [],
  };

  const medicalReport = analyzeBehavioralDimensions(medicalClusterInput);
  const emotionalInsight = medicalReport.dimensions.EMOTIONAL_SPENDING;
  assert(emotionalInsight.flagged_misleading_correlation === true, 'TEST 4G: 48-hour medical emergency burst flagged as misleading correlation rather than emotional retail therapy');
  assert(emotionalInsight.interpretation.includes('emergency'), 'TEST 4H: Interpretation recognizes medical emergency');

  // -----------------------------------------------------------------------------------------------
  // SUITE 4: VALID DATA - STRICT 4-PART INSIGHT CONTRACT (FACT, CALCULATION, INTERPRETATION, GUIDANCE)
  // -----------------------------------------------------------------------------------------------
  const fullyObservedInput: BehavioralEngineInput = {
    currentMonth: {
      month: '2026-09',
      income: 120000, // increased by ₹20k
      essential_expenses: 50000,
      discretionary_expenses: 35000, // increased by ₹15k
      total_expenses: 85000,
      surplus: 35000,
      liquid_savings: 400000,
      emergency_fund_target: 300000, // ₹100k excess idle cash
      transactions: [
        // Weekend social/dining clustering
        { id: 't1', amount: 4500, type: 'expense', category: 'Dining Restaurant', date: '2026-09-05' }, // Sat
        { id: 't2', amount: 3200, type: 'expense', category: 'Dining Cafe', date: '2026-09-06' }, // Sun
        { id: 't3', amount: 6000, type: 'expense', category: 'Luxury Apparel Shopping', date: '2026-09-12' }, // Sat
        { id: 't4', amount: 5000, type: 'expense', category: 'Electronics Gadgets', date: '2026-09-13' }, // Sun
        { id: 't5', amount: 1200, type: 'expense', category: 'Shopping Books', date: '2026-09-14' },
        { id: 't6', amount: 900, type: 'expense', category: 'Shopping Decor', date: '2026-09-14' },
        { id: 't7', amount: 850, type: 'expense', category: 'Shopping Apparel', date: '2026-09-15' },
        { id: 't8', amount: 750, type: 'expense', category: 'Shopping Gift', date: '2026-09-15' },
        { id: 't9', amount: 650, type: 'expense', category: 'Food Snack', date: '2026-09-15' },
        { id: 't10', amount: 550, type: 'expense', category: 'Dining Coffee', date: '2026-09-15' },
        { id: 't11', amount: 20000, type: 'expense', category: 'Rent', date: '2026-09-01' },
        { id: 't12', amount: 10000, type: 'expense', category: 'Groceries', date: '2026-09-02' },
      ],
    },
    previousMonths: [{
      month: '2026-08',
      income: 100000,
      essential_expenses: 50000,
      discretionary_expenses: 20000,
      total_expenses: 70000,
      surplus: 30000,
    }],
    goals: [
      { id: 'g1', title: 'Emergency Cushion', target_amount: 300000, current_amount: 300000, status: 'active' },
      { id: 'g2', title: '₹1 Crore Core SIP', target_amount: 10000000, current_amount: 500000, status: 'active' },
      { id: 'g3', title: 'Car Replacement', target_amount: 800000, current_amount: 50000, status: 'active' },
      { id: 'g4', title: 'Home Renovation', target_amount: 600000, current_amount: 20000, status: 'active' },
      { id: 'g5', title: 'Europe Vacation', target_amount: 400000, current_amount: 10000, status: 'active' },
    ],
  };

  const fullReport = analyzeBehavioralDimensions(fullyObservedInput);
  assert(fullReport.overall_status === 'ANALYSIS_COMPLETE', 'TEST 5A: Full multi-month verified dataset produces ANALYSIS_COMPLETE status');
  assert(fullReport.sufficient_dimensions_count === 8, 'TEST 5B: All 8 dimensions have sufficient evidence under full dataset');

  // Verify strict FACT, CALCULATION, INTERPRETATION, GUIDANCE structure across all 8 dimensions
  for (const dim of BEHAVIORAL_DIMENSIONS) {
    const item = fullReport.dimensions[dim];
    assert(item.fact.length > 10, `TEST 5C [${dim}]: FACT is populated and descriptive`, item.fact);
    assert(item.calculation.length > 5, `TEST 5D [${dim}]: CALCULATION is populated with arithmetic`, item.calculation);
    assert(item.interpretation.length > 10, `TEST 5E [${dim}]: INTERPRETATION is populated with analytical commentary`, item.interpretation);
    assert(item.guidance.length > 10, `TEST 5F [${dim}]: GUIDANCE is actionable and non-judgmental`, item.guidance);
    assert(item.guardrails_passed === true, `TEST 5G [${dim}]: Generated insight strictly obeys ethical guardrails`);
  }

  // 5.2 Specific checks for dimensions
  const lifestyle = fullReport.dimensions.LIFESTYLE_INFLATION;
  assert(lifestyle.calculation.includes('75%'), 'TEST 6A: Lifestyle inflation calculates 75% absorption rate (15k/20k)', lifestyle.calculation);

  const procrastination = fullReport.dimensions.PROCRASTINATION;
  assert(procrastination.fact.includes('1,00,000'), 'TEST 6B: Procrastination identifies ₹1,00,000 idle savings above emergency fund', procrastination.fact);

  const goalFatigue = fullReport.dimensions.GOAL_FATIGUE;
  assert(goalFatigue.fact.includes('5 active financial goals'), 'TEST 6C: Goal fatigue detects 5 concurrent competing goals', goalFatigue.fact);
  assert(goalFatigue.guidance.includes('top 1-2 milestones'), 'TEST 6D: Goal fatigue recommends prioritizing top 1-2 milestones', goalFatigue.guidance);

  console.log(`\n========================================`);
  console.log(`BEHAVIORAL COACH TESTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runBehavioralCoachTests();
