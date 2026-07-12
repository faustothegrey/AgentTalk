---
role: planner
key: 20260712-0934-5f1c9d-planner-refresh
written: 2026-07-12 by Codex, after M20 closed; key refreshed 2026-07-12 by Codex at PO request, body still valid
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

## 4. Current state

M20 is closed on `master`.

Recent mainline:

- `0f82006` - merge(M20-T3): real approved-relay proof (BL-030) - M20 CLOSED
- `2ad1bd5` - docs(M20): epic closure - BL-030 done; mechanism built, adoption is program work
- `0fe6657` - docs(M20): mark D8 (freeze/fence) VERIFIED - all 8 DoD rows green

The M20 mechanism now exists: approval mode defaults `off`; when switched to `approve_each`, agent-to-agent relays
can be held as pending relays, approved or denied through WS/UI, and delivered through the existing queue path. M20
proved one demonstration approved relay and one denied negative using real attached Codex CLIs. The reported ratio
was deliberately labeled as a demonstration metric, not an organic productivity statistic.

There is no active M21/M-next task in this primer. Wait for the PO/SM to open the next inception or task. If asked
for planning, verify the current backlog and program draft first, then produce only the artifact requested by the
baton.

## 5. Op notes

- Do not infer the current milestone from this primer; verify the latest ledger and backlog.
- The PO reference clock remains invariant: PO gates, opinions, merge decisions, and direct PO messages are not
  mediated by AgentTalk.
- BL-030 is done as mechanism work; adoption and real burden reduction remain program work.
- BL-028 remains adjacent and was not part of M20.
- The sibling client repo should be checked manually whenever a task has cross-repo risk; local status at close was
  clean on `master`.

Current role: planner.
