import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';

export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const DEFAULT_DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * DEVELOPMENT-ONLY / AUTH-FREE Middleware.
 * 
 * IMPORTANT:
 * - This middleware is active ONLY until Step 4 (Authentication) is implemented.
 * - Stamps the response with warning header `X-Auth-Mode: DEVELOPMENT-ONLY / AUTH-FREE`.
 * - Strictly prevents client from spoofing another user via request body:
 *   If client sends `user_id` in body that does not match derived identity, it is rejected.
 * - Supports simulated multi-user context via `X-Dev-User-Id` header exclusively for security tests.
 */
export function devAuthContext(req: Request, res: Response, next: NextFunction) {
  // Clear marker that this is unauthenticated / development-only mode
  res.setHeader('X-Auth-Mode', 'DEVELOPMENT-ONLY / AUTH-FREE');

  // Security check: Never allow client to supply arbitrary user_id in body
  if (req.body && typeof req.body === 'object' && 'user_id' in req.body) {
    const attemptedUserId = req.body.user_id;
    // Strip it to prevent client injection
    delete req.body.user_id;
    
    // If the attempted user_id was an explicit attempt to spoof another user
    const simulatedId = (req.headers['x-dev-user-id'] as string) || DEFAULT_DEV_USER_ID;
    if (attemptedUserId && attemptedUserId !== simulatedId) {
      return next(new AppError('Client-supplied user_id is forbidden. Identity must derive from authenticated context.', 403, 'FORBIDDEN_USER_ID_OVERRIDE'));
    }
  }

  // Derive user identity from dev header (for tests) or fallback to default dev user
  const userId = (req.headers['x-dev-user-id'] as string) || DEFAULT_DEV_USER_ID;

  req.user = {
    id: userId,
    email: 'dev-user@example.local',
    role: 'authenticated'
  };

  next();
}
