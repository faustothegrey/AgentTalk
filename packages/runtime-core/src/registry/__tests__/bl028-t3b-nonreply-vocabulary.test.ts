import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from '../registry.js';
import type { AgentNonReplyNotice } from '@agenttalk/contracts/types';

/**
 * BL-028 T3b — the non-reply vocabulary gets producers, and the advisory gets a reader.
 *
 * T3a made silence visible and called all of it `quiet`. The seven names in
 * `AgentNonReplyReason` existed but six had no producer — and, as the T3b plan found by searching
 * both repos, the notice had no CONSUMER either: the only listener anywhere was T3a's own test.
 * So the measurement T3c's threshold is meant to come from was being discarded.
 *
 * T3b wires the one other reason our engine can actually observe today — `awaiting-input`, the two
 * human-in-the-loop pauses — and deliberately wires NO others. `exited`/`errored` live on the
 * disconnect path next to the M03 chokepoint (their own unit); `turn-ended` needs a hook that does
 * not exist; `user-stopped` and `receiver-cancelled` have no observation point in our engine at
 * all. A name in `types.ts` is not a claim the condition is detected, and these bars are careful
 * not to imply otherwise.
 *
 * Each bar names the mutation that must turn it red. All were run — see the closing report. A
 * mutation that was not executed is a claim, not a bar; this item exists because of a guard
 * (IP-15) that passed identically whether the mechanism worked or not.
 */

const SWEEP_MS = 30_000; // the registry's own interval, not configurable
/** Must exceed the sweep interval — see the T3a header for why a shorter threshold is untestable. */
const IDLE_MS = 90_000;

