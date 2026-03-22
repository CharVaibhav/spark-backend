import { db } from '../config/db.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

/**
 * Deduct credits from user. Throws AppError(402) if insufficient balance.
 */
export async function deductCredits(userId: string, amount: number, purpose: string): Promise<number> {
  const result = await db.execute({
    sql: 'SELECT available_credits FROM users WHERE id = ? LIMIT 1',
    args: [userId],
  });

  if (result.rows.length === 0) {
    throw new AppError(404, 'User not found');
  }

  const currentCredits = result.rows[0].available_credits as number;
  if (currentCredits < amount) {
    throw new AppError(402, `Payment Required: You need ${amount} credits, but only have ${currentCredits}.`);
  }

  // Deduct
  await db.execute({
    sql: 'UPDATE users SET available_credits = available_credits - ? WHERE id = ?',
    args: [amount, userId],
  });

  logger.info(`Deducted ${amount} credits from ${userId} for ${purpose}. Remaining: ${currentCredits - amount}`);
  return currentCredits - amount;
}

/**
 * Refund credits (used if an AI worker fails after deduction)
 */
export async function refundCredits(userId: string, amount: number, purpose: string): Promise<void> {
  await db.execute({
    sql: 'UPDATE users SET available_credits = available_credits + ? WHERE id = ?',
    args: [amount, userId],
  });
  logger.info(`Refunded ${amount} credits to ${userId} for ${purpose}.`);
}

/** Check remaining credits */
export async function getCredits(userId: string): Promise<number> {
  const result = await db.execute({
    sql: 'SELECT available_credits FROM users WHERE id = ? LIMIT 1',
    args: [userId],
  });
  return (result.rows[0]?.available_credits as number) || 0;
}
