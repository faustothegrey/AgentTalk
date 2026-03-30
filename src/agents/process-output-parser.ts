import stripAnsi from 'strip-ansi';
import { isProtocolLine } from '../protocol/protocol.js';

type ProtocolLineCallback = (line: string) => void;
type PlainTextCallback = (text: string) => void;

export class ProcessOutputParser {
  private lineBuffer: string = '';
  private pendingEchoes: string[] = [];
  private readonly onProtocolLine: ProtocolLineCallback;
  private readonly onPlainText: PlainTextCallback;

  constructor(opts: {
    onProtocolLine: ProtocolLineCallback;
    onPlainText: PlainTextCallback;
  }) {
    this.onProtocolLine = opts.onProtocolLine;
    this.onPlainText = opts.onPlainText;
  }

  /**
   * Register an outbound protocol line that should be suppressed
   * when echoed back in the input stream.
   */
  expectEcho(line: string): void {
    this.pendingEchoes.push(stripAnsi(line));
  }

  /**
   * Feed a raw chunk from stdout/stderr.
   */
  feed(chunk: string): void {
    const clean = stripAnsi(chunk);
    const afterSuppression = this.suppressEchoes(clean);
    if (!afterSuppression) return;

    this.lineBuffer += afterSuppression;
    this.drainLines();
  }

  /**
   * Flush any remaining buffered text on EOF/process exit.
   */
  flush(): void {
    if (!this.lineBuffer) return;

    const remaining = this.lineBuffer;
    this.lineBuffer = '';

    const normalized = remaining.endsWith('\r')
      ? remaining.slice(0, -1)
      : remaining;

    if (isProtocolLine(normalized)) {
      this.onProtocolLine(normalized);
      return;
    }

    this.onPlainText(remaining);
  }

  private drainLines(): void {
    let newlineIndex: number;
    while ((newlineIndex = this.lineBuffer.indexOf('\n')) !== -1) {
      const rawLine = this.lineBuffer.slice(0, newlineIndex + 1);
      this.lineBuffer = this.lineBuffer.slice(newlineIndex + 1);
      const line = rawLine.endsWith('\r\n')
        ? rawLine.slice(0, -2)
        : rawLine.slice(0, -1);
      if (isProtocolLine(line)) {
        this.onProtocolLine(line);
      } else {
        this.onPlainText(rawLine);
      }
    }
  }

  private suppressEchoes(text: string): string {
    if (!text || this.pendingEchoes.length === 0) return text;

    let remaining = text;
    while (this.pendingEchoes.length > 0) {
      const nextEcho = this.pendingEchoes[0];
      if (!nextEcho) break;

      const compareLength = Math.min(remaining.length, nextEcho.length);
      if (remaining.slice(0, compareLength) !== nextEcho.slice(0, compareLength)) {
        break;
      }

      if (remaining.length < nextEcho.length) {
        this.pendingEchoes[0] = nextEcho.slice(remaining.length);
        return '';
      }

      remaining = remaining.slice(nextEcho.length);
      this.pendingEchoes.shift();
    }
    return remaining;
  }
}
