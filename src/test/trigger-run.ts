import { env } from '../config/env.js';

// Configuration
const PORT = process.env.PORT || 3001;
const API_URL = `http://localhost:${PORT}/api/spark/validate`;
const SSE_BASE_URL = `http://localhost:${PORT}/api/spark/events`;

const TOKEN = process.argv[2]; // Pass token as first argument

if (!TOKEN) {
  console.error('❌  Error: No token provided!');
  console.log('Run `npx tsx src/test/gen-token.ts` first, then pass the token:');
  console.log('npx tsx src/test/trigger-run.ts <YOUR_TOKEN>');
  process.exit(1);
}

const IDEA = "An AI-powered local-first personal knowledge base that automatically links related notes using semantic search and local LLMs.";

async function runTest() {
  console.log('--- 🚀 Triggering AI Validation ---');
  console.log(`Idea: "${IDEA}"`);

  try {
    const postRes = await fetch(API_URL, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ idea: IDEA })
    });

    if (!postRes.ok) {
      const errorData = await postRes.json() as any;
      throw new Error(errorData.error || `HTTP error! status: ${postRes.status}`);
    }

    const { data } = await postRes.json() as any;
    const { runId } = data;
    
    console.log(`✅  Run Created! ID: ${runId}`);
    console.log('\n--- 🌊 Listening for Live Stream (SSE) ---');
    console.log('Watching the AI think in real-time...\n');

    const sseResponse = await fetch(`${SSE_BASE_URL}/${runId}`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });

    if (!sseResponse.body) {
      throw new Error('No body in SSE response');
    }

    const reader = sseResponse.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunkStr = decoder.decode(value);
      const lines = chunkStr.split('\n');

      for (const line of lines) {
        if (line.startsWith('event:')) {
          const event = line.replace('event: ', '').trim();
          if (event === 'error') {
            process.stdout.write(`\n❌  ERROR EVENT DETECTED:\n`);
          } else if (event === 'connected') {
            console.log('✅  Connection persistent');
          } else {
            console.log(`\n[EVENT: ${event}]`);
          }
        } else if (line.startsWith('data:')) {
          const payloadStr = line.replace('data: ', '').trim();
          try {
            const payload = JSON.parse(payloadStr);
            
            if (payload.chunk) {
              process.stdout.write(payload.chunk);
            } else if (payload.error) {
              console.error(`\n❌  AI ERROR: ${payload.error}`);
              process.exit(1);
            } else if (payload.strategy) {
               console.log('\n\n✅ MVP STRATEGY READY:');
               console.log(JSON.stringify(payload.strategy, null, 2));
               process.exit(0);
            }
          } catch {
            // Partial JSON or heartbeat
          }
        }
      }
    }

    console.log('\n--- 🏁 Stream Closed ---');
    process.exit(0);

  } catch (err: any) {
    console.error('\n❌  Error:', err.message);
    process.exit(1);
  }
}

runTest();
