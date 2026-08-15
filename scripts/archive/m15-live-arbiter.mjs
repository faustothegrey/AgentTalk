import { Registry } from '../packages/runtime-core/dist/registry/registry.js';
import { AGENTTALK_MCP_TOOLS } from '../packages/runtime-core/dist/registry/mcp-tools.js';
import { McpServer } from '../apps/orchestrator/dist/mcp-server.js';
import { SessionRecorder } from '../packages/observability/dist/recordings/session-recorder.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wireContract = JSON.parse(fs.readFileSync(path.join(__dirname, '../packages/contracts/wire-contract.json'), 'utf8'));
const recordingPath = process.env.AGENTTALK_RECORDING_PATH ?? path.join(__dirname, '../design/m15-t3-live-arbiter.ndjson');

async function startDiagramRecording() {
  const enabled = Boolean(process.env.AGENTTALK_DIAGRAM_RECORD);
  const baseUrl = (process.env.DIAGRAMTALK_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  if (!enabled) {
    return { enabled, baseUrl, id: undefined, unavailable: false };
  }

  try {
    const res = await fetch(`${baseUrl}/api/diagram/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'startRecording',
        input: { name: 'M15-T3 live arbiter proof' },
      }),
    });
    if (!res.ok) {
      return { enabled, baseUrl, id: undefined, unavailable: true };
    }
    const data = await res.json();
    return {
      enabled,
      baseUrl,
      id: data?.command?.result?.recordingId,
      unavailable: false,
    };
  } catch {
    return { enabled, baseUrl, id: undefined, unavailable: true };
  }
}

async function endDiagramRecording(recording) {
  if (!recording?.enabled || !recording.id) return;
  await fetch(`${recording.baseUrl}/api/diagram/commands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'endRecording',
      input: { id: recording.id },
    }),
  }).catch(() => undefined);
}

async function run() {
  console.log('Starting live MCP arbiter mode smoke test...');
  process.env.AGENTTALK_DIAGRAM_RECORD = process.env.AGENTTALK_DIAGRAM_RECORD || '1';
  console.log(`[Test] AGENTTALK_DIAGRAM_RECORD=${process.env.AGENTTALK_DIAGRAM_RECORD}`);
  console.log(`[Test] Runtime recording path: ${recordingPath}`);

  if (!process.env.OPENROUTER_API_KEY) {
    console.warn('WARNING: OPENROUTER_API_KEY is missing. Judge and Synthesis may fail if mocked.');
  }

  const diagramRecording = await startDiagramRecording();
  if (diagramRecording.id) {
    console.log(`[Test] DiagramTalk recording id: ${diagramRecording.id}`);
  } else if (diagramRecording.unavailable) {
    console.log(`[Test] DiagramTalk recording requested at ${diagramRecording.baseUrl}, but the endpoint was unavailable.`);
  }

  const recorder = new SessionRecorder(recordingPath);
  const adapter = { spawn() {}, sendText() {}, onData() {}, onExit() {}, kill() {} };
  const registry = new Registry(adapter, { readinessTimeoutMs: 5000 });
  for (const event of ['team', 'team_task', 'mcp_tool_call', 'exec_result', 'arbiter_event', 'status']) {
    registry.on(event, (payload) => recorder.record('runtime', event, payload));
  }

  const mcpServer = new McpServer({
    tools: AGENTTALK_MCP_TOOLS,
    expectedContractHash: wireContract.hash,
    handler: (agentId, name, args) => registry.handleMcpToolCall(agentId, name, args),
    onConnect: (agentId) => registry.handleMcpConnect(agentId),
    onDisconnect: (agentId) => registry.handleMcpDisconnect(agentId),
  });
  const port = await mcpServer.start(0);
  console.log(`[Server] MCP server on ws://localhost:${port}/`);

  await registry.createAgent('planner-a', { provider: 'mcp', providerName: 'gemini' });
  await registry.createAgent('planner-b', { provider: 'mcp', providerName: 'gemini' });
  await registry.createAgent('worker-1', { provider: 'mcp', providerName: 'gemini' });

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
  ], undefined, 'arbiter');

  console.log('[Test] Starting team in arbiter mode...');

  await registry.assignTeamTask(team.id, 'Please quickly agree to write a python hello world script. You have a very limited turn budget. Just say "I agree to the python hello world" and nothing else.', 2);

  // Monitor events
  let planSubmitted = false;
  let workCompleted = false;
  let workRefused = false;
  let capturedTaskId = null;
  registry.on('team_task', (task) => {
    if (task.status === 'awaiting_confirmation') {
      planSubmitted = true;
      capturedTaskId = task.id;
    } else if (task.status === 'completed') {
      workCompleted = true;
    } else if (task.status === 'refused') {
      workRefused = true;
    }
  });

  // Wait for submit_plan
  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 1000));
    if (planSubmitted) break;
  }

  if (planSubmitted && capturedTaskId) {
    console.log('[Test] Plan submitted/synthesized by Arbiter. Confirming plan...');
    const taskDetails = registry.arbiterCoordinator.getTask(capturedTaskId);
    console.log('[Test] Candidate Plan:\n', taskDetails?.plan);

    await registry.confirmTeamPlan(capturedTaskId);

    // Wait for worker to complete or refuse
    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 1000));
      if (workCompleted || workRefused) break;
    }

    if (workCompleted) {
      console.log('TEST PASSED: Arbiter Consensus E2E reached awaiting_confirmation and worker completed task');
    } else if (workRefused) {
      console.log('TEST PASSED: Arbiter Consensus E2E reached awaiting_confirmation and worker refused task (honest blocker)');
    } else {
      console.error('TEST FAILED: Worker did not complete or refuse in time');
      process.exit(1);
    }
    const updatedTask = registry.arbiterCoordinator.getTask(capturedTaskId);
    console.log(`[Test] Arbiter Judge Usage:`, updatedTask.arbiterJudgeUsage);
    console.log(`[Test] Arbiter Synthesis Usage:`, updatedTask.arbiterSynthesisUsage);
  } else {
    console.error('TEST FAILED: Arbiter did not synthesize plan');
    process.exit(1);
  }

  try { harnessA.kill('SIGKILL'); } catch {}
  try { harnessB.kill('SIGKILL'); } catch {}
  try { harnessC.kill('SIGKILL'); } catch {}
  await endDiagramRecording(diagramRecording);
  await recorder.close();
  await mcpServer.close();
  process.exit(0);
}

run().catch((e) => { console.error('TEST ERROR', e); process.exit(1); });
