import { db } from '../config/db.js';
import { generateUserId } from '../utils/id.js';
import { User } from '../types/spark.types.js';
import { AppError } from '../middleware/errorHandler.js';

export interface CreateUserInput {
  email: string;
  name: string;
  clerkId?: string;
}

/**
 * Create a new user in Turso.
 * This is the ONLY write operation this backend performs on the users table.
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  const { email, name, clerkId } = input;

  // Check if user already exists by email
  const existing = await db.execute({
    sql: 'SELECT * FROM users WHERE email = ? LIMIT 1',
    args: [email],
  });

  if (existing.rows.length > 0) {
    throw new AppError(409, 'User with this email already exists');
  }

  const id = generateUserId();
  const now = new Date().toISOString();

  await db.execute({
    sql: 'INSERT INTO users (id, email, name, clerk_id, available_credits, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    args: [id, email, name, clerkId ?? null, 20, now],
  });

  return { id, email, name, clerk_id: clerkId, available_credits: 20, created_at: now };
}

/** Get a user by their internal ID */
export async function getUserById(id: string): Promise<User | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE id = ? LIMIT 1',
    args: [id],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    clerk_id: row.clerk_id as string | undefined,
    available_credits: row.available_credits as number,
    created_at: row.created_at as string,
  };
}

/** Get a user by their Clerk ID (for auth integration) */
export async function getUserByClerkId(clerkId: string): Promise<User | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE clerk_id = ? LIMIT 1',
    args: [clerkId],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    clerk_id: row.clerk_id as string | undefined,
    available_credits: row.available_credits as number,
    created_at: row.created_at as string,
  };
}

/** Get user by email */
export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE email = ? LIMIT 1',
    args: [email],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    clerk_id: row.clerk_id as string | undefined,
    available_credits: row.available_credits as number,
    created_at: row.created_at as string,
  };
}
