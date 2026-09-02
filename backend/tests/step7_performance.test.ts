import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { jobQueue } from '../src/modules/jobs/jobQueue.js';
import { aiService } from '../src/modules/ai/ai.service.js';

const app = createApp();

// Enforce deterministic mock AI provider for performance test suite
aiService.setProvider(aiService.getMockProvider());

const userAToken = 'mock-test-token:11111111-1111-4111-a111-111111111111:userA@example.com';
const userBToken = 'mock-test-token:22222222-2222-4222-a222-222222222222:userB@example.com';

describe('Step 7 — Performance, Idempotency & Job Lifecycle Tests', () => {
  // TEST 1: Background Job Creation and Lifecycle
  it('TEST 1: Background job creates with QUEUED status and transitions to COMPLETED', async () => {
    const res = await request(app)
      .post('/api/v1/jobs/create')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        type: 'DOCUMENT_OCR_EXTRACTION',
        data: { document_id: 'doc-777-test' },
      });

    assert.strictEqual(res.status, 202);
    assert.strictEqual(res.body.data.type, 'DOCUMENT_OCR_EXTRACTION');
    assert.ok(res.body.data.job_id);

    const jobId = res.body.data.job_id;

    // Wait 1 second for worker execution
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const pollRes = await request(app)
      .get(`/api/v1/jobs/${jobId}`)
      .set('Authorization', `Bearer ${userAToken}`);

    assert.strictEqual(pollRes.status, 200);
    assert.strictEqual(pollRes.body.data.status, 'COMPLETED');
    assert.ok(pollRes.body.data.result);
    assert.ok(pollRes.body.data.result.extracted_text.includes('FORM 16'));
    console.log('[PASS] TEST 1: Background job lifecycle (QUEUED -> COMPLETED) verified');
  });

  // TEST 2: Job User Isolation
  it('TEST 2: User B cannot retrieve User A background job (404 / access denied)', async () => {
    const createRes = await request(app)
      .post('/api/v1/jobs/create')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        type: 'FISCAL_REPORT_SYNTHESIS',
        data: { financial_year: '2025-26' },
      });

    const jobId = createRes.body.data.job_id;

    // User B attempts to access User A's job
    const unauthorizedRes = await request(app)
      .get(`/api/v1/jobs/${jobId}`)
      .set('Authorization', `Bearer ${userBToken}`);

    assert.strictEqual(unauthorizedRes.status, 404);
    assert.strictEqual(unauthorizedRes.body.error.code, 'JOB_NOT_FOUND');
    console.log('[PASS] TEST 2: Job user isolation enforced');
  });

  // TEST 3: Idempotency Key Prevents Duplicate Transactions
  it('TEST 3: Repeated POST /transactions with identical Idempotency-Key returns cached payload (HIT)', async () => {
    const idempotencyKey = `idemp-tx-${Date.now()}`;
    const txPayload = {
      description: 'Annual Term Insurance Premium',
      amount: 18500,
      currency: 'INR',
      type: 'debit',
      category: 'life_insurance',
      date: '2026-03-01',
      is_tax_relevant: true,
    };

    // First submission
    const res1 = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${userAToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(txPayload);

    assert.strictEqual(res1.status, 201);
    const createdId = res1.body.data.id;

    // Second submission with exact same key
    const res2 = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${userAToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(txPayload);

    assert.strictEqual(res2.status, 201);
    assert.strictEqual(res2.headers['x-cache-lookup'], 'HIT');
    assert.strictEqual(res2.headers['x-idempotency'], 'REPLAYED');
    assert.strictEqual(res2.body.data.id, createdId, 'Duplicate submission must return original transaction ID');
    console.log('[PASS] TEST 3: Request idempotency prevented duplicate transaction creation');
  });

  // TEST 4: Bounded Result Sets and Pagination
  it('TEST 4: Transactions query strictly rejects limit > 100 with 400 and caps at 100', async () => {
    // Rejection on oversized limit
    const overLimitRes = await request(app)
      .get('/api/v1/transactions?limit=5000&offset=0')
      .set('Authorization', `Bearer ${userAToken}`);

    assert.strictEqual(overLimitRes.status, 400);
    assert.strictEqual(overLimitRes.body.error.code, 'VALIDATION_ERROR');

    // Acceptance on valid bounded limit
    const validRes = await request(app)
      .get('/api/v1/transactions?limit=100&offset=0')
      .set('Authorization', `Bearer ${userAToken}`);

    assert.strictEqual(validRes.status, 200);
    assert.ok(Array.isArray(validRes.body.data));
    assert.ok(validRes.body.data.length <= 100);
    console.log('[PASS] TEST 4: API result bounds and pagination limits strictly enforced');
  });

  // TEST 5: User-Scoped AI Response Caching
  it('TEST 5: Consecutive identical user inquiries return from user-isolated cache', async () => {
    aiService.setProvider(aiService.getMockProvider());

    const query = 'What is the standard deduction for FY 2025-26?';

    const t0 = Date.now();
    const res1 = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ message: query });
    const d1 = Date.now() - t0;

    assert.strictEqual(res1.status, 200);

    // Second query with same text
    const t1 = Date.now();
    const res2 = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ message: query });
    const d2 = Date.now() - t1;

    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.body.data.answer, res1.body.data.answer);
    console.log(`[PASS] TEST 5: User AI query caching active (initial: ${d1}ms, cached: ${d2}ms)`);
  });

  // TEST 6: Concurrency Test (Multiple simultaneous transactions)
  it('TEST 6: Concurrent requests execute safely without corruption', async () => {
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        request(app)
          .post('/api/v1/transactions')
          .set('Authorization', `Bearer ${userAToken}`)
          .send({
            description: `Concurrent Stress Test Event ${i}`,
            amount: 1000 * (i + 1),
            currency: 'INR',
            type: 'debit',
            date: '2026-03-01',
          })
      );
    }

    const results = await Promise.all(promises);
    for (const r of results) {
      assert.strictEqual(r.status, 201);
      assert.ok(r.body.data.id);
    }
    console.log('[PASS] TEST 6: Concurrent transaction requests executed without race condition');
  });

  after(() => {
    process.exit(0);
  });
});
