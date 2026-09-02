import { Request, Response, NextFunction } from 'express';

export function requestTimeout(timeoutMs = 15000) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Give AI chat endpoint slightly higher timeout allowance (30s)
    const effectiveTimeout = req.path.includes('/chat') ? 30000 : timeoutMs;

    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({
          error: {
            code: 'GATEWAY_TIMEOUT',
            message: `Request execution exceeded limit of ${effectiveTimeout / 1000} seconds.`,
          },
        });
      }
    }, effectiveTimeout);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
  };
}
