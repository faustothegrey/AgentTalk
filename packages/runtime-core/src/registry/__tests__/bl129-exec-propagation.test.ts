import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from '../registry.js';
import { InProcessAgentDriver } from '../../agents/in-process-driver.js';
import { McpError, execErrorReason } from '../../agents/completer.js';
import type { Completer } from '@agenttalk/llm-client';

/**
 * BL-129 — a planner exec timeout now PROPAGATES, and the liveness ping does not.
 *
 * The bug this closes was not a missing type. It was `return null`: a planner exec turn timed out,
 * the driver swallowed the rejection, the turn ended with "no text", the protocol never advanced,
 * and the team sat in `planning` FOREVER — every member `ready`, nobody owing a reply, and so
 * invisible to the non-reply sweep, to failure propagation, and to every other instrument. Observed
 * live on `team-1786704512290-3` during BL-124 S3.
 *
 * The PO chose propagation on 2026-08-14 with the blast radius stated first: `exec-timeout` is
 * FAULT-class, so `handleAgentFailure` interrupts the task and requests shutdown of every other
 * team member. A loud, reversible kill was preferred to a silent permanent wedge.
 *
 * **B2 is the bar that keeps that decision honest.** An attached agent runs an InProcessAgentDriver
 * too — it is the event→`exec_rpc` bridge — so the startup healthcheck comes through the very same
 * function. Without an exemption, a missed 25ms ping would error the agent and take the team with
 * it. A ping is not a hang, and B1 without B2 is a strictly worse system than the one it replaced.
 */
describe('BL-129 — an exec timeout propagates; a healthcheck miss does not', () => {
  let registry: Registry;
  let handleAgentFailure: ReturnType<typeof vi.spyOn>;

  const rejectingCompleter = (): Completer => ({
    maintainsSession: false,
    complete: vi.fn().mockRejectedValue(new McpError('timeout', 'simulated exec timeout', 'p1')),
  } as unknown as Completer);

  beforeEach(() => {
    registry = new Registry();
    handleAgentFailure = vi
      .spyOn((registry as any).teamCoordinator, 'handleAgentFailure')
      .mockResolvedValue(undefined as never);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await registry.destroy();
  });

  /**
   * Drives the REAL driver loop against a completer that rejects, as the guard firing does.
   *
   * Deliberately does NOT wait here: `start()` leaves the agent `ready`, so any "settled" predicate
   * evaluated at this point passes INSTANTLY, before the loop has even pulled the turn. Each bar
   * waits for its own condition instead — the first version of this helper waited for
   * `status !== 'busy'` and reported a green-looking `'busy'`, which is the same shape of vacuous
   * pass BL-129 just found in the M08-T1 test.
   */
  async function runTurn(id: string, turn: Record<string, unknown>) {
    const agent = await registry.createAgent(id, {});
    const driver = new InProcessAgentDriver(agent, registry, { completer: rejectingCompleter() });
    driver.start();
    agent.queueTurn(turn);
    return { agent, driver };
  }

  // ── B1 — the capability. Mutation: restore `return null` for McpError. ──────────────────────
  it('B1 · a planner exec timeout forces `error` and FIRES M03 propagation', async () => {
    const { agent, driver } = await runTurn('p1', { type: 'message_received', from: 'user', payload: 'go' });

    await vi.waitFor(() => expect(agent.status).toBe('error'), { timeout: 2000 });
    expect(agent.status).toBe('error');
    expect(handleAgentFailure).toHaveBeenCalledWith('p1');
    driver.stop();
  });

  // ── B2 — THE EXEMPTION. Mutation: drop `!opts?.isHealthcheck` from the rethrow condition. ───
  it('B2 · a missed HEALTHCHECK does not error the agent and does NOT propagate', async () => {
    const { agent, driver } = await runTurn('p2', {
      type: 'healthcheck',
      token: 'health-test',
      prompt: 'Reply with a short greeting confirming you are responsive.',
      timeoutMs: 25,
    });
    await new Promise((r) => setTimeout(r, 80));

    // The ping missing is a NON-event for the lifecycle: `startConversation` already reports it,
    // the agent stays usable, and the caller retries (pinned end-to-end by bl032-attach-pair-chat).
    expect(agent.status).not.toBe('error');
    expect(handleAgentFailure).not.toHaveBeenCalled();
    driver.stop();
  });

  // ── B3 — a non-McpError rejection is UNCHANGED: still swallowed, still non-fault. ───────────
  it('B3 · a generic (non-McpError) exec rejection still ends the turn quietly', async () => {
    const agent = await registry.createAgent('p3', {});
    const driver = new InProcessAgentDriver(agent, registry, {
      completer: { maintainsSession: false, complete: vi.fn().mockRejectedValue(new Error('boom')) } as unknown as Completer,
    });
    driver.start();
    agent.queueTurn({ type: 'message_received', from: 'user', payload: 'go' });
    await new Promise((r) => setTimeout(r, 60));

    // BL-084 T2's non-fault default is untouched: an unanticipated throw still must not kill a team.
    expect(agent.status).not.toBe('error');
    expect(handleAgentFailure).not.toHaveBeenCalled();
    driver.stop();
  });

  // ── B4 — the classification itself, at the boundary that produces it. ───────────────────────
  it('B4 · execErrorReason maps timeout→fault-class name and disconnect→non-fault name', () => {
    expect(execErrorReason(new McpError('timeout', 'm', 'a'))).toBe('exec-timeout');
    expect(execErrorReason(new McpError('disconnect', 'm', 'a'))).toBe('exec-disconnect');
  });
});
