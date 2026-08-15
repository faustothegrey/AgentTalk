// T3b-2.5 — Live agy worker turn via exec-RPC.
// One real mcp worker is driven a `team_work_assign`; the orchestrator
// provisions a per-task git worktree, routes the worker prompt through exec_rpc
// to the externally-launched agy harness, agy makes a small real change inside
// the worktree, and we record the round-trip + the resulting diff.
import { Registry } from '../packages/runtime-core/dist/registry/registry.js';
import { AGENTTALK_MCP_TOOLS } from '../packages/runtime-core/dist/registry/mcp-tools.js';
import { McpServer } from '../apps/orchestrator/dist/mcp-server.js';
import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const wireContract = JSON.parse(fs.readFileSync(path.join(repoRoot, 'packages/contracts/wire-contract.json'), 'utf8'));

const taskId = `t3b2live-${Date.now()}`;
const worktreePath = `/tmp/agentalk-task-${taskId}`;
const logPath = path.join(repoRoot, `m07-t3b2-live-worker.log`);
const log = (line) => { const s = `${new Date().toISOString()} ${line}\n`; process.stdout.write(s); fs.appendFileSync(logPath, s); };

async function run() {
  fs.writeFileSync(logPath, '');
  log(`[Test] T3b-2.5 live agy worker turn — taskId=${taskId}`);

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
  log(`[Server] MCP server on ws://localhost:${port}/`);

  await registry.createAgent('mcp-worker-1', { provider: 'mcp', providerName: 'gemini' });
  await registry.activateAgent('mcp-worker-1');

  const llmAgentPath = path.join(repoRoot, '../agentalk-mcp-client/llm-agent.mjs');
  const harness = spawn('node', [llmAgentPath, '--agentId', 'mcp-worker-1', '--provider', 'gemini', '--execution-mode', 'persistent'],
    { env: { ...process.env, AGENTTALK_PERSISTENT_MCP: 'true', AGENTTALK_PERSISTENT_MCP_URL: `ws://localhost:${port}/` }, stdio: ['ignore', 'pipe', 'pipe'] });
  harness.stdout.on('data', d => log(`[llm-agent] ${String(d).trimEnd()}`));
  harness.stderr.on('data', d => log(`[llm-agent-err] ${String(d).trimEnd()}`));

  await new Promise(r => setTimeout(r, 2000)); // wait for attach

  // The worker turn completes when agy returns its exec-RPC reply (exec_result).
  // We do NOT require submit_work_result: that needs a *delegated* team task (the
  // full consensus flow), which is out of T3b-2.5 scope and covered deterministically
  // by T3b-2.4/T2.3. The bar here is: exec-RPC round-trip + a real change in a worktree.
  let execText = null;
  registry.on('exec_result', (r) => {
    if (r.agentId === 'mcp-worker-1') { execText = r.text; log(`[Test] exec_result (raw agy reply): ${JSON.stringify(r.text)?.slice(0, 800)}`); }
  });
  registry.on('mcp_tool_call', (call) => {
    if (call.agentId === 'mcp-worker-1' && (call.name === 'submit_work_result' || call.name === 'submit_work_response')) {
      log(`[Test] ${call.name}: ${JSON.stringify(call.args)?.slice(0, 600)}`);
    }
  });

  log(`[Test] Sending team_work_assign to mcp-worker-1 (taskId=${taskId}) ...`);
  await registry.sendProtocol('mcp-worker-1', 'EVT', {
    type: 'team_work_assign',
    teamId: 'live-team',
    taskId,
    role: 'worker',
    description: `Create a file named WORKER_PROOF.txt whose only content is the exact line: agy-was-here-${taskId}`,
    plan: `Plan: create a single new file WORKER_PROOF.txt containing exactly "agy-was-here-${taskId}". No other changes. This is the whole task.`,
  });

  // Wait up to 10 minutes for agy's reply (real agentic work + timeout headroom).
  for (let i = 0; i < 600 && execText === null; i++) {
    await new Promise(r => setTimeout(r, 1000));
  }
  // Grace for the filesystem write to settle.
  await new Promise(r => setTimeout(r, 1500));

  // RECORD the evidence BEFORE any cleanup. agy may nest its own worktree inside the
  // orchestrator-provided one, so search the whole subtree for the proof file.
  let proofPath = null;
  let proofContent = null;
  let gitState = '(worktree root not found)';
  if (fs.existsSync(worktreePath)) {
    try {
      const found = execSync(`find ${worktreePath} -name WORKER_PROOF.txt`).toString().trim().split('\n').filter(Boolean);
      if (found.length) { proofPath = found[0]; proofContent = fs.readFileSync(proofPath, 'utf8'); }
    } catch (e) { log(`[Test] find error: ${e.message}`); }
    try { gitState = execSync('git status --porcelain', { cwd: worktreePath }).toString().trim() || '(clean)'; } catch (e) { gitState = `(git error: ${e.message})`; }
  }
  const expected = `agy-was-here-${taskId}`;
  log(`[Test] worktree root: ${worktreePath}`);
  log(`[Test] worktree git status: ${gitState}`);
  log(`[Test] proof file: ${proofPath ?? '(not found)'}`);
  log(`[Test] proof content: ${proofContent === null ? '(absent)' : JSON.stringify(proofContent)}`);
  log(`[Test] expected substring present: ${proofContent != null && proofContent.includes(expected)}`);

  try { harness.kill('SIGKILL'); } catch {}
  await mcpServer.close();

  const realChange = proofContent != null && proofContent.includes(expected);
  const pass = execText != null && realChange;

  // Best-effort cleanup AFTER recording: remove every worktree under our task root
  // (orchestrator's + any agy nested inside it) and delete exactly the branches those
  // worktrees were on — parsed from the porcelain blocks, never a guessed name list.
  try {
    const blocks = execSync('git worktree list --porcelain', { cwd: repoRoot }).toString().split('\n\n');
    const branchesToDelete = [];
    for (const block of blocks) {
      const pathLine = block.split('\n').find(l => l.startsWith('worktree '));
      if (!pathLine || !pathLine.includes(`agentalk-task-${taskId}`)) continue;
      const p = pathLine.slice('worktree '.length).trim();
      const branchLine = block.split('\n').find(l => l.startsWith('branch '));
      if (branchLine) branchesToDelete.push(branchLine.slice('branch refs/heads/'.length).trim());
      try { execSync(`git worktree remove --force ${p}`, { cwd: repoRoot, stdio: 'ignore' }); } catch {}
    }
    execSync('git worktree prune', { cwd: repoRoot, stdio: 'ignore' });
    for (const b of branchesToDelete) { try { execSync(`git branch -D ${b}`, { cwd: repoRoot, stdio: 'ignore' }); } catch {} }
  } catch {}

  if (pass) {
    log(`TEST PASSED: live agy worker drove exec-RPC and made the expected real change inside a worktree.`);
    process.exit(0);
  } else {
    log(`TEST FAILED: execReply=${execText != null} realChange=${realChange}`);
    process.exit(1);
  }
}

run().catch((e) => { log(`TEST ERROR ${e?.stack || e}`); process.exit(1); });
