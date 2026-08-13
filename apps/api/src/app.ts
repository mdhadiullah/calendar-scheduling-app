import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';

import { env, corsOrigins } from './lib/env';
import { logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

import { healthRouter } from './routes/health';
import { meRouter } from './routes/me';
import { adminRouter } from './routes/admin';
import { calendarsRouter } from './routes/calendars';
import { eventsRouter } from './routes/events';
import { meetingsRouter } from './routes/meetings';
import { tasksRouter } from './routes/tasks';
import { remindersRouter } from './routes/reminders';
import { notificationsRouter } from './routes/notifications';
import { telegramRouter } from './routes/telegram';
import { notesRouter } from './routes/notes';
import { searchRouter } from './routes/search';
import { jobsRouter } from './routes/jobs';
import { usersRouter } from './routes/users';

export function createApp() {
  const app = express();

  // Trust the reverse proxy Hostnin sits behind so rate-limiting and
  // secure cookies see the real client IP / protocol.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false, // the API serves JSON only; the web app sets its own CSP
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
  app.use(
    cors({
      origin: corsOrigins.length > 0 ? corsOrigins : false,
      credentials: true,
    })
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' })); // keep payloads small on a 2GB RAM host
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

  const limiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', limiter);

  // Health check has no /api prefix so it's trivially reachable by uptime monitors.
  app.use('/', healthRouter);

  app.use('/api', meRouter);
  app.use('/api', adminRouter);
  app.use('/api', calendarsRouter);
  app.use('/api', eventsRouter);
  app.use('/api', meetingsRouter);
  app.use('/api', tasksRouter);
  app.use('/api', remindersRouter);
  app.use('/api', notificationsRouter);
  app.use('/api', telegramRouter);
  app.use('/api', notesRouter);
  app.use('/api', searchRouter);
  app.use('/api', jobsRouter);
  app.use('/api', usersRouter);

  // Optional: serve the built web app from the same Node process, so a
  // single Hostnin "Node.js Application" slot can host both the API and
  // the static frontend (see docs/deployment.md, "Deploy the web app,
  // Option 1"). Controlled by STATIC_WEB_DIR — if unset or the directory
  // doesn't exist, this is a no-op and the API behaves as JSON-only
  // (e.g. when the web app is deployed separately, Option 2).
  const staticWebDir = process.env.STATIC_WEB_DIR
    ? path.resolve(process.env.STATIC_WEB_DIR)
    : path.resolve(__dirname, '../../web/dist');

  if (fs.existsSync(staticWebDir)) {
    app.use(express.static(staticWebDir, { maxAge: '1h', index: false }));
    // SPA fallback: any non-API, non-file GET request serves index.html so
    // client-side routing (React Router) works on a hard refresh/deep link.
    app.get(/^(?!\/api|\/health).*/, (_req, res) => {
      res.sendFile(path.join(staticWebDir, 'index.html'));
    });
    logger.info(`Serving static web app from ${staticWebDir}`);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
