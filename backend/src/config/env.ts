import dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'test') {
  dotenv.config();
}
export interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_JWT_SECRET: string;
  GEMINI_API_KEY: string;
  PRIMARY_AI_API_KEY: string;
  PRIMARY_AI_BASE_URL: string;
  PRIMARY_AI_MODEL: string;
  GROQ_API_KEY: string;
  GROQ_MODEL: string;
  ENCRYPTION_SECRET_KEY: string;
  CORS_ORIGIN: string;
  ENABLE_DEV_AUTH: boolean;
  ALLOWED_REDIRECT_URLS: string[];
  IS_SUPABASE_CONFIGURED: boolean;
  IS_GEMINI_CONFIGURED: boolean;
  IS_PRIMARY_AI_CONFIGURED: boolean;
  IS_GROQ_CONFIGURED: boolean;
}

const isProduction = process.env.NODE_ENV === 'production';
const enableDevAuth = process.env.NODE_ENV === 'test' ? true : process.env.ENABLE_DEV_AUTH === 'true';

// PRODUCTION FAIL-SAFE: Never allow development auth in production
if (isProduction && enableDevAuth) {
  console.error('[CRITICAL SECURITY ERROR] ENABLE_DEV_AUTH cannot be true in production.');
  throw new Error('FATAL SECURITY VIOLATION: Development authentication cannot be enabled in production environment. Failing closed.');
}

export function validateProductionEnvironment(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const missing: string[] = [];
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_URL.startsWith('http')) missing.push('SUPABASE_URL');
  if (!process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY.length < 20) missing.push('SUPABASE_ANON_KEY');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY.length < 20) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.length < 10) missing.push('GROQ_API_KEY');
  if (!process.env.ENCRYPTION_SECRET_KEY || process.env.ENCRYPTION_SECRET_KEY.length < 32) missing.push('ENCRYPTION_SECRET_KEY');
  if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*') missing.push('CORS_ORIGIN (explicit allowlist required, wildcard * forbidden in production)');

  if (missing.length > 0) {
    const errMsg = `FATAL CONFIGURATION ERROR: Missing or invalid required production environment variables:\n  - ${missing.join('\n  - ')}\nApplication cannot boot in production. Failing closed.`;
    console.error(errMsg);
    throw new Error(errMsg);
  }
}

// In production, validate immediately at startup
if (isProduction) {
  validateProductionEnvironment();
}

export function validateEncryptionConfig(isProd: boolean, key?: string): void {
  const effectiveKey = key || '';
  if (isProd) {
    if (
      !effectiveKey ||
      effectiveKey === 'dev-insecure-key-replace-in-env' ||
      effectiveKey.length < 32
    ) {
      throw new Error('FATAL SECURITY VIOLATION: A secure ENCRYPTION_SECRET_KEY (minimum 32 characters or 64-hex string) is strictly required in production. Failing closed.');
    }
  }
}

// PRODUCTION HARDENING: No hardcoded fallback encryption key.
// Test environments use a deterministic test key; all others require env var.
const rawEncryptionKey = process.env.ENCRYPTION_SECRET_KEY || (process.env.NODE_ENV === 'test' ? '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' : '');
validateEncryptionConfig(isProduction, process.env.ENCRYPTION_SECRET_KEY);

const geminiKey = process.env.GEMINI_API_KEY || '';
const primaryKey = process.env.PRIMARY_AI_API_KEY || '';
const groqKey = process.env.GROQ_API_KEY || '';

export const env: EnvConfig = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  // PRODUCTION HARDENING: No hardcoded Supabase credentials in source code.
  // These MUST come from environment variables.
  SUPABASE_URL: (process.env.SUPABASE_URL && process.env.SUPABASE_URL.startsWith('http'))
    ? process.env.SUPABASE_URL
    : '',
  SUPABASE_ANON_KEY: (process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_ANON_KEY.length > 20)
    ? process.env.SUPABASE_ANON_KEY
    : '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET || '',
  GEMINI_API_KEY: geminiKey,
  PRIMARY_AI_API_KEY: primaryKey,
  PRIMARY_AI_BASE_URL: process.env.PRIMARY_AI_BASE_URL || 'https://api.groq.com/openai/v1',
  PRIMARY_AI_MODEL: process.env.PRIMARY_AI_MODEL || 'openai/gpt-oss-120b',
  GROQ_API_KEY: groqKey,
  GROQ_MODEL: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  ENCRYPTION_SECRET_KEY: rawEncryptionKey,
  // PRODUCTION HARDENING: No wildcard CORS default. Must be explicitly configured.
  CORS_ORIGIN: process.env.CORS_ORIGIN || '',
  ENABLE_DEV_AUTH: enableDevAuth,
  ALLOWED_REDIRECT_URLS: (process.env.ALLOWED_REDIRECT_URLS || 'http://localhost:3000,https://personal-ai-ca.vercel.app')
    .split(',')
    .map((u) => u.trim()),
  IS_SUPABASE_CONFIGURED: Boolean(
    process.env.SUPABASE_URL && 
    (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
  ),
  IS_GEMINI_CONFIGURED: Boolean(geminiKey && geminiKey.length > 5),
  IS_PRIMARY_AI_CONFIGURED: Boolean(primaryKey && primaryKey.length > 5),
  IS_GROQ_CONFIGURED: Boolean(groqKey && groqKey.length > 5),
};
