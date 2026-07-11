#!/usr/bin/env node
import { createHash } from 'crypto';
import { execFile, spawn } from 'child_process';
import { createServer } from 'net';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const clientRoot = path.resolve(repoRoot, '../agentalk-mcp-client');
const bridgePath = path.join(clientRoot, 'bridge.mjs');
const recorderPath = path.join(repoRoot, 'scripts/m19-bridge-recorder.mjs');
const contractPath = path.join(repoRoot, 'packages/contracts/wire-contract.json');
const wireContract = JSON.parse(readFileSync(contractPath, 'utf8'));
const bridgeToolNames = wireContract.data.mcpTools.map((name) => `mcp__agenttalk-bridge__${name}`);
const allowedTools = [
  'mcp__agenttalk-bridge__await_turn',
  'mcp__agenttalk-bridge__send_to_agent',
  ...bridgeToolNames.filter((tool) => ![
    'mcp__agenttalk-bridge__await_turn',
    'mcp__agenttalk-bridge__send_to_agent',
  ].includes(tool)),
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
    args[key] = next;
    i += 1;
  }
  return args;
}

function mcpUrl(port, agentId) {
  return `ws://localhost:${port}/mcp?agentId=${encodeURIComponent(agentId)}&contractHash=${wireContract.hash}`;
}

function claudeConfig(url, bridgeLogPath) {
  return JSON.stringify({
    mcpServers: {
      'agenttalk-bridge': {
        command: 'node',
        args: [recorderPath, bridgePath, url, bridgeLogPath],
      },
    },
  });
}

function codexArgs(url, bridgeLogPath, prompt) {
  return [
    'exec',
    '--skip-git-repo-check',
    '--color', 'never',
    '--json',
    '--dangerously-bypass-approvals-and-sandbox',
    '-c', 'mcp_servers.agenttalk-bridge.command="node"',
    '-c', `mcp_servers.agenttalk-bridge.args=["${recorderPath}","${bridgePath}","${url}","${bridgeLogPath}"]`,
    '-c', 'mcp_servers.agenttalk-bridge.tool_timeout_sec=600',
    prompt,
  ];
}

function readSnapshot(paths) {
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

function diffSnapshot(before, after) {
  return Object.keys(before)
    .filter((file) => JSON.stringify(before[file]) !== JSON.stringify(after[file]))
    .map((file) => ({ file, before: before[file], after: after[file] }));
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

function run(command, args, options = {}) {
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
    child.stdin?.end();
  });
}

function launch(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk) => options.onStdout?.(chunk.toString()));
  child.stderr?.on('data', (chunk) => options.onStderr?.(chunk.toString()));
  return child;
}

