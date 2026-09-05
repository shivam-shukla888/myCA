import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';

let supabaseClient: SupabaseClient | null = null;
let supabaseAdminClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      throw new Error('Supabase URL and Anon Key must be configured in environment variables');
    }
    supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseClient;
}

export function getSupabaseAdminClient(): SupabaseClient {
  if (!supabaseAdminClient) {
    // PRODUCTION HARDENING: Admin client MUST use service role key, not anon key.
    // Falling back to anon key would mean admin operations go through RLS, which
    // silently changes security semantics.
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) {
      if (env.NODE_ENV === 'production') {
        throw new Error('FATAL: SUPABASE_SERVICE_ROLE_KEY is required in production for admin operations. Failing closed.');
      }
      // In dev/test, fall back to anon key with a warning
      console.warn('[SECURITY WARNING] SUPABASE_SERVICE_ROLE_KEY not configured. Admin client using anon key (dev/test only).');
    }
    const effectiveKey = key || env.SUPABASE_ANON_KEY;
    if (!env.SUPABASE_URL || !effectiveKey) {
      throw new Error('Supabase URL and Key must be configured in environment variables');
    }
    supabaseAdminClient = createClient(env.SUPABASE_URL, effectiveKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseAdminClient;
}
