import app from './app.js';
import { env } from './config/env.js';
import { checkDbConnection } from './config/db.js';
import { publisher } from './config/redis.js';
import logger from './utils/logger.js';

async function start() {
  // Verify external connections before accepting traffic
  await checkDbConnection();
  await publisher.ping();
  logger.info('✅  Redis publisher connected');

  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 Spark API running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  // Graceful shutdown
  const shutdown = () => {
    logger.info('Shutting down API server...');
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any) => {
    logger.error('Unhandled rejection', { error: reason?.stack || reason?.message || reason });
    process.exit(1);
  });
}

start().catch((err) => {
  logger.error('Failed to start server', { error: err.message });
  process.exit(1);
});
