import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalFinanceService } from '../src/modules/finance/canonicalFinance.service.js';
import { croreService } from '../src/modules/crore/crore.service.js';
import { freedomService } from '../src/modules/freedom/freedom.service.js';

describe('P0 Unknown Data Safety: UNKNOWN != ZERO', () => {
  const freshUserId = `test-fresh-user-${Date.now()}`;

  it('keeps unknown fields strictly null for a fresh user with no profile or transactions', async () => {
    const state = await canonicalFinanceService.getCanonicalFinancialState(freshUserId);

    // UNKNOWN != ZERO: fresh user must have nulls, never coerced to 0
    assert.equal(state.income.monthly_net_income, null, 'Income must be null for fresh user');
    assert.equal(state.expenses.total_monthly_expenses, null, 'Expenses must be null for fresh user');
    assert.equal(state.expenses.monthly_essential_expenses, null);
    assert.equal(state.cashflow.monthly_surplus, null, 'Surplus must be null for fresh user');
    assert.equal(state.cashflow.savings_rate, null, 'Savings rate must be null for fresh user');
    assert.equal(state.capital_and_savings.emergency_fund_target, null, 'Emergency fund target must be null without inputs');
    assert.equal(state.capital_and_savings.liquid_savings, null);
    assert.equal(state.capital_and_savings.existing_investments, null);

    // Formatted representations must be 'UNKNOWN'
    assert.equal(state.income.formatted_income, 'UNKNOWN');
    assert.equal(state.expenses.formatted_expenses, 'UNKNOWN');
    assert.equal(state.cashflow.formatted_surplus, 'UNKNOWN');
    assert.equal(state.cashflow.formatted_savings_rate, 'UNKNOWN');

    // Missing fields list must identify all unconfigured elements
    assert.ok(state.missing_fields.includes('monthly_net_income'));
    assert.ok(state.missing_fields.includes('total_monthly_expenses'));
  });

  it('₹1 Crore service returns INSUFFICIENT_DATA and never fabricates target date for fresh user', async () => {
    const croreStatus = await croreService.getUserCroreStatus(freshUserId);

    assert.equal(croreStatus.is_available, false);
    assert.equal(croreStatus.status, 'INSUFFICIENT_DATA');
    assert.equal(croreStatus.calculation.base_case.target_date, null, 'Must NOT fabricate target date');
    assert.equal(croreStatus.calculation.shortest_modeled_path.target_date, null, 'Must NOT fabricate shortest path date');
    assert.ok(croreStatus.calculation.one_next_action.includes('baseline'), 'Must guide user to establish baseline');
  });

  it('Freedom service does not fabricate 50,000 monthly expenses for fresh user', async () => {
    const freedomStatus = await freedomService.getFreedomStatus(freshUserId);

    // Target corpus should NOT be based on fabricated ₹50k/mo
    assert.equal(freedomStatus.active_scenario.indicative_target_corpus, 0, 'Target corpus must be 0 or unavailable without baseline expenses');
  });
});
