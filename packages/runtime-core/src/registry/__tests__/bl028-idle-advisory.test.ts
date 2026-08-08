import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from '../registry.js';
import type { AgentNonReplyNotice } from '@agenttalk/contracts/types';

/**
 * BL-028 T3a — the idle sweep goes live, and it CANNOT kill.
 *
 * The mechanism this revives had never executed. `lastProgressAt` was declared, read twice and
 * written nowhere (LB-70), so `hasAgentTimedOut()` always returned false. The item called that
 * "doubly dead" — the second deadness being that only `busy` agents were swept.
 *
 * ⛔ CORRECTION 2026-08-07 ([[BL-120]], hmp6). This header claimed a THIRD deadness — that an
 * attached agent "essentially never reaches `status === 'busy'`", so the item's headline fix would
 * have revived the sweep for in-process agents ONLY. **THAT WAS FALSE.** `activateAgent` starts an
 * `InProcessAgentDriver` for BOTH transports (only the `Completer` differs), and that driver sets
 * `busy` on every turn it pulls: an attached agent goes `ready → busy` with no disconnect. It came
 * from reading a FILE NAME as a statement of scope. What is true is narrower:
 * `setAgentBusyState`'s `true` branch is unreachable, so `sessionStatus` never becomes `'busy'`.
 * (BL-121 has since DELETED that branch and renamed the helper `markAgentIdle`, proving the
 * deletion unobservable at the event level — `bl121-idle-helper-parity.test.ts`. The sentence above
 * is left standing as the record of the correction; it describes code that no longer exists.)
 *
 * **The tests below are unaffected, and it is worth being precise about why.** They pin the
 * `currentTurnId` gate, which is right for its own reason — "an obligation is outstanding" is the
 * question the sweep asks, and it is sharper than "is this agent busy". What changes is only the
 * ARGUMENT for it, not the behaviour under it. B1 still holds: an agent sitting at `ready` with an
 * outstanding turn must be reported, and the old gate would miss it — that window is real on both
 * transports, it is simply not the whole transport.
 *
 * The other half is what the sweep is allowed to DO. `quiet` means "we have heard nothing", which
 * is also what a working agent mid-turn looks like — a real coding CLI routinely spends longer
 * than the 180s default on one honest turn. LB-67 records that our own prior art demoted this
 * exact signal to advisory and replaced it with transport presence. So T3a emits and stops.
 * Escalation needs a positive test (an unanswered healthcheck) and is T3c, separately gated.
 *
 * Each test names the bar it is, and the mutation that must turn it red is stated with it. A bar
 * whose mutation was not actually run is a claim, not a bar; all six were run (see the closing
 * report), because this item exists BECAUSE of a guard that passed identically whether the
 * mechanism worked or not (IP-15).
 */

const SWEEP_MS = 30_000; // the registry's own interval, not configurable
/**
 * The silence threshold MUST exceed the sweep interval, exactly as production's 180s exceeds its
 * 30s sweep. A threshold shorter than the interval is untestable: advancing fake time far enough
 * to reach the next sweep necessarily manufactures more silence than the threshold, so every
 * agent looks quiet and a "was it reset?" bar can never fail. The first draft used 1s and B4
 * passed for that reason — a bar that could not have caught the mutation it names.
 */
const IDLE_MS = 90_000;

