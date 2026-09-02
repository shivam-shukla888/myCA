import dotenv from 'dotenv';
dotenv.config();

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
const enableDevAuth = process.env.ENABLE_DEV_AUTH === 'true';

// PRODUCTION FAIL-SAFE: Never allow development auth in production
if (isProduction && enableDevAuth) {
  console.error('[CRITICAL SECURITY ERROR] ENABLE_DEV_AUTH cannot be true in production.');
  throw new Error('FATAL SECURITY VIOLATION: Development authentication cannot be enabled in production environment. Failing closed.');
}

const geminiKey = process.env.GEMINI_API_KEY || '';
const primaryKey = process.env.PRIMARY_AI_API_KEY || '';
const groqKey = process.env.GROQ_API_KEY || '';

export const env: EnvConfig = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  SUPABASE_URL: (process.env.SUPABASE_URL && process.env.SUPABASE_URL.startsWith('http'))
    ? process.env.SUPABASE_URL
    : 'https://pesvgxqpdeeyhjvqoaip.supabase.co',
  SUPABASE_ANON_KEY: (process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_ANON_KEY.length > 20)
    ? process.env.SUPABASE_ANON_KEY
    : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlc3ZneHFwZGVleWhqdnFvYWlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjA3MjgsImV4cCI6MjA4ODYzNjcyOH0.Bs6MLeIqYyL4Y6lH-GgBAPzswQBP1I8BtTPgiP4L7zo',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET || '',
  GEMINI_API_KEY: geminiKey,
  PRIMARY_AI_API_KEY: primaryKey,
  PRIMARY_AI_BASE_URL: process.env.PRIMARY_AI_BASE_URL || 'https://api.sambanova.ai/v1',
  PRIMARY_AI_MODEL: process.env.PRIMARY_AI_MODEL || 'Meta-Llama-3.3-70B-Instruct',
  GROQ_API_KEY: groqKey,
  GROQ_MODEL: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  ENCRYPTION_SECRET_KEY: process.env.ENCRYPTION_SECRET_KEY || 'dev-insecure-key-replace-in-env',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
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
