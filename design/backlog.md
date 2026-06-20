# Backlog — rolling parking lot

**Purpose (workflow §3b):** one rolling home for work **not attached to an open epic/spike**.
Every item leaves by being **promoted** (→ spike/epic), **absorbed** (→ folded-into-EpicN),
**dropped** (explicitly — never silently), or **done** (a one-off chore that's been executed —
remove the line; git history is the record). A refinement that *does* belong to an open epic goes in
that epic's `implementation.md` instead, not here.

**Backlog gate (workflow §3b):** before opening any new macro unit (epic/task), the
architect/reviewer reviews this file and **dispositions every open item** in the same pass — so
nothing rots by being forgotten.

**Entry format:** `- [STATUS] YYYY-MM-DD — <what> — <why>` where STATUS ∈ {open · parked ·
promoted→X · absorbed→X · dropped}.

---

## Items

- [absorbed→M06-v3] 2026-06-20 — Reconcile `wire-contract.json.data.messageTypes` to the real
  protocol message_types (currently lists phantom `plan_submission/planning_phase_complete/
  turn_complete/turn_error`) and bump to v3 — surfaced in Phase 6 review §9/§11; now an M06 DoD item.

- [open] 2026-06-20 — **Cross-provider consensus** (e.g. planner-a Google + planner-b OpenRouter/Hermes
  in one `planner-planner-worker` team) — deferred from M07-T2 (all-Google for budget). Promote once
  T2 is green and OpenRouter has credit / Hermes is live; proves the centralized brain mixes providers
  in a single consensus.

- [open] 2026-06-20 — **Auto-handoff between agents (remove the human as turn-scheduler)** — resolves
  workflow **open question #2** (relay overhead). Insight: the *channel* already exists (ledger +
  branch); what the human supplies is the **scheduler** ("vai te" / "ha finito, vai te"). Replace it
  with: (1) an explicit **3-state baton** at the top of `implementation.md` — `baton ∈ {impl, review,
  human}` + one-line reason; impl does the first non-VERIFIED row → commit claim-only → `baton:review`;
  reviewer runs it, fills verdicts → all VERIFIED → merge + next task → `baton:impl`, else REFUTED →
  `baton:impl`, else scope/decision → `baton:human`; (2) a **sequential conductor script** that loops
  `while baton != human && !done: invoke (headless) the agent named by the baton; re-read baton`. Human
  is invoked **only on `baton:human`**. Stays turn-based/sequential — **not** parallel worktrees (Fausto
  not ready for parallel agent orchestration yet). Guardrails: `max_rounds` per task (cap REFUTED↔fix
  ping-pong), keep the reviewer's *run-it* verification (the circuit breaker), single human escape
  hatch, log per-round token cost. **Defer:** revisit after M07-T3 (T3 likely needs the human in the
  loop). Document the baton protocol into `collaboration-workflow.md` before building the conductor.

- [open] 2026-06-20 — **Re-run the M07-T2 live smoke** (`scripts/test-live-api-team.mjs`, all-Google
  `gemini-2.5-flash`, 2 planners + worker in-process) **after the Google daily quota resets** — the
  deferred T2.4 / IMP-1. T2 was allowed to close without it (T2.3 mocked proves the flow
  deterministically). **Reopen condition:** if this live run fails or surfaces a defect → **reopen
  M07-T2**. On green, note T2.4 as confirmed-live in the (frozen) ledger.

*(add new items above this line)*
