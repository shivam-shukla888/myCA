import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler, AppError } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/auth.js';
import { requestTimeout } from './middleware/timeout.js';
import { idempotencyMiddleware } from './middleware/idempotency.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { transactionRoutes } from './modules/transactions/transaction.routes.js';
import { documentRoutes } from './modules/documents/document.routes.js';
import { chatRoutes } from './modules/chat/chat.routes.js';
import { reportRoutes } from './modules/reports/report.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import jobRoutes from './modules/jobs/job.routes.js';

export function createApp(): Express {
  const app = express();

  // Basic security and parsing
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

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

  // Authentication routes (signup, login, magic-link are public; /me is protected)
  app.use('/api/v1/auth', authRoutes);

  // Idempotency protection on mutating endpoints
  app.use(idempotencyMiddleware);

  // Protected Core Financial & Operational APIs (require valid Supabase JWT)
  app.use('/api/v1/transactions', requireAuth, transactionRoutes);
  app.use('/api/v1/documents', requireAuth, documentRoutes);
  app.use('/api/v1/chat', requireAuth, chatRoutes);
  app.use('/api/v1/reports', requireAuth, reportRoutes);
  app.use('/api/v1/jobs', requireAuth, jobRoutes);

  // Admin APIs (requires valid Supabase JWT + ADMIN role)
  app.use('/api/v1/admin', adminRoutes);

  // Catch 404
  app.use((req: Request, res: Response, next: NextFunction) => {
    next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}
