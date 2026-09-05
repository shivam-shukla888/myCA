import { Request, Response, NextFunction } from 'express';

interface CachedResponse {
  statusCode: number;
  body: any;
  timestamp: number;
}

const IDEMPOTENCY_TTL_MS = 60 * 60 * 1000; // 1 hour TTL
const idempotencyStore = new Map<string, CachedResponse>();

// PRODUCTION HARDENING: Periodic cleanup to prevent memory leaks on long-running instances.
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // Every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of idempotencyStore) {
    if (now - entry.timestamp > IDEMPOTENCY_TTL_MS) {
      idempotencyStore.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only apply to mutating requests (POST, PUT, PATCH, DELETE)
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const idempotencyKey = req.header('Idempotency-Key') || req.header('idempotency-key');
  if (!idempotencyKey) {
    return next();
  }

  const userId = req.user?.id || 'anonymous';
  const compositeKey = `${userId}:${idempotencyKey}`;
  const now = Date.now();

  const cached = idempotencyStore.get(compositeKey);
  if (cached) {
    if (now - cached.timestamp < IDEMPOTENCY_TTL_MS) {
      res.setHeader('X-Cache-Lookup', 'HIT');
      res.setHeader('X-Idempotency', 'REPLAYED');
      return res.status(cached.statusCode).json(cached.body);
    } else {
      idempotencyStore.delete(compositeKey);
    }
  }

  // Intercept response to cache it
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      idempotencyStore.set(compositeKey, {
        statusCode: res.statusCode,
        body,
        timestamp: Date.now(),
      });
    }
    res.setHeader('X-Idempotency', 'APPLIED');
    return originalJson(body);
  };

  next();
}
