import {
  BehavioralDimension,
  BEHAVIORAL_DIMENSIONS,
  BehavioralInsight,
  BehavioralAnalysisReport,
} from './behavioral.schema.js';
import { round2 } from '../allocation/allocation.engine.js';

export interface TransactionRecord {
  id: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  date: string; // YYYY-MM-DD
  description?: string;
  is_recurring?: boolean;
}

export interface MonthlyFinancialSummary {
  month: string;
  income: number;
  essential_expenses: number;
  discretionary_expenses: number;
  total_expenses: number;
  surplus: number;
  liquid_savings?: number;
  emergency_fund_target?: number;
  emergency_fund_gap?: number;
  transactions?: TransactionRecord[];
}

export interface GoalRecord {
  id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  status: string;
  monthly_contribution?: number;
  updated_at?: string;
}

export interface BehavioralEngineInput {
  currentMonth: MonthlyFinancialSummary;
  previousMonths?: MonthlyFinancialSummary[];
  goals?: GoalRecord[];
}

// Strictly prohibited words to enforce ethical coaching boundaries
const PROHIBITED_WORDS = [
  // Mental health clinical diagnoses
  'depression', 'depressive', 'bipolar', 'adhd', 'addiction', 'addictive', 'compulsive',
  'pathological', 'disorder', 'mental health diagnosis', 'psychiatric', 'manic',
  // Shaming
  'shame', 'shameful', 'embarrassing', 'foolish', 'irresponsible', 'stupid', 'careless',
  'reckless', 'childish', 'bad with money',
  // Scaring & catastrophic fear-mongering
  'disaster', 'ruined', 'catastrophe', 'bankrupt', 'bankruptcy', 'doomed', 'terrifying',
  'destitute', 'pauper', 'abyss',
  // Guilt
  'guilt', 'guilty', 'remorse', 'should feel bad', 'wasted money', 'sinful',
  // Manufactured urgency
  'act now before it is too late', 'act immediately', 'crisis', 'panic', 'urgent emergency',
  'countdown', 'running out of time', 'now or never'
];

/**
 * Validates that text adheres strictly to ethical coaching guardrails.
 */
export function validateGuardrails(text: string): boolean {
  const lower = text.toLowerCase();
  for (const word of PROHIBITED_WORDS) {
    if (lower.includes(word)) {
      return false;
    }
  }
  return true;
}

/**
 * Pure deterministic engine that generates structured behavioral insights
 * distinguishing FACT, CALCULATION, INTERPRETATION, and GUIDANCE.
 */
export function analyzeBehavioralDimensions(input: BehavioralEngineInput): BehavioralAnalysisReport {
  const { currentMonth, previousMonths = [], goals = [] } = input;
  const currentTransactions = currentMonth.transactions || [];
  const prevMonth = previousMonths.length > 0 ? previousMonths[0] : null;

  const dimensionsResult: Record<BehavioralDimension, BehavioralInsight> = {} as any;

  // 1. SPENDING CHANGES
  dimensionsResult.SPENDING_CHANGES = evaluateSpendingChanges(currentMonth, prevMonth, currentTransactions);

  // 2. LIFESTYLE INFLATION
  dimensionsResult.LIFESTYLE_INFLATION = evaluateLifestyleInflation(currentMonth, prevMonth, currentTransactions);

  // 3. IMPULSE SPENDING
  dimensionsResult.IMPULSE_SPENDING = evaluateImpulseSpending(currentMonth, currentTransactions);

  // 4. DECISION FATIGUE
  dimensionsResult.DECISION_FATIGUE = evaluateDecisionFatigue(currentMonth, currentTransactions);

  // 5. PROCRASTINATION
  dimensionsResult.PROCRASTINATION = evaluateProcrastination(currentMonth, goals);

  // 6. SOCIAL COMPARISON
  dimensionsResult.SOCIAL_COMPARISON = evaluateSocialComparison(currentMonth, currentTransactions);

  // 7. EMOTIONAL SPENDING
  dimensionsResult.EMOTIONAL_SPENDING = evaluateEmotionalSpending(currentMonth, currentTransactions);

  // 8. GOAL FATIGUE
  dimensionsResult.GOAL_FATIGUE = evaluateGoalFatigue(currentMonth, goals);

  let sufficientCount = 0;
  let insufficientCount = 0;
  let allGuardrailsPassed = true;

  for (const dim of BEHAVIORAL_DIMENSIONS) {
    const item = dimensionsResult[dim];
    if (item.status === 'SUFFICIENT_DATA') sufficientCount++;
    else insufficientCount++;

    const combinedText = `${item.fact} ${item.calculation} ${item.interpretation} ${item.guidance}`;
    const passed = validateGuardrails(combinedText);
    item.guardrails_passed = passed;
    if (!passed) allGuardrailsPassed = false;
  }

  const overallStatus =
    sufficientCount >= 6
      ? 'ANALYSIS_COMPLETE'
      : sufficientCount > 0
      ? 'PARTIAL_DATA'
      : 'INSUFFICIENT_EVIDENCE';

  return {
    month: currentMonth.month,
    overall_status: overallStatus,
    dimensions: dimensionsResult,
    disclaimer:
      'BEHAVIORAL COACH NOTICE: Insights are grounded purely in observed financial transactions and arithmetic comparisons. myCA provides behavioral coaching and habit architecture, not psychological diagnosis, mental health therapy, or regulated financial advisory.',
    ethical_guardrails: {
      no_mental_health_diagnosis: true,
      no_shaming: true,
      no_fear_mongering: true,
      no_guilt: true,
      no_manufactured_urgency: true,
    },
    sufficient_dimensions_count: sufficientCount,
    insufficient_dimensions_count: insufficientCount,
  };
}

