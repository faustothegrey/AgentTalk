import { Registry } from '../packages/runtime-core/dist/registry/registry.js';
import { SessionRecorder } from '../packages/observability/dist/recordings/session-recorder.js';
import { startServer } from '../apps/orchestrator/dist/server.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const outDir = path.join(__dirname, '../design/arbiter-shadow-corpus');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const samplePath = path.join(outDir, 'sample-success.jsonl');
  if (fs.existsSync(samplePath)) fs.rmSync(samplePath);

  const recorder = new SessionRecorder(samplePath);
  const registry = new Registry({ readinessTimeoutMs: 1000 });
  
  // startServer hooks the registry events to recorder
  startServer(registry, 0, { recorder });

  console.log('Generating synthetic sample via registry API...');

  await registry.createAgent('planner-a', { provider: 'mcp', providerName: 'gemini' });
  await registry.createAgent('planner-b', { provider: 'mcp', providerName: 'gemini' });
  await registry.createAgent('worker-1', { provider: 'mcp', providerName: 'gemini' });

  await registry.activateAgent('planner-a');
  await registry.activateAgent('planner-b');
  await registry.activateAgent('worker-1');

  registry.handleMcpConnect('planner-a');
  registry.handleMcpConnect('planner-b');
  registry.handleMcpConnect('worker-1');

  const team = registry.createTeam([
    { agentId: 'planner-a', role: 'planner' },
    { agentId: 'planner-b', role: 'planner' },
    { agentId: 'worker-1', role: 'worker' }
  ]);

  const task = await registry.assignTeamTask(team.id, 'Create a plan');

  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  
  await registry.handleMcpToolCall('planner-a', 'consensus_respond', { action: 'ack_planning_protocol', payload: {} });
  await delay(100);
  await registry.handleMcpToolCall('planner-b', 'consensus_respond', { action: 'ack_planning_protocol', payload: {} });
  await delay(100);

  await registry.handleMcpToolCall('planner-a', 'consensus_respond', { action: 'fact_collection_end', payload: { summary: 'done' } });
  await delay(100);
  await registry.handleMcpToolCall('planner-b', 'consensus_respond', { action: 'fact_collection_end', payload: { summary: 'done' } });
  await delay(100);

  await registry.handleMcpToolCall('planner-a', 'consensus_respond', { action: 'opinion', payload: { message: 'We should plan' } });
  await delay(100);
  await registry.handleMcpToolCall('planner-b', 'consensus_respond', { action: 'agreement_proposal', payload: { proposal: 'Plan X' } });
  await delay(100);
  await registry.handleMcpToolCall('planner-a', 'consensus_respond', { action: 'agreement_acceptance', payload: { proposal: 'Plan X', reason: 'ok' } });
  await delay(100);
  await registry.handleMcpToolCall('planner-b', 'consensus_respond', { action: 'submit_plan', payload: { plan: '1. Update `src/index.js` to add a new feature.', proposal: 'Plan X', text: 'Submitting the plan' } });
  await delay(100);

  await registry.confirmTeamPlan(task.id);
  await delay(100);

  await registry.handleMcpToolCall('worker-1', 'send_to_agent', { to: 'user', payload: 'Done' });
  await delay(100);

  await recorder.close();
  console.log(`Saved sample recording to ${samplePath}`);
  
  process.exit(0);
}

run().catch(console.error);
