---
role: implementer
key: 20260708-1437-m16-t1
written: 2026-07-08 by Codex (planner - M16-T1 implementer handoff after Gate 1)
---

This is your fresh implementer assignment.

**Role / authority.** You are the **Implementer** (Gemini/agy). Codex is Planner and Implementation Reviewer;
Claude is Scrum Master, Plan Reviewer, Task-end Reviewer, and Architect. Merge remains PO-gated. Follow
`AGENT.md`, `design/collaboration-workflow.md`, and the Implementer Rules of Engagement before touching files.

**Active epic.** **M16 - One real baton** (BL-013 `doing`).
- Plan: `design/milestone16-one-real-baton-plan.md`
- Ledger / task contract: `design/milestone16-one-real-baton-implementation.md`
- Gate 1: APPROVED WITH REQUIRED AMENDMENT FOLDED. The amendment is the active pair-conversation dependency:
  baton metadata must persist on the conversation transcript entry, and the live proof must start a pair
  conversation before sending the baton.

**Your task: M16-T1 only - Baton metadata and deterministic recording proof.**

Implement only the T1 scope from the ledger:
- Add the smallest durable optional baton metadata path.
- Preferred shape: optional `baton` envelope on ordinary `send_to_agent`:
  `{ kind: 'workflow_baton', originTag: '[PO]' | '[SM]', fromRole, toRole, batonId }`.
- Persist the baton envelope on the active conversation transcript entry.
- Add targeted deterministic coverage that drives the real registry/MCP handler path:
  `handleMcpToolCall(sender, 'send_to_agent', { ..., baton })`.
- In the test, start an active pair conversation first and set `maxRepliesPerAgent` comfortably above the proof
  need, so the baton cannot hit the reply cap.
- Prove ordinary non-baton `send_to_agent` behavior is unchanged.

**Hard fences.**
- Do **not** edit `packages/runtime-core/src/registry/team-coordinator.ts`.
- Do **not** change consensus, arbiter, planning-protocol behavior, `consensus_respond`, or workflow enforcement.
- Do **not** add UI.
- Do **not** edit the external `agentalk-mcp-client` repo.
- Do **not** implement M16-T2 live proof or closure.
- Do **not** broaden scope if the metadata path exposes a larger recording or identity problem. Stop and report.

**Allowed surfaces for T1.**
- `packages/contracts/src/types.ts` for optional baton metadata types on transcript/message records.
- `packages/runtime-core/src/registry/mcp-tools.ts` if `send_to_agent` schema needs optional baton metadata.
- `packages/runtime-core/src/registry/registry.ts` and `conversation-coordinator.ts` only for preserving and
  emitting metadata through existing message/conversation flow.
- Focused tests under `packages/runtime-core/src/registry/__tests__/`.
- Orchestrator server recording glue only if the existing `conversation` event cannot prove metadata in NDJSON;
  report before widening if that becomes more than minimal.
- The M16 plan and ledger for claims.

**Required verification budgets (pre-registered in the ledger).**
- Targeted baton metadata test: max 3 attempts.
- Existing direct-message/conversation regression test: max 2 attempts.
- `npx tsc -b`: max 2 attempts.
- Full `npm test`: max 1 attempt.
- `node scripts/m14-identity-harness.mjs --check`: max 2 attempts.
- `git diff --check`: max 2 attempts.
- Pollution check (`git worktree list` + `git branch --list 'task-*'`): max 1 attempt.

**Before coding.** Declare in your own words: scope, done, first approach, and the per-check retry budgets. Skim
`design/implementer-pitfalls.md` and `design/lessons/gemini-lessons.md`. Poll `node scripts/usage.mjs`
best-effort.

**When done or blocked.** File the implementer claim in the M16 ledger with exact command output, `git diff
--stat`, touched-file scope disposition, zero `team-coordinator.ts` diff confirmation, pollution check, and any
blocker. If a check hits its budget or exposes an out-of-scope behavior change, STOP and report.
