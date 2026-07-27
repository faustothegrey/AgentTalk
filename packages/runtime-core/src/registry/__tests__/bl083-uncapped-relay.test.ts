import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from '../registry.js';
import * as apiClient from '@agenttalk/llm-client/api-client.js';

vi.mock('@agenttalk/llm-client/api-client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@agenttalk/llm-client/api-client.js')>();
  return { ...actual, callApi: vi.fn() };
});

/**
 * BL-083 — agent→agent relay outside a conversation must be bounded.
 *
 * `assertRelayDeliverable` applies its reply cap only when `findActiveConversationByAgents`
 * returns a conversation. With none there is no cap AND no counter (the increment lives in
 * `recordConversationMessage`, also conversation-scoped), so agent A answers, relays to B,
 * B answers, relays back — forever. With `to = evt.from` for a message_received outside a
 * conversation (`conversations/runtime.ts:243`), each agent replies straight to its sender.
 *
 * Scope note (verified while planning, and the reason this is not an idle-agent edge case):
 * NO team task creates a conversation — `startConversation` is reachable only from the
 * orchestrator HTTP endpoint and the scenario runner. So the uncapped path is also the
 * normal team/baton relay path. Test 2 pins that side.
 *
 * TWO DISTINCT CEILINGS, deliberately named apart (they are easy to confuse, and confusing
 * them lets the test pass for the wrong reason):
 *   - RELAY_BUDGET   — the fix's ceiling, injected via registry config.
 *   - HARD_TEST_STOP — the test harness's own escape hatch. The provider mock stops feeding
 *                      relayable text past this, so an UNFIXED build terminates the run
 *                      instead of exhausting the heap (a live reproduction of this defect
 *                      OOMs in ~34s and takes the whole suite with it).
 * RELAY_BUDGET must stay well below HARD_TEST_STOP or test 1 proves nothing.
 */
const RELAY_BUDGET = 3;
const HARD_TEST_STOP = 25;