// -------------------------------------------------------------------------------------------------
// DIMENSION 1: SPENDING CHANGES
// -------------------------------------------------------------------------------------------------
function evaluateSpendingChanges(
  curr: MonthlyFinancialSummary,
  prev: MonthlyFinancialSummary | null,
  txs: TransactionRecord[]
): BehavioralInsight {
  if (!prev || txs.length < 3) {
    return {
      dimension: 'SPENDING_CHANGES',
      title: 'Spending Changes',
      status: 'INSUFFICIENT_EVIDENCE',
      fact: 'Insufficient historical data to compare spending changes.',
      calculation: 'Requires at least 2 consecutive months with recorded transactions.',
      interpretation: 'A month-over-month trend cannot be established from a single period.',
      guidance: 'Record transactions consistently across at least two consecutive months to reveal meaningful shifts.',
      confidence: 'INSUFFICIENT',
      data_points_analyzed: txs.length,
      flagged_misleading_correlation: false,
      guardrails_passed: true,
    };
  }

  const delta = round2(curr.total_expenses - prev.total_expenses);
  const pctChange = prev.total_expenses > 0 ? round2((delta / prev.total_expenses) * 100) : 0;

  // Check for misleading correlation: single one-off large essential/tax transaction
  const largeOneOff = txs.find(
    (t) =>
      t.amount >= Math.abs(delta) * 0.7 &&
      (t.category.toLowerCase().includes('tax') ||
        t.category.toLowerCase().includes('insurance') ||
        t.category.toLowerCase().includes('medical') ||
        t.category.toLowerCase().includes('fee'))
  );

  if (largeOneOff) {
    return {
      dimension: 'SPENDING_CHANGES',
      title: 'Spending Changes',
      status: 'SUFFICIENT_DATA',
      fact: `Total expenses changed by ₹${Math.abs(delta).toLocaleString('en-IN')} (from ₹${prev.total_expenses.toLocaleString('en-IN')} to ₹${curr.total_expenses.toLocaleString('en-IN')}).`,
      calculation: `Total shift = ₹${curr.total_expenses.toLocaleString('en-IN')} - ₹${prev.total_expenses.toLocaleString('en-IN')} = ${delta >= 0 ? '+' : ''}₹${delta.toLocaleString('en-IN')} (${pctChange}%). One-off payment: ₹${largeOneOff.amount.toLocaleString('en-IN')} for ${largeOneOff.category}.`,
      interpretation: `The spending difference was largely driven by an isolated, non-recurring ${largeOneOff.category} payment rather than ongoing lifestyle habit changes.`,
      guidance: 'Isolate one-off obligations from your regular monthly operating budget to keep your habit baseline accurate.',
      metric_delta: delta,
      confidence: 'HIGH',
      data_points_analyzed: txs.length,
      flagged_misleading_correlation: true,
      misleading_reason: `Shift driven predominantly by single non-recurring transaction (${largeOneOff.category} of ₹${largeOneOff.amount})`,
      guardrails_passed: true,
    };
  }

  const direction = delta >= 0 ? 'increased' : 'decreased';

  return {
    dimension: 'SPENDING_CHANGES',
    title: 'Spending Changes',
    status: 'SUFFICIENT_DATA',
    fact: `Total expenses ${direction} by ₹${Math.abs(delta).toLocaleString('en-IN')} this month (₹${curr.total_expenses.toLocaleString('en-IN')} vs ₹${prev.total_expenses.toLocaleString('en-IN')} last month).`,
    calculation: `Expense delta = ₹${curr.total_expenses.toLocaleString('en-IN')} - ₹${prev.total_expenses.toLocaleString('en-IN')} = ${delta >= 0 ? '+' : ''}₹${delta.toLocaleString('en-IN')} (${pctChange}%).`,
    interpretation: `Your spending velocity ${direction} by ${Math.abs(pctChange)}% relative to the prior baseline across verified ledger transactions.`,
    guidance: delta > 0
      ? 'Review your largest categories to verify whether this change represents intentional seasonal planning or incidental creep.'
      : 'Maintain your current spending discipline to channel the preserved surplus directly into your investment plan.',
    metric_delta: delta,
    confidence: 'HIGH',
    data_points_analyzed: txs.length,
    flagged_misleading_correlation: false,
    guardrails_passed: true,
  };
}

