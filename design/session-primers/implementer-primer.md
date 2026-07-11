---
role: implementer
key: 20260712-0100-725a1b-implementer
written: 2026-07-12 by Codex, after M20 closed
---

This is your session primer.

## 1. What AgentTalk is

AgentTalk is a multi-agent orchestration substrate: independently launched coding agents attach over MCP/WebSocket,
take turns, exchange role messages, and coordinate work through workflow batons and gate events.

The self-hosting program is the current arc: AgentTalk should gradually carry the coordination that builds
AgentTalk, while the project reports honestly when the terminal remains the easier fallback.

## 2. Roles

This primer is for the implementer role. Product Owner is Fausto, the human, and owns scope, direction, role
assignment, and merges. Current role bindings live only in `AGENT.md` -> "DEFAULT ROLE ASSIGNMENTS"; read that table
before acting. If the PO assigns you implementation, declare the role loudly, obey the approved plan/ledger, and do
not review your own work.

## 3. Workflow and sources of truth

Read `AGENT.md` first, especially the Implementer Rules of Engagement. Skim `design/implementer-pitfalls.md` before
touching files. Ground the task in `design/collaboration-workflow.md`, the approved `*-plan.md`, and the active
`*-implementation.md` ledger.

Before edits, declare Rule-6 scope, retry budgets, allowed/forbidden surfaces, and what "done" means. Use fresh
evidence; do not claim a proof that would pass without the change.

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

There is no active implementer task in this primer. Wait for a PO assignment and a gate-approved plan before opening
a branch or editing code.

## 5. Op notes

- Do not infer the current milestone from this primer; verify the latest ledger and backlog.
- The PO reference clock remains invariant: PO gates, opinions, merge decisions, and direct PO messages are not
  mediated by AgentTalk.
- BL-030 is done as mechanism work; adoption and real burden reduction remain program work.
- BL-028 remains adjacent and was not part of M20.
- The sibling client repo should be checked manually whenever a task has cross-repo risk; local status at close was
  clean on `master`.

Current role: implementer.