describe('BL-083 relay outside a conversation is bounded', () => {
  let registry: Registry;
  let providerCalls: number;

  beforeEach(() => {
    registry = new Registry({
      healthcheckTimeoutMs: 500,
      maxUncappedRelaysPerPair: RELAY_BUDGET,
    });
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
    providerCalls = 0;

    // A plain-text reply is what drives the ping-pong: no conversation ⇒ the driver builds a
    // `send_to_agent` straight back to `evt.from`. Past HARD_TEST_STOP we return empty text,
    // which ends the turn via the driver's `if (!text) return` contract without relaying.
    vi.mocked(apiClient.callApi).mockImplementation(async () => {
      providerCalls += 1;
      return {
        text: providerCalls > HARD_TEST_STOP ? '' : 'pong',
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      } as any;
    });
  });

  afterEach(async () => {
    await registry.destroy();
  });

  async function createActiveAgent(id: string) {
    const agent = await registry.createAgent(id, {
      provider: 'api',
      providerName: 'google',
      model: 'gemini-2.5-flash',
    });
    await registry.activateAgent(agent.id);
    return agent;
  }

  /** Waits until the provider stops being called (two quiet samples) or the deadline passes. */
  async function settle(maxMs = 4000): Promise<void> {
    const deadline = Date.now() + maxMs;
    let last = -1;
    let quiet = 0;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 120));
      if (providerCalls === last) {
        if (++quiet >= 2) return;
      } else {
        quiet = 0;
        last = providerCalls;
      }
    }
  }

  it('bounds two idle agents ping-ponging with no conversation ever created', async () => {
    const a = await createActiveAgent('bl083-a');
    const b = await createActiveAgent('bl083-b');

    // No conversation is ever started for this pair — that is the whole point. (Asserted per
    // pair, not as a global count: the conversation store is persisted to disk, so
    // `getConversations()` legitimately carries history from earlier runs.)
    expect((registry as any).findActiveConversationByAgents(a.id, b.id)).toBeUndefined();

    // One message is enough to start it.
    await (registry as any).sendProtocol(a.id, 'EVT', {
      type: 'message_received',
      from: b.id,
      payload: 'kickoff',
    });

    await settle();

    // PRECONDITION GUARD — distinguishes "the relay path ran and was bounded" from "my
    // harness never reached the relay path at all". Without this, a broken setup produces
    // providerCalls === 0 and the ceiling assertion below passes for entirely the wrong
    // reason. (On rung 5 a pre-registered bar was wrong twice; only its guard caught it.)
    expect(providerCalls).toBeGreaterThan(0);

    // The bar. Pre-fix this reaches HARD_TEST_STOP — the relay never stops on its own.
    expect(providerCalls).toBeLessThanOrEqual(HARD_TEST_STOP);
    expect(providerCalls).toBeLessThan(HARD_TEST_STOP);
  });

  it('bounds a team planner→worker relay, which has no conversation either', async () => {
    // Empty replies here: this test isolates the SENDER's budget, so no peer relays back.
    vi.mocked(apiClient.callApi).mockImplementation(async () => {
      providerCalls += 1;
      return { text: '', usage: { prompt_tokens: 1, completion_tokens: 1 } } as any;
    });

    const planner = await createActiveAgent('bl083-planner');
    const worker = await createActiveAgent('bl083-worker');

    const team = registry.createTeam([
      { agentId: planner.id, role: 'planner' },
      { agentId: worker.id, role: 'worker' },
    ]);
    await registry.assignTeamTask(team.id, 'a task', 2);

    // A team task creates no conversation — the reason this path was never capped.
    expect((registry as any).findActiveConversationByAgents(planner.id, worker.id)).toBeUndefined();

    const relay = () =>
      registry.handleMcpToolCall(planner.id, 'send_to_agent', {
        to: worker.id,
        payload: 'baton',
      });

    // Up to the budget, relays are delivered exactly as before.
    for (let i = 0; i < RELAY_BUDGET; i++) {
      await expect(relay()).resolves.toBeDefined();
    }

    // Past it, the relay is refused rather than delivered. Pre-fix this resolves forever.
    await expect(relay()).rejects.toThrow(/relay budget/i);
  });

  it('resets the budget when the sender is pulled into new work', async () => {
    // The reset is a CORRECTNESS requirement, not a tuning parameter: without it the budget is
    // effectively per-process, and a long-lived orchestrator would eventually start refusing
    // legitimate relays — converting a runaway into a silent stall, which is worse than the bug.
    vi.mocked(apiClient.callApi).mockImplementation(async () => {
      providerCalls += 1;
      return { text: '', usage: { prompt_tokens: 1, completion_tokens: 1 } } as any;
    });

    const a = await createActiveAgent('bl083-reset-a');
    const b = await createActiveAgent('bl083-reset-b');

    const relay = () =>
      registry.handleMcpToolCall(a.id, 'send_to_agent', { to: b.id, payload: 'x' });

    for (let i = 0; i < RELAY_BUDGET; i++) await relay();
    await expect(relay()).rejects.toThrow(/relay budget/i);

    // A fresh assignment to the SENDER clears its budgets.
    await (registry as any).sendProtocol(a.id, 'EVT', {
      type: 'team_task_assign',
      teamId: 'team-x',
      taskId: 'task-x',
      role: 'planner',
      description: 'new work',
    });

    await expect(relay()).resolves.toBeDefined();

    // A healthcheck must NOT reset it — routine liveness traffic topping the budget up would
    // defeat the rail underneath a runaway.
    for (let i = 0; i < RELAY_BUDGET - 1; i++) await relay();
    await expect(relay()).rejects.toThrow(/relay budget/i);
    await (registry as any).sendProtocol(a.id, 'EVT', {
      type: 'healthcheck',
      token: 'tok-bl083',
      timeoutMs: 500,
    });
    await expect(relay()).rejects.toThrow(/relay budget/i);
  });

  it('leaves a conversation-backed relay governed by the conversation cap, not the budget', async () => {
    vi.mocked(apiClient.callApi).mockImplementation(async () => {
      providerCalls += 1;
      return {
        text: '{"message_type":"healthcheck_ack","message_payload":{"text":"alive"}}',
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      } as any;
    });

    const a = await createActiveAgent('bl083-conv-a');
    const b = await createActiveAgent('bl083-conv-b');

    // maxRepliesPerAgent is deliberately set ABOVE the pair budget: if the new budget were
    // (wrongly) applied to conversation-backed relays too, it would bite first and this
    // conversation could not reach its own cap.
    const conv = await registry.startConversation([a.id, b.id], 'topic', RELAY_BUDGET + 2);
    expect(conv.status).toBe('active');

    for (let i = 0; i < RELAY_BUDGET + 1; i++) {
      await expect(
        registry.handleMcpToolCall(a.id, 'send_to_agent', { to: b.id, payload: `m${i}` }),
      ).resolves.toBeDefined();
    }
  });
});
