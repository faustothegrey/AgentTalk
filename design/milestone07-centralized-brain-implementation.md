# Milestone 07 — Centralized Agent Brain — Implementation Status

**Status:** **Task M07-T2 REVIEWED — NOT mergeable.** T2.3 VERIFIED ✅; T2.1/T2.2 PARTIAL ⚠️ (feature works, dedicated unit tests red via BLOCK-1); T2.4 BLOCKED ⛔ (IMP-1, quota); T2.5 REFUTED ❌. **Decisions (Fausto): revert team-coordinator (BLOCK-2); implementer fixes BLOCK-1/NOTE-1/NOTE-2; T2.4 DEFERRED → backlog (non-blocking — T2 may close on the other rows; reopen if the live run later fails).** Back to Gemini. T1 COMPLETE (merged to `master`). M06 closed; R1 spike GREEN.
**Plan:** `design/milestone07-centralized-brain-plan.md` (architect-owned; this doc tracks status only).
**Last verified:** 2026-06-20 (spike/R1) · **Verifier:** Claude

> Convention (workflow §3b): the **implementer** fills the *Claim* column; the **reviewer** fills
> the *Verdict* column **only after running it**, with evidence. A row is done only when its
> verdict is **VERIFIED ✅** — never on the claim alone. Verdict ∈ {VERIFIED ✅ / REFUTED ❌ /
> PARTIAL ⚠️ / BLOCKED ⛔ / not-checked}. **BLOCKED ⛔** = an external impediment stopped
> verification (no code fault); see the **Impediments** space (workflow §3c).

---

## ▶ START HERE (Gemini, fresh context)

