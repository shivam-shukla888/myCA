import { v4 as uuidv4 } from 'uuid';
import {
  CreateTransactionInput,
  UpdateTransactionInput,
  QueryTransactionInput,
  MonthlyFinancialSummary,
  MonthlyCategoryBreakdown,
} from './transaction.schema.js';
import { AppError } from '../../middleware/errorHandler.js';
import { getSupabaseAdminClient } from '../../config/supabase.js';
import { env } from '../../config/env.js';

export interface TransactionRecord extends CreateTransactionInput {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

// In-memory store strictly for development/testing when running in offline/mock context
const inMemoryTransactions = new Map<string, TransactionRecord>();

const TAX_SAVING_CATEGORIES = new Set([
  'ppf',
  'elss',
  'nps',
  'life_insurance',
  'health_insurance',
  'home_loan_interest',
  'tuition_fees',
  'donations_80g',
  'medical_expenditure_80d'
]);

function computeMonthlySummary(month: string, transactions: TransactionRecord[]): MonthlyFinancialSummary {
  const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

  let total_income = 0;
  let total_expenses = 0;
  let total_transfers = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  let transferCount = 0;

  const expenseCategoryMap = new Map<string, number>();

  for (const tx of transactions) {
    const amount = Number(tx.amount);
    if (tx.type === 'income' || tx.type === 'credit') {
      total_income += amount;
      incomeCount++;
    } else if (tx.type === 'expense' || tx.type === 'debit') {
      total_expenses += amount;
      expenseCount++;
      const cat = (tx.category && tx.category.trim()) || 'uncategorized';
      expenseCategoryMap.set(cat, (expenseCategoryMap.get(cat) || 0) + amount);
    } else if (tx.type === 'transfer') {
      total_transfers += amount;
      transferCount++;
    }
  }

  total_income = round2(total_income);
  total_expenses = round2(total_expenses);
  total_transfers = round2(total_transfers);

  const monthly_surplus = round2(total_income - total_expenses);
  const savings_rate = total_income > 0 ? round2((monthly_surplus / total_income) * 100) : 0;

  const categories: MonthlyCategoryBreakdown[] = Array.from(expenseCategoryMap.entries())
    .map(([cat, amt]) => {
      const roundedAmt = round2(amt);
      const percentage = total_expenses > 0 ? round2((roundedAmt / total_expenses) * 100) : 0;
      return {
        category: cat,
        amount: roundedAmt,
        percentage,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const largest_expense_category = categories.length > 0 && categories[0].amount > 0 ? categories[0] : null;

  return {
    month,
    total_income,
    total_expenses,
    monthly_surplus,
    savings_rate,
    total_transfers,
    currency: 'INR',
    categories,
    largest_expense_category,
    transaction_count: {
      income: incomeCount,
      expenses: expenseCount,
      transfers: transferCount,
      total: transactions.length,
    },
  };
}

export class TransactionService {
  /**
   * Apply Indian financial/tax business rules to incoming transaction
   */
  private applyBusinessRules(input: CreateTransactionInput): CreateTransactionInput {
    const enriched = { ...input };

    // Auto-detect tax relevance for standard Indian tax deduction categories
    if (enriched.category) {
      const normalizedCat = enriched.category.toLowerCase().replace(/[\s-]+/g, '_');
      if (TAX_SAVING_CATEGORIES.has(normalizedCat)) {
        enriched.is_tax_relevant = true;
      }
    }

    // Default confidence score if categorization is provided without score
    if (enriched.category && enriched.confidence_score === undefined) {
      enriched.confidence_score = 0.95;
    }

    return enriched;
  }

  async createTransaction(userId: string, input: CreateTransactionInput): Promise<TransactionRecord> {
    if (!userId) {
      throw new AppError('User context is required', 401, 'UNAUTHORIZED');
    }

    const isProduction = env.NODE_ENV === 'production';
    const enriched = this.applyBusinessRules(input);
    const now = new Date().toISOString();
    const id = uuidv4();

    const record: TransactionRecord = {
      ...enriched,
      id,
      user_id: userId,
      created_at: now,
      updated_at: now,
    };

    // Try Supabase Admin persistence
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          id: record.id,
          user_id: record.user_id,
          date: record.date,
          description: record.description,
          amount: record.amount,
          currency: record.currency,
          type: record.type,
          category: record.category || null,
          subcategory: record.subcategory || null,
          merchant_name: record.merchant_name || null,
          account: record.account || null,
          is_tax_relevant: record.is_tax_relevant,
          gst_applicable: record.gst_applicable,
          gst_amount: record.gst_amount || null,
          confidence_score: record.confidence_score || null,
          user_verified: record.user_verified,
          notes: record.notes || null,
          document_id: record.document_id || null,
        })
        .select()
        .single();

      if (error) {
        if (isProduction) {
          throw new AppError(`Transaction persistence failed: ${error.message}`, 500, 'DATABASE_PERSISTENCE_FAILED');
        }
      } else if (data) {
        if (!isProduction) {
          inMemoryTransactions.set(record.id, data as TransactionRecord);
        }
        return data as TransactionRecord;
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Transaction persistence failed in production database', 500, 'DATABASE_PERSISTENCE_FAILED');
      }
    }

    if (isProduction) {
      throw new AppError('Transaction database persistence failed in production', 500, 'DATABASE_PERSISTENCE_FAILED');
    }

    // Only allow in-memory storage in development/test mode
    inMemoryTransactions.set(record.id, record);
    return record;
  }

  async listTransactions(userId: string, query: QueryTransactionInput): Promise<{ transactions: TransactionRecord[]; total: number }> {
    if (!userId) {
      throw new AppError('User context is required', 401, 'UNAUTHORIZED');
    }

    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const isProduction = env.NODE_ENV === 'production';

    // Try Supabase first
    try {
      const supabase = getSupabaseAdminClient();
      let dbQuery = supabase.from('transactions').select('*', { count: 'exact' }).eq('user_id', userId);

      if (query.start_date) dbQuery = dbQuery.gte('date', query.start_date);
      if (query.end_date) dbQuery = dbQuery.lte('date', query.end_date);
      if (query.type) dbQuery = dbQuery.eq('type', query.type);
      if (query.category) dbQuery = dbQuery.eq('category', query.category);
      if (query.is_tax_relevant !== undefined) dbQuery = dbQuery.eq('is_tax_relevant', query.is_tax_relevant);

      dbQuery = dbQuery.order('date', { ascending: false }).range(offset, offset + limit - 1);

      const { data, error, count } = await dbQuery;
      const hasInMemory = !isProduction && Array.from(inMemoryTransactions.values()).some((t) => t.user_id === userId);

      if (error) {
        if (isProduction) {
          throw new AppError(`Failed to retrieve transactions: ${error.message}`, 500, 'DATABASE_QUERY_FAILED');
        }
      } else if (data && (data.length > 0 || !hasInMemory)) {
        return { transactions: data as TransactionRecord[], total: count !== null && count !== undefined ? count : data.length };
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Transaction query failed in production database', 500, 'DATABASE_QUERY_FAILED');
      }
    }

    if (isProduction) {
      throw new AppError('Transaction query failed in production database', 500, 'DATABASE_QUERY_FAILED');
    }

    // Filter in-memory by user_id (development/test mode only)
    const userRecords = Array.from(inMemoryTransactions.values()).filter((t) => t.user_id === userId);

    let filtered = userRecords;
    if (query.start_date) filtered = filtered.filter((t) => t.date >= query.start_date!);
    if (query.end_date) filtered = filtered.filter((t) => t.date <= query.end_date!);
    if (query.type) filtered = filtered.filter((t) => t.type === query.type);
    if (query.category) filtered = filtered.filter((t) => t.category === query.category);
    if (query.is_tax_relevant !== undefined) filtered = filtered.filter((t) => t.is_tax_relevant === query.is_tax_relevant);

    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const paginated = filtered.slice(offset, offset + limit);
    return { transactions: paginated, total: filtered.length };
  }

  async getTransactionById(userId: string, id: string): Promise<TransactionRecord> {
    if (!userId) {
      throw new AppError('User context is required', 401, 'UNAUTHORIZED');
    }

    const isProduction = env.NODE_ENV === 'production';

    // Try Supabase first
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        if (isProduction) {
          throw new AppError(`Failed to fetch transaction: ${error.message}`, 500, 'DATABASE_QUERY_FAILED');
        }
      } else if (data) {
        return data as TransactionRecord;
      } else if (isProduction) {
        throw new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Transaction query failed in production database', 500, 'DATABASE_QUERY_FAILED');
      }
    }

