import { AppError } from '../../middleware/errorHandler.js';
import { getSupabaseAdminClient } from '../../config/supabase.js';
import { documentService } from '../documents/document.service.js';
import { transactionService } from '../transactions/transaction.service.js';
import { getOCRProvider } from './ocr.provider.js';
import { validateExtractionDraft } from './ocr.validator.js';
import { ConfirmDocumentInput, ExtractionResult } from './ocr.schema.js';

export class OCRService {
  /**
   * Extract document data into a structured review draft.
   * STRICT GUARANTEE: Does NOT create or mutate any financial records.
   */
  async extractDocument(userId: string, documentId: string): Promise<ExtractionResult> {
    if (!userId) {
      throw new AppError('User authentication required', 401, 'UNAUTHORIZED');
    }
    if (!documentId) {
      throw new AppError('Document ID is required', 400, 'INVALID_INPUT');
    }

    // 1. Fetch document and verify ownership (throws 403 if unauthorized, 404 if not found)
    const document = await documentService.getDocumentById(userId, documentId);

    // If already confirmed, return the existing confirmed draft
    if (document.extracted_data?.extraction_status === 'confirmed' || document.extracted_data?.confirmed_at) {
      return document.extracted_data as ExtractionResult;
    }

    // 2. Obtain file buffer
    let fileBuffer: Buffer;
    const isMockAllowed = process.env.NODE_ENV !== 'production' && process.env.ENABLE_TEST_OCR_MOCK === 'true';

    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase.storage.from('user-documents').download(document.storage_path);
      if (error || !data) {
        if (!isMockAllowed) {
          throw new AppError(`Failed to retrieve document binary from storage: ${error?.message || 'File not found'}`, 500, 'STORAGE_DOWNLOAD_FAILED');
        }
        let mockContent = `Document: ${document.file_name}\nType: ${document.document_type}`;
        if (document.document_type === 'bank_statement') {
          mockContent += `\nOpening Balance: ₹50,000\nClosing Balance: ₹82,500\nAccount: HDFC-****4321`;
        } else if (document.document_type === 'salary_slip') {
          mockContent += `\nGross Salary: ₹1,20,000\nNet Pay: ₹95,000\nTDS: ₹15,000\nEmployer: Acme Technologies Pvt Ltd`;
        } else if (document.document_type === 'tax_form_itr' || document.document_type === 'form_16') {
          mockContent += `\nAssessment Year: 2026-27\nTotal Income: ₹14,40,000\nTax Paid: ₹1,30,000`;
        }
        fileBuffer = Buffer.from(mockContent, 'utf-8');
      } else {
        const arrayBuffer = await data.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      }
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      if (!isMockAllowed) {
        throw new AppError(`Storage retrieval failed: ${err.message}`, 500, 'STORAGE_DOWNLOAD_FAILED');
      }
      let mockContent = `Document: ${document.file_name}\nType: ${document.document_type}`;
      fileBuffer = Buffer.from(mockContent, 'utf-8');
    }

    // 3. Run OCR Provider (strictly fails closed in production if unconfigured)
    const provider = getOCRProvider();
    const rawResult = await provider.extract(fileBuffer, document.mime_type, document.file_name);

    // 4. Validate extraction draft deterministically
    const validation = await validateExtractionDraft(
      userId,
      rawResult.document_type,
      rawResult.data,
      rawResult.evidence,
      rawResult.confidence
    );

    // 5. Build structured ExtractionResult
    const extractionResult: ExtractionResult = {
      document_id: documentId,
      document_type: rawResult.document_type,
      extraction_status: validation.extraction_status,
      confidence_score: validation.confidence_score,
      extracted_data: validation.validatedData,
      evidence: rawResult.evidence,
      missing_information: validation.missing_information,
      validation_errors: validation.validation_errors,
      warnings: validation.warnings,
      is_mock: rawResult.is_mock,
    };

    // 6. Persist draft into document metadata ONLY. NO ledger/financial mutations!
    await documentService.updateDocumentExtraction(userId, documentId, {
      extraction_status: 'completed',
      extraction_confidence: extractionResult.confidence_score,
      extracted_data: extractionResult,
    });