describe('BL-028 T3b — the non-reply vocabulary has producers', () => {
  let registry: Registry;
  let notices: AgentNonReplyNotice[];
  let failureSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.useFakeTimers();
    registry = new Registry({ agentIdleTimeoutMs: IDLE_MS });
    notices = [];
    registry.on('agent_non_reply', (n: AgentNonReplyNotice) => notices.push(n));
    // The M03 kill. Every bar below asserts it stays untouched, for BOTH reasons.
    failureSpy = vi
      .spyOn((registry as any).teamCoordinator, 'handleAgentFailure')
      .mockResolvedValue(undefined as never);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await registry.destroy();
  });

  async function agentWithOutstandingTurn(id: string) {
    const agent = await registry.createAgent(id, { transport: 'attached' });
    agent.setStatus('starting');
    agent.setStatus('ready');
    agent.currentTurnId = `turn-${id}`;
    agent.lastProgressAt = Date.now();
    return agent;
  }

  function sweepAfterSilence() {
    vi.advanceTimersByTime(IDLE_MS + SWEEP_MS);
  }

  function pause(kind: 'fact' | 'operator', value = true) {
    const coordinator = (registry as any).teamCoordinator;
    const method = kind === 'fact' ? 'isAgentFactCollecting' : 'isTaskAwaitingOperator';
    return vi.spyOn(coordinator, method).mockReturnValue(value as never);
  }

  // ── C1 — fact-collection is named ───────────────────────────────────────────────────────────
  it('C1 · a fact-collecting agent past threshold is reported `awaiting-input` (mutation: restore the bare `return undefined` in that branch)', async () => {
    await agentWithOutstandingTurn('fact-1');
    pause('fact');

    sweepAfterSilence();

    expect(notices).toHaveLength(1);
    expect(notices[0]!.agentId).toBe('fact-1');
    expect(notices[0]!.reason).toBe('awaiting-input');
    expect(notices[0]!.silentForMs).toBeGreaterThan(IDLE_MS);
  });

  // ── C2 — the effect-fence pause is named ────────────────────────────────────────────────────
  it('C2 · an `awaiting_operator` agent past threshold is reported `awaiting-input` (mutation: restore the bare `return undefined` in that branch)', async () => {
    await agentWithOutstandingTurn('paused-1');
    pause('operator');

    sweepAfterSilence();

    expect(notices).toHaveLength(1);
    expect(notices[0]!.agentId).toBe('paused-1');
    expect(notices[0]!.reason).toBe('awaiting-input');
  });

  // ── C3 — the SPECIFIC reason, not the generic one ───────────────────────────────────────────
  //
  // The bar that makes T3b worth doing. `quiet` for a human-paused agent would be true but
  // useless — it is the undifferentiated bucket the vocabulary exists to break up, and it is the
  // reason T3c would have to escalate. Getting `awaiting-input` here is the whole product.
  it('C3 · neither pause is reported as `quiet` (mutation: fall through to `quiet` for exemptions)', async () => {
    await agentWithOutstandingTurn('fact-2');
    const factSpy = pause('fact');
    sweepAfterSilence();

    await agentWithOutstandingTurn('paused-2');
    factSpy.mockReturnValue(false as never);
    pause('operator');
    sweepAfterSilence();

    expect(notices.map(n => n.reason)).not.toContain('quiet');
    expect(notices.every(n => n.reason === 'awaiting-input')).toBe(true);
  });

  // ── C4 — nothing propagates, for EITHER reason ──────────────────────────────────────────────
  //
  // T3a's B2 pinned this for `quiet`. T3b adds a second reason, so the property needs re-proving
  // on the new path: naming a pause must not have created a route to `setAgentStatus`.
  it('C4 · no status change and no propagation, for both reasons (mutation: point the classifier result at setAgentStatus)', async () => {
    const paused = await agentWithOutstandingTurn('paused-3');
    const quiet = await agentWithOutstandingTurn('quiet-1');
    const statusSpy = vi.spyOn(registry as any, 'setAgentStatus');
    pause('operator').mockImplementation(((id: string) => id === 'paused-3') as never);

    sweepAfterSilence();

    expect(notices.map(n => n.reason).sort()).toEqual(['awaiting-input', 'quiet']);
    expect(paused.status).toBe('ready');
    expect(quiet.status).toBe('ready');
    expect(failureSpy).not.toHaveBeenCalled();
    expect(statusSpy).not.toHaveBeenCalled();
  });

  // ── C5 — T3a is unregressed ─────────────────────────────────────────────────────────────────
  it('C5 · an ordinary silent agent is still reported `quiet` (mutation: return `awaiting-input` unconditionally)', async () => {
    await agentWithOutstandingTurn('quiet-2');

    sweepAfterSilence();

    expect(notices).toHaveLength(1);
    expect(notices[0]!.reason).toBe('quiet');
  });

  // ── C6 — dedup survives the reason split ────────────────────────────────────────────────────
  //
  // Two halves, and the second is the one T3b introduces. Same turn + same reason: say it once.
  // Same turn + CHANGED reason: say it again, because a quiet agent whose task then pauses on a
  // human is new information — and a turn-only key would keep the less useful of the two.
  it('C6 · once per obligation AND reason (mutation: key the dedup on agentId or turnId alone)', async () => {
    await agentWithOutstandingTurn('drift-1');

    sweepAfterSilence();
    expect(notices).toHaveLength(1);
    expect(notices[0]!.reason).toBe('quiet');

    // Same turn, same reason, another sweep — silent.
    vi.advanceTimersByTime(SWEEP_MS * 2);
    expect(notices).toHaveLength(1);

    // Same turn, the task now pauses on a human — the reason changed, so it speaks again.
    pause('operator');
    vi.advanceTimersByTime(SWEEP_MS * 2);
    expect(notices).toHaveLength(2);
    expect(notices[1]!.reason).toBe('awaiting-input');
    expect(notices[1]!.turnId).toBe(notices[0]!.turnId);

    // And that one is now itself deduped.
    vi.advanceTimersByTime(SWEEP_MS * 2);
    expect(notices).toHaveLength(2);
  });

  // ── C9 — the threshold still governs the named case ─────────────────────────────────────────
  //
  // NOT in the pre-registered bar list — added during implementation, and declared as an addition
  // rather than folded in. Writing the classifier surfaced a consequence the plan had not: T3b
  // moves the exemption checks to AFTER the threshold comparison, because naming a case needs a
  // duration to name it with. This pins what that reorder must NOT do — without it, the change
  // could have turned every human-paused agent into a notice on the first sweep and no planned
  // bar would have failed. (C7 and C8 are the reader bars, in the orchestrator suite.)
  it('C9 · a paused agent under the threshold is silent (mutation: move the exemption checks back above the threshold test)', async () => {
    await agentWithOutstandingTurn('paused-4');
    pause('operator');

    vi.advanceTimersByTime(IDLE_MS - SWEEP_MS);

    expect(notices).toEqual([]);
  });
});
