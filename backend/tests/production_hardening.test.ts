import '../tests/setup.ts';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { authService } from '../src/modules/auth/auth.service.js';
import { testUserRoles } from '../src/middleware/auth.js';
import { validateProductionEnvironment } from '../src/config/env.js';

const app = createApp();

const TEST_USER_ID = '73422394-8b34-423d-8577-ff1c3c40614c';
const SPOOF_USER_ID = '00000000-0000-0000-0000-000000000002';
testUserRoles.set(TEST_USER_ID, 'USER');

const validDevToken = `mock-test-token:${TEST_USER_ID}:test@example.com`;

async function runProductionHardeningTests() {
  console.log('=== RUNNING PRODUCTION HARDENING VERIFICATION TESTS ===\n');
  let passed = 0;
  let failed = 0;

  function check(condition: boolean, title: string, detail?: any) {
    if (condition) {
      console.log(`[PASS] ${title}`);
      passed++;
    } else {
      console.error(`[FAIL] ${title}`, detail ? JSON.stringify(detail) : '');
      failed++;
    }
  }

  // TEST 1: Profile lookup failure fails closed without fake profile
  try {
    let threw = false;
    try {
      await authService.getProfile('00000000-0000-0000-0000-000000000099');
    } catch (err: any) {
      threw = true;
      check(
        err.code === 'PROFILE_NOT_FOUND' || err.code === 'DATABASE_PROFILE_ERROR',
        'TEST 1: Non-existent profile query fails closed with 404/500, never fake profile',
        err.code
      );
    }
    if (!threw) {
      check(false, 'TEST 1: Non-existent profile should have thrown error');
    }
  } catch (e: any) {
    check(false, 'TEST 1: Profile test threw unexpected error', e.message);
  }

  // TEST 2: Health check endpoint remains public and leaks zero secrets
  try {
    const res = await request(app).get('/health');
    check(res.status === 200, 'TEST 2.1: Health check returns 200');
    check(res.body.service_role_key === undefined, 'TEST 2.2: Health check does not leak SUPABASE_SERVICE_ROLE_KEY');
    check(res.body.encryption_secret_key === undefined, 'TEST 2.3: Health check does not leak ENCRYPTION_SECRET_KEY');
    check(res.body.groq_api_key === undefined, 'TEST 2.4: Health check does not leak GROQ_API_KEY');
  } catch (e: any) {
    check(false, 'TEST 2: Health check error', e.message);
  }

  // TEST 3: Identity Spoofing (user_id override) is rejected with 403
  try {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${validDevToken}`)
      .send({
        user_id: SPOOF_USER_ID,
        date: '2026-09-01',
        description: 'Spoofed transaction attempt',
        amount: 5000,
        currency: 'INR',
        type: 'expense',
      });
    check(
      res.status === 403 && res.body.error?.code === 'FORBIDDEN_USER_ID_OVERRIDE',
      'TEST 3.1: Client user_id spoofing in body is rejected with 403 FORBIDDEN_USER_ID_OVERRIDE',
      res.body
    );
  } catch (e: any) {
    check(false, 'TEST 3.1: IDOR test failed', e.message);
  }

  // TEST 3.2: Identity Spoofing via query parameter is rejected with 403
  try {
    const res = await request(app)
      .get(`/api/v1/transactions?user_id=${SPOOF_USER_ID}`)
      .set('Authorization', `Bearer ${validDevToken}`);
    check(
      res.status === 403 && res.body.error?.code === 'FORBIDDEN_USER_ID_OVERRIDE',
      'TEST 3.2: Client user_id spoofing in query is rejected with 403 FORBIDDEN_USER_ID_OVERRIDE',
      res.body
    );
  } catch (e: any) {
    check(false, 'TEST 3.2: Query IDOR test failed', e.message);
  }

  // TEST 4: Role injection in body is stripped and cannot self-promote
  try {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${validDevToken}`)
      .send({
        role: 'ADMIN',
        date: '2026-09-01',
        description: 'Privilege escalation payload',
        amount: 100,
        currency: 'INR',
        type: 'expense',
      });
    check(
      res.status === 201,
      'TEST 4.1: Transaction created while role injection payload was stripped safely'
    );
    // User role remains USER
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${validDevToken}`);
    check(
      meRes.status === 200 && meRes.body.data.role === 'USER',
      'TEST 4.2: Authenticated user role remains USER and was not promoted to ADMIN'
    );
  } catch (e: any) {
    check(false, 'TEST 4: Role injection test failed', e.message);
  }

  // TEST 5: Auth refresh endpoint validates refresh_token
  try {
    const missingRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({});
    check(
      missingRes.status === 400 && missingRes.body.error?.code === 'AUTH_MISSING_REFRESH_TOKEN',
      'TEST 5.1: Missing refresh_token in /auth/refresh returns 400 AUTH_MISSING_REFRESH_TOKEN'
    );

    const invalidRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: 'invalid-nonexistent-token' });
    check(
      invalidRes.status === 401 || invalidRes.status === 500,
      'TEST 5.2: Invalid refresh_token rejects request truthfully without fake session'
    );
  } catch (e: any) {
    check(false, 'TEST 5: Auth refresh test failed', e.message);
  }

  // TEST 6: Environment validation fails closed if missing required production variables
  try {
    const originalEnv = process.env.NODE_ENV;
    const originalKey = process.env.GROQ_API_KEY;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.GROQ_API_KEY;
      let caught = false;
      try {
        validateProductionEnvironment();
      } catch (err: any) {
        caught = true;
        check(
          err.message.includes('FATAL CONFIGURATION ERROR') && err.message.includes('GROQ_API_KEY'),
          'TEST 6: Production startup validates required variables and throws fatal error on missing GROQ_API_KEY'
        );
      }
      if (!caught) {
        check(false, 'TEST 6: validateProductionEnvironment should have thrown');
      }
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalKey) process.env.GROQ_API_KEY = originalKey;
    }
  } catch (e: any) {
    check(false, 'TEST 6: Env validation test failed', e.message);
  }

  // TEST 7: Negative monetary values or invalid amounts rejected
  try {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${validDevToken}`)
      .send({
        date: '2026-09-01',
        description: 'Negative amount test',
        amount: -500,
        currency: 'INR',
        type: 'expense',
      });
    check(
      res.status === 400 && res.body.error?.code === 'VALIDATION_ERROR',
      'TEST 7: Negative transaction amount rejected with 400 VALIDATION_ERROR'
    );
  } catch (e: any) {
    check(false, 'TEST 7: Money validation test failed', e.message);
  }

  // TEST 8: Response headers include correlation ID and security headers
  try {
    const res = await request(app).get('/health');
    check(Boolean(res.headers['x-request-id']), 'TEST 8.1: X-Request-Id correlation header present');
    check(res.headers['x-content-type-options'] === 'nosniff', 'TEST 8.2: X-Content-Type-Options: nosniff present');
    check(res.headers['x-frame-options'] === 'DENY', 'TEST 8.3: X-Frame-Options: DENY present');
  } catch (e: any) {
    check(false, 'TEST 8: Headers test failed', e.message);
  }

  console.log(`\n=== PRODUCTION HARDENING TESTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runProductionHardeningTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
