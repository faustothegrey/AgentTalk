import { Registry } from '../packages/runtime-core/dist/registry/registry.js';
import { SessionRecorder } from '../packages/observability/dist/recordings/session-recorder.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createRegistryWithRecorder(fileName) {
  const filePath = path.join(__dirname, '../design/arbiter-shadow-corpus', fileName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  const recorder = new SessionRecorder(filePath);
  const adapter = { spawn() {}, sendText() {}, onData() {}, onExit() {}, kill() {} };
  const registry = new Registry(adapter, { readinessTimeoutMs: 5000 });
  
  registry.on('team_task', (task) => recorder.record('orchestrator', 'team_task_updated', task));
  registry.on('agent_spawned', (agent) => recorder.record('orchestrator', 'agent_spawned', agent));
  
  await registry.createAgent('planner-a', { provider: 'mcp', providerName: 'mock' });
  await registry.createAgent('planner-b', { provider: 'mcp', providerName: 'mock' });
  await registry.createAgent('worker-1', { provider: 'mcp', providerName: 'mock' });
  await registry.activateAgent('planner-a');
  await registry.activateAgent('planner-b');
  await registry.activateAgent('worker-1');
  
  const team = await registry.createTeam([
    { agentId: 'planner-a', role: 'planner' },
    { agentId: 'planner-b', role: 'planner' },
    { agentId: 'worker-1', role: 'worker' }
  ]);
  
  return { registry, team };
}

async function simulatePlannerCall(registry, agentId, payloadStr) {
  await registry.handleMcpToolCall(agentId, 'consensus_respond', { payload: payloadStr });
}

async function runLateMessage() {
  const { registry, team } = await createRegistryWithRecorder('failure-late-message.jsonl');
  await registry.assignTeamTask(team.id, 'Task');
  await simulatePlannerCall(registry, 'planner-a', JSON.stringify({ message_type: 'ack_planning_protocol', message_payload: { text: 'ok' } }));
  await simulatePlannerCall(registry, 'planner-b', JSON.stringify({ message_type: 'ack_planning_protocol', message_payload: { text: 'ok' } }));
  // Simulate out-of-turn message by calling it twice for A before B gets a turn
  await simulatePlannerCall(registry, 'planner-a', JSON.stringify({ message_type: 'fact_collection_end', message_payload: { summary: 'done' } }));
  await simulatePlannerCall(registry, 'planner-a', JSON.stringify({ message_type: 'fact_collection_end', message_payload: { summary: 'late message' } }));
}

async function main() {
  console.log('Generating late message failure...');
  await runLateMessage();
  console.log('Done.');
}
main().catch(console.error);
