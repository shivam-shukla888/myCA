import zlib from 'zlib';
import { AppError } from '../../middleware/errorHandler.js';
import { env } from '../../config/env.js';
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
  GroqDocumentExtraction,
  groqDocumentExtractionSchema,
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

// Redaction helpers for sensitive PII (Account numbers, PAN, Aadhaar, CVV, Card numbers)
export function redactPII(text: string): string {
  if (!text) return text;
  // Mask 12-digit Aadhaar: 1234 5678 9012 or 123456789012 -> **** **** 9012
  let sanitized = text.replace(/\b\d{4}[ -]?\d{4}[ -]?(\d{4})\b/g, '**** **** $1');
  // Mask 16-digit credit/debit card numbers
  sanitized = sanitized.replace(/\b(?:\d{4}[ -]?){3}(\d{4})\b/g, '**** **** **** $1');
  // Mask Bank Account Numbers (9 to 18 digits) leaving only last 4 digits
  sanitized = sanitized.replace(/\b(\d{5,14})(\d{4})\b/g, '****$2');
  // Mask Indian PAN: [A-Z]{5}[0-9]{4}[A-Z]{1} -> ABCDE****F
  sanitized = sanitized.replace(/\b([A-Z]{5})\d{4}([A-Z]{1})\b/gi, '$1****$2');
  // Mask 3-digit CVV
  sanitized = sanitized.replace(/\bcvv[:\s]*\d{3}\b/gi, 'CVV: ***');
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
    /disregard\s+all\s+safety/i,
    /act\s+as\s+administrator/i,
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
 * Validates document buffer for integrity, size limits, and header signatures.
 */
export function validateDocumentFile(fileBuffer: Buffer, mimeType: string, filename?: string): void {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new AppError('Uploaded document file is empty (0 bytes)', 400, 'EMPTY_DOCUMENT');
  }

  const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
  if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
    throw new AppError('Document exceeds maximum allowed size limit of 10MB', 400, 'FILE_TOO_LARGE');
  }

  const allowedMimeTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'text/plain',
    'text/csv',
  ];

  const lowerMime = (mimeType || '').toLowerCase();
  const lowerName = (filename || '').toLowerCase();

  const isAllowedMime = allowedMimeTypes.some((m) => lowerMime.includes(m));
  const isAllowedExt = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.txt', '.csv'].some((ext) => lowerName.endsWith(ext));

  if (!isAllowedMime && !isAllowedExt) {
    throw new AppError(
      `Unsupported document format (${mimeType || filename}). Supported formats: PDF, PNG, JPG, JPEG, WEBP, CSV, TXT.`,
      400,
      'UNSUPPORTED_DOCUMENT'
    );
  }

  // Magic header checks for corruption detection
  if (lowerMime.includes('pdf') || lowerName.endsWith('.pdf')) {
    const header = fileBuffer.subarray(0, 5).toString('ascii');
    if (!header.startsWith('%PDF-')) {
      throw new AppError('Corrupted or invalid PDF header signature.', 400, 'CORRUPTED_DOCUMENT');
    }
  } else if (lowerMime.includes('png') || lowerName.endsWith('.png')) {
    if (fileBuffer.length < 8 || fileBuffer[0] !== 0x89 || fileBuffer[1] !== 0x50 || fileBuffer[2] !== 0x4e || fileBuffer[3] !== 0x47) {
      throw new AppError('Corrupted PNG image file or invalid header.', 400, 'CORRUPTED_DOCUMENT');
    }
  } else if (lowerMime.includes('jpeg') || lowerMime.includes('jpg') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
    if (fileBuffer.length < 4 || fileBuffer[0] !== 0xff || fileBuffer[1] !== 0xd8) {
      throw new AppError('Corrupted JPEG image file or invalid header.', 400, 'CORRUPTED_DOCUMENT');
    }
  } else if (lowerMime.includes('webp') || lowerName.endsWith('.webp')) {
    if (fileBuffer.length < 12 || fileBuffer.subarray(0, 4).toString('ascii') !== 'RIFF' || fileBuffer.subarray(8, 12).toString('ascii') !== 'WEBP') {
      throw new AppError('Corrupted WEBP image file or invalid header.', 400, 'CORRUPTED_DOCUMENT');
    }
  }
}

