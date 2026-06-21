// M07-T3-S1 — session-model spike (D2).
// Proves/refutes: does native `agy --continue` session survive across exec-RPC turns
// WITHOUT the orchestrator resending history? And does it survive a harness restart?
//
// Drives a real cli-exec agent through consecutive exec-RPC turns and records, per turn:
//   - the exact prompt the orchestrator sent to the harness (to check for resend)
//   - the raw reply text + usage
// Then kills + relaunches the harness to probe recovery.
//
// Run: node spikes/m07-t3-s1-session-probe.mjs   (needs real agy authenticated)

import { Registry } from '../packages/runtime-core/dist/registry/registry.js';
import { AGENTTALK_MCP_TOOLS } from '../packages/runtime-core/dist/registry/mcp-tools.js';
import { McpServer } from '../apps/orchestrator/dist/mcp-server.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wireContract = JSON.parse(fs.readFileSync(path.join(__dirname, '../packages/contracts/wire-contract.json'), 'utf8'));
const CODEWORD = 'BELIER-7731';
const AGENT_ID = 'cli-planner-1';

const log = [];
function rec(...a) { const line = a.join(' '); console.log(line); log.push(line); }

async function main() {
  rec('=== M07-T3-S1 session-model spike ===');

  const adapter = { spawn() {}, sendText() {}, onData() {}, onExit() {}, kill() {} };
  const registry = new Registry(adapter, { readinessTimeoutMs: 5000 });

  // --- capture what the orchestrator actually sends to the harness on each exec turn ---
  const sentPrompts = [];
  const origHandle = registry.handleMcpToolCall.bind(registry);
  registry.handleMcpToolCall = async (agentId, name, args) => {
    const res = await origHandle(agentId, name, args);
    if (name === 'await_turn' && res?.content?.[0]?.text) {
      try {
        const t = JSON.parse(res.content[0].text);
        if (t.type === 'exec_rpc') sentPrompts.push(t.prompt);
      } catch {}
    }
    return res;
  };

  // --- capture replies + usage ---
  const replies = [];
  const usages = [];
  registry.on('exec_result', (r) => { if (r.agentId === AGENT_ID) usages.push(r.usage); });
  registry.on('mcp_tool_call', (call) => {
    if (call.agentId === AGENT_ID && call.name === 'send_to_agent') replies.push(call.args.payload);
  });

  const mcpServer = new McpServer({
    tools: AGENTTALK_MCP_TOOLS,
    expectedContractHash: wireContract.hash,
    handler: (id, name, args) => registry.handleMcpToolCall(id, name, args),
    onConnect: (id) => registry.handleMcpConnect(id),
    onDisconnect: (id) => registry.handleMcpDisconnect(id),
  });
  const port = await mcpServer.start(0);
  rec(`[server] ws://localhost:${port}/`);

  await registry.createAgent(AGENT_ID, { provider: 'cli-exec', providerName: 'gemini' });
  await registry.activateAgent(AGENT_ID);

  const llmAgentPath = path.join(__dirname, '../../agentalk-mcp-client/llm-agent.mjs');
  function launchHarness(tag) {
    const h = spawn('node', [llmAgentPath, '--agentId', AGENT_ID, '--provider', 'gemini', '--execution-mode', 'persistent'],
      { env: { ...process.env, AGENTTALK_PERSISTENT_MCP: 'true', AGENTTALK_PERSISTENT_MCP_URL: `ws://localhost:${port}/` }, stdio: ['ignore', 'pipe', 'pipe'] });
    h.stdout.on('data', d => process.stdout.write(`[harness:${tag}] ${d}`));
    h.stderr.on('data', d => process.stderr.write(`[harness:${tag}:err] ${d}`));
    return h;
  }

  // send a user turn and wait for the next reply (up to 90s)
  async function turn(payload) {
    const before = replies.length;
    await registry.sendProtocol(AGENT_ID, 'EVT', { type: 'message_received', from: 'user', payload });
    for (let i = 0; i < 90 && replies.length === before; i++) await new Promise(r => setTimeout(r, 1000));
    if (replies.length === before) throw new Error(`no reply for: ${payload}`);
    return replies[replies.length - 1];
  }

  let harness = launchHarness('A');
  await new Promise(r => setTimeout(r, 2500)); // attach

  // ---- Q-S1a: no-resend continuity (same harness process) ----
  rec('\n--- TURN 1 (plant codeword) ---');
  const r1 = await turn(`Remember this codeword for later: ${CODEWORD}. Reply with only the word OK.`);
  rec('reply1:', JSON.stringify(r1));

  rec('\n--- TURN 2 (recall, no resend) ---');
  const r2 = await turn(`What was the codeword I told you earlier? Reply with ONLY the codeword.`);
  rec('reply2:', JSON.stringify(r2));

  const prompt2 = sentPrompts[1] || '';
  const recalled = r2.includes(CODEWORD);
  const promptHadCodeword = prompt2.includes(CODEWORD);
  rec(`\n[Q-S1a] turn-2 prompt contained the codeword? ${promptHadCodeword}  (sent prompt2 len=${prompt2.length})`);
  rec(`[Q-S1a] turn-2 reply recalled the codeword? ${recalled}`);
  rec(`[Q-S1a] VERDICT: native session continuity w/o resend = ${recalled && !promptHadCodeword ? 'PROVEN' : 'NOT proven'}`);

  // ---- Q-S1d: cost (usage) ----
  rec(`\n[Q-S1d] usage per turn: ${JSON.stringify(usages)}`);

  // ---- Q-S1c: recovery across harness restart ----
  rec('\n--- KILL harness A, relaunch as B (probe recovery) ---');
  try { harness.kill('SIGKILL'); } catch {}
  await new Promise(r => setTimeout(r, 1500));
  harness = launchHarness('B');
  await new Promise(r => setTimeout(r, 2500));

  let r3, recoveredErr = null;
  try { r3 = await turn(`What was the codeword I told you earlier? Reply with ONLY the codeword.`); }
  catch (e) { recoveredErr = e.message; }
  rec('reply3 (after restart):', JSON.stringify(r3 ?? `<none: ${recoveredErr}>`));
  const recovered = !!r3 && r3.includes(CODEWORD);
  rec(`[Q-S1c] recovered codeword after harness restart? ${recovered}`);

  try { harness.kill('SIGKILL'); } catch {}
  await mcpServer.close();
  await registry.destroy();

  rec('\n=== SUMMARY ===');
  rec(`Q-S1a no-resend continuity: ${recalled && !promptHadCodeword ? 'PROVEN ✅' : 'NOT proven ❌'}`);
  rec(`Q-S1c recovery after restart: ${recovered ? 'survives ✅' : 'does NOT survive ❌ (ephemeral home)'}`);
  rec(`Q-S1d usage surfaced by agy: ${JSON.stringify(usages)}`);

  fs.writeFileSync(path.join(__dirname, '../m07-t3-s1-session-probe.log'), log.join('\n') + '\n');
  process.exit(0);
}

main().catch(e => { console.error('PROBE ERROR', e); process.exit(1); });
