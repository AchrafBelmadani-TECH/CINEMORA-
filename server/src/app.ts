import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import type { Env } from './lib/env.js';
import type { Logger } from './lib/logger.js';
import { createRateLimiter } from './lib/rateLimit.js';
import { AppError } from './lib/errors.js';
import { requestId } from './middleware/requestId.js';
import { accessLog } from './middleware/accessLog.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { healthRoutes } from './routes/health.routes.js';
import { catalogRoutes } from './routes/catalog.routes.js';
import { libraryRoutes } from './routes/library.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { profileRoutes } from './routes/profile.routes.js';
import { CatalogController } from './controllers/catalog.controller.js';
import { CatalogService } from './services/tmdb/catalog.service.js';
import { TmdbClient } from './services/tmdb/tmdbClient.js';
import { CatalogSyncService } from './services/library/sync.service.js';
import { LibraryService } from './services/library/library.service.js';
import { createMediaStorage } from './services/media/storage.js';
import { FfmpegService } from './services/media/ffmpeg.js';
import { TranscodeService } from './services/media/transcode.service.js';
import { PlaybackService } from './services/media/playback.service.js';
import { mediaRoutes } from './routes/media.routes.js';

export interface AppOptions {
  env: Env;
  logger: Logger;
  fetchImpl?: typeof fetch;
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
  app.use(cookieParser());
  app.use(accessLog());

  const generalLimiter = createRateLimiter({ windowMs: 60_000, max: 240 });
  app.use('/api', generalLimiter.middleware);

  const catalog = new CatalogService(env, logger, options.fetchImpl);
  if (!catalog.configured) {
    logger.warn('TMDB_READ_ACCESS_TOKEN is not set — catalog endpoints will return 502 until server/.env provides one');
  }

  const tmdbClient = new TmdbClient({ token: env.TMDB_READ_ACCESS_TOKEN, logger, fetchImpl: options.fetchImpl });
  const sync = new CatalogSyncService(tmdbClient, logger);

  const storage = createMediaStorage(env);
  const ffmpeg = new FfmpegService(env);
  const transcode = new TranscodeService(ffmpeg, storage, logger);
  const playback = new PlaybackService(env);

  const api = express.Router();
  api.use(healthRoutes());
  api.use('/auth', authRoutes(env, logger));
  api.use('/profiles', profileRoutes(env));
  api.use(catalogRoutes(new CatalogController(catalog)));
  api.use(libraryRoutes({ sync, library: new LibraryService(), env }));
  api.use(mediaRoutes({ env, storage, transcode, playback }));

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