// -------------------------------------------------------------------------------------------------
// DIMENSION 2: LIFESTYLE INFLATION
// -------------------------------------------------------------------------------------------------
function evaluateLifestyleInflation(
  curr: MonthlyFinancialSummary,
  prev: MonthlyFinancialSummary | null,
  txs: TransactionRecord[]
): BehavioralInsight {
  if (!prev || curr.income === 0 || prev.income === 0) {
    return {
      dimension: 'LIFESTYLE_INFLATION',
      title: 'Lifestyle Inflation',
      status: 'INSUFFICIENT_EVIDENCE',
      fact: 'Insufficient multi-month income and expense records to assess lifestyle inflation.',
      calculation: 'Requires at least 2 months with recorded income levels.',
      interpretation: 'Lifestyle inflation measures how discretionary expenses expand when income increases.',
      guidance: 'Maintain verified income and spending logs across income adjustment cycles to track your capture rate.',
      confidence: 'INSUFFICIENT',
      data_points_analyzed: txs.length,
      flagged_misleading_correlation: false,
      guardrails_passed: true,
    };
  }

  const incomeDelta = round2(curr.income - prev.income);
  if (incomeDelta <= 0) {
    return {
      dimension: 'LIFESTYLE_INFLATION',
      title: 'Lifestyle Inflation',
      status: 'SUFFICIENT_DATA',
      fact: `Monthly income remained stable or did not increase (₹${curr.income.toLocaleString('en-IN')} vs ₹${prev.income.toLocaleString('en-IN')}).`,
      calculation: `Income delta = ₹${curr.income.toLocaleString('en-IN')} - ₹${prev.income.toLocaleString('en-IN')} = ₹${incomeDelta.toLocaleString('en-IN')}.`,
      interpretation: 'Lifestyle inflation specifically tracks the expansion of discretionary expenses following an income increase.',
      guidance: 'Keep your baseline steady; when your next increment or bonus arrives, pre-allocate at least 50% into systematic investments.',
      metric_delta: incomeDelta,
      confidence: 'HIGH',
      data_points_analyzed: txs.length,
      flagged_misleading_correlation: false,
      guardrails_passed: true,
    };
  }

  const discretionaryDelta = round2(curr.discretionary_expenses - prev.discretionary_expenses);
  const absorptionRate = round2((discretionaryDelta / incomeDelta) * 100);

  // Check for misleading correlation: was the expense rise actually in essential obligations (rent, medical, education)?
  const essentialDelta = round2(curr.essential_expenses - prev.essential_expenses);
  if (essentialDelta > discretionaryDelta && essentialDelta > 0) {
    return {
      dimension: 'LIFESTYLE_INFLATION',
      title: 'Lifestyle Inflation',
      status: 'SUFFICIENT_DATA',
      fact: `Income grew by ₹${incomeDelta.toLocaleString('en-IN')}, while essential obligations rose by ₹${essentialDelta.toLocaleString('en-IN')} and discretionary expenses by ₹${discretionaryDelta.toLocaleString('en-IN')}.`,
      calculation: `Discretionary change = ₹${discretionaryDelta.toLocaleString('en-IN')} vs Essential change = ₹${essentialDelta.toLocaleString('en-IN')}.`,
      interpretation: 'The increased expenditure was absorbed primarily by essential living costs rather than discretionary lifestyle expansion.',
      guidance: 'Review essential contracts (such as utilities and rent) periodically, while continuing to preserve investable surplus.',
      confidence: 'HIGH',
      data_points_analyzed: txs.length,
      flagged_misleading_correlation: true,
      misleading_reason: 'Expense growth driven by essential non-discretionary costs, not lifestyle inflation',
      guardrails_passed: true,
    };
  }

  return {
    dimension: 'LIFESTYLE_INFLATION',
    title: 'Lifestyle Inflation',
    status: 'SUFFICIENT_DATA',
    fact: `Income increased by ₹${incomeDelta.toLocaleString('en-IN')}, and discretionary spending changed by ₹${discretionaryDelta.toLocaleString('en-IN')}.`,
    calculation: `Discretionary absorption rate = (₹${discretionaryDelta.toLocaleString('en-IN')} / ₹${incomeDelta.toLocaleString('en-IN')}) = ${absorptionRate}%.`,
    interpretation: absorptionRate > 50
      ? `A majority (${absorptionRate}%) of the new income was absorbed into discretionary outflow rather than growing your savings rate.`
      : `You successfully retained the majority of your income increase as surplus, with only ${Math.max(absorptionRate, 0)}% absorbed by lifestyle spending.`,
    guidance: absorptionRate > 50
      ? 'Automate an increase to your monthly SIP to capture future pay increases before discretionary spending expands.'
      : 'Continue channeling your preserved surplus into long-term compounding.',
    metric_delta: absorptionRate,
    confidence: 'HIGH',
    data_points_analyzed: txs.length,
    flagged_misleading_correlation: false,
    guardrails_passed: true,
  };
}

