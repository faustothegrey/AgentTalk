#!/usr/bin/env node
import { createHash } from 'crypto';
import { execFile } from 'child_process';
import { createServer } from 'net';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const clientRoot = path.resolve(repoRoot, '../agentalk-mcp-client');
const bridgePath = path.join(clientRoot, 'bridge.mjs');
const contractPath = path.join(repoRoot, 'packages/contracts/wire-contract.json');
const wireContract = JSON.parse(readFileSync(contractPath, 'utf8'));
const allBridgeTools = wireContract.data.mcpTools.map((name) => `mcp__agenttalk-bridge__${name}`);
const defaultAllowedTools = [
  'mcp__agenttalk-bridge__await_turn',
  'mcp__agenttalk-bridge__send_to_agent',
  ...allBridgeTools.filter((name) => ![
    'mcp__agenttalk-bridge__await_turn',
    'mcp__agenttalk-bridge__send_to_agent',
  ].includes(name)),
];

const configAuditPaths = [
  path.join(os.homedir(), '.codex/config.toml'),
  path.join(os.homedir(), '.codex/mcp.json'),
  path.join(os.homedir(), '.claude/settings.json'),
  path.join(os.homedir(), '.config/claude/settings.json'),
];

const stateAuditPaths = [
  path.join(os.homedir(), '.claude.json'),
];

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      args._.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    if (args[key] === undefined) {
      args[key] = next;
    } else if (Array.isArray(args[key])) {
      args[key].push(next);
    } else {
      args[key] = [args[key], next];
    }
    i += 1;
  }
  return args;
}

function asArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function agentSpecs(args) {
  const specs = asArray(args.agent);
  if (specs.length > 0) {
    return specs.map((spec) => {
      const [cli, id] = String(spec).split(':');
      if (!cli || !id || !['codex', 'claude'].includes(cli)) {
        throw new Error(`Invalid --agent ${spec}; expected codex:<id> or claude:<id>`);
      }
      return { cli, id };
    });
  }
  return [
    { cli: 'codex', id: 'm19-t2-codex' },
    { cli: 'claude', id: 'm19-t2-claude' },
  ];
}

function mcpUrl(port, agentId, contractHash = wireContract.hash) {
  return `ws://localhost:${port}/mcp?agentId=${encodeURIComponent(agentId)}&contractHash=${contractHash}`;
}

function claudeMcpConfig(url) {
  return JSON.stringify({
    mcpServers: {
      'agenttalk-bridge': {
        command: 'node',
        args: [bridgePath, url],
      },
    },
  });
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function codexArgs(url, prompt) {
  return [
    'exec',
    '--skip-git-repo-check',
    '--color', 'never',
    '--json',
    '--dangerously-bypass-approvals-and-sandbox',
    '-c', 'mcp_servers.agenttalk-bridge.command="node"',
    '-c', `mcp_servers.agenttalk-bridge.args=["${bridgePath}","${url}"]`,
    '-c', 'mcp_servers.agenttalk-bridge.tool_timeout_sec=600',
    prompt,
  ];
}

function claudeArgs(url, prompt, evidenceDir) {
  const debugFile = path.join(evidenceDir, 'm19-t2-claude-debug.log');
  return [
    '--strict-mcp-config',
    '--mcp-config', claudeMcpConfig(url),
    '--allowedTools', defaultAllowedTools.join(','),
    '--permission-mode', 'auto',
    '--debug-file', debugFile,
    '--no-session-persistence',
    '-p', prompt,
  ];
}

function promptFor(cli) {
  return [
    'Use the agenttalk-bridge MCP server.',
    'Your only first action is to call await_turn from that MCP server.',
    'Do not answer in prose before calling the MCP tool.',
    `This is the M19-T2 ${cli} attach proof.`,
  ].join(' ');
}

function formatCommand(command, args) {
  return [command, ...args].map(shellQuote).join(' ');
}

function printRunbook(args) {
  const httpPort = Number(args['http-port'] ?? 3310);
  const mcpPort = Number(args['mcp-port'] ?? 3311);
  const agents = agentSpecs(args);
  console.log(`# M19-T2 real-CLI attach runbook`);
  console.log(`Contract: v${wireContract.version} ${wireContract.hash}`);
  console.log(`Start orchestrator with fresh ports:`);
  console.log(`PORT=${httpPort} AGENTTALK_MCP_PORT=${mcpPort} npm run start --workspace @agenttalk/orchestrator`);
  console.log('');
  console.log(`Register and start agents:`);
  for (const agent of agents) {
    console.log(`curl -s -X POST http://localhost:${httpPort}/api/agents -H 'Content-Type: application/json' -d '${JSON.stringify({ id: agent.id, provider: 'mcp', requestedExecutionMode: 'auto' })}'`);
    console.log(`curl -s -X POST http://localhost:${httpPort}/api/agents/${agent.id}/start -H 'Content-Type: application/json' -d '${JSON.stringify({ provider: 'mcp', executionMode: 'auto' })}'`);
  }
  console.log('');
  console.log(`Per-command CLI config; no global CLI config edits:`);
  for (const agent of agents) {
    const url = mcpUrl(mcpPort, agent.id);
    if (agent.cli === 'codex') {
      console.log(`\n# Codex (${agent.id})`);
      console.log(formatCommand('codex', codexArgs(url, promptFor('codex'))));
    } else {
      console.log(`\n# Claude Code (${agent.id})`);
      console.log(formatCommand('claude', claudeArgs(url, promptFor('claude'), 'design/evidence')));
    }
  }
  console.log('');
  console.log(`Failure-mode checks:`);
  console.log(`- missing start: GET /api/agents must show the agent out of creating/starting after POST /start.`);
  console.log(`- stale port: bridge/CLI stderr shows WebSocket connection failure before initialize.`);
  console.log(`- stale hash: MCP server rejects initialize with close code 1008.`);
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${url}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function getJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(`${res.status} ${url}: ${text}`);
  }
  return data;
}

