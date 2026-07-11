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
const recorderPath = path.join(repoRoot, 'scripts/m19-bridge-recorder.mjs');
const contractPath = path.join(repoRoot, 'packages/contracts/wire-contract.json');
const wireContract = JSON.parse(readFileSync(contractPath, 'utf8'));
const bridgeToolNames = wireContract.data.mcpTools.map((name) => `mcp__agenttalk-bridge__${name}`);

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
      maxBuffer: 1024 * 1024 * 50,
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
  const child = execFile(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? process.env,
  });
  child.stdout?.on('data', (chunk) => options.onStdout?.(chunk.toString()));
  child.stderr?.on('data', (chunk) => options.onStderr?.(chunk.toString()));
  child.stdin?.end();
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
  const recordingPath = path.join(evidenceDir, 'm20-t3-recording.ndjson');
  const serverLogPath = path.join(evidenceDir, 'm20-t3-server.log');
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

function recordingGateMatches(event, { sourceId, eventId }) {
  return event.event === 'workflow_gate_attempt' &&
    event.payload?.agentId === sourceId &&
    event.payload?.result === 'accepted' &&
    event.payload?.event?.eventId === eventId;
}

function recordingRelayMatches(event, { sourceId, targetId, eventId, status }) {
  return event.event === 'pending_relay_updated' &&
    event.payload?.relay?.fromAgentId === sourceId &&
    event.payload?.relay?.toAgentId === targetId &&
    event.payload?.relay?.workflowEvent?.eventId === eventId &&
    event.payload?.relay?.status === status;
}

function messageDeliveryLog(sourceId, targetId) {
  return `Sending EVT to agent ${targetId}: {"type":"message_received","from":"${sourceId}"`;
}

function buildInstruction({ sourceId, targetId, eventId, batonId, payload }) {
  const args = {
    to: targetId,
    payload,
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
      taskId: 'M20-T3',
      eventId,
    },
  };
  return [
    'AgentTalk M20-T3 turn.',
    'Use the agenttalk-bridge MCP server tool send_to_agent exactly once.',
    'Do not use shell commands and do not answer in prose before the tool call.',
    `Call send_to_agent with this exact JSON argument object: ${JSON.stringify(args)}.`,
  ].join(' ');
}

async function openWsWithInitialState(httpPort) {
  const ws = new WebSocket(`ws://127.0.0.1:${httpPort}/ws`);
  const initialState = waitForWsMessage(ws, (message) => message.type === 'relay_approval_state', 5000, 'initial relay approval state');
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  return { ws, initialState: await initialState };
}

function waitForWsMessage(ws, predicate, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.off('message', onMessage);
      reject(new Error(`Timed out waiting for ${label}`));
    }, timeoutMs);
    const onMessage = (raw) => {
      const message = JSON.parse(raw.toString());
      if (!predicate(message)) return;
      clearTimeout(timeout);
      ws.off('message', onMessage);
      resolve(message);
    };
    ws.on('message', onMessage);
    ws.once('error', reject);
  });
}

async function sendWs(ws, message) {
  ws.send(JSON.stringify(message));
}

async function attachWsToAgent(ws, agentId) {
  const history = waitForWsMessage(
    ws,
    (message) => message.type === 'message_history' && message.agentId === agentId,
    5000,
    `message_history for ${agentId}`,
  );
  await sendWs(ws, { type: 'attach', agentId });
  await history;
}

function cliPrompt(label) {
  return [
    'Use the agenttalk-bridge MCP server.',
    'First call await_turn and wait for AgentTalk instructions.',
    `This is the M20-T3 ${label} proof actor.`,
    'When a turn arrives, follow it exactly using the MCP tool surface.',
    'Do not use shell commands to simulate AgentTalk tools.',
  ].join(' ');
}

