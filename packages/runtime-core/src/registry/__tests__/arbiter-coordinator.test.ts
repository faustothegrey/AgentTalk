import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from '../registry.js';
import { Agent } from '../../agents/agent.js';
import { InProcessAgentDriver } from '../../agents/in-process-driver.js';
import { WORKTREE_CONTEXT } from '../../agents/response-schema.js';
import type { Completer } from '@agenttalk/llm-client';
import { callApi } from '@agenttalk/llm-client/api-client.js';

/**
 * BL-063: render a coordinator-emitted `team_work_assign` through the REAL driver and return the
 * worker prompt. The payload must come FROM the coordinator — the duplication is appended
 * upstream, so a bar that hands the driver a hand-written plan cannot see it.
 */
const renderWorkerPrompt = async (workAssignPayload: unknown): Promise<string> => {
  const workerAgent = new Agent('worker-driven');
  const driverRegistry = {
    handleMcpToolCall: vi.fn().mockResolvedValue({}),
    pauseTaskForOperator: vi.fn().mockResolvedValue(undefined),
  } as unknown as Registry;

  // The completer is injected rather than a fetchFn: this file mocks `callApi`, so the real
  // ApiCompleter would never reach a fake fetch. This captures the prompt the driver builds.
  const complete = vi.fn().mockResolvedValue({
    text: '{"message_type":"work_accept","message_payload":{"text":"done"}}',
  });

  const driver = new InProcessAgentDriver(workerAgent, driverRegistry, {
    completer: { complete } as unknown as Completer,
  });
  driver.start();
  workerAgent.queueTurn(workAssignPayload as never);
  await new Promise((r) => setTimeout(r, 50));
  driver.stop();

  return String(complete.mock.calls[0]?.[0] ?? '');
};

vi.mock('@agenttalk/llm-client/api-client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@agenttalk/llm-client/api-client.js')>();
  return {
    ...actual,
    callApi: vi.fn(),
  };
});

vi.mock('child_process', () => ({
  default: { execSync: vi.fn() },
  execSync: vi.fn(),
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
  };
});

