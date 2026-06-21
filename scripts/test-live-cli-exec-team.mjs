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
  console.log('Starting live CLI exec-RPC consensus smoke test...');

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
  console.log(`[Server] MCP server on ws://localhost:${port}/`);

  await registry.createAgent('planner-a', { provider: 'cli-exec', providerName: 'gemini' });
  await registry.createAgent('planner-b', { provider: 'cli-exec', providerName: 'gemini' });
  await registry.createAgent('worker-1', { provider: 'cli-exec', providerName: 'gemini' });
  
  await registry.activateAgent('planner-a');
  await registry.activateAgent('planner-b');
  await registry.activateAgent('worker-1');

  const llmAgentPath = path.join(__dirname, '../../agentalk-mcp-client/llm-agent.mjs');

  const harnessA = spawn('node', [llmAgentPath, '--agentId', 'planner-a', '--provider', 'gemini', '--execution-mode', 'persistent'],
    { env: { ...process.env, AGENTTALK_PERSISTENT_MCP: 'true', AGENTTALK_PERSISTENT_MCP_URL: `ws://localhost:${port}/` }, stdio: ['ignore', 'pipe', 'pipe'] });
  harnessA.stdout.on('data', d => process.stdout.write(`[llm-agent-a] ${d}`));
  harnessA.stderr.on('data', d => process.stderr.write(`[llm-agent-a-err] ${d}`));

  const harnessB = spawn('node', [llmAgentPath, '--agentId', 'planner-b', '--provider', 'gemini', '--execution-mode', 'persistent'],
    { env: { ...process.env, AGENTTALK_PERSISTENT_MCP: 'true', AGENTTALK_PERSISTENT_MCP_URL: `ws://localhost:${port}/` }, stdio: ['ignore', 'pipe', 'pipe'] });
  harnessB.stdout.on('data', d => process.stdout.write(`[llm-agent-b] ${d}`));
  harnessB.stderr.on('data', d => process.stderr.write(`[llm-agent-b-err] ${d}`));

  const harnessC = spawn('node', [llmAgentPath, '--agentId', 'worker-1', '--provider', 'gemini', '--execution-mode', 'persistent'],
    { env: { ...process.env, AGENTTALK_PERSISTENT_MCP: 'true', AGENTTALK_PERSISTENT_MCP_URL: `ws://localhost:${port}/` }, stdio: ['ignore', 'pipe', 'pipe'] });
  harnessC.stdout.on('data', d => process.stdout.write(`[llm-agent-w] ${d}`));
  harnessC.stderr.on('data', d => process.stderr.write(`[llm-agent-w-err] ${d}`));

  await new Promise(r => setTimeout(r, 2500)); // wait for attach

  console.log('[Test] Creating team...');
  const team = await registry.createTeam([
    { agentId: 'planner-a', role: 'planner' },
    { agentId: 'planner-b', role: 'planner' },
    { agentId: 'worker-1', role: 'worker' }
  ]);

  console.log('[Test] Starting team...');
  await registry.assignTeamTask(team.id, 'Let us build a plan. Please immediately agree on adding a file named plan.md with content "hello" and submit the plan. Make sure your submitted plan contains the exact text "add plan.md".');

  // Monitor events
  let planSubmitted = false;
  let workCompleted = false;
  let capturedTaskId = null;
  registry.on('team_task', (task) => {
    if (task.status === 'awaiting_confirmation') {
      planSubmitted = true;
      capturedTaskId = task.id;
    } else if (task.status === 'completed') {
      workCompleted = true;
    }
  });

  // Wait for submit_plan
  for (let i = 0; i < 1200 && !planSubmitted; i++) {
    await new Promise(r => setTimeout(r, 1000));
  }

  if (planSubmitted && capturedTaskId) {
    console.log('[Test] Plan submitted. Confirming plan...');
    registry.confirmTeamPlan(capturedTaskId);
    
    // Wait for worker to complete
    for (let i = 0; i < 1200 && !workCompleted; i++) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  try { harnessA.kill('SIGKILL'); } catch {}
  try { harnessB.kill('SIGKILL'); } catch {}
  try { harnessC.kill('SIGKILL'); } catch {}
  await mcpServer.close();

  if (workCompleted) {
    console.log('TEST PASSED: CLI-exec Consensus E2E reached submit_plan and worker completed task');
    process.exit(0);
  } else {
    console.error('TEST FAILED: Did not reach work completion');
    process.exit(1);
  }
}

run().catch((e) => { console.error('TEST ERROR', e); process.exit(1); });
