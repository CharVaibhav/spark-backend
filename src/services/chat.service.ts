import { db } from '../config/db.js';
import { CHANNELS } from '../config/redis.js';
import { publishJob } from './redis.service.js';
import { generateThreadId, generateJobId, generateMessageId } from '../utils/id.js';
import { ChatJob } from '../types/redis.types.js';
import { ChatThread, ChatMessage } from '../types/spark.types.js';
import logger from '../utils/logger.js';
import { deductCredits } from './credit.service.js';

/** Persist a single message into chat_messages */
export async function saveMessage(
  threadId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  const messageId = generateMessageId();
  const now = new Date().toISOString();
  await db.execute({
    sql: 'INSERT INTO chat_messages (message_id, thread_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [messageId, threadId, role, content, now],
  });
}

/** Update a thread's title (called after the first user message) */
export async function updateThreadTitle(threadId: string, title: string): Promise<void> {
  await db.execute({
    sql: 'UPDATE chat_threads SET title = ? WHERE thread_id = ?',
    args: [title, threadId],
  });
}

/** Get all messages for a thread ordered chronologically */
export async function getMessagesByThread(threadId: string): Promise<ChatMessage[]> {
  const result = await db.execute({
    sql: 'SELECT * FROM chat_messages WHERE thread_id = ? ORDER BY created_at ASC',
    args: [threadId],
  });
  return result.rows.map((row) => ({
    message_id: row.message_id as string,
    thread_id: row.thread_id as string,
    role: row.role as 'user' | 'assistant',
    content: row.content as string,
    created_at: row.created_at as string,
  }));
}

/** Create a new chat thread in Turso */
export async function createThread(userId: string, runId?: string): Promise<{ threadId: string }> {
  const threadId = generateThreadId();
  const now = new Date().toISOString();

  await db.execute({
    sql: 'INSERT INTO chat_threads (thread_id, user_id, run_id, created_at) VALUES (?, ?, ?, ?)',
    args: [threadId, userId, runId ?? null, now],
  });

  logger.info('Chat thread created', { threadId, userId });
  return { threadId };
}

/** Publish a chat message job to the chat worker */
export async function initiateChat(
  userId: string,
  threadId: string,
  message: string,
  runId?: string
): Promise<string> {
  const COST = 2;
  await deductCredits(userId, COST, 'Consultant Chat');

  const jobId = generateJobId();
  const now = new Date().toISOString();

  // Persist the user's message immediately
  await saveMessage(threadId, 'user', message);

  const job: ChatJob = { jobId, userId, threadId, message, runId, timestamp: now };
  await publishJob(CHANNELS.CHAT_JOB, job);

  logger.info('Chat job published', { jobId, threadId, userId });
  return jobId;
}

/** Get all chat threads for a user */
export async function getThreadsByUser(userId: string): Promise<ChatThread[]> {
  const result = await db.execute({
    sql: 'SELECT * FROM chat_threads WHERE user_id = ? ORDER BY created_at DESC',
    args: [userId],
  });

  return result.rows.map((row) => ({
    thread_id: row.thread_id as string,
    user_id: row.user_id as string,
    run_id: row.run_id as string | undefined,
    title: row.title as string | undefined,
    created_at: row.created_at as string,
  }));
}
