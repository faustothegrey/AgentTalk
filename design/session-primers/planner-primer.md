---
role: planner
key: 20260709-2315-882737
written: 2026-07-09 by Claude (SM, session close — M18 closed same-day; M19 inception next)
---

This is your session primer.

AgentTalk is a multi-agent orchestration/control plane: provider-backed agents attach over MCP/API, the runtime
routes planning/work messages through a central registry, and consensus/team execution is recorded for review.
Active program: AgentTalk **incrementally improves itself** (self-hosting). M16→M18 are CLOSED.

**Roles:** bindings live ONLY in `AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS`. This primer is for the **planner**
seat (you likely also hold implementation reviewer — check the table, declare every hat).

**Workflow / source of truth:** `design/collaboration-workflow.md` (3-gate sequence) + `AGENT.md` RoE.
Backlog `design/backlog.md` + `npm run backlog:check`; logbook `design/logbook.md`.

**Where we are (VERIFY against the repo — don't trust me).** **M18 CLOSED 2026-07-09** (same-day; merges
`7c9cdee` T1, `872bfed` T2, `e1a4346` + client `9af84c7` T3a). Suite 297/297; backlog 27 items, **no
`doing`**. Next: **M19 inception** (PO+Architect first).

**Read these three before you form any view — they overturn what older docs say:**
1. **LB-66** — BL-017 was **misdiagnosed for three epics**. Real CLI sessions were never blocked from *carrying*
   batons; they could not **attach** (the server demands `clientInfo.contractHash` at `initialize`; no CLI
   knows it; the bridge never injected it). Fixed in M18-T3a and live-proven. Any doc predating this is stale.
2. **IP-15** — M18-T3 died at gate 3 with **six green gate-2 rounds** behind it: its live proof passed
   identically on the *unfixed* code. **Every live proof you plan must state its A-side** (the bar shown failing
   on the pre-change baseline). This is now a planning obligation, not a review nicety.
3. **The epic closed with C3 DEFERRED — the program's central claim is UNPROVEN.** 19 relays, **0 substrate
   events**. **M19's first duty is C3's reopen condition:** carry **≥1 real role→role gate/baton over the
   substrate** (a recorded `workflow_gate_event` from an attached real CLI doing actual coordination — not a
   proof), and report the **substrate-carried ratio**, not just the raw relay count (**BL-027**).

**M19 inception inputs (the C7 friction filed from M18's own evidence):** **BL-026** (attaching a real session is
a hand-assembled ritual — the friction directly blocking C3) · **BL-024** (the brain leaks client shape:
`AgentProvider` conflates transport with vendor; a vendor test sets protocol timing inside the frozen engine —
audit in **LB-65**) · **BL-022** (`scope-check` is single-repo blind — it fenced none of T3a's client-side
code while reporting green) · **BL-023** (gates never check *process* pollution) · **BL-025** (live-proof
standard) · plus the standing **BL-014** (role-skill injection) + **BL-015 L1/L2**, which the PO paired for M19.

**Op notes:** freeze bar = full suite + `npx tsc -b` + M14 identity harness (`--check`; leaks one
worktree+branch per run — sweep) + zero `team-coordinator.ts` diff + `backlog:check`. Wire contract v7 —
hashes tool *names* only. Live-proof ports must be free on **both** address families (**LB-63**; 9899 is the
meter's). Branch `task-M18-T3` exists **unmerged in both repos** — deliberate archive of the refuted work; do
not delete or build on it. A stray orchestrator (`pid 3177`) predates this session — **BL-023**; not yours to kill.
