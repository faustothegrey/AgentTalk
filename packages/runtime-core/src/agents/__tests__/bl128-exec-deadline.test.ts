import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InProcessAgentDriver, DEFAULT_WORKER_TURN_TIMEOUT_MS } from '../in-process-driver.js';
import { Agent } from '../agent.js';
import type { Completer } from '@agenttalk/llm-client';
import type { Registry } from '../../registry/registry.js';

/**
 * BL-128 — every exec path forwards a deadline, not just the worker's.
 *
 * The defect: only the worker branch passed `timeoutMs` (gated on `maintainsSession`), so every
 * other exec turn fell back to `DEFAULT_EXEC_TIMEOUT_MS` = 120s against a 180s non-reply threshold.
 * The guard tore the turn down 60s BEFORE the threshold could mature, the driver's catch ended the
 * turn, and the obligation was gone before the sweep could see it. Planner turns ran at one fifth
 * of a worker's deadline while doing work that exceeds it — an S3 planner turn was killed
 * mid-thought at exactly 120s and its completed response discarded.
 *
 * The bar asserts the RESOLVED value handed to the completer, not elapsed wall-clock time. Gate 1
 * (D3) caught that the timing form would cost 120s per run, which is how a bar ends up asserted
 * rather than executed.
 */
describe('BL-128 — a non-worker exec turn carries a deadline that outlives the threshold', () => {
  let agent: Agent;
  let registry: Registry;
  let seenOpts: any[];
  let completer: Completer;

  beforeEach(() => {
    agent = new Agent('planner-1');
    registry = {
      handleMcpToolCall: vi.fn().mockResolvedValue({}),
      pauseTaskForOperator: vi.fn().mockResolvedValue(undefined),
      notifyAgentStatus: (a: Agent, s: Parameters<Agent['setStatus']>[0]) => a.setStatus(s),
    } as unknown as Registry;

    seenOpts = [];
    completer = {
      // `maintainsSession: false` is the planner shape — the branch that used to forward nothing.
      maintainsSession: false,
      complete: vi.fn(async (_prompt: string, opts: any) => {
        seenOpts.push(opts);
        return { text: 'ok' };
      }),
    } as unknown as Completer;
  });

  async function runOneTurn() {
    const driver = new InProcessAgentDriver(agent, registry, { completer });
    driver.start();
    agent.queueTurn({ type: 'message_received', from: 'user', payload: 'Hi' });
    await new Promise((r) => setTimeout(r, 50));
    driver.stop();
  }

  it('B6 · a planner turn is handed a deadline (mutation: restore the maintainsSession gate)', async () => {
    await runOneTurn();

    expect(seenOpts.length).toBeGreaterThan(0);
    expect(seenOpts[0].timeoutMs).toBe(DEFAULT_WORKER_TURN_TIMEOUT_MS);
  });

  it('B6 · and that deadline outlives the 180s non-reply threshold — the inversion is gone', async () => {
    await runOneTurn();

    // The whole point: the old 120s default sat BELOW this number, so the turn could never survive
    // long enough to be classified as silent.
    expect(seenOpts[0].timeoutMs).toBeGreaterThan(180_000);
  });

  it('B6 · an explicit caller deadline still wins — the healthcheck’s short one is untouched', async () => {
    const driver = new InProcessAgentDriver(agent, registry, { completer });
    driver.start();
    agent.queueTurn({ type: 'healthcheck', token: 'tok-1', timeoutMs: 30_000 } as any);
    await new Promise((r) => setTimeout(r, 50));
    driver.stop();

    expect(seenOpts[0].timeoutMs).toBe(30_000);
    // Grace 0, so the backstop never pre-empts the harness's own short deadline (IMP-M08-1).
    expect(seenOpts[0].timeoutBackstopGraceMs).toBe(0);
  });
});
