import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { Logger } from './lib/logger.js';
import { createRateLimiter } from './lib/rateLimit.js';
import { AppError } from './lib/errors.js';
import { requestId } from './middleware/requestId.js';
import { accessLog } from './middleware/accessLog.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { healthRoutes } from './routes/health.routes.js';

export interface AppOptions {
  env: {
    NODE_ENV: string;
    CLIENT_ORIGIN: string;
  };
  logger: Logger;
  /** Extra routes mounted only under /api/v1/__test — never in production. */
  testRoutes?: boolean;
}

/**
 * Assembles the Express app without listening. Route modules mount under
 * /api/v1 in pipeline order; the central error handler closes the chain.
 */
export function createApp(options: AppOptions) {
  const { env, logger } = options;
  const app = express();

  app.disable('x-powered-by');
  app.use(requestId(logger));
  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(accessLog());

  const generalLimiter = createRateLimiter({ windowMs: 60_000, max: 240 });
  app.use('/api', generalLimiter.middleware);

  const api = express.Router();
  api.use(healthRoutes());

  if (options.testRoutes) {
    api.get('/__test/error', () => {
      throw AppError.badRequest('deliberate test error', [{ path: 'test', message: 'boom' }]);
    });
    api.get('/__test/crash', () => {
      throw new Error('deliberate unexpected crash');
    });
  }

  app.use('/api/v1', api);
  app.use(notFound());
  app.use(errorHandler(env.NODE_ENV === 'development'));

  return app;
}
