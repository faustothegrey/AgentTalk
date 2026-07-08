# Milestone 16 - One real baton

**Status:** DRAFT - authored by the Planner for Gate 1 review (2026-07-08). No implementation starts until
the Plan Reviewer approves this plan.
**Backlog:** BL-013 (`doing`) - opened at the 2026-07-08 backlog gate.
**Program:** `design/self-hosting-program-draft.md` (self-hosting M16 -> M18).
**Ledger:** `design/milestone16-one-real-baton-implementation.md`.
**PO:** Fausto. **SM:** Claude. **Architect:** Claude. **Planner:** Codex.
**Plan Reviewer:** Claude. **Implementer:** Gemini/agy. **Implementation Reviewer:** Codex.
**Task-end Reviewer:** Claude.

## Why

M16 is the first bootstrap step toward AgentTalk coordinating its own development work. The immediate pain from
M15 was not code generation; it was manual relay: the PO had to paste batons, gate outcomes, and follow-up
instructions between isolated agent windows. M16 does not try to solve the whole workflow. It proves one small,
observable unit: a role-to-role baton can travel through the AgentTalk brain, be recorded, and be visible to the
operator without terminal copy/paste.

The preparatory SP-WAKE layer (a) result fixes the transport shape for this epic: blocking `await_turn` held for
600 seconds and woke in 3 ms. Therefore M16 designs around long-lived blocking waits. Pull-on-poke remains the
declared fallback if the live orchestrator proof exposes a different failure.

## Goal

Two attached agent sessions representing workflow seats exchange one origin-tagged role-to-role baton through the
existing orchestrator attach channel. The baton is:

- delivered through the brain, not by terminal relay;
- visible in the UI using existing message/conversation surfaces;
- recorded in runtime NDJSON with the tag and role metadata visible;
- small enough that failure produces a useful finding rather than a sprawling half-implementation.

## Non-goals

- No consensus, arbiter, or planning-protocol changes.
- No `team-coordinator.ts` diff.
- No new workflow enforcement. M17 owns session -> identity -> role mapping and tag refusal.
- No new UI surface beyond existing message/conversation displays and existing WebSocket broadcasts.
- No removal of terminal relay. Terminal remains the declared fallback.
- No role-skill injection. It is BL-014 / M19 candidate after M17 evidence.

## Scope Fence

**Allowed:**

- Minimal contract additions for optional baton metadata on direct agent messages/transcript entries.
- Minimal MCP tool schema extension, if needed, to carry optional baton metadata on `send_to_agent`.
- Registry/conversation routing needed to persist that metadata and emit existing conversation updates.
- Orchestrator recording/broadcast glue only if existing `conversation`/`agent_message` recording cannot prove the
  baton metadata.
- A deterministic targeted test for baton metadata delivery/recording.
- One live proof script or runbook under `scripts/` or `design/` that uses the real orchestrator attach server.
- This plan, the implementation ledger, and closure updates.

**Forbidden:**

- `packages/runtime-core/src/registry/team-coordinator.ts`.
- Arbiter/protocol coordinator behavior changes.
- New consensus tools or changes to `consensus_respond`.
- UI redesign or new workflow panels.
- Changes in `agentalk-mcp-client` unless Gate 1 explicitly approves cross-repo scope. The default plan treats the
  client as an existing external executable.
- Any hidden weakening of existing tests or identity-harness expectations.

## Message Shape

M16 should keep the wire shape intentionally small. The preferred implementation is an optional `baton` envelope
on an ordinary `send_to_agent` call:

```ts
type BatonEnvelope = {
  kind: 'workflow_baton';
  originTag: '[PO]' | '[SM]';
  fromRole: string;
  toRole: string;
  batonId: string;
};
```

The baton text should still start with the same origin tag, so existing UI surfaces show the tag even if they do
not render metadata specially. The metadata is for recording and future M17 enforcement, not enforcement in M16.
M16 must not infer authority from metadata. The receiving agent still applies `AGENT.md` role-boundary rules.

If implementation discovers that attaching the envelope to `send_to_agent` would widen the blast radius, the
Implementer must stop and report. The acceptable fallback is to record the same envelope as a runtime event while
keeping `send_to_agent` text-only, but that fallback requires Implementation Reviewer disposition because it is
less directly aligned with the "message shape carrying the tag as data" goal.

## Task Breakdown

