import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, readFileSync, existsSync, rmSync, chmodSync, mkdirSync } from 'fs';
import os from 'os';
import path from 'path';
import { Registry } from '@agenttalk/runtime-core/registry/registry';
import { NonReplySink, defaultNonReplySinkPath } from '@agenttalk/observability/recordings/non-reply-sink';
import { startServer } from '../server.js';
import type { AgentNonReplyNotice } from '@agenttalk/contracts/types';

/**
 * BL-124 S1 — bars B1–B7 for the always-on non-reply sink.
 *
 * The item in one line: T3a's whole case for shipping alone was measurement, and on the live
 * instance the measurement reached nothing durable — the recorder is `recorder?.record(...)` over a
 * recorder that only exists under an env var the launchd unit does not set. These bars pin the
 * property that fixes the CLASS of that defect, not the instance: an output that no configuration
 * can switch off.
 *
 * Every bar names the mutation that must turn it red, because a bar nobody has seen fail is a bar
 * nobody has tested. Notices are emitted directly on the registry's event surface, deliberately:
 * what S1 owns is the SINK and its WIRING. Whether the sweep produces the right notice is T3a/T3b's
 * business and lives in the runtime-core suite — duplicating it here would couple these bars to a
 * 30s timer for no added coverage.
 */
describe('BL-124 S1 — the non-reply sink cannot be switched off', () => {
  let registry: Registry;
  let server: any;
  let dir: string;
  let sinkPath: string;
  let sink: NonReplySink;

  const notice: AgentNonReplyNotice = {
    agentId: 'silent-1',
    reason: 'quiet',
    silentForMs: 184_200,
    turnId: 'turn-silent-1',
    observedAt: '2026-08-13T14:24:31.123Z',
  };

  function linesFrom(file: string): any[] {
    if (!existsSync(file)) return [];
    return readFileSync(file, 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  }

  const notices = (file: string) => linesFrom(file).filter(l => l.kind === 'notice');

  async function startWith(injected: NonReplySink | undefined) {
    server = startServer(registry, 0, injected ? { nonReplySink: injected } : {});
    // See server.test.ts: await the MCP bind so its env write cannot land after the test finishes.
    await server.mcpReady;
  }

  beforeEach(() => {
    registry = new Registry();
    dir = mkdtempSync(path.join(os.tmpdir(), 'bl124-sink-'));
    sinkPath = path.join(dir, 'nested', 'agent-non-reply.jsonl');
    sink = new NonReplySink(sinkPath);
  });

  afterEach(async () => {
    sink.close();
    if (server) await new Promise(resolve => server.close(resolve));
    await registry.destroy();
    rmSync(dir, { recursive: true, force: true });
    server = undefined;
    vi.unstubAllEnvs();
  });

  /**
   * B1 — THE bar this item is about. No recorder, no `AGENTTALK_RECORDING_PATH`, no configuration
   * of any kind: the line still lands. `startServer` is given the sink only to redirect its PATH
   * away from the real measurement — never to enable it.
   */
  it('B1 · a notice lands with NO env configuration at all (mutation: gate the sink on any env var)', async () => {
    vi.stubEnv('AGENTTALK_RECORDING_PATH', '');
    vi.stubEnv('AGENTTALK_NON_REPLY_SINK_PATH', '');
    await startWith(sink);

    registry.emit('agent_non_reply', notice);

    const recorded = notices(sinkPath);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ kind: 'notice', agentId: 'silent-1', turnId: 'turn-silent-1' });
  });

  /**
   * B1b — the sink is constructed even when the caller passes NO options at all. This is the bar
   * that would have caught the original defect: `recorder?.record(...)` was well-formed, tested,
   * and a no-op in production because the object was absent. Here the default path is redirected
   * by env so the assertion never touches the real measurement.
   */
  it('B1b · with NO options passed, the default sink still writes (mutation: `options.nonReplySink ? … : undefined`)', async () => {
    const envPath = path.join(dir, 'from-default', 'sink.jsonl');
    vi.stubEnv('AGENTTALK_NON_REPLY_SINK_PATH', envPath);
    await startWith(undefined);

    registry.emit('agent_non_reply', notice);

    expect(notices(envPath)).toHaveLength(1);
  });

  /**
   * B2 — the measurement is CARRIED, not recomputed. T3c's threshold is derived from these two
   * fields; a sink that re-derives them measures its own clock instead of the sweep's observation.
   */
  it('B2 · silentForMs and reason equal the notice exactly (mutation: recompute or round either)', async () => {
    await startWith(sink);

    registry.emit('agent_non_reply', notice);

    const [line] = notices(sinkPath);
    expect(line.silentForMs).toBe(184_200);
    expect(line.reason).toBe('quiet');
    // `ts` is the notice's own observation instant, not the sink's write time.
    expect(line.ts).toBe('2026-08-13T14:24:31.123Z');
  });

  /**
   * B3 — both reasons survive and stay distinguishable. T3b split `awaiting-input` out of `quiet`
   * precisely because a human-blocked agent and a dead one are observationally identical under a
   * bare timeout; a sink that flattened them would undo T3b at the point of recording.
   */
  it('B3 · awaiting-input and quiet are both recorded and distinguishable (mutation: filter either out)', async () => {
    await startWith(sink);

    registry.emit('agent_non_reply', notice);
    registry.emit('agent_non_reply', { ...notice, agentId: 'silent-2', reason: 'awaiting-input' });

    const reasons = notices(sinkPath).map(l => l.reason);
    expect(reasons).toEqual(['quiet', 'awaiting-input']);
  });

  /**
   * B4 — the sink is a PURE READER. This is the property T3a bought with the whole advisory design
   * and the one T3c inherits the obligation to keep: nothing on this path may reach
   * `setAgentStatus` or `handleAgentFailure`. An observability sink that could change agent state
   * would be a kill switch wearing a logger's clothes.
   */
  it('B4 · recording changes no agent state and propagates nothing (mutation: let the sink act on the sweep)', async () => {
    await startWith(sink);
    await registry.createAgent('silent-1', { provider: 'claude' });
    const before = registry.getAgent('silent-1').status;
    const failureSpy = vi.fn();
    registry.on('agent_failure', failureSpy);

    registry.emit('agent_non_reply', notice);

    expect(notices(sinkPath)).toHaveLength(1);
    expect(registry.getAgent('silent-1').status).toBe(before);
    expect(failureSpy).not.toHaveBeenCalled();
  });

  /**
   * B5 — nothing escapes. The handler runs synchronously inside the registry's `emit`, inside
   * `checkIdleAgents`, inside an UNGUARDED `setInterval`: an escaping throw is an orchestrator
   * crash, not a lost line — and it lands after the dedup has already suppressed the retry.
   *
   * A degraded sink must be LOUD. Silence is the exact failure being retired, so the bar asserts
   * the complaint as well as the survival.
   */
  it('B5 · an unwritable path degrades loudly instead of throwing (mutation: let the write throw uncaught)', async () => {
    const blocked = path.join(dir, 'blocked');
    mkdirSync(blocked);
    chmodSync(blocked, 0o500); // read+execute, no write
    const brokenSink = new NonReplySink(path.join(blocked, 'sink.jsonl'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await startWith(brokenSink);

    expect(() => registry.emit('agent_non_reply', notice)).not.toThrow();

    expect(brokenSink.isDegraded).toBe(true);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('DEGRADED'));
    chmodSync(blocked, 0o700);
    errorSpy.mockRestore();
  });

  it('B5b · an unserializable notice does not throw into the sweep (mutation: drop the try/catch)', async () => {
    await startWith(sink);
    const circular: any = { ...notice, agentId: 'circular-1' };
    circular.reason = circular; // JSON.stringify throws on this
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => registry.emit('agent_non_reply', circular)).not.toThrow();

    errorSpy.mockRestore();
  });

  it('B5c · a missing agent yields transport null rather than a throw (mutation: call getAgent unguarded)', async () => {
    await startWith(sink);

    // No agent 'silent-1' was ever created — `registry.getAgent` THROWS on a miss.
    expect(() => registry.emit('agent_non_reply', notice)).not.toThrow();

    expect(notices(sinkPath)[0].transport).toBeNull();
  });

  /**
   * B7 — the sink APPENDS. The nearest precedent, `SessionRecorder`, opens with `flags: 'w'` and
   * truncates on construction; the live unit shows 41 startup banners and S2's own deploy step is a
   * restart. Copying the house pattern here would erase the measurement at the moment of
   * installing it.
   */
  /**
   * Asserted against the SINK directly, not through two servers. A restart is a new process with a
   * new Registry; modelling it by starting a second server on the SAME registry leaves the first
   * server's listener attached, so both sinks record the second notice and the bar fails on a
   * duplicate that no real restart could produce. The property under test — bytes written before a
   * restart survive the next construction — belongs to the sink, and B1 already covers the wiring.
   */
  it('B7 · a restart does not truncate what earlier boots wrote (mutation: open with flags: "w")', () => {
    const first = new NonReplySink(sinkPath);
    first.record(notice, 'attached');
    first.close();

    // A second process against the same path — the restart.
    const rebooted = new NonReplySink(sinkPath);
    rebooted.record({ ...notice, agentId: 'silent-after-restart' }, null);
    rebooted.close();

    expect(notices(sinkPath).map(l => l.agentId)).toEqual(['silent-1', 'silent-after-restart']);
    // …and the boundary is visible, so a reduction can never span a restart unknowingly.
    expect(linesFrom(sinkPath).filter(l => l.kind === 'boot')).toHaveLength(2);
  });

  it('transport is recorded from the agent when there is one (the S3 axis)', async () => {
    await startWith(sink);
    await registry.createAgent('silent-1', { transport: 'attached', vendor: 'claude' } as any);

    registry.emit('agent_non_reply', notice);

    expect(notices(sinkPath)[0].transport).toBe('attached');
  });

  it('the default path is outside the repo and is redirected, never disabled, by env', () => {
    vi.stubEnv('AGENTTALK_NON_REPLY_SINK_PATH', '');
    expect(defaultNonReplySinkPath()).toBe(path.join(os.homedir(), '.agenttalk', 'agent-non-reply.jsonl'));
    vi.stubEnv('AGENTTALK_NON_REPLY_SINK_PATH', '/tmp/elsewhere.jsonl');
    expect(defaultNonReplySinkPath()).toBe('/tmp/elsewhere.jsonl');
  });
});
