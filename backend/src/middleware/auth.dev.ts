import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';

export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
}

const DEFAULT_DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * ISOLATED DEVELOPMENT-ONLY / AUTH-FREE Middleware.
 * 
 * FAIL-SAFE:
 * If this middleware is invoked when NODE_ENV === 'production', it immediately
 * throws a fatal exception and rejects the request.
 */
export function devAuthContext(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL SECURITY VIOLATION: devAuthContext cannot be invoked in production.');
  }

  // Stamp header indicating dev auth
  res.setHeader('X-Auth-Mode', 'DEVELOPMENT-ONLY / AUTH-FREE');

  // Security check: Never allow client to supply arbitrary user_id in body
  if (req.body && typeof req.body === 'object' && 'user_id' in req.body) {
    const attemptedUserId = req.body.user_id;
    delete req.body.user_id;

    const simulatedId = (req.headers['x-dev-user-id'] as string) || DEFAULT_DEV_USER_ID;
    if (attemptedUserId && attemptedUserId !== simulatedId) {
      return next(
        new AppError(
          'Client-supplied user_id is forbidden. Identity must derive from authenticated context.',
          403,
          'FORBIDDEN_USER_ID_OVERRIDE'
        )
      );
    }
  }

  const userId = (req.headers['x-dev-user-id'] as string) || DEFAULT_DEV_USER_ID;

  req.user = {
    id: userId,
    email: 'dev-user@example.local',
    role: 'USER',
  };

  req.auth = {
    userId,
    email: 'dev-user@example.local',
    role: 'USER',
  };

  next();
}
