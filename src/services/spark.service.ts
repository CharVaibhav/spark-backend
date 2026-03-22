import { db } from '../config/db.js';
import { CHANNELS } from '../config/redis.js';
import { publishJob } from './redis.service.js';
import { generateRunId } from '../utils/id.js';
import { AppError } from '../middleware/errorHandler.js';
import { ValidateJob, BlueprintJob } from '../types/redis.types.js';
import { SparkRun } from '../types/spark.types.js';
import logger from '../utils/logger.js';
import { deductCredits } from './credit.service.js';

/** Kick off validation — creates a run record and publishes job to Redis */
export async function initiateValidation(userId: string, idea: string): Promise<string> {
  const COST = 15;
  await deductCredits(userId, COST, 'Idea Validation');

  const runId = generateRunId();
  const now = new Date().toISOString();

  // Create the initial run record in Turso
  await db.execute({
    sql: `INSERT INTO spark_runs (run_id, user_id, idea, status, created_at, updated_at)
          VALUES (?, ?, ?, 'pending', ?, ?)`,
    args: [runId, userId, idea, now, now],
  });

  // Publish the job to the validate worker
  const job: ValidateJob = { runId, userId, idea, timestamp: now };
  await publishJob(CHANNELS.VALIDATE_JOB, job);

  // Update status to researching
  await db.execute({
    sql: `UPDATE spark_runs SET status = 'researching', updated_at = ? WHERE run_id = ?`,
    args: [new Date().toISOString(), runId],
  });

  logger.info('Validation initiated', { runId, userId });
  return runId;
}

/** Kick off blueprint generation — validates state then publishes job to Redis */
export async function initiateBlueprint(runId: string, userId: string): Promise<void> {
  const COST = 25;
  await deductCredits(userId, COST, 'Technical Blueprint');

  // Fetch the run and verify ownership + readiness
  const result = await db.execute({
    sql: 'SELECT * FROM spark_runs WHERE run_id = ? LIMIT 1',
    args: [runId],
  });

  if (result.rows.length === 0) throw new AppError(404, 'Run not found');

  const run = result.rows[0];

  if (run.user_id !== userId) throw new AppError(403, 'Forbidden');
  if (run.status !== 'strategy_ready') {
    throw new AppError(400, `Run is not ready for blueprint generation (status: ${run.status})`);
  }

  const now = new Date().toISOString();
  const strategy = run.strategy_json ? JSON.parse(run.strategy_json as string) : {};

  const job: BlueprintJob = {
    runId,
    userId,
    idea: run.idea as string,
    strategy,
    timestamp: now,
  };

  await publishJob(CHANNELS.BLUEPRINT_JOB, job);

  await db.execute({
    sql: `UPDATE spark_runs SET status = 'generating_blueprint', updated_at = ? WHERE run_id = ?`,
    args: [now, runId],
  });

  logger.info('Blueprint generation initiated', { runId, userId });
}

/** Read a single run — agents do the heavy writing, we just read */
export async function getRun(runId: string): Promise<SparkRun | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM spark_runs WHERE run_id = ? LIMIT 1',
    args: [runId],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    run_id: row.run_id as string,
    user_id: row.user_id as string,
    idea: row.idea as string,
    status: row.status as SparkRun['status'],
    product_name: row.product_name as string | undefined,
    strategy: row.strategy_json ? JSON.parse(row.strategy_json as string) : undefined,
    blueprint: row.blueprint_json ? JSON.parse(row.blueprint_json as string) : undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

/** Get all runs for a user */
export async function getRunsByUser(userId: string, limit = 10): Promise<SparkRun[]> {
  const result = await db.execute({
    sql: 'SELECT * FROM spark_runs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    args: [userId, limit],
  });

  return result.rows.map((row) => ({
    run_id: row.run_id as string,
    user_id: row.user_id as string,
    idea: row.idea as string,
    status: row.status as SparkRun['status'],
    product_name: row.product_name as string | undefined,
    strategy: row.strategy_json ? JSON.parse(row.strategy_json as string) : undefined,
    blueprint: row.blueprint_json ? JSON.parse(row.blueprint_json as string) : undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }));
}

/** Delete a run — verifies ownership before deleting */
export async function deleteRun(runId: string, userId: string): Promise<boolean> {
  const run = await getRun(runId);
  if (!run) return false;
  if (run.user_id !== userId) throw new AppError(403, 'Forbidden');

  await db.execute({
    sql: 'DELETE FROM spark_runs WHERE run_id = ?',
    args: [runId],
  });

  return true;
}
