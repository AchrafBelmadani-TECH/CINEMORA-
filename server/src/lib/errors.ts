export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL_ERROR';

export interface AppErrorOptions {
  details?: unknown;
  cause?: unknown;
}

/** Operational error carrying an HTTP status and a stable machine code. */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
    options?: { cause?: unknown },
  ) {
    super(message, options as { cause?: unknown });
    this.name = 'AppError';
  }

  static badRequest(message = 'Invalid request', details?: unknown) {
    return new AppError('VALIDATION_ERROR', 400, message, details);
  }
  static unauthorized(message = 'Authentication required') {
    return new AppError('UNAUTHORIZED', 401, message);
  }
  static forbidden(message = 'You do not have access to this resource') {
    return new AppError('FORBIDDEN', 403, message);
  }
  static notFound(message = 'Resource not found') {
    return new AppError('NOT_FOUND', 404, message);
  }
  static conflict(message = 'Conflict', details?: unknown) {
    return new AppError('CONFLICT', 409, message, details);
  }
  static payloadTooLarge(message = 'Payload too large') {
    return new AppError('PAYLOAD_TOO_LARGE', 413, message);
  }
  static rateLimited(message = 'Too many requests', details?: unknown) {
    return new AppError('RATE_LIMITED', 429, message, details);
  }
  static upstream(message = 'Upstream service failed', details?: unknown) {
    return new AppError('UPSTREAM_ERROR', 502, message, details);
  }
  static internal(message = 'Something went wrong', details?: unknown) {
    return new AppError('INTERNAL_ERROR', 500, message, details);
  }
}