function launchCodexCli({ agentId, mcpPort, bridgeLogPath, stdoutPath, stderrPath, label }) {
  let stdout = '';
  let stderr = '';
  const url = mcpUrl(mcpPort, agentId);
  const child = launch('codex', codexArgs(url, bridgeLogPath, cliPrompt(label)), {
    onStdout: (chunk) => {
      stdout += chunk;
      writeFileSync(stdoutPath, stdout, 'utf8');
    },
    onStderr: (chunk) => {
      stderr += chunk;
      writeFileSync(stderrPath, stderr, 'utf8');
    },
  });
  return {
    child,
    getStdout: () => stdout,
    getStderr: () => stderr,
  };
}

async function createStartedMcpAgent(httpUrl, agentId, role) {
  await postJson(`${httpUrl}/api/agents`, {
    id: agentId,
    provider: 'mcp',
    requestedExecutionMode: 'auto',
  });
  await postJson(`${httpUrl}/api/agents/${agentId}/start`, {
    provider: 'mcp',
    executionMode: 'auto',
  });
  if (role) {
    await postJson(`${httpUrl}/api/agents/${agentId}/workflow-role`, { role });
  }
}

async function proveApprovedRelay({
  httpUrl,
  httpPort,
  mcpPort,
  evidenceDir,
  server,
  ws,
  sourceId,
  targetId,
  eventId,
  batonId,
}) {
  const payload = 'M20-T3 APPROVED RELAY PAYLOAD: target should receive only after WS approval.';
  const sourceBridgeLogPath = path.join(evidenceDir, 'm20-t3-approved-source-bridge.ndjson');
  const targetBridgeLogPath = path.join(evidenceDir, 'm20-t3-approved-target-bridge.ndjson');
  const sourceStdoutPath = path.join(evidenceDir, 'm20-t3-approved-source-stdout.log');
  const sourceStderrPath = path.join(evidenceDir, 'm20-t3-approved-source-stderr.log');
  const targetStdoutPath = path.join(evidenceDir, 'm20-t3-approved-target-stdout.log');
  const targetStderrPath = path.join(evidenceDir, 'm20-t3-approved-target-stderr.log');

  await createStartedMcpAgent(httpUrl, targetId, 'implementer');
  const targetCli = launchCodexCli({
    agentId: targetId,
    mcpPort,
    bridgeLogPath: targetBridgeLogPath,
    stdoutPath: targetStdoutPath,
    stderrPath: targetStderrPath,
    label: 'approved target',
  });
  await waitFor(
    () => server.getLog().includes(`MCP tool call from ${targetId}: await_turn`),
    90000,
    'approved target await_turn',
  );

  await createStartedMcpAgent(httpUrl, sourceId, 'implementation-reviewer');
  const sourceCli = launchCodexCli({
    agentId: sourceId,
    mcpPort,
    bridgeLogPath: sourceBridgeLogPath,
    stdoutPath: sourceStdoutPath,
    stderrPath: sourceStderrPath,
    label: 'approved source',
  });
  await waitFor(
    () => server.getLog().includes(`MCP tool call from ${sourceId}: await_turn`),
    90000,
    'approved source await_turn',
  );

  const instruction = buildInstruction({ sourceId, targetId, eventId, batonId, payload });
  await attachWsToAgent(ws, sourceId);
  await sendWs(ws, { type: 'message', text: instruction });

  const pending = await waitFor(() => {
    const bridgeEvents = readJsonLines(sourceBridgeLogPath);
    const recorderEvents = readJsonLines(server.recordingPath);
    const bridgeTx = bridgeEvents.find((event) => bridgeTxMatches(event, { sourceId, targetId, eventId, batonId }));
    const recordedGate = recorderEvents.find((event) => recordingGateMatches(event, { sourceId, eventId }));
    const pendingRelay = recorderEvents.find((event) => recordingRelayMatches(event, { sourceId, targetId, eventId, status: 'pending' }));
    if (bridgeTx && recordedGate && pendingRelay) {
      return { bridgeTx, recordedGate, pendingRelay };
    }
    return null;
  }, 90000, 'approved relay pending lifecycle');

  await new Promise((resolve) => setTimeout(resolve, 1500));
  const preApprovalDelivery = server.getLog().includes(messageDeliveryLog(sourceId, targetId));
  const preApprovalTargetStdoutContainsPayload = targetCli.getStdout().includes(payload);
  if (preApprovalDelivery || preApprovalTargetStdoutContainsPayload) {
    throw new Error('Approved relay reached target before WS approval');
  }

  const relayId = pending.pendingRelay.payload.relay.id;
  const approvedUpdate = waitForWsMessage(
    ws,
    (message) => message.type === 'pending_relay_updated' &&
      message.relay?.id === relayId &&
      message.relay?.status === 'approved_delivered',
    30000,
    'approved_delivered WS update',
  );
  await sendWs(ws, { type: 'approve_pending_relay', relayId });
  await approvedUpdate;

  const approved = await waitFor(() => {
    const recorderEvents = readJsonLines(server.recordingPath);
    const approvedRelay = recorderEvents.find((event) => recordingRelayMatches(event, { sourceId, targetId, eventId, status: 'approved_delivered' }));
    if (approvedRelay && server.getLog().includes(messageDeliveryLog(sourceId, targetId)) && targetCli.getStdout().includes(payload)) {
      return { approvedRelay };
    }
    return null;
  }, 90000, 'approved relay delivery to target CLI');

  stopProcess(sourceCli.child);
  stopProcess(targetCli.child);

  return {
    sourceId,
    targetId,
    eventId,
    batonId,
    payload,
    relayId,
    bridgeLogPath: sourceBridgeLogPath,
    targetBridgeLogPath,
    sourceStdoutPath,
    targetStdoutPath,
    bridgeTx: pending.bridgeTx,
    recordedGate: pending.recordedGate,
    pendingRelay: pending.pendingRelay,
    approvedRelay: approved.approvedRelay,
    preApprovalNoDelivery: !preApprovalDelivery && !preApprovalTargetStdoutContainsPayload,
    targetReceivedAfterApproval: targetCli.getStdout().includes(payload),
    sourceCliResultText: sourceCli.getStdout().includes('Message pending PO approval') ? 'pending_result_observed' : 'pending_result_not_found',
  };
}

