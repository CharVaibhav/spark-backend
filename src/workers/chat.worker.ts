import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { CHANNELS } from '../config/redis.js';
import { publishChunk, publishResult } from '../services/redis.service.js';
import { ChatJob } from '../types/redis.types.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('chat.worker');

export async function startChatWorker(): Promise<void> {
  const workerSub = new Redis(env.REDIS_URL);

  await workerSub.subscribe(CHANNELS.CHAT_JOB);
  log.info(`Subscribed to channel: ${CHANNELS.CHAT_JOB}`);

  workerSub.on('message', async (_channel: string, message: string) => {
    let job: ChatJob | null = null;

    try {
      job = JSON.parse(message) as ChatJob;
      const { jobId, userId, threadId, runId, message: chatMessage } = job;

      log.info('Processing chat job', { jobId, threadId });

      // IMPORT MASTRA
      const { mastra } = await import('../ai/index.js');
      const agent = mastra.getAgent('consultantAgent');

      log.info('Running Consultant Agent (Streaming)', { jobId, threadId });

      const output = await agent.stream(chatMessage, {
        memory: { thread: threadId, resource: userId }
      });

      // Stream chunks via Redis
      for await (const chunk of output.textStream) {
        if (chunk) {
          await publishChunk(jobId, chunk);
        }
      }

      await output.getFullOutput();


      // Signal chat is done — use jobId as the channel key (not runId)
      await publishResult(jobId, {
        type: 'chat_done',
        runId: jobId,
      });

      log.info('Chat job complete', { jobId });
    } catch (err: any) {
      log.error('Chat job failed', { jobId: job?.jobId, error: err.message });

      if (job?.jobId) {
        await publishResult(job.jobId, {
          type: 'error',
          runId: job.jobId,
          error: err.message,
        });
      }
    }
  });

  workerSub.on('error', (err) => log.error('Redis subscriber error', { error: err.message }));
}
