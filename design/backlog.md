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

- [open] 2026-06-20 — **Cross-provider consensus** (e.g. planner-a Google + planner-b Nous in one
  `planner-planner-worker` team) — deferred from M07-T2 (all-Google for budget). Proves the centralized
  brain mixes providers in a single consensus.
  - **Readiness (facts: logbook LB-1/LB-2):** pair **Google + Nous** (Nous = GREEN 3/3 with a
    valid id; it's an aggregator). **Not** OpenRouter-`:free` (flaky/429). When promoting, **fix
    `api-client.ts` `nous` defaultModel** (`deepseek-v4-flash` 404s).

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
  - **DOUBLY blocked (updated 2026-06-21, facts LB-6/7/8):** not just quota. `gemini-2.5-flash` is the
    only model observed to hold the protocol, and its quota is **family-wide** (2.5/2.0 all share one 429
    cap; 3.0/gemma-4-31b 404 — LB-8). Every quota-*free* model (`gemma-4-26b`, `*-flash-lite`) **fails
    protocol compliance** (LB-6/7). So T2.4 needs **quota relief AND consensus protocol-tolerance** (see
    the M08 item), **or** a frontier-compliant model with available quota. **Do not burn live runs on
    unfit models meanwhile** (live-test gate, M08 item).

- [open] 2026-06-20 — **Dedicated "failure modes / resilience" milestone (candidate M08+)** — Fausto's
  idea: there are *many* failure modes (agent crash mid-task, partial worktree writes, network drops,
  mid-turn quota exhaustion, deadlocks, corrupted state, …) and bolting them all onto M07-T3 would bloat
  it. Give them their own milestone that **consolidates + extends** what exists (M03 agent-failure
  propagation; T3b's effect-fence is the *first* forced instance, R2). **Next step:** brain-dump the
  modes Fausto already has in mind into this item (or the logbook), then promote to a milestone with
  its own plan. Don't start until M07 closes.
  - **Explicitly absorbs (Fausto, 2026-06-21):** the **effect-fence** (D4 = worker crash mid-exec →
    stop-and-ask; *policy* decided, *implementation* lives here, not T3b-2); the **exec-RPC reconnect
    delivery gap** (**IMP-T3b-1** from the T3b-1 ledger); and **`CliExecCompleter` disconnect/timeout
    rejection** (today it never rejects → a mid-exec disconnect hangs the turn). These were re-scoped OUT
    of T3b-2 to keep it inversion-only.
  - **Also absorbs (Fausto + Claude, 2026-06-21) — consensus protocol fault-tolerance:** the phase
    state machine has **zero tolerance for a well-formed-but-illegal transition** — one planner emitting
    the wrong `message_type` for the current phase (e.g. a 2nd `agreement_proposal`, or `agreement_acceptance`
    with nothing pending) crashes **both** planners into `error` → forced shutdown (facts: **LB-6/LB-7**).
    Q1's structured-output retry only catches *malformed JSON*, not *valid-but-wrong-phase* messages. The
    centralized brain (it now owns lifecycle + `message_type→tool`) is the right place to add tolerance —
    **detect the illegal transition → coerce / re-prompt / fail soft for that one agent**, instead of the
    dual force-kill. *Open design call (spike when M08 opens):* bolt-on tolerance vs. rethink the strict
    phase machine to be tolerant-by-design.
  - **Live-test gate (Fausto, 2026-06-21):** until this tolerance lands (or a protocol-compliant model with
    available quota exists), **do NOT spend live *consensus* runs on protocol-unfit models** (`gemma-4-26b`,
    `gemini-*-flash-lite`) — they only re-confirm LB-6/7, zero new signal. **Worker / single-agent live runs
    are unaffected** (they don't exercise the consensus state machine).

- [open] 2026-06-21 — **Worker-prompt worktree cleanup (FIND-T3b2-1)** — the worker prompt
  (`in-process-driver.ts` `handleTeamWorkAssign`) still tells agy *"you must use strictly `git worktree`…
  or refuse,"* but the orchestrator **already** runs the worker inside a per-task worktree (its `cwd`). So
  agy creates a **nested** worktree (`./worker-worktree`) and the real change lands one level deeper than
  where the orchestrator looks. Confirmed live in T3b-2.5 (change *is* inside a worktree → DoD met, but
  nested). **Fix candidate:** drop/relax the redundant "create a worktree" instruction since isolation is
  already provided; **behavior change → needs its own spec** before touching. Matters once the orchestrator
  needs to *collect* worker output (M07-T4 / failure-modes), not before.

*(add new items above this line)*
