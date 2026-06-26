import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InProcessAgentDriver } from '../in-process-driver.js';
import { Agent } from '../agent.js';
import { McpError } from '../completer.js';
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
    expect(registry.handleMcpToolCall).toHaveBeenCalledWith('agent-1', 'send_to_agent', expect.objectContaining({
      payload: 'my opinion',
      to: 'agent-2'
    }));

    driver.stop();
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
    expect(registry.handleMcpToolCall).toHaveBeenCalledWith('agent-1', 'fact_collection_end', { summary: 'Some facts here' });

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
});
