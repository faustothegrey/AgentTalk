import { Registry } from '../packages/runtime-core/dist/registry/registry.js';
import cp from 'child_process';
import fs from 'fs';
import path from 'path';

// Monkey-patch execSync and existsSync to prevent actual git worktree creation for worker
const originalExecSync = cp.execSync;
cp.execSync = (cmd, options) => {
  if (cmd.includes('git worktree add') || cmd.includes('git rev-parse')) {
    return Buffer.from('');
  }
  return originalExecSync(cmd, options);
};
const originalExistsSync = fs.existsSync;
fs.existsSync = (p) => {
  if (typeof p === 'string' && p.includes('task-')) return false;
  return originalExistsSync(p);
};

function stripVolatiles(jsonStr) {
  return jsonStr
    .replace(/"taskId":\s*"task-[^"]+"/g, '"taskId": "task-ID"')
    .replace(/"id":\s*"task-[^"]+"/g, '"id": "task-ID"')
    .replace(/"teamId":\s*"team-[^"]+"/g, '"teamId": "team-ID"')
    .replace(/"id":\s*"team-[^"]+"/g, '"id": "team-ID"')
    .replace(/"timestamp":\s*"[^"]+"/g, '"timestamp": "TIME"')
    .replace(/"createdAt":\s*"[^"]+"/g, '"createdAt": "TIME"')
    .replace(/"updatedAt":\s*"[^"]+"/g, '"updatedAt": "TIME"')
    .replace(/"messageId":\s*"msg-[^"]+"/g, '"messageId": "msg-ID"')
    .replace(/"replyToMessageId":\s*"msg-[^"]+"/g, '"replyToMessageId": "msg-ID"')
    .replace(/"atMs":\s*\d+/g, '"atMs": 0')
    .replace(/\\\/tmp\\\/agenttalk-[a-zA-Z0-9]+/g, '/tmp/agenttalk-DIR');
}

async function runScenario(scenarioName, mockResponseFn) {
  console.log(`Running scenario: ${scenarioName}`);
  const registry = new Registry();
  const capturedEvents = [];
  let lastTranscriptLen = 0;

  registry.on('team_task', (task) => {
    const newTranscript = task.transcript.slice(lastTranscriptLen).map(t => ({
      kind: t.kind,
      from: t.from,
      to: t.to,
      payload: typeof t.payload === 'string' ? t.payload : JSON.stringify(t.payload),
      messageType: t.messageType
    }));
    lastTranscriptLen = task.transcript.length;
    
    if (newTranscript.length > 0 || capturedEvents.length === 0 || capturedEvents[capturedEvents.length - 1].status !== task.status) {
      capturedEvents.push({
        event: 'team_task_update',
        status: task.status,
        planningComplete: task.planningComplete,
        plan: task.plan,
        newTranscript
      });
    }
  });

  registry.on('team_planning_phase', (evt) => {
    capturedEvents.push({ event: 'team_planning_phase', ...evt });
  });

  registry.on('team_protocol_event', (evt) => {
    capturedEvents.push({ event: 'team_protocol_event', ...evt });
  });

  const plannerA = await registry.createAgent('planner-a', { provider: 'mcp', providerName: 'gemini', model: 'planner-a' });
  const plannerB = await registry.createAgent('planner-b', { provider: 'mcp', providerName: 'gemini', model: 'planner-b' });
  const worker = await registry.createAgent('worker-1', { provider: 'mcp', providerName: 'gemini', model: 'worker-1' });

  await registry.activateAgent(plannerA.id);
  await registry.activateAgent(plannerB.id);
  await registry.activateAgent(worker.id);

  const team = registry.createTeam([
    { agentId: plannerA.id, role: 'planner' },
    { agentId: plannerB.id, role: 'planner' },
    { agentId: worker.id, role: 'worker' }
  ]);

  let isDone = false;
  let isFailure = false;

  const runHarness = async (agentId) => {
    while (!isDone && !isFailure) {
      try {
        const turnResult = await registry.handleMcpToolCall(agentId, 'await_turn', {});
        const content = JSON.parse(turnResult.content[0].text);
        if (content.type === 'exec_rpc') {
          const response = mockResponseFn(agentId, content.prompt);
          await registry.handleMcpToolCall(agentId, 'submit_exec_result', { text: response, usage: { prompt_tokens: 0, completion_tokens: 0 } });
        }
      } catch (e) {
        if (isDone || isFailure) break;
        await new Promise(r => setTimeout(r, 10));
      }
    }
  };

  runHarness('planner-a');
  runHarness('planner-b');
  runHarness('worker-1');

  await registry.assignTeamTask(team.id, 'Identity harness task');

  // Monitor task status
  let taskCompleted = false;
  for (let i = 0; i < 50; i++) {
    const task = registry.teamCoordinator.tasks.get(team.currentTaskId);
    if (task && (task.status === 'completed' || task.status === 'error' || task.status === 'awaiting_operator')) {
      taskCompleted = true;
      if (task.status === 'error' || task.status === 'awaiting_operator') isFailure = true;
      break;
    }
    if (task && task.status === 'awaiting_confirmation') {
      await registry.teamCoordinator.confirmPlan(task.id);
    }
    await new Promise(r => setTimeout(r, 100));
  }

  isDone = true;
  await registry.destroy();

  const finalOutput = stripVolatiles(JSON.stringify(capturedEvents, null, 2));
  return finalOutput;
}

