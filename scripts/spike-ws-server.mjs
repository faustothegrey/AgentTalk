#!/usr/bin/env node
// Phase 1 gating spike: central multi-tenant WebSocket MCP server + routing/isolation test.
//
// Verifies the load-bearing unknowns before any production code:
//   1. JSON-RPC handshake + tool discovery routes CLI -> stdio bridge -> WS -> server.
//   2. A multi-minute (default 180s) blocking tool call resolves over the bridge.
//   3. WS ping/pong keep-alives hold the socket open during the block.
//   4. Two agents run overlapping calls concurrently with no cross-talk / ID collision.
//   5. (optional) Gemini loads MCP config in an untrusted dir with the trust flag.
//
// Usage:
//   node scripts/spike-ws-server.mjs                 # 180s block, codex + claude
//   node scripts/spike-ws-server.mjs 5               # fast plumbing check (5s block)
//   node scripts/spike-ws-server.mjs 180 codex claude gemini
//
// Exit code 0 only if every assertion passes.

import { WebSocketServer } from 'ws';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRIDGE = join(__dirname, 'mcp-bridge.mjs');
const MARKER = 'ZX9Q';
const PING_MS = 20_000;

const BLOCK_SECONDS = Number(process.argv[2] || 180);
const PROVIDERS = process.argv.slice(3).filter(Boolean);
const RUN = PROVIDERS.length ? PROVIDERS : ['codex', 'claude'];

const log = (...a) => console.log('[spike]', ...a);
const tmpDirs = [];
const children = new Set();

// ---- assertions ----------------------------------------------------------
const results = [];
const assert = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

// ---- central WS MCP server ----------------------------------------------
// Per connection (= one agent's bridge), terminate MCP. wait_tool blocks asynchronously
// (setTimeout) so the event loop stays free — that is what makes concurrency work.
const callLog = []; // { agentId, start, end }

const WAIT_TOOL = {
  name: 'wait_tool',
  description: 'Blocks for `seconds` then returns a confirmation string tagged with the calling agent id.',
  inputSchema: {
    type: 'object',
    properties: { seconds: { type: 'number', description: 'How many seconds to block.' } },
    required: ['seconds'],
  },
};

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function handleMessage(ws, agentId, raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch { return; }
  const { id, method, params } = msg;

  if (method === 'initialize') {
    send(ws, { jsonrpc: '2.0', id, result: {
      protocolVersion: params?.protocolVersion || '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'spike-ws-server', version: '1.0.0' },
    }});
    return;
  }
  if (method === 'notifications/initialized' || method === 'initialized') return;
  if (method === 'tools/list') {
    send(ws, { jsonrpc: '2.0', id, result: { tools: [WAIT_TOOL] } });
    return;
  }
  if (method === 'tools/call') {
    const name = params?.name;
    const seconds = Number(params?.arguments?.seconds ?? 0);
    if (name !== 'wait_tool') {
      send(ws, { jsonrpc: '2.0', id, error: { code: -32601, message: `unknown tool ${name}` } });
      return;
    }
    const entry = { agentId, start: Date.now(), end: 0 };
    callLog.push(entry);
    log(`tools/call wait_tool agentId=${agentId} seconds=${seconds} START`);
    setTimeout(() => {
      entry.end = Date.now();
      entry.pongs = ws.pongs;
      const elapsed = ((entry.end - entry.start) / 1000).toFixed(1);
      log(`tools/call wait_tool agentId=${agentId} DONE elapsed=${elapsed}s pongs=${ws.pongs}`);
      send(ws, { jsonrpc: '2.0', id, result: { content: [{ type: 'text',
        text: `WAIT_TOOL_OK agentId=${agentId} seconds=${seconds} elapsed=${elapsed} MARKER=${MARKER}` }] } });
    }, seconds * 1000);
    return;
  }
  if (id !== undefined) send(ws, { jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } });
}

function startServer() {
  return new Promise((resolve) => {
    const wss = new WebSocketServer({ port: 0 });
    wss.on('connection', (ws, req) => {
      const agentId = new URL(req.url, 'http://localhost').searchParams.get('agentId') || 'unknown';
      ws.agentId = agentId;
      ws.pongs = 0;
      ws.droppedDuringBlock = false;
      ws.on('pong', () => { ws.pongs++; });
      const pinger = setInterval(() => { if (ws.readyState === ws.OPEN) ws.ping(); }, PING_MS);
      ws.on('message', (data) => handleMessage(ws, agentId, data.toString()));
      ws.on('close', () => { clearInterval(pinger); log(`ws close agentId=${agentId} pongs=${ws.pongs}`); });
      ws.on('error', (e) => log(`ws error agentId=${agentId}: ${e.message}`));
      log(`ws connection agentId=${agentId}`);
    });
    wss.on('listening', () => resolve({ wss, port: wss.address().port }));
  });
}

// ---- CLI spawns ----------------------------------------------------------
const PROMPT = (n) =>
  `Call the wait_tool tool from the bridge MCP server with seconds=${n}. ` +
  `Then output ONLY the exact text the tool returned, verbatim, with no extra words.`;

function collect(child) {
  return new Promise((resolve) => {
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => resolve({ code, out, err }));
  });
}

function wsUrl(port, agentId) { return `ws://localhost:${port}/?agentId=${agentId}`; }

