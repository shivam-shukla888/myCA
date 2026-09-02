import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler, AppError } from './middleware/errorHandler.js';
import { devAuthContext } from './middleware/auth.dev.js';
import { transactionRoutes } from './modules/transactions/transaction.routes.js';
import { documentRoutes } from './modules/documents/document.routes.js';
import { chatRoutes } from './modules/chat/chat.routes.js';
import { reportRoutes } from './modules/reports/report.routes.js';

export function createApp(): Express {
  const app = express();

  // Basic security and parsing
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Safe Request correlation and logging
  app.use(requestLogger);

  // Health check (public, unauthenticated)
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

  // Development auth context (stamped DEVELOPMENT-ONLY / AUTH-FREE)
  app.use('/api', devAuthContext);

  // Core API Routes
  app.use('/api/v1/transactions', transactionRoutes);
  app.use('/api/v1/documents', documentRoutes);
  app.use('/api/v1/chat', chatRoutes);
  app.use('/api/v1/reports', reportRoutes);

  // Catch 404
  app.use((req: Request, res: Response, next: NextFunction) => {
    next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}
