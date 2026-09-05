import { AppError } from '../../middleware/errorHandler.js';
import {
  ExtractedData,
  ExtractedFieldEvidence,
  OCRDocumentCategory,
  SalarySlipDraft,
  BankStatementDraft,
  InvestmentStatementDraft,
  InsuranceDocumentDraft,
  TaxDocumentDraft,
  OtherFinancialDocumentDraft,
} from './ocr.schema.js';

export interface RawOCRResult {
  raw_text: string;
  document_type: OCRDocumentCategory;
  confidence: number;
  data: ExtractedData;
  evidence: ExtractedFieldEvidence[];
  is_mock?: boolean;
}

export interface IOCRProvider {
  extract(fileBuffer: Buffer, mimeType: string, filename?: string): Promise<RawOCRResult>;
}

// Redaction helpers for sensitive PII (Account numbers, PAN, Aadhaar)
export function redactPII(text: string): string {
  if (!text) return text;
  // Mask 12-digit Aadhaar: 1234 5678 9012 or 123456789012 -> **** **** 9012
  let sanitized = text.replace(/\b\d{4}[ -]?\d{4}[ -]?(\d{4})\b/g, '**** **** $1');
  // Mask Bank Account Numbers (9 to 18 digits) leaving only last 4 digits
  sanitized = sanitized.replace(/\b(\d{5,14})(\d{4})\b/g, '****$2');
  // Mask Indian PAN: [A-Z]{5}[0-9]{4}[A-Z]{1} -> ABCDE****F
  sanitized = sanitized.replace(/\b([A-Z]{5})\d{4}([A-Z]{1})\b/gi, '$1****$2');
  return sanitized;
}

// Prompt injection detection in document text
export function sanitizeDocumentText(text: string): { sanitized: string; hasPotentialInjection: boolean } {
  const injectionPatterns = [
    /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
    /system\s*:\s*you\s+are/i,
    /drop\s+table/i,
    /delete\s+from/i,
    /override\s+system\s+prompt/i,
    /you\s+must\s+confirm\s+this\s+transaction/i,
  ];

  let hasPotentialInjection = false;
  for (const pattern of injectionPatterns) {
    if (pattern.test(text)) {
      hasPotentialInjection = true;
      break;
    }
  }

  // PII Redaction
  const sanitized = redactPII(text);
  return { sanitized, hasPotentialInjection };
}

/**
 * Mock OCR Provider for Testing ONLY.
 * Strictly forbidden in production.
 */
export class MockOCRProvider implements IOCRProvider {
  async extract(fileBuffer: Buffer, mimeType: string, filename: string = 'sample.pdf'): Promise<RawOCRResult> {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError('Mock OCR cannot run in production', 500, 'MOCK_OCR_FORBIDDEN_IN_PRODUCTION');
    }

    const rawString = fileBuffer.toString('utf-8');
    const { sanitized, hasPotentialInjection } = sanitizeDocumentText(rawString);

    const lowerName = filename.toLowerCase();
    const lowerContent = sanitized.toLowerCase();

    // 1. Determine Document Type based on content or filename
    let docType: OCRDocumentCategory = 'OTHER_FINANCIAL_DOCUMENT';
    if (lowerName.includes('bank') || lowerName.includes('statement') || lowerContent.includes('opening balance') || lowerContent.includes('closing balance')) {
      docType = 'BANK_STATEMENT';
    } else if (lowerName.includes('salary') || lowerName.includes('payslip') || lowerContent.includes('gross salary') || lowerContent.includes('basic pay')) {
      docType = 'SALARY_SLIP';
    } else if (lowerName.includes('invest') || lowerName.includes('portfolio') || lowerName.includes('cas') || lowerContent.includes('mutual fund') || lowerContent.includes('equity holdings')) {
      docType = 'INVESTMENT_STATEMENT';
    } else if (lowerName.includes('insurance') || lowerName.includes('policy') || lowerContent.includes('sum assured') || lowerContent.includes('premium amount')) {
      docType = 'INSURANCE_DOCUMENT';
    } else if (lowerName.includes('tax') || lowerName.includes('itr') || lowerName.includes('form16') || lowerName.includes('form 16') || lowerContent.includes('assessment year')) {
      docType = 'TAX_DOCUMENT';
    }

