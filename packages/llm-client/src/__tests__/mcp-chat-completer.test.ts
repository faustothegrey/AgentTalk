import { describe, it, expect, vi } from 'vitest';
import { McpChatCompleter, McpExecError, DEFAULT_EXEC_TIMEOUT_MS } from '../mcp-chat-completer.js';
import type { ExecTransport, ExecTurn, ExecResult } from '../mcp-chat-completer.js';

// A fake ExecTransport: records dispatched turns, lets the test fire a result/disconnect, and
// counts unsubscribes so we can assert no listener leak after settle.
function fakeTransport(withDisconnect = true) {
  let resultCb: ((r: ExecResult) => void) | null = null;
  let disconnectCb: (() => void) | null = null;
  const dispatched: ExecTurn[] = [];
  let resultUnsubs = 0;
  let disconnectUnsubs = 0;

  const transport: ExecTransport = {
    dispatch: (t) => { dispatched.push(t); },
    onResult: (cb) => { resultCb = cb; return () => { resultUnsubs++; resultCb = null; }; },
  };
  if (withDisconnect) {
    transport.onDisconnect = (cb) => { disconnectCb = cb; return () => { disconnectUnsubs++; disconnectCb = null; }; };
  }
  return {
    transport,
    dispatched,
    emitResult: (r: ExecResult) => resultCb?.(r),
    emitDisconnect: () => disconnectCb?.(),
    get resultUnsubs() { return resultUnsubs; },
    get disconnectUnsubs() { return disconnectUnsubs; },
  };
}

describe('McpChatCompleter (registry-free MCP plug)', () => {
  it('dispatches the turn then resolves on result (text+usage), tearing down listeners (no leak)', async () => {
    const t = fakeTransport();
    const completer = new McpChatCompleter(t.transport);

    const p = completer.complete('hello', { timeoutMs: 10_000 });
    expect(t.dispatched).toEqual([{ prompt: 'hello', timeoutMs: 10_000 }]);

    t.emitResult({ text: 'hi there', usage: { prompt_tokens: 1, completion_tokens: 2 } });
    await expect(p).resolves.toEqual({ text: 'hi there', usage: { prompt_tokens: 1, completion_tokens: 2 } });
    expect(t.resultUnsubs).toBe(1);
    expect(t.disconnectUnsubs).toBe(1);
  });

  it('forwards cwd + timeoutMs onto the dispatched turn', async () => {
    const t = fakeTransport();
    const completer = new McpChatCompleter(t.transport);
    const p = completer.complete('go', { cwd: '/work', timeoutMs: 5_000 });
    expect(t.dispatched[0]).toEqual({ prompt: 'go', cwd: '/work', timeoutMs: 5_000 });
    t.emitResult({ text: 'ok' });
    await p;
  });

  it('rejects with a typed timeout error and cleans up', async () => {
    vi.useFakeTimers();
    try {
      const t = fakeTransport();
      const completer = new McpChatCompleter(t.transport);
      const p = completer.complete('hello', { timeoutMs: 1000 });
      const assertion = expect(p).rejects.toMatchObject({ name: 'McpExecError', reason: 'timeout' });
      await vi.advanceTimersByTimeAsync(1000);
      await assertion;
      expect(t.resultUnsubs).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('applies the default 120s timeout when none is given', async () => {
    vi.useFakeTimers();
    try {
      const t = fakeTransport();
      const completer = new McpChatCompleter(t.transport);
      const p = completer.complete('hello');
      const assertion = expect(p).rejects.toBeInstanceOf(McpExecError);
      await vi.advanceTimersByTimeAsync(DEFAULT_EXEC_TIMEOUT_MS);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects with a typed disconnect error when the executor drops mid-turn', async () => {
    const t = fakeTransport();
    const completer = new McpChatCompleter(t.transport);
    const p = completer.complete('hello', { timeoutMs: 10_000 });
    t.emitDisconnect();
    await expect(p).rejects.toMatchObject({ name: 'McpExecError', reason: 'disconnect' });
    expect(t.resultUnsubs).toBe(1);
  });

  it('ignores a late result after settling (idempotent)', async () => {
    const t = fakeTransport();
    const completer = new McpChatCompleter(t.transport);
    const p = completer.complete('hello', { timeoutMs: 10_000 });
    t.emitResult({ text: 'first' });
    t.emitResult({ text: 'second' }); // after settle -> ignored
    await expect(p).resolves.toEqual({ text: 'first' });
  });

  it('works with a transport that has no onDisconnect (optional)', async () => {
    const t = fakeTransport(false);
    const completer = new McpChatCompleter(t.transport);
    const p = completer.complete('hello', { timeoutMs: 10_000 });
    t.emitResult({ text: 'ok' });
    await expect(p).resolves.toEqual({ text: 'ok' });
    expect(t.disconnectUnsubs).toBe(0);
  });
});
