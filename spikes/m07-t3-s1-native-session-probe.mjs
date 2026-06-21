// M07-T3-S1 (probe 2) — isolate NATIVE session capability.
// Probe 1 showed the driver resends full history, so it can't tell us whether agy's
// native `--continue` session works. This probe bypasses the driver and pushes exec_rpc
// directly to the agent's execQueue with MINIMAL prompts (no transcript), so turn 2 can
// only succeed via the CLI's native session — the decisive test for D2 option 2.

import { Registry } from '../packages/runtime-core/dist/registry/registry.js';
import { AGENTTALK_MCP_TOOLS } from '../packages/runtime-core/dist/registry/mcp-tools.js';
import { McpServer } from '../apps/orchestrator/dist/mcp-server.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wireContract = JSON.parse(fs.readFileSync(path.join(__dirname, '../packages/contracts/wire-contract.json'), 'utf8'));
const CODEWORD = 'NIMBUS-4209';
const AGENT_ID = 'cli-planner-1';

async function main() {
  console.log('=== M07-T3-S1 probe 2: native session capability (no resend) ===');
  const adapter = { spawn() {}, sendText() {}, onData() {}, onExit() {}, kill() {} };
  const registry = new Registry(adapter, { readinessTimeoutMs: 5000 });

  const mcpServer = new McpServer({
    tools: AGENTTALK_MCP_TOOLS,
    expectedContractHash: wireContract.hash,
    handler: (id, name, args) => registry.handleMcpToolCall(id, name, args),
    onConnect: (id) => registry.handleMcpConnect(id),
    onDisconnect: (id) => registry.handleMcpDisconnect(id),
  });
  const port = await mcpServer.start(0);

  const agent = await registry.createAgent(AGENT_ID, { provider: 'cli-exec', providerName: 'gemini' });
  await registry.activateAgent(AGENT_ID);

  const llmAgentPath = path.join(__dirname, '../../agentalk-mcp-client/llm-agent.mjs');
  const harness = spawn('node', [llmAgentPath, '--agentId', AGENT_ID, '--provider', 'gemini', '--execution-mode', 'persistent'],
    { env: { ...process.env, AGENTTALK_PERSISTENT_MCP: 'true', AGENTTALK_PERSISTENT_MCP_URL: `ws://localhost:${port}/` }, stdio: ['ignore', 'pipe', 'pipe'] });
  harness.stderr.on('data', d => process.stderr.write(`[h:err] ${d}`));
  await new Promise(r => setTimeout(r, 2500));

  // push exec_rpc DIRECTLY (bypass driver → no history resend) and await the raw result
  function execDirect(prompt) {
    return new Promise((resolve, reject) => {
      const to = setTimeout(() => { registry.off('exec_result', on); reject(new Error('timeout')); }, 90000);
      const on = (r) => { if (r.agentId === AGENT_ID) { clearTimeout(to); registry.off('exec_result', on); resolve(r); } };
      registry.on('exec_result', on);
      agent.queueExecTurn({ type: 'exec_rpc', prompt });
    });
  }

  console.log(`\n--- exec 1: plant "${CODEWORD}" (minimal prompt) ---`);
  const e1 = await execDirect(`Remember this codeword: ${CODEWORD}. Reply with only: OK`);
  console.log('exec1 text:', JSON.stringify(e1.text), 'usage:', JSON.stringify(e1.usage));

  console.log('\n--- exec 2: recall, MINIMAL prompt (no transcript, no codeword) ---');
  const e2 = await execDirect(`What codeword did I just give you? Reply with ONLY the codeword.`);
  console.log('exec2 text:', JSON.stringify(e2.text));

  const nativeWorks = e2.text.includes(CODEWORD);
  console.log(`\n[Q-S1a isolated] exec-2 prompt contained codeword? ${'What codeword did I just give you? Reply with ONLY the codeword.'.includes(CODEWORD)}`);
  console.log(`[Q-S1a isolated] native --continue session recalled it? ${nativeWorks}`);
  console.log(`\n=== RESULT: native CLI session through exec-RPC = ${nativeWorks ? 'WORKS ✅ (option 2 viable)' : 'does NOT persist ❌'} ===`);

  try { harness.kill('SIGKILL'); } catch {}
  await mcpServer.close();
  await registry.destroy();
  process.exit(0);
}
main().catch(e => { console.error('PROBE2 ERROR', e); process.exit(1); });