    // Evidence container
    const evidence: ExtractedFieldEvidence[] = [];

    // 2. Extract deterministic draft data based on docType
    let extractedData: ExtractedData;

    switch (docType) {
      case 'SALARY_SLIP': {
        const grossMatch = sanitized.match(/gross\s*(?:salary|income)?[:\s]*₹?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i);
        const netMatch = sanitized.match(/net\s*(?:salary|pay|income)?[:\s]*₹?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i);
        const tdsMatch = sanitized.match(/tds[:\s]*₹?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i);
        const employerMatch = sanitized.match(/employer[:\s]*([A-Za-z0-9\s.,]+)/i);

        const gross = grossMatch ? parseFloat(grossMatch[1].replace(/,/g, '')) : 120000;
        const net = netMatch ? parseFloat(netMatch[1].replace(/,/g, '')) : 95000;
        const tds = tdsMatch ? parseFloat(tdsMatch[1].replace(/,/g, '')) : 15000;
        const deductions = gross - net > 0 ? gross - net : 25000;
        const employer = employerMatch ? employerMatch[1].trim() : 'Acme Technologies Pvt Ltd';

        evidence.push({
          field_name: 'gross_income',
          value: gross,
          confidence: 0.95,
          raw_text: grossMatch ? grossMatch[0] : `Gross Salary: ${gross}`,
          page_number: 1,
          section: 'Earnings',
        });
        evidence.push({
          field_name: 'net_income',
          value: net,
          confidence: 0.98,
          raw_text: netMatch ? netMatch[0] : `Net Pay: ${net}`,
          page_number: 1,
          section: 'Earnings',
        });
        evidence.push({
          field_name: 'employer',
          value: employer,
          confidence: 0.90,
          raw_text: employerMatch ? employerMatch[0] : `Employer: ${employer}`,
          page_number: 1,
          section: 'Header',
        });

        const draft: SalarySlipDraft = {
          employer,
          salary_period: '2026-08',
          gross_income: gross,
          net_income: net,
          deductions,
          tds,
          deductions_breakdown: [
            { name: 'Provident Fund (PF)', amount: 10000 },
            { name: 'TDS / Income Tax', amount: tds },
          ],
        };
        extractedData = draft;
        break;
      }

      case 'BANK_STATEMENT': {
        evidence.push({
          field_name: 'account_identifier',
          value: 'HDFC-****4321',
          confidence: 0.99,
          raw_text: 'Account: ****4321',
          page_number: 1,
          section: 'Header',
        });

        const draft: BankStatementDraft = {
          account_identifier: 'HDFC-****4321',
          statement_period: {
            start_date: '2026-08-01',
            end_date: '2026-08-31',
          },
          opening_balance: 50000,
          closing_balance: 82500,
          transactions: [
            {
              date: '2026-08-01',
              description: 'Salary Credit Acme Tech',
              amount: 95000,
              direction: 'credit',
              category: 'salary',
              merchant_name: 'Acme Tech',
              account_last4: '4321',
            },
            {
              date: '2026-08-05',
              description: 'Swiggy Food Delivery Bangalore',
              amount: 1250,
              direction: 'debit',
              category: 'food',
              merchant_name: 'Swiggy',
              account_last4: '4321',
            },
            {
              date: '2026-08-10',
              description: 'Electricity Bill BESCOM',
              amount: 2450,
              direction: 'debit',
              category: 'utilities',
              merchant_name: 'BESCOM',
              account_last4: '4321',
            },
          ],
        };

        evidence.push({
          field_name: 'transactions',
          value: draft.transactions.length,
          confidence: 0.92,
          raw_text: '3 line items extracted from page 1 & 2',
          page_number: 1,
          section: 'Statement Table',
        });

        extractedData = draft;
        break;
      }

      case 'INVESTMENT_STATEMENT': {
        const draft: InvestmentStatementDraft = {
          institution: 'CAMS / KFintech Consolidated Statement',
          statement_date: '2026-08-31',
          portfolio_total_value: 350000,
          disclaimer: 'Informational only. Personal AI CA does not offer personalized security advice, stock picking, or buy/sell execution.',
          holdings: [
            {
              instrument_name: 'Nifty 50 Index Fund Direct Growth',
              instrument_type: 'mutual_fund',
              quantity: 1200,
              unit_price: 150,
              current_value: 180000,
              cost_value: 150000,
            },
            {
              instrument_name: 'Parag Parikh Flexi Cap Fund Direct Growth',
              instrument_type: 'mutual_fund',
              quantity: 2500,
              unit_price: 68,
              current_value: 170000,
              cost_value: 140000,
            },
          ],
        };
        evidence.push({
          field_name: 'portfolio_total_value',
          value: 350000,
          confidence: 0.94,
          raw_text: 'Total Portfolio Valuation: ₹3,50,000',
          page_number: 1,
          section: 'Summary',
        });
        extractedData = draft;
        break;
      }

      case 'INSURANCE_DOCUMENT': {
        const draft: InsuranceDocumentDraft = {
          insurer: 'HDFC ERGO General Insurance',
          policy_type: 'health',
          policy_identifier: 'POL-****9876',
          premium_amount: 18500,
          premium_frequency: 'annual',
          policy_start_date: '2026-01-01',
          policy_end_date: '2026-12-31',
          sum_assured: 1000000,
        };
        evidence.push({
          field_name: 'sum_assured',
          value: 1000000,
          confidence: 0.96,
          raw_text: 'Sum Insured: ₹10,00,000',
          page_number: 1,
          section: 'Coverage Details',
        });
        extractedData = draft;
        break;
      }

      case 'TAX_DOCUMENT': {
        const draft: TaxDocumentDraft = {
          assessment_year: '2026-27',
          financial_year: '2025-26',
          total_income_declared: 1440000,
          gross_tax_payable: 125000,
          tds_deducted: 130000,
          tax_paid: 130000,
          refund_due: 5000,
          acknowledgment_number: 'ACK-****5432',
        };
        evidence.push({
          field_name: 'refund_due',
          value: 5000,
          confidence: 0.93,
          raw_text: 'Net Refund Receivable: ₹5,000',
          page_number: 1,
          section: 'Tax Computation',
        });
        extractedData = draft;
        break;
      }

      default: {
        const draft: OtherFinancialDocumentDraft = {
          document_summary: 'Generic financial record uploaded for verification.',
          extracted_key_values: {
            detected_type: 'Unclassified Document',
            processed_timestamp: new Date().toISOString(),
          },
        };
        evidence.push({
          field_name: 'document_summary',
          value: draft.document_summary,
          confidence: 0.75,
          raw_text: sanitized.slice(0, 100),
          page_number: 1,
          section: 'Body',
        });
        extractedData = draft;
        break;
      }
    }

