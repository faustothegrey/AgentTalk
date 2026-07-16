import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from '../registry.js';
import type { TeamTask } from '@agenttalk/contracts/types';

// HERMETICITY: same mocks as team-protocol-correction.test.ts
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

// BL-041: the ack-phase re-request loop must be bounded. A planner that keeps
// sending non-ack messages during protocol_ack_pending was re-prompted forever
// (TL-010: ~120 turns, burning provider budget). After MAX_ACK_REREQUESTS (=2)
// re-requests the offender is ejected peer-safe (awaiting_operator), exactly like
// an exhausted protocol-correction budget.
describe('Team ack-phase budget (BL-041)', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await registry.destroy();
  });

  const createTeam = async () => {
    const a = await registry.createAgent('planner-a', { provider: 'mcp', providerName: 'gemini', model: 'planner-a' });
    const b = await registry.createAgent('planner-b', { provider: 'mcp', providerName: 'gemini', model: 'planner-b' });
    const w = await registry.createAgent('worker-1', { provider: 'mcp', providerName: 'gemini', model: 'worker-1' });
    await registry.activateAgent(a.id);
    await registry.activateAgent(b.id);
    await registry.activateAgent(w.id);
    const team = registry.createTeam([
      { agentId: a.id, role: 'planner' },
      { agentId: b.id, role: 'planner' },
      { agentId: w.id, role: 'worker' },
    ]);
    let latestTask: TeamTask | undefined;
    registry.on('team_task', (t) => { latestTask = t; });
    return { team, getLatestTask: () => latestTask };
  };

  const nonAck = () => JSON.stringify({
    message_type: 'opinion',
    message_payload: { text: 'talking instead of acknowledging', proposal: null, expected_response_types: [] },
  });
  const ack = () => JSON.stringify({ message_type: 'ack_planning_protocol', message_payload: {} });

  const awaitExec = async (agentId: string) => {
    const turn = await registry.handleMcpToolCall(agentId, 'await_turn', {});
    return JSON.parse(turn.content[0].text);
  };
  const submit = (agentId: string, text: string) =>
    registry.handleMcpToolCall(agentId, 'submit_exec_result', { text, usage: { prompt_tokens: 0, completion_tokens: 0 } });

  it('ejects a planner that never acknowledges, after the re-request budget (no infinite loop)', async () => {
    const { team, getLatestTask } = await createTeam();

    // planner-a keeps sending non-ack messages during the ack phase.
    const drive = async () => {
      // initial ack request + 2 re-requests = 3 exec turns; the 3rd non-ack exhausts the budget.
      for (let i = 0; i < 3; i++) {
        const exec = await awaitExec('planner-a');
        if (exec.type !== 'exec_rpc') break;
        await submit('planner-a', nonAck());
      }
    };
    const running = drive();
    await registry.assignTeamTask(team.id, 'Make a plan');
    await running;

    await new Promise((r) => setTimeout(r, 50));
    expect(getLatestTask()?.status).toBe('awaiting_operator');
    const ejected = getLatestTask()?.transcript.find(
      (e) => typeof e.payload === 'string' && e.payload.includes('ejected') && e.payload.includes('acknowledge the planning protocol'),
    );
    expect(ejected).toBeDefined();
  });

  it('does NOT eject when a planner stumbles once then acknowledges (budget is graceful)', async () => {
    const { team, getLatestTask } = await createTeam();

    const driveA = async () => {
      const first = await awaitExec('planner-a'); // initial ack request
      expect(first.type).toBe('exec_rpc');
      await submit('planner-a', nonAck());         // one stumble -> re-request
      const second = await awaitExec('planner-a'); // the re-request
      expect(second.type).toBe('exec_rpc');
      await submit('planner-a', ack());            // then acknowledge properly
    };
    const driveB = async () => {
      await awaitExec('planner-b');
      await submit('planner-b', ack());
    };

    const running = Promise.all([driveA(), driveB()]);
    await registry.assignTeamTask(team.id, 'Make a plan');
    await running;

    await new Promise((r) => setTimeout(r, 50));
    // Not ejected, not frozen: both acknowledged so planning proceeds past the ack phase.
    expect(getLatestTask()?.status).toBe('planning');
    const ejected = getLatestTask()?.transcript.find(
      (e) => typeof e.payload === 'string' && e.payload.includes('ejected'),
    );
    expect(ejected).toBeUndefined();
  });
});
