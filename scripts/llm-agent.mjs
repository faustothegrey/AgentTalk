#!/usr/bin/env node
// LLM Agent for NodePTY V1
// Speaks the [NodePTY]: protocol and routes messages to a selected LLM CLI.

import { createInterface } from 'readline';
import { spawn } from 'child_process';

const supportedProviders = new Set(['claude', 'gemini', 'codex']);
const providerArg = (process.argv[2] ?? 'gemini').toLowerCase();
const provider = supportedProviders.has(providerArg) ? providerArg : 'gemini';

// Parse --model argument if present
let selectedModel = null;
const modelIdx = process.argv.indexOf('--model');
if (modelIdx !== -1 && process.argv[modelIdx + 1]) {
  selectedModel = process.argv[modelIdx + 1];
}

const scenarioStateByPeer = new Map();

const MODEL_LIMITS = {
  // Claude
  'sonnet': 200000,
  'sonnet-3-5': 200000,
  'opus': 500000,
  'haiku': 200000,
  // Gemini
  '2.0-flash': 1048576,
  '2.0-flash-thinking': 1048576,
  '2.0-pro-exp': 2097152,
  '1.5-pro': 2097152,
  '1.5-flash': 1048576,
  // Codex
  'o3-mini': 200000,
  'o1': 200000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
};

const DEFAULT_PROVIDER_LIMITS = {
  claude: 200000,
  gemini: 1048576,
  codex: 128000,
};

let currentUsage = 0;
const limit = (selectedModel && MODEL_LIMITS[selectedModel]) || DEFAULT_PROVIDER_LIMITS[provider] || 200000;

function emitExternalUsage(output) {
  console.log(`[NodePTY]:EVT:{"type":"external_usage","provider":"${provider}","output":${JSON.stringify(output)}}`);
}

function getSpawnEnv(providerName) {
  if (providerName !== 'claude') {
    return process.env;
  }

  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  return env;
}

function stripAnsi(text) {
  return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => { stdout += chunk; });
    proc.stderr.on('data', (chunk) => { stderr += chunk; });

    proc.on('close', (code) => resolve({ code, stdout, stderr }));
    proc.on('error', (err) => reject(err));
  });
}

function extractClaudeUsageOutput(rawOutput) {
  const cleaned = stripAnsi(rawOutput)
    .replace(/\u0007/g, '')
    .replace(/\r/g, '')
    .replace(/^spawn .*\n/m, '')
    .replace(/^\/exit\s*$/gm, '')
    .trim();

  const usageStart = cleaned.search(/Current session|Current week|% used/i);
  if (usageStart === -1) {
    return '';
  }

  return cleaned.slice(usageStart).trim();
}

async function scrapeClaudeUsageViaSlashCommand() {
  const expectScript = `
set timeout 35
match_max 200000
log_user 1
spawn -noecho env -u ANTHROPIC_API_KEY claude
after 5000
send -- "/usage\\t\\r"
after 15000
send -- "/exit\\r"
expect eof
`;

  const { stdout, stderr } = await runProcess('expect', ['-c', expectScript], {
    env: getSpawnEnv('claude'),
    timeout: 35000,
  });

  return extractClaudeUsageOutput(`${stdout}${stderr}`);
}

// Scrape external usage from the CLI
async function scrapeExternalUsage() {
  try {
    let output = '';
    if (provider === 'claude') {
      output = await scrapeClaudeUsageViaSlashCommand();
    } else if (provider === 'gemini') {
      const proc = spawn('gemini', ['-p', '/stats model'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      proc.stdout.on('data', (d) => { stdout += d; });
      await new Promise(r => proc.on('close', r));
      output = stdout;
    }

    if (output) {
      emitExternalUsage(output);
    }
  } catch (err) {
    console.error(`[llm-agent] Failed to scrape external usage: ${err.message}`);
    emitExternalUsage(`Usage unavailable: ${err.message}`);
  }
}

// Emit READY
const sessionId = `llm-${Date.now()}`;
console.log(`[NodePTY]:READY:{"session":"${sessionId}"}`);
console.log(`[NodePTY]:EVT:{"type":"usage_updated","total":0,"limit":${limit}}`);
emitExternalUsage('Loading usage...');
console.error(`[llm-agent] Provider: ${provider}, Model: ${selectedModel || 'default'}, Token Limit: ${limit}`);

// Initial scrape and periodic refresh
scrapeExternalUsage();
setInterval(scrapeExternalUsage, 300000); // Every 5 minutes

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
        args: ['-p', userMessage, '--model', selectedModel || 'sonnet', '--output-format', 'json'],
      };
    case 'codex': {
      const args = ['exec', '--skip-git-repo-check', '--color', 'never', '--full-auto', '--json'];
      if (selectedModel) {
        args.push('--model', selectedModel);
      }
      args.push(userMessage);
      return {
        command: 'codex',
        args,
      };
    }
    case 'gemini':
    default: {
      const args = ['-p', userMessage, '-o', 'json'];
      if (selectedModel) {
        args.push('--model', selectedModel);
      }
      return {
        command: 'gemini',
        args,
      };
    }
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
      env: getSpawnEnv(providerName),
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
