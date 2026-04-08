import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { CHANNELS } from '../config/redis.js';
import { publishChunk, publishResult } from '../services/redis.service.js';
import { saveMessage, updateThreadTitle } from '../services/chat.service.js';
import { refundCredits } from '../services/credit.service.js';
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

      log.info('Running Advisor Attempt (Primary: Gemini 3 Flash Preview)', { jobId, threadId });

      let output;
      try {
        // Try the smart primary model first
        output = await agent.stream(chatMessage, {
          memory: { thread: threadId, resource: userId }
        });
      } catch (primaryErr: any) {
        const isBusy = 
           primaryErr.message?.toLowerCase().includes('demand') || 
           primaryErr.message?.toLowerCase().includes('busy') || 
           primaryErr.message?.toLowerCase().includes('unavailable') ||
           primaryErr.message?.toLowerCase().includes('503');

        if (isBusy) {
           log.warn('Gemini Flash 3 Busy! Cascading to Groq fallback...', { jobId });
           
           // Force the model switch on the agent instance
           (agent as any).model = 'groq/llama-3.3-70b-versatile';

           output = await agent.stream(chatMessage, {
             memory: { thread: threadId, resource: userId }
           });
        } else {
           throw primaryErr; // Re-throw if it wasn't a "busy" error
        }
      }

      // Stream chunks via Redis
      let fullText = '';
      try {
        for await (const chunk of (output as any).textStream) {
          if (chunk) {
            fullText += chunk;
            await publishChunk(jobId, chunk);
          }
        }
      } catch (streamErr: any) {
        log.warn('Gemini stream threw during iteration, will cascade.', { jobId });
        // fullText stays empty, fallback runs below
      }

      // KEY FIX: Mastra swallows 503 errors and ends the stream silently.
      // If we got no content out of Gemini, cascade to Groq immediately.
      if (!fullText) {
        log.warn('Gemini returned empty response (likely 503). Cascading to Groq...', { jobId });
        
        (agent as any).model = 'groq/llama-3.3-70b-versatile';
        const fallbackOutput = await agent.stream(chatMessage, {
          memory: { thread: threadId, resource: userId }
        });

        for await (const chunk of (fallbackOutput as any).textStream) {
          if (chunk) {
            fullText += chunk;
            await publishChunk(jobId, chunk);
          }
        }
      }

      await (output as any).getFullOutput().catch(() => {});

      // Persist agent response & update thread title
      if (fullText) {
        await saveMessage(threadId, 'assistant', fullText);
      }

      // Set thread title from first user message (trimmed to 60 chars)
      const titleSlug = chatMessage.length > 60 ? chatMessage.slice(0, 60) + '...' : chatMessage;
      await updateThreadTitle(threadId, titleSlug);

      // Signal chat is done
      await publishResult(jobId, {
        type: 'chat_done',
        runId: jobId,
      });

      log.info('Chat job complete', { jobId });
    } catch (err: any) {
      log.error('Chat job failed (including cascade)', { jobId: job?.jobId, error: err.message });

      if (job) {
        const { userId, jobId } = job;
        // Refund credits only if both attempts failed
        await refundCredits(userId, 2, 'Consultant Chat Failure (Full Cascade Exhausted)');

        await publishResult(jobId, {
          type: 'error',
          runId: jobId,
          error: err.message,
        });
      }
    }
  });

  workerSub.on('error', (err) => log.error('Redis subscriber error', { error: err.message }));
}
