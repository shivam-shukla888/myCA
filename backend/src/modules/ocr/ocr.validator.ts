import {
  OCRDocumentCategory,
  ExtractedData,
  ExtractedFieldEvidence,
  ExtractionResult,
  salarySlipDraftSchema,
  bankStatementDraftSchema,
  investmentStatementDraftSchema,
  insuranceDocumentDraftSchema,
  taxDocumentDraftSchema,
  otherFinancialDocumentDraftSchema,
  groqDocumentExtractionSchema,
  BankTransactionDraft,
  GroqDocumentExtraction,
} from './ocr.schema.js';
import { transactionService } from '../transactions/transaction.service.js';

export interface ValidationOutput {
  validatedData: ExtractedData;
  validation_errors: string[];
  missing_information: string[];
  warnings: string[];
  confidence_score: number;
  confidence_level: 'CONFIRMED' | 'REVIEW_REQUIRED' | 'LOW_CONFIDENCE' | 'INVALID' | 'UNAVAILABLE';
  extraction_status: 'draft_ready' | 'needs_review' | 'extraction_failed';
}

/**
 * Deterministic Currency and Amount Normalizer.
 * Normalizes Indian & Western formats to clean numeric amounts.
 * Preserves currency code (e.g. USD, EUR, INR) without attempting AI currency conversion.
 */
export function normalizeCurrencyAmount(rawVal: any): { amount: number | null; currency: string } {
  if (rawVal === null || rawVal === undefined || rawVal === '') {
    return { amount: null, currency: 'INR' };
  }

  if (typeof rawVal === 'number') {
    return { amount: isNaN(rawVal) ? null : rawVal, currency: 'INR' };
  }

  const str = String(rawVal).trim();
  let currency = 'INR';

  if (str.includes('$') || str.toUpperCase().includes('USD')) {
    currency = 'USD';
  } else if (str.includes('€') || str.toUpperCase().includes('EUR')) {
    currency = 'EUR';
  } else if (str.includes('£') || str.toUpperCase().includes('GBP')) {
    currency = 'GBP';
  } else if (str.includes('₹') || str.toUpperCase().includes('INR') || str.toUpperCase().includes('RS')) {
    currency = 'INR';
  }

  // Strip currency symbols, commas, spaces
  const cleaned = str.replace(/[₹$€£a-zA-Z,\s]/g, '').trim();
  const parsedNum = parseFloat(cleaned);

  return {
    amount: isNaN(parsedNum) ? null : parsedNum,
    currency,
  };
}

/**
 * Deterministic Date Normalizer.
 * Accepts ISO, DD-MM-YYYY, DD/MM/YYYY, or textual dates like "01 September 2026"
 * and converts them to YYYY-MM-DD.
 */
export function normalizeDate(rawVal: any): string | null {
  if (!rawVal || typeof rawVal !== 'string') return null;
  const str = rawVal.trim();

  // Standard YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Parse text formats e.g. "01 September 2026" or "Sep 1, 2026"
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return null;
}

