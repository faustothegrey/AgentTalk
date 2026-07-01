---
role: planner
key: 20260701-2244-b4749e
written: 2026-07-01 by Claude (architect, minting for the planner seat)
---

This is your session primer.

AgentTalk is a multi-agent orchestration/control plane: it launches provider-backed agents (api/mcp ×
gemini/claude/codex), routes structured planning/work messages through a centralized brain, and observes
consensus/team execution via runtime events and UI surfaces.

**Roles:** Fausto is PO (apex — scope, direction, role assignment, merges). Planner is Claude or Codex (default
Codex); reviewer is Claude or Codex, ≠ planner per task by default; implementer is Gemini; architect for the
arbiter program is Claude (it authored the direction draft, so it must NOT take the planner seat — that
independence is why this primer exists). Hermes is default Scrum Master. **This primer is for the planner; Codex
is the expected taker.**

**Workflow / source of truth:** `design/collaboration-workflow.md`. Stable scope in `*-plan.md`, live state in
`*-implementation.md` ledgers, `design/backlog.md` (validate edits with `npm run backlog:check`), shared facts in
`design/logbook.md`. Verify every load-bearing claim below against those artifacts before relying on it.

**Where we are:** M12 (cross-provider consensus) is CLOSED — ledger status corrected 2026-07-01, loose ends swept
(BL-001 done, PF2 script committed, gemini v5 gate PASSED → all three providers parity-green). The active thread
is the **semantic-arbiter program** (BL-009): direction draft `design/arbiter-consensus-draft.md` now carries
Architect (§1–7), Planner-Codex (§8), Implementer-Gemini (§9) POVs plus the Architect synthesis (§10 — read it;
it adopts YOUR 4-epic split and the M11-floor-stays concession). The 2026-07-01 §3b backlog gate is recorded in
`backlog.md`; BL-009 is promoted → arbiter shadow spike.

**Your assignment (two steps, gated):**
1. **Advisory POV** (per epic-inception, workflow §1) on `design/arbiter-shadow-spike-plan.md` — the Architect's
   inception draft for the shadow-mode spike (goal: measure agreement/recovery/cost/cadence of an LLM arbiter
   over recorded transcripts; zero production change). Attack feasibility/risk/effort; the corpus-is-empty
   finding and the DoD floor (5/5/2 labeled transcripts) deserve scrutiny. Non-binding — PO+Architect weigh it.
2. **Only after the PO's go:** task-level breakdown of the spike (the plan fixes goal/fence/DoD bar; tasks are
   yours).

**Op notes:** BL-002 (auto-handoff): the PO **deferred** the absorb-into-arbiter-program call (2026-07-01);
it re-raises at the gate that opens arbiter Epic 1 — not decided, not yours to plan around. Recording infra: `packages/observability/src/recordings/` (JSONL recorder +
`npm run play-recording`), opt-in via `AGENTTALK_DIAGRAM_RECORD` (default OFF, LB-24); **zero recordings exist on
disk today** — corpus assembly is spike step 0. `@agenttalk/llm-client` is the registry-free way to call an LLM
judge. Codex budget at primer-write: weekly 60% used, 5h window 76% used — check `node scripts/usage.mjs` at
start and scope the POV to headroom (it's a read+write-one-doc task, cheap). Suite/tsc green at `master`
(pushed through `6c92706`).
