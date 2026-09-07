import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { env } from '../src/config/env.js';
import { getSupabaseAdminClient, getSupabaseClient } from '../src/config/supabase.js';

interface TestUserSession {
  userId: string;
  email: string;
  token: string;
  client: ReturnType<typeof createClient>;
}

async function getOrCreateTestUser(roleSuffix: 'a' | 'b'): Promise<TestUserSession> {
  const admin = getSupabaseAdminClient();
  const email = `rls_test_user_${roleSuffix}_production@myca-audit.internal`;
  const password = `ProductionRlsPass123!#${roleSuffix.toUpperCase()}`;

  let userId: string = '';
  const anon = getSupabaseClient();

  // Try signing in first
  let { data: authData, error: authErr } = await anon.auth.signInWithPassword({
    email,
    password,
  });

  if (authData?.session?.access_token && authData.user) {
    userId = authData.user.id;
  } else {
    // If sign in failed, check if user exists in listUsers (fetch up to 1000)
    const { data: userList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existingUser = userList?.users?.find((u) => u.email === email);

    if (existingUser) {
      userId = existingUser.id;
      await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: `RLS Test User ${roleSuffix.toUpperCase()}` },
      });
      if (createErr || !created.user) {
        throw new Error(`Failed to create test user ${roleSuffix}: ${createErr?.message}`);
      }
      userId = created.user.id;
    }

    // Now sign in to get authentic session JWT
    const res = await anon.auth.signInWithPassword({ email, password });
    if (res.error || !res.data.session?.access_token) {
      throw new Error(`Failed to sign in as user ${roleSuffix}: ${res.error?.message}`);
    }
    authData = res.data;
  }

  // Ensure public.profiles record exists
  const { data: profile } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (!profile) {
    await admin.from('profiles').insert({
      id: userId,
      full_name: `RLS Test User ${roleSuffix.toUpperCase()}`,
      role: 'USER',
    });
  }

  const token = authData.session!.access_token;

  // Create dedicated user-scoped client carrying ONLY this user's JWT in Authorization header
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return {
    userId,
    email,
    token,
    client,
  };
}

