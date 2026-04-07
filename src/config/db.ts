import { createClient } from '@libsql/client';
import { env } from './env.js';

export const db = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});

// Run on startup to verify connection is healthy and tables are present
export async function initializeDb(): Promise<void> {
  const log = (msg: string) => console.log(`[DB] ${msg}`);

  try {
    await db.execute('SELECT 1');
    log('✅ Turso connection verified');

    // Ensure users have a credit balance natively
    try {
      await db.execute('ALTER TABLE users ADD COLUMN available_credits INTEGER DEFAULT 20');
      log('➕ Added available_credits column to users');
    } catch {
      // Column exists, safe to ignore
    }

    // ENSURE TABLES (Simplified schema mirroring service requirements)
    await db.batch([
      // 1. Users table (in case it is newly created)
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        clerk_id TEXT,
        available_credits INTEGER DEFAULT 20,
        created_at TEXT NOT NULL
      )`,

      // 2. Spark Runs table
      `CREATE TABLE IF NOT EXISTS spark_runs (
        run_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        idea TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        product_name TEXT,
        strategy_json TEXT,
        blueprint_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,

      // 3. Chat Threads & Messages 
      `CREATE TABLE IF NOT EXISTS chat_threads (
        thread_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        run_id TEXT,
        title TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS chat_messages (
        message_id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,

      // 4. Consultant Reviews (Standalone Single Service API)
      `CREATE TABLE IF NOT EXISTS consultant_reviews (
        review_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        idea_context TEXT NOT NULL,
        review_json TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`
    ]);

    log('✅ Database tables initialized');
  } catch (err: any) {
    console.error('❌ Failed to initialize database:', err.message);
    throw err;
  }
}

/** @deprecated Use initializeDb() instead */
export async function checkDbConnection(): Promise<void> {
  await initializeDb();
}