export async function validateExtractionDraft(
  userId: string,
  docType: OCRDocumentCategory,
  rawData: any,
  evidence: ExtractedFieldEvidence[],
  rawConfidence: number
): Promise<ValidationOutput> {
  const validation_errors: string[] = [];
  const missing_information: string[] = [];
  const warnings: string[] = [];

  let validatedData: ExtractedData = rawData;
  let finalConfidence = Math.max(0.1, Math.min(0.98, rawConfidence || 0.85));

  switch (docType) {
    case 'SALARY_SLIP': {
      // Check if rawData is GroqDocumentExtraction format and convert/normalize if needed
      let gross = rawData.gross_income;
      let net = rawData.net_income;
      let deductions = rawData.deductions;
      let tds = rawData.tds;
      let employer = rawData.employer || rawData.issuer || rawData.merchant;
      let period = rawData.salary_period || rawData.document_date;

      if (rawData.extracted_financial_fields) {
        const ef = rawData.extracted_financial_fields;
        if (gross === undefined && ef.gross_salary !== undefined) gross = ef.gross_salary;
        if (net === undefined && (ef.net_pay !== undefined || rawData.salary_amount !== undefined)) {
          net = ef.net_pay !== undefined ? ef.net_pay : rawData.salary_amount;
        }
        if (deductions === undefined && ef.deductions !== undefined) deductions = ef.deductions;
        if (tds === undefined && ef.tds !== undefined) tds = ef.tds;
      }

      // Normalization of amounts
      if (gross !== undefined) gross = normalizeCurrencyAmount(gross).amount ?? undefined;
      if (net !== undefined) net = normalizeCurrencyAmount(net).amount ?? undefined;
      if (deductions !== undefined) deductions = normalizeCurrencyAmount(deductions).amount ?? undefined;
      if (tds !== undefined) tds = normalizeCurrencyAmount(tds).amount ?? undefined;

      const normalizedDraft = {
        employer: employer ? String(employer).trim() : undefined,
        salary_period: period ? String(period).trim() : undefined,
        gross_income: gross,
        net_income: net,
        deductions: deductions,
        tds: tds,
        deductions_breakdown: rawData.deductions_breakdown,
      };

      const parsed = salarySlipDraftSchema.safeParse(normalizedDraft);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          validation_errors.push(`Field '${issue.path.join('.')}': ${issue.message}`);
        }
      } else {
        const data = parsed.data;
        if (data.gross_income === undefined) missing_information.push('gross_income');
        if (data.net_income === undefined) missing_information.push('net_income');
        if (!data.employer) missing_information.push('employer');
        if (!data.salary_period) missing_information.push('salary_period');

        // Business validation: Mathematical validity
        if (data.gross_income !== undefined && data.net_income !== undefined) {
          if (data.net_income > data.gross_income) {
            validation_errors.push(
              `Net income (₹${data.net_income}) cannot exceed gross income (₹${data.gross_income})`
            );
          }

          if (data.deductions !== undefined) {
            const expectedNet = data.gross_income - data.deductions;
            const variance = Math.abs(expectedNet - data.net_income);
            if (variance > 50) {
              warnings.push(
                `Deductions variance detected: Gross (₹${data.gross_income}) - Deductions (₹${data.deductions}) does not match Net (₹${data.net_income}) by ₹${variance.toFixed(2)}`
              );
            }
          }
        }

        validatedData = data;
      }
      break;
    }

    case 'BANK_STATEMENT': {
      const parsed = bankStatementDraftSchema.safeParse(rawData);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          validation_errors.push(`Statement field '${issue.path.join('.')}': ${issue.message}`);
        }
      } else {
        const data = parsed.data;
        if (!data.transactions || data.transactions.length === 0) {
          warnings.push('No transactions detected in bank statement');
        } else {
          // Normalize transaction amounts and dates
          data.transactions = data.transactions.map((tx) => ({
            ...tx,
            amount: normalizeCurrencyAmount(tx.amount).amount || tx.amount,
            date: normalizeDate(tx.date) || tx.date,
          }));

          // Check for existing duplicate transactions in user ledger
          try {
            const existingRes = await transactionService.listTransactions(userId, { limit: 100, offset: 0 });
            const existing = existingRes.transactions || [];

            const checkedTransactions: BankTransactionDraft[] = [];

            for (const tx of data.transactions) {
              const matching = existing.find(
                (e) =>
                  e.date === tx.date &&
                  Math.abs(Number(e.amount) - tx.amount) < 0.01 &&
                  (e.description.toLowerCase().includes(tx.description.toLowerCase().slice(0, 8)) ||
                    tx.description.toLowerCase().includes(e.description.toLowerCase().slice(0, 8)))
              );

              if (matching) {
                checkedTransactions.push({
                  ...tx,
                  duplicate_warning: true,
                  duplicate_details: `Potential duplicate of existing transaction on ${matching.date} for ₹${matching.amount} (${matching.description})`,
                });
                warnings.push(
                  `Potential duplicate: ₹${tx.amount} on ${tx.date} (${tx.description}) matches existing record`
                );
              } else {
                checkedTransactions.push(tx);
              }
            }

            data.transactions = checkedTransactions;
          } catch {
            warnings.push('Could not verify duplicate transactions against existing ledger');
          }
        }

        validatedData = data;
      }
      break;
    }

    case 'RECEIPT':
    case 'INVOICE': {
      const parsed = groqDocumentExtractionSchema.safeParse(rawData);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          validation_errors.push(`Field '${issue.path.join('.')}': ${issue.message}`);
        }
      } else {
        const data = parsed.data;
        // Normalize amounts
        const normTotal = normalizeCurrencyAmount(data.total_amount);
        const normSubtotal = normalizeCurrencyAmount(data.subtotal);
        const normTax = normalizeCurrencyAmount(data.tax_amount);

        data.total_amount = normTotal.amount;
        data.currency = normTotal.currency || data.currency || 'INR';
        data.subtotal = normSubtotal.amount;
        data.tax_amount = normTax.amount;
        data.document_date = normalizeDate(data.document_date);
        data.transaction_date = normalizeDate(data.transaction_date);

        // Mathematical Consistency Check
        if (data.subtotal !== null && data.tax_amount !== null && data.total_amount !== null) {
          const expectedTotal = data.subtotal + data.tax_amount;
          const variance = Math.abs(expectedTotal - data.total_amount);
          if (variance > 1.0) {
            warnings.push(
              `VALIDATION_WARNING: Subtotal (₹${data.subtotal}) + Tax (₹${data.tax_amount}) = ₹${expectedTotal} does not match Total (₹${data.total_amount}) by ₹${variance.toFixed(2)}`
            );
          }
        }

        if (data.total_amount === null || data.total_amount === undefined) {
          missing_information.push('total_amount');
        }

        validatedData = data;
      }
      break;
    }

    case 'INVESTMENT_STATEMENT': {
      const parsed = investmentStatementDraftSchema.safeParse(rawData);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          validation_errors.push(`Field '${issue.path.join('.')}': ${issue.message}`);
        }
      } else {
        const data = parsed.data;
        if (!data.holdings || data.holdings.length === 0) {
          warnings.push('No holdings listed in investment statement');
        }
        if (!data.disclaimer || !data.disclaimer.includes('Informational only')) {
          data.disclaimer =
            'Informational only. Personal AI CA does not offer personalized security advice, stock picking, or buy/sell execution.';
        }
        validatedData = data;
      }
      break;
    }

    case 'INSURANCE_DOCUMENT': {
      const parsed = insuranceDocumentDraftSchema.safeParse(rawData);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          validation_errors.push(`Field '${issue.path.join('.')}': ${issue.message}`);
        }
      } else {
        const data = parsed.data;
        if (!data.policy_type) missing_information.push('policy_type');
        if (!data.sum_assured) missing_information.push('sum_assured');
        validatedData = data;
      }
      break;
    }

    case 'TAX_DOCUMENT': {
      const parsed = taxDocumentDraftSchema.safeParse(rawData);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          validation_errors.push(`Field '${issue.path.join('.')}': ${issue.message}`);
        }
      } else {
        validatedData = parsed.data;
      }
      break;
    }

    default: {
      const parsed = otherFinancialDocumentDraftSchema.safeParse(rawData);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          validation_errors.push(`Field '${issue.path.join('.')}': ${issue.message}`);
        }
      } else {
        validatedData = parsed.data;
      }
      break;
    }
  }

  // Adjust confidence based on errors, missing fields, or warnings
  if (validation_errors.length > 0) {
    finalConfidence = Math.max(0.1, finalConfidence - 0.3 * validation_errors.length);
  }
  if (missing_information.length > 0) {
    finalConfidence = Math.max(0.2, finalConfidence - 0.1 * missing_information.length);
  }
  if (warnings.length > 0) {
    finalConfidence = Math.max(0.2, finalConfidence - 0.05 * warnings.length);
  }

  const roundedConfidence = Math.round(finalConfidence * 100) / 100;

  // Determine extraction status & confidence level
  let extraction_status: 'draft_ready' | 'needs_review' | 'extraction_failed' = 'draft_ready';
  let confidence_level: 'CONFIRMED' | 'REVIEW_REQUIRED' | 'LOW_CONFIDENCE' | 'INVALID' | 'UNAVAILABLE' = 'REVIEW_REQUIRED';

  if (validation_errors.length > 0) {
    extraction_status = 'needs_review';
    confidence_level = 'INVALID';
  } else if (roundedConfidence < 0.6) {
    extraction_status = 'needs_review';
    confidence_level = 'LOW_CONFIDENCE';
  } else if (warnings.length > 0 || missing_information.length > 0) {
    extraction_status = 'needs_review';
    confidence_level = 'REVIEW_REQUIRED';
  }

  return {
    validatedData,
    validation_errors,
    missing_information,
    warnings,
    confidence_score: roundedConfidence,
    confidence_level,
    extraction_status,
  };
}