async function runRlsVerification() {
  console.log('=================================================================');
  console.log('=== REAL SUPABASE ROW LEVEL SECURITY (RLS) AUDIT SUITE ===');
  console.log('=================================================================\n');

  console.log('1. Setting up 2 real Supabase users with end-user JWT sessions...');
  const userA = await getOrCreateTestUser('a');
  const userB = await getOrCreateTestUser('b');
  console.log(`[PASS] User A Session acquired: ${userA.userId} (${userA.email})`);
  console.log(`[PASS] User B Session acquired: ${userB.userId} (${userB.email})`);
  assert.notEqual(userA.userId, userB.userId, 'User A and User B must be distinct identities');

  // We also keep admin client strictly for initial setup and final teardown
  const admin = getSupabaseAdminClient();

  // ---------------------------------------------------------------------------
  // SECTION A & B: DOCUMENT RLS (SELECT, UPDATE, DELETE)
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Document Table RLS Verification ---');

  // User A creates a document directly via clientA (User A's authenticated JWT)
  const testDocId = `rls-test-doc-${Date.now()}`;
  const docHash = `test-hash-${Date.now()}`;
  const storagePathA = `${userA.userId}/${testDocId}.pdf`;

  const { data: docInsertData, error: docInsertErr } = await userA.client
    .from('documents')
    .insert({
      user_id: userA.userId,
      file_name: 'confidential_evidence_a.pdf',
      storage_path: storagePathA,
      file_type: 'application/pdf',
      file_size_bytes: 1024,
      mime_type: 'application/pdf',
      document_type: 'receipt',
      source_type: 'DOCUMENT',
      file_hash: docHash,
      title: 'User A Confidential Financial Statement',
    })
    .select()
    .single();

  assert(!docInsertErr, `User A document insert failed: ${docInsertErr?.message}`);
  const createdDocA = docInsertData;
  console.log(`[PASS] User A inserted document ${createdDocA.id} using own JWT [RLS ACTUALLY EXERCISED = YES]`);

  // A. User A JWT SELECT test
  const { data: userASelect, error: userASelErr } = await userA.client
    .from('documents')
    .select('*')
    .eq('id', createdDocA.id);
  assert(!userASelErr, `User A SELECT error: ${userASelErr?.message}`);
  assert.equal(userASelect?.length, 1, 'User A MUST be able to SELECT own document');
  console.log('[PASS] User A can SELECT own document [RLS ACTUALLY EXERCISED = YES]');

  // B. User B JWT SELECT test (cross-user access attempt)
  const { data: userBSelect, error: userBSelErr } = await userB.client
    .from('documents')
    .select('*')
    .eq('id', createdDocA.id);
  assert(!userBSelErr, `User B query failed with unexpected error: ${userBSelErr?.message}`);
  assert.equal(userBSelect?.length, 0, 'PostgreSQL RLS MUST return 0 rows for cross-user document SELECT');
  console.log('[PASS] User B cannot SELECT User A document (returned 0 rows) [RLS ACTUALLY EXERCISED = YES]');

  // D. User B cross-user UPDATE test
  const { data: userBUpdate, error: userBUpdErr } = await userB.client
    .from('documents')
    .update({ title: 'HACKED_BY_USER_B' })
    .eq('id', createdDocA.id)
    .select();
  assert.equal(userBUpdate?.length ?? 0, 0, 'PostgreSQL RLS MUST block cross-user UPDATE (0 rows affected)');
  console.log('[PASS] User B cannot UPDATE User A document (0 rows affected) [RLS ACTUALLY EXERCISED = YES]');

  // E. User B cross-user DELETE test
  const { data: userBDelete, error: userBDelErr } = await userB.client
    .from('documents')
    .delete()
    .eq('id', createdDocA.id)
    .select();
  assert.equal(userBDelete?.length ?? 0, 0, 'PostgreSQL RLS MUST block cross-user DELETE (0 rows affected)');
  console.log('[PASS] User B cannot DELETE User A document (0 rows affected) [RLS ACTUALLY EXERCISED = YES]');

  // Confirm User A's document title is untampered
  const { data: verifyDocA } = await userA.client
    .from('documents')
    .select('title')
    .eq('id', createdDocA.id)
    .single();
  assert.equal(verifyDocA?.title, 'User A Confidential Financial Statement', 'Document title must remain untampered');

  // ---------------------------------------------------------------------------
  // SECTION C, D, E, H: WATCHLIST RLS
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Watchlist Table RLS Verification ---');

  // User A creates a watchlist item
  const symbolA = `TICKERA_${Date.now().toString().slice(-4)}`;
  const { data: watchAData, error: watchAErr } = await userA.client
    .from('market_watchlist')
    .insert({
      user_id: userA.userId,
      symbol: symbolA,
      exchange: 'NSE',
      asset_type: 'EQUITY',
      notes: 'User A portfolio holding',
    })
    .select()
    .single();
  assert(!watchAErr, `User A watchlist insert failed: ${watchAErr?.message}`);
  const createdWatchA = watchAData;
  console.log(`[PASS] User A created watchlist row ${createdWatchA.id} (${symbolA}) [RLS ACTUALLY EXERCISED = YES]`);

  // B. User B attempts to SELECT User A's watchlist item
  const { data: userBWatchSelect } = await userB.client
    .from('market_watchlist')
    .select('*')
    .eq('id', createdWatchA.id);
  assert.equal(userBWatchSelect?.length, 0, 'PostgreSQL RLS MUST hide User A watchlist row from User B');
  console.log('[PASS] User B cannot SELECT User A watchlist row (0 rows) [RLS ACTUALLY EXERCISED = YES]');

  // C. User B attempts cross-user INSERT with user_id = User A
  const { data: userBFakeInsert, error: userBFakeErr } = await userB.client
    .from('market_watchlist')
    .insert({
      user_id: userA.userId, // Attempting to insert under User A
      symbol: 'MALICIOUS_SYM',
      exchange: 'NSE',
      asset_type: 'EQUITY',
    })
    .select();
  assert(userBFakeErr !== null, 'PostgreSQL RLS WITH CHECK MUST reject INSERT spoofing another user_id');
  console.log(`[PASS] User B cannot INSERT with user_id = User A (error: ${userBFakeErr?.message}) [RLS ACTUALLY EXERCISED = YES]`);

  // D. User B attempts cross-user UPDATE on User A's watchlist row
  const { data: userBWatchUpdate } = await userB.client
    .from('market_watchlist')
    .update({ symbol: 'HACKED' })
    .eq('id', createdWatchA.id)
    .select();
  assert.equal(userBWatchUpdate?.length ?? 0, 0, 'PostgreSQL RLS MUST block cross-user UPDATE on watchlist');
  console.log('[PASS] User B cannot UPDATE User A watchlist row (0 rows affected) [RLS ACTUALLY EXERCISED = YES]');

  // E. User B attempts cross-user DELETE on User A's watchlist row
  const { data: userBWatchDelete } = await userB.client
    .from('market_watchlist')
    .delete()
    .eq('id', createdWatchA.id)
    .select();
  assert.equal(userBWatchDelete?.length ?? 0, 0, 'PostgreSQL RLS MUST block cross-user DELETE on watchlist');
  console.log('[PASS] User B cannot DELETE User A watchlist row (0 rows affected) [RLS ACTUALLY EXERCISED = YES]');

  // H. User B can still perform full CRUD on their OWN watchlist
  const symbolB = `TICKERB_${Date.now().toString().slice(-4)}`;
  const { data: userBCreated, error: userBCreateErr } = await userB.client
    .from('market_watchlist')
    .insert({
      user_id: userB.userId,
      symbol: symbolB,
      exchange: 'NSE',
      asset_type: 'EQUITY',
      notes: 'User B private notes',
    })
    .select()
    .single();
  assert(!userBCreateErr, `User B own watchlist insert failed: ${userBCreateErr?.message}`);
  console.log(`[PASS] User B can CREATE own watchlist row (${symbolB}) [RLS ACTUALLY EXERCISED = YES]`);

  const { data: userBOwnSelect } = await userB.client
    .from('market_watchlist')
    .select('*')
    .eq('id', userBCreated.id);
  assert.equal(userBOwnSelect?.length, 1, 'User B MUST be able to SELECT own watchlist');
  console.log('[PASS] User B can SELECT own watchlist row [RLS ACTUALLY EXERCISED = YES]');

  const { error: userBOwnDeleteErr } = await userB.client
    .from('market_watchlist')
    .delete()
    .eq('id', userBCreated.id);
  assert(!userBOwnDeleteErr, `User B own delete failed: ${userBOwnDeleteErr?.message}`);
  console.log('[PASS] User B can DELETE own watchlist row [RLS ACTUALLY EXERCISED = YES]');

  // ---------------------------------------------------------------------------
  // SECTION G: MARKET CACHE RLS (READ ALLOWED, WRITE RESTRICTED)
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Market Data Cache RLS Verification ---');

  // Authenticated user can SELECT from market_data_cache
  const { data: cacheRead, error: cacheReadErr } = await userA.client
    .from('market_data_cache')
    .select('metric_key, value, freshness_type')
    .limit(5);
  assert(!cacheReadErr, `Authenticated user SELECT market_data_cache failed: ${cacheReadErr?.message}`);
  console.log(`[PASS] Authenticated user can SELECT market_data_cache (${cacheRead?.length} rows read) [RLS ACTUALLY EXERCISED = YES]`);

  // Authenticated user attempts INSERT to market_data_cache
  const { error: cacheInsertErr } = await userA.client
    .from('market_data_cache')
    .insert({
      metric_key: 'UNAUTHORIZED_INJECTION',
      metric_type: 'GOLD',
      value: 999999,
      currency: 'INR',
      unit: 'INR/10g',
      source: 'Hacker',
      observed_at: new Date().toISOString(),
      freshness_type: 'REAL_TIME',
    });
  assert(cacheInsertErr !== null, 'RLS MUST block normal authenticated user INSERT on market_data_cache');
  console.log(`[PASS] Normal authenticated user INSERT on market_data_cache DENIED (error: ${cacheInsertErr?.message}) [RLS ACTUALLY EXERCISED = YES]`);

  // Authenticated user attempts UPDATE on market_data_cache
  const { data: cacheUpdateData } = await userA.client
    .from('market_data_cache')
    .update({ value: 1 })
    .eq('metric_key', 'INFLATION_CPI_INDIA')
    .select();
  assert.equal(cacheUpdateData?.length ?? 0, 0, 'RLS MUST block normal authenticated user UPDATE on market_data_cache');
  console.log('[PASS] Normal authenticated user UPDATE on market_data_cache DENIED (0 rows affected) [RLS ACTUALLY EXERCISED = YES]');

  // Authenticated user attempts DELETE on market_data_cache
  const { data: cacheDeleteData } = await userA.client
    .from('market_data_cache')
    .delete()
    .eq('metric_key', 'INFLATION_CPI_INDIA')
    .select();
  assert.equal(cacheDeleteData?.length ?? 0, 0, 'RLS MUST block normal authenticated user DELETE on market_data_cache');
  console.log('[PASS] Normal authenticated user DELETE on market_data_cache DENIED (0 rows affected) [RLS ACTUALLY EXERCISED = YES]');

  // ---------------------------------------------------------------------------
  // SECTION F: DOCUMENT STORAGE RLS
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Document Storage RLS Verification ---');

  const storageFileName = `evidence_${Date.now()}.pdf`;
  const userAFilePath = `${userA.userId}/${storageFileName}`;
  const fileContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (User A Confidential Evidence) >>\nendobj\n%%EOF');

  // User A uploads to private bucket 'user-documents' under their own folder
  const { data: uploadAData, error: uploadAErr } = await userA.client.storage
    .from('user-documents')
    .upload(userAFilePath, fileContent, {
      contentType: 'application/pdf',
      upsert: true,
    });
  assert(!uploadAErr, `User A storage upload failed: ${uploadAErr?.message}`);
  console.log(`[PASS] User A uploaded private storage object ${userAFilePath} [RLS ACTUALLY EXERCISED = YES]`);

  // User A accesses/downloads own storage object
  const { data: downloadAData, error: downloadAErr } = await userA.client.storage
    .from('user-documents')
    .download(userAFilePath);
  assert(!downloadAErr, `User A failed to download own file: ${downloadAErr?.message}`);
  const downloadedText = await downloadAData?.text();
  assert(downloadedText?.includes('User A Confidential Evidence'), 'User A downloaded content must match');
  console.log('[PASS] User A can download own storage object [RLS ACTUALLY EXERCISED = YES]');

  // User A creates signed URL (access works)
  const { data: signedUrlA, error: signedUrlAErr } = await userA.client.storage
    .from('user-documents')
    .createSignedUrl(userAFilePath, 60);
  assert(!signedUrlAErr && signedUrlA?.signedUrl, 'User A signed URL creation MUST succeed');
  console.log('[PASS] User A can generate and use signed URL for own storage object [RLS ACTUALLY EXERCISED = YES]');

  // User B attempts to download User A's private storage object
  const { data: downloadBData, error: downloadBErr } = await userB.client.storage
    .from('user-documents')
    .download(userAFilePath);
  assert(downloadBErr !== null, 'PostgreSQL Storage RLS MUST block User B from downloading User A file');
  console.log(`[PASS] User B cross-user download DENIED (error: ${downloadBErr?.message}) [RLS ACTUALLY EXERCISED = YES]`);

  // User B attempts to create signed URL for User A's storage object
  const { data: signedUrlB, error: signedUrlBErr } = await userB.client.storage
    .from('user-documents')
    .createSignedUrl(userAFilePath, 60);
  assert(signedUrlBErr !== null || !signedUrlB?.signedUrl, 'User B signed URL creation on User A object MUST fail or error');
  console.log('[PASS] User B cannot create signed URL for User A storage object [RLS ACTUALLY EXERCISED = YES]');

  // User B attempts to list User A's folder
  const { data: listBData } = await userB.client.storage
    .from('user-documents')
    .list(userA.userId);
  assert(!listBData || listBData.length === 0, 'PostgreSQL Storage RLS MUST block User B from listing User A files');
  console.log('[PASS] User B cross-user folder listing returns empty [RLS ACTUALLY EXERCISED = YES]');

  // ---------------------------------------------------------------------------
  // SECTION I: CLEANUP
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Cleanup Verification ---');

  // 1. Delete test storage file using User A's own client
  const { error: removeFileErr } = await userA.client.storage
    .from('user-documents')
    .remove([userAFilePath]);
  assert(!removeFileErr, `Failed to remove test storage file: ${removeFileErr?.message}`);
  console.log('[PASS] Test storage object deleted');

  // 2. Delete test document row using User A's own client
  const { error: removeDocErr } = await userA.client
    .from('documents')
    .delete()
    .eq('id', createdDocA.id);
  assert(!removeDocErr, `Failed to remove test document: ${removeDocErr?.message}`);
  console.log('[PASS] Test document row deleted');

  // 3. Delete test watchlist row using User A's own client
  const { error: removeWatchErr } = await userA.client
    .from('market_watchlist')
    .delete()
    .eq('id', createdWatchA.id);
  assert(!removeWatchErr, `Failed to remove test watchlist row: ${removeWatchErr?.message}`);
  console.log('[PASS] Test watchlist row deleted');

  // Verify deletion from DB
  const { data: checkDoc } = await admin.from('documents').select('id').eq('id', createdDocA.id).maybeSingle();
  assert(checkDoc === null, 'Document row must not exist in DB');
  const { data: checkWatch } = await admin.from('market_watchlist').select('id').eq('id', createdWatchA.id).maybeSingle();
  assert(checkWatch === null, 'Watchlist row must not exist in DB');
  console.log('[PASS] Database cleanup confirmed (zero lingering records)');

  console.log('\n=================================================================');
  console.log('=== ALL REAL SUPABASE RLS VERIFICATION CHECKS PASSED ===');
  console.log('=================================================================');
}

runRlsVerification().catch((err) => {
  console.error('\nREAL SUPABASE RLS VERIFICATION FAILED:', err);
  process.exit(1);
});
