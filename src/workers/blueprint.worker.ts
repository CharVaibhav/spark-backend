import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { CHANNELS } from '../config/redis.js';
import { publishChunk, publishResult } from '../services/redis.service.js';
import { BlueprintJob } from '../types/redis.types.js';
import { createLogger } from '../utils/logger.js';
import { db } from '../config/db.js';
import { refundCredits } from '../services/credit.service.js';

const log = createLogger('blueprint.worker');

export async function startBlueprintWorker(): Promise<void> {
  const workerSub = new Redis(env.REDIS_URL);

  await workerSub.subscribe(CHANNELS.BLUEPRINT_JOB);
  log.info(`Subscribed to channel: ${CHANNELS.BLUEPRINT_JOB}`);

  workerSub.on('message', async (_channel: string, message: string) => {
    let job: BlueprintJob | null = null;

    try {
      job = JSON.parse(message) as BlueprintJob;
      const { runId, userId, idea, strategy } = job;

      log.info('Processing blueprint job', { runId });

      // IMPORT MASTRA & SCHEMA
      const { mastra } = await import('../ai/index.js');
      const { ArchitectureSchema } = await import('../ai/agents/arcagent.js');
      const agent = mastra.getAgent('archAgent');

      log.info('Running Architect Agent (Streaming)', { runId });

      const prompt = `Context:
      Idea: ${idea}
      MVP Strategy: ${JSON.stringify(strategy, null, 2)}
      
      Generate a ruthless technical blueprint for this product. Determine if it is SOFTWARE, HARDWARE, or HYBRID.`;

      const output = await agent.stream(prompt, { 
        structuredOutput: { schema: ArchitectureSchema } 
      });

      // Stream the chunks back via Redis so the UI can show progress
      for await (const chunk of output.textStream) {
        if (chunk) {
          await publishChunk(runId, chunk);
        }
      }

      const result = await output.getFullOutput();
      const blueprint = result.object;

      if (!blueprint) {
        throw new Error('Architect agent failed to generate a technical blueprint');
      }


      // Save blueprint to DB
      await db.execute({
        sql: `UPDATE spark_runs SET blueprint_json = ?, status = 'blueprint_ready', updated_at = ? WHERE run_id = ?`,
        args: [JSON.stringify(blueprint), new Date().toISOString(), runId],
      });

      // Publish final result
      await publishResult(runId, {
        type: 'blueprint_ready',
        runId,
        data: { blueprint },
      });

      log.info('Blueprint job complete', { runId });
    } catch (err: any) {
      log.error('Blueprint job failed', { runId: job?.runId, error: err.message });

      if (job) {
        const { userId, runId } = job;
        // Refund 25 credits for blueprint failure
        await refundCredits(userId, 25, 'Technical Blueprint Failure').catch(e => {
          log.error('Failed to refund blueprint credits', { error: e.message, userId });
        });

        await db.execute({
          sql: `UPDATE spark_runs SET status = 'failed', updated_at = ? WHERE run_id = ?`,
          args: [new Date().toISOString(), runId],
        });

        await publishResult(runId, {
          type: 'error',
          runId: runId,
          error: err.message,
        });
      }
    }
  });

  workerSub.on('error', (err) => log.error('Redis subscriber error', { error: err.message }));
}