async function prepareAgents(args) {
  const httpUrl = String(args['http-url'] ?? `http://localhost:${args['http-port'] ?? 3310}`);
  const mcpPort = Number(args['mcp-port'] ?? 3311);
  const agents = agentSpecs(args);
  const started = [];
  for (const agent of agents) {
    const created = await postJson(`${httpUrl}/api/agents`, {
      id: agent.id,
      provider: 'mcp',
      requestedExecutionMode: 'auto',
    });
    await postJson(`${httpUrl}/api/agents/${agent.id}/start`, {
      provider: 'mcp',
      executionMode: 'auto',
    });
    started.push({ ...agent, created });
  }
  const currentAgents = await getJson(`${httpUrl}/api/agents`);
  for (const agent of started) {
    const current = currentAgents.find((candidate) => candidate.id === agent.id);
    if (!current || current.status === 'creating') {
      throw new Error(`Agent ${agent.id} did not leave creating after start`);
    }
  }
  printRunbook({ ...args, 'mcp-port': mcpPort, agent: agents.map((agent) => `${agent.cli}:${agent.id}`) });
}

function readConfigSnapshot() {
  return readConfigSnapshotFor(configAuditPaths);
}

function readConfigSnapshotFor(paths) {
  const snapshot = {};
  for (const file of paths) {
    if (!existsSync(file)) {
      snapshot[file] = { exists: false };
      continue;
    }
    const contents = readFileSync(file);
    snapshot[file] = {
      exists: true,
      size: contents.length,
      mtimeMs: statSync(file).mtimeMs,
      sha256: createHash('sha256').update(contents).digest('hex'),
    };
  }
  return snapshot;
}

function compareConfigSnapshots(before, after) {
  const changes = [];
  for (const file of Object.keys(before)) {
    const left = before[file];
    const right = after[file];
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      changes.push({ file, before: left, after: right });
    }
  }
  return changes;
}

function launch(command, args, options = {}) {
  const child = execFile(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? process.env,
    maxBuffer: 1024 * 1024 * 20,
  }, () => {});
  if (!options.keepStdinOpen) {
    child.stdin?.end();
  }
  child.stdout?.on('data', (chunk) => options.onStdout?.(chunk.toString()));
  child.stderr?.on('data', (chunk) => options.onStderr?.(chunk.toString()));
  return child;
}

function stopProcess(child, signal = 'SIGTERM') {
  if (!child || child.killed) return;
  child.kill(signal);
}

async function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const child = execFile(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: options.env ?? process.env,
      maxBuffer: 1024 * 1024 * 20,
    }, (error) => {
      resolve({
        code: error?.code ?? 0,
        signal: error?.signal ?? null,
        stdout,
        stderr,
      });
    });
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
  });
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close(() => resolve(port));
    });
  });
}

async function waitFor(predicate, timeoutMs, label) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function startProofServer({ httpPort, mcpPort, evidenceDir }) {
  const recordingPath = path.join(evidenceDir, 'm19-t2-recording.ndjson');
  const serverLogPath = path.join(evidenceDir, 'm19-t2-server.log');
  let serverLog = '';
  const child = launch('node', ['apps/orchestrator/dist/index.js'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(httpPort),
      AGENTTALK_MCP_PORT: String(mcpPort),
      AGENTTALK_RECORDING_PATH: recordingPath,
    },
    onStdout: (chunk) => {
      serverLog += chunk;
      writeFileSync(serverLogPath, serverLog, 'utf8');
    },
    onStderr: (chunk) => {
      serverLog += chunk;
      writeFileSync(serverLogPath, serverLog, 'utf8');
    },
  });
  await waitFor(
    () => serverLog.includes(`AgentTalk Web UI Backend listening on http://localhost:${httpPort}`) &&
      serverLog.includes(`AgentTalk WebSocket MCP server listening on ws://localhost:${mcpPort}/`),
    15000,
    'orchestrator HTTP and MCP ports',
  );
  return {
    child,
    recordingPath,
    serverLogPath,
    getLog: () => serverLog,
  };
}

