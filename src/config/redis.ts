import { Redis } from 'ioredis';
import { env } from './env.js';

// Two separate connections are required — a subscriber cannot publish
const redisOptions = {
  maxRetriesPerRequest: null,
  retryStrategy: (times: number) => Math.min(times * 100, 3000), // Retry with backoff
};

export const publisher = new Redis(env.REDIS_URL, redisOptions);
export const subscriber = new Redis(env.REDIS_URL, redisOptions);

publisher.on('connect', () => console.log('✅  Redis publisher connected'));
publisher.on('error', (err) => console.error('❌  Redis publisher error:', err.message));

subscriber.on('connect', () => console.log('✅  Redis subscriber connected'));
subscriber.on('error', (err) => console.error('❌  Redis subscriber error:', err.message));

// Channel name constants — single source of truth for pub/sub channel names
export const CHANNELS = {
  VALIDATE_JOB: 'spark:job:validate',
  BLUEPRINT_JOB: 'spark:job:blueprint',
  CHAT_JOB: 'spark:job:chat',
  CONSULTANT_JOB: 'spark:job:consultant',
  RESULT: (runId: string) => `spark:result:${runId}`,
  CHUNK: (runId: string) => `spark:chunk:${runId}`,
} as const;
