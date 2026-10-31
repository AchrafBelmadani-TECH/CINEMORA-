import type { Request, Response, NextFunction } from 'express';

/** Structured access log: method, path, status and duration on response finish. */
export function accessLog(): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      req.log.info({ method: req.method, path: req.originalUrl, status: res.statusCode, durationMs }, 'access');
    });
    next();
  };
}
