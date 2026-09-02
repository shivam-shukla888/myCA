import dotenv from 'dotenv';
dotenv.config();

export interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_JWT_SECRET: string;
  ENCRYPTION_SECRET_KEY: string;
  CORS_ORIGIN: string;
  ENABLE_DEV_AUTH: boolean;
  ALLOWED_REDIRECT_URLS: string[];
  IS_SUPABASE_CONFIGURED: boolean;
}

const isProduction = process.env.NODE_ENV === 'production';
const enableDevAuth = process.env.ENABLE_DEV_AUTH === 'true';

// PRODUCTION FAIL-SAFE: Never allow development auth in production
if (isProduction && enableDevAuth) {
  console.error('[CRITICAL SECURITY ERROR] ENABLE_DEV_AUTH cannot be true in production.');
  throw new Error('FATAL SECURITY VIOLATION: Development authentication cannot be enabled in production environment. Failing closed.');
}

export const env: EnvConfig = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://pesvgxqpdeeyhjvqoaip.supabase.co',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET || '',
  ENCRYPTION_SECRET_KEY: process.env.ENCRYPTION_SECRET_KEY || 'dev-insecure-key-replace-in-env',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  ENABLE_DEV_AUTH: enableDevAuth,
  ALLOWED_REDIRECT_URLS: (process.env.ALLOWED_REDIRECT_URLS || 'http://localhost:3000,https://personal-ai-ca.vercel.app')
    .split(',')
    .map((u) => u.trim()),
  IS_SUPABASE_CONFIGURED: Boolean(
    process.env.SUPABASE_URL && 
    (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
  )
};
