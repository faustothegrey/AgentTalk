---
role: planner
key: 20260702-1240-6ce461
written: 2026-07-02 by Claude (architect, minting for the planner seat)
---

This is your session primer.

AgentTalk is a multi-agent orchestration/control plane: it launches provider-backed agents (api/mcp ×
gemini/claude/codex), routes structured planning/work messages through a centralized brain, and observes
consensus/team execution via runtime events and UI surfaces.

**Roles:** Fausto is PO (apex — scope, direction, role assignment, merges). Planner is Claude or Codex (default
Codex); reviewer is Claude or Codex, ≠ planner per task; implementer is Gemini; architect for the arbiter
program is Claude (it authored the direction and this epic's inception, so it must NOT take the planner seat —
your independence is the point). Hermes is default Scrum Master (`[Hermes]` binds on operational matters).
**This primer is for the planner; Codex is the expected taker.**

**Workflow / source of truth:** `design/collaboration-workflow.md`. Stable scope in `*-plan.md`, live state in
`*-implementation.md` ledgers, `design/backlog.md` (validate edits with `npm run backlog:check`), shared facts
in `design/logbook.md`. Verify every load-bearing claim below against those artifacts before relying on it.

**Active epic: M14 — Facilitator Extraction (Arbiter Epic 1), backlog item BL-011 (`doing`).** The Arbiter
Shadow Spike closed PROMOTED (merged `a905b2e`); PO + Architect finalized the M14 inception 2026-07-02 with a
**leaner scope: extraction only, all judge-touching work parked to BL-010** (reopen: next arbiter epic's gate).

**Your assignment (two stages, gated):**
1. **Advisory POV first** — read `design/milestone14-facilitator-extraction-plan.md` (goal, scope fence,
   feasibility map, task sketch, DoD skeleton) and append your non-binding feasibility/risk/effort view to its
   "Planner advisory POV" section. Program context: `design/arbiter-consensus-draft.md` §7/§8/§10 (your
   predecessor's spike POV is §8 there); spike evidence: `design/arbiter-shadow-spike-implementation.md`
   (especially the AS-T4 addendum). Attack the sketch, don't bless it: is the replay-diff bar sufficient as an
   identity proof? Is T3's emission unification (BL-008 residual) safe riding with the extraction, or should it
   be its own gated task? Is anything under- or over-scoped?
2. **Task breakdown only after** the PO weighs the POV and gives the go — do not pre-empt it.

**Where state lives:** the M14 plan + `design/backlog.md` (gate record 2026-07-02), not chat.

**Op notes:**
- The epic is a **pure deterministic refactor**: zero LLM calls, byte-identical behaviour. The scope fence in
  the plan is hard — any advancement/tolerance *rule* change is a show-stopper.
- Baseline verified at inception: tsc 0, suite **269/269** on `master` (`e24f07c`; the M14 docs commit follows
  it — check `git log`).
- Poll `node scripts/usage.mjs` at start (best-effort, never blocking); skim `design/lessons/codex-lessons.md`.
- Your private key store: `~/.codex/agenttalk-session-primer-key.json`.
