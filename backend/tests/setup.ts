// tests/setup.ts
// Bootstrap environment variables for test suite
import dotenv from 'dotenv';
dotenv.config();
process.env.NODE_ENV = 'test';
process.env.ENABLE_DEV_AUTH = 'true';
