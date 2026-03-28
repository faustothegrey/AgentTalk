import { WebSocket } from 'ws';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runE2ETest() {
  console.log('🚀 Starting End-to-End Test for NodePTY...');

  let backend: ChildProcess | null = null;
  const port = 3001; // Use a different port for E2E to avoid conflicts

  try {
    // 1. Start the Backend
    console.log('--- Step 1: Starting Backend ---');
    backend = spawn('node', ['dist/index.js'], {
      env: { ...process.env, PORT: port.toString() },
      stdio: 'inherit'
    });

    await wait(2000); // Wait for server to boot

    // 2. Create an Agent via REST API
    console.log('--- Step 2: Creating Agent ---');
    const createRes = await fetch(`http://localhost:${port}/api/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'e2e-agent', splitDirection: 'right' })
    });
    
    if (!createRes.ok) throw new Error(`Failed to create agent: ${await createRes.text()}`);
    const agentData = await createRes.json();
    console.log(`Agent created: ${agentData.id}`);

    // 3. Connect via WebSocket
    console.log('--- Step 3: Connecting via WebSocket ---');
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    
    const outputPromise = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for terminal output')), 10000);
      
      let capturedOutput = '';
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'output') {
          capturedOutput += msg.text;
          console.log(`[WS Output] ${msg.text.trim()}`);
          if (capturedOutput.includes('E2E-TEST-SUCCESS')) {
            clearTimeout(timeout);
            resolve(capturedOutput);
          }
        }
      });
    });

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'attach', agentId: 'e2e-agent' }));
    });

    await wait(1000);

    // 4. Start a command that prints a specific token
    console.log('--- Step 4: Starting Command ---');
    const startRes = await fetch(`http://localhost:${port}/api/agents/e2e-agent/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'echo "E2E-TEST-SUCCESS"' })
    });

    if (!startRes.ok) throw new Error(`Failed to start agent: ${await startRes.text()}`);

    // 5. Verify Output
    console.log('--- Step 5: Verifying Output ---');
    const finalOutput = await outputPromise;
    console.log('✅ Success! Found "E2E-TEST-SUCCESS" in terminal stream.');

    ws.close();
  } catch (err) {
    console.error('❌ E2E Test Failed:', err);
    process.exit(1);
  } finally {
    if (backend) {
      console.log('--- Cleaning up ---');
      backend.kill('SIGINT');
    }
  }
}

runE2ETest();
