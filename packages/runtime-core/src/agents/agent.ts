import { createWriteStream, WriteStream, mkdirSync, existsSync } from 'fs';
import type {
  AgentExecutionMode,
  AgentSessionStatus,
  AgentStatus,
  ResolvedExecutionMode,
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
  provider?: string;
  providerName?: string;
  model?: string;
  requestedExecutionMode: AgentExecutionMode = 'auto';
  resolvedExecutionMode?: ResolvedExecutionMode;
  sessionStatus?: AgentSessionStatus;
  currentTurnId?: string | undefined;

  private pendingTurns: Array<Record<string, unknown>> = [];
  private turnResolvers: Array<(turn: Record<string, unknown>) => void> = [];

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
