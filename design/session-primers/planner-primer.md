---
role: planner
key: 20260709-1231-b7e4d2
written: 2026-07-09 by Claude (SM, session close — M17 closed same-day)
---

This is your session primer.

AgentTalk is a multi-agent orchestration/control plane: provider-backed agents attach over MCP/API, the
runtime routes planning/work messages through a central registry, and consensus/team execution is recorded
for review. Active program: AgentTalk **incrementally improves itself** (self-hosting, M16→M18).

**Roles:** current bindings live ONLY in `AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS`. This primer is for the
**planner** seat (you likely also hold implementation reviewer — check the table and declare all your hats).

**Workflow / source of truth:** `design/collaboration-workflow.md` (3-gate sequence) + `AGENT.md` RoE.
Backlog `design/backlog.md` + `npm run backlog:check`; logbook `design/logbook.md` (read LB-63 — ports).

**Where we are (verify against the repo — don't trust me):** **M17 — The gate over the channel is CLOSED**
(2026-07-09, same-day epic; merges `5e4ca27`/`59856f9`/`467bd4a`; ledger
`design/milestone17-gate-over-channel-implementation.md` frozen; suite 291/291 at close). The brain now
enforces session→identity→role authority (Authority Invariant in the ledger). **No item is `doing`** — next
is **M18 inception** (PO+Architect first, per `design/self-hosting-program-draft.md` §M18); your planner
acts there: the **advisory POV**, then plan authoring after the gate opens it.

**Pre-named M18 inception inputs (carry them into your POV/plan):**
1. **BL-017** — exec-bridge can't carry baton/workflow envelopes; real CLI sessions still can't send them.
   M18's DoD (relay ≈0, real epic on the substrate) is unachievable without it — likely M18-T1. Its
   inception must re-read BL-018 (a contract-hash bump may recur = its reopen condition).
2. **BL-020** — the orchestrator process **dies when an attached client disconnects mid-turn**
   (`InProcessAgentDriver.loop` illegal-transition throw escapes). The substrate cannot host a real epic
   while a disconnect can kill it. Found live at M17-T3 gate 3 (flywheel catch #2).
3. Planner meta-concerns #3/#4 (2026-07-09, recorded dispositions): BL-017 timing; harness-zoo pressure —
   M18's thesis is proofs become recordings of real use.

**Op notes:** freeze bar unchanged (full suite + M14 identity harness + zero `team-coordinator.ts` diff;
harness leaks one worktree+branch per run — sweep). Live-proof runbooks must pick a port free on BOTH
address families (LB-63 — 9899 is the meter's). Relay-count metric: M16 ~15 → M17 ~15 (flat, expected);
**the fall is M18's claim.** Wire contract still v7 — it hashes tool *names* only, so extending
`send_to_agent` args is hash-neutral, adding a tool is not.
