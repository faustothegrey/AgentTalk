import { createWriteStream, mkdirSync, existsSync, type WriteStream } from 'fs';
import path from 'path';
import { once } from 'events';
import type { RecordingChannel, SessionRecordingEvent, SessionRecordingMeta } from './types.js';

export class SessionRecorder {
  private readonly stream: WriteStream;
  private readonly startedAt = Date.now();
  private closePromise?: Promise<void>;

  constructor(filePath: string, cwd: string = process.cwd()) {
    const directory = path.dirname(filePath);
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
    }

    this.stream = createWriteStream(filePath, { flags: 'w' });
    const meta: SessionRecordingMeta = {
      kind: 'meta',
      version: 1,
      createdAt: new Date(this.startedAt).toISOString(),
      cwd,
    };
    this.writeLine(meta);
  }

  record(channel: RecordingChannel, event: string, payload: unknown): void {
    const entry: SessionRecordingEvent = {
      kind: 'event',
      atMs: Date.now() - this.startedAt,
      channel,
      event,
      payload,
    };
    this.writeLine(entry);
  }

  async close(): Promise<void> {
    if (this.closePromise) {
      return this.closePromise;
    }

    this.stream.end();
    this.closePromise = once(this.stream, 'close').then(() => undefined);
    return this.closePromise;
  }

  private writeLine(value: SessionRecordingMeta | SessionRecordingEvent): void {
    this.stream.write(`${JSON.stringify(value)}\n`);
  }
}
