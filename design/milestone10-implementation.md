# Milestone 10 — Graded, stateful protocol brain — Implementation Status

> Plans: `design/milestone10-protocol-compliance-plan.md` (thesis + diagram) and
> `design/milestone10-phase2-plan.md` (T1–T4 breakdown, decisions D1/D2/D3). Phase-1 design spike = LB-20.
> Implementer = Claude under LB-14 (Gemini out of weekly budget): I implement + gate + self-review; **merge/closure
> is HUMAN-GATED (Fausto), per task.** Every M10 engine task is an approved-for-the-milestone behaviour change but
> still needs **per-task** sign-off, and any *tested* dual-kill contract rewrite (T2) needs explicit approval before
> the test is touched.

**Decisions (settled, Fausto 2026-06-25):** **D1** eject = fail-soft · **D2** retry budget N=2 · **D3** v1 = T1+T2
(T3 single-tool + T4 API-enforcement deferred).

Baseline before T1: `master` `5cc84d2`, `tsc -b` 0, **183/183** (32 files).

## Task ledger

| Task | What | Status |
|---|---|---|
| **T1** | Peer-safe `ejectPlanner(agentId, reason)` — additive non-killing path (D1 fail-soft) | **Implemented + gated on branch `m10-t1-eject-planner`; merge = Fausto's call.** |
| T2 | Generalise the graded loop at the validation site (correct → retry N=2 → eject, not dual-kill) | **Implemented + gated on `m10-t2-graded-loop` (stacked on T1); merge = Fausto's call.** Decisions D-T2a (minimal) + D-T2b (unify) approved; proposal `design/milestone10-t2-contract-proposal.md`. |
| T3 | Single tool `consensus_respond(action, payload)` (wire-contract v5→v6, lockstep client) | Deferred (D3). |
| T4 | API-path `tools`+`tool_choice`+strict `enum` enforcement optimization | Deferred (D3). |

## T1 — peer-safe `ejectPlanner` (log)

