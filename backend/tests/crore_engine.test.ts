import {
  simulateCompoundingPath,
  calculateRequiredMonthlySIP,
  calculateCroreShortestPath,
  CRORE_TARGET,
  MAX_ALLOWED_RETURN_PCT,
} from '../src/modules/crore/crore.engine.js';

async function runCroreEngineTests() {
  console.log('=== RUNNING ₹1 CRORE SHORTEST PATH DETERMINISTIC ENGINE TESTS ===\n');

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

  // 1. ₹0 Starting Capital + ₹25,000/mo contribution @ 12% return
  const test1 = simulateCompoundingPath({
    startingCapital: 0,
    monthlyContribution: 25000,
    annualReturnPct: 12.0,
    startDate: new Date('2026-09-01T00:00:00Z'),
  });
  assert(test1.months !== null && test1.months > 0, 'TEST 1A: ₹0 starting capital calculates valid months', test1);
  assert(test1.finalCorpus >= CRORE_TARGET, 'TEST 1B: Final corpus meets or exceeds ₹1 Crore', test1.finalCorpus);
  assert(test1.totalContributed > 0, 'TEST 1C: Total contributed is positive', test1.totalContributed);
  assert(test1.estimatedGrowth > 0, 'TEST 1D: Growth component is positive', test1.estimatedGrowth);
  assert(test1.targetDate !== null, 'TEST 1E: Target date string is generated', test1.targetDate);
  // ₹25k/mo at 12% p.a. takes approx 158 months (~13.2 years)
  assert(test1.months! >= 150 && test1.months! <= 170, `TEST 1F: Timeline is approximately 13 years (got ${test1.months} months)`, test1.months);

  // 2. ₹1,00,000 (₹1L) Starting Capital
  const test2 = simulateCompoundingPath({
    startingCapital: 100000,
    monthlyContribution: 25000,
    annualReturnPct: 12.0,
  });
  assert(test2.months !== null && test2.months < test1.months!, 'TEST 2: ₹1L starting capital reaches ₹1 Cr faster than ₹0', {
    with1L: test2.months,
    with0: test1.months,
  });

  // 3. ₹10,00,000 (₹10L) Starting Capital
  const test3 = simulateCompoundingPath({
    startingCapital: 1000000,
    monthlyContribution: 25000,
    annualReturnPct: 12.0,
  });
  assert(test3.months !== null && test3.months < test2.months!, 'TEST 3: ₹10L starting capital reaches ₹1 Cr faster than ₹1L', {
    with10L: test3.months,
    with1L: test2.months,
  });

  // 4. ₹50,00,000 (₹50L) Starting Capital
  const test4 = simulateCompoundingPath({
    startingCapital: 5000000,
    monthlyContribution: 25000,
    annualReturnPct: 12.0,
  });
  assert(test4.months !== null && test4.months < test3.months!, 'TEST 4: ₹50L starting capital reaches ₹1 Cr significantly faster', {
    with50L: test4.months,
    with10L: test3.months,
  });

  // 5. ₹1 Crore (Already Achieved) Starting Capital
  const test5 = simulateCompoundingPath({
    startingCapital: 10000000,
    monthlyContribution: 25000,
    annualReturnPct: 12.0,
  });
  assert(test5.months === 0, 'TEST 5A: ₹1Cr starting capital yields 0 months to target', test5.months);
  assert(test5.finalCorpus === 10000000, 'TEST 5B: Final corpus equals initial capital', test5.finalCorpus);

  // 6. Zero Monthly Contribution with Existing Capital
  const test6 = simulateCompoundingPath({
    startingCapital: 2500000, // ₹25L
    monthlyContribution: 0,
    annualReturnPct: 12.0,
  });
  assert(test6.months !== null && test6.months > 0, 'TEST 6A: ₹25L with 0 contribution compounds to ₹1 Cr via growth alone', test6.months);
  assert(test6.totalContributed === 0, 'TEST 6B: Zero contributions recorded', test6.totalContributed);
  assert(test6.estimatedGrowth >= 7500000, 'TEST 6C: Growth component provides remainder to ₹1 Cr', test6.estimatedGrowth);

  // 7. Zero Monthly Contribution & Zero Starting Capital
  const test7 = simulateCompoundingPath({
    startingCapital: 0,
    monthlyContribution: 0,
    annualReturnPct: 12.0,
  });
  assert(test7.months === null, 'TEST 7A: Zero capital and zero contribution returns null (unreachable)', test7.months);
  assert(test7.targetDate === null, 'TEST 7B: Zero capital target date is null', test7.targetDate);

  // 8. Increasing / Step-Up Contribution (10% annual step-up)
  const test8Constant = simulateCompoundingPath({
    startingCapital: 200000,
    monthlyContribution: 20000,
    annualReturnPct: 12.0,
    annualStepupPct: 0,
  });
  const test8Stepup = simulateCompoundingPath({
    startingCapital: 200000,
    monthlyContribution: 20000,
    annualReturnPct: 12.0,
    annualStepupPct: 10.0,
  });
  assert(test8Stepup.months !== null && test8Stepup.months < test8Constant.months!, 'TEST 8: 10% annual step-up significantly accelerates target arrival', {
    constantMonths: test8Constant.months,
    stepupMonths: test8Stepup.months,
    monthsSaved: test8Constant.months! - test8Stepup.months!,
  });

  // 9. Regulatory Return Bounds Enforcement (max 15%)
  const test9 = simulateCompoundingPath({
    startingCapital: 100000,
    monthlyContribution: 20000,
    annualReturnPct: 35.0, // Unrealistic speculative return
  });
  const test9Capped = simulateCompoundingPath({
    startingCapital: 100000,
    monthlyContribution: 20000,
    annualReturnPct: 15.0, // Safety cap
  });
  assert(test9.months === test9Capped.months, `TEST 9: Return assumption > 15% is strictly clamped to safety cap ${MAX_ALLOWED_RETURN_PCT}%`, {
    excessReturnMonths: test9.months,
    cappedReturnMonths: test9Capped.months,
  });

  // 10. Negative & Invalid Inputs Handled Gracefully
  const test10 = simulateCompoundingPath({
    startingCapital: -50000,
    monthlyContribution: -10000,
    annualReturnPct: -5,
  });
  assert(test10.months === null, 'TEST 10A: Negative inputs clamped cleanly without NaN or infinite loops', test10);
  assert(!isNaN(test10.finalCorpus), 'TEST 10B: Final corpus is not NaN', test10.finalCorpus);

  // 11. Extremely Large Values
  const test11 = simulateCompoundingPath({
    startingCapital: 999999999, // ₹99 Cr
    monthlyContribution: 5000000,
    annualReturnPct: 12.0,
  });
  assert(test11.months === 0, 'TEST 11: Multi-crore initial capital handles gracefully without overflow', test11.months);

  // 12. Decimal Values
  const test12 = simulateCompoundingPath({
    startingCapital: 154230.75,
    monthlyContribution: 18450.50,
    annualReturnPct: 11.75,
  });
  assert(test12.months !== null, 'TEST 12A: Decimal inputs calculate successfully', test12.months);
  assert(Number.isFinite(test12.finalCorpus), 'TEST 12B: Decimal final corpus is finite', test12.finalCorpus);

  // 13. Full Engine Analysis & Scenarios Verification
  const fullAnalysis = calculateCroreShortestPath({
    startingCapital: 300000,
    currentMonthlyContribution: 20000,
    assumedAnnualReturnPct: 12.0,
    currentMonthlyIncome: 80000,
    currentMonthlyExpenses: 60000,
    startDate: new Date('2026-09-01T00:00:00Z'),
  });

  assert(fullAnalysis.target_amount === 10000000, 'TEST 13A: Target amount is ₹1 Crore', fullAnalysis.target_amount);
  assert(!fullAnalysis.is_already_achieved, 'TEST 13B: Target is not yet achieved', fullAnalysis.is_already_achieved);
  assert(fullAnalysis.base_case.months_to_target !== null, 'TEST 13C: Base case months calculated', fullAnalysis.base_case.months_to_target);
  assert(fullAnalysis.improved_case.months_to_target !== null, 'TEST 13D: Improved case months calculated', fullAnalysis.improved_case.months_to_target);
  assert(fullAnalysis.accelerated_case.months_to_target !== null, 'TEST 13E: Accelerated case months calculated', fullAnalysis.accelerated_case.months_to_target);
  assert(fullAnalysis.shortest_modeled_path.months_to_target !== null, 'TEST 13F: Shortest modeled path calculated', fullAnalysis.shortest_modeled_path.months_to_target);

  // Hierarchy of scenarios: shortest <= accelerated <= improved <= base
  assert(
    fullAnalysis.shortest_modeled_path.months_to_target! <= fullAnalysis.accelerated_case.months_to_target! &&
    fullAnalysis.accelerated_case.months_to_target! <= fullAnalysis.base_case.months_to_target!,
    'TEST 13G: Scenario hierarchy holds (Shortest <= Accelerated <= Base)',
    {
      shortest: fullAnalysis.shortest_modeled_path.months_to_target,
      accelerated: fullAnalysis.accelerated_case.months_to_target,
      improved: fullAnalysis.improved_case.months_to_target,
      base: fullAnalysis.base_case.months_to_target,
    }
  );

  // 14. Milestones Verification
  assert(fullAnalysis.milestones.length === 7, 'TEST 14A: Exactly 7 milestones generated (₹1L to ₹1Cr)', fullAnalysis.milestones.length);
  const m1L = fullAnalysis.milestones.find((m) => m.milestone_label === '₹1L')!;
  const m1Cr = fullAnalysis.milestones.find((m) => m.milestone_label === '₹1Cr')!;
  assert(m1L.status === 'ACHIEVED', 'TEST 14B: ₹1L milestone status is ACHIEVED (starting capital is ₹3L)', m1L.status);
  assert(m1Cr.status === 'PROJECTED', 'TEST 14C: ₹1Cr milestone status is PROJECTED', m1Cr.status);
  assert(m1Cr.estimated_months !== null && m1Cr.estimated_months > 0, 'TEST 14D: ₹1Cr milestone estimated months > 0', m1Cr.estimated_months);

  // 15. Controllable Lever Analysis
  const lever = fullAnalysis.lever_analysis;
  assert(lever.highest_impact_lever !== '', 'TEST 15A: Highest impact lever identified', lever.highest_impact_lever);
  assert(lever.months_saved > 0, 'TEST 15B: Months saved is positive', lever.months_saved);
  assert(lever.recommended_change.length > 5, 'TEST 15C: Actionable recommendation provided', lever.recommended_change);

  // 16. Sensitivity Matrix
  assert(fullAnalysis.sensitivity_matrix.length === 12, 'TEST 16A: Sensitivity matrix contains 12 cells (4 contribution x 3 growth)', fullAnalysis.sensitivity_matrix.length);
  const plus50Cell = fullAnalysis.sensitivity_matrix.find((c) => c.contribution_multiplier === 1.5 && c.income_growth_pct === 10)!;
  assert(plus50Cell.time_saved_months > 0, 'TEST 16B: +50% contribution and +10% growth saves significant months', plus50Cell.time_saved_months);

  // 17. ONE Next Action
  assert(fullAnalysis.one_next_action.length > 10, 'TEST 17: ONE next action is formulated and distinct', fullAnalysis.one_next_action);

  // 18. Required SIP calculation
  const reqSip = calculateRequiredMonthlySIP(10000000, 0, 120, 12.0); // 10 years (120 months)
  assert(reqSip > 40000 && reqSip < 50000, `TEST 18: Required SIP to reach ₹1 Cr in 10 years at 12% is ~₹43k (got ₹${reqSip})`, reqSip);

  // 19. Acceleration Levers Regression Tests
  assert(Array.isArray(fullAnalysis.acceleration_levers), 'TEST 19A: Acceleration levers array returned', fullAnalysis.acceleration_levers);
  assert(fullAnalysis.acceleration_levers.length === 4, 'TEST 19B: Exactly 4 standard acceleration levers provided', fullAnalysis.acceleration_levers.length);

  const plus5k = fullAnalysis.acceleration_levers.find(l => l.id === 'plus_5k_surplus')!;
  const plus10k = fullAnalysis.acceleration_levers.find(l => l.id === 'plus_10k_surplus')!;
  const minus5kExp = fullAnalysis.acceleration_levers.find(l => l.id === 'minus_5k_expense')!;
  const plus10kInc = fullAnalysis.acceleration_levers.find(l => l.id === 'plus_10k_income')!;

  assert(plus5k !== undefined, 'TEST 19C: +₹5,000 monthly surplus lever exists', plus5k);
  assert(plus10k !== undefined, 'TEST 19D: +₹10,000 monthly surplus lever exists', plus10k);
  assert(minus5kExp !== undefined, 'TEST 19E: ₹5,000 lower monthly expense lever exists', minus5kExp);
  assert(plus10kInc !== undefined, 'TEST 19F: ₹10,000 higher monthly income lever exists', plus10kInc);

  // Mathematical equivalence of cashflow impact
  assert(plus5k.months_to_target === minus5kExp.months_to_target, 'TEST 20A: +₹5k surplus and -₹5k expense have identical timeline impact', {
    plus5k: plus5k.months_to_target,
    minus5kExp: minus5kExp.months_to_target,
  });
  assert(plus10k.months_to_target === plus10kInc.months_to_target, 'TEST 20B: +₹10k surplus and +₹10k income have identical timeline impact', {
    plus10k: plus10k.months_to_target,
    plus10kInc: plus10kInc.months_to_target,
  });

  // Strict monotonic improvement: +10k accelerates faster than +5k
  assert(plus10k.months_to_target! < plus5k.months_to_target!, 'TEST 20C: +₹10k accelerates target more than +₹5k', {
    plus10kMonths: plus10k.months_to_target,
    plus5kMonths: plus5k.months_to_target,
  });
  assert(plus10k.months_saved > plus5k.months_saved, 'TEST 20D: +₹10k saves strictly more months than +₹5k', {
    plus10kSaved: plus10k.months_saved,
    plus5kSaved: plus5k.months_saved,
  });

  // Highest mathematical impact indicator
  assert(plus10k.is_highest_impact === true, 'TEST 21A: +₹10k surplus is flagged as highest impact lever', plus10k.is_highest_impact);
  assert(plus10kInc.is_highest_impact === true, 'TEST 21B: +₹10k income is flagged as highest impact lever', plus10kInc.is_highest_impact);
  assert(plus5k.is_highest_impact === false, 'TEST 21C: +₹5k surplus is not highest impact when +₹10k is present', plus5k.is_highest_impact);

  // Largest impact variable narrative
  assert(fullAnalysis.largest_impact_variable.includes('10,000'), 'TEST 22A: largest_impact_variable identifies +₹10,000 cashflow lever', fullAnalysis.largest_impact_variable);
  assert(fullAnalysis.largest_impact_variable.includes('largest mathematical impact'), 'TEST 22B: largest_impact_variable states mathematical impact clearly', fullAnalysis.largest_impact_variable);

  // 23. Edge Case: Levers with Already Achieved Capital
  const achievedAnalysis = calculateCroreShortestPath({
    startingCapital: 10000000,
    currentMonthlyContribution: 25000,
    assumedAnnualReturnPct: 12.0,
  });
  assert(achievedAnalysis.is_already_achieved === true, 'TEST 23A: Already achieved correctly flagged', achievedAnalysis.is_already_achieved);
  assert(achievedAnalysis.acceleration_levers.every(l => l.months_saved === 0), 'TEST 23B: Zero months saved when already achieved', achievedAnalysis.acceleration_levers);

  // 24. Edge Case: Zero Monthly Contribution with Capital
  const zeroContributionAnalysis = calculateCroreShortestPath({
    startingCapital: 1000000, // ₹10L
    currentMonthlyContribution: 0,
    assumedAnnualReturnPct: 12.0,
  });
  const zeroPlus5k = zeroContributionAnalysis.acceleration_levers.find(l => l.id === 'plus_5k_surplus')!;
  assert(zeroPlus5k.months_to_target !== null, 'TEST 24A: +₹5k surplus calculates valid timeline from zero contribution', zeroPlus5k.months_to_target);
  assert(zeroPlus5k.months_saved > 0, 'TEST 24B: +₹5k surplus saves months vs zero contribution', zeroPlus5k.months_saved);

  console.log(`\n========================================`);
  console.log(`CRORE ENGINE TESTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runCroreEngineTests();