// -------------------------------------------------------------------------------------------------
// DIMENSION 3: IMPULSE SPENDING
// -------------------------------------------------------------------------------------------------
function evaluateImpulseSpending(
  curr: MonthlyFinancialSummary,
  txs: TransactionRecord[]
): BehavioralInsight {
  const discretionaryTxs = txs.filter(
    (t) =>
      t.type === 'expense' &&
      !t.is_recurring &&
      (t.category.toLowerCase().includes('shopping') ||
        t.category.toLowerCase().includes('food') ||
        t.category.toLowerCase().includes('dining') ||
        t.category.toLowerCase().includes('entertainment') ||
        t.category.toLowerCase().includes('personal'))
  );

  if (txs.length < 8) {
    return {
      dimension: 'IMPULSE_SPENDING',
      title: 'Impulse Spending',
      status: 'INSUFFICIENT_EVIDENCE',
      fact: `Recorded ${txs.length} transactions this month, below the analytical threshold of 8.`,
      calculation: 'Requires at least 8 verified transactions to evaluate unplanned purchase cadence.',
      interpretation: 'Cadence and unplanned purchase frequencies require sufficient transaction density.',
      guidance: 'Continue logging all transactions to build an accurate behavioral picture of discretionary patterns.',
      confidence: 'INSUFFICIENT',
      data_points_analyzed: txs.length,
      flagged_misleading_correlation: false,
      guardrails_passed: true,
    };
  }

  // Identify micro-transactions (< ₹1,500)
  const microDiscretionary = discretionaryTxs.filter((t) => t.amount <= 1500 && t.amount > 0);
  const microTotal = round2(microDiscretionary.reduce((sum, t) => sum + t.amount, 0));
  const microPct = curr.total_expenses > 0 ? round2((microTotal / curr.total_expenses) * 100) : 0;

  // Check for misleading correlation: grocery bulk purchase or necessary medicine
  const essentialCategories = microDiscretionary.filter((t) =>
    t.description?.toLowerCase().includes('medicine') ||
    t.description?.toLowerCase().includes('grocery') ||
    t.description?.toLowerCase().includes('milk')
  );

  if (essentialCategories.length > microDiscretionary.length * 0.6) {
    return {
      dimension: 'IMPULSE_SPENDING',
      title: 'Impulse Spending',
      status: 'SUFFICIENT_DATA',
      fact: `Identified ${microDiscretionary.length} frequent small transactions totaling ₹${microTotal.toLocaleString('en-IN')}.`,
      calculation: `Frequent small expenses = ₹${microTotal.toLocaleString('en-IN')} (${microPct}% of total spending).`,
      interpretation: 'The frequent small purchases are primarily daily essentials and groceries rather than discretionary impulse spending.',
      guidance: 'No corrective action needed on daily necessities; maintain standard budget tracking.',
      confidence: 'HIGH',
      data_points_analyzed: txs.length,
      flagged_misleading_correlation: true,
      misleading_reason: 'Frequent micro-transactions consist of routine essentials (groceries/medicine)',
      guardrails_passed: true,
    };
  }

  return {
    dimension: 'IMPULSE_SPENDING',
    title: 'Impulse Spending',
    status: 'SUFFICIENT_DATA',
    fact: `Logged ${microDiscretionary.length} discretionary purchases under ₹1,500, totaling ₹${microTotal.toLocaleString('en-IN')}.`,
    calculation: `Micro-purchases: ${microDiscretionary.length} transactions = ₹${microTotal.toLocaleString('en-IN')} (${microPct}% of monthly expenses).`,
    interpretation: microDiscretionary.length >= 6
      ? 'Frequent small transactions can cumulatively reduce your monthly surplus without visible major purchases.'
      : 'Discretionary transaction frequency remains moderate and controlled.',
    guidance: microDiscretionary.length >= 6
      ? 'Apply a 24-hour consideration rule for non-essential digital purchases to test whether the impulse persists.'
      : 'Maintain your current conscious approach to incidental spending.',
    metric_delta: microTotal,
    confidence: 'HIGH',
    data_points_analyzed: txs.length,
    flagged_misleading_correlation: false,
    guardrails_passed: true,
  };
}

