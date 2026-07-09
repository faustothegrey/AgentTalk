import { createWriteStream, WriteStream, mkdirSync, existsSync } from 'fs';
import type {
  AgentExecutionMode,
  AgentProvider,
  AgentSessionStatus,
  AgentStatus,
  ResolvedExecutionMode,
  WorkflowRole,
} from '@agenttalk/contracts/types';
import path from 'path';
import { once } from 'events';

const ALLOWED_TRANSITIONS: Record<AgentStatus, AgentStatus[]> = {
  creating:    ['starting', 'terminated'],
  starting:    ['ready', 'error', 'terminated'],
  ready:       ['busy', 'error', 'reconnecting', 'terminated'],
  busy:        ['ready', 'error', 'reconnecting', 'terminated'],
  reconnecting:['ready', 'busy', 'error', 'terminated'],
  error:       ['starting', 'terminated'],
  terminated:  [],
};

export class Agent {
  readonly id: string;
  status: AgentStatus = 'creating';

  processedRequestIds: string[] = [];
  lastProgressAt?: number;
  usage?: { total: number; limit: number };
  usageStats?: { stats: string; timestamp: string };
  provider?: AgentProvider;
  providerName?: string;
  model?: string;
  requestedExecutionMode: AgentExecutionMode = 'auto';
  resolvedExecutionMode?: ResolvedExecutionMode;
  sessionStatus?: AgentSessionStatus;
  currentTurnId?: string | undefined;
  workflowRole?: WorkflowRole;

  private pendingTurns: Array<Record<string, unknown>> = [];
  private turnResolvers: Array<(turn: Record<string, unknown>) => void> = [];

  private pendingExecTurns: Array<Record<string, unknown>> = [];
  private execTurnResolvers: Array<(turn: Record<string, unknown>) => void> = [];

  private transcriptStream: WriteStream;
  private destroyPromise?: Promise<void>;

  constructor(id: string, transcriptDir: string = './transcripts') {
    this.id = id;

    if (!existsSync(transcriptDir)) {
      mkdirSync(transcriptDir, { recursive: true });
    }

    this.transcriptStream = createWriteStream(path.join(transcriptDir, `${id}.log`), { flags: 'a' });
  }

  appendToTranscript(text: string): void {
    if (text) {
      this.transcriptStream.write(text);
    }
  }

  setStatus(newStatus: AgentStatus): void {
    const allowed = ALLOWED_TRANSITIONS[this.status];
    if (!allowed.includes(newStatus)) {
      throw new Error(`[Agent ${this.id}] Invalid transition: ${this.status} -> ${newStatus}`);
    }
    console.log(`[Agent ${this.id}] ${this.status} -> ${newStatus}`);
    this.status = newStatus;
  }

  processedTurnIds: Set<string> = new Set();
  activeTurn?: Record<string, unknown> | undefined;
  // Exec-turn sibling of `activeTurn` (M08-T2): the exec_rpc turn currently in flight at the
  // harness (delivered, not yet `submit_exec_result`). Set on delivery, cleared on result; used
  // to re-deliver the interrupted exec turn after an in-window reconnect (IMP-T3b-1).
  activeExecTurn?: Record<string, unknown> | undefined;

  queueTurn(turn: Record<string, unknown>, atHead = false): void {
    if (this.turnResolvers.length > 0) {
      const resolve = this.turnResolvers.shift()!;
      this.activeTurn = turn;
      resolve(turn);
    } else {
      if (atHead) {
        this.pendingTurns.unshift(turn);
      } else {
        this.pendingTurns.push(turn);
      }
    }
  }

  awaitTurn(): Promise<Record<string, unknown>> {
    if (this.pendingTurns.length > 0) {
      const turn = this.pendingTurns.shift()!;
      this.activeTurn = turn;
      return Promise.resolve(turn);
    }
    return new Promise((resolve) => {
      this.turnResolvers.push((turn) => {
        this.activeTurn = turn;
        resolve(turn);
      });
    });
  }

  queueExecTurn(turn: Record<string, unknown>, atHead = false): void {
    if (this.execTurnResolvers.length > 0) {
      const resolve = this.execTurnResolvers.shift()!;
      this.activeExecTurn = turn;
      resolve(turn);
    } else {
      if (atHead) {
        this.pendingExecTurns.unshift(turn);
      } else {
        this.pendingExecTurns.push(turn);
      }
    }
  }

  awaitExecTurn(): Promise<Record<string, unknown>> {
    if (this.pendingExecTurns.length > 0) {
      const turn = this.pendingExecTurns.shift()!;
      this.activeExecTurn = turn;
      return Promise.resolve(turn);
    }
    return new Promise((resolve) => {
      this.execTurnResolvers.push((turn) => {
        this.activeExecTurn = turn;
        resolve(turn);
      });
    });
  }

  // Drop pending `await_turn` waiters bound to a now-dead connection. Without this, a
  // resolver left over from a dropped socket sits at the head of the queue and silently
  // eats the first turn delivered after a reconnect (its response goes to the closed
  // socket). Queued turns (`pendingTurns`) are intentionally preserved. Returns the count
  // discarded (for logging).
  clearTurnWaiters(): number {
    const dropped = this.turnResolvers.length;
    this.turnResolvers = [];
    return dropped;
  }

  // Exec-turn sibling of `clearTurnWaiters` (M08-T2): drop `exec_rpc` waiters bound to a now-dead
  // socket so a stale resolver can't silently eat the exec turn re-delivered after a reconnect
  // (its result would go to the closed socket). Queued exec turns (`pendingExecTurns`) are
  // intentionally preserved. Returns the count discarded (for logging).
  clearExecTurnWaiters(): number {
    const dropped = this.execTurnResolvers.length;
    this.execTurnResolvers = [];
    return dropped;
  }

  destroy(): Promise<void> {
    if (this.destroyPromise) {
      return this.destroyPromise;
    }

    if (this.transcriptStream.closed) {
      this.destroyPromise = Promise.resolve();
      return this.destroyPromise;
    }

    this.transcriptStream.end();
    this.destroyPromise = once(this.transcriptStream, 'close').then(() => undefined);
    return this.destroyPromise;
  }
}
