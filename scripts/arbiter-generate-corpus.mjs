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

// Scenarios

async function runSuccess(fileName) {
  const { registry, team } = await createRegistryWithRecorder(fileName);
  await registry.assignTeamTask(team.id, 'Collaborative planning task: Create a plan');
  
  await simulatePlannerCall(registry, 'planner-a', JSON.stringify({ message_type: 'ack_planning_protocol', message_payload: { text: 'ok' } }));
  await simulatePlannerCall(registry, 'planner-b', JSON.stringify({ message_type: 'ack_planning_protocol', message_payload: { text: 'ok' } }));
  
  await simulatePlannerCall(registry, 'planner-a', JSON.stringify({ message_type: 'fact_collection_end', message_payload: { summary: 'done' } }));
  await simulatePlannerCall(registry, 'planner-b', JSON.stringify({ message_type: 'fact_collection_end', message_payload: { summary: 'done' } }));
  
  await simulatePlannerCall(registry, 'planner-a', JSON.stringify({ message_type: 'agreement_proposal', message_payload: { text: 'Plan X', proposal: 'Plan X', expected_response_types: ['agreement_acceptance', 'agreement_proposal'] } }));
  await simulatePlannerCall(registry, 'planner-b', JSON.stringify({ message_type: 'agreement_acceptance', message_payload: { text: 'I agree', proposal: 'Plan X', expected_response_types: ['submit_plan'] } }));
  
  await simulatePlannerCall(registry, 'planner-a', JSON.stringify({ message_type: 'submit_plan', message_payload: { plan: '1. Update src', text: 'Plan submitted', proposal: 'Plan X' } }));
}

async function runPhaseIllegal() {
  const { registry, team } = await createRegistryWithRecorder('failure-phase-illegal.jsonl');
  await registry.assignTeamTask(team.id, 'Task');
  await simulatePlannerCall(registry, 'planner-a', JSON.stringify({ message_type: 'ack_planning_protocol', message_payload: { text: 'ok' } }));
  await simulatePlannerCall(registry, 'planner-b', JSON.stringify({ message_type: 'ack_planning_protocol', message_payload: { text: 'ok' } }));
  // Illegal: proposer tries to submit plan during fact collection
  await simulatePlannerCall(registry, 'planner-a', JSON.stringify({ message_type: 'submit_plan', message_payload: { plan: '1. Update', text: 'skip', proposal: 'X' } }));
}

async function runMalformed() {
  const { registry, team } = await createRegistryWithRecorder('failure-malformed.jsonl');
  await registry.assignTeamTask(team.id, 'Task');
  await simulatePlannerCall(registry, 'planner-a', JSON.stringify({ message_type: 'ack_planning_protocol', message_payload: { text: 'ok' } }));
  await simulatePlannerCall(registry, 'planner-b', JSON.stringify({ message_type: 'ack_planning_protocol', message_payload: { text: 'ok' } }));
  // Malformed: missing payload fields
  await simulatePlannerCall(registry, 'planner-a', JSON.stringify({ message_type: 'fact_collection_end', message_payload: {} }));
}

async function runBoundedCorrection() {
  const { registry, team } = await createRegistryWithRecorder('failure-bounded-correction.jsonl');
  await registry.assignTeamTask(team.id, 'Task');
  await simulatePlannerCall(registry, 'planner-a', JSON.stringify({ message_type: 'ack_planning_protocol', message_payload: { text: 'ok' } }));
  await simulatePlannerCall(registry, 'planner-b', JSON.stringify({ message_type: 'ack_planning_protocol', message_payload: { text: 'ok' } }));
  for (let i = 0; i < 5; i++) {
    await simulatePlannerCall(registry, 'planner-a', JSON.stringify({ message_type: 'fact_collection_end', message_payload: {} }));
  }
}

async function runNonConverging() {
  const { registry, team } = await createRegistryWithRecorder('failure-non-converging.jsonl');
  await registry.assignTeamTask(team.id, 'Task');
  await simulatePlannerCall(registry, 'planner-a', JSON.stringify({ message_type: 'ack_planning_protocol', message_payload: { text: 'ok' } }));
  await simulatePlannerCall(registry, 'planner-b', JSON.stringify({ message_type: 'ack_planning_protocol', message_payload: { text: 'ok' } }));
  await simulatePlannerCall(registry, 'planner-a', JSON.stringify({ message_type: 'fact_collection_end', message_payload: { summary: 'x' } }));
  await simulatePlannerCall(registry, 'planner-b', JSON.stringify({ message_type: 'fact_collection_end', message_payload: { summary: 'y' } }));
  // Loop proposals back and forth without agreement
  for (let i = 0; i < 15; i++) {
    await simulatePlannerCall(registry, 'planner-a', JSON.stringify({ message_type: 'agreement_proposal', message_payload: { text: 'A', proposal: 'A', expected_response_types: ['agreement_acceptance'] } }));
    await simulatePlannerCall(registry, 'planner-b', JSON.stringify({ message_type: 'agreement_proposal', message_payload: { text: 'B', proposal: 'B', expected_response_types: ['agreement_acceptance'] } }));
  }
}

async function runAmbiguous(fileName) {
  const { registry, team } = await createRegistryWithRecorder(fileName);
  await registry.assignTeamTask(team.id, 'Task');
  await simulatePlannerCall(registry, 'planner-a', JSON.stringify({ message_type: 'ack_planning_protocol', message_payload: { text: 'ok' } }));
  await simulatePlannerCall(registry, 'planner-b', JSON.stringify({ message_type: 'ack_planning_protocol', message_payload: { text: 'ok' } }));
  await simulatePlannerCall(registry, 'planner-a', JSON.stringify({ message_type: 'fact_collection_end', message_payload: { summary: 'done' } }));
  await simulatePlannerCall(registry, 'planner-b', JSON.stringify({ message_type: 'fact_collection_end', message_payload: { summary: 'done' } }));
  await simulatePlannerCall(registry, 'planner-a', JSON.stringify({ message_type: 'agreement_proposal', message_payload: { text: 'Plan', proposal: 'Plan', expected_response_types: ['agreement_acceptance'] } }));
  await simulatePlannerCall(registry, 'planner-b', JSON.stringify({ message_type: 'agreement_proposal', message_payload: { text: 'Plan modified', proposal: 'Plan', expected_response_types: ['agreement_acceptance'] } }));
  // Ambiguous: agreement reached but for slightly different text?
  await simulatePlannerCall(registry, 'planner-a', JSON.stringify({ message_type: 'agreement_acceptance', message_payload: { text: 'ok', proposal: 'Plan', expected_response_types: ['submit_plan'] } }));
  // Ambiguous state...
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
  await runAmbiguous('ambiguous-1.jsonl');
  await runAmbiguous('ambiguous-2.jsonl');
  console.log('Done.');
}

main().catch(console.error);