async function proveDeniedRelay({
  httpUrl,
  mcpPort,
  evidenceDir,
  server,
  ws,
  sourceId,
  targetId,
  eventId,
  batonId,
}) {
  const payload = 'M20-T3 DENIED RELAY PAYLOAD: target must not receive this message.';
  const sourceBridgeLogPath = path.join(evidenceDir, 'm20-t3-denied-source-bridge.ndjson');
  const sourceStdoutPath = path.join(evidenceDir, 'm20-t3-denied-source-stdout.log');
  const sourceStderrPath = path.join(evidenceDir, 'm20-t3-denied-source-stderr.log');

  await createStartedMcpAgent(httpUrl, targetId, 'implementer');
  await createStartedMcpAgent(httpUrl, sourceId, 'implementation-reviewer');
  const sourceCli = launchCodexCli({
    agentId: sourceId,
    mcpPort,
    bridgeLogPath: sourceBridgeLogPath,
    stdoutPath: sourceStdoutPath,
    stderrPath: sourceStderrPath,
    label: 'denied source',
  });
  await waitFor(
    () => server.getLog().includes(`MCP tool call from ${sourceId}: await_turn`),
    90000,
    'denied source await_turn',
  );

  const instruction = buildInstruction({ sourceId, targetId, eventId, batonId, payload });
  await attachWsToAgent(ws, sourceId);
  await sendWs(ws, { type: 'message', text: instruction });

  const pending = await waitFor(() => {
    const bridgeEvents = readJsonLines(sourceBridgeLogPath);
    const recorderEvents = readJsonLines(server.recordingPath);
    const bridgeTx = bridgeEvents.find((event) => bridgeTxMatches(event, { sourceId, targetId, eventId, batonId }));
    const recordedGate = recorderEvents.find((event) => recordingGateMatches(event, { sourceId, eventId }));
    const pendingRelay = recorderEvents.find((event) => recordingRelayMatches(event, { sourceId, targetId, eventId, status: 'pending' }));
    if (bridgeTx && recordedGate && pendingRelay) {
      return { bridgeTx, recordedGate, pendingRelay };
    }
    return null;
  }, 90000, 'denied relay pending lifecycle');

  await new Promise((resolve) => setTimeout(resolve, 1000));
  const preDenyDelivery = server.getLog().includes(messageDeliveryLog(sourceId, targetId));
  if (preDenyDelivery) {
    throw new Error('Denied relay reached target before denial');
  }

  const relayId = pending.pendingRelay.payload.relay.id;
  const deniedUpdate = waitForWsMessage(
    ws,
    (message) => message.type === 'pending_relay_updated' &&
      message.relay?.id === relayId &&
      message.relay?.status === 'denied',
    30000,
    'denied WS update',
  );
  await sendWs(ws, { type: 'deny_pending_relay', relayId });
  await deniedUpdate;

  await new Promise((resolve) => setTimeout(resolve, 1500));
  const postDenyDelivery = server.getLog().includes(messageDeliveryLog(sourceId, targetId));
  const recorderEvents = readJsonLines(server.recordingPath);
  const deniedRelay = recorderEvents.find((event) => recordingRelayMatches(event, { sourceId, targetId, eventId, status: 'denied' }));

  stopProcess(sourceCli.child);

  if (!deniedRelay || postDenyDelivery) {
    throw new Error('Denied relay proof failed: denied lifecycle missing or target delivery occurred');
  }

  return {
    sourceId,
    targetId,
    eventId,
    batonId,
    payload,
    relayId,
    bridgeLogPath: sourceBridgeLogPath,
    sourceStdoutPath,
    bridgeTx: pending.bridgeTx,
    recordedGate: pending.recordedGate,
    pendingRelay: pending.pendingRelay,
    deniedRelay,
    noDeliveryBeforeOrAfterDeny: !preDenyDelivery && !postDenyDelivery,
  };
}

