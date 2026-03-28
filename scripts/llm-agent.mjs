#!/usr/bin/env node
// LLM Agent for NodePTY V1
// Speaks the [NodePTY]: protocol and routes messages to a persistent Claude CLI session.

import { createInterface } from 'readline';
import { spawn } from 'child_process';

// Emit READY
const sessionId = `llm-${Date.now()}`;
console.log(`[NodePTY]:READY:{"session":"${sessionId}"}`);

// Spawn a persistent Claude process in conversation mode
// First message uses -p, subsequent messages use -p --continue to resume the same conversation
let conversationStarted = false;
let busy = false;
const messageQueue = [];

const rl = createInterface({ input: process.stdin, terminal: false });

rl.on('line', async (line) => {
  line = line.trim();
  if (!line) return;

  if (line.startsWith('[NodePTY]:EVT:')) {
    const json = line.slice('[NodePTY]:EVT:'.length);
    let evt;
    try {
      evt = JSON.parse(json);
    } catch {
      console.error('[llm-agent] Failed to parse EVT:', json);
      return;
    }

    if (evt.type === 'message_received') {
      messageQueue.push(evt);
      processQueue();
    }
  } else if (line.startsWith('[NodePTY]:RES:')) {
    console.error(`[llm-agent] Got RES: ${line}`);
  } else if (line.startsWith('[NodePTY]:')) {
    console.error(`[llm-agent] Unknown protocol: ${line}`);
  }
});

async function processQueue() {
  if (busy || messageQueue.length === 0) return;
  busy = true;

  const evt = messageQueue.shift();
  console.error(`[llm-agent] Message from ${evt.from}: ${evt.payload}`);

  try {
    const reply = await callClaude(evt.payload);
    console.error(`[llm-agent] Reply (${reply.length} chars): ${reply.slice(0, 200)}`);

    const reqId = `req-${Date.now()}`;
    const req = {
      id: reqId,
      call: 'send_to_agent',
      args: { to: evt.from, payload: reply },
    };
    console.log(`[NodePTY]:REQ:${JSON.stringify(req)}`);
  } catch (err) {
    console.error(`[llm-agent] Error: ${err.message}`);
  }

  busy = false;
  processQueue();
}

function callClaude(userMessage) {
  return new Promise((resolve, reject) => {
    const args = ['-p', userMessage];
    if (conversationStarted) {
      args.push('--continue');
    }
    conversationStarted = true;

    console.error(`[llm-agent] Running: claude ${args.join(' ')}`);
    const proc = spawn('claude', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => { stdout += chunk; });
    proc.stderr.on('data', (chunk) => { stderr += chunk; });

    proc.on('close', (code) => {
      if (stderr) console.error(`[llm-agent] claude stderr: ${stderr.trimEnd()}`);
      if (code !== 0) {
        reject(new Error(`claude exited with code ${code}: ${stderr.trimEnd()}`));
      } else {
        resolve(stdout.trim());
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });
  });
}
