import { appendFileSync, mkdirSync } from 'fs';
import os from 'os';
import path from 'path';
import type { AgentNonReplyNotice, AgentTransport } from '@agenttalk/contracts/types';

/**
 * BL-124 S1 — the non-reply advisory's one channel that a deployment cannot switch off.
 *
 * WHY THIS EXISTS, because it is not obvious from the outside: BL-028 T3a shipped the idle sweep
 * and justified shipping it alone by MEASUREMENT — "we measure, for the first time, how long real
 * turns actually go quiet". It then emitted `agent_non_reply` into three consumers, and on the one
 * instance that sees real traffic all three failed differently:
 *
 *   - the recorder (`server.ts` — `recorder?.record(...)`) exists only under
 *     `AGENTTALK_RECORDING_PATH`, which the live launchd unit does not set. An optional chain over
 *     an absent recorder is a **silent no-op: it emits nothing, including no complaint**, and that
 *     went unnoticed for three days;
 *   - the WS broadcast needs a human watching a browser at the instant of emission;
 *   - `console.warn` is durable but unstructured, in a 2 MB mixed log.
 *
 * So the defect being corrected is NOT "the env var was unset" — it is that a measurement device
 * had no unconditional output. Setting the env var reproduces the defect class. **This sink is
 * always on.** There is deliberately no flag, no env gate, and no way to disable it; the env knob
 * below only REDIRECTS the path, and cannot switch the sink off.
 *
 * Two properties are load-bearing and both are pinned by bars:
 *
 *   1. **It appends** (`appendFileSync`, never a truncating open). The nearest precedent in this
 *      repo, `SessionRecorder`, opens a `createWriteStream` with `flags: 'w'` and TRUNCATES on
 *      construction. Copying it would erase the measurement on every restart — and the live unit
 *      shows 41 startup banners, with a restart built into the deploy step that installs this very
 *      sink. (Bar B7.)
 *
 *      The append is SYNCHRONOUS, deliberately, and a buffered `WriteStream` was tried first and
 *      rejected on two counts. A stream's bytes are not on disk when `write` returns, so a notice
 *      observed seconds before an orchestrator crash — exactly the event this sink exists to
 *      capture — can be lost in the buffer. And a stream reports EACCES asynchronously via an
 *      'error' event, OUTSIDE the `try` that is supposed to contain it, which is the one guarantee
 *      this class cannot afford to weaken. At one line per silent turn, per 30s sweep, the cost of
 *      a synchronous append is not measurable.
 *   2. **Nothing it does can throw into the caller.** Its `record` runs synchronously inside the
 *      registry's `emit`, inside `checkIdleAgents`, inside an UNGUARDED `setInterval`. An escaping
 *      throw there does not lose a measurement, it takes down the orchestrator — and it would do so
 *      after the sweep's dedup has already marked the notice reported, so the retry is suppressed
 *      too. (Bar B5.)
 *
 * A degraded sink is NOISY, never silent. That distinction is the whole point of the item: if this
 * cannot write, it says so on stderr. What it must never do is fail the way `recorder?.` failed.
 */

/** Where notices land when nothing overrides it. Outside the repo, so no worktree can carry it. */
export function defaultNonReplySinkPath(): string {
  const override = process.env.AGENTTALK_NON_REPLY_SINK_PATH;
  if (override && override.trim()) {
    return override.trim();
  }
  return path.join(os.homedir(), '.agenttalk', 'agent-non-reply.jsonl');
}

/**
 * One recorded notice. `transport` is NOT on `AgentNonReplyNotice` — it is resolved by the caller
 * from the registry and passed in, and it is `null` when the agent is gone or genuinely carries no
 * transport. `null` is its own bucket in the S3 reduction: attributing an unknown transport to a
 * known one is the exact attached-vs-in-process confusion (BL-120) this field exists to prevent.
 */
