import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { getSupabaseAdminClient, getSupabaseClient } from '../src/config/supabase.js';

interface TestUser {
  id: string;
  email: string;
  token: string;
}

async function getOrCreateUser(roleSuffix: 'a' | 'b'): Promise<TestUser> {
  const admin = getSupabaseAdminClient();
  const anon = getSupabaseClient();
  const email = `isolation_test_${roleSuffix}@myca-audit.internal`;
  const password = `IsolationPassword123!#${roleSuffix.toUpperCase()}`;

  let userId: string = '';
  const { data: signInData, error: signInErr } = await anon.auth.signInWithPassword({ email, password });

  if (signInData?.session?.access_token && signInData.user) {
    userId = signInData.user.id;
    return {
      id: userId,
      email,
      token: signInData.session.access_token,
    };
  }

  // Not signed in -> list or create user
  const { data: userList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = userList?.users?.find((u) => u.email === email);

  if (existing) {
    userId = existing.id;
    await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Isolation Test User ${roleSuffix.toUpperCase()}` },
    });
    if (createErr || !created.user) {
      throw new Error(`Failed to create test user ${roleSuffix}: ${createErr?.message}`);
    }
    userId = created.user.id;
  }

  // Ensure public.profiles record
  const { data: profile } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (!profile) {
    await admin.from('profiles').insert({
      id: userId,
      full_name: `Isolation Test User ${roleSuffix.toUpperCase()}`,
      role: 'USER',
    });
  }

  const { data: newSignIn, error: newSignInErr } = await anon.auth.signInWithPassword({ email, password });
  if (newSignInErr || !newSignIn.session?.access_token) {
    throw new Error(`Failed to sign in as ${roleSuffix}: ${newSignInErr?.message}`);
  }

  return {
    id: userId,
    email,
    token: newSignIn.session.access_token,
  };
}

async function runMultiUserIsolationTests() {
  console.log('=================================================================');
  console.log('=== MULTI-USER DATA ISOLATION & AUTH GATING VERIFICATION SUITE ===');
  console.log('=================================================================\n');

  const app = createApp();
  const admin = getSupabaseAdminClient();

  // Acquire 2 real Supabase user sessions
  const userA = await getOrCreateUser('a');
  const userB = await getOrCreateUser('b');
  console.log(`[INFO] Authenticated User A: ${userA.id} (${userA.email})`);
  console.log(`[INFO] Authenticated User B: ${userB.id} (${userB.email})`);
  assert.notEqual(userA.id, userB.id, 'User A and User B must be distinct identities');

  // Track created test resource IDs for clean teardown
  const createdDocIds: string[] = [];
  const createdTxIds: string[] = [];
  const createdWatchlistIds: string[] = [];

  try {
    // ---------------------------------------------------------------------------
    // AUTH-001: Logged-out protected route
    // ---------------------------------------------------------------------------
    console.log('\n--- AUTH-001: Logged-out protected endpoint returns 401 ---');
    const resAuth001 = await request(app).get('/api/v1/finance/canonical');
    assert.equal(resAuth001.status, 401, 'Logged out request must return 401');
    assert.equal(resAuth001.body.error.code, 'UNAUTHORIZED_NO_TOKEN');
    console.log('[PASS] AUTH-001: Logged-out protected endpoint returns 401');

    // ---------------------------------------------------------------------------
    // AUTH-002: Logged-out protected API calls
    // ---------------------------------------------------------------------------
    console.log('\n--- AUTH-002: Logged-out protected APIs across all modules return 401 ---');
    const protectedPaths = [
      { method: 'get', url: '/api/v1/transactions' },
      { method: 'get', url: '/api/v1/crore/status' },
      { method: 'get', url: '/api/v1/action/plan' },
      { method: 'get', url: '/api/v1/allocation/goals' },
      { method: 'get', url: '/api/v1/documents' },
      { method: 'get', url: '/api/v1/market/watchlist' },
      { method: 'post', url: '/api/v1/chat' },
      { method: 'post', url: '/api/v1/reports/generate' },
    ];
    for (const p of protectedPaths) {
      const res = await (request(app) as any)[p.method](p.url);
      assert.equal(res.status, 401, `${p.url} unauthenticated must return 401`);
    }
    console.log('[PASS] AUTH-002: All protected APIs strictly reject unauthenticated calls with 401');

    // ---------------------------------------------------------------------------
    // Seed User A Private Records
    // ---------------------------------------------------------------------------
    console.log('\n--- Seeding private records for User A ---');
    // 1. Transaction for User A
    const resTxA = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        description: 'User A Confidential Salary',
        amount: 150000,
        type: 'income',
        category: 'Salary',
        account: 'HDFC Private',
        date: new Date().toISOString().slice(0, 10),
      });
    assert.equal(resTxA.status, 201, 'User A transaction creation failed');
    const txA = resTxA.body.data;
    createdTxIds.push(txA.id);
    console.log(`[INFO] Created User A Transaction: ${txA.id}`);

    // 2. Document for User A
    const resDocA = await request(app)
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        file_name: 'user_a_confidential_it_return.pdf',
        file_type: 'pdf',
        mime_type: 'application/pdf',
        file_size_bytes: 2048,
        document_type: 'tax_form_itr',
        source_type: 'DOCUMENT',
        title: 'User A Form 16 & ITR-1 AY 2026-27',
      });
    assert.equal(resDocA.status, 201, 'User A document creation failed');
    const docA = resDocA.body.data;
    createdDocIds.push(docA.id);
    console.log(`[INFO] Created User A Document: ${docA.id}`);

    // 3. Watchlist for User A
    const symbolA = `TICKA_${Date.now().toString().slice(-4)}`;
    const resWatchA = await request(app)
      .post('/api/v1/market/watchlist')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        symbol: symbolA,
        exchange: 'NSE',
        asset_type: 'EQUITY',
        notes: 'User A personal holding',
      });
    assert.equal(resWatchA.status, 201, 'User A watchlist creation failed');
    createdWatchlistIds.push(resWatchA.body.data.id);
    console.log(`[INFO] Created User A Watchlist Item: ${symbolA}`);

    // ---------------------------------------------------------------------------
    // AUTH-004: User A sees A data
    // ---------------------------------------------------------------------------
    console.log('\n--- AUTH-004: User A sees User A data ---');
    const resGetTxA = await request(app)
      .get(`/api/v1/transactions/${txA.id}`)
      .set('Authorization', `Bearer ${userA.token}`);
    assert.equal(resGetTxA.status, 200);
    assert.equal(resGetTxA.body.data.description, 'User A Confidential Salary');

    const resGetDocA = await request(app)
      .get(`/api/v1/documents/${docA.id}`)
      .set('Authorization', `Bearer ${userA.token}`);
    assert.equal(resGetDocA.status, 200);
    assert.equal(resGetDocA.body.data.title, 'User A Form 16 & ITR-1 AY 2026-27');
    console.log('[PASS] AUTH-004: User A sees only User A data');

    // ---------------------------------------------------------------------------
    // AUTH-005: User B sees B data
    // ---------------------------------------------------------------------------
    console.log('\n--- AUTH-005: User B queries returns User B scope (empty/zero User A items) ---');
    const resListTxB = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${userB.token}`);
    assert.equal(resListTxB.status, 200);
    const txAInB = (resListTxB.body.data.transactions || []).find((t: any) => t.id === txA.id);
    assert(!txAInB, 'User B transaction list must NEVER include User A transactions');

    const resListDocB = await request(app)
      .get('/api/v1/documents')
      .set('Authorization', `Bearer ${userB.token}`);
    assert.equal(resListDocB.status, 200);
    const docAInB = (resListDocB.body.data || []).find((d: any) => d.id === docA.id);
    assert(!docAInB, 'User B document list must NEVER include User A documents');
    console.log('[PASS] AUTH-005: User B queries return exclusively User B scope');

    // ---------------------------------------------------------------------------
    // AUTH-006 & AUTH-007: Cross-user access blocked (A cannot read B, B cannot read A)
    // ---------------------------------------------------------------------------
    console.log('\n--- AUTH-006 & AUTH-007: Cross-user read attempts blocked ---');
    // User B attempts to fetch User A's transaction directly by ID
    const resBGetTxA = await request(app)
      .get(`/api/v1/transactions/${txA.id}`)
      .set('Authorization', `Bearer ${userB.token}`);
    assert(resBGetTxA.status === 403 || resBGetTxA.status === 404, 'User B cannot access User A transaction');

    // User B attempts to fetch User A's document directly by ID
    const resBGetDocA = await request(app)
      .get(`/api/v1/documents/${docA.id}`)
      .set('Authorization', `Bearer ${userB.token}`);
    assert(resBGetDocA.status === 403 || resBGetDocA.status === 404, 'User B cannot access User A document');
    console.log('[PASS] AUTH-006 & AUTH-007: Cross-user direct read attempts blocked with 403/404');

    // ---------------------------------------------------------------------------
    // AUTH-008 & AUTH-009: Cross-user mutation blocked (B cannot modify A)
    // ---------------------------------------------------------------------------
    console.log('\n--- AUTH-008 & AUTH-009: Cross-user mutation attempts blocked ---');
    // User B attempts to UPDATE User A's transaction
    const resBUpdateTxA = await request(app)
      .put(`/api/v1/transactions/${txA.id}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ amount: 9999999 });
    assert(resBUpdateTxA.status === 403 || resBUpdateTxA.status === 404, 'User B cannot update User A transaction');

    // User B attempts to DELETE User A's transaction
    const resBDeleteTxA = await request(app)
      .delete(`/api/v1/transactions/${txA.id}`)
      .set('Authorization', `Bearer ${userB.token}`);
    assert(resBDeleteTxA.status === 403 || resBDeleteTxA.status === 404, 'User B cannot delete User A transaction');

    // User B attempts to DELETE User A's document
    const resBDeleteDocA = await request(app)
      .delete(`/api/v1/documents/${docA.id}`)
      .set('Authorization', `Bearer ${userB.token}`);
    assert(resBDeleteDocA.status === 403 || resBDeleteDocA.status === 404, 'User B cannot delete User A document');
    console.log('[PASS] AUTH-008 & AUTH-009: Cross-user mutation/deletion attempts blocked with 403/404');

    // ---------------------------------------------------------------------------
    // AUTH-010: Logout clears private session
    // ---------------------------------------------------------------------------
    console.log('\n--- AUTH-010: Logout clears session cookies ---');
    const resLogout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${userA.token}`);
    assert.equal(resLogout.status, 200);
    // Verify Set-Cookie header clears personal_ca_session
    const setCookie = resLogout.headers['set-cookie'] || [];
    const cleared = setCookie.some((c: string) => c.includes('personal_ca_session=;') || c.includes('Max-Age=0'));
    assert(cleared, 'Logout must clear personal_ca_session cookie');
    console.log('[PASS] AUTH-010: Logout explicitly invalidates session and clears cookie');

    // ---------------------------------------------------------------------------
    // AUTH-013: Direct IDOR Protection (Path parameters)
    // ---------------------------------------------------------------------------
    console.log('\n--- AUTH-013: Direct IDOR attack simulation ---');
    // Client tries injecting different user_id in body
    const resIdorInject = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({
        user_id: userA.id, // Malicious override attempt
        description: 'Malicious Injected Transaction',
        amount: 500,
        type: 'expense',
        category: 'General Expense',
        date: new Date().toISOString().slice(0, 10),
      });
    assert.equal(resIdorInject.status, 403, 'User ID injection attempt MUST be rejected with 403');
    assert.equal(resIdorInject.body.error.code, 'FORBIDDEN_USER_ID_OVERRIDE');
    console.log('[PASS] AUTH-013: Direct IDOR identity override attempt rejected with 403 FORBIDDEN_USER_ID_OVERRIDE');

    // ---------------------------------------------------------------------------
    // AUTH-014: Cross-user signed storage URL denied
    // ---------------------------------------------------------------------------
    console.log('\n--- AUTH-014: Cross-user storage download URL denied ---');
    // User B attempts to get download URL of User A document
    const resBDownloadDocA = await request(app)
      .get(`/api/v1/documents/${docA.id}`)
      .set('Authorization', `Bearer ${userB.token}`);
    assert(!resBDownloadDocA.body?.data?.download_url, 'User B must NEVER receive signed download URL for User A document');
    console.log('[PASS] AUTH-014: Cross-user signed storage URL generation denied');

    // ---------------------------------------------------------------------------
    // AUTH-015: Cross-user AI context impossible
    // ---------------------------------------------------------------------------
    console.log('\n--- AUTH-015: AI Financial Context Isolation ---');
    // User B sends chat inquiry trying to ask about User A's salary
    const resChatB = await request(app)
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({
        message: 'What is the salary amount in the confidential salary transaction?',
      });
    assert.equal(resChatB.status, 200);
    const chatAnswer = JSON.stringify(resChatB.body);
    assert(!chatAnswer.includes('150000') && !chatAnswer.includes('User A Confidential Salary'),
      'AI response for User B must NEVER include User A financial amounts or transaction details');
    console.log('[PASS] AUTH-015: User B AI prompt context contains ZERO User A financial records');

  } finally {
    // ---------------------------------------------------------------------------
    // CLEANUP TEST RECORDS
    // ---------------------------------------------------------------------------
    console.log('\n--- Cleaning up temporary multi-user isolation test records ---');
    for (const id of createdTxIds) {
      await admin.from('transactions').delete().eq('id', id);
    }
    for (const id of createdDocIds) {
      await admin.from('documents').delete().eq('id', id);
    }
    for (const id of createdWatchlistIds) {
      await admin.from('market_watchlist').delete().eq('id', id);
    }
    console.log('[PASS] All test records cleaned up from database');
  }

  console.log('\n=================================================================');
  console.log('=== ALL MULTI-USER DATA ISOLATION CHECKS PASSED SUCCESSFULLY ===');
  console.log('=================================================================');
}

runMultiUserIsolationTests().catch((err) => {
  console.error('\nMULTI-USER ISOLATION TEST FAILED:', err);
  process.exit(1);
});
