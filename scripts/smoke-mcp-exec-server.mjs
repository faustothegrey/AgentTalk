#!/usr/bin/env node
/**
 * Live smoke for @agenttalk/mcp-exec-server — the piece the llm-client spike flagged as OWED.
 *
 * Proves the consensus-free "third-party app chats via a real MCP CLI executor" path end-to-end
 * against the REAL `agentalk-mcp-client` CLI (not the in-test echo executor the vitest suite uses):
 *
 *   McpChatCompleter ──dispatch──▶ McpExecServer (real McpServer / real WebSocket)
 *                                        ▲  await_turn / submit_exec_result (real wire protocol)
 *                                        │
 *                          agentalk-mcp-client `llm-agent.mjs`  (REAL CLI, real McpClient,
 *                                        │                       real executor-runtime + node-pty)
 *                                        ▼
 *                          fake persistent bridge  ← stands in for the LLM provider, so NO
 *                                                     provider CLI is launched and NO budget is spent.
 *
 * Everything except the LLM itself is real: the socket, the JSON-RPC framing, the contract handshake
 * (hash-gate UNSET per D4, so the client's v5 hash is accepted), the await_turn long-poll, the
 * exec_rpc turn shape, the executor-runtime persistent bridge protocol, and the submit_exec_result
 * round-trip. The fake bridge replaces only the provider command (via AGENTTALK_PERSISTENT_COMMAND_JSON,
 * the same hook the client's own exec-rpc.test.ts uses) and echoes a fixed sentinel.
 *
 * Usage:  node scripts/smoke-mcp-exec-server.mjs
 *   env AGENTALK_MCP_CLIENT_DIR — path to the agentalk-mcp-client checkout
 *                                 (default: /Users/fausto/Software/agentalk-mcp-client)
 *
 * Exit 0 on success, 1 on failure (with diagnostics). Stand-alone like the other live gates
 * (test-mcp-gate.mjs, m07-*-live-smoke.mjs) — intentionally NOT part of the vitest suite, since it
 * spawns an external CLI from a separate repo.
 */
import { McpExecServer } from '../packages/mcp-exec-server/dist/index.js';
import { McpChatCompleter } from '../packages/llm-client/dist/index.js';
import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';

const CLIENT_DIR = process.env.AGENTALK_MCP_CLIENT_DIR || '/Users/fausto/Software/agentalk-mcp-client';
const AGENT_ID = 'smoke-1';
const SENTINEL = 'live-smoke-ok';
const EXPECTED_USAGE = { prompt_tokens: 10, completion_tokens: 20 };

let server = null;
let child = null;
let tmpDir = null;

function cleanup() {
  // Kill the child BEFORE closing the server, so its McpClient reconnect/backoff never fires.
  if (child) { try { child.kill('SIGKILL'); } catch { /* noop */ } child = null; }
  if (tmpDir) { try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* noop */ } tmpDir = null; }
}

async function run() {
  console.log('— Live smoke: real agentalk-mcp-client CLI ⇄ McpExecServer —\n');

  // 1) Stand up the real exec server on an ephemeral port (hash-gate unset = any exec client attaches).
  server = new McpExecServer({ pingIntervalMs: 60_000 });
  const port = await server.start(0);
  console.log(`[smoke] McpExecServer listening on ws://localhost:${port}/`);

  // 2) Write a fake persistent bridge (CommonJS in an out-of-package temp dir so `require` works).
  //    It speaks the executor-runtime's line-JSON bridge protocol: one {type:'result',...} per input line.
  tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agenttalk-exec-smoke-'));
  const bridgePath = path.join(tmpDir, 'fake-persistent-bridge.js');
  writeFileSync(bridgePath, [
    "const readline = require('readline');",
    "const rl = readline.createInterface({ input: process.stdin, output: process.stdout });",
    "rl.on('line', () => {",
    `  console.log(JSON.stringify({ type: 'result', result: '${SENTINEL}', usage: { input_tokens: ${EXPECTED_USAGE.prompt_tokens}, output_tokens: ${EXPECTED_USAGE.completion_tokens} } }));`,
    '});',
  ].join('\n'), 'utf8');

  // 3) Spawn the REAL CLI, pointed at our server, with the provider command overridden by the bridge.
  const agentScript = path.join(CLIENT_DIR, 'llm-agent.mjs');
  console.log(`[smoke] spawning real CLI: ${agentScript} (provider=gemini, persistent, no LLM)`);
  child = spawn(
    process.execPath,
    [agentScript, '--provider', 'gemini', '--execution-mode', 'persistent', '--agentId', AGENT_ID],
    {
      cwd: CLIENT_DIR,
      env: {
        ...process.env,
        AGENTTALK_PERSISTENT_MCP_URL: `ws://localhost:${port}/`,
        AGENTTALK_PERSISTENT_COMMAND_JSON: JSON.stringify({ command: process.execPath, args: [bridgePath] }),
      },
      stdio: ['ignore', 'inherit', 'inherit'], // surface the CLI's own logs for diagnostics
    },
  );
  child.on('exit', (code, sig) => {
    if (code !== null && code !== 0 && !sig) console.error(`[smoke] CLI exited early with code ${code}`);
  });

  // 4) Drive one chat turn through the transport. The queue buffers the dispatch until the CLI's
  //    await_turn pulls it, so there is no connect race; onResult is subscribed before dispatch.
  const completer = new McpChatCompleter(server.transport(AGENT_ID), { defaultTimeoutMs: 30_000 });
  console.log("[smoke] McpChatCompleter.complete('ping') …");
  const result = await completer.complete('ping');

  // 5) Assert the round-trip carried the bridge's text + mapped usage.
  console.log('[smoke] got result:', JSON.stringify(result));
  const okText = result.text === SENTINEL;
  const okUsage = JSON.stringify(result.usage) === JSON.stringify(EXPECTED_USAGE);
  if (!okText) throw new Error(`text mismatch: expected '${SENTINEL}', got '${result.text}'`);
  if (!okUsage) throw new Error(`usage mismatch: expected ${JSON.stringify(EXPECTED_USAGE)}, got ${JSON.stringify(result.usage)}`);

  console.log('\n✅ LIVE SMOKE PASSED — real CLI completed a turn through McpExecServer over a real socket.');
}

run()
  .then(async () => {
    cleanup();
    if (server) await server.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('\n❌ LIVE SMOKE FAILED:', err?.message || err);
    cleanup();
    if (server) { try { await server.close(); } catch { /* noop */ } }
    process.exit(1);
  });
