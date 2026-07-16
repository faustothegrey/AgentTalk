import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InProcessAgentDriver } from '../in-process-driver.js';
import { Agent } from '../agent.js';
import { McpError } from '../completer.js';
import { WORKTREE_CONTEXT } from '../response-schema.js';
import type { Completer } from '@agenttalk/llm-client';
import type { Registry } from '../../registry/registry.js';

describe('InProcessAgentDriver', () => {
  let agent: Agent;
  let registry: Registry;
  let mockFetch: any;

  beforeEach(() => {
    agent = new Agent('agent-1');
    registry = {
      handleMcpToolCall: vi.fn().mockResolvedValue({}),
      pauseTaskForOperator: vi.fn().mockResolvedValue(undefined),
    } as unknown as Registry;
    mockFetch = vi.fn();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  it('runs awaitTurn -> callApi -> handleMcpToolCall', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'hello world' } }]
      })
    });

    const driver = new InProcessAgentDriver(agent, registry, { fetchFn: mockFetch });
    driver.start();

    expect(agent.status).toBe('ready');

    // Feed a non-planning turn (no structured JSON required)
    agent.queueTurn({
      type: 'message_received',
      from: 'user',
      payload: 'Hi'
    });

    // Wait for the event loop
    await new Promise(r => setTimeout(r, 50));

    expect(mockFetch).toHaveBeenCalled();
    expect(registry.handleMcpToolCall).toHaveBeenCalledWith('agent-1', 'send_to_agent', expect.objectContaining({ payload: 'hello world' }));

    driver.stop();
  });

  it('handles structured response on planning turn', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"message_type":"opinion","message_payload":{"text":"my opinion","proposal":null,"expected_response_types":["opinion"]}}' } }]
      })
    });

    const driver = new InProcessAgentDriver(agent, registry, { fetchFn: mockFetch });
    driver.start();

    // Start a planning conversation
    agent.queueTurn({
      type: 'conversation_start',
      mode: 'planning',
      peerIds: ['agent-2'],
      topic: 'test',
      initiator: true
    });

    await new Promise(r => setTimeout(r, 50));

    // Should have queued a message_received event internally because initiator=true
    await new Promise(r => setTimeout(r, 50));

    expect(mockFetch).toHaveBeenCalled();
    expect(registry.handleMcpToolCall).toHaveBeenCalledWith('agent-1', 'consensus_respond', expect.objectContaining({
      action: 'opinion',
      payload: expect.objectContaining({
        text: 'my opinion',
        expected_response_types: ['opinion']
      })
    }));

    driver.stop();
  });

  it('settles back to ready when conversation_end stops the conversation loop', async () => {
    const driver = new InProcessAgentDriver(agent, registry, {
      completer: {
        maintainsSession: true,
        complete: vi.fn().mockResolvedValue({ text: '' }),
      } as unknown as Completer,
    });
    driver.start();

    agent.queueTurn({
      type: 'conversation_start',
      peerIds: ['agent-2'],
      topic: 'test',
      initiator: false,
    });

    await new Promise(r => setTimeout(r, 20));
    expect(agent.status).toBe('ready');

    agent.queueTurn({
      type: 'conversation_end',
      conversationId: 'conversation-bl033-driver',
      reason: 'done',
    });

    await new Promise(r => setTimeout(r, 20));
    expect(agent.status).toBe('ready');
    expect(agent.currentTurnId).toBeUndefined();
  });

  it('handles fact_collection_begin', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"message_type":"fact_collection_end","message_payload":{"summary":"Some facts here"}}' } }]
      })
    });

    const driver = new InProcessAgentDriver(agent, registry, { fetchFn: mockFetch });
    driver.start();

    agent.queueTurn({
      type: 'fact_collection_begin',
      description: 'Find where login is'
    });

    await new Promise(r => setTimeout(r, 50));

    expect(mockFetch).toHaveBeenCalled();
    expect(registry.handleMcpToolCall).toHaveBeenCalledWith('agent-1', 'consensus_respond', {
      action: 'fact_collection_end',
      payload: { summary: 'Some facts here' }
    });

    driver.stop();
  });

  it('handles team_work_assign', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"message_type":"work_accept","message_payload":{"text":"I did the work."}}' } }]
      })
    });

    const driver = new InProcessAgentDriver(agent, registry, { fetchFn: mockFetch });
    driver.start();

    agent.queueTurn({
      type: 'team_work_assign',
      description: 'Do the refactor',
      plan: 'Refactor login'
    });

    await new Promise(r => setTimeout(r, 50));

    expect(mockFetch).toHaveBeenCalled();
    expect(registry.handleMcpToolCall).toHaveBeenCalledWith('agent-1', 'submit_work_response', { accepted: true });
    expect(registry.handleMcpToolCall).toHaveBeenCalledWith('agent-1', 'submit_work_result', { result: 'I did the work.' });

    driver.stop();
  });

  // BL-062. The prompt is the product here, so these assert the prompt itself rather than the
  // tool calls that follow it: the rung-1 run proved a worker can produce a correct result from
  // an incoherent prompt, which means outcome assertions cannot see this class of defect at all.
  const promptSentTo = (fetchMock: any): string => {
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const strings: string[] = [];
    const walk = (v: any): void => {
      if (typeof v === 'string') strings.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(body);
    return strings.find((s) => s.includes('You are the WORKER')) ?? '';
  };

  const runWorkAssign = async (plan: string) => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"message_type":"work_accept","message_payload":{"text":"done"}}' } }]
      })
    });
    const driver = new InProcessAgentDriver(agent, registry, { fetchFn: mockFetch });
    driver.start();
    agent.queueTurn({ type: 'team_work_assign', description: 'Do the refactor', plan });
    await new Promise(r => setTimeout(r, 50));
    driver.stop();
    return promptSentTo(mockFetch);
  };

  it('BL-062: a worker-only assignment (no plan) is told to DO the task, not to review a plan', async () => {
    const prompt = await runWorkAssign('');

    // The defect: with no planner in the team, the worker was still told one had written a plan
    // and asked to critique it. A worker that COMPLIED changed no files and reported completed —
    // indistinguishable from a model skipping the work (the BL-059 accusation shape).
    expect(prompt).not.toContain('planner has created a plan');
    expect(prompt).not.toContain('Critically evaluate');
    expect(prompt).toContain('You are the WORKER. You have been assigned a task to carry out.');

    // The goal reached the worker twice: once as `Original task:`, once as a synthesized plan.
    expect(prompt.split('Do the refactor').length - 1).toBe(1);

    // BL-053's guarantee has to survive the move: the worker is still TOLD it is in a worktree —
    // now from the prompt rather than from a stand-in plan — and told exactly once.
    expect(prompt).toContain(WORKTREE_CONTEXT);
    expect(prompt.split(WORKTREE_CONTEXT).length - 1).toBe(1);

    // BL-053's negative half, which moved here with it: no refuse-and-abort branch. While that
    // branch existed the only thing it could still do was turn a correct setup into a failure.
    expect(prompt).not.toContain('abort the task');
  });

  it('BL-062: prompts are joined with real newlines, not a literal backslash-n', async () => {
    // `.join('\\n')` glued every prompt together with the two characters \ and n (charCodes
    // 92,110), so the model received one line with the escape printed through it as text.
    for (const plan of ['', 'Refactor login']) {
      const prompt = await runWorkAssign(plan);
      expect(prompt).not.toContain('\\n');
      expect(prompt).toContain('\n');
      mockFetch.mockClear();
      agent = new Agent('agent-1');
    }
  });

  it('BL-062: a real plan still gets the two-agent plan-review prompt', async () => {
    const prompt = await runWorkAssign('Refactor login');
    expect(prompt).toContain('planner has created a plan for you to review');
    expect(prompt).toContain('## Final Plan');
    expect(prompt).toContain('Refactor login');
  });

  it('M08-T1: a rejected exec ends the turn cleanly — no crash, agent not forced to error', async () => {
    // Injected completer that rejects (as McpCompleter now does on timeout/disconnect).
    const rejectingCompleter: Completer = {
      maintainsSession: false,
      complete: vi.fn().mockRejectedValue(new McpError('timeout', 'simulated exec timeout', 'agent-1')),
    };

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const driver = new InProcessAgentDriver(agent, registry, { completer: rejectingCompleter });
    driver.start();

    agent.queueTurn({ type: 'message_received', from: 'user', payload: 'Hi' });
    await new Promise(r => setTimeout(r, 50));

    // The exec was attempted...
    expect(rejectingCompleter.complete).toHaveBeenCalled();
    // ...the rejection was reported (no silent swallow)...
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('exec failed'));
    // ...the turn ended via the null contract (no protocol action emitted)...
    expect(registry.handleMcpToolCall).not.toHaveBeenCalled();
    // ...and crucially the loop did NOT force the agent to `error` (which would trip M03 Shared-Fate).
    expect(agent.status).not.toBe('error');

    warnSpy.mockRestore();
    driver.stop();
  });

  it('M08-T3: a worker exec crash (McpError) fences the task for the operator — no work submitted, no agent error', async () => {
    // The realistic G3 path: the worker exec hangs/crashes mid-exec and the completer rejects
    // with a McpError (timeout/disconnect). The worker opts in to throwOnExecError, so the
    // driver rethrows it and diverts to pauseTaskForOperator (stop-and-ask) instead of hanging.
    const rejectingCompleter: Completer = {
      maintainsSession: false,
      complete: vi.fn().mockRejectedValue(new McpError('timeout', 'simulated worker exec timeout', 'agent-1')),
    };

    const driver = new InProcessAgentDriver(agent, registry, { completer: rejectingCompleter });
    driver.start();

    agent.queueTurn({ type: 'team_work_assign', description: 'Do the refactor', plan: 'Refactor login' });
    await new Promise(r => setTimeout(r, 50));

    // The worker exec was attempted and the fence fired with the failure reason...
    expect(rejectingCompleter.complete).toHaveBeenCalled();
    expect(registry.pauseTaskForOperator).toHaveBeenCalledWith('agent-1', 'simulated worker exec timeout');
    // ...no work was submitted (no silent completion, no refusal) ...
    expect(registry.handleMcpToolCall).not.toHaveBeenCalled();
    // ...and the agent was NOT forced to error (the fence is not the M03 kill).
    expect(agent.status).not.toBe('error');

    driver.stop();
  });

  it('M08-T3: a normal empty worker response does NOT fence (crash-vs-empty distinction)', async () => {
    // null/empty is the existing "no text" contract — it must never be mistaken for a crash.
    const emptyCompleter: Completer = {
      maintainsSession: false,
      complete: vi.fn().mockResolvedValue({ text: '' }),
    };

    const driver = new InProcessAgentDriver(agent, registry, { completer: emptyCompleter });
    driver.start();

    agent.queueTurn({ type: 'team_work_assign', description: 'Do the refactor', plan: 'Refactor login' });
    await new Promise(r => setTimeout(r, 50));

    expect(emptyCompleter.complete).toHaveBeenCalled();
    expect(registry.pauseTaskForOperator).not.toHaveBeenCalled();

    driver.stop();
  });

  it('M08-T3: a non-McpError worker rejection does NOT fence (only genuine exec crashes do)', async () => {
    // A generic error keeps the M08-T1 null-swallow behaviour; only McpError trips the fence.
    const genericFailCompleter: Completer = {
      maintainsSession: false,
      complete: vi.fn().mockRejectedValue(new Error('some non-exec failure')),
    };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const driver = new InProcessAgentDriver(agent, registry, { completer: genericFailCompleter });
    driver.start();

    agent.queueTurn({ type: 'team_work_assign', description: 'Do the refactor', plan: 'Refactor login' });
    await new Promise(r => setTimeout(r, 50));

    expect(genericFailCompleter.complete).toHaveBeenCalled();
    expect(registry.pauseTaskForOperator).not.toHaveBeenCalled();
    expect(agent.status).not.toBe('error');

    warnSpy.mockRestore();
    driver.stop();
  });

  it('BL-020 regression: a disconnect mid-turn does not crash the orchestrator via illegal status transition', async () => {
    const errorCompleter: Completer = {
      maintainsSession: false,
      complete: vi.fn().mockResolvedValue({ text: 'mock' }),
    };

    // Make registry.handleMcpToolCall throw and simulate the transport setting agent to terminated
    registry.handleMcpToolCall = vi.fn().mockImplementation(async () => {
      agent.setStatus('terminated');
      throw new Error('transport disconnected');
    });

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const driver = new InProcessAgentDriver(agent, registry, { completer: errorCompleter });
    driver.start();

    // Start a turn
    agent.queueTurn({
      type: 'message_received',
      from: 'user',
      payload: 'Hi'
    });

    // Wait for the event loop to process the turn, which will call registry.handleMcpToolCall
    await new Promise(r => setTimeout(r, 50));

    expect(errorCompleter.complete).toHaveBeenCalled();
    expect(registry.handleMcpToolCall).toHaveBeenCalled();

    // The driver should have caught the error and NOT thrown an illegal transition,
    // and the agent should stay terminated.
    expect(agent.status).toBe('terminated');

    // Check that we logged the error
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('error:'), expect.any(Error));

    errSpy.mockRestore();
    driver.stop();
  });
});
