import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from '../registry.js';

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

describe('Team Fact Collection Timeout', () => {
  let registry: Registry;

  const flushPromises = async () => {
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => process.nextTick(resolve));
    }
  };

  beforeEach(() => {
    registry = new Registry();
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await registry.destroy();
  });

  it('schedules the Gemini extended timeout for a mixed MCP team (Gemini+Codex) without team.provider', async () => {
    const plannerA = await registry.createAgent('planner-a', { provider: 'mcp', providerName: 'gemini', model: 'planner-a' });
    const plannerB = await registry.createAgent('planner-b', { provider: 'mcp', providerName: 'codex', model: 'planner-b' });
    const worker = await registry.createAgent('worker-1', { provider: 'mcp', providerName: 'gemini', model: 'worker-1' });

    await registry.activateAgent(plannerA.id);
    await registry.activateAgent(plannerB.id);
    await registry.activateAgent(worker.id);

    const team = registry.createTeam([
      { agentId: plannerA.id, role: 'planner' },
      { agentId: plannerB.id, role: 'planner' },
      { agentId: worker.id, role: 'worker' }
    ]);

    let timeoutFired = false;
    registry.on('team_task', (task) => {
      if (task.status === 'interrupted' && task.transcript.some((t: any) => t.payload && typeof t.payload === 'string' && t.payload.includes('Fact collection timed out'))) {
        timeoutFired = true;
      }
    });

    await registry.assignTeamTask(team.id, 'Test task');

    await registry.handleMcpToolCall(plannerA.id, 'submit_exec_result', { text: '{"message_type":"ack_planning_protocol","message_payload":{}}', usage: { prompt_tokens: 0, completion_tokens: 0 } });
    await registry.handleMcpToolCall(plannerB.id, 'submit_exec_result', { text: '{"message_type":"ack_planning_protocol","message_payload":{}}', usage: { prompt_tokens: 0, completion_tokens: 0 } });

    await flushPromises();

    expect(timeoutFired).toBe(false);

    vi.advanceTimersByTime(480_000);
    expect(timeoutFired).toBe(false);

    vi.advanceTimersByTime(240_000);
    expect(timeoutFired).toBe(true);
  });

  it('keeps the base timeout for an all non-Gemini team (Codex+Claude)', async () => {
    const plannerA = await registry.createAgent('planner-a', { provider: 'mcp', providerName: 'codex', model: 'planner-a' });
    const plannerB = await registry.createAgent('planner-b', { provider: 'mcp', providerName: 'claude', model: 'planner-b' });
    const worker = await registry.createAgent('worker-1', { provider: 'mcp', providerName: 'codex', model: 'worker-1' });

    await registry.activateAgent(plannerA.id);
    await registry.activateAgent(plannerB.id);
    await registry.activateAgent(worker.id);

    const team = registry.createTeam([
      { agentId: plannerA.id, role: 'planner' },
      { agentId: plannerB.id, role: 'planner' },
      { agentId: worker.id, role: 'worker' }
    ]);

    let timeoutFired = false;
    registry.on('team_task', (task) => {
      if (task.status === 'interrupted' && task.transcript.some((t: any) => t.payload && typeof t.payload === 'string' && t.payload.includes('Fact collection timed out'))) {
        timeoutFired = true;
      }
    });

    await registry.assignTeamTask(team.id, 'Test task');
    await registry.handleMcpToolCall(plannerA.id, 'submit_exec_result', { text: '{"message_type":"ack_planning_protocol","message_payload":{}}', usage: { prompt_tokens: 0, completion_tokens: 0 } });
    await registry.handleMcpToolCall(plannerB.id, 'submit_exec_result', { text: '{"message_type":"ack_planning_protocol","message_payload":{}}', usage: { prompt_tokens: 0, completion_tokens: 0 } });

    await flushPromises();

    expect(timeoutFired).toBe(false);

    vi.advanceTimersByTime(480_000);
    expect(timeoutFired).toBe(true);
  });

  it('preserves existing all-Gemini behavior (all-Gemini-MCP with no team.provider -> 720k)', async () => {
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

    let timeoutFired = false;
    registry.on('team_task', (task) => {
      if (task.status === 'interrupted' && task.transcript.some((t: any) => t.payload && typeof t.payload === 'string' && t.payload.includes('Fact collection timed out'))) {
        timeoutFired = true;
      }
    });

    await registry.assignTeamTask(team.id, 'Test task');
    await registry.handleMcpToolCall(plannerA.id, 'submit_exec_result', { text: '{"message_type":"ack_planning_protocol","message_payload":{}}', usage: { prompt_tokens: 0, completion_tokens: 0 } });
    await registry.handleMcpToolCall(plannerB.id, 'submit_exec_result', { text: '{"message_type":"ack_planning_protocol","message_payload":{}}', usage: { prompt_tokens: 0, completion_tokens: 0 } });

    await flushPromises();

    vi.advanceTimersByTime(480_000);
    expect(timeoutFired).toBe(false);

    vi.advanceTimersByTime(240_000);
    expect(timeoutFired).toBe(true);
  });

  it('preserves legacy explicit team-level provider behavior (team.provider = gemini)', async () => {
    const plannerA = await registry.createAgent('planner-a', { provider: 'mcp', providerName: 'codex', model: 'planner-a' });
    const plannerB = await registry.createAgent('planner-b', { provider: 'mcp', providerName: 'codex', model: 'planner-b' });
    const worker = await registry.createAgent('worker-1', { provider: 'mcp', providerName: 'codex', model: 'worker-1' });

    await registry.activateAgent(plannerA.id);
    await registry.activateAgent(plannerB.id);
    await registry.activateAgent(worker.id);

    const team = registry.createTeam([
      { agentId: plannerA.id, role: 'planner' },
      { agentId: plannerB.id, role: 'planner' },
      { agentId: worker.id, role: 'worker' }
    ], 'gemini');

    let timeoutFired = false;
    registry.on('team_task', (task) => {
      if (task.status === 'interrupted' && task.transcript.some((t: any) => t.payload && typeof t.payload === 'string' && t.payload.includes('Fact collection timed out'))) {
        timeoutFired = true;
      }
    });

    await registry.assignTeamTask(team.id, 'Test task');
    await registry.handleMcpToolCall(plannerA.id, 'submit_exec_result', { text: '{"message_type":"ack_planning_protocol","message_payload":{}}', usage: { prompt_tokens: 0, completion_tokens: 0 } });
    await registry.handleMcpToolCall(plannerB.id, 'submit_exec_result', { text: '{"message_type":"ack_planning_protocol","message_payload":{}}', usage: { prompt_tokens: 0, completion_tokens: 0 } });

    await flushPromises();

    vi.advanceTimersByTime(480_000);
    expect(timeoutFired).toBe(false);

    vi.advanceTimersByTime(240_000);
    expect(timeoutFired).toBe(true);
  });
});
