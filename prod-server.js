import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function startProcess(name, scriptPath) {
  const process = spawn('node', [scriptPath], {
    stdio: 'inherit',
    env: { ...process.env }
  });

  process.on('close', (code) => {
    console.log(`[${name}] process exited with code ${code}`);
    if (code !== 0) {
      // If one process crashes, we might want to restart it or kill the whole container
      process.exit(code);
    }
  });

  return process;
}

console.log('🚀 Starting Spark All-in-One Production Server...');

// Start the API server
const apiPath = path.join(__dirname, 'dist', 'server.js');
startProcess('API', apiPath);

// Start the AI Worker
const workerPath = path.join(__dirname, 'dist', 'workers.js');
startProcess('WORKER', workerPath);

// Keep the parent process alive
process.on('SIGTERM', () => {
  console.log('Shutting down all processes...');
  process.exit(0);
});
