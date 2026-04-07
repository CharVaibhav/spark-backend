import 'dotenv/config';
import { mastra } from './src/ai/index.js';

async function testCascade() {
  const agent = mastra.getAgent('consultantAgent');
  const chatMessage = 'How do I scale my food tech startup Eatoes in Hyderabad?';

  console.log('🏛️  Attempting Primary Model (Gemini 3.1)...');
  
  const output = await agent.stream(chatMessage, {
    memory: { thread: 'test-thread-123', resource: 'user-123' }
  });
    
  console.log('🏛️  Primary (Gemini 3.1) connected. Starting stream...');
  
  let fullText = '';
  try {
    for await (const chunk of (output as any).textStream) {
      process.stdout.write(chunk || '');
      fullText += chunk || '';
    }
  } catch (streamErr: any) {
    console.log('\n⚠️  Stream threw, will cascade...');
  }

  // KEY CHECK: If Gemini gave nothing (silent 503), cascade to Groq
  if (!fullText) {
    console.log('\n🏎️  Gemini was silent! Cascading to Groq (Llama 3.3)...');
    (agent as any).model = 'groq/llama-3.3-70b-versatile';
    const fallbackOutput = await agent.stream(chatMessage, {
      memory: { thread: 'test-thread-123', resource: 'user-123' }
    });

    console.log('✅ Groq Response:\n');
    for await (const chunk of (fallbackOutput as any).textStream) {
      process.stdout.write(chunk || '');
    }
  } else {
    console.log('\n\n--- Gemini responded successfully ---');
  }
}

testCascade();
