import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`[BACKEND_API] Personal AI CA Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  console.log(`[BACKEND_API] Health check available at: http://localhost:${env.PORT}/health`);
  console.log(`[BACKEND_API] Warning: Running in DEVELOPMENT-ONLY / AUTH-FREE mode until Step 4`);
});

process.on('SIGTERM', () => {
  console.log('[BACKEND_API] SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('[BACKEND_API] Server closed.');
    process.exit(0);
  });
});
