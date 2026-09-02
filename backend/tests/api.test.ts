import request from 'supertest';
import { createApp } from '../src/app.js';
import { redactSensitiveData } from '../src/middleware/logger.js';

const app = createApp();

let testTransactionId: string;
let testDocumentId: string;

const USER_A_ID = '11111111-1111-1111-1111-111111111111';
const USER_B_ID = '22222222-2222-2222-2222-222222222222';

async function runTests() {
  console.log('=== STARTING PERSONAL AI CA BACKEND INTEGRATION TESTS ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`, detail ? JSON.stringify(detail) : '');
      failed++;
    }
  }

  try {
    // 1. Health Endpoint
    const resHealth = await request(app).get('/health');
    assert(resHealth.status === 200 && resHealth.body.status === 'healthy', 'Health endpoint returns 200 healthy');

    // 2. Transaction Creation (Valid)
    const resCreateTx = await request(app)
      .post('/api/v1/transactions')
      .set('x-dev-user-id', USER_A_ID)
      .send({
        date: '2026-03-01',
        description: 'Health Insurance Premium (Tax 80D)',
        amount: 25000,
        currency: 'INR',
        type: 'debit',
        category: 'health_insurance',
        gst_applicable: true,
        gst_amount: 4500,
      });
    assert(resCreateTx.status === 201 && resCreateTx.body.data.id, 'Transaction creation succeeds with 201', resCreateTx.body);
    assert(resCreateTx.body.data.is_tax_relevant === true, 'Business logic auto-flags 80D health insurance as tax-relevant');
    testTransactionId = resCreateTx.body.data.id;

    // 3. Transaction Retrieval by ID
    const resGetTx = await request(app)
      .get(`/api/v1/transactions/${testTransactionId}`)
      .set('x-dev-user-id', USER_A_ID);
    assert(resGetTx.status === 200 && resGetTx.body.data.id === testTransactionId, 'Get transaction by ID returns 200');

    // 4. Transaction Listing
    const resListTx = await request(app)
      .get('/api/v1/transactions')
      .set('x-dev-user-id', USER_A_ID)
      .query({ limit: 10 });
    assert(resListTx.status === 200 && Array.isArray(resListTx.body.data) && resListTx.body.data.length > 0, 'List transactions returns user transactions array');

    // 5. Transaction Update
    const resUpdateTx = await request(app)
      .put(`/api/v1/transactions/${testTransactionId}`)
      .set('x-dev-user-id', USER_A_ID)
      .send({ notes: 'Verified policy renewal receipt' });
    assert(resUpdateTx.status === 200 && resUpdateTx.body.data.notes === 'Verified policy renewal receipt', 'Update transaction succeeds');

    // 6. Transaction Validation: GST exceeds amount
    const resInvalidGst = await request(app)
      .post('/api/v1/transactions')
      .set('x-dev-user-id', USER_A_ID)
      .send({
        date: '2026-03-01',
        description: 'Invalid GST test',
        amount: 1000,
        currency: 'INR',
        type: 'debit',
        gst_applicable: true,
        gst_amount: 1500, // Invalid: GST > amount
      });
    assert(resInvalidGst.status === 400 && resInvalidGst.body.error.code === 'VALIDATION_ERROR', 'Rejects transaction when GST amount exceeds total amount');

    // 7. Security Test A: User B attempts to access User A's transaction
    const resCrossTx = await request(app)
      .get(`/api/v1/transactions/${testTransactionId}`)
      .set('x-dev-user-id', USER_B_ID); // User B requesting User A's record
    assert(resCrossTx.status === 403 || resCrossTx.status === 404, 'Security Test A: Cross-user transaction access is DENIED (403/404)', resCrossTx.body);

    // 8. Security Test B: Client attempts to supply another user's user_id in body
    const resSpoofUser = await request(app)
      .post('/api/v1/transactions')
      .set('x-dev-user-id', USER_A_ID)
      .send({
        user_id: USER_B_ID, // Attempt to spoof User B
        date: '2026-03-01',
        description: 'Spoofed transaction',
        amount: 500,
        type: 'debit',
      });
    assert(resSpoofUser.status === 403 && resSpoofUser.body.error.code === 'FORBIDDEN_USER_ID_OVERRIDE', 'Security Test B: Client user_id spoofing in body is REJECTED (403)');

    // 9. Document Metadata Creation (Valid)
    const resCreateDoc = await request(app)
      .post('/api/v1/documents')
      .set('x-dev-user-id', USER_A_ID)
      .send({
        file_name: 'bank_statement_fy2025_26.pdf',
        file_type: 'pdf',
        file_size_bytes: 1048576, // 1MB
        mime_type: 'application/pdf',
        document_type: 'bank_statement',
        financial_year: '2025-26',
      });
    assert(resCreateDoc.status === 201 && resCreateDoc.body.data.id, 'Document metadata creation succeeds with 201', resCreateDoc.body);
    testDocumentId = resCreateDoc.body.data.id;

    // 10. Document Retrieval with signed download boundary
    const resGetDoc = await request(app)
      .get(`/api/v1/documents/${testDocumentId}`)
      .set('x-dev-user-id', USER_A_ID);
    assert(resGetDoc.status === 200 && resGetDoc.body.data.id === testDocumentId, 'Get document returns 200 with download boundary');

    // 11. Security Test C: User B attempts to access User A's document
    const resCrossDoc = await request(app)
      .get(`/api/v1/documents/${testDocumentId}`)
      .set('x-dev-user-id', USER_B_ID);
    assert(resCrossDoc.status === 403 || resCrossDoc.status === 404, 'Security Test C: Cross-user document access is DENIED (403/404)');

    // 12. Security Test D: Malformed transaction amount
    const resMalformedAmt = await request(app)
      .post('/api/v1/transactions')
      .set('x-dev-user-id', USER_A_ID)
      .send({
        date: '2026-03-01',
        description: 'Malformed amount',
        amount: -500, // Negative amount
        type: 'debit',
      });
    assert(resMalformedAmt.status === 400 && resMalformedAmt.body.error.code === 'VALIDATION_ERROR', 'Security Test D: Negative/malformed transaction amount rejected');

    // 13. Security Test E: Unsupported document MIME type
    const resBadMime = await request(app)
      .post('/api/v1/documents')
      .set('x-dev-user-id', USER_A_ID)
      .send({
        file_name: 'script.exe',
        file_type: 'exe',
        file_size_bytes: 2048,
        mime_type: 'application/x-msdownload', // Disallowed MIME
        document_type: 'other',
      });
    assert(resBadMime.status === 400 && resBadMime.body.error.code === 'VALIDATION_ERROR', 'Security Test E: Disallowed document MIME type rejected');

    // 14. Security Test F: Missing required fields
    const resMissingFields = await request(app)
      .post('/api/v1/transactions')
      .set('x-dev-user-id', USER_A_ID)
      .send({});
    assert(resMissingFields.status === 400 && resMissingFields.body.error.code === 'VALIDATION_ERROR', 'Security Test F: Missing required fields rejected');

    // 15. Security Test G: Data Redaction test
    const unredactedData = {
      user_id: USER_A_ID,
      pan: 'ABCDE1234F',
      gstin: '27ABCDE1234F1Z5',
      authorization: 'Bearer secret_token_value',
      notes: 'Customer PAN is ABCDE1234F and phone is 9999999999',
    };
    const cleaned = redactSensitiveData(unredactedData);
    assert(
      cleaned.pan === '[REDACTED]' &&
      cleaned.gstin === '[REDACTED]' &&
      cleaned.authorization === '[REDACTED]' &&
      cleaned.notes.includes('[REDACTED_PAN]'),
      'Security Test G: Redaction filter sanitizes PAN, GSTIN, and Auth tokens'
    );

    // 16. Chat API Boundary
    const resChat = await request(app)
      .post('/api/v1/chat')
      .set('x-dev-user-id', USER_A_ID)
      .send({
        message: 'How do I optimize my Section 80C deductions for FY 2025-26?',
        context_type: 'tax_query',
      });
    assert(
      resChat.status === 200 &&
      resChat.body.data.status === 'service_boundary_active' &&
      resChat.body.data.ai_layer_status === 'PENDING_STEP_5_AI_INTEGRATION',
      'Chat route operates within controlled Step 3 service boundary without fabricated output'
    );

    // 17. Report API Boundary
    const resReport = await request(app)
      .post('/api/v1/reports/generate')
      .set('x-dev-user-id', USER_A_ID)
      .send({
        report_type: 'tax_summary',
        financial_year: '2025-26',
      });
    assert(
      resReport.status === 200 &&
      resReport.body.data.report_type === 'tax_summary' &&
      resReport.body.data.disclaimer.includes('DISCLAIMER') &&
      typeof resReport.body.data.summary.total_transactions_analyzed === 'number',
      'Report route generates aggregation with statutory CA disclaimer'
    );

    // 18. Transaction Deletion
    const resDeleteTx = await request(app)
      .delete(`/api/v1/transactions/${testTransactionId}`)
      .set('x-dev-user-id', USER_A_ID);
    assert(resDeleteTx.status === 200 && resDeleteTx.body.data.success === true, 'Delete transaction succeeds');

    // 19. 404 Route handling
    const res404 = await request(app).get('/api/v1/unknown-endpoint');
    assert(res404.status === 404 && res404.body.error.code === 'NOT_FOUND', 'Centralized error handler catches 404 routes');

    // 20. Malformed JSON handling
    const resMalformedJson = await request(app)
      .post('/api/v1/transactions')
      .set('Content-Type', 'application/json')
      .send('{ "invalid": json syntax here');
    assert(resMalformedJson.status === 400 && resMalformedJson.body.error.code === 'INVALID_JSON', 'Malformed JSON caught with clean machine-readable error');

  } catch (err: any) {
    console.error('Unexpected test exception:', err);
    failed++;
  }

  console.log(`\n=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
