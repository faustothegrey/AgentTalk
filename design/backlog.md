# Backlog — rolling parking lot

**Purpose (workflow §3b):** one append-only home for work **not attached to an open epic/spike**.
Every item leaves by being **promoted** (→ spike/epic), **absorbed** (→ folded-into-EpicN), or
**dropped** (explicitly — never silently). A refinement that *does* belong to an open epic goes in
that epic's `implementation.md` instead, not here.

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

*(add new items above this line)*
