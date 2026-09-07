import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { getSupabaseAdminClient } from '../src/config/supabase.js';

async function audit() {
  const sb = getSupabaseAdminClient();
  const tables = [
    'profiles',
    'documents',
    'monthly_plans',
    'allocation_plans',
    'freedom_projections',
    'ai_action_items',
    'audit_logs',
    'market_watchlist',
    'market_data_cache',
    'knowledge_sources',
    'knowledge_chunks'
  ];

  console.log('=== AUDITING SUPABASE TABLES ===');
  for (const t of tables) {
    const res = await sb.from(t).select('*').limit(1);
    if (res.error) {
      console.log(`Table ${t}: ERROR ->`, res.error.message);
    } else {
      console.log(`Table ${t}: OK (row count sample: ${res.data?.length})`);
    }
  }

  // Check columns on documents
  console.log('\n=== AUDITING DOCUMENTS COLUMNS ===');
  const cols = [
    'id',
    'user_id',
    'file_name',
    'file_path',
    'file_type',
    'file_size',
    'extracted_data',
    'source_type',
    'processing_status',
    'ocr_status',
    'verification_status',
    'confirmed_at',
    'title',
    'file_hash'
  ];
  for (const c of cols) {
    const colRes = await sb.from('documents').select(c).limit(1);
    if (colRes.error) {
      console.log(`Column documents.${c}: ERROR ->`, colRes.error.message);
    } else {
      console.log(`Column documents.${c}: OK`);
    }
  }
}

audit().catch(console.error);
