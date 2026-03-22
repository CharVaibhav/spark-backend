import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { CHANNELS } from '../config/redis.js';
import { publishChunk, publishResult } from '../services/redis.service.js';
import { ValidateJob } from '../types/redis.types.js';
import { createLogger } from '../utils/logger.js';
import { db } from '../config/db.js';

const log = createLogger('validate.worker');

export async function startValidateWorker(): Promise<void> {
  const workerSub = new Redis(env.REDIS_URL);

  await workerSub.subscribe(CHANNELS.VALIDATE_JOB);
  log.info(`Subscribed to channel: ${CHANNELS.VALIDATE_JOB}`);

  workerSub.on('message', async (_channel: string, message: string) => {
    let job: ValidateJob | null = null;

    try {
      job = JSON.parse(message) as ValidateJob;
      const { runId, idea } = job;

      log.info('Processing validate job', { runId, idea: idea.substring(0, 60) });

      // 1. CAPTURE WORKFLOW LOGS (Interception)
      // To match test.ts, we temporarily capture console logs to send them as Redis chunks
      const originalLog = console.log;
      console.log = (...args: any[]) => {
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        
        // Safely publish chunks so it doesn't crash the worker if Redis connection bounces
        publishChunk(runId, msg + '\n').catch(() => {});
        
        originalLog.apply(console, args);
      };

      try {
        // IMPORT MASTRA
        const { mastra } = await import('../ai/index.js');
        const workflow = mastra.getWorkflow('validationWorkflow');

        // Update status to researching
        await db.execute({
          sql: `UPDATE spark_runs SET status = 'researching', updated_at = ? WHERE run_id = ?`,
          args: [new Date().toISOString(), runId],
        });

        // Run the workflow (confirmBuild set to true to show full chain)
        const workflowRun = await workflow.createRun();
        const output = await workflowRun.start({ 
          inputData: { idea, confirmBuild: true } 
        });

        if (output.status === 'failed') {
          throw new Error(output.error?.message || 'Workflow failed');
        }

        const finalResult = (output as any).result;
        const strategy = finalResult?.strategy;
        const researchDump = (output as any).steps?.['research-step']?.output?.researchDump;

        // 2. SEND FORMATTED OUTPUT (Like test.ts)
        await publishChunk(runId, '\n\n--- DEBUG: Full Workflow Output ---\n');
        await publishChunk(runId, JSON.stringify(output, null, 2) + '\n');
        await publishChunk(runId, '----------------------------------\n\n');

        if (researchDump) {
          await publishChunk(runId, '==================================\n');
          await publishChunk(runId, '🔬 RESEARCH & VISIONARY AUDIT\n');
          await publishChunk(runId, '==================================\n\n');
          await publishChunk(runId, `${researchDump}\n\n`);
        }

        if (strategy) {
          await publishChunk(runId, '==================================\n');
          await publishChunk(runId, '🎯 MVP STRATEGY (PRODUCT MANAGER)\n');
          await publishChunk(runId, '==================================\n\n');
          await publishChunk(runId, `📦 Product:        ${strategy.productName}\n`);
          await publishChunk(runId, `👤 Target User:    ${strategy.targetUser}\n`);
          await publishChunk(runId, `🎯 Market Gap:     ${strategy.marketGap}\n`);
          await publishChunk(runId, `\n✅ Core Features (V1):\n`);
          strategy.coreFeatures.forEach((f: string, i: number) => publishChunk(runId, `   ${i + 1}. ${f}\n`));
          await publishChunk(runId, `\n🚫 NOT Doing in V1:\n`);
          strategy.notDoing.forEach((f: string, i: number) => publishChunk(runId, `   ${i + 1}. ${f}\n`));
          await publishChunk(runId, `\n📊 Success Metric: ${strategy.successMetric}\n`);
          await publishChunk(runId, `⚠️  Risk Factor:    ${strategy.riskFactor}\n\n`);
        }

        if (finalResult?.blueprint) {
          const b = finalResult.blueprint;
          await publishChunk(runId, '==================================\n');
          await publishChunk(runId, '🏗️  TECHNICAL BLUEPRINT (ARCHITECT)\n');
          await publishChunk(runId, '==================================\n\n');
          await publishChunk(runId, `🏷️  Product Type:  ${b.productType}\n`);
          
          if (b.softwareArchitecture) {
            await publishChunk(runId, `\n🌐 SOFTWARE SPECS:\n`);
            await publishChunk(runId, `   - Stack:    ${b.softwareArchitecture.stack}\n`);
            await publishChunk(runId, `   - Cloud:    ${b.softwareArchitecture.cloudInfrastructure}\n`);
            await publishChunk(runId, `   - Strategy: ${b.softwareArchitecture.apiStrategy}\n`);
          }

          if (b.hardwareArchitecture) {
            await publishChunk(runId, `\n🔋 HARDWARE SPECS:\n`);
            await publishChunk(runId, `   - Brain:    ${b.hardwareArchitecture.coreMicrocontroller}\n`);
            await publishChunk(runId, `   - BOM:      ${b.hardwareArchitecture.billOfMaterials.join(', ')}\n`);
          }

          await publishChunk(runId, `\n📊 SYSTEM DIAGRAM (Mermaid):\n${b.systemDiagram}\n`);
          await publishChunk(runId, `\n📅 PHASE ONE BLUEPRINT (7-Day Plan):\n`);
          b.phaseOneBlueprint.forEach((step: string, i: number) => publishChunk(runId, `   ${i + 1}. ${step}\n`));
        }

        // Save strategy to DB
        await db.execute({
          sql: `UPDATE spark_runs SET strategy_json = ?, blueprint_json = ?, product_name = ?, status = 'strategy_ready', updated_at = ? WHERE run_id = ?`,
          args: [
            JSON.stringify(strategy), 
            JSON.stringify(finalResult?.blueprint || null),
            strategy?.productName || 'Untitled', 
            new Date().toISOString(), 
            runId
          ],
        });

        // Final result signal
        await publishResult(runId, {
          type: 'strategy_ready',
          runId,
          data: { strategy, blueprint: finalResult?.blueprint },
        });

        log.info('Validate job complete', { runId });

      } finally {
        // ALWAYS restore the original console.log
        console.log = originalLog;
      }

    } catch (err: any) {
      const runId = job?.runId ?? 'unknown';
      log.error('Validate job failed', { runId, error: err.message });

      if (job?.runId) {
        await db.execute({
          sql: `UPDATE spark_runs SET status = 'failed', updated_at = ? WHERE run_id = ?`,
          args: [new Date().toISOString(), job.runId],
        });

        await publishResult(job.runId, {
          type: 'error',
          runId: job.runId,
          error: err.message,
        });
      }
    }
  });

  workerSub.on('error', (err) => log.error('Redis subscriber error', { error: err.message }));
}
