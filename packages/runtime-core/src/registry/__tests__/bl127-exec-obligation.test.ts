import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry, assertExecGuardOutlivesIdleThreshold } from '../registry.js';
import { McpCompleter } from '../../agents/completer.js';
import type { AgentNonReplyNotice } from '@agenttalk/contracts/types';

/**
 * BL-127 — the exec turn's obligation id, and the chokepoint that clears it.
 *
 * Before this, an `exec_rpc` turn carried no `turnId` and no `messageId`, so `await_turn`'s stamp
 * matched neither branch, `currentTurnId` was never set, and `classifySilence` returned `undefined`
 * at its first gate — forever. The sweep was structurally blind to the one turn class it exists to
 * watch. BL-124 S3 observed it live: a worker silent for 233s produced no notice AND no
 * `console.warn`, and since the warn is unconditional and sits immediately before the emit, the
 * failure had to be upstream of the sink.
 *
 * **B3 is the bar that matters most, and it is the one a careless reader would drop.** Minting an
 * id is easy; the danger is minting one that is never cleared, which turns every healthy idle agent
 * into a permanent false notice — strictly worse than the mute detector, because BL-028 T3c would
 * then derive a threshold from noise. B3 asserts an ABSENCE, so it passes trivially against a
 * detector that cannot fire; it is only meaningful sitting next to B4, which proves the same
 * machinery CAN produce a notice. Neither bar is worth anything alone.
 */

const SWEEP_MS = 30_000; // the registry's own interval, not configurable
/** Must exceed the sweep interval, for the reason recorded in bl028-idle-advisory.test.ts. */
const IDLE_MS = 90_000;

describe('BL-127 — an exec turn carries an obligation, and gives it back', () => {
  let registry: Registry;
  let notices: AgentNonReplyNotice[];

  beforeEach(() => {
    vi.useFakeTimers();
    registry = new Registry({ agentIdleTimeoutMs: IDLE_MS });
    notices = [];
    registry.on('agent_non_reply', (n: AgentNonReplyNotice) => notices.push(n));
    vi.spyOn((registry as any).teamCoordinator, 'handleAgentFailure').mockResolvedValue(undefined as never);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await registry.destroy();
  });

  /**
   * Drives the REAL exec path rather than hand-setting `currentTurnId`: the completer queues the
   * turn, and `await_turn` — the actual stamping site — delivers it. A test that stamped the field
   * itself would pass against the bug.
   */
  async function startExecTurn(id: string) {
    const agent = await registry.createAgent(id, { transport: 'attached' });
    agent.setStatus('starting');
    agent.setStatus('ready');

    const completer = new McpCompleter(agent, registry);
    // Deliberately NOT awaited: it settles only when the turn ends. Rejections are expected in the
    // timeout/terminal bars, so it is neutralised here and asserted through `currentTurnId`.
    const inFlight = completer.complete('do some work').catch(() => undefined);

    const res: any = await registry.handleMcpToolCall(id, 'await_turn', {});
    const turn = JSON.parse(res.content[0].text);
    return { agent, turn, inFlight };
  }

  // ── B1 — the minting half. Fails on pre-BL-127 code, where the turn had no id at all. ────────
  it('B1 · an `exec_rpc` turn sets `currentTurnId` on delivery (mutation: drop `turnId` from the turn)', async () => {
    const { agent, turn } = await startExecTurn('exec-1');

    expect(turn.type).toBe('exec_rpc');
    expect(turn.turnId).toBeDefined();
    expect(agent.currentTurnId).toBe(turn.turnId);
  });

  // ── B2 — the chokepoint, one bar per way an exec turn can end. D1 at gate 1 caught that the
  //    plan covered only the first of these three. ───────────────────────────────────────────────
  it('B2a · `submit_exec_result` clears the obligation (mutation: remove the clear from cleanup)', async () => {
    const { agent } = await startExecTurn('exec-2a');

    await registry.handleMcpToolCall('exec-2a', 'submit_exec_result', { text: 'done' });

    expect(agent.currentTurnId).toBeUndefined();
  });

  it('B2b · the guard firing clears the obligation (mutation: clear only on the success path)', async () => {
    const { agent } = await startExecTurn('exec-2b');
    expect(agent.currentTurnId).toBeDefined();

    // Past the completer's own guard, with no result ever submitted.
    await vi.advanceTimersByTimeAsync(700_000);

    expect(agent.currentTurnId).toBeUndefined();
  });

  it('B2c · an agent going terminal mid-exec clears the obligation', async () => {
    const { agent } = await startExecTurn('exec-2c');
    expect(agent.currentTurnId).toBeDefined();

    // `error` is a separate overload carrying a reason (BL-084 T1), and the method is private —
    // cast, as this file already does for the `handleAgentFailure` spy.
    (registry as any).setAgentStatus(agent, 'error', 'mcp-internal-error');
    await vi.advanceTimersByTimeAsync(0);

    expect(agent.currentTurnId).toBeUndefined();
  });

  // ── B3 — the false-positive guard. THE bar this fix exists to protect. ──────────────────────
  it('B3 · an agent that FINISHED an exec turn and then idles produces NO notice', async () => {
    const { agent } = await startExecTurn('exec-3');
    await registry.handleMcpToolCall('exec-3', 'submit_exec_result', { text: 'done' });

    // Long past the threshold — an idle, healthy, connected agent.
    await vi.advanceTimersByTimeAsync(IDLE_MS + SWEEP_MS * 3);

    expect(agent.currentTurnId).toBeUndefined();
    expect(notices).toHaveLength(0);
  });

  // ── B4 — the capability itself, end to end through the real exec path. ──────────────────────
  it('B4 · an exec turn silent past the threshold produces exactly one notice', async () => {
    const { agent, turn } = await startExecTurn('exec-4');

    await vi.advanceTimersByTimeAsync(IDLE_MS + SWEEP_MS);

    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ agentId: 'exec-4', reason: 'quiet', turnId: turn.turnId });
    expect(notices[0]!.silentForMs).toBeGreaterThan(IDLE_MS);
    expect(agent.status).not.toBe('error'); // still advisory — BL-028 T3a's contract, unchanged
  });
});

/**
 * BL-128 — the invariant. The guard and the threshold live in modules that know nothing about each
 * other, and it is their RELATIONSHIP that decides whether the sweep can fire at all. A 120s guard
 * against a 180s threshold disabled the detector for 41 boots with no test going red, and was found
 * only by driving live traffic. Fails closed at construction, because a silently disabled detector
 * reads exactly like a healthy system.
 */
describe('BL-128 — the exec guard must outlive the non-reply threshold', () => {
  it('B5 · production’s own relationship holds', () => {
    expect(() => assertExecGuardOutlivesIdleThreshold(180_000)).not.toThrow();
  });

  it('B5 · a config that would re-create the inversion is REJECTED, naming the fix', () => {
    // The guard is 605s (600s default + 5s grace). A 700s threshold can never mature inside it —
    // the same shape as production's old 120s-vs-180s, scaled up.
    expect(() => assertExecGuardOutlivesIdleThreshold(700_000)).toThrow(/BL-128/);
    expect(() => new Registry({ agentIdleTimeoutMs: 700_000 })).toThrow(
      /must outlive the non-reply threshold/,
    );
  });

  it('B5 · the boundary is strict — equal is not enough', () => {
    // A guard exactly equal to the threshold cannot mature it: the turn is torn down at the very
    // tick the sweep would classify. `<=` rather than `<` is the load-bearing character here.
    expect(() => assertExecGuardOutlivesIdleThreshold(605_000)).toThrow(/BL-128/);
  });
});
