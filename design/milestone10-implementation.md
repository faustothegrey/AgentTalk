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
| **T4** | API-path `tools`+`tool_choice`+strict `enum` enforcement optimization | **Implemented + gated on branch `m10-t4-api-enforcement`; merge = Fausto's call.** Plan `design/milestone10-t4-api-enforcement-plan.md`; decisions D-T4-1 static / D-T4-2 declare-unfit / D-T4-3 keep-both (Fausto 2026-06-26). |

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

## T4 — API-path protocol enforcement (`tools`+`tool_choice`+strict `enum`) (log)

**Scope declared (Rule 6):** emission layer, API path only. **ADD** `buildProtocolToolSchema()` to
`response-schema.ts` (single `respond` function tool; `message_type` enum derived from `STRUCTURED_MESSAGE_TYPES`
— one source of truth). Extend `api-client.ts` `ApiCallArgs`+body with `tools`/`tool_choice` (pass-through,
transport stays schema-agnostic) and prefer `tool_calls[].function.arguments` over `message.content` on decode.
`completer.ts` `ApiCompleter`: on structured turns send the tool + `tool_choice:'required'` + keep `response_format`.
**MUST NOT touch** (and didn't): `team-coordinator.ts`/grading/sequence, `McpCompleter`/MCP path, `registry.ts`
consensus mapping, wire-contract version, `parseStructuredResponse`/`validatePayload` semantics. Retry budget:
tsc ≤2, each new test ≤2, suite ≤2.

**Decisions (Fausto, 2026-06-26):** **D-T4-1** static enum (no phase-narrowing) · **D-T4-2** declare-unfit, **no**
`json_object` fallback machinery (a provider that rejects the combo is unfit for now; revisit if too restrictive) ·
**D-T4-3** keep `response_format` alongside the tool. Capability-handshake idea raised + decided against: model
self-report is the wrong layer (hallucinated; the model can't know its server's param support) — the correct form
is a transport probe, deferred (would double as the missing live-verification; reopens D-T4-2). See LB-25.

**Deliberate deviation from plan §5:** `message_payload` is a generic `object`, **not** per-type schema. The `enum`
on `message_type` is T4's headline guarantee (off-list action unrepresentable); per-field payload correctness stays
with `validatePayload` (the universal post-parse net). Avoids `oneOf` provider-compat surface — aligns with the
D-T4-2 "simplest / unfit-if-unsupported" stance. Flagged to Fausto, accepted.

**Behavior-preservation (verified):** non-tools requests are byte-identical (tools/tool_choice added only when
present); the two registry consensus tests mock `callApi` and ignore extra args; the real-`callApi` test passes no
tools so its exact-body assertion is unchanged; decode prefers `tool_calls` only when present, else `content`.

**Honesty — NOT done:** no live-provider call. The google/openrouter/nous combo
(`tools`+`tool_choice:'required'`+`response_format`) is **assumed**, unit-tested via injected `fetchFn` only. Per
D-T4-2 a 400 = unfit, but that path is untested against a real endpoint (parked while budgets tight; gemini API out
of budget).

**Files:** `response-schema.ts` (+`buildProtocolToolSchema`), `api-client.ts`, `completer.ts` + 3 test files
(`response-schema.test.ts` new; `api-client.test.ts`, `completer.test.ts` additions).

**Telemetry (task closure):**
- task:        M10-T4
- wall-clock:  2026-06-26 ~07:44 → ~08:12 CEST (~28 min)
- budget:      weekly 59%→60% (Δ ~1%), session 54%→60% (Δ ~6%) [per /usage]
- gate:        tsc 0, suite 213/213 (204 baseline +9 new), pollution clean
- diff:        6 files (5 mod +1 new test), +223/-5 (code+tests); ledger/plan/logbook separate
- outcome:     IMPLEMENTED ✅ — on branch `m10-t4-api-enforcement`, merge HUMAN-GATED (LB-14)
