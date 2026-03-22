import { initializeDb } from './src/config/db.js';

async function main() {
  await initializeDb();
}

main().catch(console.error);