describe('BL-028 T3a — the idle sweep is live and advisory', () => {
  let registry: Registry;
  let notices: AgentNonReplyNotice[];
  let failureSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.useFakeTimers();
    registry = new Registry({ agentIdleTimeoutMs: IDLE_MS });
    notices = [];
    registry.on('agent_non_reply', (n: AgentNonReplyNotice) => notices.push(n));
    // The M03 kill. Every test below asserts this stays untouched.
    failureSpy = vi
      .spyOn((registry as any).teamCoordinator, 'handleAgentFailure')
      .mockResolvedValue(undefined as never);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await registry.destroy();
  });

  /**
   * An agent holding an outstanding turn. Status `ready` by default and deliberately so: that is
   * what an attached agent actually looks like while it works — `await_turn` sets `currentTurnId`
   * and leaves the status alone.
   */
  async function agentWithOutstandingTurn(id: string, opts: { status?: 'ready' | 'busy' } = {}) {
    const agent = await registry.createAgent(id, { transport: 'attached' });
    agent.setStatus('starting');
    agent.setStatus('ready');
    if (opts.status === 'busy') agent.setStatus('busy');
    agent.currentTurnId = `turn-${id}`;
    agent.lastProgressAt = Date.now();
    return agent;
  }

  /** Advance past the silence threshold far enough that a sweep is guaranteed to observe it. */
  function sweepAfterSilence() {
    vi.advanceTimersByTime(IDLE_MS + SWEEP_MS);
  }

  // ── B1 — an agent at `ready` with an outstanding turn. Fails on the pre-T3a code. ───────────
  // Renamed 2026-08-07: was "reports an ATTACHED agent that never became `busy`", which asserted
  // the claim BL-120 refuted. The BAR is unchanged and still real — an agent can hold an
  // outstanding turn while its status reads `ready`, and the old gate could not see that window.
  // What was wrong was calling the window a whole transport.
  it('B1 · reports an agent at `ready` holding an outstanding turn (mutation: restore the busy gate)', async () => {
    const agent = await agentWithOutstandingTurn('attached-1');
    expect(agent.status).toBe('ready'); // the state the old gate could not see

    sweepAfterSilence();

    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ agentId: 'attached-1', reason: 'quiet', turnId: 'turn-attached-1' });
    expect(notices[0]!.silentForMs).toBeGreaterThan(IDLE_MS);
  });

  // ── B2 — the falsifiable pair's other half. B1 alone is satisfied by a sweep that kills. ────
  it('B2 · NOTHING propagates and NOTHING changes status (mutation: re-point the sweep at setAgentStatus)', async () => {
    const agent = await agentWithOutstandingTurn('attached-2');

    sweepAfterSilence();

    expect(notices).toHaveLength(1);      // it WAS observed…
    expect(failureSpy).not.toHaveBeenCalled(); // …and nothing died of it
    expect(agent.status).toBe('ready');
    // Stays true when the sweep keeps running — silence does not accumulate into a kill.
    vi.advanceTimersByTime(SWEEP_MS * 10);
    expect(failureSpy).not.toHaveBeenCalled();
    expect(agent.status).toBe('ready');
  });

  // ── B3 — the obligation gate ────────────────────────────────────────────────────────────────
  it('B3 · an agent nobody is waiting on is never swept (mutation: gate on lastProgressAt alone)', async () => {
    const agent = await registry.createAgent('idle-1', { transport: 'attached' });
    agent.setStatus('starting');
    agent.setStatus('ready');
    agent.lastProgressAt = Date.now();
    // No currentTurnId: it is between turns, which is not silence anyone is waiting through.

    sweepAfterSilence();

    expect(notices).toEqual([]);
    expect(failureSpy).not.toHaveBeenCalled();
  });

  // ── B4 — the chokepoint actually resets the clock ───────────────────────────────────────────
  it('B4 · any tool call re-arms the clock (mutation: drop the write in handleMcpToolCall)', async () => {
    const agent = await agentWithOutstandingTurn('chatty-1');

    // Silent to just under the threshold — several sweeps run during this advance and stay quiet.
    vi.advanceTimersByTime(IDLE_MS - SWEEP_MS);
    await registry.handleMcpToolCall('chatty-1', 'list_agents', {});
    // …and again. Cumulative silence is now well past the threshold; silence SINCE THE CALL is not.
    vi.advanceTimersByTime(IDLE_MS - SWEEP_MS);

    expect(notices).toEqual([]);
    expect(agent.lastProgressAt).toBeGreaterThan(0);
  });

  // ── B5 — the two human-in-the-loop pauses (the `awaiting-input` case, pre-naming) ────────────
  it('B5 · fact-collection and awaiting_operator still suppress (mutation: remove either exemption)', async () => {
    await agentWithOutstandingTurn('paused-1');
    const coordinator = (registry as any).teamCoordinator;

    const factSpy = vi.spyOn(coordinator, 'isAgentFactCollecting').mockReturnValue(true as never);
    sweepAfterSilence();
    expect(notices).toEqual([]);
    factSpy.mockReturnValue(false as never);

    vi.spyOn(coordinator, 'isTaskAwaitingOperator').mockReturnValue(true as never);
    sweepAfterSilence();
    expect(notices).toEqual([]);
    expect(failureSpy).not.toHaveBeenCalled();
  });

  // ── B6 — IP-15 retired: a bar that fails if the write stops happening ───────────────────────
  it('B6 · lastProgressAt is genuinely written, on both transports (mutation: revert either write)', async () => {
    const agent = await registry.createAgent('written-1', { transport: 'attached' });
    agent.setStatus('starting');
    agent.setStatus('ready');

    expect(agent.lastProgressAt).toBeUndefined(); // the pre-T3a state, forever

    await registry.handleMcpToolCall('written-1', 'list_agents', {});
    expect(agent.lastProgressAt).toBeGreaterThan(0);

    // And the in-process sibling: the driver stamps at turn delivery. Asserted structurally —
    // the loop is async and provider-driven, so this pins the CONTRACT the driver relies on
    // (a delivered turn re-arms the clock) rather than re-running the driver.
    const before = agent.lastProgressAt!;
    vi.advanceTimersByTime(5_000);
    await registry.handleMcpToolCall('written-1', 'list_agents', {});
    expect(agent.lastProgressAt!).toBeGreaterThan(before);
  });

  // ── Reported once per obligation — a 30s sweep that repeats itself buries its own signal ────
  it('says it once per turn, and re-arms on a NEW turn', async () => {
    const agent = await agentWithOutstandingTurn('repeat-1');

    sweepAfterSilence();
    expect(notices).toHaveLength(1);

    vi.advanceTimersByTime(SWEEP_MS * 5); // still silent, still the same turn
    expect(notices).toHaveLength(1);

    agent.currentTurnId = 'turn-repeat-1-next';
    agent.lastProgressAt = Date.now();
    sweepAfterSilence();
    expect(notices).toHaveLength(2);
    expect(notices[1]!.turnId).toBe('turn-repeat-1-next');
  });

  // ── A terminal agent is finished, not quiet ─────────────────────────────────────────────────
  it('never reports a terminated agent (the close paths leave currentTurnId set)', async () => {
    const agent = await agentWithOutstandingTurn('closed-1');
    agent.setStatus('terminated');
    expect(agent.currentTurnId).toBeTruthy(); // exactly what registry.ts's close paths leave behind

    sweepAfterSilence();

    expect(notices).toEqual([]);
  });
});
