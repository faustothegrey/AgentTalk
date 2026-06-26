import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { ApiCompleter, McpCompleter, McpError, DEFAULT_EXEC_TIMEOUT_MS, EXEC_TIMEOUT_BACKSTOP_GRACE_MS } from '../completer.js';
import { parseStructuredResponse } from '../response-schema.js';
import type { Agent } from '../agent.js';
import type { Registry } from '../../registry/registry.js';

// M10-T4: ApiCompleter must constrain structured turns with the protocol tool while leaving
// non-structured turns byte-identical to the pre-T4 request. Driven through an injected fetchFn
// (the existing constructor seam) so no live provider call is needed.
describe('ApiCompleter (M10-T4 tool enforcement)', () => {
  let originalEnv: NodeJS.ProcessEnv;
  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-key' };
  });
  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  function captureFetch(responseJson: any) {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => responseJson });
    const bodyOf = () => JSON.parse((fetchFn.mock.calls[0]![1] as any).body);
    return { fetchFn, bodyOf };
  }

  it('sends tools + tool_choice:required + response_format on a structured turn, and decodes the tool call', async () => {
    const envelope = '{"message_type":"opinion","message_payload":{"text":"hi","proposal":null,"expected_response_types":["opinion"]}}';
    const { fetchFn, bodyOf } = captureFetch({
      choices: [{ message: { content: null, tool_calls: [{ function: { name: 'respond', arguments: envelope } }] } }],
    });

    const completer = new ApiCompleter('google', 'gemini-2.5-flash', fetchFn as any);
    const result = await completer.complete('do planning', { expectsStructured: true });

    const body = bodyOf();
    expect(Array.isArray(body.tools)).toBe(true);
    expect(body.tools[0].function.name).toBe('respond');
    expect(body.tools[0].function.parameters.properties.message_type.enum).toContain('submit_plan');
    expect(body.tool_choice).toBe('required');
    expect(body.response_format).toEqual({ type: 'json_object' });
    // Decoded tool-call arguments are handed downstream as the envelope text the parser accepts.
    expect(result.text).toBe(envelope);
    expect(parseStructuredResponse(result.text)).not.toBeNull();
  });

  it('sends NO tools/tool_choice/response_format on a non-structured turn (behavior preserved)', async () => {
    const { fetchFn, bodyOf } = captureFetch({ choices: [{ message: { content: 'plain reply' } }] });

    const completer = new ApiCompleter('google', undefined, fetchFn as any);
    const result = await completer.complete('just chat');

    const body = bodyOf();
    expect(body).not.toHaveProperty('tools');
    expect(body).not.toHaveProperty('tool_choice');
    expect(body).not.toHaveProperty('response_format');
    expect(result.text).toBe('plain reply');
  });
});

// M08-T1: deterministic, mocked-transport unit tests for the McpCompleter reject path.
// The registry is a bare EventEmitter (the completer only uses on/off + the 'exec_result'/'status'
// events); the agent is a stub exposing `id` + `queueExecTurn`. No live calls, no real transport.
function makeFakes() {
  const registry = new EventEmitter() as unknown as Registry & EventEmitter;
  const queueExecTurn = vi.fn();
  const agent = { id: 'a1', queueExecTurn } as unknown as Agent;
  return { registry, agent, queueExecTurn };
}

