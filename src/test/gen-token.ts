import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { db, initializeDb } from '../config/db.js';
import { generateUserId } from '../utils/id.js';

async function main() {
  await initializeDb(); // Create tables if they don't exist
  const TEST_USER_ID = 'user_test_123';
  const TEST_USER_EMAIL = 'test@example.com';

  console.log('--- 👤 Ensuring Test User Exists ---');

  // Check if test user exists
  const existing = await db.execute({
    sql: 'SELECT id FROM users WHERE id = ? LIMIT 1',
    args: [TEST_USER_ID],
  });

  if (existing.rows.length === 0) {
    console.log('Creating mock user in Turso...');
    await db.execute({
      sql: 'INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)',
      args: [TEST_USER_ID, TEST_USER_EMAIL, 'Test Pilot', new Date().toISOString()],
    });
    console.log('✅ Created mock user');
  } else {
    console.log('✅ Mock user already exists');
  }

  console.log('\n--- 🔑 Generating Token ---');
  
  // Create a JWT that the authMiddleware will accept
  const token = jwt.sign(
    { sub: TEST_USER_ID, email: TEST_USER_EMAIL },
    env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  console.log('\nYOUR AUTH TOKEN (Valid for 24 hours):');
  console.log('--------------------------------------------------');
  console.log(token);
  console.log('--------------------------------------------------');
  console.log('\nUse this as a Bearer token in your curl requests.');
  
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Failed to generate token:', err.message);
  process.exit(1);
});
