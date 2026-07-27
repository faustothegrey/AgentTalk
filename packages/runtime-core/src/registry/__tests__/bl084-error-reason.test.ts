import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry, isFaultClass } from '../registry.js';
import type { AgentErrorReason } from '@agenttalk/contracts/types';
import * as apiClient from '@agenttalk/llm-client/api-client.js';

vi.mock('@agenttalk/llm-client/api-client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@agenttalk/llm-client/api-client.js')>();
  return {
    ...actual,
    callApi: vi.fn(),
  };
});

/**
 * BL-084 T1 — a typed reason on the `error` transition, and fault-class-only propagation.
 *
 * T1 is a PURE REFACTOR: it lands the vocabulary and the predicate, and changes no
 * propagation decision. That claim is what this file is built to falsify, because a
 * behaviour-preserving change is exactly the kind that invites a rubber-stamp review
 * (plan §7). The bar is therefore *parity*, which is falsifiable:
 *
 *   - §A pins the classification table (plan §4) row by row — the mutation-check target.
 *     Flipping any one row in `FAULT_CLASS_BY_REASON` fails precisely that row's case.
 *   - §B drives the real reachable transitions and asserts `handleAgentFailure` fires for
 *     exactly the same set as before: both attached `error` paths propagate, every
 *     `terminated` path does not, and the in-process driver path does not.
 *   - §C pins the safe default: an UNLABELLED error still propagates, so a call site that
 *     has not been migrated cannot silently lose its kill.
 *
 * The behaviour change lives in T2 (BL-078), on the in-process path only.
 */
