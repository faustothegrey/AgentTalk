import { Registry } from '../packages/runtime-core/dist/registry/registry.js';
import { SessionRecorder } from '../packages/observability/dist/recordings/session-recorder.js';
import { startServer } from '../apps/orchestrator/dist/server.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const delay = (ms) => new Promise(r => setTimeout(r, ms));

const VALID_PLAN_TEXT = '1. Update src/index.js to add a new feature.';

async function createRegistryWithRecorder(fileName) {
  const filePath = path.join(__dirname, '../design/arbiter-shadow-corpus', fileName);
  if (fs.existsSync(filePath)) fs.rmSync(filePath);
  
  const recorder = new SessionRecorder(filePath);
  const registry = new Registry({ readinessTimeoutMs: 1000 });
  const server = startServer(registry, 0, { recorder });
  
  await registry.createAgent('planner-a', { provider: 'mcp', providerName: 'mock' });
  await registry.createAgent('planner-b', { provider: 'mcp', providerName: 'mock' });
  await registry.createAgent('worker-1', { provider: 'mcp', providerName: 'mock' });
  
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
  
  return { registry, team, recorder, server };
}

async function simulateCall(registry, agentId, action, payload = {}) {
  try {
    await registry.handleMcpToolCall(agentId, 'consensus_respond', { action, payload });
  } catch (e) {
    console.error(`Error simulating call for ${agentId}:`, e);
  }
  await delay(200);
}

async function runSuccess(fileName) {
  const { registry, team, recorder, server } = await createRegistryWithRecorder(fileName);
  await registry.assignTeamTask(team.id, 'Collaborative planning task');
  await delay(100);
  
  await simulateCall(registry, 'planner-a', 'ack_planning_protocol');
  await simulateCall(registry, 'planner-b', 'ack_planning_protocol');
  
  await simulateCall(registry, 'planner-a', 'fact_collection_end', { summary: 'done' });
  await simulateCall(registry, 'planner-b', 'fact_collection_end', { summary: 'done' });
  
  await simulateCall(registry, 'planner-a', 'agreement_proposal', { proposal: 'Plan X' });
  await simulateCall(registry, 'planner-b', 'agreement_acceptance', { proposal: 'Plan X', reason: 'ok' });
  
  await simulateCall(registry, 'planner-a', 'submit_plan', { plan: VALID_PLAN_TEXT, proposal: 'Plan X', text: 'Submitting' });
  
  await delay(500);
  await recorder.close();
  server.close();
}

async function runPhaseIllegal() {
  const { registry, team, recorder, server } = await createRegistryWithRecorder('failure-phase-illegal.jsonl');
  await registry.assignTeamTask(team.id, 'Task');
  await delay(100);
  
  await simulateCall(registry, 'planner-a', 'ack_planning_protocol');
  await simulateCall(registry, 'planner-b', 'ack_planning_protocol');

  await simulateCall(registry, 'planner-a', 'fact_collection_end', { summary: 'done' });
  await simulateCall(registry, 'planner-b', 'fact_collection_end', { summary: 'done' });

  // Illegal: submit plan during discussion
  await simulateCall(registry, 'planner-a', 'submit_plan', { plan: VALID_PLAN_TEXT, text: 'skip', proposal: 'X' });

  await delay(500);
  await recorder.close();
  server.close();
}

async function runMalformed() {
  const { registry, team, recorder, server } = await createRegistryWithRecorder('failure-malformed.jsonl');
  await registry.assignTeamTask(team.id, 'Task');
  await delay(100);
  
  await simulateCall(registry, 'planner-a', 'ack_planning_protocol');
  await simulateCall(registry, 'planner-b', 'ack_planning_protocol');
  
  await simulateCall(registry, 'planner-a', 'fact_collection_end', { summary: 'done' });
  await simulateCall(registry, 'planner-b', 'fact_collection_end', { summary: 'done' });
  
  await simulateCall(registry, 'planner-a', 'agreement_proposal', { proposal: 'Plan X' });
  await simulateCall(registry, 'planner-b', 'agreement_acceptance', { proposal: 'Plan X', reason: 'ok' });
  
  // Malformed: submit plan missing required fields
  await simulateCall(registry, 'planner-a', 'submit_plan', { text: 'no plan field' });
  
  await delay(500);
  await recorder.close();
  server.close();
}

