import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { getSupabaseAdminClient } from '../src/config/supabase.js';

async function checkDatabase() {
  console.log('--- AUDITING SUPABASE KNOWLEDGE STATE ---');
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    console.log('Supabase client unavailable');
    process.exit(1);
  }

  try {
    const sRes = await supabase.from('knowledge_sources').select('id, source_id, title, authority_level, status');
    console.log('knowledge_sources query:', {
      error: sRes.error ? sRes.error.message : null,
      count: sRes.data?.length,
      sample: sRes.data?.slice(0, 5),
    });

    const cRes = await supabase.from('knowledge_chunks').select('id, chunk_id, headline, chunk_type');
    console.log('knowledge_chunks query:', {
      error: cRes.error ? cRes.error.message : null,
      count: cRes.data?.length,
      sample: cRes.data?.slice(0, 5),
    });
  } catch (err: any) {
    console.error('Exception during database audit:', err.message);
  }
  process.exit(0);
}

checkDatabase();
