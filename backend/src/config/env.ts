import dotenv from 'dotenv';
dotenv.config();

export interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ENCRYPTION_SECRET_KEY: string;
  CORS_ORIGIN: string;
  IS_SUPABASE_CONFIGURED: boolean;
}

export const env: EnvConfig = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://pesvgxqpdeeyhjvqoaip.supabase.co',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  ENCRYPTION_SECRET_KEY: process.env.ENCRYPTION_SECRET_KEY || 'dev-insecure-key-replace-in-env',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  IS_SUPABASE_CONFIGURED: Boolean(
    process.env.SUPABASE_URL && 
    (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
  )
};
