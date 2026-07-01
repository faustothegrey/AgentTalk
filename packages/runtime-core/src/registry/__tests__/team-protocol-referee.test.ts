import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from '../registry.js';
import type { TeamTask } from '@agenttalk/contracts/types';

// HERMETICITY: same mocks as team-mcp-consensus.test.ts
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

describe('Team Protocol Referee (M11-T3)', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await registry.destroy();
  });

  const setupTaskToDiscussion = async () => {
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

    let latestTask: TeamTask | undefined;
    registry.on('team_task', (task) => {
      latestTask = task;
    });

    const runAckAndFact = async (agentId: string) => {
      const turn1 = await registry.handleMcpToolCall(agentId, 'await_turn', {});
      const exec1 = JSON.parse(turn1.content[0].text);
      expect(exec1.type).toBe('exec_rpc');

      await registry.handleMcpToolCall(agentId, 'submit_exec_result', {
        text: JSON.stringify({
          message_type: 'ack_planning_protocol',
          message_payload: {}
        }),
        usage: { prompt_tokens: 0, completion_tokens: 0 }
      });

      const turn2 = await registry.handleMcpToolCall(agentId, 'await_turn', {});
      const exec2 = JSON.parse(turn2.content[0].text);
      expect(exec2.type).toBe('exec_rpc');

      await registry.handleMcpToolCall(agentId, 'submit_exec_result', {
        text: JSON.stringify({
          message_type: 'fact_collection_end',
          message_payload: { summary: 'facts' }
        }),
        usage: { prompt_tokens: 0, completion_tokens: 0 }
      });
    };

    const runPromiseA = runAckAndFact('planner-a');
    const runPromiseB = runAckAndFact('planner-b');

    await registry.assignTeamTask(team.id, 'Make a plan');

    await Promise.all([runPromiseA, runPromiseB]);

    return {
      registry,
      getLatestTask: () => latestTask,
    };
  };

  it('interrupts the team when discussion turn budget is exhausted (6/6)', async () => {
    const { getLatestTask } = await setupTaskToDiscussion();
    const task = getLatestTask();
    expect(task).toBeDefined();

    // We are now in discussion phase.
    // Send 6 legal turns to exhaust the budget.
    for (let i = 0; i < 6; i++) {
      // Alternate agents
      const agentId = i % 2 === 0 ? 'planner-a' : 'planner-b';

      await registry.handleMcpToolCall(agentId, 'await_turn', {});
      await registry.handleMcpToolCall(agentId, 'submit_exec_result', {
        text: JSON.stringify({
          message_type: 'opinion',
          message_payload: { text: `turn ${i + 1}`, proposal: null, expected_response_types: [] }
        }),
        usage: { prompt_tokens: 0, completion_tokens: 0 }
      });
    }

    // Wait slightly for interruption to process
    await new Promise(r => setTimeout(r, 50));

    const latestTask = getLatestTask();
    expect(latestTask?.status).toBe('interrupted');

    const interruptedEntry = latestTask?.transcript.find(e =>
      e.payload && typeof e.payload === 'string' && e.payload.includes('discussion turn budget exhausted (6/6)')
    );
    expect(interruptedEntry).toBeDefined();
  });
});