// -------------------------------------------------------------------------------------------------
// DIMENSION 4: DECISION FATIGUE
// -------------------------------------------------------------------------------------------------
function evaluateDecisionFatigue(
  curr: MonthlyFinancialSummary,
  txs: TransactionRecord[]
): BehavioralInsight {
  if (txs.length < 10) {
    return {
      dimension: 'DECISION_FATIGUE',
      title: 'Decision Fatigue',
      status: 'INSUFFICIENT_EVIDENCE',
      fact: `Recorded ${txs.length} transactions, below the minimum threshold of 10 for temporal distribution analysis.`,
      calculation: 'Requires at least 10 timestamped transactions across multiple calendar days.',
      interpretation: 'Temporal spending clusters cannot be evaluated without sufficient transaction density.',
      guidance: 'Keep recording transaction dates accurately to inspect weekly timing patterns.',
      confidence: 'INSUFFICIENT',
      data_points_analyzed: txs.length,
      flagged_misleading_correlation: false,
      guardrails_passed: true,
    };
  }

  // Evaluate weekend (Sat/Sun) vs weekday discretionary spending
  let weekendSpend = 0;
  let weekdaySpend = 0;
  let weekendCount = 0;

  for (const t of txs) {
    if (t.type !== 'expense') continue;
    const d = new Date(t.date);
    const day = d.getUTCDay();
    const isWeekend = day === 0 || day === 6;
    if (isWeekend) {
      weekendSpend += t.amount;
      weekendCount++;
    } else {
      weekdaySpend += t.amount;
    }
  }

  const totalExpense = weekendSpend + weekdaySpend;
  const weekendPct = totalExpense > 0 ? round2((weekendSpend / totalExpense) * 100) : 0;

  return {
    dimension: 'DECISION_FATIGUE',
    title: 'Decision Fatigue',
    status: 'SUFFICIENT_DATA',
    fact: `Weekend transactions totaled ₹${round2(weekendSpend).toLocaleString('en-IN')} (${weekendCount} transactions), representing ${weekendPct}% of monthly expenses.`,
    calculation: `Weekend share = (₹${round2(weekendSpend).toLocaleString('en-IN')} / ₹${round2(totalExpense).toLocaleString('en-IN')}) = ${weekendPct}%.`,
    interpretation: weekendPct > 45
      ? 'Spending shows a heavy weekend concentration, common when end-of-week exhaustion shifts food and recreation toward convenient commercial solutions.'
      : 'Spending is distributed evenly throughout the week without extreme weekend clustering.',
    guidance: weekendPct > 45
      ? 'Plan weekend leisure and dining meals in advance on Thursday or Friday morning before decision fatigue sets in.'
      : 'Maintain your balanced weekly rhythm.',
    metric_delta: weekendPct,
    confidence: 'HIGH',
    data_points_analyzed: txs.length,
    flagged_misleading_correlation: false,
    guardrails_passed: true,
  };
}