/**
 * Extracts readable text streams from PDF and text documents.
 */
export function extractTextFromBuffer(fileBuffer: Buffer, mimeType: string, filename?: string): { text: string; isRasterOnly: boolean } {
  const lowerMime = (mimeType || '').toLowerCase();
  const lowerName = (filename || '').toLowerCase();

  // Plain text / CSV
  if (lowerMime.includes('text') || lowerName.endsWith('.txt') || lowerName.endsWith('.csv')) {
    return { text: fileBuffer.toString('utf-8'), isRasterOnly: false };
  }

  // PDF Document Stream Extraction
  if (lowerMime.includes('pdf') || lowerName.endsWith('.pdf')) {
    let extracted = '';
    let streamIdx = 0;

    // Iterate through PDF streams
    while ((streamIdx = fileBuffer.indexOf('stream', streamIdx)) !== -1) {
      const endIdx = fileBuffer.indexOf('endstream', streamIdx);
      if (endIdx === -1) break;

      let start = streamIdx + 6;
      if (fileBuffer[start] === 0x0d && fileBuffer[start + 1] === 0x0a) start += 2;
      else if (fileBuffer[start] === 0x0a || fileBuffer[start] === 0x0d) start += 1;

      const chunk = fileBuffer.subarray(start, endIdx);
      let chunkText = '';

      try {
        const inflated = zlib.inflateSync(chunk);
        chunkText = inflated.toString('utf-8');
      } catch {
        try {
          const unzipped = zlib.unzipSync(chunk);
          chunkText = unzipped.toString('utf-8');
        } catch {
          chunkText = chunk.toString('utf-8');
        }
      }

      if (chunkText) {
        // Extract string tokens from parentheses inside stream
        const textRegex = /\(([^)]+)\)/g;
        let m: RegExpExecArray | null;
        while ((m = textRegex.exec(chunkText)) !== null) {
          extracted += ' ' + m[1];
        }
      }

      streamIdx = endIdx + 9;
    }

    // Also scan raw document bytes for visible ASCII strings if stream extraction was empty
    if (extracted.trim().length < 15) {
      const rawAscii = fileBuffer.toString('latin1');
      const matches = rawAscii.match(/[A-Za-z0-9₹,.:/\s-]{6,}/g) || [];
      const filtered = matches.filter((s) => !s.startsWith('/Filter') && !s.startsWith('<<') && !s.startsWith('endobj'));
      extracted += ' ' + filtered.join(' ');
    }

    const trimmed = extracted.trim();
    if (trimmed.length < 10) {
      return { text: '', isRasterOnly: true };
    }
    return { text: trimmed, isRasterOnly: false };
  }

  // Raster Images (PNG/JPG)
  return { text: '', isRasterOnly: true };
}

/**
 * Real Groq OCR Provider
 * Uses Groq (openai/gpt-oss-120b) as the AI extraction and understanding engine.
 * Never performs financial arithmetic or writes to the database.
 */
