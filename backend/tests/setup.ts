// tests/setup.ts
// Bootstrap environment variables for test suite
import dotenv from 'dotenv';
dotenv.config();
process.env.NODE_ENV = 'test';
process.env.ENABLE_DEV_AUTH = 'true';
process.env.ENCRYPTION_SECRET_KEY = process.env.ENCRYPTION_SECRET_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://pesvgxqpdeeyhjvqoaip.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy-test-key';