    // Confidence baseline
    const confidence = hasPotentialInjection ? 0.4 : 0.91;

    return {
      raw_text: sanitized,
      document_type: docType,
      confidence,
      data: extractedData,
      evidence,
      is_mock: true,
    };
  }
}

/**
 * OCR Provider Factory
 * In production, if no real OCR provider (Document AI / Textract / Vision API) is configured,
 * it fails closed with AppError('OCR_PROVIDER_NOT_CONFIGURED', 400).
 */
export function getOCRProvider(): IOCRProvider {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTestMockAllowed = process.env.ENABLE_TEST_OCR_MOCK === 'true';

  // Strict check: Mock provider is never allowed in production
  if (isProduction && isTestMockAllowed) {
    throw new AppError('Mock OCR cannot be enabled in production environments.', 500, 'MOCK_OCR_FORBIDDEN_IN_PRODUCTION');
  }

  // In testing/dev, if test mock is explicitly allowed, return MockOCRProvider
  if (!isProduction && isTestMockAllowed) {
    return new MockOCRProvider();
  }

  // Real OCR provider check (e.g. AWS Textract, Google Document AI, or custom Vision endpoint)
  const hasRealOCRConfigured =
    Boolean(process.env.GOOGLE_DOCUMENT_AI_KEY) ||
    Boolean(process.env.AWS_TEXTRACT_KEY) ||
    Boolean(process.env.OCR_PROVIDER_API_KEY);

  if (!hasRealOCRConfigured) {
    throw new AppError('No production OCR extraction provider configured.', 400, 'OCR_PROVIDER_NOT_CONFIGURED');
  }

  // Future real provider implementation (e.g. GoogleDocumentAIProvider or TextractProvider)
  throw new AppError('Configured provider driver not loaded.', 501, 'REAL_OCR_PROVIDER_UNAVAILABLE');
}
