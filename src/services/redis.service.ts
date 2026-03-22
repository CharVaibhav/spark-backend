import { Redis } from 'ioredis';
import { publisher, CHANNELS } from '../config/redis.js';
import { ResultEvent, ChunkEvent } from '../types/redis.types.js';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';

/** Publish a job payload to a Redis channel */
export async function publishJob(channel: string, payload: object): Promise<void> {
  const message = JSON.stringify(payload);
  await publisher.publish(channel, message);
  logger.debug(`Published job to channel: ${channel}`);
}

/**
 * Subscribe to result + chunk channels for a given runId (or jobId for chat).
 * Creates its own Redis connection so SSE streams don't block each other.
 * Returns an unsubscribe/cleanup function to call when the client disconnects.
 */
export async function subscribeToResult(
  id: string,
  onChunk: (chunk: string) => void,
  onResult: (event: ResultEvent) => void,
  onError: (err: Error) => void
): Promise<() => void> {
  const localSub = new Redis(env.REDIS_URL);

  const resultChannel = CHANNELS.RESULT(id);
  const chunkChannel = CHANNELS.CHUNK(id);

  await localSub.subscribe(resultChannel, chunkChannel);

  localSub.on('message', (_channel: string, message: string) => {
    try {
      const parsed = JSON.parse(message);

      if (parsed.type === 'chunk') {
        onChunk((parsed as ChunkEvent).chunk);
      } else {
        onResult(parsed as ResultEvent);
      }
    } catch (err) {
      onError(new Error('Failed to parse Redis message'));
    }
  });

  localSub.on('error', onError);

  let isUnsubscribed = false;
  // Return cleanup function
  return () => {
    if (isUnsubscribed) return;
    isUnsubscribed = true;
    localSub.unsubscribe(resultChannel, chunkChannel).catch(() => {});
    localSub.quit().catch(() => {});
  };
}

/** Publish a streaming chunk (called by workers) */
export async function publishChunk(runId: string, chunk: string): Promise<void> {
  const payload: ChunkEvent = { type: 'chunk', chunk };
  await publisher.publish(CHANNELS.CHUNK(runId), JSON.stringify(payload));
}

/** Publish a final result event (called by workers) */
export async function publishResult(runId: string, event: ResultEvent): Promise<void> {
  await publisher.publish(CHANNELS.RESULT(runId), JSON.stringify(event));
  logger.debug(`Published result event: ${event.type} for ${runId}`);
}
