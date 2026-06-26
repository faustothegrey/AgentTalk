import { Agent } from './agent.js';
import type { Registry } from '../registry/registry.js';
import type { Completer, CompleterResult, CompleterOptions } from '@agenttalk/llm-client';

// The chat plug (`Completer`) + the direct-HTTP `ApiCompleter` now live in `@agenttalk/llm-client`
// (extraction spike, 2026-06-26). This module keeps only the Registry-coupled MCP orchestration
// adapter, which depends on the engine and is NOT part of the standalone chat package.

/** Default wall-clock guard for an mcp exec turn when the caller passes no timeout (D1, M08-T1). */
export const DEFAULT_EXEC_TIMEOUT_MS = 120_000;

/**
 * Backstop grace added to an *explicit* `timeoutMs` (IMP-M08-1, D1 amendment approved by Fausto
 * 2026-06-22). When the caller passes a `timeoutMs` it is forwarded to the harness (see `complete`),
 * which owns the *primary* deadline; the completer's own timer is then a pure backstop and must fire
 * *strictly after* the harness deadline so it never pre-empts a legitimate late result. The
 * unforwarded {@link DEFAULT_EXEC_TIMEOUT_MS} has no competing timer, so it gets no grace.
 */
export const EXEC_TIMEOUT_BACKSTOP_GRACE_MS = 5_000;

/**
 * Typed rejection from {@link McpCompleter.complete} (M08-T1). `reason` distinguishes a
 * wall-clock `timeout` from a mid-exec `disconnect` (the agent going `error`/`terminated`).
 */
export class McpError extends Error {
  constructor(
    public readonly reason: 'timeout' | 'disconnect',
    message: string,
    public readonly agentId: string,
  ) {
    super(message);
    this.name = 'McpError';
  }
}

export class McpCompleter implements Completer {
  maintainsSession = true;
  constructor(private agent: Agent, private registry: Registry) {}

  async complete(prompt: string, opts?: CompleterOptions): Promise<CompleterResult> {
    // M08-T1: race the `exec_result` resolve against (a) a wall-clock timeout and (b) the agent
    // entering a terminal state mid-exec. Without these the Promise would hang forever if the
    // harness never returns (e.g. a mid-exec disconnect). The first signal wins; all listeners +
    // the timer are torn down on settle (no leak). The *lifecycle consequence* of a rejection
    // (re-deliver / fence) is deliberately NOT decided here — that is M08-T2 / M08-T3.
    // IMP-M08-1: an explicit timeout is forwarded to the harness (the primary deadline), so the
    // completer's own timer backstops it at `timeoutMs + grace` — strictly after, never racing it.
    // The unforwarded default fires at exactly DEFAULT_EXEC_TIMEOUT_MS (no competing timer).
    const guardMs = opts?.timeoutMs !== undefined
      ? opts.timeoutMs + EXEC_TIMEOUT_BACKSTOP_GRACE_MS
      : DEFAULT_EXEC_TIMEOUT_MS;

    return new Promise<CompleterResult>((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout>;

      const onResult = (result: { agentId: string; text: string; usage?: any }) => {
        if (settled || result.agentId !== this.agent.id) return;
        settled = true;
        cleanup();
        resolve({ text: result.text, usage: result.usage });
      };

      const onStatus = (evt: { id: string; status: string }) => {
        if (settled || evt.id !== this.agent.id) return;
        // Only terminal states reject. `reconnecting` is the 30s grace window — left for M08-T2.
        if (evt.status === 'error' || evt.status === 'terminated') {
          settled = true;
          cleanup();
          reject(new McpError('disconnect', `Agent ${this.agent.id} entered '${evt.status}' state during exec`, this.agent.id));
        }
      };

      const cleanup = () => {
        this.registry.off('exec_result', onResult);
        this.registry.off('status', onStatus);
        clearTimeout(timer);
      };

      this.registry.on('exec_result', onResult);
      this.registry.on('status', onStatus);

      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new McpError('timeout', `Exec for agent ${this.agent.id} timed out after ${guardMs}ms`, this.agent.id));
      }, guardMs);

      const turn: Record<string, unknown> = {
        type: 'exec_rpc',
        prompt,
      };
      if (opts?.cwd) turn.cwd = opts.cwd;
      if (opts?.timeoutMs) turn.timeoutMs = opts.timeoutMs;

      this.agent.queueExecTurn(turn);
    });
  }
}
