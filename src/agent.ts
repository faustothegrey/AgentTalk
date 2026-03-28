import { createWriteStream, WriteStream, mkdirSync, existsSync } from 'fs';
import type { AgentStatus, AgentSurface } from './types.js';
import path from 'path';
import { once } from 'events';

const ALLOWED_TRANSITIONS: Record<AgentStatus, AgentStatus[]> = {
  creating:    ['starting', 'terminated'],
  starting:    ['ready', 'error', 'terminated'],
  ready:       ['busy', 'error', 'terminated'],
  busy:        ['ready', 'error', 'terminated'],
  error:       ['starting', 'terminated'],
  terminated:  [],
};

export class Agent {
  readonly id: string;
  readonly surface: AgentSurface;
  status: AgentStatus = 'creating';

  lineBuffer: string = '';
  lastSeenText: string = '';
  lastSeenClean: string = '';
  lastDedupDiverged: boolean = false;
  pendingOutboundProtocolEchoes: string[] = [];
  processedRequestIds: string[] = [];
  lastPollAt?: number;
  lastProgressAt?: number;
  launchCommand?: string;
  usage?: { total: number; limit: number };
  provider?: string;

  private transcriptStream: WriteStream;
  private destroyPromise?: Promise<void>;

  constructor(id: string, surface: AgentSurface, transcriptDir: string = './transcripts') {
    this.id = id;
    this.surface = surface;

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
