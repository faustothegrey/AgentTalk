// M07-T3b-1.6 — LIVE correctness of no-resend through the real driver path.
// Drives a cli-exec agent via message_received (the !currentConversation path that T3b-1
// flattens), captures the exec-RPC prompt sent each turn, and confirms: (a) prompts stay
// flat (latest-turn only — no prior facts), (b) real agy still recalls earlier facts from
// native --continue memory. Reuses the T3-S2 fact-chain, but through the driver this time.

import { Registry } from '../packages/runtime-core/dist/registry/registry.js';
import { AGENTTALK_MCP_TOOLS } from '../packages/runtime-core/dist/registry/mcp-tools.js';
import { McpServer } from '../apps/orchestrator/dist/mcp-server.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wireContract = JSON.parse(fs.readFileSync(path.join(__dirname, '../packages/contracts/wire-contract.json'), 'utf8'));
const AGENT_ID = 'cli-planner-1';
const FACTS = [['A', 'apple'], ['B', 'bridge'], ['C', 'cloud'], ['D', 'dragon']];

const out = [];
const rec = (...a) => { const s = a.join(' '); console.log(s); out.push(s); };

async function main() {
  rec('=== T3b-1.6 live no-resend through the driver ===');
  const adapter = { spawn() {}, sendText() {}, onData() {}, onExit() {}, kill() {} };
  const registry = new Registry(adapter, { readinessTimeoutMs: 5000 });

  const sentPrompts = [];
  const origHandle = registry.handleMcpToolCall.bind(registry);
  registry.handleMcpToolCall = async (id, name, args) => {
    const res = await origHandle(id, name, args);
    if (name === 'await_turn' && res?.content?.[0]?.text) {
      try { const t = JSON.parse(res.content[0].text); if (t.type === 'exec_rpc') sentPrompts.push(t.prompt); } catch {}
    }
    return res;
  };
  const replies = [];
  registry.on('mcp_tool_call', (c) => { if (c.agentId === AGENT_ID && c.name === 'send_to_agent') replies.push(c.args.payload); });

  const mcpServer = new McpServer({
    tools: AGENTTALK_MCP_TOOLS, expectedContractHash: wireContract.hash,
    handler: (id, n, a) => registry.handleMcpToolCall(id, n, a),
    onConnect: (id) => registry.handleMcpConnect(id),
    onDisconnect: (id) => registry.handleMcpDisconnect(id),
  });
  const port = await mcpServer.start(0);
  await registry.createAgent(AGENT_ID, { provider: 'cli-exec', providerName: 'gemini' });
  await registry.activateAgent(AGENT_ID);

  const llmAgentPath = path.join(__dirname, '../../agentalk-mcp-client/llm-agent.mjs');
  const harness = spawn('node', [llmAgentPath, '--agentId', AGENT_ID, '--provider', 'gemini', '--execution-mode', 'persistent'],
    { env: { ...process.env, AGENTTALK_PERSISTENT_MCP: 'true', AGENTTALK_PERSISTENT_MCP_URL: `ws://localhost:${port}/` }, stdio: ['ignore', 'pipe', 'pipe'] });
  harness.stderr.on('data', d => process.stderr.write(`[h:err] ${d}`));
  await new Promise(r => setTimeout(r, 2500));

  async function turn(payload) {
    const before = replies.length;
    await registry.sendProtocol(AGENT_ID, 'EVT', { type: 'message_received', from: 'user', payload });
    for (let i = 0; i < 90 && replies.length === before; i++) await new Promise(r => setTimeout(r, 1000));
    if (replies.length === before) throw new Error(`no reply for: ${payload}`);
    return replies[replies.length - 1];
  }

  for (const [k, v] of FACTS) { const r = await turn(`Remember that ${k} = ${v}. Reply only: OK`); rec(`plant ${k}=${v} -> ${JSON.stringify(r.trim())}`); }
  const final = await turn(`List the values for A,B,C,D in order, comma-separated. Reply with ONLY the list.`);
  rec(`recall -> ${JSON.stringify(final.trim())}`);

  const promptSizes = sentPrompts.map(p => p.length);
  const recalledAll = ['apple', 'bridge', 'cloud', 'dragon'].every(x => final.toLowerCase().includes(x));
  // no prior fact leaked into a later prompt (native memory carried it, not resend) — the real no-resend proof
  const noLeak = sentPrompts.slice(1).every((p, i) => !FACTS.slice(0, i + 1).some(([, v]) => p.includes(v)));
  // baseline-relative: a resend would accumulate every prior prompt; assert the last prompt is far below that
  const resendBaseline = promptSizes.slice(0, -1).reduce((a, b) => a + b, 0);
  const noGrowth = promptSizes[promptSizes.length - 1] < resendBaseline * 0.6;

  rec('\n=== RESULTS ===');
  rec(`exec-RPC prompt sizes per turn: ${promptSizes.join(', ')}`);
  rec(`no earlier fact appears in later prompts (no resend)? ${noLeak ? 'YES ✅' : 'NO ❌'}`);
  rec(`last prompt (${promptSizes[promptSizes.length-1]}B) << resend baseline (${resendBaseline}B)? ${noGrowth ? 'YES ✅' : 'NO ❌'}`);
  rec(`final recalled all 4 facts via native memory? ${recalledAll ? 'YES ✅' : 'NO ❌ ('+JSON.stringify(final)+')'}`);
  rec(`\nVERDICT: ${recalledAll && noLeak && noGrowth ? 'PROVEN ✅ — no-resend correct on native memory through the driver' : 'NOT proven ❌'}`);

  try { harness.kill('SIGKILL'); } catch {}
  await mcpServer.close(); await registry.destroy();
  fs.writeFileSync(path.join(__dirname, '../m07-t3b1-noresend-live.log'), out.join('\n') + '\n');
  process.exit(0);
}
main().catch(e => { console.error('PROBE ERROR', e); process.exit(1); });