**Scope declared (Rule 6):** ADD one method `ejectPlanner` to `team-coordinator.ts` (additive, zero callers) + ADD
one regression test to `agent-failure-impact.test.ts`. **MUST NOT** touch `interruptPlanningForMissingEvents` or
its callers (the dual-kill — T2's job), the validation site, any existing test, or the wire contract. Retry budget:
tsc ≤2, new test ≤3, suite ≤2.

**Design.** Mirrors `pauseTaskForOperator` (the M08-T3 separate-non-killing-path template) rather than the M03
dual-kill `interruptPlanningForMissingEvents` (which shuts down BOTH planners — the LB-7/8 bug). `ejectPlanner`:
- freezes the task in `awaiting_operator` (fail-soft per D1 — task stays attached, team NOT killed),
- records a transcript entry + emits,
- notifies surviving planner(s) via `sendProtocol` ("You remain active") — kept alive, **not** shut down,
- `requestAgentShutdown(agentId)` on the **offender only**,
- clears this task's planning watchdogs so no stray timer re-fires the dual-kill.
Rationale for freeze-not-continue: with <2 planners consensus can't proceed (D1 — no continue-solo in v1).

**Changes (2 files, +136/-0):**
- `packages/runtime-core/src/registry/team-coordinator.ts` — new `async ejectPlanner` (additive; placed beside
  `removeAgentFromTeams`, after `pauseTaskForOperator`).
- `apps/orchestrator/src/__tests__/agent-failure-impact.test.ts` — new regression test: eject A → `removeAgent('p1')`
  fires, `removeAgent('p2')` does NOT (the inverse of dual-kill); task → `awaiting_operator`; team status unchanged;
  peer notified.

**Gate (actual):** `tsc -b` 0; full suite **184/184** (was 183, +1); LB-9 pollution clean (no `/tmp/agentalk-*`,
no stray `task-*` branches/`planning_runs`); `git diff --stat` = the 2 declared files only.

**No existing behaviour changed** — T1 has zero callers; the dual-kill path is byte-for-byte untouched. T2 will
rewire the validation site to call `ejectPlanner` (after a bounded correct/retry) and that is where the tested
dual-kill contracts get rewritten — surfaced for approval first.

## T2 — graded loop (correct → retry N=2 → eject) (log)

**Scope declared (Rule 6):** generalise `validateProtocolStep` (illegal move → bounded correction → `ejectPlanner`)
+ add `askProtocolCorrection` + remove now-dead `interruptPlanningForRegression`; rewrite the **approved**
illegal-move dual-kill test contracts + add a recovery test. MUST NOT touch the dual-kill body, `handleAgentFailure`,
watchdogs, agreement-fallback (`:806`), phase-guard throws (`:514/:590`), consensus tests, or the wire contract.

**Decisions:** D-T2a **minimal** (only the `validateProtocolStep` terminal converts) · D-T2b **unify** (forward/lateral
illegal moves get the bounded retry too, not just regressions). Both approved by Fausto 2026-06-25.

**🚩 Honesty note — it was 3 tested contracts, not 2.** The proposal itemised C1 (`submit_plan` before agreement,
:819) + C2 (confirmed regression, :877). On implementation a **third** surfaced — **C3** (`should immediately
interrupt … repeated agreement_acceptance when submit_plan expected`, :1182): a lateral illegal move that today
dual-killed *immediately*. Under the **approved** D-T2b (unify) it is the same mechanical class as C1 (forward/lateral
→ correct → eject), so it was rewritten to match. Flagged to Fausto; merge is his gate. The two **retry-only** tests
(:954 confirmation-ask, :1010 clear-on-advance) were verified to stay green **unchanged**.

**Changes (2 code/test files, +201/-49):**
- `team-coordinator.ts` — `validateProtocolStep` now routes ANY illegal move (regression via
  `askRegressionConfirmation`; forward/lateral via new `askProtocolCorrection`) through a shared N=2 budget
  (`MAX_REGRESSION_RETRIES`, comment-generalised, no rename) → on exhaustion `ejectPlanner` (T1) instead of the
  dual-kill. Dead `interruptPlanningForRegression` removed (sole caller was this site).
- `team-coordinator.test.ts` — C1/C2/C3 rewritten to graded-loop+eject (`awaiting_operator`, peer alive, task
  attached); new recovery test (illegal → corrected → legal move → survives, no eject).

**Untouched (verified):** dual-kill `interruptPlanningForMissingEvents` body, agent-failure + watchdog paths,
agreement-fallback, phase-guard throws, both consensus tests, `agent-failure-impact.test.ts` failure cases.

**Gate (actual):** `tsc -b` 0 (dead-method removal compiled clean); full suite **185/185** (184 → +1 recovery
test; C1/C2/C3 rewritten not added); LB-9 pollution clean (`planning_runs` is gitignored, pre-existing); `git
diff --stat` = the 2 declared files only.

**Telemetry (task closure):**
- task:        M10-T2
- wall-clock:  2026-06-25 ~20:40 → 21:08 CEST (~28 min)
- budget:      weekly 48%→50% (Δ ~2%), session [unavailable — meter showed weekly only this read]
- gate:        tsc 0, suite 185/185, pollution clean
- diff:        2 files, +201/-49; commit `5fea20c` (+ proposal doc `8ceb1a6` on this branch)
- outcome:     IMPLEMENTED ✅ — on branch `m10-t2-graded-loop`, merge HUMAN-GATED (LB-14); 2→3 contract correction flagged

**Telemetry (task closure):**
- task:        M10-T1
- wall-clock:  2026-06-25 ~20:24 → 20:37 CEST (~13 min)
- budget:      weekly 48%→49% (Δ ~1%), session ~43% (Δ ~0%) [per /usage, updated 20:34]
- gate:        tsc 0, suite 184/184, pollution clean
- diff:        3 files (incl. this ledger), +136/-0 code; commit `76e5b34`
- outcome:     IMPLEMENTED ✅ — on branch `m10-t1-eject-planner`, merge HUMAN-GATED (LB-14)
