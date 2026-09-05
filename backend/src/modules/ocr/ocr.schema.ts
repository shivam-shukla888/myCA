import { z } from 'zod';

export const OCR_DOCUMENT_CATEGORIES = [
  'SALARY_SLIP',
  'BANK_STATEMENT',
  'INVESTMENT_STATEMENT',
  'INSURANCE_DOCUMENT',
  'TAX_DOCUMENT',
  'OTHER_FINANCIAL_DOCUMENT',
] as const;

export type OCRDocumentCategory = (typeof OCR_DOCUMENT_CATEGORIES)[number];

export const ocrDocumentCategorySchema = z.enum(OCR_DOCUMENT_CATEGORIES);

// Field Evidence Provenance
export interface ExtractedFieldEvidence {
  field_name: string;
  value: any;
  confidence: number;
  raw_text: string;
  page_number?: number;
  section?: string;
}

export const extractedFieldEvidenceSchema = z.object({
  field_name: z.string(),
  value: z.any(),
  confidence: z.number().min(0).max(1),
  raw_text: z.string(),
  page_number: z.number().int().positive().optional(),
  section: z.string().optional(),
});

// Draft data models for each document type

// 1. SALARY SLIP
export interface SalarySlipDraft {
  employer?: string;
  salary_period?: string; // e.g., '2026-08' or 'August 2026'
  gross_income?: number;
  net_income?: number;
  deductions?: number;
  tds?: number;
  deductions_breakdown?: Array<{
    name: string;
    amount: number;
  }>;
}

export const salarySlipDraftSchema = z.object({
  employer: z.string().optional(),
  salary_period: z.string().optional(),
  gross_income: z.number().nonnegative().optional(),
  net_income: z.number().nonnegative().optional(),
  deductions: z.number().nonnegative().optional(),
  tds: z.number().nonnegative().optional(),
  deductions_breakdown: z.array(
    z.object({
      name: z.string(),
      amount: z.number().nonnegative(),
    })
  ).optional(),
});

// 2. BANK STATEMENT
export interface BankTransactionDraft {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  direction: 'credit' | 'debit';
  category?: string;
  merchant_name?: string;
  account_last4?: string;
  is_uncertain?: boolean;
  duplicate_warning?: boolean;
  duplicate_details?: string;
}

export const bankTransactionDraftSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  description: z.string().min(1),
  amount: z.number().positive('Amount must be positive'),
  direction: z.enum(['credit', 'debit']),
  category: z.string().optional(),
  merchant_name: z.string().optional(),
  account_last4: z.string().optional(),
  is_uncertain: z.boolean().optional(),
  duplicate_warning: z.boolean().optional(),
  duplicate_details: z.string().optional(),
});

export interface BankStatementDraft {
  account_identifier?: string; // Redacted, e.g. "HDFC-****1234"
  statement_period?: {
    start_date: string;
    end_date: string;
  };
  opening_balance?: number;
  closing_balance?: number;
  transactions: BankTransactionDraft[];
}

export const bankStatementDraftSchema = z.object({
  account_identifier: z.string().optional(),
  statement_period: z.object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).optional(),
  opening_balance: z.number().optional(),
  closing_balance: z.number().optional(),
  transactions: z.array(bankTransactionDraftSchema),
});

// 3. INVESTMENT STATEMENT (Informational only, zero personalized buy/sell)
export interface InvestmentHoldingDraft {
  instrument_name: string;
  instrument_type: 'mutual_fund' | 'equity' | 'fixed_deposit' | 'bond' | 'nps' | 'ppf' | 'other';
  quantity?: number;
  unit_price?: number;
  current_value: number;
  cost_value?: number;
}

export const investmentHoldingDraftSchema = z.object({
  instrument_name: z.string().min(1),
  instrument_type: z.enum(['mutual_fund', 'equity', 'fixed_deposit', 'bond', 'nps', 'ppf', 'other']),
  quantity: z.number().optional(),
  unit_price: z.number().optional(),
  current_value: z.number().nonnegative(),
  cost_value: z.number().nonnegative().optional(),
});

export interface InvestmentStatementDraft {
  institution?: string;
  statement_date?: string;
  portfolio_total_value?: number;
  holdings: InvestmentHoldingDraft[];
  disclaimer: string;
}

export const investmentStatementDraftSchema = z.object({
  institution: z.string().optional(),
  statement_date: z.string().optional(),
  portfolio_total_value: z.number().nonnegative().optional(),
  holdings: z.array(investmentHoldingDraftSchema),
  disclaimer: z.string(),
});

// 4. INSURANCE DOCUMENT
export interface InsuranceDocumentDraft {
  insurer?: string;
  policy_type?: 'health' | 'life' | 'term_life' | 'motor' | 'other';
  policy_identifier?: string; // Redacted
  premium_amount?: number;
  premium_frequency?: 'annual' | 'monthly' | 'quarterly' | 'single';
  policy_start_date?: string;
  policy_end_date?: string;
  sum_assured?: number;
}

export const insuranceDocumentDraftSchema = z.object({
  insurer: z.string().optional(),
  policy_type: z.enum(['health', 'life', 'term_life', 'motor', 'other']).optional(),
  policy_identifier: z.string().optional(),
  premium_amount: z.number().nonnegative().optional(),
  premium_frequency: z.enum(['annual', 'monthly', 'quarterly', 'single']).optional(),
  policy_start_date: z.string().optional(),
  policy_end_date: z.string().optional(),
  sum_assured: z.number().nonnegative().optional(),
});

// 5. TAX DOCUMENT
export interface TaxDocumentDraft {
  assessment_year?: string;
  financial_year?: string;
  total_income_declared?: number;
  gross_tax_payable?: number;
  tds_deducted?: number;
  tax_paid?: number;
  refund_due?: number;
  acknowledgment_number?: string;
}

export const taxDocumentDraftSchema = z.object({
  assessment_year: z.string().optional(),
  financial_year: z.string().optional(),
  total_income_declared: z.number().optional(),
  gross_tax_payable: z.number().optional(),
  tds_deducted: z.number().optional(),
  tax_paid: z.number().optional(),
  refund_due: z.number().optional(),
  acknowledgment_number: z.string().optional(),
});

// 6. OTHER FINANCIAL DOCUMENT
export interface OtherFinancialDocumentDraft {
  document_summary?: string;
  extracted_key_values: Record<string, any>;
}

export const otherFinancialDocumentDraftSchema = z.object({
  document_summary: z.string().optional(),
  extracted_key_values: z.record(z.any()),
});

// Extraction Result Schema
export type ExtractedData =
  | SalarySlipDraft
  | BankStatementDraft
  | InvestmentStatementDraft
  | InsuranceDocumentDraft
  | TaxDocumentDraft
  | OtherFinancialDocumentDraft;

export interface ExtractionResult {
  document_id: string;
  document_type: OCRDocumentCategory;
  extraction_status: 'draft_ready' | 'needs_review' | 'extraction_failed' | 'confirmed';
  confidence_score: number;
  extracted_data: ExtractedData;
  evidence: ExtractedFieldEvidence[];
  missing_information: string[];
  validation_errors: string[];
  warnings: string[];
  is_mock?: boolean;
  confirmed_at?: string;
  imported_record_ids?: string[];
}

// User Confirmation Payload Schema
export const confirmDocumentSchema = z.object({
  document_id: z.string().uuid('Document ID must be a valid UUID'),
  reviewed_data: z.record(z.any()),
  import_target: z.enum(['transactions', 'profile', 'archive_only']).default('archive_only'),
});

export type ConfirmDocumentInput = z.infer<typeof confirmDocumentSchema>;
