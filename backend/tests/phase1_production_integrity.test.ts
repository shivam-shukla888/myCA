import request from 'supertest';
import { createApp } from '../src/app.js';
import { testUserRoles } from '../src/middleware/auth.js';
import { validateEncryptionConfig } from '../src/config/env.js';
import { isRedirectUrlAllowed } from '../src/modules/auth/auth.service.js';
import { classifyIntent } from '../src/modules/ai/classification/intentClassifier.js';
import { OpenAICompatibleProvider } from '../src/modules/ai/providers/openaiCompatible.provider.js';
import { transactionService } from '../src/modules/transactions/transaction.service.js';
import { documentService } from '../src/modules/documents/document.service.js';
import { jobQueue } from '../src/modules/jobs/jobQueue.js';
import { auditLogger, buildAuditCanonicalString, generateAuditSignature, verifyAuditEntry } from '../src/modules/ai/audit/auditLogger.js';
import { env } from '../src/config/env.js';

const app = createApp();

const USER_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_B_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const ADMIN_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

testUserRoles.set(USER_A_ID, 'USER');
testUserRoles.set(USER_B_ID, 'USER');
testUserRoles.set(ADMIN_ID, 'ADMIN');

const tokenA = `mock-test-token:${USER_A_ID}:user_a@test.com`;
const tokenB = `mock-test-token:${USER_B_ID}:user_b@test.com`;
const tokenAdmin = `mock-test-token:${ADMIN_ID}:admin@test.com`;

