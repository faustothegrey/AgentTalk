import { Registry } from '../packages/runtime-core/dist/registry/registry.js';


async function run() {
  console.log('Starting in-process multi-agent API E2E test...');

  if (!process.env.GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY environment variable is missing.');
    process.exit(1);
  }

  const adapter = { spawn() {}, sendText() {}, onData() {}, onExit() {}, kill() {} };
  const registry = new Registry(adapter, { readinessTimeoutMs: 5000 });

  const plannerA = await registry.createAgent('planner-a', { provider: 'api', providerName: 'google', model: 'gemini-2.5-flash' });
  const plannerB = await registry.createAgent('planner-b', { provider: 'api', providerName: 'google', model: 'gemini-2.5-flash' });
  const worker = await registry.createAgent('worker-1', { provider: 'api', providerName: 'google', model: 'gemini-2.5-flash' });

  await registry.activateAgent(plannerA.id);
  await registry.activateAgent(plannerB.id);
  await registry.activateAgent(worker.id);

  console.log('[Test] Creating team...');
  const team = await registry.createTeam([
    { agentId: plannerA.id, role: 'planner' },
    { agentId: plannerB.id, role: 'planner' },
    { agentId: worker.id, role: 'worker' }
  ]);

  console.log('[Test] Starting team...');
  await registry.assignTeamTask(team.id, 'Let us build a plan. Please immediately agree on adding a file named plan.md with content "hello" and submit the plan. Make sure your submitted plan contains the exact text "add plan.md" and "implement" to pass validations.');

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

  if (workCompleted) {
    console.log('TEST PASSED: Consensus E2E reached submit_plan and worker completed task');
    process.exit(0);
  } else {
    console.error('TEST FAILED: Did not reach work completion');
    process.exit(1);
  }
}

run().catch((e) => { console.error('TEST ERROR', e); process.exit(1); });
