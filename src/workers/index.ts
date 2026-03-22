import logger from '../utils/logger.js';
import { startValidateWorker } from './validate.worker.js';
import { startBlueprintWorker } from './blueprint.worker.js';
import { startChatWorker } from './chat.worker.js';
import { startConsultantWorker } from './consultant.worker.js';
import { publisher, subscriber } from '../config/redis.js';

async function main() {
  logger.info('🤖 Spark Worker process starting...');

  await Promise.all([
    startValidateWorker(),
    startBlueprintWorker(),
    startChatWorker(),
    startConsultantWorker()
  ]);

  logger.info('✅ All workers listening on Redis channels');
}

main().catch((err) => {
  logger.error('Worker process crashed', { error: err.message, stack: err.stack });
  process.exit(1);
});

// Graceful shutdown
async function shutdown() {
  logger.info('Worker process shutting down...');
  await publisher.quit();
  await subscriber.quit();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
