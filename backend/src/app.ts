import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler, AppError } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/auth.js';
import { requestTimeout } from './middleware/timeout.js';
import { idempotencyMiddleware } from './middleware/idempotency.js';
import { authRateLimiter, aiRateLimiter, standardApiRateLimiter } from './middleware/rateLimiter.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { transactionRoutes } from './modules/transactions/transaction.routes.js';
import { documentRoutes } from './modules/documents/document.routes.js';
import { chatRoutes } from './modules/chat/chat.routes.js';
import { reportRoutes } from './modules/reports/report.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { allocationRoutes } from './modules/allocation/allocation.routes.js';
import jobRoutes from './modules/jobs/job.routes.js';

export function createApp(): Express {
  const app = express();

  // Hardened security headers with strict Helmet configuration
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https://pesvgxqpdeeyhjvqoaip.supabase.co'],
          connectSrc: ["'self'", 'http://localhost:3000', 'https://pesvgxqpdeeyhjvqoaip.supabase.co'],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // Allow cross-origin static loads
      frameguard: { action: 'deny' },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
  );

  // Strict CORS policy: Reject wildcard '*' in authenticated production environments; support multiple origins
  const parsedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
  const corsOrigin = env.NODE_ENV === 'production' && env.CORS_ORIGIN === '*'
    ? false
    : parsedOrigins.length === 1 ? parsedOrigins[0] : parsedOrigins;

  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request timeout protection (15s standard, 30s chat)
  app.use(requestTimeout(15000));

  // Safe request logging with redaction
  app.use(requestLogger);

  // Health check (Public, unauthenticated, exposes no secrets)
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'healthy',
      service: 'personal-ai-ca-backend',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      supabase_configured: env.IS_SUPABASE_CONFIGURED,
      environment: env.NODE_ENV,
    });
  });

  // Differentiated production rate limiters
  app.use('/api/v1/auth', authRateLimiter, authRoutes);

  // Idempotency protection on mutating endpoints
  app.use(idempotencyMiddleware);

  // Protected Core Financial & Operational APIs (require valid Supabase JWT + Rate Limiting)
  app.use('/api/v1/transactions', standardApiRateLimiter, requireAuth, transactionRoutes);
  app.use('/api/v1/allocation', standardApiRateLimiter, requireAuth, allocationRoutes);
  app.use('/api/v1/documents', standardApiRateLimiter, requireAuth, documentRoutes);
  app.use('/api/v1/chat', aiRateLimiter, requireAuth, chatRoutes);
  app.use('/api/v1/reports', standardApiRateLimiter, requireAuth, reportRoutes);
  app.use('/api/v1/jobs', standardApiRateLimiter, jobRoutes);

  // Admin APIs (requires valid Supabase JWT + ADMIN role)
  app.use('/api/v1/admin', requireAuth, adminRoutes);

  // Catch 404
  app.use((req: Request, res: Response, next: NextFunction) => {
    next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}