describe('ArbiterCoordinator', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  afterEach(async () => {
    await registry.destroy();
  });

  it('BL-063: an arbiter-confirmed plan reaches the worker with the worktree context exactly once', async () => {
    const plannerA = await registry.createAgent('planner-a', { provider: 'mcp', providerName: 'mock', model: 'planner-a' });
    const plannerB = await registry.createAgent('planner-b', { provider: 'mcp', providerName: 'mock', model: 'planner-b' });
    const worker = await registry.createAgent('worker-1', { provider: 'mcp', providerName: 'mock', model: 'worker-1' });

    await registry.activateAgent(plannerA.id);
    await registry.activateAgent(plannerB.id);
    await registry.activateAgent(worker.id);

    const team = registry.createTeam([
      { agentId: plannerA.id, role: 'planner' },
      { agentId: plannerB.id, role: 'planner' },
      { agentId: worker.id, role: 'worker' },
    ], undefined, 'arbiter');

    const task = await registry.assignTeamTask(team.id, 'Ship the arbiter feature');

    // Reaching confirmation organically needs the LLM judge to converge; the delegation payload is
    // what's under test, so the pre-delegation state is staged directly.
    const plan = '1. Touch the arbiter path.\n2. Confirm the worker payload.';
    task.plan = plan;
    task.status = 'awaiting_confirmation';

    const sendProtocol = vi.spyOn(registry, 'sendProtocol');
    await registry.confirmTeamPlan(task.id);

    const workAssign = sendProtocol.mock.calls.find(
      (c) => c[0] === worker.id && (c[2] as { type?: string })?.type === 'team_work_assign',
    );
    expect(workAssign).toBeDefined();

    // The plan payload is the plan, and nothing but the plan.
    expect((workAssign![2] as { plan: string }).plan).toBe(plan);

    // BL-063: the arbiter is the SECOND copy of this defect and the reason the obvious fix (delete
    // only the driver's append) is wrong — it would leave this path duplicating. Nothing in the
    // suite covered it: with the arbiter's append restored, all 328 tests still passed.
    const prompt = await renderWorkerPrompt(workAssign![2]);
    expect(prompt).toContain(WORKTREE_CONTEXT);
    expect(prompt.split(WORKTREE_CONTEXT).length - 1).toBe(1);
  });

  it('defaults to protocol mode and uses TeamCoordinator', async () => {
    const plannerA = await registry.createAgent('planner-a', { provider: 'mcp', providerName: 'mock', model: 'planner-a' });
    const plannerB = await registry.createAgent('planner-b', { provider: 'mcp', providerName: 'mock', model: 'planner-b' });
    const worker = await registry.createAgent('worker-1', { provider: 'mcp', providerName: 'mock', model: 'worker-1' });

    await registry.activateAgent(plannerA.id);
    await registry.activateAgent(plannerB.id);
    await registry.activateAgent(worker.id);

    const team = registry.createTeam([
      { agentId: plannerA.id, role: 'planner' },
      { agentId: plannerB.id, role: 'planner' },
      { agentId: worker.id, role: 'worker' }
    ]);
    expect(team.consensusMode).toBe('protocol');

    const task = await registry.assignTeamTask(team.id, 'test task');

    const transcript = task.transcript;
    expect(transcript.length).toBeGreaterThan(0);
    const systemPrompt = transcript.find(t => t.kind === 'system' && String(t.payload).includes('Arbiter Mode'));
    expect(systemPrompt).toBeUndefined();
  });

  it('routes to ArbiterCoordinator when consensusMode is arbiter', async () => {
    const plannerA = await registry.createAgent('planner-a', { provider: 'mcp', providerName: 'mock', model: 'planner-a' });
    const plannerB = await registry.createAgent('planner-b', { provider: 'mcp', providerName: 'mock', model: 'planner-b' });
    const worker = await registry.createAgent('worker-1', { provider: 'mcp', providerName: 'mock', model: 'worker-1' });

    await registry.activateAgent(plannerA.id);
    await registry.activateAgent(plannerB.id);
    await registry.activateAgent(worker.id);

    const team = registry.createTeam([
      { agentId: plannerA.id, role: 'planner' },
      { agentId: plannerB.id, role: 'planner' },
      { agentId: worker.id, role: 'worker' }
    ], undefined, 'arbiter');

    expect(team.consensusMode).toBe('arbiter');

    const task = await registry.assignTeamTask(team.id, 'test task');

    const transcript = task.transcript;
    const systemPrompt = transcript.find(t => t.kind === 'system' && String(t.payload).includes('Arbiter Mode'));
    expect(systemPrompt).toBeDefined();
  });

  it('exhausts turn budget and fails soft', async () => {
    const plannerA = await registry.createAgent('planner-a', { provider: 'mcp', providerName: 'mock', model: 'planner-a' });
    const plannerB = await registry.createAgent('planner-b', { provider: 'mcp', providerName: 'mock', model: 'planner-b' });
    const worker = await registry.createAgent('worker-1', { provider: 'mcp', providerName: 'mock', model: 'worker-1' });

    await registry.activateAgent(plannerA.id);
    await registry.activateAgent(plannerB.id);
    await registry.activateAgent(worker.id);

    const team = registry.createTeam([
      { agentId: plannerA.id, role: 'planner' },
      { agentId: plannerB.id, role: 'planner' },
      { agentId: worker.id, role: 'worker' }
    ], undefined, 'arbiter');

    const task = await registry.assignTeamTask(team.id, 'test task', 1);

    vi.mocked(callApi).mockImplementation(async (args: any) => {
      const messages = args.messages;
      const lastMsg = messages[messages.length - 1].content;
      if (lastMsg.includes('Arbiter Judge')) {
        return {
          text: JSON.stringify({ verdict: 'hold', rationale: 'keep debating' }),
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        } as any;
      }
      return {
        text: 'Agent reply',
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
      } as any;
    });

    let arbiterFailSoftEmitted = false;
    registry.on('arbiter_event', (evt) => {
      if (evt.type === 'arbiter_fail_soft') {
        arbiterFailSoftEmitted = true;
      }
    });

    await registry.handleMcpToolCall(plannerA.id, 'send_to_agent', { to: plannerB.id, payload: 'turn 1' });

    // We need to trigger readiness so that judge is called
    (registry.getAgent(plannerA.id) as any).status = 'ready';
    (registry.getAgent(plannerB.id) as any).status = 'ready';
    registry.emit('status', { id: plannerA.id, status: 'ready' });
    registry.emit('status', { id: plannerB.id, status: 'ready' });
    await new Promise(r => setTimeout(r, 50));

    await registry.handleMcpToolCall(plannerB.id, 'send_to_agent', { to: plannerA.id, payload: 'turn 2' });

    (registry.getAgent(plannerA.id) as any).status = 'ready';
    (registry.getAgent(plannerB.id) as any).status = 'ready';
    registry.emit('status', { id: plannerA.id, status: 'ready' });
    registry.emit('status', { id: plannerB.id, status: 'ready' });
    await new Promise(r => setTimeout(r, 50));

    await registry.handleMcpToolCall(plannerA.id, 'send_to_agent', { to: plannerB.id, payload: 'turn 3' });

    expect(arbiterFailSoftEmitted).toBe(true);
    expect(task.status).toBe('interrupted');
    const lastEntry = task.transcript[task.transcript.length - 1];
    expect(lastEntry?.payload).toContain('Turn budget exhausted');
  });

  it('converges via mocked judge', async () => {
    const plannerA = await registry.createAgent('planner-a', { provider: 'mcp', providerName: 'mock', model: 'planner-a' });
    const plannerB = await registry.createAgent('planner-b', { provider: 'mcp', providerName: 'mock', model: 'planner-b' });
    const worker = await registry.createAgent('worker-1', { provider: 'mcp', providerName: 'mock', model: 'worker-1' });

    await registry.activateAgent(plannerA.id);
    await registry.activateAgent(plannerB.id);
    await registry.activateAgent(worker.id);

    const team = registry.createTeam([
      { agentId: plannerA.id, role: 'planner' },
      { agentId: plannerB.id, role: 'planner' },
      { agentId: worker.id, role: 'worker' }
    ], undefined, 'arbiter');

    const task = await registry.assignTeamTask(team.id, 'test task', 10);

    vi.mocked(callApi).mockImplementation(async (args: any) => {
      const messages = args.messages;
      const lastMsg = messages[messages.length - 1].content;
      if (lastMsg.includes('Arbiter Judge')) {
        return {
          text: JSON.stringify({ verdict: 'converged', rationale: 'looks good' }),
          usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 }
        } as any;
      }
      if (lastMsg.includes('Arbiter Synthesizer')) {
        return {
          text: '# Final Plan\nThis is the plan.',
          usage: { prompt_tokens: 25, completion_tokens: 15, total_tokens: 40 }
        } as any;
      }
      return {
        text: 'Agent reply',
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
      } as any;
    });

    await registry.handleMcpToolCall(plannerA.id, 'send_to_agent', { to: plannerB.id, payload: 'I think we agree' });

    // Force statuses to trigger judge
    // Because assignTeamTask sets agents to queued, we should transition them manually
    (registry.getAgent(plannerA.id) as any).status = 'ready';
    (registry.getAgent(plannerB.id) as any).status = 'ready';
    registry.emit('status', { id: plannerA.id, status: 'ready' });
    registry.emit('status', { id: plannerB.id, status: 'ready' });

    // Wait for the async judge and synthesis to complete
    await new Promise(r => setTimeout(r, 100));

    if (task.status !== 'awaiting_confirmation') {
      console.log('Task transcript:', JSON.stringify(task.transcript, null, 2));
    }
    expect(task.status).toBe('awaiting_confirmation');
    expect(task.planningComplete).toBe(true);
    expect(task.plan).toBe('# Final Plan\nThis is the plan.');
    expect(task.arbiterJudgeUsage?.prompt_tokens).toBe(20);
    expect(task.arbiterSynthesisUsage?.completion_tokens).toBe(15);
  });

  it('confirms a converged plan via Registry and passes to worker', async () => {
    const plannerA = await registry.createAgent('planner-a', { provider: 'mcp', providerName: 'mock', model: 'planner-a' });
    const plannerB = await registry.createAgent('planner-b', { provider: 'mcp', providerName: 'mock', model: 'planner-b' });
    const worker = await registry.createAgent('worker-1', { provider: 'mcp', providerName: 'mock', model: 'worker-1' });

    await registry.activateAgent(plannerA.id);
    await registry.activateAgent(plannerB.id);
    await registry.activateAgent(worker.id);

    const team = registry.createTeam([
      { agentId: plannerA.id, role: 'planner' },
      { agentId: plannerB.id, role: 'planner' },
      { agentId: worker.id, role: 'worker' }
    ], undefined, 'arbiter');

    const task = await registry.assignTeamTask(team.id, 'test task', 10);

    vi.mocked(callApi).mockImplementation(async (args: any) => {
      const messages = args.messages;
      const lastMsg = messages[messages.length - 1].content;
      if (lastMsg.includes('Arbiter Judge')) {
        return {
          text: JSON.stringify({ verdict: 'converged', rationale: 'good' }),
          usage: { prompt_tokens: 10, completion_tokens: 10 }
        } as any;
      }
      if (lastMsg.includes('Arbiter Synthesizer')) {
        return {
          text: '# Confirmed Plan',
          usage: { prompt_tokens: 10, completion_tokens: 10 }
        } as any;
      }
      return { text: 'mock', usage: {} } as any;
    });

    await registry.handleMcpToolCall(plannerA.id, 'send_to_agent', { to: plannerB.id, payload: 'agree' });

    (registry.getAgent(plannerA.id) as any).status = 'ready';
    (registry.getAgent(plannerB.id) as any).status = 'ready';
    registry.emit('status', { id: plannerA.id, status: 'ready' });
    registry.emit('status', { id: plannerB.id, status: 'ready' });

    await new Promise(r => setTimeout(r, 100));

    expect(task.status).toBe('awaiting_confirmation');

    // Worker shouldn't be working yet
    expect(team.status).toBe('awaiting_confirmation');

    await registry.confirmTeamPlan(task.id);

    expect(task.status).toBe('delegated');
    expect(team.status).toBe('working');

    await registry.handleMcpToolCall(worker.id, 'submit_work_response', { accepted: true });
    expect(task.status).toBe('in_progress');
    expect(team.status).toBe('working');

    await registry.handleMcpToolCall(worker.id, 'submit_work_result', { result: 'worker completed' });
    expect(task.status).toBe('completed');
    expect(team.status).toBe('completed');
    expect(team.currentTaskId).toBeUndefined();
  });

  it('keeps arbiter-opted worker-only teams on the TeamCoordinator work path', async () => {
    const worker = await registry.createAgent('worker-1', { provider: 'mcp', providerName: 'mock', model: 'worker-1' });
    (registry.getAgent(worker.id) as any).status = 'ready';

    const team = registry.createTeam([
      { agentId: worker.id, role: 'worker' }
    ], undefined, 'arbiter');

    expect(team.consensusMode).toBe('arbiter');
    expect(team.composition).toBe('worker-only');

    const task = await registry.assignTeamTask(team.id, 'worker-only arbiter opt-in should remain worker-only');

    expect(task.status).toBe('delegated');
    expect(team.status).toBe('working');

    await registry.handleMcpToolCall(worker.id, 'submit_work_response', { accepted: true });
    expect(task.status).toBe('in_progress');

    await registry.handleMcpToolCall(worker.id, 'submit_work_result', { result: 'worker-only completed' });
    expect(task.status).toBe('completed');
    expect(team.status).toBe('completed');
    expect(team.currentTaskId).toBeUndefined();
  });
});
