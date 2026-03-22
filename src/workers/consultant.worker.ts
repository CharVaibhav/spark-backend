import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { CHANNELS } from '../config/redis.js';
import { publishChunk, publishResult } from '../services/redis.service.js';
import { ConsultantJob } from '../types/redis.types.js';
import { createLogger } from '../utils/logger.js';
import { db } from '../config/db.js';
import { refundCredits } from '../services/credit.service.js';
import { CONSULTANT_COST } from '../services/consultant.service.js';

const log = createLogger('consultant.worker');

export async function startConsultantWorker(): Promise<void> {
  const workerSub = new Redis(env.REDIS_URL);

  await workerSub.subscribe(CHANNELS.CONSULTANT_JOB);
  log.info(`Subscribed to channel: ${CHANNELS.CONSULTANT_JOB}`);

  workerSub.on('message', async (_channel: string, message: string) => {
    let job: ConsultantJob | null = null;

    try {
      job = JSON.parse(message) as ConsultantJob;
      const { reviewId, userId, ideaContext } = job;

      log.info('Processing consultant job', { reviewId });

      // IMPORT MASTRA & AGENT
      const { mastra } = await import('../ai/index.js');
      const { ConsultantReviewSchema } = await import('../ai/agents/consultantAgent.js');
      const agent = mastra.getAgent('consultantAgent');

      // Update status to processing
      await db.execute({
        sql: `UPDATE consultant_reviews SET status = 'processing', updated_at = ? WHERE review_id = ?`,
        args: [new Date().toISOString(), reviewId],
      });

      log.info('Running Consultant Agent (Structured Output)', { reviewId });

      // For standalone, we want robust structured JSON (not streaming string output)
      const prompt = `Perform a strategic McKinsey-style teardown on the following idea or business model:\n\n${ideaContext}`;

      const output = await agent.generate(prompt, {
        structuredOutput: { schema: ConsultantReviewSchema }
      });

      const review_json = output.object;

      if (!review_json) {
        throw new Error('Consultant agent failed to generate structured review');
      }

      // Save to database
      await db.execute({
        sql: `UPDATE consultant_reviews SET review_json = ?, status = 'completed', updated_at = ? WHERE review_id = ?`,
        args: [JSON.stringify(review_json), new Date().toISOString(), reviewId],
      });

      await publishResult(reviewId, {
        type: 'consultant_ready',
        runId: reviewId,
        data: review_json,
      });

      log.info('Consultant job complete', { reviewId });

    } catch (err: any) {
      log.error('Consultant job failed', { reviewId: job?.reviewId, error: err.message });

      if (job?.reviewId) {
        // Refund tokens internally
        await refundCredits(job.userId, CONSULTANT_COST, 'Consultant Job Failed').catch(e => {
            log.error('Failed to refund credits', { error: e.message, userId: job?.userId });
        });

        await db.execute({
          sql: `UPDATE consultant_reviews SET status = 'failed', updated_at = ? WHERE review_id = ?`,
          args: [new Date().toISOString(), job.reviewId],
        });

        await publishResult(job.reviewId, {
          type: 'error',
          runId: job.reviewId,
          error: err.message,
        });
      }
    }
  });

  workerSub.on('error', (err) => log.error('Redis subscriber error', { error: err.message }));
}
