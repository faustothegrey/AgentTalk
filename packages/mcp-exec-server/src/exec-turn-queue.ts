import type { ExecResult } from '@agenttalk/llm-client';

/** The wire turn handed to a client via `await_turn` (its executor checks `type === 'exec_rpc'`). */
export interface WireExecTurn {
  type: 'exec_rpc';
  prompt: string;
  cwd?: string;
  timeoutMs?: number;
}

/**
 * Per-agent exec turn queue (v1: minimal single-flight — one turn in flight at a time; a chat turn
 * is short, and the reused McpServer already handles dead sockets at the ping layer, so there is no
 * M08-style reconnect/re-delivery here). Bridges the two sides of one exec turn:
 *  - the CLIENT long-polls `awaitTurn()` (resolves with the next dispatched turn);
 *  - the COMPLETER `dispatch()`es a turn and listens via `onResult`/`onDisconnect`;
 *  - the client returns output via `submitResult()`, which fans out to result listeners.
 */
export class ExecTurnQueue {
  private pendingTurns: WireExecTurn[] = [];
  private turnWaiters: Array<(turn: WireExecTurn) => void> = [];
  private resultListeners = new Set<(r: ExecResult) => void>();
  private disconnectListeners = new Set<() => void>();

  /** CLIENT side: resolve with the next turn, or block until one is dispatched. */
  awaitTurn(): Promise<WireExecTurn> {
    const queued = this.pendingTurns.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise((resolve) => {
      this.turnWaiters.push(resolve);
    });
  }

  /** COMPLETER side: hand a turn to a waiting `awaitTurn`, or queue it for the next poll. */
  dispatch(turn: WireExecTurn): void {
    const waiter = this.turnWaiters.shift();
    if (waiter) waiter(turn);
    else this.pendingTurns.push(turn);
  }

  /** CLIENT side: deliver the turn's output to the completer's result listeners. */
  submitResult(result: ExecResult): void {
    for (const cb of [...this.resultListeners]) cb(result);
  }

  /** Fired when the client socket drops; notifies completer listeners and drops any turn waiters. */
  handleDisconnect(): void {
    this.turnWaiters = [];
    for (const cb of [...this.disconnectListeners]) cb();
  }

  onResult(cb: (r: ExecResult) => void): () => void {
    this.resultListeners.add(cb);
    return () => this.resultListeners.delete(cb);
  }

  onDisconnect(cb: () => void): () => void {
    this.disconnectListeners.add(cb);
    return () => this.disconnectListeners.delete(cb);
  }
}
