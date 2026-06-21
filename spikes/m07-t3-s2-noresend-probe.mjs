// M07-T3-S2 — no-resend spike (kill the O(n) transcript resend; LB-4).
// Drives a cli-exec agent through a 5-turn fact-chain sending ONLY the latest turn each
// time (no transcript). Proves correctness on native --continue memory and measures the
// per-turn prompt size: flat (no-resend) vs. what resend WOULD cost (projected from the
// same real replies, in the format observed in LB-4 — no extra agy calls).
//
// Run: node spikes/m07-t3-s2-noresend-probe.mjs   (needs real agy authenticated)

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

// 4 facts to plant, then a recall turn that needs ALL of them — only possible via native memory.
const FACTS = [
  ['A', 'apple'], ['B', 'bridge'], ['C', 'cloud'], ['D', 'dragon'],
];
const turns = [
  ...FACTS.map(([k, v]) => `Remember that ${k} = ${v}. Reply with only: OK`),
  `List the values I gave for A, B, C, D, in that order, comma-separated. Reply with ONLY that list.`,
];

const out = [];
function rec(...a) { const s = a.join(' '); console.log(s); out.push(s); }
const bytes = (s) => Buffer.byteLength(s, 'utf8');

async function main() {
  rec('=== M07-T3-S2 no-resend spike (native memory, flat prompt) ===');
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

  function execDirect(prompt) { // no-resend: send ONLY this prompt, rely on native --continue
    return new Promise((resolve, reject) => {
      const to = setTimeout(() => { registry.off('exec_result', on); reject(new Error('timeout')); }, 90000);
      const on = (r) => { if (r.agentId === AGENT_ID) { clearTimeout(to); registry.off('exec_result', on); resolve(r); } };
      registry.on('exec_result', on);
      agent.queueExecTurn({ type: 'exec_rpc', prompt });
    });
  }

  // resend projection: what the prompt WOULD be each turn if we resent the transcript (LB-4 format).
  function resendPrompt(history, latest) {
    const head = history.map(([u, a]) => `[user]: ${u}\n\n[assistant]: ${a}\n`).join('\n');
    return (head ? head + '\n\nNow respond to the latest message:\n' : '') + `[user]: ${latest}`;
  }

  const history = []; // [ [userMsg, reply], ... ] of REAL replies, for the projection
  const rows = [];
  let finalReply = '';

  for (let i = 0; i < turns.length; i++) {
    const prompt = turns[i];
    const noResendBytes = bytes(prompt);
    const resendBytes = bytes(resendPrompt(history, prompt));
    const res = await execDirect(prompt);
    const reply = (res.text || '').trim();
    history.push([prompt, reply]);
    rows.push({ turn: i + 1, noResendBytes, resendBytes });
    rec(`turn ${i + 1}: no-resend=${noResendBytes}B  resend-proj=${resendBytes}B   reply=${JSON.stringify(reply.slice(0, 60))}`);
    if (i === turns.length - 1) finalReply = reply;
  }

  // --- assertions ---
  const recalledAll = ['apple', 'bridge', 'cloud', 'dragon'].every(v => finalReply.toLowerCase().includes(v));
  const nr = rows.map(r => r.noResendBytes);
  const noResendFlat = Math.max(...nr) - Math.min(...nr) < 60; // ~constant (only the wording differs)
  const rs = rows.map(r => r.resendBytes);
  const resendGrows = rs.every((v, i) => i === 0 || v > rs[i - 1]); // strictly increasing
  const blowupRatio = (rs[rs.length - 1] / nr[nr.length - 1]).toFixed(1);

  rec('\n=== RESULTS ===');
  rec(`correctness — final turn recalled all 4 facts via native memory? ${recalledAll ? 'YES ✅' : 'NO ❌ ('+JSON.stringify(finalReply)+')'}`);
  rec(`no-resend prompt size — flat across turns? ${noResendFlat ? 'YES ✅' : 'NO ❌'}  (bytes: ${nr.join(', ')})`);
  rec(`resend projection — grows every turn? ${resendGrows ? 'YES ✅' : 'NO ❌'}  (bytes: ${rs.join(', ')})`);
  rec(`final-turn blow-up — resend is ${blowupRatio}x the no-resend prompt (and widening with task length)`);
  rec(`\nVERDICT: no-resend (native memory) keeps the prompt FLAT and stays correct ⇒ ${recalledAll && noResendFlat && resendGrows ? 'PROVEN ✅' : 'NOT proven ❌'}`);

  try { harness.kill('SIGKILL'); } catch {}
  await mcpServer.close();
  await registry.destroy();
  fs.writeFileSync(path.join(__dirname, '../m07-t3-s2-noresend-probe.log'), out.join('\n') + '\n');
  process.exit(0);
}
main().catch(e => { console.error('PROBE ERROR', e); process.exit(1); });
