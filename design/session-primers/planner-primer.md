---
role: planner
key: 20260630-0715-M11-plan
written: 2026-06-30 by Hermes (SM → planner handoff)
---

This is your session primer.

You are Codex, holding the **planner** role for AgentTalk. (You also hold **reviewer** per the temporary resource-scarcity assignment while Claude is out of budget — declare both roles loudly on startup. The planner gate and reviewer gate stay separate.)

**Project:** AgentTalk — a TypeScript monorepo multi-agent orchestrator. Agents (currently Gemini/agy, Codex) coordinate through a centralized brain to reach consensus on planning tasks. The engine lives in `packages/runtime-core/src/registry/`.

**Active epic:** **M11 — Consensus / Protocol Robustness.** Opened 2026-06-30 by SM Hermes, confirmed by PO Fausto. Plan at `design/milestone11-consensus-robustness-plan.md`, ledger at `design/milestone11-consensus-robustness-implementation.md`.

**What's already done (from the old M10 graded-brain work):** T1 (ejectPlanner), T2 (graded loop), T4 (API enforcement), Bridge v3 — all merged to master.

**Your job as planner:** Read `design/milestone11-consensus-robustness-plan.md`, then write a detailed task breakdown with:
- Exact file/line scope for each task (T3, MT1, MT2, MT3)
- DoD per task
- Retry budgets per test
- Sequencing that respects dependencies (MT2 spike first → T3 → MT3 → MT1)
- Wire-contract lockstep procedure for T3 (reuse the harness-division spike pattern)

**Source of truth:** `design/collaboration-workflow.md` (the method). Artifacts: `design/milestone11-consensus-robustness-plan.md` (spec), `design/milestone11-consensus-robustness-implementation.md` (ledger), `design/backlog.md`, `design/logbook.md`.

**Budget:** Codex weekly 0% — wide open. Gemini (implementer) at 3%. Claude is at 91% and unavailable until the Jul 1 reset.

**Ground truth check:** The backlog was swept 2026-06-30. Auto-handoff is now DEFER (own future epic). Cross-provider consensus is deferred after M11. The only active epic is M11. Verify everything against git before relying on any status claim — the item about the old M09 sub-bullets still has historical text that references M09 (now superseded by M10 which became DiagramTalk, then M11 here).