    return extractionResult;
  }

  /**
   * Retrieve the current structured draft for user review.
   */
  async getDraft(userId: string, documentId: string): Promise<ExtractionResult> {
    if (!userId) {
      throw new AppError('User authentication required', 401, 'UNAUTHORIZED');
    }
    const document = await documentService.getDocumentById(userId, documentId);

    if (!document.extracted_data) {
      throw new AppError('Document has not been extracted yet. Please initiate extraction first.', 404, 'DRAFT_NOT_FOUND');
    }

    return document.extracted_data as ExtractionResult;
  }

  /**
   * Confirm and import reviewed document data.
   * This is the ONLY gate through which financial records are created.
   * Replay-protected: A document cannot be confirmed twice.
   */
  async confirmAndImport(
    userId: string,
    input: ConfirmDocumentInput
  ): Promise<{
    success: boolean;
    message: string;
    document_id: string;
    imported_count: number;
    imported_record_ids: string[];
    status: 'confirmed';
  }> {
    if (!userId) {
      throw new AppError('User authentication required', 401, 'UNAUTHORIZED');
    }

    const { document_id, reviewed_data, import_target } = input;

    // 1. Fetch document and check ownership
    const document = await documentService.getDocumentById(userId, document_id);

    // 2. Strict replay prevention: Cannot confirm twice
    if (
      document.extracted_data?.extraction_status === 'confirmed' ||
      document.extracted_data?.confirmed_at
    ) {
      throw new AppError(
        'This document has already been reviewed and imported. Re-confirmation is blocked.',
        400,
        'DOCUMENT_ALREADY_CONFIRMED'
      );
    }

    if (!reviewed_data || typeof reviewed_data !== 'object') {
      throw new AppError('Reviewed data payload is required.', 400, 'INVALID_REVIEWED_DATA');
    }

    const importedRecordIds: string[] = [];

    // 3. Import actions based on target
    if (import_target === 'transactions') {
      const transactions = Array.isArray(reviewed_data.transactions) ? reviewed_data.transactions : [];

      for (const tx of transactions) {
        if (!tx.date || !tx.amount || !tx.description) {
          continue; // Skip malformed rows
        }

        const createdTx = await transactionService.createTransaction(userId, {
          date: tx.date,
          description: tx.description,
          amount: Number(tx.amount),
          currency: 'INR',
          type: tx.direction === 'credit' ? 'income' : 'expense',
          category: tx.category || 'uncategorized',
          merchant_name: tx.merchant_name || undefined,
          is_tax_relevant: false,
          gst_applicable: false,
          user_verified: true,
          confidence_score: 1.0,
          document_id: document.id,
          notes: `Confirmed via OCR import (${document.file_name})`,
        });

        importedRecordIds.push(createdTx.id);
      }
    } else if (import_target === 'profile') {
      // For salary slip or tax documents, record verified salary credit if gross/net provided
      if (reviewed_data.net_income && reviewed_data.net_income > 0) {
        const createdSalary = await transactionService.createTransaction(userId, {
          date: new Date().toISOString().slice(0, 10),
          description: `Verified Salary Credit (${reviewed_data.employer || document.file_name})`,
          amount: Number(reviewed_data.net_income),
          currency: 'INR',
          type: 'income',
          category: 'salary',
          is_tax_relevant: true,
          gst_applicable: false,
          user_verified: true,
          confidence_score: 1.0,
          document_id: document.id,
          notes: `Verified salary slip import for period ${reviewed_data.salary_period || 'N/A'}`,
        });
        importedRecordIds.push(createdSalary.id);
      }
    }

    // 4. Update document state to confirmed with audit metadata
    const confirmedDraft: ExtractionResult = {
      ...(document.extracted_data || {}),
      document_id,
      document_type: document.extracted_data?.document_type || 'OTHER_FINANCIAL_DOCUMENT',
      extraction_status: 'confirmed',
      confidence_score: document.extracted_data?.confidence_score ?? 1.0,
      extracted_data: reviewed_data as any,
      evidence: document.extracted_data?.evidence || [],
      missing_information: [],
      validation_errors: [],
      warnings: [],
      confirmed_at: new Date().toISOString(),
      imported_record_ids: importedRecordIds,
    };

    await documentService.updateDocumentExtraction(userId, document_id, {
      extraction_status: 'completed',
      extraction_confidence: confirmedDraft.confidence_score,
      extracted_data: confirmedDraft,
    });

    return {
      success: true,
      message: 'Document confirmed and imported successfully',
      document_id,
      imported_count: importedRecordIds.length,
      imported_record_ids: importedRecordIds,
      status: 'confirmed',
    };
  }
}

export const ocrService = new OCRService();
