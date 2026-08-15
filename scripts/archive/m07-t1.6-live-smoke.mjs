import { Registry } from '../packages/runtime-core/dist/registry/registry.js';
import fs from 'fs';
import path from 'path';

async function run() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('Skipping live smoke test: GEMINI_API_KEY is not set');
    process.exit(0);
  }

  const registry = new Registry({ readinessTimeoutMs: 5000 });
  const agent = await registry.createAgent('api-agent', {
    provider: 'api',
    providerName: 'google',
    model: 'gemini-2.5-flash'
  });
  
  const originalHandle = registry.handleMcpToolCall.bind(registry);
  let capturedCall = null;
  registry.handleMcpToolCall = async (agentId, name, args) => {
    console.log(`\n[intercept] agent=${agentId} called ${name} with args=`, args);
    capturedCall = { name, args };
    return {};
  };

  await registry.activateAgent('api-agent');

  console.log('Sending planning turn...');
  agent.queueTurn({
    type: 'conversation_start',
    mode: 'planning',
    peerIds: ['peer-b'],
    topic: 'We need to write a simple node server. Discuss.',
    initiator: true
  });

  console.log('Waiting for model to respond...');
  for (let i = 0; i < 100 && !capturedCall; i++) {
    await new Promise(r => setTimeout(r, 200));
  }

  await registry.destroy();

  if (capturedCall) {
    console.log('\nTEST PASSED: Model responded with', capturedCall.name);
    const logPath = path.join(process.cwd(), 'm07-smoke-transcript-1.6.log');
    fs.writeFileSync(logPath, JSON.stringify(capturedCall, null, 2));
    console.log(`Wrote transcript to ${logPath}`);
    process.exit(0);
  } else {
    console.error('\nTEST FAILED: No response captured');
    process.exit(1);
  }
}

run().catch(console.error);
