import { db } from '../config/db.js';

async function main() {
  console.log('--- 📊 Spark Database Status ---');

  const runs = await db.execute('SELECT run_id, user_id, status, idea, created_at FROM spark_runs ORDER BY created_at DESC LIMIT 5');

  if (runs.rows.length === 0) {
    console.log('No runs found in database.');
  } else {
    console.table(runs.rows.map(r => ({
      ID: (r.run_id as string).substring(0, 10),
      User: r.user_id,
      Status: r.status,
      Idea: r.idea ? (r.idea as string).substring(0, 30) + '...' : 'No idea',
      Time: r.created_at
    })));
  }

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Data check failed:', err.message);
  process.exit(1);
});
