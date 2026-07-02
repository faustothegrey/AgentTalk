import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from '../registry.js';
import { callApi } from '@agenttalk/llm-client/api-client.js';

vi.mock('@agenttalk/llm-client/api-client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@agenttalk/llm-client/api-client.js')>();
  return {
    ...actual,
    callApi: vi.fn(),
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
});