export class GroqOCRProvider implements IOCRProvider {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.GROQ_API_KEY || env.GROQ_API_KEY || '';
    this.baseUrl = process.env.PRIMARY_AI_BASE_URL || 'https://api.groq.com/openai/v1';
    this.model = model || env.GROQ_MODEL || 'openai/gpt-oss-120b';
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 5);
  }

  async extract(fileBuffer: Buffer, mimeType: string, filename: string = 'document.pdf'): Promise<RawOCRResult> {
    if (!this.isConfigured()) {
      throw new AppError(
        'Groq OCR provider is not configured. GROQ_API_KEY is required.',
        500,
        'OCR_PROVIDER_NOT_CONFIGURED'
      );
    }

    // 1. Strict File Validation
    validateDocumentFile(fileBuffer, mimeType, filename);

    // 2. Extract text / Detect raster
    const { text, isRasterOnly } = extractTextFromBuffer(fileBuffer, mimeType, filename);

    // If file is purely a raster image without readable text layer and Groq model is text-based
    if (isRasterOnly || !text || text.trim().length === 0) {
      throw new AppError(
        'The uploaded document format or scanned raster image does not contain readable digital text. Groq text understanding requires digital or text-based documents.',
        422,
        'UNSUPPORTED_DOCUMENT'
      );
    }

    // 3. Security Sanitize & Redact PII
    const { sanitized, hasPotentialInjection } = sanitizeDocumentText(text);

    // 4. Prompt Construction with Strict 10 Governance Rules
    const systemPrompt = `You are extracting structured data from a user-provided financial document.

Rules:
1. Extract ONLY information visible in the supplied document.
2. Never invent missing values.
3. Never infer a value merely because it is common.
4. Preserve exact numeric amounts before normalization.
5. Clearly identify uncertain fields.
6. Return valid structured JSON matching the schema.
7. Do not provide financial advice.
8. Do not calculate investment recommendations.
9. Do not modify user financial state.
10. Do not treat extracted values as confirmed facts until the user confirms them.

If a field is not visible in the document, return null. Never return 0 for a missing field unless zero is explicitly stated.`;

    const userPrompt = `DOCUMENT CONTENT:
"""
${sanitized}
"""

OUTPUT FORMAT SPECIFICATION:
Return ONLY a valid JSON object matching this schema:
{
  "document_type": "receipt" | "invoice" | "salary_slip" | "bank_statement" | "tax_document" | "investment_statement" | "insurance_document" | "generic_financial_document" | "unknown",
  "document_date": "YYYY-MM-DD" | null,
  "issuer": string | null,
  "recipient": string | null,
  "currency": "INR" | "USD" | "EUR" | null,
  "total_amount": number | null,
  "subtotal": number | null,
  "tax_amount": number | null,
  "invoice_number": string | null,
  "salary_amount": number | null,
  "transaction_date": "YYYY-MM-DD" | null,
  "merchant": string | null,
  "description": string | null,
  "extracted_financial_fields": {
    "gross_salary": number | null,
    "net_pay": number | null,
    "deductions": number | null,
    "tds": number | null,
    "provident_fund": number | null
  },
  "confidence": number,
  "warnings": string[]
}`;

    const MAX_RETRIES = 2;
    let lastError: any = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
        const res = await fetch(url, {
          method: 'POST',
          signal: AbortSignal.timeout(15000),
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.1,
            max_tokens: 1500,
            response_format: { type: 'json_object' },
          }),
        });

        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          if (res.status === 429) {
            throw new AppError('Groq OCR rate limit exceeded (HTTP 429).', 429, 'OCR_RATE_LIMIT');
          }
          if (res.status >= 500) {
            throw new AppError(`Groq OCR server error (${res.status}): ${errBody.slice(0, 150)}`, res.status, 'OCR_PROVIDER_ERROR');
          }
          throw new AppError(`Groq OCR HTTP error (${res.status}): ${errBody.slice(0, 150)}`, res.status, 'OCR_PROVIDER_ERROR');
        }

        const resData: any = await res.json();
        const rawContent = resData.choices?.[0]?.message?.content;
        if (!rawContent) {
          throw new AppError('Empty response content received from Groq OCR model', 502, 'OCR_EMPTY_RESPONSE');
        }

        // Clean code fences if present
        const cleaned = rawContent.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        let parsed: any;
        try {
          parsed = JSON.parse(cleaned);
        } catch {
          throw new AppError('Groq OCR output could not be parsed as valid JSON', 502, 'OCR_MALFORMED_OUTPUT');
        }

        const validatedGroq = groqDocumentExtractionSchema.safeParse(parsed);
        const data = validatedGroq.success ? validatedGroq.data : (parsed as GroqDocumentExtraction);

        // Map document category safely
        let docType: OCRDocumentCategory = 'OTHER_FINANCIAL_DOCUMENT';
        const rawType = (data.document_type || '').toLowerCase();
        if (rawType.includes('salary') || rawType.includes('payslip')) {
          docType = 'SALARY_SLIP';
        } else if (rawType.includes('bank') || rawType.includes('statement')) {
          docType = 'BANK_STATEMENT';
        } else if (rawType.includes('invoice')) {
          docType = 'INVOICE';
        } else if (rawType.includes('receipt')) {
          docType = 'RECEIPT';
        } else if (rawType.includes('tax') || rawType.includes('itr') || rawType.includes('form16')) {
          docType = 'TAX_DOCUMENT';
        } else if (rawType.includes('invest') || rawType.includes('portfolio')) {
          docType = 'INVESTMENT_STATEMENT';
        } else if (rawType.includes('insurance')) {
          docType = 'INSURANCE_DOCUMENT';
        }

        // Build evidence provenance
        const evidence: ExtractedFieldEvidence[] = [];
        if (data.total_amount !== null && data.total_amount !== undefined) {
          evidence.push({
            field_name: 'total_amount',
            value: data.total_amount,
            confidence: data.confidence || 0.9,
            raw_text: `Total Amount: ${data.total_amount} ${data.currency || 'INR'}`,
            page_number: 1,
            section: 'Summary',
          });
        }
        if (data.salary_amount !== null && data.salary_amount !== undefined) {
          evidence.push({
            field_name: 'salary_amount',
            value: data.salary_amount,
            confidence: data.confidence || 0.95,
            raw_text: `Net Salary: ${data.salary_amount}`,
            page_number: 1,
            section: 'Earnings',
          });
        }
        if (data.issuer || data.merchant) {
          evidence.push({
            field_name: 'issuer',
            value: data.issuer || data.merchant,
            confidence: 0.9,
            raw_text: `Issuer: ${data.issuer || data.merchant}`,
            page_number: 1,
            section: 'Header',
          });
        }

        // Baseline confidence adjusted if injection attempt detected
        let confidence = data.confidence || 0.85;
        if (hasPotentialInjection) {
          confidence = Math.min(confidence, 0.4);
        }

        return {
          raw_text: sanitized,
          document_type: docType,
          confidence,
          data,
          evidence,
          is_mock: false,
        };
      } catch (err: any) {
        lastError = err;
        if (err instanceof AppError && err.code === 'OCR_RATE_LIMIT') {
          throw err;
        }
        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
    }

    throw new AppError(
      `Groq OCR extraction failed: ${lastError?.message || 'Unknown error'}`,
      lastError?.statusCode || 502,
      lastError?.code || 'OCR_PROVIDER_FAILURE'
    );
  }
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
    } else if (lowerName.includes('receipt') || lowerContent.includes('receipt')) {
      docType = 'RECEIPT';
    } else if (lowerName.includes('invoice') || lowerContent.includes('invoice')) {
      docType = 'INVOICE';
    }

    // Evidence container
    const evidence: ExtractedFieldEvidence[] = [];
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

      case 'INVOICE':
      case 'RECEIPT': {
        const draft: GroqDocumentExtraction = {
          document_type: docType === 'INVOICE' ? 'invoice' : 'receipt',
          document_date: '2026-08-15',
          issuer: 'Office Supplies Direct',
          recipient: 'User',
          currency: 'INR',
          total_amount: 1180,
          subtotal: 1000,
          tax_amount: 180,
          invoice_number: 'INV-2026-001',
          salary_amount: null,
          transaction_date: '2026-08-15',
          merchant: 'Office Supplies Direct',
          description: 'Stationery and supplies',
          extracted_financial_fields: {},
          confidence: 0.95,
          warnings: [],
        };
        evidence.push({
          field_name: 'total_amount',
          value: 1180,
          confidence: 0.95,
          raw_text: 'Total Amount: ₹1,180 (Subtotal: ₹1,000 + GST 18%: ₹180)',
          page_number: 1,
          section: 'Totals',
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
 * Fallback Provider when no external OCR service is available or configured.
 * Safely fails closed with an informative error rather than silently failing.
 */
export class FallbackNoOpProvider implements IOCRProvider {
  async extract(_fileBuffer: Buffer, _mimeType: string, _filename?: string): Promise<RawOCRResult> {
    throw new AppError(
      'OCR provider is not configured or currently unavailable. Please configure an OCR provider API key or upload statement manually.',
      503,
      'OCR_PROVIDER_UNAVAILABLE'
    );
  }
}

/**
 * OCR Provider Factory
 * In production or when no real OCR provider is configured, it safely returns
 * FallbackNoOpProvider (failing closed with a 503 error) unless test mock is explicitly allowed.
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

  // Real Groq OCR provider check
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey && groqKey.length > 5) {
    return new GroqOCRProvider(groqKey);
  }

  if (isProduction) {
    throw new AppError('No production OCR extraction provider configured.', 400, 'OCR_PROVIDER_NOT_CONFIGURED');
  }

  // Safe fallback in dev/staging when no provider key is present
  return new FallbackNoOpProvider();
}
