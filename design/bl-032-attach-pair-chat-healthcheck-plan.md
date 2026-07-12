# BL-032 - Attach Pair-Chat Healthcheck Delivery

**Status:** Gate 1 conditionally approved; required amendments folded 2026-07-12 before implementation opens.
**Backlog:** BL-032. Blocks BL-031 validation until fixed or explicitly bypassed by PO-approved test scope.
**Ledger:** To be created after Gate 1 approval.
**PO:** Fausto. **Planner:** Codex. **Plan Reviewer:** Claude.
**Implementer:** TBD by PO. **Implementation Reviewer:** Codex only if the implementer is not Codex; otherwise PO
reassignment is required. **Task-end Reviewer:** Claude unless reassigned by PO.

## Why

The 2026-07-12 human-driven BL-031 validation run did not reach the UI behavior under test. The UI sent
`start_pair_chat` for two attached real `agentalk-mcp-client` Codex clients (`bl031-source` and `bl031-target`).
AgentTalk sent startup healthchecks to both agents; the source client logged and acknowledged the turn, while the
target client stayed connected/ready but did not log or acknowledge the healthcheck. After 30s,
`ConversationCoordinator.startConversation()` failed before creating a conversation.

Evidence lives in LB-78 and BL-032. The first lead was a delivery-path mismatch: provider-labelled attached agents
wait through `awaitExecTurn()`, while conversation startup sends semantic `EVT` turns through
`sendProtocol(...)/queueTurn()`. Gate 1 review partly refuted that as a sufficient explanation: M20 relay approval
also reaches provider agents through the shared `sendProtocol()` / `queueTurn()` path
(`deliverRelayMessage` -> `sendProtocol`), and relays did reach agents during the working run. BL-032 must therefore
map both delivery paths before fixing anything:

- exec/completer path: `McpCompleter` / `queueExecTurn()` / `exec_rpc`;
- semantic event path: `sendProtocol()` / `queueTurn()`, including healthcheck, conversation-start, and M20 relay
  delivery.

The root cause must explain not only why startup failed, but why `bl031-source` acknowledged while `bl031-target`
remained connected/ready and did not log the healthcheck. A green rerun without that asymmetry explained is not
enough.

## Goal

Make attach-mode pair chat startup reliable enough that two real `agentalk-mcp-client` sessions can both receive and
acknowledge startup healthchecks, receive conversation-start turns, and enter an active conversation. This unblocks a
fresh BL-031 validation run against the inline relay approval UI.

## Non-goals

- No BL-031 UI redesign work.
- No weakening, skipping, or silently extending healthchecks to get a green run.
- No change to M20 pending relay approval semantics, approval-mode defaults, or PO approve/deny behavior.
- No MCP tool/schema or wire-contract version change unless Gate 1 is amended.
- No sibling `../agentalk-mcp-client/**` edits unless the focused reproduction proves the bug is in the client and
  the PO explicitly approves cross-repo scope.
- No fake product conversation seeded only to bypass startup. The validation blocker is pair-chat startup, so the
  fix must address startup or be explicitly approved as a test-only bypass.
- No broad provider/vendor refactor or cleanup of the transport/provider conflation recorded in BL-024.

Automatic Gate-1 hand-back: if the plan reviewer concludes the first bite requires any non-goal above, BL-032 must be
replanned before implementation opens.

## Scope Fence

**Allowed:**

- `design/bl-032-attach-pair-chat-healthcheck-plan.md`
- BL-032 implementation ledger after Gate 1 approval
- Focused evidence under `design/evidence/**`
- `packages/runtime-core/src/registry/registry.ts`
- `packages/contracts/src/protocol-payloads.ts` for additive typing/parsing of healthcheck `timeoutMs` only
- Focused registry/conversation startup tests under `packages/runtime-core/src/**/__tests__/**`
- Focused orchestrator/server test coverage if the bug only reproduces at the server boundary
- New proof helper under `scripts/` only if it is strictly needed to launch the two-client reproduction repeatably

**Read-allowed, edit only if T0 proves necessary:**

- `packages/runtime-core/src/agents/in-process-driver.ts`
- `packages/runtime-core/src/registry/agent.ts`
- `packages/runtime-core/src/registry/completer.ts`
- `packages/runtime-core/src/conversations/conversation-coordinator.ts`

These are blast-radius files, not default edit surfaces. No queue-semantic change for existing consumers is allowed
without a T0 finding that proves it is necessary and bounded.

**Forbidden unless Gate 1 is amended:**

- `../agentalk-mcp-client/**`
- `packages/contracts/wire-contract.json`
- New MCP tools or tool schema changes
- BL-031 UI surfaces under `apps/web/src/**`
- M20 pending relay approval behavior outside tests proving it remains unchanged
- Conversation persistence or transcript hydration redesign
- Team coordinator or consensus behavior
- Broad provider/vendor abstractions

## Plan

### T0 - Reproduce and isolate the delivery path

