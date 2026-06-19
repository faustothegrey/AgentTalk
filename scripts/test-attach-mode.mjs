// In-process attach-mode smoke test (no real CLI, no HTTP server).
// Verifies the attach turn-delivery path end to end:
//   register agent (spawn bypassed) → harness connects → await_turn delivers a queued turn
//   → harness (provider "dummy") returns a placeholder → send_to_agent → user_message.
//
// Run: node scripts/test-attach-mode.mjs   (requires `npm run build` first — uses dist)
import { Registry } from '../packages/runtime-core/dist/registry/registry.js';
import { AGENTTALK_MCP_TOOLS } from '../packages/runtime-core/dist/registry/mcp-tools.js';
import { McpServer } from '../apps/orchestrator/dist/mcp-server.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wireContract = JSON.parse(fs.readFileSync(path.join(__dirname, '../packages/contracts/wire-contract.json'), 'utf8'));

async function run() {
  process.env.AGENTTALK_ATTACH_MODE = 'true';
  console.log('Starting in-process attach-mode test...');

  // Minimal no-op ProcessAdapter — attach mode never spawns, so these are unused on the path.
  const adapter = { spawn() {}, sendText() {}, onData() {}, onExit() {}, kill() {} };
  const registry = new Registry(adapter, { readinessTimeoutMs: 5000 });

  const mcpServer = new McpServer({
    tools: AGENTTALK_MCP_TOOLS,
    expectedContractHash: wireContract.hash,
    handler: (agentId, name, args) => registry.handleMcpToolCall(agentId, name, args),
    onConnect: (agentId) => registry.handleMcpConnect(agentId),
    onDisconnect: (agentId) => registry.handleMcpDisconnect(agentId),
  });
  const port = await mcpServer.start(0);
  console.log(`MCP server on ws://localhost:${port}/`);

  const agentId = 'test-agent';
  await registry.createAgent(agentId);
  await registry.startAgent(agentId, 'attach://test'); // attach mode → spawn bypassed → ready

  let received = null;
  registry.on('user_message', (evt) => { received = evt.payload; console.log(`[Orchestrator] user_message: ${evt.payload}`); });

  const harness = spawn('npx', ['--no-install', 'attach-harness', '--agentId', agentId, '--provider', 'dummy'],
    { env: { ...process.env, AGENTTALK_PERSISTENT_MCP_URL: `ws://localhost:${port}/` }, stdio: ['ignore', 'pipe', 'pipe'] });
  harness.stdout.on('data', d => process.stdout.write(`[harness] ${d}`));
  harness.stderr.on('data', d => process.stderr.write(`[harness-err] ${d}`));

  await new Promise(r => setTimeout(r, 2500)); // let the harness connect + block on await_turn
  console.log('Injecting a turn...');
  await registry.sendProtocol(agentId, 'EVT', { type: 'message_received', from: 'user', payload: 'Hello from the attach test', messageId: 'msg-1' });

  // Wait for the round-trip (await_turn → dummy → send_to_agent → user_message)
  for (let i = 0; i < 50 && received === null; i++) await new Promise(r => setTimeout(r, 200));

  try { harness.kill('SIGKILL'); } catch {}
  await mcpServer.close();

  const ok = typeof received === 'string' && received.includes('does not support provider dummy');
  if (ok) { console.log('TEST PASSED'); process.exit(0); }
  console.error(`TEST FAILED — user_message was: ${JSON.stringify(received)}`);
  process.exit(1);
}

run().catch((e) => { console.error('TEST ERROR', e); process.exit(1); });
