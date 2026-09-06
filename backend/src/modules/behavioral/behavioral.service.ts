import { AppError } from '../../middleware/errorHandler.js';
import { canonicalFinanceService } from '../finance/canonicalFinance.service.js';
import { transactionService } from '../transactions/transaction.service.js';
import { allocationService } from '../allocation/allocation.service.js';
import {
  analyzeBehavioralDimensions,
  BehavioralEngineInput,
  MonthlyFinancialSummary,
  TransactionRecord,
} from './behavioral.engine.js';
import { BehavioralAnalysisReport } from './behavioral.schema.js';

export class BehavioralService {
  /**
   * Generates comprehensive behavioral finance insights grounded strictly in verified user financial data.
   */
  async getBehavioralInsights(userId: string, targetMonth?: string): Promise<BehavioralAnalysisReport> {
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const now = new Date();
    const month = targetMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Compute previous month ISO string (e.g., 2026-08 for 2026-09)
    const [yearNum, monthNum] = month.split('-').map(Number);
    const prevDate = new Date(Date.UTC(yearNum, monthNum - 2, 1));
    const prevMonth = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;

    // 1. Fetch Canonical Financial States
    const [currState, prevState] = await Promise.all([
      canonicalFinanceService.getCanonicalFinancialState(userId, month),
      canonicalFinanceService.getCanonicalFinancialState(userId, prevMonth).catch(() => null),
    ]);

    // 2. Fetch Verified Transactions for Current Month
    const startIso = `${month}-01`;
    const endIso = `${month}-31`;

    let currentTxs: TransactionRecord[] = [];
    try {
      const txResult = await transactionService.listTransactions(userId, {
        start_date: startIso,
        end_date: endIso,
        limit: 500,
        offset: 0,
      });

      currentTxs = (txResult.transactions || []).map((t) => ({
        id: t.id,
        amount: Number(t.amount),
        type: (t.type === 'income' || t.type === 'credit' ? 'income' : t.type === 'transfer' ? 'transfer' : 'expense'),
        category: t.category || 'Uncategorized',
        date: t.date,
        description: t.description || undefined,
        is_recurring: (t as any).is_recurring || false,
      }));
    } catch {
      currentTxs = [];
    }

    // 3. Fetch Active Goals
    let goals: any[] = [];
    try {
      goals = await allocationService.listGoals(userId);
    } catch {
      goals = [];
    }

    // 4. Construct Summaries for Engine
    const currentSummary: MonthlyFinancialSummary = {
      month,
      income: currState.income.monthly_net_income ?? 0,
      essential_expenses: currState.expenses.essential_monthly_expenses ?? (currState.expenses.total_monthly_expenses ?? 0),
      discretionary_expenses: currState.expenses.discretionary_monthly_expenses ?? 0,
      total_expenses: currState.expenses.total_monthly_expenses ?? 0,
      surplus: currState.cashflow.monthly_surplus ?? 0,
      liquid_savings: currState.capital_and_savings.liquid_savings ?? undefined,
      emergency_fund_target: currState.capital_and_savings.emergency_fund_target ?? undefined,
      emergency_fund_gap: currState.capital_and_savings.emergency_fund_gap ?? undefined,
      transactions: currentTxs,
    };

    const previousSummaries: MonthlyFinancialSummary[] = [];
    if (prevState && (prevState.expenses.total_monthly_expenses !== null || prevState.income.monthly_net_income !== null)) {
      previousSummaries.push({
        month: prevMonth,
        income: prevState.income.monthly_net_income ?? 0,
        essential_expenses: prevState.expenses.essential_monthly_expenses ?? (prevState.expenses.total_monthly_expenses ?? 0),
        discretionary_expenses: prevState.expenses.discretionary_monthly_expenses ?? 0,
        total_expenses: prevState.expenses.total_monthly_expenses ?? 0,
        surplus: prevState.cashflow.monthly_surplus ?? 0,
      });
    }

    const engineInput: BehavioralEngineInput = {
      currentMonth: currentSummary,
      previousMonths: previousSummaries,
      goals: goals.map((g) => ({
        id: g.id,
        title: g.title,
        target_amount: g.target_amount,
        current_amount: g.current_amount,
        status: g.status,
      })),
    };

    return analyzeBehavioralDimensions(engineInput);
  }
}

export const behavioralService = new BehavioralService();
