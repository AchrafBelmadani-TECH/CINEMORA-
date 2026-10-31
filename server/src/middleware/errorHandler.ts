import type { Request, Response, NextFunction } from 'express';
import type { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';

function isZodError(err: unknown): err is ZodError {
  return err instanceof Error && err.name === 'ZodError';
}

/** body-parser failures carry a machine-readable `type` (e.g. entity.parse.failed). */
function isBodyParserError(err: unknown, type: string): boolean {
  return err instanceof Error && (err as { type?: string }).type === type;
}

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

/** Central error renderer — every failure leaves the API in this envelope shape. */
export function errorHandler(isDev: boolean) {
  return (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    let appErr: AppError;

    if (err instanceof AppError) {
      appErr = err;
    } else if (isZodError(err)) {
      appErr = AppError.badRequest('Request validation failed', err.issues);
    } else if (isBodyParserError(err, 'entity.parse.failed')) {
      appErr = AppError.badRequest('Malformed JSON body');
    } else if (isBodyParserError(err, 'entity.too.large')) {
      appErr = AppError.payloadTooLarge();
    } else if (err instanceof Error) {
      appErr = AppError.internal();
    } else {
      appErr = AppError.internal();
    }

    const logPayload = {
      err,
      code: appErr.code,
      status: appErr.status,
      requestId: req.requestId,
    };
    if (appErr.status >= 500) {
      req.log.error(logPayload, appErr.message);
    } else {
      req.log.warn(logPayload, appErr.message);
    }

    // Operational errors keep their messages (they are safe and actionable);
    // only unexpected internal failures are masked outside development.
    const masked = appErr.code === 'INTERNAL_ERROR' && !isDev;

    const envelope: ErrorEnvelope = {
      error: {
        code: appErr.code,
        message: masked ? 'Something went wrong' : appErr.message,
        requestId: req.requestId,
      },
    };
    if (appErr.details !== undefined && appErr.status < 500) {
      envelope.error.details = appErr.details;
    }

    res.status(appErr.status).json(envelope);
  };
}

/** 404 for unmatched API routes — same envelope shape. */
export function notFound() {
  return (req: Request, res: Response, _next: NextFunction) => {
    const envelope: ErrorEnvelope = {
      error: {
        code: 'NOT_FOUND',
        message: `No route for ${req.method} ${req.originalUrl}`,
        requestId: req.requestId,
      },
    };
    res.status(404).json(envelope);
  };
}
