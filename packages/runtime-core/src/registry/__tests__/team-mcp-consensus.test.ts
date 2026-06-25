import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from '../registry.js';

// HERMETICITY (FIND-T4a-2 / B4): the real `handleTeamWorkAssign` provisions a git
// worktree via `execSync('git worktree add …')` for mcp agents. Without these
// mocks this test creates real worktrees + `task-task-*` branches on every run.
// Mirror the mcp-agent.test.ts pattern: stub execSync + existsSync. See [[LB-9]].
vi.mock('child_process', () => ({
  default: { execSync: vi.fn() },
  execSync: vi.fn(),
}));

vi.mock('fs', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
  };
});

describe('Team MCP-exec Consensus (mocked)', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await registry.destroy();
  });

  it('runs a full planner-planner-worker flow to completion via mocked mcp harness', async () => {
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

    let planSubmitted = false;
    let workCompleted = false;
    let capturedTaskId: string | undefined;

    registry.on('team_task', (task) => {
      if (task.status === 'awaiting_confirmation') {
        planSubmitted = true;
        capturedTaskId = task.id;
      } else if (task.status === 'completed') {
        workCompleted = true;
      }
    });

    // Mock harness loop for each agent
    let isDone = false;

    const mockResponseFn = (agentId: string, prompt: string) => {
      if (prompt.includes('ack_planning_protocol')) {
        return '{"message_type":"ack_planning_protocol","message_payload":{}}';
      }
      if (prompt.includes('fact_collection_begin') || prompt.includes('PLANNER')) {
        if (prompt.includes('collect facts') || prompt.includes('fact_collection_begin')) {
          return '{"message_type":"fact_collection_end","message_payload":{"summary":"facts"}}';
        }
      }
      if (prompt.includes('WORKER_RESPONSE_INSTRUCTIONS') || prompt.includes('WORKER')) {
        return '{"message_type":"work_accept","message_payload":{"text":"work completed"}}';
      }
      if (prompt.includes('One planner must call submit_plan') || prompt.includes('must call submit_plan')) {
        if (agentId === 'planner-a') {
          return '{"message_type":"submit_plan","message_payload":{"plan":"I will implement a change in src/app.ts","proposal":"prop","text":"done"}}';
        } else {
          // planner-b just acknowledges or sends an opinion
          return '{"message_type":"opinion","message_payload":{"text":"Waiting for planner-a to submit","proposal":null,"expected_response_types":[]}}';
        }
      }
      if (agentId === 'planner-a') {
        return '{"message_type":"agreement_proposal","message_payload":{"proposal":"prop","text":"I propose this","expected_response_types":["agreement_acceptance", "opinion"]}}';
      }
      if (agentId === 'planner-b') {
        if (prompt.includes('agreement_proposal') || prompt.includes('proposes')) {
          return '{"message_type":"agreement_acceptance","message_payload":{"proposal":"prop","text":"I accept","expected_response_types":["submit_plan"]}}';
        }
        return '{"message_type":"opinion","message_payload":{"text":"I think yes","proposal":null,"expected_response_types":["agreement_proposal"]}}';
      }
      return '{"message_type":"opinion","message_payload":{"text":"catch-all","proposal":null,"expected_response_types":["agreement_proposal"]}}';
    };

    const runHarness = async (agentId: string) => {
      while (!isDone) {
        try {
          const turnResult = await registry.handleMcpToolCall(agentId, 'await_turn', {});
          const content = JSON.parse(turnResult.content[0].text);
          if (content.type === 'exec_rpc') {
            const response = mockResponseFn(agentId, content.prompt);
            await registry.handleMcpToolCall(agentId, 'submit_exec_result', { text: response, usage: { prompt_tokens: 0, completion_tokens: 0 } });
          }
        } catch (e) {
          if (isDone) break;
          // Small sleep to avoid tight loop on errors
          await new Promise(r => setTimeout(r, 10));
        }
      }
    };

    void runHarness('planner-a');
    void runHarness('planner-b');
    void runHarness('worker-1');

    await registry.assignTeamTask(team.id, 'Make a plan');

    // Wait for plan
    for (let i = 0; i < 40 && !planSubmitted; i++) {
      await new Promise(r => setTimeout(r, 100));
    }
    expect(planSubmitted).toBe(true);

    // Confirm plan
    await registry.confirmTeamPlan(capturedTaskId!);

    // Wait for worker
    for (let i = 0; i < 40 && !workCompleted; i++) {
      await new Promise(r => setTimeout(r, 100));
    }
    expect(workCompleted).toBe(true);

    isDone = true;
    
    // We let afterEach (registry.destroy) forcibly resolve await_turn if it's blocking
    
    // Do not await the promises here because they might be hanging on await_turn until registry.destroy() is called in afterEach.
  });
});
