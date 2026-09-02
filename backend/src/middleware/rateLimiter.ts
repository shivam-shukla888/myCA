import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';

interface RateLimitStore {
  count: number;
  resetTime: number;
}

const memoryStore = new Map<string, RateLimitStore>();

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyPrefix?: string;
}

/**
 * Production rate limiting middleware.
 * Provides per-IP / per-user request throttling.
 */
export function rateLimiter(options: RateLimitOptions) {
  const { windowMs, max, message = 'Rate limit exceeded. Please try again later.', keyPrefix = 'rl' } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const identifier = req.user?.id || req.ip || req.socket.remoteAddress || 'anonymous';
    const key = `${keyPrefix}:${identifier}`;
    const now = Date.now();

    let entry = memoryStore.get(key);
    if (!entry || now > entry.resetTime) {
      entry = { count: 1, resetTime: now + windowMs };
      memoryStore.set(key, entry);
    } else {
      entry.count += 1;
    }

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));

    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetTime - now) / 1000));
      return next(new AppError(message, 429, 'RATE_LIMIT_EXCEEDED'));
    }

    next();
  };
}

// Preset tiers:
export const authRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 20, // 20 attempts
  message: 'Too many authentication attempts. Please wait 15 minutes before retrying.',
  keyPrefix: 'auth',
});

export const aiRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 15, // 15 inquiries / min
  message: 'AI inquiry throughput exceeded. Limit is 15 requests per minute.',
  keyPrefix: 'ai',
});

export const standardApiRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests / min
  message: 'API rate limit exceeded.',
  keyPrefix: 'api',
});
