---
role: planner
key: 20260713-0116-2be1cd-planner
written: 2026-07-13 by Codex at session close after BL-031 real-provider validation
---

This is your session primer.

## 1. What AgentTalk is

AgentTalk is a multi-agent orchestration substrate: independently launched coding agents attach over MCP/WebSocket,
take turns, exchange role messages, and coordinate work through workflow batons and gate events.

The self-hosting program is the current arc: AgentTalk should gradually carry the coordination that builds
AgentTalk, while the project reports honestly when the terminal remains the easier fallback.

## 2. Roles

This primer is for the planner role. Product Owner is Fausto, the human, and owns scope, direction, role assignment,
and merges. Current role bindings live only in `AGENT.md` -> "DEFAULT ROLE ASSIGNMENTS"; read that table before
acting. Preserve the independence defaults: Plan Reviewer != Planner, Implementation Reviewer != Implementer, and
Task-end Reviewer is fresh eyes unless the PO explicitly accepts a resource fallback.

## 3. Workflow and sources of truth

Read `AGENT.md` first, including the primer handshake and resource meter rule. Then ground any assignment in
`design/collaboration-workflow.md`.

State lives in durable artifacts, not chat:

- `design/backlog.md`
- `design/logbook.md`
- `design/self-hosting-program-draft.md`
- the active milestone's `*-plan.md`
- the active milestone's `*-implementation.md` ledger

Skim `design/lessons/codex-lessons.md` if you are Codex, and poll `node scripts/usage.mjs`. Both are best-effort;
neither blocks real work.

## 4. Current State

M20 and BL-032 are closed on `master`.

Recent mainline at primer write:

- `e705bc3` - docs(BL-031): record real-provider validation wrap-up
- `8f03bad` - docs(BL-032): mark done + unblock BL-031
- `7dc3f19` - fix(BL-032): align attach-mode healthcheck exec deadline to the healthcheck contract

BL-031 has a validation branch: `/Users/fausto/Software/AgentTalk-BL-031-validation`,
`fix/BL-031-inline-relay-approval`, commit `da07821` (`fix(BL-031): validate supervised conversation control`).
Codex acted as temporary implementer and tester. The real-provider, PO-driven tester run validated the human-facing
Continue/Stop conversation-control behavior (LB-86), but Codex must not self-review the implementation.

New backlog item: **BL-033** — MCP pair-chat agents remain busy after `conversation_end`. This was split out from
BL-031 because Continue/Stop gating works, but completion cleanup leaves attached agents/clients in stale busy/waiting
state.

There is no active planner task in this primer. Wait for the PO/SM to open the next inception or task. If asked for
planning, verify the current backlog and program draft first, then produce only the artifact requested by the baton.

## 5. Op notes

- Do not infer the current milestone from this primer; verify the latest ledger and backlog.
- The PO reference clock remains invariant: PO gates, opinions, merge decisions, and direct PO messages are not
  mediated by AgentTalk.
- BL-031 is not an independent-review closure: Codex authored the latest implementation and tester evidence.
- BL-033 is the most obvious follow-up if the PO wants to clean lifecycle behavior before merge/closure.
- The production-equivalent testing rule is now explicit in Codex lessons: no fake provider/model deviation in a
  validation run without explicit PO consent.

Current role: planner.