const mockSuccess = (agentId, prompt) => {
  let result;
  if (prompt.includes('ack_planning_protocol')) {
    result = '{"message_type":"ack_planning_protocol","message_payload":{}}';
  } else if (prompt.includes('fact_collection_begin') || prompt.includes('PLANNER')) {
    if (prompt.includes('collect facts') || prompt.includes('fact_collection_begin')) {
      result = '{"message_type":"fact_collection_end","message_payload":{"summary":"facts"}}';
    }
  }
  if (!result && (prompt.includes('One planner must call submit_plan') || prompt.includes('advanced to "submit_plan"'))) {
    if (agentId === 'planner-a') {
      result = '{"message_type":"submit_plan","message_payload":{"plan":"1. implement this change in src/index.ts","proposal":"prop","text":"done"}}';
    } else {
      result = '';
    }
  }
  if (!result && agentId === 'planner-a') {
    result = '{"message_type":"agreement_proposal","message_payload":{"proposal":"prop","text":"I propose this","expected_response_types":["agreement_acceptance", "opinion"]}}';
  }
  if (!result && agentId === 'planner-b') {
    if (prompt.includes('agreement_proposal') || prompt.includes('proposes')) {
      result = '{"message_type":"agreement_acceptance","message_payload":{"proposal":"prop","text":"I accept","expected_response_types":["submit_plan"]}}';
    } else {
      result = '{"message_type":"opinion","message_payload":{"text":"I think yes","proposal":null,"expected_response_types":["agreement_proposal"]}}';
    }
  }
  if (!result && agentId === 'worker-1') {
    result = '{"message_type":"work_accept","message_payload":{"text":"I accept the work"}}';
  }
  if (!result) {
    result = '{"message_type":"opinion","message_payload":{"text":"catch-all","proposal":null,"expected_response_types":["agreement_proposal"]}}';
  }
  
  if (agentId === 'planner-a' && result && result.includes('opinion') && prompt.includes('Reply limit reached')) {
    console.log('--- ERROR: planner-a returning opinion after Reply limit reached ---');
    console.log('Prompt:', prompt);
  }
  
  if (agentId === 'planner-a' || agentId === 'planner-b') {
    console.log(`[mockSuccess] ${agentId} returning: ${result}`);
  }

  return result;
};

let failCount = 0;
const mockFailure = (agentId, prompt) => {
  if (prompt.includes('ack_planning_protocol')) {
    return '{"message_type":"ack_planning_protocol","message_payload":{}}';
  }
  if (prompt.includes('fact_collection_begin') || prompt.includes('PLANNER')) {
    if (prompt.includes('collect facts') || prompt.includes('fact_collection_begin')) {
      return '{"message_type":"fact_collection_end","message_payload":{"summary":"facts"}}';
    }
  }
  if (agentId === 'planner-b') {
    failCount++;
    return '{"message_type":"submit_plan","message_payload":{"plan":"fail plan","proposal":"fail","text":"fail"}}';
  }
  return '{"message_type":"opinion","message_payload":{"text":"normal talk","proposal":null,"expected_response_types":["agreement_proposal"]}}';
};

async function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes('--check');

  const successStream = await runScenario('Success', mockSuccess);
  const failureStream = await runScenario('Failure (Eject)', mockFailure);

  const outDir = path.join(process.cwd(), 'scripts', 'm14-identity-baselines');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const successPath = path.join(outDir, 'success-stream.json');
  const failurePath = path.join(outDir, 'failure-stream.json');

  if (isCheck) {
    const existingSuccess = fs.existsSync(successPath) ? fs.readFileSync(successPath, 'utf8') : '';
    const existingFailure = fs.existsSync(failurePath) ? fs.readFileSync(failurePath, 'utf8') : '';

    if (existingSuccess !== successStream) {
      console.error('Success stream mismatch!');
      process.exit(1);
    }
    if (existingFailure !== failureStream) {
      console.error('Failure stream mismatch!');
      process.exit(1);
    }
    console.log('Baselines match. Identity verified.');
    process.exit(0);
  } else {
    fs.writeFileSync(successPath, successStream, 'utf8');
    fs.writeFileSync(failurePath, failureStream, 'utf8');
    console.log(`Baselines written to ${outDir}`);
    process.exit(0);
  }
}

main().catch(console.error);
