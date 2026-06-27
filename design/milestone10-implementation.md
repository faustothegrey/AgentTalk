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
| **T1** | Peer-safe `ejectPlanner(agentId, reason)` — additive non-killing path (D1 fail-soft) | **✅ MERGED to `master` (`76e5b34`) + pushed** (Fausto, after the 2026-06-26 primer was written — branch `m10-t1-eject-planner` merged then deleted). |
| T2 | Generalise the graded loop at the validation site (correct → retry N=2 → eject, not dual-kill) | **✅ MERGED to `master` (`5fea20c`) + pushed** (Fausto, after the primer — branch `m10-t2-graded-loop` merged then deleted). Decisions D-T2a (minimal) + D-T2b (unify); proposal `design/milestone10-t2-contract-proposal.md`. |
| T3 | Single tool `consensus_respond(action, payload)` (wire-contract v5→v6, lockstep client) | Deferred (D3). |
| **T4** | API-path `tools`+`tool_choice`+strict `enum` enforcement optimization | **✅ MERGED to `master` (`d0462b6`) + pushed (Fausto's go, 2026-06-26).** Plan `design/milestone10-t4-api-enforcement-plan.md`; decisions D-T4-1 static / D-T4-2 declare-unfit / D-T4-3 keep-both. Live-verification probe → backlog spike. |
| **Bridge v3** | DiagramTalk overlay: `endorse` stop + `e4`, and the `o1–o6` eject/correction lanes — via a separate observation-only hook (`onProtocolEvent`), brain consensus logic untouched | **✅ MERGED to `master` (`53593a4`) + pushed.** Plan `design/milestone10-diagramtalk-overlay-plan.md`; full record [[LB-26]] + status correction [[LB-31]]. Continues bridge v1/v2 ([[LB-22]]/[[LB-23]]/[[LB-24]]). |

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
- outcome:     MERGED ✅ — ff to `master` at `d0462b6` (Fausto's go) + pushed

## Bridge v3 — DiagramTalk overlay (`endorse`/`e4` + `o1–o6` lanes) (log)

Lights the two diagram features v1 left dark, via a SECOND brain observability hook
`onProtocolEvent` (re-emitted by the Registry as `team_protocol_event`) kept SEPARATE from the
phase funnel so it never touches consensus validation:
- **`endorsed`** (emitted at the agreement-acceptance site, before `submittal_pending`) → badge stops
  on `endorse` + pulses `e4` (closes the v1 gap where the badge jumped `prop ▶ submit`).
- **`correction`** (validateProtocolStep retry branch) / **`eject`** (ejectPlanner) → pulse the phase's
  eject/correction lane (`oN` edge + `l-*` node) in violet / red.
Brain edits are **additive emit-only** (3 sites + `emitProtocolEvent` helper, same swallow discipline as
`onPhaseChange`); validation/control flow untouched. Bridge serialises all commands through one
tail-promise queue so the back-to-back `endorsed`→`submittal` pair can't interleave on the wire.

**Live finding (badge-walk caught it):** the v3 default `correctionColor:'orange'` is NOT in DiagramTalk's
`HIGHLIGHT_COLORS {yellow,blue,green,red,violet}` → 400'd live (unit tests missed it — they mock `fetch`,
which doesn't validate the palette). Fixed: default → **violet**; the bridge test now pins a valid in-palette
default. Re-walk clean (8/8 commands accepted); Fausto visually confirmed the `endorse` stop + both lanes.

**Telemetry (task closure):**
- task:        M10 Bridge-v3 (DiagramTalk overlay)
- wall-clock:  2026-06-26 ~12:30 → ~13:15 CEST (~45 min, incl. live badge-walk + orange→violet fix)
- budget:      weekly 62%→65% (Δ ~3%), session reset mid-task (79%→new window, 28% at close) [per /usage]
- gate:        tsc 0, suite 225/225 (213 baseline +12 new), pollution clean
- diff:        6 mod +2 new (plan + protocol-event-hook.test.ts); commit `53593a4`
- outcome:     MERGED ✅ — ff to `master` at `53593a4` + pushed

## T4 Live Probe (log)

**Review verdict (Claude, planner-reviewer, 2026-06-27 ~10:40 CEST) — VERIFIED ✅, endorse merge.**
Every DoD row was settled by an independent run (not by reading the diff):

| DoD row (plan §4) | Verdict | Evidence (run by reviewer) |
|---|---|---|
| Script added + documented via `--help` | ✅ VERIFIED | `--help` → exit 0, full usage printed |
| `npm run build` passes | ✅ VERIFIED | `tsc -b` → exit 0 |
| Existing full suite stays green | ✅ VERIFIED | `npm test` → **245/245**, 41 files (zero production files in `master...HEAD` diff, so unaffected by construction too) |
| No-key run reports `skipped`, exits 0 | ✅ VERIFIED | env-cleared run → 3× `skipped`, exit 0 |
| Key present → one live request, honestly classified | ✅ VERIFIED | live run reproduced LB-46 exactly (below) |
| Results recorded to logbook/ledger | ✅ VERIFIED | LB-46 + this telemetry block |

Live findings independently reproduced (match LB-46): `openrouter`/gpt-4o-mini = **fit**; `google`/gemini-2.5-flash
= **http_reject 400** ("Forced function calling (ANY mode) with a response mime type 'application/json' is
unsupported"); `nous`/deepseek-v4-flash = **http_reject 404** (default model missing). Exit 0 on rejection (unfitness
= measured result, not script failure — correct per plan §3). Scope clean: no production code touched.

**Non-blocking nit (logged, not fixed):** literal `\n` printing in output (source has `\\n` in `console.log`) +
same `\\n` in the reject-`detail` regex — cosmetic only on a throwaway diagnostic script. Reviewer judgment: not
worth an implementer round; fix-on-next-touch.

**Open decision surfaced (plan §5):** the probe turns Google's unfitness from hypothesis into a measured fact →
whether to reopen **D-T4-2** (declare-unfit → detect-and-gate) is a Scrum-Master call. LB-46 leans "declare-unfit
holds."

**Telemetry (task closure):**
- task:        M10-T4-live-probe
- wall-clock:  2026-06-27 10:28 → 10:33 CEST (~5 min impl); review ~10:38 → 10:42 CEST
- budget:      antigravity session ~2% (impl) [per /usage]; reviewer claude weekly 85% / session 80% at review start
- gate:        tsc 0, suite 245/245 (reviewer-run), pollution clean
- diff:        probe script + package.json + logbook(LB-46) + ledger; (branch also carries the primer-cycle chore)
- outcome:     MERGED ✅ — reviewer-VERIFIED, ff-merged to `master` at `461791d` + pushed (Fausto's go, 2026-06-27); branch deleted