async function proveCli(args) {
  const cli = String(args.cli ?? '');
  if (!['codex', 'claude'].includes(cli)) {
    throw new Error('--cli must be codex or claude');
  }
  const evidenceDir = path.resolve(args['evidence-dir'] ?? path.join(repoRoot, 'design/evidence', `m19-t2-${cli}-${new Date().toISOString().replace(/[:.]/g, '-')}`));
  mkdirSync(evidenceDir, { recursive: true });
  if (!args['skip-build']) {
    const build = await runCommand('npm', ['run', 'build', '--workspace', '@agenttalk/orchestrator']);
    writeFileSync(path.join(evidenceDir, 'build.log'), build.stdout + build.stderr, 'utf8');
    if (build.code !== 0) {
      throw new Error(`orchestrator build failed; see ${path.join(evidenceDir, 'build.log')}`);
    }
  }

  const httpPort = Number(args['http-port'] ?? await freePort());
  const mcpPort = Number(args['mcp-port'] ?? await freePort());
  const agentId = String(args['agent-id'] ?? `m19-t2-${cli}-${Date.now()}`);
  const timeoutMs = Number(args['timeout-ms'] ?? 45000);
  const proof = {
    cli,
    agentId,
    httpPort,
    mcpPort,
    contractVersion: wireContract.version,
    contractHash: wireContract.hash,
    evidenceDir,
    startedAt: new Date().toISOString(),
  };
  const beforeConfig = readConfigSnapshot();
  const beforeState = readConfigSnapshotFor(stateAuditPaths);
  let server;
  let cliChild;
  try {
    server = await startProofServer({ httpPort, mcpPort, evidenceDir });
    await postJson(`http://localhost:${httpPort}/api/agents`, {
      id: agentId,
      provider: 'mcp',
      requestedExecutionMode: 'auto',
    });
    await postJson(`http://localhost:${httpPort}/api/agents/${agentId}/start`, {
      provider: 'mcp',
      executionMode: 'auto',
    });
    const agents = await getJson(`http://localhost:${httpPort}/api/agents`);
    const current = agents.find((agent) => agent.id === agentId);
    proof.agentAfterStart = current;
    if (!current || current.status === 'creating') {
      throw new Error(`Agent ${agentId} did not leave creating after start`);
    }

    const url = mcpUrl(mcpPort, agentId);
    const command = cli === 'codex' ? 'codex' : 'claude';
    const cliArgs = cli === 'codex'
      ? codexArgs(url, promptFor(cli))
      : claudeArgs(url, promptFor(cli), evidenceDir);
    proof.command = formatCommand(command, cliArgs);
    let cliStdout = '';
    let cliStderr = '';
    cliChild = launch(command, cliArgs, {
      cwd: repoRoot,
      onStdout: (chunk) => {
        cliStdout += chunk;
        writeFileSync(path.join(evidenceDir, `${cli}-stdout.log`), cliStdout, 'utf8');
      },
      onStderr: (chunk) => {
        cliStderr += chunk;
        writeFileSync(path.join(evidenceDir, `${cli}-stderr.log`), cliStderr, 'utf8');
      },
    });

    const awaited = await waitFor(
      () => server.getLog().includes(`MCP tool call from ${agentId}: await_turn`),
      timeoutMs,
      `${cli} await_turn call`,
    );
    proof.awaitTurnObserved = Boolean(awaited);
    proof.blockedOnAwaitTurn = cliChild.exitCode === null;
    proof.finishedAt = new Date().toISOString();
    proof.result = proof.blockedOnAwaitTurn ? 'await_turn_blocked' : 'await_turn_returned_or_process_exited';
    stopProcess(cliChild);
  } finally {
    stopProcess(cliChild);
    stopProcess(server?.child);
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const afterConfig = readConfigSnapshot();
  const afterState = readConfigSnapshotFor(stateAuditPaths);
  proof.globalConfigChanges = compareConfigSnapshots(beforeConfig, afterConfig);
  proof.globalStateChanges = compareConfigSnapshots(beforeState, afterState);
  proof.noGlobalConfigMutation = proof.globalConfigChanges.length === 0;
  writeFileSync(path.join(evidenceDir, 'proof.json'), JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
  if (!proof.awaitTurnObserved || !proof.blockedOnAwaitTurn || !proof.noGlobalConfigMutation) {
    process.exitCode = 1;
  }
}

async function probeFailureModes(args) {
  const evidenceDir = path.resolve(args['evidence-dir'] ?? path.join(repoRoot, 'design/evidence', `m19-t2-failures-${new Date().toISOString().replace(/[:.]/g, '-')}`));
  mkdirSync(evidenceDir, { recursive: true });
  if (!args['skip-build']) {
    const build = await runCommand('npm', ['run', 'build', '--workspace', '@agenttalk/orchestrator']);
    writeFileSync(path.join(evidenceDir, 'build.log'), build.stdout + build.stderr, 'utf8');
    if (build.code !== 0) {
      throw new Error(`orchestrator build failed; see ${path.join(evidenceDir, 'build.log')}`);
    }
  }
  const httpPort = Number(args['http-port'] ?? await freePort());
  const mcpPort = Number(args['mcp-port'] ?? await freePort());
  const agentId = String(args['agent-id'] ?? `m19-t2-failure-${Date.now()}`);
  let server;
  const result = {
    evidenceDir,
    agentId,
    httpPort,
    mcpPort,
    checks: {},
  };
  try {
    server = await startProofServer({ httpPort, mcpPort, evidenceDir });
    await postJson(`http://localhost:${httpPort}/api/agents`, {
      id: agentId,
      provider: 'mcp',
      requestedExecutionMode: 'auto',
    });
    const createdOnlyAgents = await getJson(`http://localhost:${httpPort}/api/agents`);
    const createdOnly = createdOnlyAgents.find((agent) => agent.id === agentId);
    result.checks.missingStart = {
      status: createdOnly?.status,
      passed: createdOnly?.status === 'creating',
      message: 'Agent remains creating until POST /start is called.',
    };

    const staleHashAgentId = `${agentId}-stale-hash`;
    await postJson(`http://localhost:${httpPort}/api/agents`, {
      id: staleHashAgentId,
      provider: 'mcp',
      requestedExecutionMode: 'auto',
    });
    await postJson(`http://localhost:${httpPort}/api/agents/${staleHashAgentId}/start`, {
      provider: 'mcp',
      executionMode: 'auto',
    });
    result.checks.staleHash = await staleHashProbe(mcpPort, staleHashAgentId);
    const stalePort = await freePort();
    result.checks.stalePort = await stalePortProbe(stalePort, `${agentId}-stale-port`);
  } finally {
    stopProcess(server?.child);
  }
  writeFileSync(path.join(evidenceDir, 'failure-probes.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(result, null, 2));
  if (!result.checks.missingStart?.passed || !result.checks.staleHash?.passed || !result.checks.stalePort?.passed) {
    process.exitCode = 1;
  }
}

async function staleHashProbe(mcpPort, agentId) {
  return new Promise((resolve) => {
    const ws = new WebSocket(mcpUrl(mcpPort, agentId, 'stale-hash-for-m19-t2'));
    let closeCode;
    let errorMessage;
    ws.on('open', () => {
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: {
            name: 'm19-stale-hash-probe',
            version: '1.0.0',
            contractHash: 'stale-hash-for-m19-t2',
          },
        },
      }));
    });
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      errorMessage = msg.error?.message;
    });
    ws.on('close', (code) => {
      closeCode = code;
      resolve({
        closeCode,
        errorMessage,
        passed: closeCode === 1008 && /Contract hash mismatch/.test(errorMessage ?? ''),
      });
    });
    ws.on('error', (err) => {
      resolve({ passed: false, error: err.message });
    });
  });
}

