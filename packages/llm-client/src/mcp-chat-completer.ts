import type { Completer, CompleterResult, CompleterOptions } from './completer.js';

/** Default wall-clock guard for an exec turn when the caller passes no timeout. */
export const DEFAULT_EXEC_TIMEOUT_MS = 120_000;

/** A single exec turn dispatched to an attached executor. */
export interface ExecTurn {
  prompt: string;
  cwd?: string;
  timeoutMs?: number;
}

/** The result an executor returns for an exec turn. */
export interface ExecResult {
  text: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

/**
 * Typed rejection from {@link McpChatCompleter.complete}. `reason` distinguishes a wall-clock
 * `timeout` from the executor `disconnect`ing mid-turn (mirrors runtime-core's McpError, but
 * Registry-free and agent-id-free — this layer knows only "a turn" and "a transport").
 */
export class McpExecError extends Error {
  constructor(public readonly reason: 'timeout' | 'disconnect', message: string) {
    super(message);
    this.name = 'McpExecError';
  }
}

/**
 * The exec-subset transport an {@link McpChatCompleter} drives: dispatch ONE turn to an attached
 * executor (an MCP client speaking the wire-contract's `await_turn`/`submit_exec_result` pair) and
 * surface its result + (optionally) a mid-turn disconnect. Registry-free and consensus-free — the
 * concrete WebSocket/MCP adapter that hosts the attach endpoint is provided by the consumer (and
 * AgentTalk's existing Agent + mcp-tools can implement this interface to reuse the completer).
 */
export interface ExecTransport {
  /** Send a turn to the attached executor (queued for its next `await_turn`). */
  dispatch(turn: ExecTurn): void;
  /** Subscribe to results. Returns an unsubscribe fn. */
  onResult(cb: (result: ExecResult) => void): () => void;
  /** Subscribe to a mid-turn executor disconnect. Returns an unsubscribe fn. Optional. */
  onDisconnect?(cb: () => void): () => void;
}

export interface McpChatCompleterOptions {
  /** Wall-clock guard applied when `complete` is called with no `timeoutMs` (default 120s). */
  defaultTimeoutMs?: number;
}

/**
 * A {@link Completer} backed by an external executor over an {@link ExecTransport} (the MCP plug).
 * `maintainsSession=true`: the executor owns its own conversation, so a multi-turn wrapper sends
 * only the latest turn. Each `complete` dispatches one turn and races its result against a
 * wall-clock timeout and an optional disconnect; the first signal wins and all listeners + the timer
 * are torn down on settle (no leak). Mirrors runtime-core's McpCompleter race, decoupled from the engine.
 */
export class McpChatCompleter implements Completer {
  maintainsSession = true;
  private readonly defaultTimeoutMs: number;

  constructor(private readonly transport: ExecTransport, opts?: McpChatCompleterOptions) {
    this.defaultTimeoutMs = opts?.defaultTimeoutMs ?? DEFAULT_EXEC_TIMEOUT_MS;
  }

  complete(prompt: string, opts?: CompleterOptions): Promise<CompleterResult> {
    const timeoutMs = opts?.timeoutMs ?? this.defaultTimeoutMs;

    return new Promise<CompleterResult>((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout>;
      const offs: Array<() => void> = [];
      const cleanup = () => {
        for (const off of offs) off();
        clearTimeout(timer);
      };

      // Subscribe BEFORE dispatch so a synchronous result can't be missed.
      offs.push(this.transport.onResult((result) => {
        if (settled) return;
        settled = true;
        cleanup();
        const ret: CompleterResult = { text: result.text };
        if (result.usage) ret.usage = result.usage;
        resolve(ret);
      }));

      if (this.transport.onDisconnect) {
        offs.push(this.transport.onDisconnect(() => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(new McpExecError('disconnect', 'Executor disconnected during exec'));
        }));
      }

      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new McpExecError('timeout', `Exec timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const turn: ExecTurn = { prompt };
      if (opts?.cwd !== undefined) turn.cwd = opts.cwd;
      if (opts?.timeoutMs !== undefined) turn.timeoutMs = opts.timeoutMs;
      this.transport.dispatch(turn);
    });
  }
}
