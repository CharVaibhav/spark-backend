import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function startProcess(name, scriptPath) {
  const child = spawn('node', [scriptPath], {
    stdio: 'inherit',
    env: { ...process.env },
  });

  child.on('close', (code) => {
    console.log(`[${name}] process exited with code ${code}`);
    if (code !== 0) {
      process.exit(code);
    }
  });

  return child;
}

console.log('🚀 Starting Spark All-in-One Production Server...');

startProcess('API', path.join(__dirname, 'dist', 'server.js'));
startProcess('WORKER', path.join(__dirname, 'dist', 'workers.js'));

process.on('SIGTERM', () => {
  console.log('Shutting down all processes...');
  process.exit(0);
});
