import { createApp } from './app';
import { env } from './lib/env';
import { logger } from './lib/logger';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`API listening on port ${env.PORT} (${env.NODE_ENV})`);
});

// Graceful shutdown — important on managed hosts that send SIGTERM when
// redeploying or recycling the process.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