// -------------------------------------------------------------------------------------------------
// DIMENSION 5: PROCRASTINATION
// -------------------------------------------------------------------------------------------------
function evaluateProcrastination(
  curr: MonthlyFinancialSummary,
  goals: GoalRecord[]
): BehavioralInsight {
  const liquidSavings = curr.liquid_savings ?? 0;
  const emergencyTarget = curr.emergency_fund_target ?? 0;
  const surplus = curr.surplus;

  if (curr.liquid_savings === undefined || surplus === undefined) {
    return {
      dimension: 'PROCRASTINATION',
      title: 'Procrastination',
      status: 'INSUFFICIENT_EVIDENCE',
      fact: 'Missing verified liquid savings or monthly surplus data.',
      calculation: 'Requires verified cash balances and monthly surplus to evaluate capital deployment timeliness.',
      interpretation: 'Financial procrastination is evaluated by whether deployable surplus sits idle rather than funding goals.',
      guidance: 'Complete your financial baseline in the dashboard to review unallocated capital positioning.',
      confidence: 'INSUFFICIENT',
      data_points_analyzed: 0,
      flagged_misleading_correlation: false,
      guardrails_passed: true,
    };
  }

  // Unallocated surplus = liquid savings in excess of emergency fund
  const idleCapital = Math.max(round2(liquidSavings - emergencyTarget), 0);
  const hasUnfundedGoals = goals.some((g) => g.status === 'active' && g.current_amount < g.target_amount);

  if (idleCapital > 50000 && hasUnfundedGoals) {
    return {
      dimension: 'PROCRASTINATION',
      title: 'Procrastination',
      status: 'SUFFICIENT_DATA',
      fact: `₹${idleCapital.toLocaleString('en-IN')} in excess liquid cash is held in basic savings, while active financial goals remain underfunded.`,
      calculation: `Excess liquid balance = ₹${liquidSavings.toLocaleString('en-IN')} - ₹${emergencyTarget.toLocaleString('en-IN')} emergency reserve = ₹${idleCapital.toLocaleString('en-IN')}.`,
      interpretation: 'Holding excess idle cash beyond emergency safety needs delays compounding returns and prolongs goal completion dates.',
      guidance: 'Set up an automated monthly transfer scheduled 2 days after salary day so your surplus is deployed automatically without manual decision friction.',
      metric_delta: idleCapital,
      confidence: 'HIGH',
      data_points_analyzed: goals.length,
      flagged_misleading_correlation: false,
      guardrails_passed: true,
    };
  }

  return {
    dimension: 'PROCRASTINATION',
    title: 'Procrastination',
    status: 'SUFFICIENT_DATA',
    fact: `Liquid savings of ₹${liquidSavings.toLocaleString('en-IN')} are aligned with your emergency reserve target of ₹${emergencyTarget.toLocaleString('en-IN')}.`,
    calculation: `Idle surplus = ₹${idleCapital.toLocaleString('en-IN')}.`,
    interpretation: 'Your cash deployment is on track, with reserves appropriately sized for safety rather than sitting unallocated.',
    guidance: 'Continue your systematic automated contributions each month.',
    metric_delta: idleCapital,
    confidence: 'HIGH',
    data_points_analyzed: goals.length,
    flagged_misleading_correlation: false,
    guardrails_passed: true,
  };
}

