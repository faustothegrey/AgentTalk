import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from '@agenttalk/runtime-core/registry/registry';
import { rmSync } from 'fs';
import { deriveConversationStatus } from '@agenttalk/runtime-core/conversations/conversation-status';

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

describe('Registry', () => {
  let registry: Registry;
  const TRANSCRIPT_DIR = './test-transcripts';
  const conversationStorePath = `${TRANSCRIPT_DIR}/conversations.json`;

  beforeEach(() => {
    registry = new Registry({
      readinessTimeoutMs: 500,
      conversationStorePath,
    });

    vi.useFakeTimers();

    try {
      rmSync(TRANSCRIPT_DIR, { recursive: true, force: true });
    } catch {}
  });

  afterEach(async () => {
    await registry.destroy();
    vi.restoreAllMocks();

    try {
      rmSync(TRANSCRIPT_DIR, { recursive: true, force: true });
    } catch {}
  });

  it('should create an agent', async () => {
    const agent = await registry.createAgent('agent-1');
    expect(agent.id).toBe('agent-1');
    expect(agent.status).toBe('creating');
    expect(agent.requestedExecutionMode).toBe('auto');
  });

  it('should persist the requested execution mode on agent creation', async () => {
    const agent = await registry.createAgent('agent-1', { requestedExecutionMode: 'interactive' });
    expect(agent.requestedExecutionMode).toBe('interactive');
  });

  it('should activate an agent and transition to ready (driver provider)', async () => {
    await registry.createAgent('agent-1');
    await registry.activateAgent('agent-1', 'claude', 'sonnet', 'auto');

    const agent = registry.getAgent('agent-1');
    expect(agent.status).toBe('ready');
    expect(agent.provider).toBe('claude');
    expect(agent.model).toBe('sonnet');
    expect(agent.requestedExecutionMode).toBe('auto');
  });

  it('should reject duplicate agent IDs', async () => {
    await registry.createAgent('agent-1');
    await expect(registry.createAgent('agent-1')).rejects.toThrow('Agent agent-1 already exists');
  });

  it('should throw when getting a nonexistent agent', () => {
    expect(() => registry.getAgent('nope')).toThrow('Agent nope not found');
  });

  it('should derive completed status when all agents reached the reply cap', () => {
    expect(deriveConversationStatus({
      id: 'conversation-1',
      agentIds: ['agent-1', 'agent-2'],
      topic: 'test',
      maxRepliesPerAgent: 2,
      replyCounts: {
        'agent-1': 2,
        'agent-2': 2,
      },
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      transcript: [],
    })).toBe('completed');
  });

  it('should expose derived conversation status in getConversations', () => {
    (registry as any).conversations.add({
      id: 'conversation-1',
      agentIds: ['agent-1', 'agent-2'],
      topic: 'test',
      maxRepliesPerAgent: 1,
      replyCounts: {
        'agent-1': 1,
        'agent-2': 1,
      },
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      transcript: [],
    });

    expect(registry.getConversations()).toEqual([
      expect.objectContaining({
        id: 'conversation-1',
        status: 'completed',
      }),
    ]);
  });

  it('should transition agent to error on handleMcpDisconnect if not terminated', async () => {
    const agent = await registry.createAgent('agent-1');
    agent.setStatus('starting');
    agent.setStatus('ready');

    expect(agent.status).toBe('ready');

    registry.handleMcpDisconnect('agent-1');
    expect(agent.status).toBe('reconnecting');
  });

  it('should not transition agent to error on handleMcpDisconnect if already terminated', async () => {
    const agent = await registry.createAgent('agent-1');
    agent.setStatus('terminated');

    expect(agent.status).toBe('terminated');

    registry.handleMcpDisconnect('agent-1');
    expect(agent.status).toBe('terminated');
  });

  describe('handleMcpDisconnect in Attach Mode', () => {
    let originalAttachMode: string | undefined;

    beforeEach(() => {
      originalAttachMode = process.env.AGENTTALK_ATTACH_MODE;
      process.env.AGENTTALK_ATTACH_MODE = 'true';
    });

    afterEach(() => {
      delete process.env.AGENTTALK_ATTACH_MODE;
    });

    it('should set agent to terminated on clean exit (code 1000)', async () => {
      const agent = await registry.createAgent('agent-1');
      agent.setStatus('starting');
      agent.setStatus('ready');
      registry.handleMcpDisconnect('agent-1', 1000);
      expect(agent.status).toBe('terminated');
    });

    it('should set agent to error on internal error (code 1011)', async () => {
      const agent = await registry.createAgent('agent-1');
      agent.setStatus('starting');
      agent.setStatus('ready');
      registry.handleMcpDisconnect('agent-1', 1011);
      expect(agent.status).toBe('error');
    });

    it('should set a reconnect timeout for abnormal closures', async () => {
      vi.useFakeTimers();
      const agent = await registry.createAgent('agent-1');
      agent.setStatus('starting');
      agent.setStatus('ready');
      registry.handleMcpDisconnect('agent-1', 1006);
      
      // Status should transition to reconnecting
      expect(agent.status).toBe('reconnecting');
      
      // Fast forward 30 seconds
      vi.advanceTimersByTime(30000);
      expect(agent.status).toBe('terminated');
      vi.useRealTimers();
    });

    it('should set status to error on reconnect timeout if a turn was in flight', async () => {
      vi.useFakeTimers();
      const agent = await registry.createAgent('agent-1');
      agent.setStatus('starting');
      agent.setStatus('ready');
      agent.currentTurnId = 'turn-123';
      
      registry.handleMcpDisconnect('agent-1', 1006);
      expect(agent.status).toBe('reconnecting');

      vi.advanceTimersByTime(30000);
      expect(agent.status).toBe('error');
      vi.useRealTimers();
    });

    // M08-T2 (IMP-T3b-1): the exec-turn path must get the same reconnect guards the semantic-turn
    // path already has — the in-flight exec turn is re-delivered to the relaunched harness, and a
    // stale waiter from the dead socket can't eat it. Window-expiry rejection is T1's job (proven
    // by the completer + the 'error on reconnect timeout' test above).
    it('M08-T2: re-delivers the in-flight exec turn after an in-window reconnect', async () => {
      const agent = await registry.createAgent('agent-1');
      agent.setStatus('starting');
      agent.setStatus('ready');

      // Completer queues an exec turn; the harness pulls it -> now in flight.
      const execTurn = { type: 'exec_rpc', prompt: 'do the thing' };
      agent.queueExecTurn(execTurn);
      const delivered = await agent.awaitExecTurn();
      expect(delivered).toEqual(execTurn);
      expect(agent.activeExecTurn).toEqual(execTurn);

      // Socket drops mid-exec (1006) -> reconnecting; the in-flight exec turn is requeued.
      registry.handleMcpDisconnect('agent-1', 1006);
      expect(agent.status).toBe('reconnecting');
      expect(agent.activeExecTurn).toBeUndefined();

      // The relaunched harness pulls again and gets the same turn re-delivered.
      const redelivered = await agent.awaitExecTurn();
      expect(redelivered).toEqual(execTurn);
    });

    it('M08-T2: clears a stale exec-turn waiter on drop so it cannot eat the re-delivery', async () => {
      const agent = await registry.createAgent('agent-1');
      agent.setStatus('starting');
      agent.setStatus('ready');

      const execTurn = { type: 'exec_rpc', prompt: 'do the thing' };
      agent.queueExecTurn(execTurn);
      await agent.awaitExecTurn(); // in flight (activeExecTurn set)

      // Harness then blocks for the *next* exec turn; this resolver is bound to the soon-dead
      // socket. If not cleared, the requeued turn would resolve into the void.
      let stale: unknown = 'unresolved';
      void agent.awaitExecTurn().then((t) => { stale = t; });

      registry.handleMcpDisconnect('agent-1', 1006);
      await Promise.resolve();
      expect(stale).toBe('unresolved'); // stale resolver was dropped, not fed the re-delivery

      const redelivered = await agent.awaitExecTurn(); // fresh pull by the reconnected harness
      expect(redelivered).toEqual(execTurn);
    });

    it('M08-T2: does not re-deliver once the exec result has been submitted', async () => {
      const agent = await registry.createAgent('agent-1');
      agent.setStatus('starting');
      agent.setStatus('ready');

      const execTurn = { type: 'exec_rpc', prompt: 'do the thing' };
      agent.queueExecTurn(execTurn);
      await agent.awaitExecTurn();
      expect(agent.activeExecTurn).toEqual(execTurn);

      // Result submitted via the real MCP path -> activeExecTurn cleared.
      await registry.handleMcpToolCall('agent-1', 'submit_exec_result', { text: 'done' });
      expect(agent.activeExecTurn).toBeUndefined();

      // A subsequent drop must NOT requeue an already-finished exec turn.
      registry.handleMcpDisconnect('agent-1', 1006);
      let resolved = false;
      void agent.awaitExecTurn().then(() => { resolved = true; });
      await Promise.resolve();
      expect(resolved).toBe(false);
    });
  });

  // M08 fault-tolerance: a consensus protocol violation must be soft-rejected, not thrown.
  // Pre-fix: the throw propagated through InProcessAgentDriver, marked the agent `error`, and M03
  // Shared Fate killed the (often already-successful) team. The action must now be discarded with
  // the agent kept alive.
  it('M08: a consensus protocol violation is soft-rejected, not thrown (agent kept alive)', async () => {
    const agent = await registry.createAgent('planner-b');

    // Simulate the engine rejecting an out-of-turn planning action (e.g. the acceptor / a panicked
    // late submit_plan). Without the fix this throw escapes handleMcpToolCall and crashes the driver.
    vi.spyOn((registry as unknown as { teamCoordinator: { handlePlanSubmitted: () => void } }).teamCoordinator, 'handlePlanSubmitted')
      .mockImplementation(() => {
        throw new Error('The agent that confirmed agreement_acceptance cannot submit the plan — the other planner must submit it');
      });

    let threw = false;
    let result: { isError?: boolean } | undefined;
    try {
      result = await registry.handleMcpToolCall('planner-b', 'submit_plan', { plan: 'x', proposal: 'p', text: 't' });
    } catch {
      threw = true;
    }

    expect(threw).toBe(false);              // did NOT propagate (pre-fix: would throw → driver crash)
    expect(result?.isError).toBe(true);     // returned as a soft MCP rejection
    expect(agent.status).not.toBe('error'); // agent unharmed
  });
});