async function prove(args) {
  const evidenceDir = path.resolve(args['evidence-dir'] ?? path.join(repoRoot, 'design/evidence', `m20-t3-approved-relay-${new Date().toISOString().replace(/[:.]/g, '-')}`));
  mkdirSync(evidenceDir, { recursive: true });

  if (!args['skip-build']) {
    const build = await run('npm', ['run', 'build', '--workspace', '@agenttalk/orchestrator']);
    writeFileSync(path.join(evidenceDir, 'orchestrator-build.log'), build.stdout + build.stderr, 'utf8');
    if (build.code !== 0) {
      throw new Error(`orchestrator build failed; see ${path.join(evidenceDir, 'orchestrator-build.log')}`);
    }
  }

  const httpPort = Number(args['http-port'] ?? await freePort());
  const mcpPort = Number(args['mcp-port'] ?? await freePort());
  const runId = String(args['run-id'] ?? Date.now());
  const approvedSourceId = String(args['approved-source-id'] ?? `m20-t3-approved-source-${runId}`);
  const approvedTargetId = String(args['approved-target-id'] ?? `m20-t3-approved-target-${runId}`);
  const deniedSourceId = String(args['denied-source-id'] ?? `m20-t3-denied-source-${runId}`);
  const deniedTargetId = String(args['denied-target-id'] ?? `m20-t3-denied-target-${runId}`);
  const beforeConfig = readSnapshot(configAuditPaths);
  const beforeState = readSnapshot(stateAuditPaths);
  let server;
  let ws;
  const proof = {
    startedAt: new Date().toISOString(),
    evidenceDir,
    httpPort,
    mcpPort,
    contractVersion: wireContract.version,
    contractHash: wireContract.hash,
    cli: 'codex',
    bridgeToolNames,
  };

  try {
    server = await startServer(httpPort, mcpPort, evidenceDir);
    const opened = await openWsWithInitialState(httpPort);
    ws = opened.ws;
    const initialState = opened.initialState;
    proof.initialRelayApprovalMode = initialState.mode;
    if (initialState.mode !== 'off') {
      throw new Error(`Expected relay approval mode to start off, got ${initialState.mode}`);
    }

    const modeUpdate = waitForWsMessage(ws, (message) => message.type === 'relay_approval_mode' && message.mode === 'approve_each', 5000, 'approve_each mode update');
    await sendWs(ws, { type: 'set_relay_approval_mode', mode: 'approve_each' });
    await modeUpdate;
    proof.modeSetViaWs = 'approve_each';

    const httpUrl = `http://127.0.0.1:${httpPort}`;
    proof.approved = await proveApprovedRelay({
      httpUrl,
      httpPort,
      mcpPort,
      evidenceDir,
      server,
      ws,
      sourceId: approvedSourceId,
      targetId: approvedTargetId,
      eventId: 'm20-t3-approved-event-1',
      batonId: 'm20-t3-approved-baton-1',
    });
    proof.denied = await proveDeniedRelay({
      httpUrl,
      mcpPort,
      evidenceDir,
      server,
      ws,
      sourceId: deniedSourceId,
      targetId: deniedTargetId,
      eventId: 'm20-t3-denied-event-1',
      batonId: 'm20-t3-denied-baton-1',
    });
    proof.agentsAfterProof = await getJson(`${httpUrl}/api/agents`);
    proof.result = proof.approved?.preApprovalNoDelivery &&
      proof.approved?.targetReceivedAfterApproval &&
      proof.denied?.noDeliveryBeforeOrAfterDeny
      ? 'approved_relay_proven'
      : 'missing_required_evidence';
  } finally {
    ws?.close();
    stopProcess(server?.child);
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));
  proof.finishedAt = new Date().toISOString();
  proof.globalConfigChanges = diffSnapshot(beforeConfig, readSnapshot(configAuditPaths));
  proof.globalStateChanges = diffSnapshot(beforeState, readSnapshot(stateAuditPaths));
  proof.noGlobalConfigMutation = proof.globalConfigChanges.length === 0;
  proof.metric = {
    label: 'M20 demonstration approved-relay proof; not an organic productivity statistic.',
    rawRelayCount: 2,
    pendingRelaysObserved: 2,
    approvedDelivered: proof.approved?.targetReceivedAfterApproval ? 1 : 0,
    denied: proof.denied?.noDeliveryBeforeOrAfterDeny ? 1 : 0,
    deliveryFailed: 0,
    terminalFallbackRows: [
      'PO terminal baton assigned M20-T3 to Codex implementer.',
      'Codex terminal handoff to Claude Gate 2 reviewer after implementation.',
    ],
    substrateRows: [
      proof.approved?.targetReceivedAfterApproval
        ? `${approvedSourceId} real attached Codex CLI emitted baton-bearing send_to_agent; WS approval delivered relay ${proof.approved.relayId} to ${approvedTargetId}.`
        : 'No approved substrate relay delivered.',
      proof.denied?.noDeliveryBeforeOrAfterDeny
        ? `${deniedSourceId} real attached Codex CLI emitted baton-bearing send_to_agent; WS denial recorded relay ${proof.denied.relayId} without delivery.`
        : 'No denied negative relay proven.',
    ],
    substrateNumerator: proof.approved?.targetReceivedAfterApproval ? 1 : 0,
    denominator: 3,
    ratio: proof.approved?.targetReceivedAfterApproval ? '1/3' : '0/3',
    denominatorBasis: 'approved delivered substrate relay plus two terminal fallback rows; denied negative is counted in raw relay count, not as delivered substrate.',
  };
  writeFileSync(path.join(evidenceDir, 'proof.json'), JSON.stringify(proof, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(proof, null, 2));
  if (proof.result !== 'approved_relay_proven' || !proof.noGlobalConfigMutation) {
    process.exitCode = 1;
  }
}

function usage() {
  console.error(`Usage:
  node scripts/m20-approved-relay-proof.mjs prove [--skip-build] [--http-port n] [--mcp-port n] [--evidence-dir path]
`);
}

const args = parseArgs(process.argv.slice(2));
try {
  if (args._[0] === 'prove') {
    await prove(args);
  } else {
    usage();
    process.exit(args._[0] ? 1 : 0);
  }
} catch (err) {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
}
