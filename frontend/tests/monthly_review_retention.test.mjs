import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * P1 Retention Loop & Monthly Financial Review Regression Test Suite
 * Validates the 9 essential questions, meaningful milestones, prior-month truth, and strict anti-dark pattern guarantees.
 */

describe('P1 Monthly Financial Review & Retention Loop Verification', () => {
  const componentPath = path.resolve('src/components/intelligence/MonthlyReviewView.tsx');
  const pagePath = path.resolve('src/app/intelligence/page.tsx');
  const apiPath = path.resolve('src/lib/api.ts');

  assert.ok(fs.existsSync(componentPath), 'MonthlyReviewView.tsx must exist');
  assert.ok(fs.existsSync(pagePath), 'intelligence/page.tsx must exist');
  assert.ok(fs.existsSync(apiPath), 'lib/api.ts must exist');

  const componentSource = fs.readFileSync(componentPath, 'utf8');
  const pageSource = fs.readFileSync(pagePath, 'utf8');
  const apiSource = fs.readFileSync(apiPath, 'utf8');

  it('verifies api.ts defines StructuredMonthlyReview contract and monthlyReviewApi', () => {
    assert.ok(apiSource.includes('export interface StructuredMonthlyReview'), 'api.ts must export StructuredMonthlyReview');
    assert.ok(apiSource.includes('export const monthlyReviewApi'), 'api.ts must export monthlyReviewApi');
    assert.ok(apiSource.includes("request<StructuredMonthlyReview>(`/finance/monthly-review"), 'api caller must hit /finance/monthly-review');
    assert.ok(apiSource.includes('anti_dark_pattern_compliance'), 'StructuredMonthlyReview must include anti_dark_pattern_compliance');
  });

  it('verifies intelligence page wires MonthlyReviewView and monthlyReviewApi', () => {
    assert.ok(pageSource.includes('MonthlyReviewView'), 'intelligence page must import MonthlyReviewView');
    assert.ok(pageSource.includes('monthlyReviewApi'), 'intelligence page must import monthlyReviewApi');
    assert.ok(pageSource.includes('structuredReview'), 'intelligence page must maintain structuredReview state');
    assert.ok(pageSource.includes('loadStructuredReview'), 'intelligence page must define loadStructuredReview loader');
    assert.ok(pageSource.includes("activeTab === 'review'"), 'intelligence page must render review view for review tab');
  });

  it('verifies Question 1: What changed? is answered with verifiable deltas', () => {
    assert.ok(componentSource.includes('1. WHAT CHANGED?'), 'Component must prominently answer 1. WHAT CHANGED?');
    assert.ok(componentSource.includes('MONEY IN (INCOME)'), 'Must show Money In (Income)');
    assert.ok(componentSource.includes('MONEY OUT (EXPENSES)'), 'Must show Money Out (Expenses)');
    assert.ok(componentSource.includes('MONTHLY SURPLUS'), 'Must show Monthly Surplus');
    assert.ok(componentSource.includes('SAVINGS RATE'), 'Must show Savings Rate');
    assert.ok(componentSource.includes('MetricDeltaPill'), 'Must render verified deltas via MetricDeltaPill');
  });

  it('verifies Question 2: Why did it change? is answered with category drivers', () => {
    assert.ok(componentSource.includes('2. WHY DID IT CHANGE?'), 'Component must answer 2. WHY DID IT CHANGE?');
    assert.ok(componentSource.includes('top_category_drivers'), 'Must iterate top category drivers');
    assert.ok(componentSource.includes('PRIMARY CATEGORY DRIVERS'), 'Must display primary category drivers section');
  });

  it('verifies Question 3: What improved? is answered constructively', () => {
    assert.ok(componentSource.includes('3. WHAT IMPROVED?'), 'Component must answer 3. WHAT IMPROVED?');
    assert.ok(componentSource.includes('what_improved.items'), 'Must iterate what_improved.items');
    assert.ok(componentSource.includes('CheckCircle2'), 'Must use positive check styling');
  });

  it('verifies Question 4: What got worse? is answered constructively with ZERO shaming', () => {
    assert.ok(componentSource.includes('4. WHAT GOT WORSE?'), 'Component must answer 4. WHAT GOT WORSE?');
    assert.ok(componentSource.includes('what_got_worse.items'), 'Must iterate what_got_worse.items');
    assert.ok(!componentSource.includes('lazy'), 'Component must not shame');
    assert.ok(!componentSource.includes('guilt'), 'Component must not use guilt');
  });

  it('verifies Question 5: What is my current surplus? provides canonical formula breakdown', () => {
    assert.ok(componentSource.includes('5. WHAT IS MY CURRENT SURPLUS?'), 'Component must answer 5. WHAT IS MY CURRENT SURPLUS?');
    assert.ok(componentSource.includes('formula_breakdown'), 'Must display canonical formula breakdown');
    assert.ok(componentSource.includes('status_label'), 'Must display status label badge');
  });

  it('verifies Question 6: How is my savings rate changing? displays rate and percentage point delta', () => {
    assert.ok(componentSource.includes('6. HOW IS MY SAVINGS RATE CHANGING?'), 'Component must answer 6. HOW IS MY SAVINGS RATE CHANGING?');
    assert.ok(componentSource.includes('delta_percentage_points'), 'Must display delta in percentage points');
    assert.ok(componentSource.includes('trend_description'), 'Must display trend description');
  });

  it('verifies Question 7: How is my emergency fund progressing? shows coverage and funded percentage', () => {
    assert.ok(componentSource.includes('7. HOW IS MY EMERGENCY FUND PROGRESSING?'), 'Component must answer 7. HOW IS MY EMERGENCY FUND PROGRESSING?');
    assert.ok(componentSource.includes('progress_pct'), 'Must display progress percentage');
    assert.ok(componentSource.includes('coverage_months'), 'Must display coverage months');
    assert.ok(componentSource.includes('target_amount'), 'Must display target amount');
  });

  it('verifies Question 8: Did my ₹1Cr path accelerate or slow down? displays trajectory status and months delta', () => {
    assert.ok(componentSource.includes('8. DID MY ₹1Cr PATH ACCELERATE OR SLOW DOWN?'), 'Component must answer 8. DID MY ₹1Cr PATH ACCELERATE OR SLOW DOWN?');
    assert.ok(componentSource.includes('crore_path_trajectory'), 'Must display crore path trajectory');
    assert.ok(componentSource.includes('months_delta'), 'Must calculate and show months delta');
    assert.ok(componentSource.includes('months faster'), 'Must acknowledge accelerated timeline');
    assert.ok(componentSource.includes('months slower'), 'Must acknowledge slowed down timeline');
  });

  it('verifies Question 9: What ONE action matters next? displays single priority action hero card', () => {
    assert.ok(componentSource.includes('9. WHAT ONE ACTION MATTERS NEXT?'), 'Component must answer 9. WHAT ONE ACTION MATTERS NEXT?');
    assert.ok(componentSource.includes('one_action_matters_next.action'), 'Must render specific action');
    assert.ok(componentSource.includes('one_action_matters_next.reason'), 'Must render strategic reason');
    assert.ok(componentSource.includes('priority_area'), 'Must display priority area');
  });

  it('verifies meaningful milestones are explicitly represented', () => {
    assert.ok(componentSource.includes('MEANINGFUL FINANCIAL MILESTONES'), 'Must include meaningful milestones section');
    assert.ok(componentSource.includes('milestones.map'), 'Must map over milestones');
    assert.ok(componentSource.includes('ACHIEVED'), 'Must support ACHIEVED milestone status');
    assert.ok(componentSource.includes('IN_PROGRESS'), 'Must support IN_PROGRESS milestone status');
    assert.ok(componentSource.includes('LOCKED'), 'Must support LOCKED milestone status');
  });

  it('verifies truth in data: prior month unavailable is explicitly communicated without invented comparisons', () => {
    assert.ok(componentSource.includes('PRIOR MONTH DATA UNAVAILABLE'), 'Must feature explicit banner when prior month unavailable');
    assert.ok(componentSource.includes('BASELINE MONTH (NO PRIOR DATA)'), 'Must badge baseline months clearly');
    assert.ok(componentSource.includes('prior_month_note'), 'Must surface explanatory note rather than invented numbers');
  });

  it('verifies strict anti-dark pattern guarantees are visible and enforced', () => {
    assert.ok(componentSource.includes('RETENTION WITHOUT DARK PATTERNS'), 'Must include ethical retention guarantee');
    assert.ok(componentSource.includes('NO STREAK ANXIETY'), 'Must guarantee no streak anxiety');
    assert.ok(componentSource.includes('NO SHAMING OR GUILT'), 'Must guarantee no shaming or guilt');
    assert.ok(componentSource.includes('NO FEAR OR SCARING'), 'Must guarantee no fear or scaring');
    assert.ok(componentSource.includes('NO FOMO OR PEER PRESSURE'), 'Must guarantee no FOMO or peer pressure');
    assert.ok(componentSource.includes('NO FAKE URGENCY'), 'Must guarantee no fake urgency');
    assert.ok(componentSource.includes('NO SPAM NOTIFICATIONS'), 'Must guarantee no spam notifications');
  });
});