function stopProcess(child) {
  if (!child || child.killed) return;
  child.kill('SIGTERM');
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

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(`${res.status} ${url}: ${text}`);
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

async function startServer(httpPort, mcpPort, evidenceDir) {
  const recordingPath = path.join(evidenceDir, 'm19-t3-recording.ndjson');
  const serverLogPath = path.join(evidenceDir, 'm19-t3-server.log');
  let serverLog = '';
  const child = launch('node', ['apps/orchestrator/dist/index.js'], {
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
    'orchestrator ports',
  );
  return { child, recordingPath, serverLogPath, getLog: () => serverLog };
}

function readJsonLines(filePath) {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, 'utf8')
    .split(/\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function buildInstruction({ sourceId, targetId, eventId, batonId }) {
  const args = {
    to: targetId,
    payload: 'M19-T3 substrate hand-off: implementation reviewer proposes scripts/m19-real-cli-attach.mjs as a low-risk future refactor candidate for the implementer to inspect.',
    baton: {
      kind: 'workflow_baton',
      batonId,
      fromRole: 'implementation-reviewer',
      toRole: 'implementer',
      originTag: '[SM]',
    },
    workflowEvent: {
      kind: 'workflow_gate_event',
      gate: 'gate-2',
      action: 'verdict',
      fromAgentId: sourceId,
      fromRole: 'implementation-reviewer',
      toAgentId: targetId,
      toRole: 'implementer',
      taskId: 'M19-T3',
      eventId,
    },
  };
  return [
    'AgentTalk M19-T3 turn.',
    'Use the agenttalk-bridge MCP server tool send_to_agent exactly once.',
    'Do not use shell commands and do not answer in prose before the tool call.',
    `Call send_to_agent with this exact JSON argument object: ${JSON.stringify(args)}.`,
  ].join(' ');
}

function bridgeTxMatches(tx, { sourceId, targetId, eventId, batonId }) {
  const args = tx.toolArguments;
  return tx.event === 'tx' &&
    tx.method === 'tools/call' &&
    tx.toolName === 'send_to_agent' &&
    args?.to === targetId &&
    args?.workflowEvent?.eventId === eventId &&
    args?.workflowEvent?.fromAgentId === sourceId &&
    args?.baton?.batonId === batonId;
}

function recordingEventMatches(event, { sourceId, eventId }) {
  return event.event === 'workflow_gate_attempt' &&
    event.payload?.agentId === sourceId &&
    event.payload?.result === 'accepted' &&
    event.payload?.event?.eventId === eventId;
}

async function proveRelay(args) {
  const cliName = String(args.cli ?? 'codex');
  if (!['codex', 'claude'].includes(cliName)) {
    throw new Error('--cli must be codex or claude');
  }
  const evidenceDir = path.resolve(args['evidence-dir'] ?? path.join(repoRoot, 'design/evidence', `m19-t3-relay-${new Date().toISOString().replace(/[:.]/g, '-')}`));
  mkdirSync(evidenceDir, { recursive: true });
  if (!args['skip-build']) {
    const build = await run('npm', ['run', 'build', '--workspace', '@agenttalk/orchestrator']);
    writeFileSync(path.join(evidenceDir, 'build.log'), build.stdout + build.stderr, 'utf8');
    if (build.code !== 0) {
      throw new Error(`orchestrator build failed; see ${path.join(evidenceDir, 'build.log')}`);
    }
  }

  const httpPort = Number(args['http-port'] ?? await freePort());
  const mcpPort = Number(args['mcp-port'] ?? await freePort());
  const sourceId = String(args['source-id'] ?? `m19-t3-source-${Date.now()}`);
  const targetId = String(args['target-id'] ?? `m19-t3-target-${Date.now()}`);
  const eventId = String(args['event-id'] ?? 'm19-t3-event-1');
  const batonId = String(args['baton-id'] ?? 'm19-t3-baton-1');
  const bridgeLogPath = path.join(evidenceDir, 'm19-t3-bridge-transactions.ndjson');
  const debugFile = path.join(evidenceDir, 'm19-t3-claude-debug.log');
  const beforeConfig = readSnapshot(configAuditPaths);
  const beforeState = readSnapshot(stateAuditPaths);
  let server;
  let cli;
  const proof = {
    startedAt: new Date().toISOString(),
    sourceId,
    targetId,
    eventId,
    batonId,
    httpPort,
    mcpPort,
    contractVersion: wireContract.version,
    contractHash: wireContract.hash,
    evidenceDir,
  };
  try {
    server = await startServer(httpPort, mcpPort, evidenceDir);
    for (const agentId of [sourceId, targetId]) {
      await postJson(`http://localhost:${httpPort}/api/agents`, {
        id: agentId,
        provider: 'mcp',
        requestedExecutionMode: 'auto',
      });
      await postJson(`http://localhost:${httpPort}/api/agents/${agentId}/start`, {
        provider: 'mcp',
        executionMode: 'auto',
      });
    }
    await postJson(`http://localhost:${httpPort}/api/agents/${sourceId}/workflow-role`, {
      role: 'implementation-reviewer',
    });
    await postJson(`http://localhost:${httpPort}/api/agents/${targetId}/workflow-role`, {
      role: 'implementer',
    });
    proof.agentsAfterStart = await getJson(`http://localhost:${httpPort}/api/agents`);

    const url = mcpUrl(mcpPort, sourceId);
    const prompt = [
      'Use the agenttalk-bridge MCP server.',
      'First call await_turn and wait for AgentTalk instructions.',
      'When a turn arrives, follow it exactly using the MCP tool surface.',
      'Do not use shell commands to simulate AgentTalk tools.',
    ].join(' ');
    const cliArgs = cliName === 'codex'
      ? codexArgs(url, bridgeLogPath, prompt)
      : [
        '--strict-mcp-config',
        '--mcp-config', claudeConfig(url, bridgeLogPath),
        '--allowedTools', allowedTools.join(','),
        '--permission-mode', 'auto',
        '--debug-file', debugFile,
        '--no-session-persistence',
        '-p', prompt,
      ];
    const cliCommand = cliName === 'codex' ? 'codex' : 'claude';
    proof.cli = cliName;
    proof.command = [cliCommand, ...cliArgs].map((part) => `'${String(part).replace(/'/g, `'\\''`)}'`).join(' ');
    let cliStdout = '';
    let cliStderr = '';
    cli = launch(cliCommand, cliArgs, {
      onStdout: (chunk) => {
        cliStdout += chunk;
        writeFileSync(path.join(evidenceDir, `m19-t3-${cliName}-stdout.log`), cliStdout, 'utf8');
      },
      onStderr: (chunk) => {
        cliStderr += chunk;
        writeFileSync(path.join(evidenceDir, `m19-t3-${cliName}-stderr.log`), cliStderr, 'utf8');
      },
    });

    await waitFor(
      () => server.getLog().includes(`MCP tool call from ${sourceId}: await_turn`),
      90000,
      'source await_turn',
    );
    const instruction = buildInstruction({ sourceId, targetId, eventId, batonId });
    const job = await postJson(`http://localhost:${httpPort}/api/scheduler/jobs`, {
      name: 'M19-T3 relay proof',
      agentId: sourceId,
      prompt: instruction,
      intervalSeconds: 60,
      enabled: false,
    });
    proof.schedulerJob = job;
    await postJson(`http://localhost:${httpPort}/api/scheduler/jobs/${job.id}/run`, {});

    await waitFor(() => {
      const bridgeEvents = readJsonLines(bridgeLogPath);
      const recorderEvents = readJsonLines(server.recordingPath);
      const bridgeTx = bridgeEvents.find((event) => bridgeTxMatches(event, { sourceId, targetId, eventId, batonId }));
      const recordedGate = recorderEvents.find((event) => recordingEventMatches(event, { sourceId, eventId }));
      if (bridgeTx && recordedGate) {
        return { bridgeTx, recordedGate };
      }
      return null;
    }, 90000, 'accepted workflow event and bridge send_to_agent transaction');

    const bridgeEvents = readJsonLines(bridgeLogPath);
    const recorderEvents = readJsonLines(server.recordingPath);
    proof.bridgeTx = bridgeEvents.find((event) => bridgeTxMatches(event, { sourceId, targetId, eventId, batonId }));
    proof.recordedGate = recorderEvents.find((event) => recordingEventMatches(event, { sourceId, eventId }));
    proof.serverAccepted = server.getLog().includes(`Workflow gate attempt by ${sourceId} (accepted)`);
    proof.result = proof.bridgeTx && proof.recordedGate && proof.serverAccepted ? 'substrate_relay_proven' : 'missing_correlation';
    proof.finishedAt = new Date().toISOString();
  } finally {
    stopProcess(cli);
    stopProcess(server?.child);
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
  proof.globalConfigChanges = diffSnapshot(beforeConfig, readSnapshot(configAuditPaths));
  proof.globalStateChanges = diffSnapshot(beforeState, readSnapshot(stateAuditPaths));
  proof.noGlobalConfigMutation = proof.globalConfigChanges.length === 0;
  proof.ratio = {
    substrateNumerator: proof.result === 'substrate_relay_proven' ? 1 : 0,
    denominator: 3,
    value: proof.result === 'substrate_relay_proven' ? '1/3' : '0/3',
    terminalFallbackRows: [
      'SM/PO terminal baton assigned M19-T3 to Codex implementer.',
      'Codex terminal handoff to Claude Gate 2 reviewer after implementation.',
    ],
    substrateRows: [
      proof.result === 'substrate_relay_proven'
        ? `${sourceId} real attached ${cliName} CLI emitted accepted workflow_gate_event ${eventId} via send_to_agent to ${targetId}.`
        : 'No accepted real attached CLI substrate relay produced.',
    ],
  };
  writeFileSync(path.join(evidenceDir, 'proof.json'), JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
  if (proof.result !== 'substrate_relay_proven' || !proof.noGlobalConfigMutation) {
    process.exitCode = 1;
  }
}

function usage() {
  console.error(`Usage:
  node scripts/m19-relay-ratio.mjs prove [--cli codex|claude] [--skip-build] [--source-id id] [--target-id id]
`);
}

const args = parseArgs(process.argv.slice(2));
try {
  if (args._[0] === 'prove') {
    await proveRelay(args);
  } else {
    usage();
    process.exit(args._[0] ? 1 : 0);
  }
} catch (err) {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
}
