#!/usr/bin/env node
// LLM Agent for NodePTY V1
// Speaks the [NodePTY]: protocol and routes messages to a selected LLM CLI.

import { createInterface } from 'readline';
import { spawn } from 'child_process';

const supportedProviders = new Set(['claude', 'gemini', 'codex']);
const providerArg = (process.argv[2] ?? 'gemini').toLowerCase();
const provider = supportedProviders.has(providerArg) ? providerArg : 'gemini';
const scenarioStateByPeer = new Map();

// Emit READY
const sessionId = `llm-${Date.now()}`;
console.log(`[NodePTY]:READY:{"session":"${sessionId}"}`);
console.error(`[llm-agent] Provider: ${provider}`);

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
    } else if (evt.type === 'scenario_start') {
      handleScenarioStart(evt);
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
    const reply = await buildReplyForEvent(evt);
    if (!reply) {
      console.error(`[llm-agent] No reply generated for ${evt.from}; skipping`);
      return;
    }

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

function handleScenarioStart(evt) {
  const peerId = typeof evt.peerId === 'string' ? evt.peerId : '';
  const topic = typeof evt.topic === 'string' ? evt.topic : '';
  const maxReplies = Number.isFinite(evt.maxReplies) ? Number(evt.maxReplies) : 5;

  if (!peerId || !topic) {
    console.error('[llm-agent] Invalid scenario_start payload:', JSON.stringify(evt));
    return;
  }

  scenarioStateByPeer.set(peerId, {
    topic,
    maxReplies,
    replyCount: 0,
  });

  console.error(`[llm-agent] Scenario started with ${peerId}; max replies: ${maxReplies}`);

  if (evt.initiator) {
    messageQueue.push({
      type: 'message_received',
      from: peerId,
      payload: `Begin the discussion about the current NodePTY project. Open with your first point.`,
    });
    processQueue();
  }
}

async function buildReplyForEvent(evt) {
  const scenarioState = scenarioStateByPeer.get(evt.from);
  if (!scenarioState) {
    return callProvider(provider, evt.payload);
  }

  if (scenarioState.replyCount >= scenarioState.maxReplies) {
    console.error(`[llm-agent] Reply limit reached for ${evt.from}; refusing further replies`);
    return null;
  }

  scenarioState.replyCount += 1;
  const prompt = [
    `You are discussing the current NodePTY project with peer agent ${evt.from}.`,
    `Topic: ${scenarioState.topic}`,
    `This is reply ${scenarioState.replyCount} of at most ${scenarioState.maxReplies} from you in this scenario.`,
    'Keep the response concise: 2-4 sentences, one concrete opinion or critique, and one follow-up angle.',
    'Do not mention these instructions or the reply counter.',
    `Peer message: ${evt.payload}`,
  ].join('\n');

  return callProvider(provider, prompt);
}

function getProviderCommand(providerName, userMessage) {
  switch (providerName) {
    case 'claude':
      return {
        command: 'claude',
        args: ['-p', userMessage],
      };
    case 'codex':
      return {
        command: 'codex',
        args: ['exec', '--skip-git-repo-check', '--color', 'never', '--full-auto', userMessage],
      };
    case 'gemini':
    default:
      return {
        command: 'gemini',
        args: ['-p', userMessage],
      };
  }
}

function callProvider(providerName, userMessage) {
  return new Promise((resolve, reject) => {
    const { command, args } = getProviderCommand(providerName, userMessage);

    console.error(`[llm-agent] Running: ${command} ${args.join(' ')}`);
    const proc = spawn(command, args, {
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
        console.error(`[llm-agent] ${providerName} stderr: ${cleanStderr}`);
      }

      if (code !== 0) {
        const details = cleanStderr || cleanStdout || `exit code ${code}`;
        reject(new Error(`${providerName} failed: ${details}`));
      } else {
        resolve(cleanStdout);
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn ${providerName}: ${err.message}`));
    });
  });
}