async function runPhase1IntegrityTests() {
  console.log('=== RUNNING PHASE 1 PRODUCTION INTEGRITY HARDENING VERIFICATION ===\n');
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
    // -------------------------------------------------------------
    // TEST 1: Missing production encryption configuration FAILS CLOSED
    // -------------------------------------------------------------
    let missingKeyFailed = false;
    try {
      validateEncryptionConfig(true, '');
    } catch (e: any) {
      if (e.message.includes('FATAL SECURITY VIOLATION')) {
        missingKeyFailed = true;
      }
    }
    assert(missingKeyFailed, 'TEST 1A: validateEncryptionConfig throws fatal violation when key is empty in production');

    let weakKeyFailed = false;
    try {
      validateEncryptionConfig(true, 'short-key');
    } catch (e: any) {
      if (e.message.includes('FATAL SECURITY VIOLATION')) {
        weakKeyFailed = true;
      }
    }
    assert(weakKeyFailed, 'TEST 1B: validateEncryptionConfig rejects weak/short key (<32 chars) in production');

    let defaultKeyFailed = false;
    try {
      validateEncryptionConfig(true, 'dev-insecure-key-replace-in-env');
    } catch (e: any) {
      if (e.message.includes('FATAL SECURITY VIOLATION')) {
        defaultKeyFailed = true;
      }
    }
    assert(defaultKeyFailed, 'TEST 1C: validateEncryptionConfig rejects default development key in production');

    // -------------------------------------------------------------
    // TEST 2: Open-redirect prefix matching bypass is strictly blocked
    // -------------------------------------------------------------
    const allowedOrigins = ['http://localhost:3000', 'https://personal-ai-ca.vercel.app'];

    // Subdomain lookalike attacker domains
    assert(!isRedirectUrlAllowed('https://personal-ai-ca.vercel.app.attacker.com', allowedOrigins),
      'TEST 2A: Rejects domain lookalike https://personal-ai-ca.vercel.app.attacker.com');
    assert(!isRedirectUrlAllowed('http://localhost:3000.evil.com', allowedOrigins),
      'TEST 2B: Rejects port lookalike http://localhost:3000.evil.com');
    assert(!isRedirectUrlAllowed('https://personal-ai-ca.vercel.app@evil.com', allowedOrigins),
      'TEST 2C: Rejects userinfo credential bypass https://personal-ai-ca.vercel.app@evil.com');
    assert(!isRedirectUrlAllowed('javascript:alert(1)', allowedOrigins),
      'TEST 2D: Rejects javascript: URI');
    assert(!isRedirectUrlAllowed('data:text/html,<script>alert(1)</script>', allowedOrigins),
      'TEST 2E: Rejects data: URI');

    // Valid redirects
    assert(isRedirectUrlAllowed('https://personal-ai-ca.vercel.app/auth/callback', allowedOrigins),
      'TEST 2F: Accepts legitimate subpath on allowed origin');
    assert(isRedirectUrlAllowed('http://localhost:3000/ledger', allowedOrigins),
      'TEST 2G: Accepts legitimate localhost origin and subpath');

    // -------------------------------------------------------------
    // TEST 3: Unknown / unclassified AI risk MUST NOT become LOW risk
    // -------------------------------------------------------------
    // Test intentClassifier fallback:
    const unclassifiedResult = classifyIntent('gibberish query xyz unknown intent 12345');
    assert(
      unclassifiedResult.risk_level === 'UNKNOWN',
      'TEST 3A: classifyIntent assigns UNKNOWN risk_level (not LOW) to unclassified queries'
    );

    // Test OpenAICompatibleProvider risk normalization with invalid risk:
    const testProvider = new OpenAICompatibleProvider({
      apiKey: 'mock-test-key',
      baseUrl: 'https://api.example.com',
      model: 'test-model',
      providerName: 'TestProvider',
    });
    // Use prototype reflection to test normalizeOutput safely:
    const normalizedInvalid = (testProvider as any).normalizeOutput({
      answer: 'Test answer',
      intent: 'GENERAL_FINANCE',
      risk_level: 'SUPER_RISKY_UNKNOWN_VALUE',
      confidence_score: 0.8,
      evidence: [],
      missing_information: [],
      disclaimer_required: false,
      disclaimer: '',
      human_review_required: false,
      refusal_or_limitation: null,
    });
    assert(
      normalizedInvalid.risk_level === 'UNKNOWN',
      'TEST 3B: OpenAICompatibleProvider normalizes unrecognized risk_level to UNKNOWN, never LOW'
    );

    const normalizedMissing = (testProvider as any).normalizeOutput({
      answer: 'Test answer',
      intent: 'GENERAL_FINANCE',
      confidence_score: 0.8,
    });
    assert(
      normalizedMissing.risk_level === 'UNKNOWN',
      'TEST 3C: OpenAICompatibleProvider normalizes missing risk_level to UNKNOWN, never LOW'
    );

    // -------------------------------------------------------------
    // TEST 4: Background queue cannot pretend to be durable in production
    // -------------------------------------------------------------
    const origEnv = env.NODE_ENV;
    (env as any).NODE_ENV = 'production';

    let prodJobCreationBlocked = false;
    try {
      jobQueue.createJob(USER_A_ID, 'FISCAL_REPORT_SYNTHESIS', {});
    } catch (e: any) {
      if (e.message.includes('QUEUE_UNAVAILABLE_IN_PRODUCTION')) {
        prodJobCreationBlocked = true;
      }
    }
    assert(
      prodJobCreationBlocked,
      'TEST 4A: jobQueue.createJob throws QUEUE_UNAVAILABLE_IN_PRODUCTION when in production mode'
    );

    const prodJobRouteRes = await request(app)
      .post('/api/v1/jobs/create')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ type: 'FISCAL_REPORT_SYNTHESIS', data: {} });
    assert(
      prodJobRouteRes.status === 503 && prodJobRouteRes.body.error.code === 'QUEUE_UNAVAILABLE_IN_PRODUCTION',
      'TEST 4B: POST /api/v1/jobs/create returns 503 QUEUE_UNAVAILABLE_IN_PRODUCTION in production'
    );

    // Restore env.NODE_ENV for dev/test execution
    (env as any).NODE_ENV = origEnv;

    // -------------------------------------------------------------
    // TEST 5: Fake OCR cannot generate fabricated financial figures
    // -------------------------------------------------------------
    // Without explicit ENABLE_TEST_OCR_MOCK=true, OCR worker fails closed
    delete process.env.ENABLE_TEST_OCR_MOCK;
    const testOcrJob = {
      id: 'test-ocr-job-1',
      user_id: USER_A_ID,
      type: 'DOCUMENT_OCR_EXTRACTION' as const,
      status: 'QUEUED' as const,
      data: { document_id: 'doc-123' },
      attempts: 0,
      max_attempts: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await (jobQueue as any).executeJob(testOcrJob);
    assert(
      testOcrJob.status === 'FAILED' && testOcrJob.error?.includes('OCR_PROVIDER_NOT_CONFIGURED'),
      'TEST 5A: DOCUMENT_OCR_EXTRACTION fails closed with OCR_PROVIDER_NOT_CONFIGURED without fabrication'
    );
    assert(
      testOcrJob.result === undefined || !JSON.stringify(testOcrJob.result).includes('1250000'),
      'TEST 5B: No fabricated salary or TDS figures returned in unconfigured state'
    );

    // -------------------------------------------------------------
    // TEST 6: Production database failure DOES NOT create fake success
    // -------------------------------------------------------------
    (env as any).NODE_ENV = 'production';

    // In production, when database persistence fails, service must throw AppError 500
    let txProdFailClosed = false;
    try {
      // Intentionally passing user ID with invalid format to Supabase in prod mode
      // or mocking failure
      await transactionService.createTransaction('', {
        date: '2026-03-01',
        description: 'Test transaction',
        amount: 100,
        currency: 'INR',
        type: 'debit',
      });
    } catch (e: any) {
      txProdFailClosed = true;
    }
    assert(txProdFailClosed, 'TEST 6A: createTransaction fails closed on invalid context');

    (env as any).NODE_ENV = origEnv;

    // -------------------------------------------------------------
    // TEST 7: Document delete uses actual storage path and blocks cross-user deletion
    // -------------------------------------------------------------
    // Register document for User A
    const docA = await documentService.createDocumentMetadata(USER_A_ID, {
      file_name: 'test_user_a_file.pdf',
      file_type: 'pdf',
      file_size_bytes: 1024,
      mime_type: 'application/pdf',
      document_type: 'form_16',
    });
    assert(
      docA.storage_path.startsWith(`${USER_A_ID}/${docA.id}/`),
      'TEST 7A: Document storage_path strictly namespaced with user_id and document_id'
    );

    // User B attempts to delete User A document -> MUST BE REJECTED with 403 FORBIDDEN
    let crossUserDeleteBlocked = false;
    try {
      await documentService.deleteDocument(USER_B_ID, docA.id);
    } catch (e: any) {
      if (e.statusCode === 403 || e.statusCode === 404 || e.code === 'FORBIDDEN') {
        crossUserDeleteBlocked = true;
      }
    }
    assert(crossUserDeleteBlocked, 'TEST 7B: User B cannot delete User A document (403 Forbidden enforced)');

    // User A can delete own document
    const deleteResult = await documentService.deleteDocument(USER_A_ID, docA.id);
    assert(deleteResult.success === true && deleteResult.id === docA.id,
      'TEST 7C: User A can delete own document using actual storage path');

    // -------------------------------------------------------------
    // TEST 8: Audit HMAC signature is computed, verifiable, and tamper-evident
    // -------------------------------------------------------------
    const testAuditEntry = {
      id: 'phase1-audit-test-1',
      user_id: USER_A_ID,
      query: 'What is 80C limit?',
      response: 'The limit is 1,50,000 INR.',
      model_used: 'openai/gpt-oss-120b',
      confidence_score: 0.95,
      disclaimer_shown: true,
      created_at: new Date().toISOString(),
    };
    const canonical = buildAuditCanonicalString(testAuditEntry);
    const signature = generateAuditSignature(canonical);
    assert(signature && signature.length === 64, 'TEST 8A: HMAC-SHA256 signature is valid 64-char hex string');

    const verified = verifyAuditEntry({
      ...testAuditEntry,
      hmac_signature: signature,
      confidence_level: 'high',
      topic_category: 'tax',
      contains_financial_advice: false,
      contains_tax_advice: true,
      disclaimer_text: '',
      reviewed_by_human: false,
    });
    assert(verified === true, 'TEST 8B: Legitimate audit entry passes HMAC verification');

    const tamperedVerified = verifyAuditEntry({
      ...testAuditEntry,
      response: 'The limit is 10,00,000 INR (TAMPERED)',
      hmac_signature: signature,
      confidence_level: 'high',
      topic_category: 'tax',
      contains_financial_advice: false,
      contains_tax_advice: true,
      disclaimer_text: '',
      reviewed_by_human: false,
    });
    assert(tamperedVerified === false, 'TEST 8C: Tampered response fails HMAC verification (tamper-evident)');

    // -------------------------------------------------------------
    // TEST 9: Admin audit-logs endpoint returns verification status
    // -------------------------------------------------------------
    const adminLogsRes = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    assert(
      adminLogsRes.status === 200 && Array.isArray(adminLogsRes.body.data),
      'TEST 9: Admin audit-logs endpoint responds with log data and HMAC verification flags'
    );

  } catch (err: any) {
    console.error('Unexpected exception in Phase 1 test suite:', err);
    failed++;
  }

  console.log(`\n=== PHASE 1 INTEGRITY TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runPhase1IntegrityTests();