// -------------------------------------------------------------------------------------------------
// DIMENSION 6: SOCIAL COMPARISON
// -------------------------------------------------------------------------------------------------
function evaluateSocialComparison(
  curr: MonthlyFinancialSummary,
  txs: TransactionRecord[]
): BehavioralInsight {
  const socialCategories = ['dining', 'restaurant', 'shopping', 'luxury', 'apparel', 'gadgets', 'social'];
  const socialTxs = txs.filter((t) =>
    t.type === 'expense' &&
    socialCategories.some((sc) => t.category.toLowerCase().includes(sc))
  );

  if (socialTxs.length < 3) {
    return {
      dimension: 'SOCIAL_COMPARISON',
      title: 'Social Comparison',
      status: 'INSUFFICIENT_EVIDENCE',
      fact: `Identified only ${socialTxs.length} categorized social/lifestyle transactions this month.`,
      calculation: 'Requires at least 3 categorized transactions in social or conspicuous spending categories.',
      interpretation: 'Sufficient transaction categorization is needed to evaluate socially influenced spending patterns.',
      guidance: 'Assign clear categories to your discretionary spending to gain visibility into social budget share.',
      confidence: 'INSUFFICIENT',
      data_points_analyzed: socialTxs.length,
      flagged_misleading_correlation: false,
      guardrails_passed: true,
    };
  }

  const socialTotal = round2(socialTxs.reduce((sum, t) => sum + t.amount, 0));
  const socialPct = curr.total_expenses > 0 ? round2((socialTotal / curr.total_expenses) * 100) : 0;

  return {
    dimension: 'SOCIAL_COMPARISON',
    title: 'Social Comparison',
    status: 'SUFFICIENT_DATA',
    fact: `Social and conspicuous categories (dining, socializing, apparel, gadgets) totaled ₹${socialTotal.toLocaleString('en-IN')} across ${socialTxs.length} transactions.`,
    calculation: `Social share = (₹${socialTotal.toLocaleString('en-IN')} / ₹${curr.total_expenses.toLocaleString('en-IN')}) = ${socialPct}% of total expenses.`,
    interpretation: socialPct > 30
      ? `Socially visible spending accounted for ${socialPct}% of total monthly outflow, which may indicate social or peer-group pressure on your cashflow.`
      : `Social spending is balanced at ${socialPct}% of your budget, well within sustainable personal limits.`,
    guidance: socialPct > 30
      ? 'Establish a defined "social & dining" monthly envelope. When the envelope is utilized, propose budget-neutral alternatives like hosting friends at home.'
      : 'Maintain your healthy boundaries around social entertainment spending.',
    metric_delta: socialTotal,
    confidence: 'HIGH',
    data_points_analyzed: socialTxs.length,
    flagged_misleading_correlation: false,
    guardrails_passed: true,
  };
}

// -------------------------------------------------------------------------------------------------
// DIMENSION 7: EMOTIONAL SPENDING
// -------------------------------------------------------------------------------------------------
function evaluateEmotionalSpending(
  curr: MonthlyFinancialSummary,
  txs: TransactionRecord[]
): BehavioralInsight {
  if (txs.length < 10) {
    return {
      dimension: 'EMOTIONAL_SPENDING',
      title: 'Emotional Spending Patterns',
      status: 'INSUFFICIENT_EVIDENCE',
      fact: `Recorded ${txs.length} transactions, below the analytical threshold of 10 for cluster detection.`,
      calculation: 'Requires at least 10 dated transactions across the month.',
      interpretation: 'Burst and cluster patterns require a full month of recorded transaction dates.',
      guidance: 'Continue logging all transactions as they occur to reveal spending cadence and cluster triggers.',
      confidence: 'INSUFFICIENT',
      data_points_analyzed: txs.length,
      flagged_misleading_correlation: false,
      guardrails_passed: true,
    };
  }

  // Detect burst spending: >= 4 discretionary transactions within any 48-hour window
  const expenseTxs = [...txs]
    .filter((t) => t.type === 'expense' && !t.is_recurring)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let maxBurstCount = 0;
  let maxBurstAmount = 0;

  for (let i = 0; i < expenseTxs.length; i++) {
    const start = new Date(expenseTxs[i].date).getTime();
    let count = 1;
    let amt = expenseTxs[i].amount;
    for (let j = i + 1; j < expenseTxs.length; j++) {
      const diffHours = (new Date(expenseTxs[j].date).getTime() - start) / (1000 * 60 * 60);
      if (diffHours <= 48) {
        count++;
        amt += expenseTxs[j].amount;
      } else {
        break;
      }
    }
    if (count > maxBurstCount) {
      maxBurstCount = count;
      maxBurstAmount = amt;
    }
  }

  // Check for misleading correlation: single emergency medical or home repair
  const isEmergencyBurst = expenseTxs.some(
    (t) =>
      t.category.toLowerCase().includes('medical') ||
      t.category.toLowerCase().includes('repair') ||
      t.category.toLowerCase().includes('emergency')
  );

  if (isEmergencyBurst && maxBurstCount >= 3) {
    return {
      dimension: 'EMOTIONAL_SPENDING',
      title: 'Emotional Spending Patterns',
      status: 'SUFFICIENT_DATA',
      fact: `Detected a 48-hour spending burst of ${maxBurstCount} transactions totaling ₹${round2(maxBurstAmount).toLocaleString('en-IN')}.`,
      calculation: `Burst window = ${maxBurstCount} transactions in 48 hours, including emergency/medical expenses.`,
      interpretation: 'This transaction cluster was driven by an essential emergency or repair need, not emotional compensatory shopping.',
      guidance: 'Replenish your liquid emergency reserve in subsequent months to absorb future unexpected shocks smoothly.',
      confidence: 'HIGH',
      data_points_analyzed: txs.length,
      flagged_misleading_correlation: true,
      misleading_reason: 'Burst was caused by medical/repair emergency, not retail therapy',
      guardrails_passed: true,
    };
  }

  return {
    dimension: 'EMOTIONAL_SPENDING',
    title: 'Emotional Spending Patterns',
    status: 'SUFFICIENT_DATA',
    fact: `Peak 48-hour spending activity comprised ${maxBurstCount} non-recurring transactions totaling ₹${round2(maxBurstAmount).toLocaleString('en-IN')}.`,
    calculation: `Max burst concentration = ${maxBurstCount} transactions within 48 hours = ₹${round2(maxBurstAmount).toLocaleString('en-IN')}.`,
    interpretation: maxBurstCount >= 5
      ? 'Concentrated transaction bursts often reflect retail reward-seeking after intense periods of stress or prolonged budget restriction.'
      : 'Spending clusters remained within typical day-to-day ranges without compensatory retail bursts.',
    guidance: maxBurstCount >= 5
      ? 'Introduce a designated "personal reward" pocket money allocation of ₹1,500–₹3,000/mo so conscious indulgence does not trigger unscheduled bursts.'
      : 'Continue maintaining your stable purchasing pacing.',
    metric_delta: maxBurstAmount,
    confidence: 'HIGH',
    data_points_analyzed: txs.length,
    flagged_misleading_correlation: false,
    guardrails_passed: true,
  };
}