Create a focused failing test or repeatable proof that starts two attached provider-labelled clients in the same shape
as LB-78 and attempts pair-chat startup. The proof must map both runtime delivery paths and distinguish at least these
cases:

- exec/completer delivery through `McpCompleter` / `queueExecTurn()` / `exec_rpc`;
- semantic event delivery through `sendProtocol()` / `queueTurn()`;
- M20 relay delivery through the same `sendProtocol()` path that healthchecks use;
- healthcheck and conversation-start delivery through that shared event path;

- the target client is disconnected or absent;
- the target client is connected but waiting on the wrong queue;
- both clients receive and acknowledge the healthcheck;
- both clients receive the conversation-start turn after healthcheck.

The implementation should not begin from the assumption that `queueTurn()` versus `awaitExecTurn()` is the bug. It
should prove where the turn is queued, which waiter is active, and why only one attached client acknowledged in the
tester run. Specifically, T0 must explain the source-acked/target-did-not asymmetry from LB-78 before BL-032 can be
called fixed.

### T1 - Fix healthcheck delivery for attached provider-labelled agents

If T0 confirms startup healthchecks fail because of how a specific `EVT` purpose is delivered or consumed, fix that
purpose narrowly. Healthcheck and M20 relay both pass through shared `sendProtocol()` code, so the fix must
discriminate by event purpose or startup state rather than changing the generic queue semantics for every existing
consumer. Prefer the narrowest change in `registry.ts` around `requestHealthCheck()` / startup delivery over changes
to `agent.ts`, `completer.ts`, or `conversation-coordinator.ts`.

The healthcheck contract remains strict: a missing, disconnected, or nonresponsive client still fails startup.

### T2 - Verify conversation-start delivery, not just healthchecks

After healthchecks pass, prove the `conversation_start` turn reaches both attached clients. A green healthcheck with a
lost conversation-start turn is not a completed BL-032 fix.

If the same delivery mismatch affects `conversation_start`, apply the same narrow startup-compatible path there. Do
not change ordinary agent-to-agent relay delivery or pending relay approval delivery unless the failing test proves
those paths are already broken by the same mechanism and the plan reviewer accepts the scope.

### T3 - Live proof and BL-031 unblock signal

Run the live two-client ritual with `agentalk-mcp-client`:

1. launch AgentTalk backend and web UI;
2. launch two attached provider clients with distinct ids;
3. start pair chat from the UI or equivalent server path;
4. capture backend/client evidence that both healthchecks and both conversation-start turns were processed;
5. record whether BL-031 validation can proceed to an active conversation with pending relay approval visible.

BL-032 closes when pair-chat startup is fixed and evidenced. BL-031 remains a separate UI validation task and should
resume only after this proof.

## DoD

| Claim | Required evidence |
|---|---|
| BL-032-C1 | A focused regression/proof fails on the current runtime or reproduces the LB-78 blocker honestly, and the root-cause finding explains the source-acked/target-did-not asymmetry from LB-78. |
| BL-032-C2 | Two attached provider-labelled clients both receive and acknowledge startup healthchecks. |
| BL-032-C3 | Two attached provider-labelled clients both receive conversation-start turns and an active conversation is created. |
| BL-032-C4 | A disconnected or nonresponsive client still causes startup failure; healthchecks are not weakened. |
| BL-032-C5 | M20 pending relay approval behavior and approval-mode default are unchanged, proven by a regression test that drives relay delivery through the modified shared `sendProtocol()` path. A citation alone is not enough. |
| BL-032-C6 | The sibling `agentalk-mcp-client` repo is unchanged unless the PO explicitly approves cross-repo scope. |
| BL-032-C7 | `npm run backlog:check`, focused tests, and `npm run build` are clean, or failures are reported verbatim as blockers. |
| BL-032-C8 | The implementation ledger records the live two-client evidence and states that BL-031 is unblocked for a fresh validation run. |

## Gate 1 Conditions Folded

Plan Reviewer conditionally approved this plan without requiring a replan. The approval conditions folded here are:

1. T0 reconciles the blocker with the working M20 relay path by mapping both delivery paths and proving what attached
   provider clients actually drain.
2. `agent.ts`, `completer.ts`, and `conversation-coordinator.ts` are explicit read-allowed, edit-only-if-proven
   blast-radius surfaces.
3. Because healthcheck and M20 relay share `sendProtocol()`, any fix discriminates by `EVT` purpose/startup state and
   C5 requires a relay regression through the modified shared path.
4. C1 requires a root-cause explanation for the LB-78 source-acked/target-did-not asymmetry, not only a green rerun.

## Verification Commands

Minimum expected verification after implementation:

```bash
npm run backlog:check
npm run build
```

Add and run the focused test command for the BL-032 regression once the test file exists. If a full test suite is too
expensive for the task turn, the implementer must state the narrower command run and why it is sufficient for the
delivery, leaving the task-end reviewer to decide whether broader coverage is required before merge.

## Gate 1 Result

Gate 1 passes after the required amendments above. Implementation may open only from this folded plan.
