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
  BankTransactionDraft,
} from './ocr.schema.js';
import { transactionService } from '../transactions/transaction.service.js';

export interface ValidationOutput {
  validatedData: ExtractedData;
  validation_errors: string[];
  missing_information: string[];
  warnings: string[];
  confidence_score: number;
  extraction_status: 'draft_ready' | 'needs_review' | 'extraction_failed';
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
  let finalConfidence = Math.max(0, Math.min(1, rawConfidence));

  switch (docType) {
    case 'SALARY_SLIP': {
      const parsed = salarySlipDraftSchema.safeParse(rawData);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          validation_errors.push(`Field '${issue.path.join('.')}': ${issue.message}`);
        }
      } else {
        const data = parsed.data;
        // Business validation 1: Missing essentials
        if (data.gross_income === undefined) missing_information.push('gross_income');
        if (data.net_income === undefined) missing_information.push('net_income');
        if (!data.employer) missing_information.push('employer');
        if (!data.salary_period) missing_information.push('salary_period');

        // Business validation 2: Mathematical validity
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
          } catch (err) {
            // Non-blocking duplicate check error, record warning
            warnings.push('Could not verify duplicate transactions against existing ledger');
          }
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
        // Force deterministic non-advice disclaimer
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

  // Adjust confidence based on errors/missing fields
  if (validation_errors.length > 0) {
    finalConfidence = Math.max(0.1, finalConfidence - 0.3 * validation_errors.length);
  }
  if (missing_information.length > 0) {
    finalConfidence = Math.max(0.2, finalConfidence - 0.1 * missing_information.length);
  }

  // Determine extraction status
  let extraction_status: 'draft_ready' | 'needs_review' | 'extraction_failed' = 'draft_ready';
  if (validation_errors.length > 0) {
    extraction_status = 'needs_review';
  } else if (warnings.length > 0 || missing_information.length > 0 || finalConfidence < 0.85) {
    extraction_status = 'needs_review';
  }

  return {
    validatedData,
    validation_errors,
    missing_information,
    warnings,
    confidence_score: Math.round(finalConfidence * 100) / 100,
    extraction_status,
  };
}
