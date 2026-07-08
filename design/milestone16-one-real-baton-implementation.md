# M16 - One real baton - Implementation Ledger

> **Status:** PLANNING - Gate 1 verdict: **APPROVED WITH ONE REQUIRED AMENDMENT** (2026-07-08, Plan
> Reviewer: Claude — see § Gate 1 below). Planner folds the amendment; implementation starts after.
> **Plan:** `design/milestone16-one-real-baton-plan.md`
> **Backlog:** BL-013 (`doing`)
> **Base:** `master` at `838367a` (2026-07-08)
> **PO:** Fausto. **SM:** Claude. **Architect:** Claude. **Planner:** Codex.
> **Plan Reviewer:** Claude. **Implementer:** Gemini/agy. **Implementation Reviewer:** Codex.
> **Task-end Reviewer:** Claude.

This ledger owns task sequencing, implementer claims, implementation-review verdicts, closure evidence, and
telemetry for M16. The plan owns the epic goal and scope fence.

## Global M16 Rules

- **One baton only.** M16 proves one role-to-role baton over the AgentTalk brain. It does not implement the full
  gate workflow.
- **Record, do not enforce.** Origin tag and role metadata are data in M16. M17 owns session -> identity -> role
  mapping and tag enforcement.
- **No consensus changes.** Do not edit the arbiter/protocol consensus paths except where a reviewer explicitly
  accepts a no-op type-only touch as unavoidable.
- **Frozen protocol path.** Any diff to `packages/runtime-core/src/registry/team-coordinator.ts` refutes the
  task unless the PO explicitly rescopes M16.
- **No new UI.** Use existing message/conversation surfaces. Visibility is required; presentation polish is not.
- **Terminal fallback remains.** A live failure is a finding; do not remove or weaken manual relay.
- **Implementation claims must include:** exact command output, `git diff --stat`, touched-file scope disposition,
  zero `team-coordinator.ts` diff confirmation, pollution check, and any fallback moments.

## Current Status

- **M16-T1 (Baton metadata and deterministic recording proof):** Not started - waiting for Gate 1.
- **M16-T2 (Live orchestrator attach proof + closure):** Not started - depends on T1 verification.

## Sequencing

1. Plan Reviewer approves or refutes `design/milestone16-one-real-baton-plan.md`.
2. Implementer builds M16-T1 only.
3. Implementation Reviewer verifies or refutes M16-T1.
4. Implementer builds M16-T2 only after M16-T1 is VERIFIED.
5. Implementation Reviewer verifies or refutes M16-T2.
6. Task-end Reviewer performs fresh-eyes closure, writes telemetry, and handles the PO-gated merge.

## Claim / Verdict Ledger

The implementer records **Claim** entries with exact command output. The Implementation Reviewer records
**Verdict** only after running or independently checking the evidence. The Task-end Reviewer owns closure.

| Task | Owner | Implementer claim | Implementation Reviewer verdict | Evidence |
|---|---|---|---|---|
| M16-T1 | Gemini/agy | Not filed. | Not checked. | Gate 1 pending. |
| M16-T2 | Gemini/agy | Not filed. | Not checked. | Depends on M16-T1 verification. |

## Gate 1 — Plan Review (2026-07-08, Plan Reviewer: Claude)

**Verdict: APPROVED WITH ONE REQUIRED AMENDMENT.** Steelman first: the plan is genuinely small, honors every
gate constraint (blocking `await_turn`, real orchestrator for the live proof, fence, freeze bar), pre-registers
budgets per check, and asks precise Gate-1 questions. Its load-bearing claims were verified against the code,
not taken on faith: `AGENTTALK_RECORDING_PATH` is the real orchestrator recording knob
(`apps/orchestrator/src/index.ts:21`); `send_to_agent` routes agent→agent and wakes the receiver's blocked
`await_turn` via `queueTurn` (`registry.ts` `sendProtocol` EVT path); `conversation` events are recorded to
NDJSON and broadcast to the UI (`apps/orchestrator/src/server.ts:1036`); `registry.startConversation` is
reachable over the existing WS surface (`server.ts:930`); the external client is a pure relay (tool calls
originate orchestrator-side), so the cross-repo fence holds even in the preferred shape.

**F1 — REQUIRED AMENDMENT (spec gap that would trap the implementer):** a baton delivered agent→agent
**outside an active conversation** is delivered but **neither recorded nor UI-visible** — transcript recording
only fires when `findActiveConversationByAgents` returns one (`registry.ts:414-422`), and the bare-delivery
branch has no recorder or broadcast call. The live-proof steps as written (create agents → attach → send)
would therefore produce **zero NDJSON evidence and zero UI visibility — failing C4/C5 by design, not by
defect.** The plan must: (1) add an explicit live-proof step — *start a pair conversation between the two
seats* (existing `start_conversation` WS message / `registry.startConversation`) — before the baton is sent;
(2) name the active-conversation dependency in T1's test design (assert on the conversation transcript entry,
which is where the envelope must persist); (3) note the conversation reply cap (`maxRepliesPerAgent`) so the
proof sets it comfortably.

**Gate-1 question rulings:**
1. *Optional baton metadata on `send_to_agent`* — **APPROVED.** Verified additive: tool-schema property +
   EVT spread + conversation-message entry extension (+ contracts types). Emission is orchestrator-side
   (driver/translation), client untouched — F1's conversation entry is where it must persist.
2. *Deterministic command override for the live proof* — **APPROVED.** M16 proves transport, recording, and
   visibility — not LLM behavior; zero-spend matches the SP-WAKE precedent. The live substance is the real
   orchestrator attach server + two real external client processes, which the plan requires. A real-provider
   rerun stays available before closure per the plan's own line.
