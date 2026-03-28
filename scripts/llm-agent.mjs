#!/usr/bin/env node
// LLM Agent for NodePTY V1
// Speaks the [NodePTY]: protocol and routes messages to a Gemini CLI session.

import { createInterface } from 'readline';
import { spawn } from 'child_process';

// Emit READY
const sessionId = `llm-${Date.now()}`;
console.log(`[NodePTY]:READY:{"session":"${sessionId}"}`);

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
  console.log('[NodePTY]:EVT:{"type":"busy_state","busy":true}');

  const evt = messageQueue.shift();
  console.error(`[llm-agent] Message from ${evt.from}: ${evt.payload}`);

  try {
    const reply = await callGemini(evt.payload);
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
  } finally {
    busy = false;
    console.log('[NodePTY]:EVT:{"type":"busy_state","busy":false}');
  }
  processQueue();
}

function callGemini(userMessage) {
  return new Promise((resolve, reject) => {
    const args = ['-p', userMessage];

    console.error(`[llm-agent] Running: gemini ${args.join(' ')}`);
    const proc = spawn('gemini', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => { stdout += chunk; });
    proc.stderr.on('data', (chunk) => { stderr += chunk; });

    proc.on('close', (code) => {
      const cleanStdout = stdout.trim();
      const cleanStderr = stderr.trim();

      if (cleanStderr) {
        console.error(`[llm-agent] gemini stderr: ${cleanStderr}`);
      }

      if (code !== 0) {
        const details = cleanStderr || cleanStdout || `exit code ${code}`;
        reject(new Error(`gemini failed: ${details}`));
      } else {
        resolve(cleanStdout);
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn gemini: ${err.message}`));
    });
  });
}
