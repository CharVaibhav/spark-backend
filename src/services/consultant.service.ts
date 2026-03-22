import { db } from '../config/db.js';
import { CHANNELS } from '../config/redis.js';
import { publishJob } from './redis.service.js';
import { deductCredits } from './credit.service.js';
import logger from '../utils/logger.js';
import { ConsultantJob } from '../types/redis.types.js';

export const CONSULTANT_COST = 20;

export async function initiateConsultantReview(userId: string, ideaContext: string): Promise<string> {
  // Deduct credits before publishing
  await deductCredits(userId, CONSULTANT_COST, 'Consultant Review');

  const reviewId = `review_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const now = new Date().toISOString();

  // Create pending review in Turso
  await db.execute({
    sql: `INSERT INTO consultant_reviews (review_id, user_id, idea_context, status, created_at, updated_at) 
          VALUES (?, ?, ?, 'pending', ?, ?)`,
    args: [reviewId, userId, ideaContext, now, now],
  });

  const job: ConsultantJob = {
    reviewId,
    userId,
    ideaContext,
    timestamp: now
  };

  await publishJob(CHANNELS.CONSULTANT_JOB, job);

  logger.info(`Consultant review initiated`, { reviewId, userId });
  return reviewId;
}

export async function getConsultantReviewsByUser(userId: string) {
  const result = await db.execute({
    sql: `SELECT * FROM consultant_reviews WHERE user_id = ? ORDER BY created_at DESC`,
    args: [userId],
  });
  return result.rows;
}

export async function getConsultantReview(reviewId: string, userId: string) {
  const result = await db.execute({
    sql: `SELECT * FROM consultant_reviews WHERE review_id = ? AND user_id = ? LIMIT 1`,
    args: [reviewId, userId],
  });
  return result.rows[0];
}
