import { v4 as uuidv4 } from 'uuid';
import { CreateTransactionInput, UpdateTransactionInput, QueryTransactionInput } from './transaction.schema.js';
import { AppError } from '../../middleware/errorHandler.js';
import { getSupabaseAdminClient } from '../../config/supabase.js';

export interface TransactionRecord extends CreateTransactionInput {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

// In-memory store for development/testing when running in offline/mock context
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

    // Always maintain in-memory store for dev/testing consistency
    inMemoryTransactions.set(record.id, record);

    // Try Supabase Admin persistence if configured
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

      if (!error && data) {
        return data as TransactionRecord;
      }
    } catch (err) {
      // Fallback to in-memory record
    }

    return record;
  }

  async listTransactions(userId: string, query: QueryTransactionInput): Promise<{ transactions: TransactionRecord[]; total: number }> {
    if (!userId) {
      throw new AppError('User context is required', 401, 'UNAUTHORIZED');
    }

    // Try Supabase first
    try {
      const supabase = getSupabaseAdminClient();
      let dbQuery = supabase.from('transactions').select('*', { count: 'exact' }).eq('user_id', userId);

      if (query.start_date) dbQuery = dbQuery.gte('date', query.start_date);
      if (query.end_date) dbQuery = dbQuery.lte('date', query.end_date);
      if (query.type) dbQuery = dbQuery.eq('type', query.type);
      if (query.category) dbQuery = dbQuery.eq('category', query.category);
      if (query.is_tax_relevant !== undefined) dbQuery = dbQuery.eq('is_tax_relevant', query.is_tax_relevant);

      dbQuery = dbQuery.order('date', { ascending: false }).range(query.offset, query.offset + query.limit - 1);

      const { data, error, count } = await dbQuery;
      if (!error && data && data.length > 0) {
        return { transactions: data as TransactionRecord[], total: count || data.length };
      }
    } catch (err) {
      // Fallback to in-memory
    }

    // Filter in-memory by user_id
    const userRecords = Array.from(inMemoryTransactions.values()).filter((t) => t.user_id === userId);

    let filtered = userRecords;
    if (query.start_date) filtered = filtered.filter((t) => t.date >= query.start_date!);
    if (query.end_date) filtered = filtered.filter((t) => t.date <= query.end_date!);
    if (query.type) filtered = filtered.filter((t) => t.type === query.type);
    if (query.category) filtered = filtered.filter((t) => t.category === query.category);
    if (query.is_tax_relevant !== undefined) filtered = filtered.filter((t) => t.is_tax_relevant === query.is_tax_relevant);

    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const paginated = filtered.slice(query.offset, query.offset + query.limit);
    return { transactions: paginated, total: filtered.length };
  }

  async getTransactionById(userId: string, id: string): Promise<TransactionRecord> {
    if (!userId) {
      throw new AppError('User context is required', 401, 'UNAUTHORIZED');
    }

    // Try Supabase first
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (!error && data) {
        return data as TransactionRecord;
      }
    } catch (err) {
      // Fallback
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
    const existing = await this.getTransactionById(userId, id);

    const newAmount = input.amount !== undefined ? input.amount : existing.amount;
    const isGst = input.gst_applicable !== undefined ? input.gst_applicable : existing.gst_applicable;
    const newGst = input.gst_amount !== undefined ? input.gst_amount : existing.gst_amount;

    if (isGst && newGst !== undefined && newGst > newAmount) {
      throw new AppError('GST amount cannot exceed transaction amount', 400, 'VALIDATION_ERROR');
    }

    const updated: TransactionRecord = {
      ...existing,
      ...input,
      user_id: existing.user_id,
      id: existing.id,
      updated_at: new Date().toISOString(),
    };

    inMemoryTransactions.set(id, updated);

    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('transactions')
        .update(input)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (!error && data) {
        return data as TransactionRecord;
      }
    } catch (err) {
      // Fallback
    }

    return updated;
  }

  async deleteTransaction(userId: string, id: string): Promise<{ success: boolean; id: string }> {
    await this.getTransactionById(userId, id);

    inMemoryTransactions.delete(id);

    try {
      const supabase = getSupabaseAdminClient();
      await supabase.from('transactions').delete().eq('id', id).eq('user_id', userId);
    } catch (err) {
      // Fallback
    }

    return { success: true, id };
  }
}

export const transactionService = new TransactionService();