    if (isProduction) {
      throw new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
    }

    const record = inMemoryTransactions.get(id);
    if (!record) {
      throw new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
    }

    // Explicit user isolation check (Test A: User A cannot view User B's record)
    if (record.user_id !== userId) {
      throw new AppError('Access denied: You do not have permission to view this transaction', 403, 'FORBIDDEN');
    }

    return record;
  }

  async updateTransaction(userId: string, id: string, input: UpdateTransactionInput): Promise<TransactionRecord> {
    const isProduction = env.NODE_ENV === 'production';
    const existing = await this.getTransactionById(userId, id);

    const newAmount = input.amount !== undefined ? input.amount : existing.amount;
    const isGst = input.gst_applicable !== undefined ? input.gst_applicable : existing.gst_applicable;
    const newGst = input.gst_amount !== undefined ? input.gst_amount : existing.gst_amount;

    if (isGst && newGst !== undefined && newGst > newAmount) {
      throw new AppError('GST amount cannot exceed transaction amount', 400, 'VALIDATION_ERROR');
    }

    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('transactions')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        if (isProduction) {
          throw new AppError(`Failed to update transaction: ${error.message}`, 500, 'DATABASE_PERSISTENCE_FAILED');
        }
      } else if (data) {
        if (!isProduction) {
          inMemoryTransactions.set(id, data as TransactionRecord);
        }
        return data as TransactionRecord;
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Transaction update failed in production database', 500, 'DATABASE_PERSISTENCE_FAILED');
      }
    }

    if (isProduction) {
      throw new AppError('Transaction update failed in production database', 500, 'DATABASE_PERSISTENCE_FAILED');
    }

    const updated: TransactionRecord = {
      ...existing,
      ...input,
      user_id: existing.user_id,
      id: existing.id,
      updated_at: new Date().toISOString(),
    };

    inMemoryTransactions.set(id, updated);
    return updated;
  }

  async deleteTransaction(userId: string, id: string): Promise<{ success: boolean; id: string }> {
    const isProduction = env.NODE_ENV === 'production';
    await this.getTransactionById(userId, id);

    try {
      const supabase = getSupabaseAdminClient();
      const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', userId);
      if (error) {
        if (isProduction) {
          throw new AppError(`Failed to delete transaction: ${error.message}`, 500, 'DATABASE_PERSISTENCE_FAILED');
        }
      } else {
        if (!isProduction) {
          inMemoryTransactions.delete(id);
        }
        return { success: true, id };
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Transaction deletion failed in production database', 500, 'DATABASE_PERSISTENCE_FAILED');
      }
    }

    if (isProduction) {
      throw new AppError('Transaction deletion failed in production database', 500, 'DATABASE_PERSISTENCE_FAILED');
    }

    inMemoryTransactions.delete(id);
    return { success: true, id };
  }

  async getMonthlySummary(userId: string, month: string): Promise<MonthlyFinancialSummary> {
    if (!userId) {
      throw new AppError('User context is required', 401, 'UNAUTHORIZED');
    }

    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);
    const lastDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
    const startDate = `${month}-01`;
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

    const isProduction = env.NODE_ENV === 'production';

    // Try Supabase first
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate);

      const hasInMemory = !isProduction && Array.from(inMemoryTransactions.values()).some((t) => t.user_id === userId);

      if (error) {
        if (isProduction) {
          throw new AppError(`Failed to retrieve monthly transactions: ${error.message}`, 500, 'DATABASE_QUERY_FAILED');
        }
      } else if (data && (data.length > 0 || !hasInMemory)) {
        return computeMonthlySummary(month, data as TransactionRecord[]);
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Monthly summary query failed in production database', 500, 'DATABASE_QUERY_FAILED');
      }
    }

    if (isProduction) {
      throw new AppError('Monthly summary query failed in production database', 500, 'DATABASE_QUERY_FAILED');
    }

    // In-memory filter for dev/test mode
    const userRecords = Array.from(inMemoryTransactions.values()).filter(
      (t) => t.user_id === userId && t.date >= startDate && t.date <= endDate
    );

    return computeMonthlySummary(month, userRecords);
  }
}

export const transactionService = new TransactionService();