describe('BL-084 T1 — typed error reason and fault-class propagation', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  afterEach(async () => {
    await registry.destroy();
    vi.useRealTimers();
  });

  function spyOnPropagation() {
    return vi.spyOn(
      (registry as unknown as { teamCoordinator: { handleAgentFailure: (id: string) => Promise<void> } })
        .teamCoordinator,
      'handleAgentFailure',
    ).mockResolvedValue(undefined);
  }

  async function createActiveAgent(id: string, provider: 'api' | 'mcp' = 'api') {
    const agent = provider === 'api'
      ? await registry.createAgent(id, { provider: 'api', providerName: 'google', model: 'gemini-2.5-flash' })
      : await registry.createAgent(id, { provider: 'mcp' });
    await registry.activateAgent(agent.id);
    return agent;
  }

  // ── §A. The classification table (plan §4), one case per row ────────────────────────
  //
  // Each row is a BEHAVIOUR call, not an implementation detail, so each gets its own named
  // case rather than a table-driven loop: a failure here must name the row that regressed.
  describe('A. the §4 classification — one case per row', () => {
    describe('fault-class — propagation fires (M03 Shared-Fate, unchanged severity)', () => {
      it('conversation-start-failed: the runtime refusing to start is a fault', () => {
        expect(isFaultClass('conversation-start-failed')).toBe(true);
      });

      it('mcp-internal-error: an attached close with 1011 is a fault (propagates today)', () => {
        expect(isFaultClass('mcp-internal-error')).toBe(true);
      });

      it('reconnect-timeout-inflight-turn: losing an in-flight turn is a fault (propagates today)', () => {
        expect(isFaultClass('reconnect-timeout-inflight-turn')).toBe(true);
      });

      it('idle-timeout: fault-class in T1 for PARITY ONLY — BL-028/T3 revisits it', () => {
        // Do not "fix" this row here. The sweep is dead code (LB-70), so this label is
        // unobservable today; were it live it would propagate, and T1 reproduces that.
        expect(isFaultClass('idle-timeout')).toBe(true);
      });
    });

    describe('non-fault — status changes, UI sees it, NO propagation', () => {
      it('unknown-mcp-tool: a protocol violation harms nobody else, so it is NOT a fault', () => {
        // PO-ratified 2026-07-27 (plan §9 q1), reversing T1's proposal: one mistyped tool name
        // must not kill a team. See the rationale in contracts/types.ts.
        expect(isFaultClass('unknown-mcp-tool')).toBe(false);
      });

      it('conversation-reply-cap: the cap is how a conversation ENDS, not how it breaks', () => {
        expect(isFaultClass('conversation-reply-cap')).toBe(false);
      });

      it('relay-budget-exhausted: BL-083 rail firing correctly is not a fault', () => {
        expect(isFaultClass('relay-budget-exhausted')).toBe(false);
      });

      it('target-agent-unavailable: a peer not ready/busy is normal in attach mode', () => {
        expect(isFaultClass('target-agent-unavailable')).toBe(false);
      });

      it('workflow-gate-refusal: propagating a REJECTED escalation would be a DoS lever', () => {
        // The load-bearing one. `handleAgentFailure` requests shutdown of every other
        // member, so a propagating gate refusal hands anyone who can trip a gate a
        // team-wide kill switch.
        expect(isFaultClass('workflow-gate-refusal')).toBe(false);
      });

      it('planning-task-inactive: a routing guard is not a fault', () => {
        expect(isFaultClass('planning-task-inactive')).toBe(false);
      });

      it('healthcheck-token-invalid: a stale token is usually just a late ack', () => {
        expect(isFaultClass('healthcheck-token-invalid')).toBe(false);
      });
    });

    it('the two classes are disjoint and cover every reason in the union', () => {
      // Guards the mutation check itself: if a reason is added to `AgentErrorReason` without
      // a case above, this count trips and forces the decision into the open.
      const fault: AgentErrorReason[] = [
        'conversation-start-failed',
        'mcp-internal-error',
        'reconnect-timeout-inflight-turn',
        'idle-timeout',
      ];
      const nonFault: AgentErrorReason[] = [
        'unknown-mcp-tool',
        'conversation-reply-cap',
        'relay-budget-exhausted',
        'target-agent-unavailable',
        'workflow-gate-refusal',
        'planning-task-inactive',
        'healthcheck-token-invalid',
      ];

      expect(fault.every((r) => isFaultClass(r))).toBe(true);
      expect(nonFault.every((r) => !isFaultClass(r))).toBe(true);
      expect(new Set([...fault, ...nonFault]).size).toBe(11);
    });
  });

  // ── §C. The safe default (DoD row 4) ────────────────────────────────────────────────
  describe('C. an UNLABELLED error still propagates (the safe default)', () => {
    it('isFaultClass(undefined) is true, so migration can only ever REMOVE propagation', () => {
      expect(isFaultClass(undefined)).toBe(true);
      expect(isFaultClass()).toBe(true);
    });

    it('an unlabelled transition through setAgentStatus still fires handleAgentFailure', async () => {
      const agent = await createActiveAgent('bl084-unlabelled');
      const handleAgentFailure = spyOnPropagation();

      // Deliberately bypassing the overloads (which a real call site cannot do — see DoD
      // row 1) to prove the RUNTIME default matches the compile-time contract: a site that
      // somehow arrives unlabelled keeps today's kill rather than silently losing it.
      (registry as unknown as {
        setAgentStatus: (a: unknown, s: string, r?: AgentErrorReason) => void;
      }).setAgentStatus(agent, 'error');

      expect(agent.status).toBe('error');
      expect(handleAgentFailure).toHaveBeenCalledWith(agent.id);
    });

    it('a non-fault reason on the SAME transition suppresses propagation', async () => {
      const agent = await createActiveAgent('bl084-nonfault');
      const handleAgentFailure = spyOnPropagation();

      (registry as unknown as {
        setAgentStatus: (a: unknown, s: string, r?: AgentErrorReason) => void;
      }).setAgentStatus(agent, 'error', 'conversation-reply-cap');

      // The status still changes and the UI still sees it — only the kill is withheld.
      expect(agent.status).toBe('error');
      expect(handleAgentFailure).not.toHaveBeenCalled();
    });
  });

  // ── §B. Propagation parity across every reachable trigger (DoD row 2) ───────────────
  describe('B. propagation parity — the same set of transitions kills as before', () => {
    it('attached: MCP close 1011 -> error AND propagates (unchanged)', async () => {
      const agent = await createActiveAgent('bl084-1011', 'mcp');
      const handleAgentFailure = spyOnPropagation();

      registry.handleMcpDisconnect('bl084-1011', 1011, 'internal error');

      expect(agent.status).toBe('error');
      expect(handleAgentFailure).toHaveBeenCalledWith('bl084-1011');
    });

    it('attached: reconnect timeout WITH an in-flight turn -> error AND propagates (unchanged)', async () => {
      vi.useFakeTimers();
      const agent = await createActiveAgent('bl084-reconnect', 'mcp');
      const handleAgentFailure = spyOnPropagation();

      // An in-flight turn is what makes the expiry an `error` rather than a `terminated`.
      agent.currentTurnId = 'turn-1';
      registry.handleMcpDisconnect('bl084-reconnect', 1006, 'transport drop');
      expect(agent.status).toBe('reconnecting');
      expect(handleAgentFailure).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(30_000);

      expect(agent.status).toBe('error');
      expect(handleAgentFailure).toHaveBeenCalledWith('bl084-reconnect');
    });

    it('attached: reconnect timeout with NO in-flight turn -> terminated, no propagation', async () => {
      vi.useFakeTimers();
      const agent = await createActiveAgent('bl084-reconnect-clean', 'mcp');
      const handleAgentFailure = spyOnPropagation();

      agent.currentTurnId = undefined;
      registry.handleMcpDisconnect('bl084-reconnect-clean', 1006, 'transport drop');
      await vi.advanceTimersByTimeAsync(30_000);

      expect(agent.status).toBe('terminated');
      expect(handleAgentFailure).not.toHaveBeenCalled();
    });

    it('attached: a clean close (1000) -> terminated, no propagation (unchanged)', async () => {
      const agent = await createActiveAgent('bl084-clean', 'mcp');
      const handleAgentFailure = spyOnPropagation();

      registry.handleMcpDisconnect('bl084-clean', 1000, 'sigint');

      expect(agent.status).toBe('terminated');
      expect(handleAgentFailure).not.toHaveBeenCalled();
    });

    it('attached: a close after conversation_end -> terminated, no propagation (unchanged)', async () => {
      const agent = await createActiveAgent('bl084-convend', 'mcp');
      const handleAgentFailure = spyOnPropagation();

      // A conversation that ended normally: the close that follows is not a failure.
      (agent as unknown as { activeExecTurn?: Record<string, unknown> }).activeExecTurn = {
        type: 'conversation_end',
      };
      registry.handleMcpDisconnect('bl084-convend', 1006, 'harness exited');

      expect(agent.status).toBe('terminated');
      expect(handleAgentFailure).not.toHaveBeenCalled();
    });

    it('in-process: a driver-path error still does NOT propagate in T1 (BL-077 semantics held)', async () => {
      vi.mocked(apiClient.callApi).mockResolvedValue({
        text: 'unused',
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      });

      const agent = await createActiveAgent('bl084-driver');
      const handleAgentFailure = spyOnPropagation();

      const seen: string[] = [];
      registry.on('status', ({ id, status }) => {
        if (id === 'bl084-driver') seen.push(status);
      });

      // The genuine loop-level error path: `conversation_start` with no peers/topic makes the
      // runtime return ok:false, which `handleTurn` throws on.
      agent.queueTurn({ type: 'conversation_start' });
      await vi.waitFor(() => expect(seen).toContain('error'), { timeout: 2000 });

      expect(agent.status).toBe('error');
      // T1 leaves `notifyAgentStatus` alone (plan §3, property 3). THIS is the assertion T2
      // deliberately rewrites — it exists to pin today's semantics until that moment.
      expect(handleAgentFailure).not.toHaveBeenCalled();
    });

    it('a repeated error transition does not double-fire propagation (oldStatus guard intact)', async () => {
      const agent = await createActiveAgent('bl084-repeat', 'mcp');
      const handleAgentFailure = spyOnPropagation();

      registry.handleMcpDisconnect('bl084-repeat', 1011, 'internal error');
      registry.handleMcpDisconnect('bl084-repeat', 1011, 'internal error again');

      expect(agent.status).toBe('error');
      expect(handleAgentFailure).toHaveBeenCalledTimes(1);
    });
  });
});
