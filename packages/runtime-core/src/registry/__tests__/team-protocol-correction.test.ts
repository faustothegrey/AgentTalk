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

describe('Team Protocol Correction (M11-T2)', () => {
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

  it('provides a richer correction prompt and accepts valid correction without ejecting (D1, D2)', async () => {
    const { getLatestTask } = await setupTaskToDiscussion();
    const task = getLatestTask();
    expect(task).toBeDefined();

    // Send an illegal action (submit_plan) instead of opinion or agreement_proposal
    await registry.handleMcpToolCall('planner-a', 'await_turn', {});
    await registry.handleMcpToolCall('planner-a', 'submit_exec_result', {
      text: JSON.stringify({
        message_type: 'submit_plan',
        message_payload: { plan: 'my plan', proposal: 'prop', text: 'done' }
      }),
      usage: { prompt_tokens: 0, completion_tokens: 0 }
    });

    // We should get a correction prompt back
    const correctionTurn = await registry.handleMcpToolCall('planner-a', 'await_turn', {});
    const correctionExec = JSON.parse(correctionTurn.content[0].text);
    const prompt = correctionExec.prompt;

    // Assert the correction prompt has the required elements (D1)
    expect(prompt).toContain('submit_plan'); // rejected action
    expect(prompt).toContain('discussion'); // phase
    expect(prompt).toContain('opinion, agreement_proposal'); // expected
    expect(prompt).toContain('consensus_respond'); // resend instruction
    expect(prompt).toContain('action');
    expect(prompt).toContain('payload');

    // The task should remain in planning state
    expect(getLatestTask()?.status).toBe('planning');
    
    // Now send a valid action
    await registry.handleMcpToolCall('planner-a', 'submit_exec_result', {
      text: JSON.stringify({
        message_type: 'opinion',
        message_payload: { text: 'my opinion', proposal: null, expected_response_types: [] }
      }),
      usage: { prompt_tokens: 0, completion_tokens: 0 }
    });

    // Task should still be planning, transcript should not have ejected
    expect(getLatestTask()?.status).toBe('planning');
    const ejectedEntry = getLatestTask()?.transcript.find(e => e.payload && typeof e.payload === 'string' && e.payload.includes('ejected'));
    expect(ejectedEntry).toBeUndefined();
  });

  it('ejects the planner after repeated non-compliance (D3)', async () => {
    const { getLatestTask } = await setupTaskToDiscussion();

    // attempt 1
    await registry.handleMcpToolCall('planner-a', 'await_turn', {});
    await registry.handleMcpToolCall('planner-a', 'submit_exec_result', {
      text: JSON.stringify({ message_type: 'submit_plan', message_payload: { plan: 'p1', proposal: 'prop', text: 'done' } }),
      usage: { prompt_tokens: 0, completion_tokens: 0 }
    });
    
    // attempt 2
    await registry.handleMcpToolCall('planner-a', 'await_turn', {});
    await registry.handleMcpToolCall('planner-a', 'submit_exec_result', {
      text: JSON.stringify({ message_type: 'submit_plan', message_payload: { plan: 'p2', proposal: 'prop', text: 'done' } }),
      usage: { prompt_tokens: 0, completion_tokens: 0 }
    });

    // attempt 3 (exhausts budget)
    await registry.handleMcpToolCall('planner-a', 'await_turn', {});
    await registry.handleMcpToolCall('planner-a', 'submit_exec_result', {
      text: JSON.stringify({ message_type: 'submit_plan', message_payload: { plan: 'p3', proposal: 'prop', text: 'done' } }),
      usage: { prompt_tokens: 0, completion_tokens: 0 }
    });

    // Task becomes awaiting_operator because planner-a is ejected and the team is halted
    await new Promise(r => setTimeout(r, 50));
    expect(getLatestTask()?.status).toBe('awaiting_operator');
    
    const ejectedEntry = getLatestTask()?.transcript.find(e => 
      e.payload && typeof e.payload === 'string' && e.payload.includes('ejected')
    );
    expect(ejectedEntry).toBeDefined();
  });
});
