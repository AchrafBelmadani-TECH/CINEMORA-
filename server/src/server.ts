// Load server/.env into process.env before anything validates it.
// In production, real env vars take precedence and .env is usually absent.
import 'dotenv/config';
import { createApp } from './app.js';
import { env, EnvValidationError, type Env } from './lib/env.js';
import { createLogger } from './lib/logger.js';

function formatEnvIssues(error: EnvValidationError): string {
  return error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
}

function resolveEnv(): Env {
  try {
    return env();
  } catch (err) {
    if (err instanceof EnvValidationError) {
      console.error(`Refusing to start — invalid environment:\n${formatEnvIssues(err)}`);
    } else {
      console.error('Refusing to start — unexpected boot failure', err);
    }
    process.exit(1);
  }
}

const currentEnv = resolveEnv();
const logger = createLogger(currentEnv);
const app = createApp({ env: currentEnv, logger });

const server = app.listen(currentEnv.PORT, () => {
  logger.info(
    { port: currentEnv.PORT, env: currentEnv.NODE_ENV },
    `CINEMORA API ready on :${currentEnv.PORT}`,
  );
});

function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  server.close(() => {
    logger.info('closed');
    process.exit(0);
  });
  // Failsafe if connections refuse to drain
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
