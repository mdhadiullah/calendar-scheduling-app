import type { NextFunction, Request, Response } from 'express';
import { env } from '../lib/env';
import { ApiHttpError } from './errorHandler';

/**
 * Protects the scheduled-job HTTP endpoints (/api/jobs/*). These are meant
 * to be invoked by an external scheduler (Hostnin's cron/scheduled task
 * feature, or any third-party HTTP cron pinger) since the hosting
 * environment does not guarantee a persistent background worker process.
 */
export function requireCronSecret(req: Request, _res: Response, next: NextFunction) {
  const provided = req.header('X-Cron-Secret');
  if (!provided || provided !== env.CRON_SECRET) {
    return next(new ApiHttpError(401, 'UNAUTHORIZED', 'Invalid cron secret'));
  }
  next();
}
