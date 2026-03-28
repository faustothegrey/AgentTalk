#!/usr/bin/env node
// LLM Agent for NodePTY V1
// Speaks the [NodePTY]: protocol and routes messages to a selected LLM CLI.

import { createInterface } from 'readline';
import { spawn } from 'child_process';

const supportedProviders = new Set(['claude', 'gemini', 'codex']);
const providerArg = (process.argv[2] ?? 'gemini').toLowerCase();
const provider = supportedProviders.has(providerArg) ? providerArg : 'gemini';
const scenarioStateByPeer = new Map();

const DEFAULT_LIMITS = {
  claude: 1000000,
  gemini: 1048576,
  codex: 128000,
};

let currentUsage = 0;
const limit = DEFAULT_LIMITS[provider] || 128000;

// Emit READY
const sessionId = `llm-${Date.now()}`;
console.log(`[NodePTY]:READY:{"session":"${sessionId}"}`);
console.log(`[NodePTY]:EVT:{"type":"usage_updated","total":0,"limit":${limit}}`);
console.error(`[llm-agent] Provider: ${provider}, Token Limit: ${limit}`);

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
    } else if (evt.type === 'healthcheck') {
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
  if (evt.type === 'healthcheck') {
    console.error(`[llm-agent] Healthcheck requested (token: ${evt.token})`);
  } else {
    console.error(`[llm-agent] Message from ${evt.from}: ${evt.payload}`);
  }

  try {
    const reply = await buildReplyForEvent(evt);
    if (!reply) {
      console.error(`[llm-agent] No reply generated for ${evt.from}; skipping`);
      return;
    }

    console.error(`[llm-agent] Reply (${reply.length} chars): ${reply.slice(0, 200)}`);

    const req = buildProtocolRequest(evt, reply);
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
  if (evt.type === 'healthcheck') {
    const prompt = typeof evt.prompt === 'string' && evt.prompt.trim()
      ? evt.prompt
      : 'Reply with a short greeting confirming you are responsive.';
    return callProvider(provider, prompt);
  }

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

function buildProtocolRequest(evt, reply) {
  const reqId = `req-${Date.now()}`;

  if (evt.type === 'healthcheck') {
    return {
      id: reqId,
      call: 'ack_healthcheck',
      args: {
        token: evt.token,
        message: reply,
      },
    };
  }

  return {
    id: reqId,
    call: 'send_to_agent',
    args: { to: evt.from, payload: reply },
  };
}

function getProviderCommand(providerName, userMessage) {
  switch (providerName) {
    case 'claude':
      return {
        command: 'claude',
        args: ['-p', userMessage, '--output-format', 'json'],
      };
    case 'codex':
      return {
        command: 'codex',
        args: ['exec', '--skip-git-repo-check', '--color', 'never', '--full-auto', '--json', userMessage],
      };
    case 'gemini':
    default:
      return {
        command: 'gemini',
        args: ['-p', userMessage, '-o', 'json'],
      };
  }
}

function extractTokens(providerName, stdout) {
  try {
    if (providerName === 'codex') {
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        const json = JSON.parse(line);
        if (json.type === 'turn.completed' && json.usage) {
          return (json.usage.input_tokens || 0) + (json.usage.output_tokens || 0);
        }
      }
    } else {
      const json = JSON.parse(stdout);
      if (providerName === 'claude') {
        return (json.usage?.input_tokens || 0) + (json.usage?.output_tokens || 0);
      } else if (providerName === 'gemini') {
        if (json.stats?.models) {
          let total = 0;
          for (const model of Object.values(json.stats.models)) {
            total += model.tokens?.total || 0;
          }
          return total;
        }
      }
    }
  } catch (e) {
    // console.error(`[llm-agent] Failed to extract tokens from ${providerName} output: ${e.message}`);
  }
  return 0;
}

function extractResponse(providerName, stdout) {
  try {
    if (providerName === 'codex') {
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        const json = JSON.parse(line);
        if (json.type === 'item.completed' && json.item?.text) {
          return json.item.text;
        }
      }
    } else {
      const json = JSON.parse(stdout);
      if (providerName === 'claude') {
        return json.result || '';
      } else if (providerName === 'gemini') {
        return json.response || '';
      }
    }
  } catch (e) {
    // console.error(`[llm-agent] Failed to extract response from ${providerName} output: ${e.message}`);
  }
  return stdout; // Fallback to raw stdout
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

      if (code !== 0 && providerName !== 'claude') { // Claude might return 1 on credit error but we still want to parse usage if possible
        const details = cleanStderr || cleanStdout || `exit code ${code}`;
        reject(new Error(`${providerName} failed: ${details}`));
        return;
      }

      const response = extractResponse(providerName, cleanStdout);
      const tokens = extractTokens(providerName, cleanStdout);
      
      if (tokens > 0) {
        currentUsage += tokens;
        console.log(`[NodePTY]:EVT:{"type":"usage_updated","total":${currentUsage},"limit":${limit}}`);
        console.error(`[llm-agent] Usage: +${tokens} tokens (Total: ${currentUsage}/${limit})`);
      }

      if (code !== 0 && !response) {
        const details = cleanStderr || cleanStdout || `exit code ${code}`;
        reject(new Error(`${providerName} failed: ${details}`));
      } else {
        resolve(response);
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn ${providerName}: ${err.message}`));
    });
  });
}
