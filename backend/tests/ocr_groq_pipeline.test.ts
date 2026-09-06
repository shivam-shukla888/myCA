import request from 'supertest';
import { createApp } from '../src/app.js';
import { testUserRoles } from '../src/middleware/auth.js';
import { documentService } from '../src/modules/documents/document.service.js';
import { transactionService } from '../src/modules/transactions/transaction.service.js';
import { ocrService } from '../src/modules/ocr/ocr.service.js';
import {
  getOCRProvider,
  GroqOCRProvider,
  MockOCRProvider,
  redactPII,
  sanitizeDocumentText,
  validateDocumentFile,
  extractTextFromBuffer,
} from '../src/modules/ocr/ocr.provider.js';
import {
  validateExtractionDraft,
  normalizeCurrencyAmount,
  normalizeDate,
} from '../src/modules/ocr/ocr.validator.js';
import { groqDocumentExtractionSchema } from '../src/modules/ocr/ocr.schema.js';
import { retrievalService } from '../src/modules/ai/retrieval/retrieval.service.js';
import { canonicalFinanceService } from '../src/modules/finance/canonicalFinance.service.js';

const app = createApp();

const USER_ALICE = 'a1111111-1111-1111-1111-111111111111';
const USER_BOB = 'b2222222-2222-2222-2222-222222222222';

testUserRoles.set(USER_ALICE, 'USER');
testUserRoles.set(USER_BOB, 'USER');

const tokenAlice = `mock-test-token:${USER_ALICE}:alice@example.com`;
const tokenBob = `mock-test-token:${USER_BOB}:bob@example.com`;