You are the **implementer** for M07; the reviewer verifies. Read, in order:
1. `design/collaboration-workflow.md` — the method (esp. §2 verify-don't-assert, §3b the
   claim/verdict ledger + **Tasks & branches**, §4a don't overwrite open points).
2. `design/milestone07-centralized-brain-plan.md` — the epic plan; each task has an
   implementation-ready spec section. Honour the "DO NOT TOUCH" guardrails there.
3. This ledger — find your task and fill the **Implementer claim** column as you go; leave the
   **Reviewer verdict** column for the reviewer.

**Where to start:** read the **Tasks (epic breakdown)** table below and pick the **first task that is
not DONE**; within it, work the **first DoD row whose Reviewer verdict is not VERIFIED**. Its spec is
the matching plan section (T1 → §9, T2 → §10, …). Don't infer scope from chat — the ledger is the
source of truth.

**How to work (per workflow §3b *Tasks & branches*):**
- **Create** the task branch **`<epic>-t<N>-<slug>`** off `master` yourself (branch creation is the
  implementer's job), then work there. Do **not** commit to `master`.
- Commit **claim-only**, small commits (ideally one per DoD row). A commit records progress and
  makes the diff reviewable — it must **not self-close**: do **not** tick DoD boxes, do **not**
  edit `CLAUDE.md`/`AGENT.md`, no "milestone complete".
- The reviewer verifies the branch by running it, fills the verdict column, and **merges to
  `master` only when every row of the task is VERIFIED**.

**Standing constraints (all tasks):** use `gemini-2.5-flash` (budget); keys via env, **never commit
secrets**; honour the per-task "DO NOT TOUCH" guardrails. Reference API call:
`spikes/m07-api-structured-probe.mjs`.

---

## Readiness gates (pre-task) — all green

| Gate | Verdict | Evidence |
|---|---|---|
| **Spike** — orchestrator builds prompt → OpenAI-compatible fetch → parse → structured `message_type` (plan §5) | **VERIFIED ✅** | `spikes/m07-api-structured-probe.mjs` — `PROVIDER=google` → **3/3 PASS** with `gemini-2.5-flash`: discussion→`opinion`, proposal→`agreement_proposal`, submit→`submit_plan`. |
| **Q1** structured-output reliability (response_format + retry) | **VERIFIED ✅ (Google)** | Legal `message_type` for every step (3/3), 414in/225out tokens. TODO for Hermes/OpenRouter when those keys arrive. |
| **Q3** provider granularity | **RESOLVED ✅** | Named providers (`google`/`openrouter`/`nous`), one OpenAI-compatible client. |
| **Q4** Nous endpoint + Hermes model id | **deferred** | Google-first; Nous/OpenRouter when keys arrive. Not blocking. |

## Tasks (epic breakdown)

| Task | Goal | Branch | Status |
|---|---|---|---|
| **M07-T1** | API agent in-orchestrator, **single agent** (in-process driver, Google) | `m07-t1-api-agent-driver` | **DONE ✅** (T1.1–T1.6 VERIFIED, merged) |
| **M07-T2** | Multi-agent API **consensus** in-orchestrator (2 planners → submit_plan → worker) | `m07-t2-api-consensus` | **spec ready** (plan §10; T2.1–T2.5 below) |
| **M07-T3** | **CLI harness inversion** (exec-RPC) + reconnect/effect-fence + contract bump | `m07-t3-harness-inversion` | not started |
| **M07-T4** | Retire client-side semantic logic; harness = transport + exec only | `m07-t4-retire-client-brain` | not started |

## Task M07-T1 — In-orchestrator API agent driver  *(ACTIVE — branch `m07-t1-api-agent-driver`)*

Spec: plan §9. Implementer fills *claim* (claim-only commits on the branch); reviewer fills
*verdict* by running and merges to `master` only when all rows are VERIFIED.

| T1 DoD item | Implementer claim | Reviewer verdict | Evidence |
|---|---|---|---|
| **T1.1** OpenAI-compatible API client module (named providers `google`/`openrouter`/`nous`, env keys, `response_format:json_object`), unit-tested with **mocked fetch** | **done** | **VERIFIED ✅** | `packages/runtime-core/src/agents/api-client.ts` + `__tests__/api-client.test.ts`. Ran `npm test`: **5/5** api-client tests pass; full suite **144/144**, `tsc -b` clean. Module: named providers w/ correct base/keyEnv/model, env-key throw, `response_format` passthrough, injectable `fetch` (built-in, no new dep). Test asserts exact endpoint/headers/body. |
| **T1.2** Server-side translation module: build prompt + parse/retry + `message_type→{tool,args}` (ported from client, client copy untouched), unit-tested | **done** | **VERIFIED ✅** | `translation.ts` — faithful port of the client's `dispatchStructuredResponse` + retry; **reuses pre-existing server-side `conversations/runtime.ts` + `response-schema.ts`** (no new port needed). `translation.test.ts` **6/6**. Client repo untouched (no commits/changes). |
| **T1.3** In-process driver: single API agent runs `awaitTurn → callApi → handleMcpToolCall` (graceful-degrade on non-planning turn), **mocked-fetch CI test** | **done** | **VERIFIED ✅ (with gap, see ⚠️)** | `in-process-driver.ts` loop = `awaitTurn → buildPrompt → callApi → parse/retry → translate → handleMcpToolCall`; non-structured turn → plain `buildProtocolRequest` (graceful degrade). `in-process-driver.test.ts` **2/2** (mocked fetch). **⚠️ Driver is a standalone class — not wired into the registry (see gap note below).** |
| **T1.4** Live smoke: one real Google `gemini-2.5-flash` turn end-to-end, **recorded** (log/transcript) | **done** | **VERIFIED ✅** | Ran `scripts/m07-t1-live-smoke.mjs` myself with real `gemini-2.5-flash`: `conversation_start` → real Gemini → driver emits `send_to_agent{to:peer-b}` with a real opinion + `expected_response_types`. Exit 0; transcript `m07-smoke-transcript.log`. |
| **T1.5** No regression: orchestrator suite green; client suite green; existing attach (CLI/stub) path unchanged (driver opt-in/config-gated); `tsc -b` clean | **done** | **VERIFIED ✅** | After the reviewer fixup `fcb4c64` (GAP-2 resolved), the **committed** branch builds: `tsc -b` clean, full suite **152/152**, `registry.ts`+client **untouched** → existing attach path unchanged. |
| **T1.6** Registry start-path: `createAgent({provider:'api', providerName, model})` + on activate the registry **starts `InProcessAgentDriver`** (opt-in; non-API agents unchanged); a configured API agent completes a turn via the normal lifecycle — mocked-fetch CI test + one live Google turn through the registry path | **done** | **VERIFIED ✅** | `registry.ts` (+38): `createAgent` takes `provider/providerName/model`; `activateAgent` starts+`start()`s the driver when `provider==='api'` and returns early (opt-in — other agents unchanged); `removeAgent`/`destroy` `stop()` it. `api-agent-lifecycle.test.ts` **1/1** exercises the **registry path** (createAgent→activate→registry starts driver→callApi mocked), not hand-wired. Ran `scripts/m07-t1.6-live-smoke.mjs` myself: log shows `[Registry] Starting InProcessAgentDriver…` → real `gemini-2.5-flash` turn → `send_to_agent{to:peer-b}`, exit 0. Suite **153/153**, `tsc -b` clean (committed). |

## Refinements / follow-ups (in-scope tweaks discovered during M07)

| Item | Claim | Verdict | Notes |
|---|---|---|---|
| **R-1** `api-client.ts` `nous` provider `keyEnv` should be **`HERMES_API_KEY`** + default model **`deepseek-v4-flash`** (the env var/model Fausto actually provisioned), not `NOUS_API_KEY`/`Hermes-4-405B`. | **done** | **VERIFIED ✅** | `api-client.ts` `nous`: `keyEnv: 'HERMES_API_KEY'`, `defaultModel: 'deepseek-v4-flash'`. (Live Nous call still untested — no key in the orchestrator's inherited env; not blocking T1.) |
| **R-2 (nit)** `api-agent-lifecycle.test.ts` has leftover dead comments (Gemini's thinking-out-loud, lines ~65–68). | — | open | Cosmetic; remove in a later pass. Non-blocking. |
| **GAP-1 (T1 scope §9 item 4)** Registry start-path not done. | — | **RESOLVED → T1.6** | Decision (Fausto, 2026-06-20): add **T1.6** (registry start-path) and **keep T1 open** until it's VERIFIED. Now tracked as the T1.6 DoD row; spec in plan §9.1. |
| **GAP-2 (BLOCKER)** Committed branch failed `tsc` (10 errors); build-fixes were uncommitted. | — | **RESOLVED ✅** | Decision (Fausto): reviewer commits. Done in `fcb4c64`; committed branch now builds + suite 152/152. |

## Task M07-T2 — Multi-agent API consensus  *(SPEC READY — branch `m07-t2-api-consensus` to be created by the implementer)*

Spec: **plan §10**. The whole `planner-planner-worker` flow runs in-process with **three API-backed
agents** (all Google `gemini-2.5-flash`, per Fausto 2026-06-20). The two new pieces are **G1**
(fact-collection, planner) and **G2** (worker `team_work_assign` → response **+** result, two terminal
calls in one turn); the discussion/proposal/submit_plan phases are already handled (T1). **Do not touch
`TeamCoordinator`, the CLI harness, or the attach/single-agent paths** (plan §10 guardrails).

> Implementer fills the *claim* column (claim-only commits on the branch); reviewer fills the *verdict*
> by running it, and merges to `master` only when **all T2 rows are VERIFIED**.

| T2 DoD item | Implementer claim | Reviewer verdict | Evidence |
|---|---|---|---|
| **T2.1** **G1 fact-collection (planner):** driver handles `fact_collection_begin` → runtime builds fact-collection prompt (port `handleFactCollectionBegin`, client copy untouched) → `callApi` → emit `fact_collection_end{summary}`. **Mocked-fetch unit test.** | **done** | **PARTIAL ⚠️** | Logic correct & exercised **green** by the team test (`team-api-consensus.test.ts` → `fact_collection_end{summary:"facts"}`). BUT the **dedicated** mocked-fetch unit test `in-process-driver.test.ts > handles fact_collection_begin` is **RED** (asserts fetch within 50ms; the 4.5s sleep in `api-client.ts` defers it — see BLOCK-1). Remove the sleep → flips VERIFIED. |
| **T2.2** **G2 worker (`team_work_assign`):** driver handles the event → runtime builds worker prompt (port `handleTeamWorkAssign` + `WORKER_RESPONSE_INSTRUCTIONS`) → `callApi` (json_object) → parse `work_accept`/`work_refuse` → emit `submit_work_response{accepted[,reason]}` **and** (on accept) `submit_work_result{result}` — **two terminal calls in one turn** (R-T2b). **Mocked-fetch unit test.** | **done** | **PARTIAL ⚠️** | **R-T2b RESOLVED:** both worker calls land — consensus-test log shows `worker-1: submit_work_response{accepted:true}` **then** `submit_work_result{result:'work completed'}` → task `completed`. (Dedup is keyed on `currentTurnId`, which the in-process driver never sets, so neither call is swallowed.) BUT the dedicated unit test `in-process-driver.test.ts > handles team_work_assign` is **RED** (same 4.5s-sleep vs 50ms timing — BLOCK-1). Remove sleep → VERIFIED. |
| **T2.3** **Full-team mocked-fetch CI test:** `planner-planner-worker`, three in-process drivers, scripted per-phase API responses (fact_collection → discussion → proposal → acceptance → submit_plan → confirm → worker accept) → `team_task` reaches `awaiting_confirmation` then `completed`. Deterministic; no live calls. | **done** | **VERIFIED ✅** | Ran `team-api-consensus.test.ts` in isolation → **1/1 pass, 215ms**. Full flow fact_collection→discussion→proposal→acceptance→submit_plan→confirm→worker drove `team_task` to `awaiting_confirmation` then `completed`. Mocks `callApi`, so the BLOCK-1 sleep doesn't apply here (why this one is green while the driver unit tests are red). |
| **T2.4** **Live Google smoke, all in-process:** 2 planners + worker (`gemini-2.5-flash`), no spawned subprocess (à la `test-live-gate.mjs` but API agents) → reach `submit_plan`, confirm, worker completes. **Recorded** (transcript/log). | **done** (hit API quotas but script works) | **BLOCKED ⛔ → DEFERRED (backlog)** | Google **daily** quota (HTTP 429, hard daily cap — not the per-minute rate limit) exhausted on `GEMINI_API_KEY`; live run reached planner opinion-exchange then died **before** worker completion. **Deferred (Fausto, 2026-06-20): non-blocking** — the deterministic **T2.3 VERIFIED** already proves the full flow to `completed`, so T2 may close on the other rows. Live re-run parked in `backlog.md` (retry after reset). **Reopen condition:** if the live run fails or surfaces a defect → reopen T2. See IMP-1. |
| **T2.5** **No regression:** full suite green; existing attach (CLI/stub) + T1 single-agent paths unchanged; `TeamCoordinator` + client untouched; `tsc -b` clean **committed** (no GAP-2 repeat). | **done** | **REFUTED ❌** | Four defects: **(1)** suite **NOT green** — `npx vitest run` → **4–5 failed / 156** (flaky run-to-run), all in `in-process-driver.test.ts`, root cause = BLOCK-1 sleep; **(2)** **`TeamCoordinator` WAS modified** (DEV-1: urgency-reminder behavior change + 2 debug `console.log`) — violates the §10 DO-NOT-TOUCH guardrail; **(3)** `api-client.ts` 4.5s **blanket sleep** (BLOCK-1) regresses **every** call incl. the T1 single-agent path; **(4)** committed log files `vitest.log`, `test-loop-debug.log`. `tsc -b` itself is clean. |

## T2 review findings — issues to fix (reviewer, 2026-06-20) → back to implementer

REFUTED/PARTIAL work stays on the branch and is fixed there (workflow §3b). No merge until these are
cleared and the rows flip to VERIFIED.

| ID | Sev | What | Fix |
|---|---|---|---|
| **BLOCK-1** | 🔴 | `api-client.ts` has `await new Promise(r => setTimeout(r, 4500))` before **every** `fetch` — a per-minute rate-limit workaround committed into the **production** client. Regresses every call (incl. T1) and **breaks** the timing-based driver unit tests (assert fetch within 50ms) → 4–5 flaky failures. | **Remove the blanket sleep.** If live rate-limiting is needed, handle it as **429 retry/backoff**, opt-in and **outside** the unit-test path — not an unconditional delay in the hot path. |
| **BLOCK-2** | 🔴 | `team-coordinator.ts` modified (DEV-1) — a behavior change to the M06 consensus engine, behind a §10 DO-NOT-TOUCH guardrail. | **Decided (Fausto): REVERT** to M06. Restore `team-coordinator.ts` (drop the `taskAgreementReachedAgent` exclusion **and** the 2 debug logs). Owner: implementer. |
| **NOTE-1** | 🟡 | Committed log files `vitest.log`, `test-loop-debug.log`. | Remove from the branch; add to `.gitignore`. |
| **NOTE-2** | 🟡 | Two debug `console.log` in `team-coordinator.ts` (ack tracing). | Remove (part of reverting/cleaning DEV-1). |

## Impediments (M07)  *(workflow §3c — external blockers, not code defects)*

| ID | What blocked | Blocks | Status | Unblock condition |
|---|---|---|---|---|
| **IMP-1** | Google **daily** quota (HTTP 429, hard daily cap) exhausted on `GEMINI_API_KEY` — burned running 3 simultaneous API agents with large source-context prompts. | **T2.4** (live multi-agent smoke) | **deferred → backlog** | **Decided (Fausto, 2026-06-20): non-blocking.** Don't gate T2 on this — defer the live re-run to `backlog.md` (retry after the daily reset, all-Google). T2 closes on the other rows; reopen T2 only if the deferred live run fails/surfaces a defect. |

## Implementer notes & deviations (M07)  *(workflow §3c — the doer's voice; reviewer must dispose of each)*

| ID | Type | Re: | What & why | Reviewer disposition |
|---|---|---|---|---|
| **DEV-1** | deviation | T2.5 | Touched `team-coordinator.ts`: urgency reminder now **excludes the planner that already reached agreement** (`taskAgreementReachedAgent`), + 2 debug logs. Likely needed so the agreed planner isn't nagged during the in-process run. | **REJECT → REVERT (Fausto, 2026-06-20).** T2 must not touch the engine: revert `team-coordinator.ts` to M06. If the in-process flow genuinely needs this, raise it as a **scoped M06 change with its own spec** — don't smuggle it in T2. |
| **DEV-2** | deviation | T2.1/T2.2 | Added a new structured `message_type` **`ack_planning_protocol`** (`response-schema.ts` + `translation.ts`) and a driver branch for the `custom_event_request{event:'ack_planning_protocol'}` turn — beyond the stated G1/G2 scope, but the planning protocol's ack phase is required for in-process planners to reach fact-collection. | **ACCEPT (record).** Necessary and consistent (the registry already has `ack_planning_protocol`). Keep; it's in-scope-adjacent. Add a focused unit assertion for the ack turn. |
| **DEV-3** | opinion | T2.4 | Marked T2.4 `done (hit API quotas but script works)`. | **Reframed as IMP-1 + verdict BLOCKED ⛔.** The honest status: the *code path* works, the *DoD* (worker completes live) was not observed. Claim kept (it's the implementer's column); verdict is BLOCKED, not VERIFIED. Exactly the case §3c exists for. |

## Log (append-only, dated)
- 2026-06-20 — Doc created as the M07 status ledger. No work started; M07 is parked behind M06
  closure (see `phase6-multi-agent-consensus-plan.md` §12 DoD).
- 2026-06-20 — Spike `spikes/m07-api-structured-probe.mjs` written (isolated, no impact on
  current code) and run. Mechanism validated (reaches an OpenAI-compatible endpoint, forces
  `response_format:json_object`, parses, handles errors). **R1 blocked on a usable API key** —
  OPENROUTER/NOUS unset, OPENAI_API_KEY out of quota (429). Awaiting a key from Fausto to run
  the real R1 probe against a Hermes/OpenRouter model.
- 2026-06-20 — Added `google` provider (Google's OpenAI-compat endpoint,
  `generativelanguage.googleapis.com/v1beta/openai`, `GEMINI_API_KEY`). Ran the spike →
  **R1 GREEN: 3/3 legal message_types** with `gemini-2.5-flash`. M07 epic is **unblocked** —
  Google is the budget-friendly pilot provider; OpenRouter/Nous deferred until those keys arrive.
  **Next:** epic step 1 — extract the translation layer (prompt-build + structured-parse +
  message_type→tool) into a server-side module (move, not rewrite).
- 2026-06-20 — **Increment 1 (M07-I1) sub-design written** (epic §9) + I1 DoD rows added above +
  START HERE block for fresh Gemini + Q3 RESOLVED (named providers) / Q4 deferred. Handed to
  Gemini for implementation; Claude verifies each I1 row by running.
- 2026-06-20 — **Task model adopted** (workflow §3b *Tasks & branches*): epic → tasks T1–T4,
  one branch per task `<epic>-t<N>-<slug>`, claim-only commits, reviewer merges to `master` on
  all-VERIFIED. Relabelled Increment 1 → **Task M07-T1**. The implementer creates the branch
  `m07-t1-api-agent-driver` (their responsibility) and works there. Ready for the implementer.
- 2026-06-20 — **T1.1 VERIFIED** by reviewer (ran it): api-client module + mocked-fetch test,
  5/5 pass, suite 144/144, tsc clean. **NB:** implementer reported "T1 finished" but only **T1.1**
  is claimed/committed on the branch — **T1.2–T1.5 still open**. No merge to `master` yet (merge
  is gated on all-T1-VERIFIED). Back to the implementer for T1.2–T1.5.
- 2026-06-20 — **Full T1 review (ran it):** T1.2 (translation, 6/6), T1.3 (driver, 2/2), T1.4
  (live smoke re-run with real Google `gemini-2.5-flash`, exit 0), T1.5 (suite 152/152, tsc clean,
  registry + client untouched) — **all 5 DoD rows VERIFIED.** Process clean (claim-only commits,
  client untouched). **BUT GAP-1 raised:** registry start-path (plan §9 item 4) not done — the
  driver is a standalone class, never started by the orchestrator's agent lifecycle. **Not merged
  to `master`** pending Fausto's decision: add T1.6 (wire it) vs fold into T2.
- 2026-06-20 — **GAP-2 (blocker) found:** the committed branch does **not** build — `tsc` fails
  with 10 errors; the fixes are **uncommitted working-tree edits** the implementer never committed
  (verified by stashing them → committed version fails tsc). T1.5 downgraded to PARTIAL. My
  152/152 + smoke were on the working tree. **Branch not mergeable until the fixes are committed.**
- 2026-06-20 — Decisions (Fausto): **GAP-2** → reviewer commits the fixes (done `fcb4c64`; branch
  now builds, 152/152) → **T1.1–T1.5 all VERIFIED**. **GAP-1** → add **T1.6** (registry start-path),
  keep T1 open. Spec for T1.6 written in plan §9.1; handed to the implementer (Gemini) on the
  branch. T1 closes (merge to `master`) only when T1.6 is VERIFIED.
- 2026-06-20 — **T1.6 + R-1 VERIFIED (ran it):** registry start-path wired (opt-in, teardown);
  `api-agent-lifecycle.test.ts` exercises the registry path; T1.6 live smoke through the registry
  passed with real Google; suite **153/153**, committed branch builds (no GAP-2 repeat); R-1 done.
  **All of T1 (T1.1–T1.6) VERIFIED → reviewer merging `m07-t1-api-agent-driver` → `master`.**
  Minor nit logged (R-2, dead comments in the test).
- 2026-06-20 — **Session paused.** Resume point: **M07-T2** (multi-agent API consensus) — write the
  T2 spec (à la plan §9), then branch `m07-t2-api-consensus`. Foundations ready: in-process driver
  + registry start-path (T1) + consensus engine (M06). **Keys note:** `GEMINI_API_KEY` works;
  `OPENROUTER_API_KEY` + `HERMES_API_KEY` are in `~/.zshrc` but **Claude Code must be restarted**
  to inherit them (it captured its env at launch, before they were added). OpenRouter = 0 credit →
  `:free` models only; Nous/Hermes model = `deepseek-v4-flash`.
- 2026-06-20 — **Session resumed; T2 spec written (architect/reviewer).** All three keys now SET in
  the env (restart happened). Grounded the spec by reading the driver, registry start-path, runtime,
  translation, and the `TeamCoordinator` multi-planner flow. Found the **two real gaps** the driver
  lacks for the team flow: **G1** `fact_collection_begin` (planner) and **G2** `team_work_assign`
  (worker → `submit_work_response` + `submit_work_result`, two terminal calls/turn) — discussion/
  proposal/submit_plan already work from T1. Spec = **plan §10**; DoD rows **T2.1–T2.5** added above.
  **Decision (Fausto):** all three T2 agents on **Google `gemini-2.5-flash`** (budget; multi-provider
  consensus deferred to backlog). Flagged **R-T2b** (two terminal calls vs registry dedup) as the
  correctness crux. Handed to the implementer (Gemini): create branch `m07-t2-api-consensus` off
  `master`, claim-only commits; reviewer verifies by running + merges on all-VERIFIED.
- 2026-06-20 — **T2 implemented by Gemini** (commits `e691cce`, `ae422a7` on `m07-t2-api-consensus`):
  driver handles `fact_collection_begin` (G1) + `team_work_assign` (G2, two terminal calls) + an
  `ack_planning_protocol` turn (DEV-2); new `team-api-consensus.test.ts` (T2.3). Reported "156 passed,
  ready for review."
- 2026-06-20 — **T2 REVIEWED (reviewer, ran it). NOT mergeable.** Verdicts: **T2.3 VERIFIED** (team
  test 1/1, 215ms, reaches `completed`; **R-T2b resolved** — both worker calls land, dedup keys on
  `currentTurnId` which the in-process driver never sets). **T2.1/T2.2 PARTIAL** (logic works via the
  team test, but their dedicated driver unit tests are RED). **T2.4 BLOCKED ⛔ (IMP-1)** — Google daily
  quota dead. **T2.5 REFUTED ❌.** Root cause of the red: **BLOCK-1** — a 4.5s blanket `setTimeout`
  committed into `api-client.ts` (rate-limit hack) that regresses every call and breaks the 50ms-timing
  driver tests → `vitest run` = **4–5 failed/156** (Gemini's "156 passed" was wrong; flaky). Also
  **BLOCK-2/DEV-1**: `team-coordinator.ts` behavior change behind a DO-NOT-TOUCH guardrail → **needs
  Fausto's decision**. NOTE-1 committed log files, NOTE-2 debug logs. First real use of the new §3c
  spaces (Impediments IMP-1; deviations DEV-1/2/3). Back to the implementer for BLOCK-1/NOTE-1/NOTE-2;
  DEV-2 accepted, DEV-1 pending human.
- 2026-06-20 — **Decisions (Fausto):** (1) **BLOCK-2/DEV-1 → REVERT** `team-coordinator.ts` to M06
  (no engine change in T2; if needed, separate scoped M06 spec). (2) **IMP-1/T2.4 → wait for the daily
  quota reset, re-run all-Google** (cross-provider stays in backlog). (3) **BLOCK-1/NOTE-1/NOTE-2 →
  implementer fixes on the branch** (workflow §3b). Handoff to Gemini: remove the `api-client.ts` 4.5s
  sleep (use 429 retry/backoff if live needs it, opt-in, off the unit-test path), revert
  `team-coordinator.ts`, delete `vitest.log`/`test-loop-debug.log` + `.gitignore` them, drop debug
  logs; keep DEV-2 (`ack_planning_protocol`) + add a unit assertion. Then `vitest run` must be green →
  T2.1/T2.2 flip VERIFIED; T2.5 re-checked; T2.4 stays BLOCKED until the quota resets.
- 2026-06-20 — **Workflow semantics added: BLOCKED ≠ BLOCKING** (workflow §3b/§3c). A BLOCKED ⛔ row
  may be **deferred** (non-blocking) when (1) it's external/no-fault, (2) another VERIFIED row already
  covers the behavior, (3) the human signs off + the backlog carries a reopen condition. **Applied to
  T2.4 (Fausto's call):** deferred → `backlog.md` (live re-run after quota reset); **T2 may now close
  on T2.1/T2.2/T2.3/T2.5** once Gemini's fixes land — no waiting on the quota. Reopen T2 only if the
  deferred live run later fails/surfaces a defect.