1. **M16-T1 - Baton metadata and deterministic recording proof.**
   Add the smallest in-repo baton metadata path and targeted tests. The test drives the real registry/MCP handler
   path (`handleMcpToolCall(..., 'send_to_agent', ...)`) between two agents or conversation participants, proves the
   receiving side gets the baton text, and proves the persisted transcript or runtime event contains the baton
   envelope. Existing message delivery without `baton` must remain unchanged.
2. **M16-T2 - Live orchestrator attach proof and closure.**
   Run one live proof against the real orchestrator attach server, not the in-process `McpExecServer` from SP-WAKE.
   Two externally attached sessions named for workflow seats block on `await_turn`; one sends a `[SM]` baton to the
   other; the receiving side gets it; the UI shows it through existing surfaces; NDJSON recording contains the baton
   metadata. Record relay count and any fallback moments.

## DoD Claims

| Claim | Bar |
|---|---|
| C1 | A baton can be sent through the existing attach/MCP path using `send_to_agent`, with origin tag and role metadata recorded as data. |
| C2 | Existing non-baton `send_to_agent` behavior is preserved, including ordinary user messages and pair conversations. |
| C3 | The live proof uses the real orchestrator attach server with two externally attached sessions blocking on `await_turn`; the proof does not rely on the SP-WAKE in-process exec server. |
| C4 | Runtime NDJSON evidence exists and contains the baton text, origin tag, from-role, to-role, and baton id. |
| C5 | UI visibility is achieved through existing surfaces; no new UI is required for M16. |
| C6 | Freeze bar green: targeted tests, `npx tsc -b`, full `npm test`, M14 identity harness, `npm run backlog:check`, whitespace check, and pollution check. |
| C7 | Scope fence clean: zero `team-coordinator.ts` diff, no consensus/protocol behavior changes, no client-repo changes unless Gate 1 explicitly approves them. |

## Live Proof Shape

The live proof should prefer this operator-observable path:

1. Start the orchestrator with `AGENTTALK_RECORDING_PATH=design/m16-one-real-baton.ndjson`.
2. Start the frontend so the PO can watch existing agent/conversation surfaces.
3. Create or activate two attach-mode agents with stable ids such as `planner-seat` and `plan-reviewer-seat`.
4. Launch two external `agentalk-mcp-client` sessions against the dedicated orchestrator MCP URL.
5. Send one baton from the first session to the second through the brain:
   `[SM] Baton to Plan Reviewer: M16 plan is ready for Gate 1 review.`
6. Verify the receiver gets the turn, the UI shows the message, and the NDJSON recording contains the baton
   envelope.

Provider choice is not the goal. If a real provider would burn unnecessary budget, the live proof may use the
client's deterministic command override, as long as the real orchestrator attach server and two external client
processes are used. If the reviewer considers that insufficiently "live", the finding should be recorded and a
real-provider rerun can be requested before closure.

## Verification Budgets

| Check | Max attempts |
|---|---:|
| Targeted baton metadata test | 3 |
| Existing direct-message/conversation regression test | 2 |
| Live orchestrator attach proof | 2 |
| `npx tsc -b` | 2 |
| Full `npm test` | 1 |
| `node scripts/m14-identity-harness.mjs --check` | 2 |
| `npm run backlog:check` | 1 |
| `git diff --check` | 2 |
| Pollution check: `git worktree list` + `git branch --list 'task-*'` | 1 |

## Risks

1. **Metadata path could become M17 by accident.** M16 records tag/role data only; it does not enforce authority
   or identity. Any refusal/authz logic is out of scope.
2. **UI visibility may tempt a new panel.** The M16 bar is visibility, not presentation quality. Use existing
   message/conversation surfaces.
3. **Live proof may expose attach-client limitations.** That is an accepted finding. Do not patch the external
   client inside M16 unless Gate 1 explicitly expands scope.
4. **Recorder coverage may be thinner than expected.** Prefer transcript-level metadata because existing
   `conversation` recording captures it. Add only minimal recording glue if that is not enough.

## Gate 1 Request

Plan Reviewer should approve or refute:

- whether optional baton metadata on `send_to_agent` is the right minimal M16 shape;
- whether deterministic command override is acceptable for the live proof if the real orchestrator attach server
  and external client processes are used;
- whether the two-task breakdown is small enough for the "one real baton" fence.