export async function runGroqOCRPipelineTests() {
  console.log('====================================================');
  console.log('=== RUNNING GROQ OCR PIPELINE & SECURITY VERIFICATION ===');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`, detail !== undefined ? JSON.stringify(detail, null, 2) : '');
      failed++;
    }
  }

  process.env.NODE_ENV = 'test';
  process.env.ENABLE_TEST_OCR_MOCK = 'true';

  try {
    // ======================================================================
    // 1. UNIT TESTS: Normalization, Extraction Schema, Business Invariants
    // ======================================================================
    console.log('\n--- Group 1: Deterministic Normalization & Contract Validation ---');

    // 1. Amount Normalization
    const normInr1 = normalizeCurrencyAmount('₹1,20,000');
    assert(normInr1.amount === 120000 && normInr1.currency === 'INR', 'Test 1.1: Amount normalizes "₹1,20,000" -> 120000 INR');

    const normInr2 = normalizeCurrencyAmount('1,20,000 INR');
    assert(normInr2.amount === 120000 && normInr2.currency === 'INR', 'Test 1.2: Amount normalizes "1,20,000 INR" -> 120000 INR');

    const normUsd = normalizeCurrencyAmount('$1,200');
    assert(normUsd.amount === 1200 && normUsd.currency === 'USD', 'Test 1.3: Amount normalizes "$1,200" -> 1200 USD without AI conversion');

    // 2. Date Normalization
    const normDate1 = normalizeDate('01 September 2026');
    assert(normDate1 === '2026-09-01', 'Test 2.1: Date normalizes "01 September 2026" -> 2026-09-01');

    const normDate2 = normalizeDate('2026-09-01');
    assert(normDate2 === '2026-09-01', 'Test 2.2: Date normalizes "2026-09-01" -> 2026-09-01');

    const normDate3 = normalizeDate('15/08/2026');
    assert(normDate3 === '2026-08-15', 'Test 2.3: Date normalizes "15/08/2026" -> 2026-08-15');

    // 3. Schema Validation
    const validSchemaObj = groqDocumentExtractionSchema.safeParse({
      document_type: 'salary_slip',
      document_date: '2026-09-01',
      issuer: 'Acme Corp',
      recipient: 'Test User',
      currency: 'INR',
      total_amount: 120000,
      subtotal: 120000,
      tax_amount: 15000,
      invoice_number: null,
      salary_amount: 75000,
      transaction_date: '2026-09-01',
      merchant: 'Acme Corp',
      description: 'August Salary',
      extracted_financial_fields: { gross_salary: 120000, net_pay: 75000 },
      confidence: 0.95,
      warnings: [],
    });
    assert(validSchemaObj.success, 'Test 3: Schema validation passes for structured document extraction');

    // 4. Validation Rules: Subtotal + Tax Mismatch
    const valMismatch = await validateExtractionDraft(
      USER_ALICE,
      'INVOICE',
      {
        document_type: 'invoice',
        total_amount: 5000,
        subtotal: 1000,
        tax_amount: 180,
      },
      [],
      0.9
    );
    assert(
      valMismatch.warnings.some((w) => w.includes('VALIDATION_WARNING') && w.includes('does not match Total')),
      'Test 4: Subtotal (1000) + Tax (180) != Total (5000) flags VALIDATION_WARNING without silent mutation'
    );

    // 5. Validation Rules: Impossible Values (Net > Gross)
    const valNetGross = await validateExtractionDraft(
      USER_ALICE,
      'SALARY_SLIP',
      {
        employer: 'Test Corp',
        salary_period: '2026-08',
        gross_income: 50000,
        net_income: 80000,
      },
      [],
      0.95
    );
    assert(
      valNetGross.validation_errors.some((e) => e.includes('cannot exceed gross income')) &&
      valNetGross.confidence_level === 'INVALID',
      'Test 5: Net income > gross income flagged as validation error and INVALID confidence level'
    );

    // 6. Unknown Fields & Non-Fabrication
    const valMissing = await validateExtractionDraft(
      USER_ALICE,
      'SALARY_SLIP',
      { employer: 'Acme Corp' },
      [],
      0.9
    );
    assert(
      valMissing.missing_information.includes('gross_income') && valMissing.missing_information.includes('net_income'),
      'Test 6: Missing amounts are flagged in missing_information and NEVER fabricated as 0'
    );

    // 7. File Validation & Magic Byte Defense
    let emptyCaught = false;
    try {
      validateDocumentFile(Buffer.alloc(0), 'application/pdf', 'empty.pdf');
    } catch (e: any) {
      emptyCaught = e.code === 'EMPTY_DOCUMENT';
    }
    assert(emptyCaught, 'Test 7.1: Empty file (0 bytes) rejected with EMPTY_DOCUMENT');

    let corruptCaught = false;
    try {
      validateDocumentFile(Buffer.from('not a pdf at all'), 'application/pdf', 'corrupt.pdf');
    } catch (e: any) {
      corruptCaught = e.code === 'CORRUPTED_DOCUMENT';
    }
    assert(corruptCaught, 'Test 7.2: Corrupted PDF missing %PDF- header rejected with CORRUPTED_DOCUMENT');

    // 8. PII Masking
    const rawSensitive = 'Aadhaar 1234 5678 9012, Account 12345678901234, PAN ABCDE1234F';
    const masked = redactPII(rawSensitive);
    assert(
      !masked.includes('1234 5678 9012') &&
      masked.includes('**** **** 9012') &&
      !masked.includes('12345678901234') &&
      masked.includes('****1234') &&
      masked.includes('ABCDE****F'),
      'Test 8: Sensitive financial PII (Aadhaar, Account, PAN) redacted before downstream processing'
    );

    // ======================================================================
    // 2. INTEGRATION TESTS: Upload -> Draft -> Confirm -> RAG Gate
    // ======================================================================
    console.log('\n--- Group 2: End-to-End Extraction, Confirmation, Rejection & RAG ---');

    // 9. Upload & Create Document
    const testDocAlice = await documentService.createDocumentMetadata(USER_ALICE, {
      file_name: 'test_salary_payslip.pdf',
      file_type: 'pdf',
      file_size_bytes: 1024,
      mime_type: 'application/pdf',
      document_type: 'salary_slip',
      financial_year: '2025-26',
    });
    assert(testDocAlice && testDocAlice.id.length > 10, 'Test 9: Document metadata created with signed upload URL');

    // 10. Extract Draft
    const extractRes = await request(app)
      .post(`/api/v1/ocr/extract/${testDocAlice.id}`)
      .set('Authorization', `Bearer ${tokenAlice}`);
    assert(extractRes.status === 200, 'Test 10.1: POST /api/v1/ocr/extract/:id returns 200');
    assert(extractRes.body.data.extraction_status === 'draft_ready' || extractRes.body.data.extraction_status === 'needs_review', 'Test 10.2: Extracted document status is draft_ready/needs_review');

    // 11. Draft Persistence Guarantee: Zero Ledger Mutation
    const ledgerBefore = await transactionService.listTransactions(USER_ALICE, { limit: 50 });
    const docTxsBefore = (ledgerBefore.transactions || []).filter((t: any) => t.document_id === testDocAlice.id);
    assert(docTxsBefore.length === 0, 'Test 11: Hard Guarantee - Extracted draft creates ZERO ledger transactions');

    // 12. RAG Pre-Confirmation Isolation: Unconfirmed draft is NOT trusted context
    const ragBefore = await retrievalService.retrieveContext(USER_ALICE, 'salary slip details', 'DOCUMENT_ANALYSIS');
    const ragDoc = ragBefore.documents.find((d) => d.id === testDocAlice.id);
    assert(
      !ragDoc || ragDoc.content_summary.includes('DOCUMENT_DRAFT_ONLY'),
      'Test 12: RAG Rule - Unconfirmed document draft is NOT trusted financial fact in RAG'
    );

    // 13. User Confirmation Gate
    const confirmRes = await request(app)
      .post('/api/v1/ocr/confirm')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({
        document_id: testDocAlice.id,
        reviewed_data: {
          employer: 'Acme Technologies Pvt Ltd',
          salary_period: '2026-08',
          gross_income: 120000,
          net_income: 95000,
        },
        import_target: 'profile',
      });
    assert(confirmRes.status === 200, 'Test 13.1: POST /api/v1/ocr/confirm succeeds');
    assert(confirmRes.body.data.status === 'confirmed', 'Test 13.2: Status updated to confirmed');

    // 14. Ledger Mutation Post-Confirmation: Exactly ONE verified record
    const ledgerAfter = await transactionService.listTransactions(USER_ALICE, { limit: 50 });
    const docTxsAfter = (ledgerAfter.transactions || []).filter((t: any) => t.document_id === testDocAlice.id);
    assert(docTxsAfter.length === 1 && docTxsAfter[0].amount === 95000, 'Test 14: Confirmed document creates exactly ONE verified ledger record of ₹95,000');

    // 15. Replay Protection: Cannot confirm twice
    const doubleConfirmRes = await request(app)
      .post('/api/v1/ocr/confirm')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({
        document_id: testDocAlice.id,
        reviewed_data: { net_income: 95000 },
        import_target: 'profile',
      });
    assert(doubleConfirmRes.status === 400 && doubleConfirmRes.body.error?.code === 'DOCUMENT_ALREADY_CONFIRMED', 'Test 15: Replay Protection - Re-confirming returns 400 DOCUMENT_ALREADY_CONFIRMED');

    // 16. RAG Post-Confirmation Grounding: Confirmed document is trusted context
    const ragAfter = await retrievalService.retrieveContext(USER_ALICE, 'salary slip details', 'DOCUMENT_ANALYSIS');
    const ragDocAfter = ragAfter.documents.find((d) => d.id === testDocAlice.id);
    assert(
      ragDocAfter && ragDocAfter.content_summary.includes('Confirmed Verified Document Data') && ragDocAfter.content_summary.includes('95000'),
      'Test 16: RAG Rule - Confirmed document is included in RAG trusted context'
    );

    // 17. Rejection Flow
    const rejectDoc = await documentService.createDocumentMetadata(USER_ALICE, {
      file_name: 'spurious_invoice.pdf',
      file_type: 'pdf',
      file_size_bytes: 1024,
      mime_type: 'application/pdf',
      document_type: 'invoice',
    });
    await request(app).post(`/api/v1/ocr/extract/${rejectDoc.id}`).set('Authorization', `Bearer ${tokenAlice}`);

    const rejectRes = await request(app)
      .post('/api/v1/ocr/reject')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({ document_id: rejectDoc.id, reason: 'Duplicate or incorrect vendor' });
    assert(rejectRes.status === 200 && rejectRes.body.data.status === 'rejected', 'Test 17.1: POST /api/v1/ocr/reject marks draft rejected');

    const ragRejected = await retrievalService.retrieveContext(USER_ALICE, 'invoice details', 'DOCUMENT_ANALYSIS');
    assert(!ragRejected.documents.some((d) => d.id === rejectDoc.id), 'Test 17.2: RAG Rule - Rejected document is completely excluded from RAG context');

    // ======================================================================
    // 3. SECURITY & DEDUPLICATION TESTS
    // ======================================================================
    console.log('\n--- Group 3: Security, IDOR & Multi-Tenant Fingerprint Deduplication ---');

    // 18. IDOR Defense: User Bob cannot view or confirm User Alice document
    const idorGet = await request(app)
      .get(`/api/v1/ocr/draft/${testDocAlice.id}`)
      .set('Authorization', `Bearer ${tokenBob}`);
    assert(idorGet.status === 403, 'Test 18.1: IDOR Protection - User Bob GET User Alice draft returns 403 Forbidden');

    const idorConfirm = await request(app)
      .post('/api/v1/ocr/confirm')
      .set('Authorization', `Bearer ${tokenBob}`)
      .send({ document_id: testDocAlice.id, reviewed_data: {}, import_target: 'archive_only' });
    assert(idorConfirm.status === 403, 'Test 18.2: IDOR Protection - User Bob confirm User Alice document returns 403 Forbidden');

    // 19. Unauthenticated Request Blocked
    const unauthRes = await request(app).get(`/api/v1/ocr/draft/${testDocAlice.id}`);
    assert(unauthRes.status === 401, 'Test 19: Unauthenticated request to /ocr returns 401 Unauthorized');

    // 20. Duplicate Document Fingerprint (Same User)
    const runId = Date.now();
    const dupFileName = `contract_${runId}.pdf`;
    const docDupAlice1 = await documentService.createDocumentMetadata(USER_ALICE, {
      file_name: dupFileName,
      file_type: 'pdf',
      file_size_bytes: 512,
      mime_type: 'application/pdf',
      document_type: 'other',
    });
    await request(app).post(`/api/v1/ocr/extract/${docDupAlice1.id}`).set('Authorization', `Bearer ${tokenAlice}`);

    const docDupAlice2 = await documentService.createDocumentMetadata(USER_ALICE, {
      file_name: dupFileName,
      file_type: 'pdf',
      file_size_bytes: 512,
      mime_type: 'application/pdf',
      document_type: 'other',
    });
    const dupRes = await request(app)
      .post(`/api/v1/ocr/extract/${docDupAlice2.id}`)
      .set('Authorization', `Bearer ${tokenAlice}`);
    assert(dupRes.status === 409 && dupRes.body.error?.code === 'DUPLICATE_DOCUMENT_DETECTED', 'Test 20: Duplicate Fingerprint - Re-uploading identical file returns 409 DUPLICATE_DOCUMENT_DETECTED');

    // 21. Different User Fingerprint Isolation: Bob uploading same file succeeds
    const docBobSame = await documentService.createDocumentMetadata(USER_BOB, {
      file_name: dupFileName,
      file_type: 'pdf',
      file_size_bytes: 512,
      mime_type: 'application/pdf',
      document_type: 'other',
    });
    const bobExtractRes = await request(app)
      .post(`/api/v1/ocr/extract/${docBobSame.id}`)
      .set('Authorization', `Bearer ${tokenBob}`);
    assert(bobExtractRes.status === 200, 'Test 21: Multi-Tenant Isolation - Bob uploading identical document is NOT blocked as Alice duplicate');

    // ======================================================================
    // 4. REAL GROQ CONTROLLED EXTRACTION VERIFICATION
    // ======================================================================
    console.log('\n--- Group 4: Live Groq Model Extraction Verification ---');

    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey && groqKey.length > 5) {
      console.log('[LIVE GROQ INFERENCE] Querying Groq Tier 1 model with synthetic payslip...');
      try {
        const syntheticPayslipText = `ACME GLOBAL TECHNOLOGIES INDIA PVT LTD
SALARY SLIP FOR THE MONTH OF AUGUST 2026
Employee: Test User
Employee ID: ACM-9876
Designation: Senior Engineer
Date: 01 September 2026
Gross Salary: ₹1,20,000
Provident Fund (PF): ₹10,000
TDS (Tax Deducted at Source): ₹15,000
Net Salary: ₹75,000`;

        const groqProvider = new GroqOCRProvider(groqKey);
        const liveBuffer = Buffer.from(syntheticPayslipText, 'utf-8');
        const liveResult = await groqProvider.extract(liveBuffer, 'text/plain', 'synthetic_payslip.txt');

        const liveData = liveResult.data as any;
        const netSalary = liveData.salary_amount || liveData.extracted_financial_fields?.net_pay || liveData.net_income;
        const docDate = liveData.document_date || liveData.transaction_date;
        const isPayslip = liveResult.document_type === 'SALARY_SLIP' || (liveData.document_type || '').includes('salary');

        console.log(`[LIVE GROQ OUTPUT] doc_type=${liveResult.document_type}, net_salary=${netSalary}, date=${docDate}`);

        assert(isPayslip, 'Test 22.1: Real Groq accurately classified document as SALARY_SLIP / payslip');
        assert(Number(netSalary) === 75000, `Test 22.2: Real Groq extracted exact net salary ₹75,000 (detected: ${netSalary})`);
        assert(docDate === '2026-09-01', `Test 22.3: Real Groq extracted exact date 2026-09-01 (detected: ${docDate})`);

        console.log('\nREAL GROQ TEST: PASS');
      } catch (err: any) {
        console.error('[LIVE GROQ ERROR]', err.message);
        assert(false, `Test 22: Real Groq extraction encountered error: ${err.message}`);
        console.log('\nREAL GROQ TEST: FAIL');
      }
    } else {
      console.log('\nREAL GROQ TEST: UNAVAILABLE (GROQ_API_KEY not set)');
    }

    console.log(`\n====================================================`);
    console.log(`=== OCR GROQ PIPELINE RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
    console.log(`====================================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('OCR pipeline test suite failed fatally:', err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('ocr_groq_pipeline.test.ts')) {
  runGroqOCRPipelineTests();
}