function runCodex(port, seconds) {
  // Codex enforces a hard ~120s default tool-call timeout; raise it so blocks >120s
  // resolve. (Empirically discovered in the spike — see mcp-cli-capability-assessment.md.)
  const child = spawn('codex', [
    'exec', '--dangerously-bypass-approvals-and-sandbox',
    '-c', 'mcp_servers.bridge.command="node"',
    '-c', `mcp_servers.bridge.args=["${BRIDGE}","${wsUrl(port, 'codex-spike')}"]`,
    '-c', `mcp_servers.bridge.tool_timeout_sec=${Math.max(seconds + 60, 600)}`,
    PROMPT(seconds),
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  children.add(child);
  return collect(child);
}

function runClaude(port, seconds) {
  const cwd = mkdtempSync(join(tmpdir(), 'spike-claude-'));
  tmpDirs.push(cwd);
  writeFileSync(join(cwd, '.mcp.json'), JSON.stringify({
    mcpServers: { bridge: { command: 'node', args: [BRIDGE, wsUrl(port, 'claude-spike')] } },
  }, null, 2));
  const child = spawn('claude', ['-p', PROMPT(seconds), '--permission-mode', 'bypassPermissions'],
    { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  children.add(child);
  return collect(child);
}

function runGemini(port, seconds) {
  // Untrusted temp dir + project-scoped MCP server, relying solely on the trust flag.
  const cwd = mkdtempSync(join(tmpdir(), 'spike-gemini-'));
  tmpDirs.push(cwd);
  const add = spawn('gemini', ['mcp', 'add', 'bridge', 'node', BRIDGE, wsUrl(port, 'gemini-spike'), '--scope', 'project'],
    { cwd, stdio: 'ignore' });
  return new Promise((resolve) => {
    add.on('close', () => {
      const child = spawn('gemini', ['--skip-trust', '--approval-mode', 'yolo', '-p', PROMPT(seconds)],
        { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GEMINI_CLI_TRUST_WORKSPACE: 'true' } });
      children.add(child);
      resolve(collect(child));
    });
  });
}

const RUNNERS = { codex: runCodex, claude: runClaude, gemini: runGemini };

// ---- main ----------------------------------------------------------------
async function main() {
  const { wss, port } = await startServer();
  log(`server listening on ws://localhost:${port}  (block=${BLOCK_SECONDS}s, providers=${RUN.join(', ')})`);

  const concurrent = RUN.filter((p) => p === 'codex' || p === 'claude');
  const t0 = Date.now();
  const runs = await Promise.all(concurrent.map((p) => RUNNERS[p](port, BLOCK_SECONDS).then((r) => ({ p, ...r }))));
  const wallSec = (Date.now() - t0) / 1000;

  for (const r of runs) {
    const expectedId = `${r.p}-spike`;
    const gotMarker = r.out.includes(`MARKER=${MARKER}`);
    const gotOwnId = r.out.includes(`agentId=${expectedId}`);
    const gotOtherId = runs.some((o) => o.p !== r.p && r.out.includes(`agentId=${o.p}-spike`));
    assert(`${r.p}: handshake + tool call returned marker`, gotMarker, gotMarker ? '' : `exit=${r.code} out="${r.out.slice(0, 200).replace(/\n/g, '⏎')}"`);
    assert(`${r.p}: no cross-talk (own agentId, not peer's)`, gotOwnId && !gotOtherId,
      `own=${gotOwnId} leakedPeer=${gotOtherId}`);
  }

  // concurrency: the two server-side call intervals must overlap, and total wall time
  // must be far below the serial sum (2 * block).
  if (concurrent.length === 2 && callLog.length >= 2) {
    const [a, b] = callLog;
    const overlap = a.start < b.end && b.start < a.end;
    assert('concurrency: server-side calls overlapped in time', overlap,
      `a=[${a.start - t0 | 0},${a.end - t0 | 0}] b=[${b.start - t0 | 0},${b.end - t0 | 0}] ms`);
    assert('concurrency: wall time ~1x block, not serial 2x', wallSec < BLOCK_SECONDS * 2 - BLOCK_SECONDS / 2 + 20,
      `wall=${wallSec.toFixed(1)}s vs serial≈${(BLOCK_SECONDS * 2)}s`);
  }

  // keep-alive: every connection that served a (long) block must have received pongs and
  // stayed open through to the result. Only meaningful when block > ping interval.
  if (BLOCK_SECONDS * 1000 > PING_MS) {
    // Use pong counts recorded at call-completion (sockets may already be closed now).
    const longCalls = callLog.filter((e) => e.end > 0);
    const allPonged = longCalls.length > 0 && longCalls.every((e) => (e.pongs || 0) > 0);
    assert('keep-alive: ping/pong kept sockets alive during block',
      allPonged, longCalls.map((e) => `${e.agentId}:${e.pongs || 0}pongs`).join(' '));
  } else {
    log(`(keep-alive assertion skipped: block ${BLOCK_SECONDS}s < ping ${PING_MS / 1000}s)`);
  }

  // gemini trust flag (separate, sequential)
  if (RUN.includes('gemini')) {
    log('gemini trust-flag check (untrusted dir + GEMINI_CLI_TRUST_WORKSPACE=true)...');
    const g = await runGemini(port, Math.min(BLOCK_SECONDS, 10));
    const ok = g.out.includes(`MARKER=${MARKER}`) && g.out.includes('agentId=gemini-spike');
    assert('gemini: loads MCP in untrusted dir via trust flag', ok,
      ok ? '' : `exit=${g.code} out="${g.out.slice(0, 200).replace(/\n/g, '⏎')}"`);
  }

  wss.close();
}

function cleanup() {
  for (const c of children) { try { c.kill('SIGKILL'); } catch { /* noop */ } }
  for (const d of tmpDirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* noop */ } }
}

main()
  .then(() => {
    cleanup();
    const failed = results.filter((r) => !r.ok);
    console.log(`\n[spike] ${results.length - failed.length}/${results.length} assertions passed`);
    process.exit(failed.length ? 1 : 0);
  })
  .catch((e) => {
    console.error('[spike] ERROR', e);
    cleanup();
    process.exit(1);
  });
