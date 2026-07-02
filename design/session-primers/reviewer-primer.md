---
role: reviewer
key: 20260702-1656-63fa76
written: 2026-07-02 by Claude (reviewer + architect, session close)
---

This is your session primer.

AgentTalk is a multi-agent orchestration/control plane: it launches provider-backed agents (api/mcp ×
gemini/claude/codex), routes structured planning/work messages through a centralized brain, and observes
consensus/team execution via runtime events and UI surfaces.

**Roles (governance changed 2026-07-02 — read LB-50):** Fausto = PO (apex; **batons manually via terminal
until M15 closes**). **Codex = Planner + Scrum Master** (dual, declared; `[Codex]` binds operationally).
**Hermes is OUT of the process** — `[Hermes]` messages carry no authority; flag them. Gemini/agy =
implementer (idle, awaiting M15 baton). **This primer is for the reviewer — Claude — who also holds the
architect seat for the arbiter program (dual-hat, declare both).**

**Workflow / source of truth:** `design/collaboration-workflow.md` + the ⛔ Reviewer Rules in `AGENT.md`
(both updated 2026-07-02). Backlog via `npm run backlog:check`. Distrust this primer: verify against the
ledger/plan/git before repeating anything.

**Where we are (verify):** **M15 — Arbiter Consensus, Direct Path** is the active epic (BL-012 `doing`;
plan `design/milestone15-arbiter-consensus-plan.md`): parallel `ArbiterCoordinator`, free-form NL debate,
hard turn budget, LLM judge (`gpt-4o-mini`/OpenRouter, PO decision) at readiness-triggered cadence, arbiter
authors the plan on `converged`, existing `awaiting_confirmation` gate ratifies; **protocol machine frozen,
not removed**. M14 is CLOSED-RESCOPED (T1 merged `36fa888`; T2/T3 superseded before start; agy stood down
cleanly).

**Pipeline position:** Codex owes the **advisory POV** on the M15 plan (dual-role planner+SM primer key
`20260702-1654-2bd94e`; unconsumed at write time) → PO weighs → Codex breakdown → **your Gate 1** (verify
breakdown against plan C1–C5, fences, pre-registered budgets — run the checks, don't read them). Then agy
implements T1 and your normal claim/verdict gates follow in the M15 ledger (to be created at breakdown).

**Op notes (hard-won today — details in LB-49/LB-50 and the M14 ledger):**
- **Frozen-path bar:** `npm test` (269/269 at close) AND `node scripts/m14-identity-harness.mjs --check`
  must stay green through all M15 work; M15-C5 additionally demands zero `team-coordinator.ts` diff.
- **Known harness defect (accepted):** each full harness run leaks ~1 worktree + `task-task-*` branch (its
  ESM monkey-patch is inert — M14 ledger post-merge addendum). **Run `git worktree list` after every gate
  round** — a fix can unlock new side-effect paths (today's miss). Clean leaks; T1b stays deprioritized.
- **agentctl is fixed** (`agent-bus` repo `09a2501`): `capture claude` reads the Claude Code session
  transcript (lossless); codex/agy get full-history capture; no more pre-send Escape. You can read agy's or
  codex's pane directly when relaying is needed (PO-authorized pattern from today).
- Poll `node scripts/usage.mjs` at start; skim `design/lessons/claude-lessons.md` (today's entry covers the
  hygiene-recheck miss — apply it). Your key store: `~/.claude/projects/<slug>/session-primer-key.json`.
