import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalFinanceService } from '../src/modules/finance/canonicalFinance.service.js';
import { allocationService } from '../src/modules/allocation/allocation.service.js';
import { transactionService } from '../src/modules/transactions/transaction.service.js';

describe('P0 Financial Semantic Contract Hardening', () => {
  const testUserId = `test-semantic-${Date.now()}`;

  it('proves ₹40k essential + ₹20k debt = ₹60k total expenses, and ₹1L income - ₹60k expenses = ₹40k surplus', async () => {
    // Setup profile: ₹100,000 income, ₹40,000 essential expenses, ₹20,000 debt obligations
    await allocationService.upsertProfile(testUserId, {
      monthly_income: 100000,
      monthly_essential_expenses: 40000,
      monthly_debt_obligations: 20000,
      existing_liquid_savings: 360000,
      existing_investments: 500000,
    });

    const state = await canonicalFinanceService.getCanonicalFinancialState(testUserId);

    // 1. Semantic expense assertion: total = essential + debt
    assert.equal(state.expenses.monthly_essential_expenses, 40000);
    assert.equal(state.expenses.monthly_debt_obligations, 20000);
    assert.equal(state.expenses.total_monthly_expenses, 60000, 'total_monthly_expenses must equal essential (40k) + debt (20k)');

    // 2. Semantic surplus assertion: surplus = income - total_expenses
    assert.equal(state.income.monthly_net_income, 100000);
    assert.equal(state.cashflow.monthly_surplus, 40000, 'monthly_surplus must equal income (100k) - expenses (60k)');
    assert.equal(state.cashflow.is_deficit, false);
    assert.equal(state.cashflow.deficit_amount, 0);

    // 3. Savings rate: (40,000 / 100,000) * 100 = 40%
    assert.equal(state.cashflow.savings_rate, 40);
  });

  it('handles deficit correctly when expenses exceed income', async () => {
    const deficitUser = `test-deficit-${Date.now()}`;

    // ₹40,000 income, ₹40,000 essential + ₹20,000 debt = ₹60,000 expenses -> -₹20,000 surplus
    await allocationService.upsertProfile(deficitUser, {
      monthly_income: 40000,
      monthly_essential_expenses: 40000,
      monthly_debt_obligations: 20000,
      existing_liquid_savings: 100000,
      existing_investments: 0,
    });

    const state = await canonicalFinanceService.getCanonicalFinancialState(deficitUser);

    assert.equal(state.expenses.total_monthly_expenses, 60000);
    assert.equal(state.cashflow.monthly_surplus, -20000);
    assert.equal(state.cashflow.is_deficit, true);
    assert.equal(state.cashflow.deficit_amount, 20000);
    assert.equal(state.cashflow.savings_rate, 0); // clamped to 0% in deficit (BUG-P2-01)
  });

  it('handles zero-income case strictly without error or fabrication', async () => {
    const zeroIncomeUser = `test-zero-${Date.now()}`;

    // ₹0 income, ₹30,000 essential + ₹10,000 debt = ₹40,000 expenses -> -₹40,000 surplus
    await allocationService.upsertProfile(zeroIncomeUser, {
      monthly_income: 0,
      monthly_essential_expenses: 30000,
      monthly_debt_obligations: 10000,
      existing_liquid_savings: 50000,
      existing_investments: 0,
    });

    const state = await canonicalFinanceService.getCanonicalFinancialState(zeroIncomeUser);

    assert.equal(state.income.monthly_net_income, 0);
    assert.equal(state.expenses.total_monthly_expenses, 40000);
    assert.equal(state.cashflow.monthly_surplus, -40000);
    assert.equal(state.cashflow.is_deficit, true);
    assert.equal(state.cashflow.deficit_amount, 40000);
    assert.equal(state.cashflow.savings_rate, 0);
  });
});