// -------------------------------------------------------------------------------------------------
// DIMENSION 8: GOAL FATIGUE
// -------------------------------------------------------------------------------------------------
function evaluateGoalFatigue(
  curr: MonthlyFinancialSummary,
  goals: GoalRecord[]
): BehavioralInsight {
  const activeGoals = goals.filter((g) => g.status === 'active');

  if (activeGoals.length === 0) {
    return {
      dimension: 'GOAL_FATIGUE',
      title: 'Goal Fatigue',
      status: 'INSUFFICIENT_EVIDENCE',
      fact: 'No active financial goals are currently configured.',
      calculation: 'Requires at least 1 active goal to evaluate goal progression and pacing.',
      interpretation: 'Goal fatigue evaluates whether multiple concurrent targets or stalled milestones create planning fatigue.',
      guidance: 'Define 1 to 2 clear goals (e.g. Emergency Fund or ₹1 Crore milestone) to establish an actionable baseline.',
      confidence: 'INSUFFICIENT',
      data_points_analyzed: 0,
      flagged_misleading_correlation: false,
      guardrails_passed: true,
    };
  }

  const surplus = curr.surplus;
  const avgSurplusPerGoal = activeGoals.length > 0 && surplus > 0
    ? round2(surplus / activeGoals.length)
    : 0;

  return {
    dimension: 'GOAL_FATIGUE',
    title: 'Goal Fatigue',
    status: 'SUFFICIENT_DATA',
    fact: `You have ${activeGoals.length} active financial goals competing for ₹${Math.max(surplus, 0).toLocaleString('en-IN')} in monthly surplus.`,
    calculation: `Monthly allocation velocity = ₹${Math.max(surplus, 0).toLocaleString('en-IN')} / ${activeGoals.length} goals = ₹${avgSurplusPerGoal.toLocaleString('en-IN')} per goal/month.`,
    interpretation: activeGoals.length >= 4 && (avgSurplusPerGoal < 10000 || activeGoals.length >= 5)
      ? 'Pursuing too many concurrent goals dilutes your monthly contribution into smaller sums, making visible milestone progress slow and causing goal fatigue.'
      : 'Your goal count and monthly contribution pacing are focused and sustainable.',
    guidance: activeGoals.length >= 4 && (avgSurplusPerGoal < 10000 || activeGoals.length >= 5)
      ? 'Sequence your goals in priority order: focus 80% of surplus on your top 1-2 milestones, pausing lower-priority goals until the first is achieved.'
      : 'Maintain steady monthly contributions toward your active goals.',
    metric_delta: activeGoals.length,
    confidence: 'HIGH',
    data_points_analyzed: activeGoals.length,
    flagged_misleading_correlation: false,
    guardrails_passed: true,
  };
}
