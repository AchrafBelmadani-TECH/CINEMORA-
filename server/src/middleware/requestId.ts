import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import type { Logger } from '../lib/logger.js';

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
    log: Logger;
  }
}

/** Attaches a request id (respecting inbound X-Request-Id) and a child logger. */
export function requestId(logger: Logger): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const incoming = req.header('x-request-id');
    const id = incoming && incoming.length <= 128 ? incoming : `req_${randomUUID()}`;
    req.requestId = id;
    req.log = logger.child({ requestId: id });
    res.setHeader('X-Request-Id', id);
    next();
  };
}
