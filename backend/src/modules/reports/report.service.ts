import { GenerateReportInput } from './report.schema.js';
import { AppError } from '../../middleware/errorHandler.js';
import { transactionService } from '../transactions/transaction.service.js';

export interface ReportBoundaryResponse {
  report_type: string;
  financial_year?: string;
  period: {
    start_date?: string;
    end_date?: string;
  };
  summary: {
    total_transactions_analyzed: number;
    total_credits: number;
    total_debits: number;
    tax_relevant_count: number;
    gst_total_amount: number;
  };
  disclaimer: string;
  generated_at: string;
}

export class ReportService {
  async generateReport(userId: string, input: GenerateReportInput): Promise<ReportBoundaryResponse> {
    if (!userId) {
      throw new AppError('User context is required', 401, 'UNAUTHORIZED');
    }

    // Retrieve user's transactions within period
    const { transactions } = await transactionService.listTransactions(userId, {
      start_date: input.start_date,
      end_date: input.end_date,
      limit: 100,
      offset: 0,
    });

    let totalCredits = 0;
    let totalDebits = 0;
    let taxCount = 0;
    let gstTotal = 0;

    for (const t of transactions) {
      if (t.type === 'credit') totalCredits += t.amount;
      if (t.type === 'debit') totalDebits += t.amount;
      if (t.is_tax_relevant) taxCount++;
      if (t.gst_applicable && t.gst_amount) gstTotal += t.gst_amount;
    }

    return {
      report_type: input.report_type,
      financial_year: input.financial_year || '2025-26',
      period: {
        start_date: input.start_date,
        end_date: input.end_date,
      },
      summary: {
        total_transactions_analyzed: transactions.length,
        total_credits: Math.round(totalCredits * 100) / 100,
        total_debits: Math.round(totalDebits * 100) / 100,
        tax_relevant_count: taxCount,
        gst_total_amount: Math.round(gstTotal * 100) / 100,
      },
      disclaimer: 'DISCLAIMER: This report is an analytical summary of recorded financial records and does NOT constitute certified tax advice or a statutory audit under Indian Income Tax Act 1961.',
      generated_at: new Date().toISOString(),
    };
  }
}

export const reportService = new ReportService();