3. *Two-task breakdown* — **APPROVED.** T1 deterministic, T2 live + closure; small enough for the fence.

**Notes (no action required):** `originTag: '[PO]' | '[SM]'` matches the Origin Tag Protocol as of
2026-07-08 — do not grow the tag vocabulary in M16; seat names ride `fromRole`/`toRole`. The ledger's
allowed/forbidden surfaces are consistent with the plan's fence.

## M16-T1 - Baton Metadata and Deterministic Recording Proof

**Goal.** Add the smallest durable baton metadata path and prove it deterministically through the real registry/MCP
handler path.

**Allowed surfaces.**

- `packages/contracts/src/types.ts` for optional baton metadata types on transcript/message records.
- `packages/runtime-core/src/registry/mcp-tools.ts` if the `send_to_agent` schema needs optional baton metadata.
- `packages/runtime-core/src/registry/registry.ts` and `conversation-coordinator.ts` only for preserving and
  emitting the metadata through existing message/conversation flow.
- Existing registry/conversation tests or new focused tests under `packages/runtime-core/src/registry/__tests__/`.
- Orchestrator server recording glue only if existing `conversation`/`agent_message` events cannot prove the
  metadata in NDJSON.
- This ledger and the M16 plan.

**Forbidden surfaces.**

- `packages/runtime-core/src/registry/team-coordinator.ts`.
- Arbiter/protocol coordinator behavior.
- `consensus_respond` and planning MCP tool semantics.
- UI components, unless Gate 1 explicitly changes the "no new UI" fence.
- External `agentalk-mcp-client` repository.

**Required behavior.**

- Ordinary `send_to_agent` calls without baton metadata behave as they do today.
- A baton-bearing `send_to_agent` call records a `workflow_baton` envelope with:
  `originTag`, `fromRole`, `toRole`, and `batonId`.
- The baton text still starts with the origin tag so existing UI surfaces show the tag.
- M16 does not enforce origin-tag authority or role identity.
- Existing conversation/agent-message recording remains backward compatible.

**Pre-registered verification budgets.**

| Check | Max attempts |
|---|---:|
| Targeted baton metadata test | 3 |
| Existing direct-message/conversation regression test | 2 |
| `npx tsc -b` | 2 |
| Full `npm test` | 1 |
| `node scripts/m14-identity-harness.mjs --check` | 2 |
| `git diff --check` | 2 |
| Pollution check: `git worktree list` + `git branch --list 'task-*'` | 1 |

**DoD rows.**

| Claim | Required evidence |
|---|---|
| T1-C1 | Targeted test proves `handleMcpToolCall(sender, 'send_to_agent', { ..., baton })` delivers/records the baton metadata. |
| T1-C2 | Regression test or existing focused test proves non-baton `send_to_agent` behavior is unchanged. |
| T1-C3 | Recorded artifact or test fixture shows baton text plus `originTag`, `fromRole`, `toRole`, and `batonId`. |
| T1-C4 | No tag/role enforcement was added; M17 remains the enforcement milestone. |
| T1-C5 | Freeze checks run and scope report confirms zero `team-coordinator.ts` diff. |

## M16-T2 - Live Orchestrator Attach Proof + Closure

**Goal.** Prove one baton through the real orchestrator attach server with two external client sessions and record
the result.

**Allowed surfaces.**

- A live proof script under `scripts/` or a runbook under `design/`.
- Existing orchestrator startup/recording paths.
- Minor docs updates to this ledger, the plan, backlog/logbook at closure, and Codex lessons at session close.
- No production code unless T1 left an approved live-proof gap.

**Forbidden surfaces.**

- `team-coordinator.ts`.
- New workflow enforcement.
- New UI panels.
- External client changes unless Gate 1 explicitly approves cross-repo scope.

**Required behavior.**

- Live proof uses the real orchestrator attach server's dedicated MCP port.
- Two external client processes attach as workflow-seat agents and block on `await_turn`.
- One baton is sent through the brain and received by the other attached session.
- Existing UI surfaces show the baton text to the operator.
- `design/m16-one-real-baton.ndjson` or an equivalent committed recording contains the baton metadata.
- Relay count is recorded: terminal relay should be zero for the baton itself; fallback/poke moments are counted
  honestly if they occur.

**Pre-registered verification budgets.**

| Check | Max attempts |
|---|---:|
| Live orchestrator attach proof | 2 |
| Recording inspection | 2 |
| `npx tsc -b` | 1 |
| Full `npm test` | 1 |
| `node scripts/m14-identity-harness.mjs --check` | 1 |
| `npm run backlog:check` | 1 |
| `git diff --check` | 1 |
| Pollution check: `git worktree list` + `git branch --list 'task-*'` | 1 |

**DoD rows.**

| Claim | Required evidence |
|---|---|
| T2-C1 | Exact live command(s) and output show two external clients connected to the real orchestrator MCP URL. |
| T2-C2 | Receiver output and/or UI observation shows the baton landed without terminal paste. |
| T2-C3 | NDJSON recording contains the baton text and metadata. |
| T2-C4 | Fallback moments and relay count are recorded honestly. |
| T2-C5 | Freeze checks and pollution checks run after the live proof. |

## Closure Telemetry Template

Fill this at task-end review / closure:

```text
**Telemetry (task closure):**
- task:        M16
- wall-clock:  <start> -> <close> (<delta>)
- budget:      weekly <a%->b%> (delta ~x%), session <a%->b%> (delta ~y%) [or unavailable]
- gate:        tsc <0|n>, suite <p/p>, identity <green|red>, backlog <ok|fail>, pollution <clean|...>
- diff:        <N files, +adds/-dels>, commits <hashes>
- relay-count: <n> manual relays for the M16 baton proof; fallback moments <n>
- outcome:     <MERGED / BLOCKED / ...>
```