async function stalePortProbe(port, agentId) {
  return new Promise((resolve) => {
    const ws = new WebSocket(mcpUrl(port, agentId));
    ws.on('open', () => {
      ws.close();
      resolve({ passed: false, message: 'unexpected connection to supposedly unused port' });
    });
    ws.on('error', (err) => {
      resolve({ passed: true, error: err.message || String(err) });
    });
  });
}

function usage() {
  console.error(`Usage:
  node scripts/m19-real-cli-attach.mjs runbook [--http-port 3310] [--mcp-port 3311] [--agent codex:id] [--agent claude:id]
  node scripts/m19-real-cli-attach.mjs prepare --http-url http://localhost:3310 --mcp-port 3311 [--agent codex:id]
  node scripts/m19-real-cli-attach.mjs prove --cli codex|claude [--agent-id id] [--timeout-ms 45000] [--skip-build]
  node scripts/m19-real-cli-attach.mjs probe-failures [--agent-id id] [--skip-build]
`);
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0];
try {
  if (command === 'runbook') {
    printRunbook(args);
  } else if (command === 'prepare') {
    await prepareAgents(args);
  } else if (command === 'prove') {
    await proveCli(args);
  } else if (command === 'probe-failures') {
    await probeFailureModes(args);
  } else {
    usage();
    process.exit(command ? 1 : 0);
  }
} catch (err) {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
}