async function runBoundedCorrection() {
  const { registry, team, recorder, server } = await createRegistryWithRecorder('failure-bounded-correction.jsonl');
  await registry.assignTeamTask(team.id, 'Task');
  await delay(100);
  
  await simulateCall(registry, 'planner-a', 'ack_planning_protocol');
  await simulateCall(registry, 'planner-b', 'ack_planning_protocol');

  await simulateCall(registry, 'planner-a', 'fact_collection_end', { summary: 'done' });
  await simulateCall(registry, 'planner-b', 'fact_collection_end', { summary: 'done' });
  
  for (let i = 0; i < 5; i++) {
    await simulateCall(registry, 'planner-a', 'submit_plan', { plan: VALID_PLAN_TEXT, text: 'wrong phase', proposal: 'Plan X' });
  }
  
  await delay(500);
  await recorder.close();
  server.close();
}

async function runNonConverging() {
  const { registry, team, recorder, server } = await createRegistryWithRecorder('failure-non-converging.jsonl');
  await registry.assignTeamTask(team.id, 'Task');
  await delay(100);
  
  await simulateCall(registry, 'planner-a', 'ack_planning_protocol');
  await simulateCall(registry, 'planner-b', 'ack_planning_protocol');
  
  await simulateCall(registry, 'planner-a', 'fact_collection_end', { summary: 'x' });
  await simulateCall(registry, 'planner-b', 'fact_collection_end', { summary: 'y' });
  
  for (let i = 0; i < 15; i++) {
    await simulateCall(registry, 'planner-a', 'opinion', { message: 'A' });
    await simulateCall(registry, 'planner-b', 'opinion', { message: 'B' });
  }
  
  await delay(500);
  await recorder.close();
  server.close();
}

async function runLateMessage() {
  const { registry, team, recorder, server } = await createRegistryWithRecorder('failure-late-message.jsonl');
  await registry.assignTeamTask(team.id, 'Task');
  await delay(100);
  
  await simulateCall(registry, 'planner-a', 'ack_planning_protocol');
  await simulateCall(registry, 'planner-b', 'ack_planning_protocol');
  
  // Simulate out-of-turn message by calling it twice for A
  await simulateCall(registry, 'planner-a', 'fact_collection_end', { summary: 'done' });
  await simulateCall(registry, 'planner-a', 'fact_collection_end', { summary: 'late message' });
  
  await delay(500);
  await recorder.close();
  server.close();
}

async function runAmbiguous(fileName, flip) {
  const { registry, team, recorder, server } = await createRegistryWithRecorder(fileName);
  await registry.assignTeamTask(team.id, 'Task');
  await delay(100);
  
  await simulateCall(registry, 'planner-a', 'ack_planning_protocol');
  await simulateCall(registry, 'planner-b', 'ack_planning_protocol');
  
  await simulateCall(registry, 'planner-a', 'fact_collection_end', { summary: 'done' });
  await simulateCall(registry, 'planner-b', 'fact_collection_end', { summary: 'done' });
  
  if (flip) {
    await simulateCall(registry, 'planner-a', 'agreement_proposal', { proposal: 'Plan' });
    await simulateCall(registry, 'planner-b', 'opinion', { message: 'I prefer Plan modified' });
    await simulateCall(registry, 'planner-a', 'agreement_acceptance', { proposal: 'Plan', reason: 'ok' });
  } else {
    await simulateCall(registry, 'planner-b', 'agreement_proposal', { proposal: 'Plan' });
    await simulateCall(registry, 'planner-a', 'opinion', { message: 'I prefer Plan modified' });
    await simulateCall(registry, 'planner-b', 'agreement_acceptance', { proposal: 'Plan', reason: 'ok' });
  }
  
  await delay(500);
  await recorder.close();
  server.close();
}

async function main() {
  console.log('Generating deterministic corpus entries...');
  await runSuccess('deterministic-success-1.jsonl');
  await runSuccess('deterministic-success-2.jsonl');
  await runSuccess('deterministic-success-3.jsonl');
  await runSuccess('deterministic-success-4.jsonl');
  
  await runPhaseIllegal();
  await runMalformed();
  await runBoundedCorrection();
  await runNonConverging();
  await runLateMessage();
  await runAmbiguous('ambiguous-1.jsonl', false);
  await runAmbiguous('ambiguous-2.jsonl', true);
  console.log('Done.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
