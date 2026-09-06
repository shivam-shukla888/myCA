import './setup.js';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { aiService } from '../src/modules/ai/ai.service.js';
import { testUserRoles } from '../src/middleware/auth.js';

const app = createApp();
aiService.setProvider(aiService.getMockProvider());

const USER_ID = '73422394-8b34-423d-8577-ff1c3c40614c';
testUserRoles.set(USER_ID, 'USER');
const token = `mock-test-token:${USER_ID}:test@example.com`;

async function measureEndpoint(name: string, fn: () => Promise<any>, runs = 3) {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`${name}: avg ${avg.toFixed(1)}ms (${times.map((t) => t.toFixed(1) + 'ms').join(', ')})`);
  return avg;
}

async function run() {
  console.log('=== BENCHMARK: BEFORE OPTIMIZATION ===\n');

  // 1. Dashboard readiness (current: 5 individual requests in parallel)
  await measureEndpoint('Dashboard (5 parallel requests: canonical + crore + tx + changes + action)', async () => {
    await Promise.all([
      request(app).get('/api/v1/finance/canonical?month=2026-09').set('Authorization', `Bearer ${token}`),
      request(app).get('/api/v1/crore/status?month=2026-09').set('Authorization', `Bearer ${token}`),
      request(app).get('/api/v1/transactions?limit=6').set('Authorization', `Bearer ${token}`),
      request(app).get('/api/v1/finance/changes?month=2026-09').set('Authorization', `Bearer ${token}`),
      request(app).get('/api/v1/action/plan?month=2026-09').set('Authorization', `Bearer ${token}`),
    ]);
  });

  // 2. Ledger load (summary + list)
  await measureEndpoint('Ledger load (summary + 100 tx)', async () => {
    await Promise.all([
      request(app).get('/api/v1/transactions/summary/monthly?month=2026-09').set('Authorization', `Bearer ${token}`),
      request(app).get('/api/v1/transactions?limit=100').set('Authorization', `Bearer ${token}`),
    ]);
  });

  // 3. ₹1Cr status
  await measureEndpoint('₹1Cr status', async () => {
    await request(app).get('/api/v1/crore/status').set('Authorization', `Bearer ${token}`);
  });

  // 4. Allocation (profile + goals)
  await measureEndpoint('Allocation (profile + goals)', async () => {
    await Promise.all([
      request(app).get('/api/v1/allocation/profile').set('Authorization', `Bearer ${token}`),
      request(app).get('/api/v1/allocation/goals').set('Authorization', `Bearer ${token}`),
    ]);
  });

  // 5. Ask MyCA query
  await measureEndpoint('Ask MyCA (chat query with mock provider)', async () => {
    await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Mera monthly surplus kitna hai?' });
  });

  console.log('\n=== BENCHMARK COMPLETE ===');
}

run().catch(console.error);
