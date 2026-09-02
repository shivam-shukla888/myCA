import { getSupabaseAdminClient } from '../../../config/supabase.js';
import { transactionService } from '../../transactions/transaction.service.js';
import { documentService } from '../../documents/document.service.js';
import { IntentCategory } from '../schemas/aiResponse.schema.js';

export interface RetrievedContext {
  userId: string;
  has_evidence: boolean;
  transactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    currency: string;
    type: string;
    category?: string;
    is_tax_relevant: boolean;
    gst_applicable: boolean;
  }>;
  documents: Array<{
    id: string;
    file_name: string;
    document_type: string;
    financial_year?: string;
    extraction_status: string;
    content_summary?: string;
  }>;
  goals: Array<{
    id: string;
    title: string;
    goal_type?: string;
    target_amount?: number;
    current_amount: number;
  }>;
  deterministic_calculation?: {
    total_amount: number;
    credit_amount: number;
    debit_amount: number;
    transaction_count: number;
    tax_relevant_count: number;
  };
  missing_evidence: string[];
}

export class RetrievalService {
  /**
   * Retrieves strictly user-scoped evidence tailored to the query intent
   */
  async retrieveContext(userId: string, query: string, intent: IntentCategory): Promise<RetrievedContext> {
    if (!userId) {
      throw new Error('User identity required for retrieval');
    }

    const missing_evidence: string[] = [];
    let transactions: any[] = [];
    let documents: any[] = [];
    let goals: any[] = [];

    // 1. Transaction Retrieval (if query touches transactions, expenses, tax, or general finance)
    if (
      intent === 'TRANSACTION_ANALYSIS' ||
      intent === 'TAX_QUERY' ||
      intent === 'GST_QUERY' ||
      intent === 'PERSONAL_FINANCE'
    ) {
      const txResult = await transactionService.listTransactions(userId, { limit: 25, offset: 0 });
      transactions = txResult.transactions.map((t) => ({
        id: t.id,
        date: t.date,
        description: t.description,
        amount: t.amount,
        currency: t.currency,
        type: t.type,
        category: t.category,
        is_tax_relevant: t.is_tax_relevant,
        gst_applicable: t.gst_applicable,
      }));

      if (transactions.length === 0) {
        missing_evidence.push('No recorded transactions found for this user.');
      }
    }

    // 2. Document Retrieval
    if (intent === 'DOCUMENT_ANALYSIS' || intent === 'TAX_QUERY' || intent === 'GST_QUERY') {
      const docResult = await documentService.listDocuments(userId, { limit: 10, offset: 0 });
      documents = docResult.documents.map((d) => ({
        id: d.id,
        file_name: d.file_name,
        document_type: d.document_type,
        financial_year: d.financial_year,
        extraction_status: d.extraction_status,
        content_summary:
          d.extraction_status === 'completed'
            ? 'Extraction verified'
            : 'DOCUMENT_CONTEXT_UNAVAILABLE: Document text has not yet been processed through the OCR pipeline.',
      }));

      if (documents.length === 0) {
        missing_evidence.push('No relevant financial documents uploaded.');
      }
    }

    // 3. Goals Retrieval
    if (intent === 'PERSONAL_FINANCE' || intent === 'INVESTMENT_EDUCATION') {
      try {
        const supabase = getSupabaseAdminClient();
        const { data } = await supabase.from('goals').select('*').eq('user_id', userId).limit(5);
        if (data && data.length > 0) {
          goals = data.map((g) => ({
            id: g.id,
            title: g.title,
            goal_type: g.goal_type,
            target_amount: g.target_amount,
            current_amount: g.current_amount,
          }));
        }
      } catch (e) {
        // Fallback
      }
    }

    // 4. Deterministic Calculations (Grounding boundary)
    let deterministic_calculation = undefined;
    if (transactions.length > 0) {
      let totalAmount = 0;
      let creditAmount = 0;
      let debitAmount = 0;
      let taxCount = 0;

      for (const t of transactions) {
        if (t.type === 'credit') creditAmount += t.amount;
        if (t.type === 'debit') debitAmount += t.amount;
        totalAmount += t.amount;
        if (t.is_tax_relevant) taxCount++;
      }

      deterministic_calculation = {
        total_amount: Math.round(totalAmount * 100) / 100,
        credit_amount: Math.round(creditAmount * 100) / 100,
        debit_amount: Math.round(debitAmount * 100) / 100,
        transaction_count: transactions.length,
        tax_relevant_count: taxCount,
      };
    }

    const has_evidence = transactions.length > 0 || documents.length > 0 || goals.length > 0;

    return {
      userId,
      has_evidence,
      transactions,
      documents,
      goals,
      deterministic_calculation,
      missing_evidence,
    };
  }
}

export const retrievalService = new RetrievalService();
