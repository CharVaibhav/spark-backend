import { randomUUID } from 'crypto';

/** Generate a prefixed run ID — e.g. run_a1b2c3d4e5f6 */
export function generateRunId(): string {
  return `run_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

/** Generate a prefixed thread ID — e.g. thread_a1b2c3d4e5f6 */
export function generateThreadId(): string {
  return `thread_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

/** Generate a prefixed job ID — e.g. job_a1b2c3d4e5f6 */
export function generateJobId(): string {
  return `job_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

/** Generate a prefixed user ID — e.g. user_a1b2c3d4e5f6 */
export function generateUserId(): string {
  return `user_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

/** Generate a prefixed message ID — e.g. msg_a1b2c3d4e5f6 */
export function generateMessageId(): string {
  return `msg_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}
