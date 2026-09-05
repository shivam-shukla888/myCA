import { Request, Response, NextFunction } from 'express';
import { decodeJwt } from 'jose';
import { AppError } from './errorHandler.js';
import { env } from '../config/env.js';
import { getSupabaseClient, getSupabaseAdminClient } from '../config/supabase.js';

export type UserRole = 'USER' | 'ADMIN';

export interface AuthContext {
  userId: string;
  role: UserRole;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        role?: UserRole;
      };
      auth?: AuthContext;
    }
  }
}

// In-memory mock profiles store for unit/security test users.
// PRODUCTION HARDENING: This map is NEVER consulted in production.
export const testUserRoles = new Map<string, UserRole>();

/**
 * Server-side Supabase JWT verification and authentication middleware
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    let token = '';
    const authHeader = req.headers.authorization;

    // 1. Check Authorization header
    if (authHeader) {
      if (!authHeader.startsWith('Bearer ')) {
        throw new AppError('Malformed authorization header. Expected "Bearer <token>"', 401, 'UNAUTHORIZED_INVALID_HEADER');
      }
      token = authHeader.slice(7).trim();
    } else if (req.headers.cookie) {
      // 2. Check HttpOnly cookie (personal_ca_session)
      const cookies = req.headers.cookie.split(';').reduce((acc: Record<string, string>, pair: string) => {
          const [k, v] = pair.trim().split('=');
          if (k && v) acc[k] = decodeURIComponent(v);
          return acc;
        }, {} as Record<string, string>);
       if (cookies['personal_ca_session']) {
         token = cookies['personal_ca_session'];
       }
    }

    if (!token) {
      throw new AppError('Authentication credentials missing. Bearer token or session cookie required.', 401, 'UNAUTHORIZED_NO_TOKEN');
    }

    // 3. Empty token check
    if (!token) {
      throw new AppError('Authentication token cannot be empty', 401, 'UNAUTHORIZED_EMPTY_TOKEN');
    }

    let userId = '';
    let email = '';

    // Non-production test tokens for deterministic multi-user security tests
    if (token.startsWith('mock-test-token:')) {
       // Mock tokens are only allowed in non-production when dev auth is explicitly enabled
       if (env.NODE_ENV === 'production' || !env.ENABLE_DEV_AUTH) {
         throw new AppError('Mock tokens are strictly forbidden in production', 401, 'UNAUTHORIZED_INVALID_TOKEN');
       }
       const parts = token.split(':');
       userId = parts[1] || '00000000-0000-0000-0000-000000000001';
       email = parts[2] || 'test@example.com';
     } else {
      // Decode claims and check expiration directly
      try {
        const claims = decodeJwt(token);
        if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) {
          throw new AppError('Authentication token has expired', 401, 'UNAUTHORIZED_EXPIRED_TOKEN');
        }
        if (claims.sub) {
          userId = claims.sub;
          email = (claims.email as string) || '';
        } else {
          throw new AppError('Token payload is missing subject (sub) claim', 401, 'UNAUTHORIZED_INVALID_TOKEN');
        }
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        throw new AppError('Invalid JWT format or signature encoding', 401, 'UNAUTHORIZED_INVALID_TOKEN');
      }

      // Official Supabase Auth server token verification
      try {
        const supabase = getSupabaseClient();
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
          throw new AppError(
            `Token verification failed: ${error?.message || 'Invalid or revoked token'}`,
            401,
            'UNAUTHORIZED_TOKEN_VERIFICATION_FAILED'
          );
        }

        userId = user.id;
        email = user.email || email;
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        throw new AppError('Cryptographic token verification rejected by Auth server', 401, 'UNAUTHORIZED_TOKEN_VERIFICATION_FAILED');
      }
    }

    // 4. Retrieve verified user role from profiles table (or test store)
    let userRole: UserRole = 'USER';
    // PRODUCTION HARDENING: testUserRoles is NEVER consulted in production
    if (env.NODE_ENV !== 'production' && testUserRoles.has(userId)) {
      userRole = testUserRoles.get(userId)!;
    } else {
      try {
        const supabaseAdmin = getSupabaseAdminClient();
        const { data: profile, error: profileErr } = await supabaseAdmin
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle();

        if (profileErr) {
          throw new AppError(
            `Database role lookup failed: ${profileErr.message}`,
            500,
            'DATABASE_ROLE_LOOKUP_FAILED'
          );
        }

        if (profile && (profile.role === 'ADMIN' || profile.role === 'USER')) {
          userRole = profile.role as UserRole;
        } else if (!profile) {
          // PRODUCTION HARDENING: Fail closed when profile is missing.
          // Do NOT silently default to USER role.
          throw new AppError(
            'User profile not found. Authentication requires a valid profile record.',
            403,
            'PROFILE_NOT_FOUND_FAIL_CLOSED'
          );
        }
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        throw new AppError(`Role verification failure: ${err.message}`, 500, 'DATABASE_ROLE_LOOKUP_FAILED');
      }
    }

    // 5. Establish immutable request context
    req.user = {
      id: userId,
      email,
      role: userRole,
    };

    req.auth = {
      userId,
      email,
      role: userRole,
    };

    // 6. Security Check: Never allow client body, query, or params to override or inject user identity
    const identityFields = ['user_id', 'owner_id', 'profile_id'];
    for (const field of identityFields) {
      // Check body
      if (req.body && typeof req.body === 'object' && field in req.body) {
        const attempted = req.body[field];
        if (attempted && attempted !== userId && userRole !== 'ADMIN') {
          throw new AppError(
            `Client-supplied ${field} does not match authenticated identity`,
            403,
            'FORBIDDEN_USER_ID_OVERRIDE'
          );
        }
        delete req.body[field];
      }
      // Check query
      if (req.query && typeof req.query === 'object' && field in req.query) {
        const attempted = req.query[field];
        if (attempted && attempted !== userId && userRole !== 'ADMIN') {
          throw new AppError(
            `Client-supplied ${field} query parameter does not match authenticated identity`,
            403,
            'FORBIDDEN_USER_ID_OVERRIDE'
          );
        }
      }
    }

    // 7. Security Check: Prevent client from injecting role in body to promote self
    if (req.body && typeof req.body === 'object' && 'role' in req.body) {
      delete req.body.role;
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Role-Based Access Control (RBAC) middleware
 */
export function requireRole(requiredRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.auth) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }

    if (requiredRole === 'ADMIN' && req.user.role !== 'ADMIN') {
      return next(
        new AppError('Access denied: Administrator privileges required', 403, 'FORBIDDEN_INSUFFICIENT_ROLE')
      );
    }

    next();
  };
}