export interface NonReplySinkNoticeLine {
  kind: 'notice';
  /** The notice's own `observedAt`, carried through unchanged — never a recomputed clock read. */
  ts: string;
  agentId: string;
  turnId: string;
  reason: string;
  silentForMs: number;
  transport: AgentTransport | null;
}

/**
 * A process-start marker. The sweep's state (`lastProgressAt`, `currentTurnId`, the dedup map) is
 * rebuilt on every boot, so a turn must accumulate its silence INSIDE one boot. A reduction that
 * spans a restart without saying so is measuring across a discontinuity.
 */
export interface NonReplySinkBootLine {
  kind: 'boot';
  ts: string;
  pid: number;
}

export type NonReplySinkLine = NonReplySinkNoticeLine | NonReplySinkBootLine;

export class NonReplySink {
  private directoryReady = false;
  private degraded = false;
  private complained = false;
  private bootPending = true;

  /**
   * The path is a CONSTRUCTOR ARGUMENT with a live default, not an env-only knob: the sink must
   * work with no environment configuration at all (B1), while tests must not write into the real
   * measurement (which would corrupt the thing being measured).
   *
   * Nothing is opened here. `UsageHistoryStore` is the house pattern for an always-on store — it
   * reads at construction and writes only when there is something to write — and following it means
   * merely constructing a server never creates a file.
   */
  constructor(private readonly filePath: string = defaultNonReplySinkPath()) {}

  /** Where this sink writes. Exposed so a failure can name a path instead of a mystery. */
  get path(): string {
    return this.filePath;
  }

  /** True once a write has failed. The sink stays constructed and keeps refusing loudly. */
  get isDegraded(): boolean {
    return this.degraded;
  }

  record(notice: AgentNonReplyNotice, transport: AgentTransport | null = null): void {
    const line: NonReplySinkNoticeLine = {
      kind: 'notice',
      ts: notice.observedAt,
      agentId: notice.agentId,
      turnId: notice.turnId,
      // Carried through, NOT recomputed or rounded: this pair is the measurement T3c consumes,
      // and a sink that re-derives it is measuring itself rather than the sweep. (Bar B2.)
      reason: notice.reason,
      silentForMs: notice.silentForMs,
      transport,
    };
    this.write(line);
  }

  /**
   * Nothing is held open, so there is nothing to flush. Kept because callers own a lifecycle and
   * a sink that cannot be closed invites one to be invented later.
   */
  close(): void {
    this.directoryReady = false;
  }

  /**
   * The single guarded path. Every failure mode — the directory cannot be created, the file cannot
   * be opened, the payload will not serialize, the disk rejects the write — lands here and stops
   * here. See the class comment for why an escaping throw is worse than a missing line.
   */
  private write(line: NonReplySinkLine): void {
    if (this.degraded) {
      return;
    }
    try {
      // Serialize BEFORE the boot marker is committed: an unserializable payload must not leave a
      // boot line implying a session that then recorded nothing.
      const payload = `${JSON.stringify(line)}\n`;
      if (!this.directoryReady) {
        mkdirSync(path.dirname(this.filePath), { recursive: true });
        this.directoryReady = true;
      }
      if (this.bootPending) {
        this.bootPending = false;
        appendFileSync(this.filePath, `${JSON.stringify({ kind: 'boot', ts: new Date().toISOString(), pid: process.pid } satisfies NonReplySinkBootLine)}\n`);
      }
      appendFileSync(this.filePath, payload);
    } catch (error) {
      this.degrade(error);
    }
  }

  /**
   * Fail LOUDLY and once. Loudly, because a silent no-op is the precise defect BL-124 exists to
   * retire — an instrument that stops working must not do so quietly. Once, because the sweep runs
   * every 30s and a broken sink would otherwise bury the complaint in its own repetition, which is
   * the same reasoning the sweep applies to its own dedup.
   */
  private degrade(error: unknown): void {
    this.degraded = true;
    if (this.complained) {
      return;
    }
    this.complained = true;
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[NonReplySink] DEGRADED — cannot write ${this.filePath}: ${reason}. Non-reply notices are NOT being recorded.`);
  }
}
