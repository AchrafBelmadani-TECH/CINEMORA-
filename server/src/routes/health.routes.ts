import { Router } from 'express';
import { appVersion } from '../lib/version.js';

export function healthRoutes(): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: appVersion(),
      uptime: Math.round(process.uptime()),
    });
  });

  return router;
}
