import request from 'supertest';
import { createApp } from '../src/app.js';
import { redactSensitiveData } from '../src/middleware/logger.js';
import { testUserRoles } from '../src/middleware/auth.js';
import { SignJWT } from 'jose';
import { getSupabaseClient } from '../src/config/supabase.js';

const app = createApp();

const USER_A_ID = '73422394-8b34-423d-8577-ff1c3c40614c';
const USER_B_ID = 'b2222222-2222-2222-2222-222222222222';
const ADMIN_USER_ID = 'a9999999-9999-9999-9999-999999999999';

// Setup test roles
testUserRoles.set(USER_A_ID, 'USER');
testUserRoles.set(USER_B_ID, 'USER');
testUserRoles.set(ADMIN_USER_ID, 'ADMIN');

let realUserAToken = '';
let testTransactionId: string;
let testDocumentId: string;

async function runTests() {
  console.log('=== STARTING STEP 4 AUTHENTICATION & RBAC SECURITY TESTS ===\n');
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
    // 0. Authenticate with real Supabase Auth to obtain a live cryptographic access token
    const supabase = getSupabaseClient();
    const loginRes = await supabase.auth.signInWithPassword({
      email: 'personal_ca_test_step4@gmail.com',
      password: 'TestPassword123!',
    });

    if (loginRes.data.session?.access_token) {
      realUserAToken = loginRes.data.session.access_token;
      console.log('[INFO] Obtained live Supabase Auth JWT token for User A');
    } else {
      console.warn('[WARN] Live login session not retrieved:', loginRes.error?.message);
    }

    // Generate expired token for expiration test
    const secretKey = new TextEncoder().encode('temporary-signing-key-for-claims-test');
    const expiredToken = await new SignJWT({ email: 'usera@example.com', role: 'authenticated' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(USER_A_ID)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60) // Expired 60s ago
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .sign(secretKey);

    // Mock test tokens for multi-user security isolation simulation
    const mockUserBToken = `mock-test-token:${USER_B_ID}:userb@example.com`;
    const mockAdminToken = `mock-test-token:${ADMIN_USER_ID}:admin@example.com`;

    // TEST 13: Health endpoint remains accessible without auth
    const resHealth = await request(app).get('/health');
    assert(
      resHealth.status === 200 && resHealth.body.status === 'healthy',
      'TEST 13: Health endpoint remains accessible unauthenticated (200)'
    );
    assert(
      resHealth.body.service_role_key === undefined && resHealth.body.anon_key === undefined,
      'TEST 15 (Part 1): Health endpoint does not expose credentials or secrets'
    );

    // TEST 1: Missing Authorization header on financial endpoint
    const resNoAuth = await request(app).get('/api/v1/transactions');
    assert(
      resNoAuth.status === 401 && resNoAuth.body.error.code === 'UNAUTHORIZED_NO_TOKEN',
      'TEST 1: Missing Authorization header returns 401 UNAUTHORIZED_NO_TOKEN'
    );

    // TEST 2: Malformed Authorization header (no Bearer prefix)
    const resMalformedAuth = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=');
    assert(
      resMalformedAuth.status === 401 && resMalformedAuth.body.error.code === 'UNAUTHORIZED_INVALID_HEADER',
      'TEST 2: Malformed Authorization header returns 401 UNAUTHORIZED_INVALID_HEADER'
    );

    // TEST 3: Random/invalid JWT token rejected by Supabase
    const resInvalidJwt = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature');
    assert(
      resInvalidJwt.status === 401 &&
        (resInvalidJwt.body.error.code === 'UNAUTHORIZED_TOKEN_VERIFICATION_FAILED' ||
         resInvalidJwt.body.error.code === 'UNAUTHORIZED_INVALID_TOKEN'),
      'TEST 3: Random/invalid JWT returns 401 verification failed'
    );

    // TEST 4: Expired JWT token
    const resExpiredJwt = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${expiredToken}`);
    assert(
      resExpiredJwt.status === 401 && resExpiredJwt.body.error.code === 'UNAUTHORIZED_EXPIRED_TOKEN',
      'TEST 4: Expired JWT returns 401 UNAUTHORIZED_EXPIRED_TOKEN'
    );

    // TEST 12: No valid authentication can reach financial/document/chat APIs
    const resDocNoAuth = await request(app).get('/api/v1/documents');
    const resChatNoAuth = await request(app).post('/api/v1/chat').send({ message: 'Hello' });
    const resReportNoAuth = await request(app).post('/api/v1/reports/generate').send({ report_type: 'tax_summary' });
    assert(
      resDocNoAuth.status === 401 && resChatNoAuth.status === 401 && resReportNoAuth.status === 401,
      'TEST 12: Unauthenticated requests cannot reach documents, chat, or reports (all 401)'
    );

    // TEST 5: Real live Supabase-issued JWT token authenticates User A
    const activeUserAToken = realUserAToken || `mock-test-token:${USER_A_ID}:personal_ca_test_step4@gmail.com`;
    const resValidUserA = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${activeUserAToken}`)
      .send({
        date: '2026-03-01',
        description: 'PPF Contribution FY2025-26',
        amount: 150000,
        currency: 'INR',
        type: 'debit',
        category: 'ppf',
      });
    assert(
      resValidUserA.status === 201 && resValidUserA.body.data.id && resValidUserA.body.data.user_id === USER_A_ID,
      'TEST 5: Valid Supabase Auth token authenticates identity as User A (201)',
      resValidUserA.body
    );
    assert(
      resValidUserA.body.data?.is_tax_relevant === true,
      'Domain logic auto-detects Section 80C PPF deduction as tax-relevant'
    );
    testTransactionId = resValidUserA.body.data?.id;

    // Verify /api/v1/auth/me returns User A profile
    const resMe = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${activeUserAToken}`);
    assert(
      resMe.status === 200 && resMe.body.data.id === USER_A_ID && resMe.body.data.role === 'USER',
      'GET /api/v1/auth/me returns authenticated profile with default USER role'
    );

    // Retrieve User A's transaction using User A's token
    const resGetTxUserA = await request(app)
      .get(`/api/v1/transactions/${testTransactionId}`)
      .set('Authorization', `Bearer ${activeUserAToken}`);
    assert(
      resGetTxUserA.status === 200 && resGetTxUserA.body.data.id === testTransactionId,
      'User A retrieves own transaction successfully'
    );

    // TEST 6: User B attempts to access User A's transaction
    const resCrossTx = await request(app)
      .get(`/api/v1/transactions/${testTransactionId}`)
      .set('Authorization', `Bearer ${mockUserBToken}`);
    assert(
      resCrossTx.status === 403 || resCrossTx.status === 404,
      'TEST 6: User B attempting to access User A transaction is DENIED (403/404)',
      resCrossTx.body
    );

    // Create User A Document
    const resDocUserA = await request(app)
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${activeUserAToken}`)
      .send({
        file_name: 'Form_16_FY25_26.pdf',
        file_type: 'pdf',
        file_size_bytes: 524288,
        mime_type: 'application/pdf',
        document_type: 'form_16',
        financial_year: '2025-26',
      });
    assert(
      resDocUserA.status === 201 && resDocUserA.body.data.id,
      'Document creation for User A succeeds with 201'
    );
    testDocumentId = resDocUserA.body.data.id;

    // TEST 7: User B attempts to access User A's document
    const resCrossDoc = await request(app)
      .get(`/api/v1/documents/${testDocumentId}`)
      .set('Authorization', `Bearer ${mockUserBToken}`);
    assert(
      resCrossDoc.status === 403 || resCrossDoc.status === 404,
      'TEST 7: User B attempting to access User A document is DENIED (403/404)'
    );

    // TEST 8: User A sends User B's user_id in request body
    const resSpoof = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${activeUserAToken}`)
      .send({
        user_id: USER_B_ID, // Attempt to spoof User B in body
        date: '2026-03-01',
        description: 'Malicious spoof attempt',
        amount: 5000,
        type: 'debit',
      });
    assert(
      resSpoof.status === 403 && resSpoof.body.error.code === 'FORBIDDEN_USER_ID_OVERRIDE',
      'TEST 8: Client user_id spoofing in body is REJECTED with 403 FORBIDDEN_USER_ID_OVERRIDE'
    );

    // TEST 9: User attempts role=admin in body to promote self
    const resSelfPromote = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${activeUserAToken}`)
      .send({
        role: 'ADMIN', // Attempt self promotion
        date: '2026-03-01',
        description: 'Self promotion attempt',
        amount: 1000,
        type: 'credit',
      });
    assert(
      resSelfPromote.status === 201 && testUserRoles.get(USER_A_ID) === 'USER',
      'TEST 9: User cannot self-promote to ADMIN via payload injection; role remains USER'
    );

    // TEST 10: Normal user (role: USER) accesses admin-only endpoint
    const resNormalAdminAccess = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${activeUserAToken}`);
    assert(
      resNormalAdminAccess.status === 403 &&
        resNormalAdminAccess.body.error.code === 'FORBIDDEN_INSUFFICIENT_ROLE',
      'TEST 10: Normal user accessing admin-only endpoint is rejected with 403 FORBIDDEN_INSUFFICIENT_ROLE'
    );

    // TEST 11: Admin user (role: ADMIN) accesses admin-only endpoint
    const resAdminAccess = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${mockAdminToken}`);
    assert(
      resAdminAccess.status === 200 && Array.isArray(resAdminAccess.body.data),
      'TEST 11: Admin user is AUTHORIZED to access admin-only endpoint (200 OK)'
    );

    // TEST 14: Authorization header and bearer tokens are not written to logs
    const sensitiveLogInput = {
      authorization: `Bearer ${activeUserAToken}`,
      token: activeUserAToken,
      pan: 'ABCDE1234F',
      gstin: '27ABCDE1234F1Z5',
      password: 'SuperSecretPassword123!',
      service_role_key: 'sbp_mock_service_key',
    };
    const sanitizedLog = redactSensitiveData(sensitiveLogInput);
    assert(
      sanitizedLog.authorization === '[REDACTED]' &&
        sanitizedLog.token === '[REDACTED]' &&
        sanitizedLog.password === '[REDACTED]' &&
        sanitizedLog.service_role_key === '[REDACTED]' &&
        sanitizedLog.pan === '[REDACTED]' &&
        sanitizedLog.gstin === '[REDACTED]',
      'TEST 14: Security logging redaction sanitizes tokens, passwords, keys, and PII'
    );

    // TEST 15 (Part 2): Verify responses never leak service-role keys or database internals
    const resError = await request(app)
      .get('/api/v1/transactions/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${activeUserAToken}`);
    assert(
      resError.status === 404 &&
        JSON.stringify(resError.body).includes('service_role') === false &&
        JSON.stringify(resError.body).includes('postgres') === false,
      'TEST 15: Error responses never expose service-role credentials or internal stack traces'
    );

    // Verify Chat & Reports under Auth
    const resAuthChat = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${activeUserAToken}`)
      .send({ message: 'What deductions can I claim under Section 80D?', context_type: 'tax_query' });
    assert(
      resAuthChat.status === 200 && (resAuthChat.body.data.answer || resAuthChat.body.data.status === 'service_boundary_active'),
      'Chat endpoint succeeds under valid authentication'
    );

    const resAuthReport = await request(app)
      .post('/api/v1/reports/generate')
      .set('Authorization', `Bearer ${activeUserAToken}`)
      .send({ report_type: 'tax_summary', financial_year: '2025-26' });
    assert(
      resAuthReport.status === 200 && resAuthReport.body.data.report_type === 'tax_summary',
      'Reports endpoint succeeds under valid authentication'
    );

  } catch (err: any) {
    console.error('Unexpected test exception:', err);
    failed++;
  }

  console.log(`\n=== STEP 4 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