describe('McpCompleter', () => {
  it('resolves on exec_result, returns text+usage, and tears down all listeners (happy path, no leak)', async () => {
    const { registry, agent, queueExecTurn } = makeFakes();
    const completer = new McpCompleter(agent, registry);

    const p = completer.complete('hello', { timeoutMs: 10_000 });
    expect(queueExecTurn).toHaveBeenCalledWith(expect.objectContaining({ type: 'exec_rpc', prompt: 'hello' }));

    registry.emit('exec_result', { agentId: 'a1', text: 'hi there', usage: { prompt_tokens: 1, completion_tokens: 2 } });

    await expect(p).resolves.toEqual({ text: 'hi there', usage: { prompt_tokens: 1, completion_tokens: 2 } });
    expect(registry.listenerCount('exec_result')).toBe(0);
    expect(registry.listenerCount('status')).toBe(0);
  });

  it('ignores an exec_result addressed to a different agent', async () => {
    const { registry, agent } = makeFakes();
    const completer = new McpCompleter(agent, registry);

    let outcome: string | null = null;
    const p = completer.complete('x', { timeoutMs: 10_000 }).then(() => { outcome = 'resolved'; });

    registry.emit('exec_result', { agentId: 'OTHER', text: 'nope' });
    await Promise.resolve();
    expect(outcome).toBeNull();

    registry.emit('exec_result', { agentId: 'a1', text: 'ok' }); // settle to avoid a dangling promise
    await p;
  });

  it('rejects with a typed timeout error when no result arrives (and cleans up)', async () => {
    vi.useFakeTimers();
    try {
      const { registry, agent } = makeFakes();
      const completer = new McpCompleter(agent, registry);

      const p = completer.complete('hello', { timeoutMs: 1000 });
      const assertion = expect(p).rejects.toMatchObject({ name: 'McpError', reason: 'timeout', agentId: 'a1' });
      await vi.advanceTimersByTimeAsync(1000 + EXEC_TIMEOUT_BACKSTOP_GRACE_MS);
      await assertion;

      expect(registry.listenerCount('exec_result')).toBe(0);
      expect(registry.listenerCount('status')).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('backstops an explicit timeout at timeoutMs + grace, not at timeoutMs (IMP-M08-1)', async () => {
    // The explicit timeout is forwarded to the harness (the primary deadline); the completer's
    // own timer must fire strictly *after* it so a result landing right at timeoutMs is not
    // pre-empted by a spurious local timeout.
    vi.useFakeTimers();
    try {
      const { registry, agent } = makeFakes();
      const completer = new McpCompleter(agent, registry);

      let outcome: string | null = null;
      const p = completer.complete('hello', { timeoutMs: 1000 }).then(
        () => { outcome = 'resolved'; },
        () => { outcome = 'rejected'; },
      );

      // At exactly timeoutMs the backstop has NOT fired yet (the harness still owns the deadline).
      await vi.advanceTimersByTimeAsync(1000);
      expect(outcome).toBeNull();

      // Crossing the grace boundary fires the backstop.
      await vi.advanceTimersByTimeAsync(EXEC_TIMEOUT_BACKSTOP_GRACE_MS);
      await p;
      expect(outcome).toBe('rejected');
    } finally {
      vi.useRealTimers();
    }
  });

  it('applies the 120s default timeout when the caller passes none (D1)', async () => {
    vi.useFakeTimers();
    try {
      const { registry, agent } = makeFakes();
      const completer = new McpCompleter(agent, registry);

      const p = completer.complete('hello');
      const assertion = expect(p).rejects.toBeInstanceOf(McpError);
      await vi.advanceTimersByTimeAsync(DEFAULT_EXEC_TIMEOUT_MS);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects with a typed disconnect error when the agent goes error mid-exec (and cleans up)', async () => {
    const { registry, agent } = makeFakes();
    const completer = new McpCompleter(agent, registry);

    const p = completer.complete('hello', { timeoutMs: 10_000 });
    registry.emit('status', { id: 'a1', status: 'error' });

    await expect(p).rejects.toMatchObject({ name: 'McpError', reason: 'disconnect', agentId: 'a1' });
    expect(registry.listenerCount('exec_result')).toBe(0);
    expect(registry.listenerCount('status')).toBe(0);
  });

  it('rejects on terminated, but ignores non-terminal (reconnecting) and other-agent status', async () => {
    // terminated -> reject
    {
      const { registry, agent } = makeFakes();
      const completer = new McpCompleter(agent, registry);
      const p = completer.complete('x', { timeoutMs: 10_000 });
      registry.emit('status', { id: 'a1', status: 'terminated' });
      await expect(p).rejects.toMatchObject({ reason: 'disconnect' });
    }
    // reconnecting (grace window, left for M08-T2) + other-agent terminal -> ignored
    {
      const { registry, agent } = makeFakes();
      const completer = new McpCompleter(agent, registry);
      let outcome: string | null = null;
      const p = completer.complete('x', { timeoutMs: 10_000 }).then(
        () => { outcome = 'resolved'; },
        () => { outcome = 'rejected'; },
      );
      registry.emit('status', { id: 'a1', status: 'reconnecting' });
      registry.emit('status', { id: 'OTHER', status: 'error' });
      await Promise.resolve();
      expect(outcome).toBeNull();

      registry.emit('exec_result', { agentId: 'a1', text: 'ok' }); // settle to clean up
      await p;
    }
  });
});
