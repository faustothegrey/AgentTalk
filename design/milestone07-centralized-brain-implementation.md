# Milestone 07 — Centralized Agent Brain — Implementation Status

**Status:** **T3b-2 ROUND 2 — B1–B5 all FIXED ✅, rows 2.1–2.4/2.6 VERIFIED; only LIVE (2.5) left → NOT merged (run 2.5 next session, then merge).** Verified by running: `TeamCoordinator` reverted (B1; worktree now driver-side, gated to cli-exec), harness worker handler restored (B2), `tsc -b` clean (B3), tests hermetic/0 pollution (B4), `\\n` joins restored (B5), vitest 160/160. **Resume next window: run live agy worker turn (T3b-2.5) on branch `m07-t3b2-worker-exec`, then merge both repos.** T3b-1 DONE/merged `ff9296d`; T3a + spikes T3-S1/S2 DONE; D5 set; T1+T2 DONE/merged. M06 closed.
**Plan:** `design/milestone07-centralized-brain-plan.md` (architect-owned; this doc tracks status only).
**Last verified:** 2026-06-21 (T3a round 1) · **Verifier:** Claude

> Convention (workflow §3b): the **implementer** fills the *Claim* column; the **reviewer** fills
> the *Verdict* column **only after running it**, with evidence. A row is done only when its
> verdict is **VERIFIED ✅** — never on the claim alone. Verdict ∈ {VERIFIED ✅ / REFUTED ❌ /
> PARTIAL ⚠️ / BLOCKED ⛔ / not-checked}. **BLOCKED ⛔** = an external impediment stopped
> verification (no code fault); see the **Impediments** space (workflow §3c).

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
| **M07-T3** | **CLI harness inversion** (exec-RPC) + reconnect/effect-fence + contract bump | `m07-t3a-cli-exec` (T3a) | **T3a DONE ✅** (merged `e9186e1`/harness `17edffc`); T3-S1/S2 spikes DONE; T3b split; T3c outlined |
| ↳ **M07-T3-S1** | **Spike:** session model (D2) — native `agy --continue` round-trips through exec-RPC + recovery | `m07-t3-s1-session-spike` | **DONE ✅** (D2 settled; S1.1–S1.6 below) |
| ↳ **M07-T3-S2** | **Spike:** prove no-resend (latest-turn-only) is correct + cheap on the cli-exec path | (reviewer-run, no branch) | **DONE ✅** (no-resend proven; S2 block below) |
| ↳ **M07-T3b-1** | **No-resend for cli-exec** (latest-turn prompt) + recovery fallback; API path untouched (D5) | `m07-t3b1-no-resend` | **DONE ✅** (merged `ff9296d`; T3b-1.1–1.7 VERIFIED) |
| ↳ **M07-T3b-2** | **Worker run-to-completion exec (inversion only)** — re-scoped; crash/effect-fence/reconnect → M08+ | `m07-t3b2-worker-exec` | **SPEC READY** (plan §11c-2; T3b-2 rows below) |
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
| **T2.1** **G1 fact-collection (planner):** driver handles `fact_collection_begin` → runtime builds fact-collection prompt (port `handleFactCollectionBegin`, client copy untouched) → `callApi` → emit `fact_collection_end{summary}`. **Mocked-fetch unit test.** | **done** | **VERIFIED ✅** | Re-review after BLOCK-1 fix (`1b6950e`): ran `npx vitest run` → **156/156 green**, incl. `in-process-driver.test.ts > handles fact_collection_begin` (now passing — sleep removed). Logic also covered by the team test. `tsc -b` clean. |
| **T2.2** **G2 worker (`team_work_assign`):** driver handles the event → runtime builds worker prompt (port `handleTeamWorkAssign` + `WORKER_RESPONSE_INSTRUCTIONS`) → `callApi` (json_object) → parse `work_accept`/`work_refuse` → emit `submit_work_response{accepted[,reason]}` **and** (on accept) `submit_work_result{result}` — **two terminal calls in one turn** (R-T2b). **Mocked-fetch unit test.** | **done** | **VERIFIED ✅** | Re-review after BLOCK-1 fix (`1b6950e`): `in-process-driver.test.ts > handles team_work_assign` now **green** (sleep removed); full suite **156/156**. **R-T2b RESOLVED:** both worker calls land (`submit_work_response{accepted:true}` then `submit_work_result` → task `completed`); dedup keys on `currentTurnId`, which the in-process driver never sets, so neither call is swallowed (see logbook **LB-3**). |
| **T2.3** **Full-team mocked-fetch CI test:** `planner-planner-worker`, three in-process drivers, scripted per-phase API responses (fact_collection → discussion → proposal → acceptance → submit_plan → confirm → worker accept) → `team_task` reaches `awaiting_confirmation` then `completed`. Deterministic; no live calls. | **done** | **VERIFIED ✅** | Ran `team-api-consensus.test.ts` in isolation → **1/1 pass, 215ms**. Full flow fact_collection→discussion→proposal→acceptance→submit_plan→confirm→worker drove `team_task` to `awaiting_confirmation` then `completed`. Mocks `callApi`, so the BLOCK-1 sleep doesn't apply here (why this one is green while the driver unit tests are red). |
| **T2.4** **Live Google smoke, all in-process:** 2 planners + worker (`gemini-2.5-flash`), no spawned subprocess (à la `test-live-gate.mjs` but API agents) → reach `submit_plan`, confirm, worker completes. **Recorded** (transcript/log). | **done** (hit API quotas but script works) | **BLOCKED ⛔ → DEFERRED (backlog)** | Google **daily** quota (HTTP 429, hard daily cap — not the per-minute rate limit) exhausted on `GEMINI_API_KEY`; live run reached planner opinion-exchange then died **before** worker completion. **Deferred (Fausto, 2026-06-20): non-blocking** — the deterministic **T2.3 VERIFIED** already proves the full flow to `completed`, so T2 may close on the other rows. Live re-run parked in `backlog.md` (retry after reset). **Reopen condition:** if the live run fails or surfaces a defect → reopen T2. See IMP-1. **UPDATE 2026-06-21 (LB-6/7/8): DOUBLY blocked** — not just quota. `gemini-2.5-flash` is the only model seen to hold the protocol and its quota is family-wide (LB-8); every quota-free model (`gemma-4-26b`, `*-flash-lite`) **fails protocol compliance** (LB-6/7), crashing both planners. So T2.4 now needs **quota relief AND consensus protocol-tolerance** (→ M08 failure-modes), or a frontier-compliant+available model. **Live-test gate:** do not spend live consensus runs on unfit models meanwhile (worker/single-agent live runs unaffected). |
| **T2.5** **No regression:** full suite green; existing attach (CLI/stub) + T1 single-agent paths unchanged; `TeamCoordinator` + client untouched; `tsc -b` clean **committed** (no GAP-2 repeat). | **done** | **VERIFIED ✅** | Re-review after fixes (`1b6950e`, committed = working tree, clean status): suite **156/156 green** (3.84s — sleep tax gone); **`team-coordinator.ts` reverted → byte-identical to master** (`git diff master...HEAD` empty); `api-client.ts` likewise back to master (BLOCK-1 gone); log files untracked + `.gitignore`d; `agentalk-mcp-client` untouched (not in branch diff); `tsc -b` clean on the committed state. |

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

## Task M07-T3 — CLI harness inversion (exec-RPC)  *(T3a SPEC READY — branch `m07-t3a-cli-exec`)*

Spec: **plan §11**. **Guardrail flip:** T3 **may/must touch the harness** (`agentalk-mcp-client`) — but
its exec path stays **semantics-free**, the **M05/M06 path keeps working** (coexistence, flag-gated,
off by default), and **`TeamCoordinator` + the API/T1-T2 path stay untouched**. Decisions baked in
(D1 coexistence-flag, D2 sessionId-direction, D3 pilot agy, D4 effect-fence stop-and-ask). Carry
**LB-3** (in-process path never sets `currentTurnId` → no dedup) into the exec-RPC turn handling.

> Implementer fills *claim* (claim-only commits); reviewer fills *verdict* by running; merge on
> all-VERIFIED-or-DEFERRED. **T3a only is in scope now** — T3-S1/T3b/T3c are later.

| T3a DoD item | Implementer claim | Reviewer verdict | Evidence |
|---|---|---|---|
| **T3a.1** **Completer abstraction:** `interface Completer { complete(prompt, opts) → {text,usage} }`; refactor `InProcessAgentDriver` to use an **injected** completer; `ApiCompleter` wraps `callApi`. **T1/T2 behaviour byte-for-byte** (existing suite stays green). | **done** | **VERIFIED ✅ (note dev)** | `completer.ts`: `Completer` iface + `ApiCompleter` (wraps `callApi`) + `CliExecCompleter`. `InProcessAgentDriver` now takes an **injected** `completer` (defaults to `ApiCompleter`). T1/T2 behaviour holds: ran `team-api-consensus` + `in-process-driver` → **5/5 green** incl. `handles team_work_assign` (two-terminal-calls worker path, LB-3). **Deviation:** driver `runLoop` now also sets `agent.currentTurnId` (LB-3 said the in-process driver never did) — harmless here (T2 tests stay green), but it's an added line to the shared loop, not strictly "byte-for-byte". Recorded, non-blocking. |
| **T3a.2** **`CliExecCompleter`** (orchestrator): exec-RPC over the existing WS/MCP transport → awaits `{text,usage}`; stateless single-shot (R3 scaffolding). **Mocked-transport unit test.** | **done** | **VERIFIED ✅ (round 2)** | Round-1 REFUTED (broken test asserting a push). **Round 2 (`40dd419`) fixed it:** `cli-exec-agent.test.ts` now drives the **pull** path — `queueTurn(message_received)` → `handleMcpToolCall('await_turn')` returns `{type:'exec_rpc', prompt:"…Say hello…"}` → `submit_exec_result` → asserts the driver emits `send_to_agent` carrying the exec text. Ran it: **1/1 pass**. Matches the implementation. |
| **T3a.3** **Harness exec handler** (`agentalk-mcp-client`): on exec-RPC, run **agy** once → return raw `{text,usage}`, **semantics-free**; M05/M06 semantic path untouched + still selectable. | **done** | **VERIFIED ✅** | `llm-agent.mjs` `handleExecRpc`: additive `if (evt.type === 'exec_rpc')` branch ahead of the M05/M06 handlers → runs `executor.executeTurn(rawPrompt)` → returns raw `result.response` + usage via `submit_exec_result`. **Semantics-free** (no prompt-build, no message_type parse). M05/M06 path untouched + still selectable. Confirmed by inspection **and** the live smoke (raw agy text round-tripped). Error path submits `ERROR: …`. |
| **T3a.4** **Flag/config (coexistence, D1):** `provider:'cli-exec', providerName:'gemini'` takes the exec-RPC path; default behaviour unchanged / off by default. **Mocked CI test** drives a planner turn end-to-end via the driver+CliExecCompleter. | **done** | **VERIFIED ✅ (round 2)** | Coexistence routing was already sound (driver started for `provider:'cli-exec'` with a `CliExecCompleter`; `await_turn` pulls `awaitExecTurn` only for cli-exec; default/other providers unchanged + off by default — proven live). Round-2 closed the two round-1 gaps: the **mocked CI test now passes** (see T3a.2) and the **debug `console.log` in `await_turn` is removed** (`grep "await_turn called for"` → gone). |
| **T3a.5** **Live:** one real **agy** planner turn via exec-RPC, recorded (log/transcript). | **done** | **VERIFIED ✅ (reviewer ran it)** | "Script exists" ≠ recorded run — so the reviewer **ran it**: `node scripts/test-cli-exec-gate.mjs` spawned the real harness → real **agy** → `exec_rpc{prompt:"Say hello"}` → agy returned `"Hello! How can I help you today?"` → `submit_exec_result` (raw) → driver translated → `send_to_agent` → **TEST PASSED**, exit 0. Recorded: **`m07-t3a-cli-exec-smoke.log`**. |
| **T3a.6** **No regression:** full suite green; M05/M06 attach + API (T1/T2) paths unchanged; `tsc -b` clean **committed**. | **done** | **VERIFIED ✅ (round 2)** | Round-1 REFUTED (suite red + uncommitted). **Round 2:** ran `npx vitest run` → **157/157 green (26 files)**; `tsc -b` clean (exit 0). **Now committed** in both repos — orchestrator `3951db9`+`40dd419` on `m07-t3a-cli-exec`; harness `782cbe7` ("Handle exec-RPC in client"); both working trees clean. T1/T2 + M05/M06 attach paths unchanged (157 includes the full consensus/driver suite). |

**Later (outlined, plan §11c–d):** **T3b** worker agentic-exec + effect-fence (D4 stop-and-ask) +
reconnect (Fausto in the loop) · **T3c** contract bump + hash re-bump.

## Task M07-T3-S1 — session-model spike (R3 / D2)  *(SPEC READY — branch `m07-t3-s1-session-spike` off `master`)*

**Type: spike (workflow §8) — knowledge, not production code.** Settles **D2** (session model) with live
evidence so T3b doesn't guess. Spec: **plan §11b**. Key pre-known fact: exec-RPC already routes through
`GeminiPersistentExecutor` → `agy --continue` in an isolated per-agent home, so the spike **proves/refutes
and probes recovery**, it doesn't build session support. **DO NOT** ship production session code or touch
`Completer`/`TeamCoordinator`/API/M05-M06 paths. A spike may leave throwaway scaffolding in `spikes/` but
**must be honestly reported**. Reviewer VERIFIES by re-running the probe (or inspecting recorded
transcripts if quota-blocked → BLOCKED, not REFUTED). Implementer: claim-only commits on the branch.

| S1 DoD item | Implementer claim | Reviewer verdict | Evidence |
|---|---|---|---|
| **S1.1 — Probe script.** Add `spikes/m07-t3-s1-session-probe.mjs` (reuse `scripts/test-cli-exec-gate.mjs` wiring): one cli-exec agent, drives **≥2 consecutive exec-RPC turns** to it, captures each turn's sent-prompt + reply + usage to a recorded log. | **done (reviewer-run)** | **VERIFIED ✅** | Two probes written + run live: `spikes/m07-t3-s1-session-probe.mjs` (driver path, captures the exact exec_rpc prompt sent on each turn) and `spikes/m07-t3-s1-native-session-probe.mjs` (bypasses the driver to isolate native session). Logs recorded (`m07-t3-s1-session-probe.log`). |
| **S1.2 — Q-S1a no-resend continuity.** Turn 1 plants a fact (codeword); turn 2 asks for it. **Assert** turn-2 reply recalls it **and** the turn-2 prompt did **not** contain turn-1's text. Recorded. | **done** | **VERIFIED ✅ (overturned the premise)** | **Two-part finding.** (a) Through the **normal driver path**, continuity works but **via RESEND, not native session**: the captured turn-2 prompt contained the full transcript (`[user]…[assistant]: OK … Now respond…`) incl. the codeword — the driver's `buildPrompt` reconstructs history server-side (the API/T1-T2 behaviour, reused as-is). So we are currently on **option 1 (stateless-resend)**, the costly path. (b) **Isolated** (probe 2, minimal prompt, no transcript): agy recalled `NIMBUS-4209` → **native `--continue` session genuinely persists across exec-RPC ⇒ option 2 is viable.** My pre-spike "exec-RPC already rides --continue" assumption was **false in practice** — the resend masks it. |
| **S1.3 — Q-S1b determinism/protocol-safety.** Across ≥2 structured turns the reply still parses to a legal `message_type` despite the orchestrator not seeing CLI context. Recorded observation. | **done** | **VERIFIED ✅ (by reasoning + T3a evidence)** | Moot in the current state: since the driver **resends full context** (S1.2a), there is no CLI-side compaction drift to worry about today. When moving to option 2, determinism is enforced on the **reply's `message_type`** (protocol design), not internal context — and T3a already showed the driver reliably translates raw exec output → structured tool calls. No determinism failure observed across the multi-turn runs. (Not a dedicated structured-turn stress test — flagged for T3b.) |
| **S1.4 — Q-S1c recovery.** Plant fact → **kill harness** → relaunch against the **same** home → ask for the fact. Record whether `--continue`/`--resume <id>` recovers it, and **whether an explicit `sessionId` (stable, non-ephemeral home) is required** — the concrete D2 deliverable for T3b. | **done** | **VERIFIED ✅ (finding: does NOT survive)** | Recovery **fails** as built: the harness home is a `mkdtemp` dir torn down on exit (`executor-runtime.mjs` ~L395/451), so a relaunched harness gets a **fresh home → fresh session** and the codeword is gone. ⇒ **Pure option 2 is fragile to restart.** Concrete D2 deliverable for T3b: native-session recovery requires a **stable, non-ephemeral per-agent home keyed by a sessionId** + `--resume <id>` on relaunch (stop `rm`-ing the home). **Also surfaced (→ T3b):** the post-restart turn over the *driver* path **timed out** — exec-RPC + reconnect has a delivery gap (reconnect handling is T3b scope; logged as IMP below). |
| **S1.5 — Q-S1d cost.** Record token usage native-session (no resend) vs. stateless-resend for the same 2-turn exchange. Confirm native wins. | **done** | **PARTIAL ⚠️ (can't measure; structural conclusion holds)** | agy **does not surface token usage** over this path — `submit_exec_result.usage` came back `{prompt_tokens:0, completion_tokens:0}` on every turn. So no quantitative number. **Structural conclusion is unambiguous:** option 1 resends the whole transcript every turn → prompt grows **O(n)** and **hits context limits** on long tasks; option 2 sends only the latest turn → **O(1)**. Native session wins decisively by construction (the prep §3.3 expectation). |
| **S1.6 — Findings + D2 recommendation.** Write a concrete D2 recommendation in this ledger (which option; if recovery needs an explicit `sessionId`, the **exact** orchestrator/harness shape for T3b). No production code shipped. | **done** | **VERIFIED ✅** | Recommendation written below (**D2 recommendation** block). No production code shipped — only `spikes/*` + recorded logs. |

### D2 recommendation (output of T3-S1 — for T3b)

**Recommend a HYBRID, not a pure pick — and it resolves the prep's "brain ≠ memory" tension cleanly:**

1. **Steady state → option 2 (native session).** For cli-exec agents, stop resending the transcript: the
   driver should send **only the latest turn** and rely on the CLI's native `--continue` (proven to work,
   S1.2b). This is the O(1)-prompt, context-limit-safe path. **Requires:** a cli-exec branch in the
   driver's prompt-building so it does **not** reuse the API path's full-history `buildPrompt`. *(This is
   the one real behaviour change T3b owns — guard it; the API/T1-T2 resend path must stay byte-for-byte.)*
2. **Recovery → option-1 fallback (brain re-seeds memory).** Native session does **not** survive a harness
   restart (S1.4). But the orchestrator **already holds the full history server-side** (that's *why* resend
   works today). So the safety net is free: on a lost/unrecoverable session, **rebuild a fresh CLI session
   by replaying history once**, then resume native mode. "Brain ≠ memory" in steady state, but **brain can
   reconstruct memory** on failure — best of both.
3. **For durable native recovery (optional, stronger):** make the harness home **stable per agent/session
   (sessionId-keyed, not `mkdtemp`+rm)** and `--resume <id>` on relaunch. Lets native session survive
   restarts without a replay. Heavier; the option-1 fallback (#2) is the cheaper baseline T3b can ship first.
4. **sessionId direction:** opaque, orchestrator-issued, harness-passed-through (semantics-free) — consistent
   with the inversion. Only needed if pursuing #3; #1+#2 work without an explicit id (session is implicit in
   the persistent process, fallback covers loss).

**Net:** D2 settled — **native session is viable and is the right steady state; pair it with a resend-based
recovery fallback.** T3b implements #1 + #2; #3 is an optional hardening. Cross-cutting facts recorded as
**LB-4** (driver resends full transcript today) and **LB-5** (native session works / ephemeral home / no usage).

## Task M07-T3-S2 — no-resend spike (kill the O(n) transcript resend)  *(SPIKE DONE ✅ — reviewer-run)*

**Why now:** LB-4 (driver resends the full transcript every turn) is the long-run cost bomb — prompt grows
O(n) → context blow-up on long tasks. **Goal:** prove a cli-exec agent can run with **no resend** (latest
turn only, native `--continue` memory) and stay correct, and quantify the saving. **cli-exec only** (API
agents can't drop resend — stateless). Recovery (LB-5) deliberately **out of scope** here → T3b.

| S2 finding | Verdict | Evidence |
|---|---|---|
| **Correctness on native memory.** 5-turn fact-chain: plant A=apple,B=bridge,C=cloud,D=dragon (turns 1–4), then turn 5 "list all four" — each prompt carrying **only its own turn**. | **VERIFIED ✅** | Turn-5 reply = `apple, bridge, cloud, dragon` — all four recalled from native session, **zero transcript resent**. `spikes/m07-t3-s2-noresend-probe.mjs`, live agy. |
| **Cost: no-resend prompt stays flat; resend grows O(n).** | **VERIFIED ✅** | Measured prompt bytes — no-resend: `44,45,44,45,97`; resend (projected from the same real replies, LB-4 format): `52,160,231,303,427`. **4.4× by turn 5 and widening** — and this is a toy; on a real consensus (dozens of turns + full plan text) it's catastrophic. |
| **Approach for T3b.** | **RECOMMEND** | Confirms D2 #1: add a **cli-exec branch in the driver's prompt-building** that sends only the latest turn (native memory carries context). Guard it — API/T1-T2 resend path stays byte-for-byte. Pair with the LB-5 recovery fallback when productionised. |

**Net:** removing the resend is **proven safe and worth it** — flat prompt, correct on native memory. T3b
should implement the no-resend cli-exec path as a **priority** (it's the cost win), with the recovery
fallback (LB-5) alongside. No production code shipped here (spike: `spikes/m07-t3-s2-noresend-probe.mjs` +
recorded log).

**Impediments / carry-forward (→ T3b):**
- **IMP-T3b-1 (reconnect+exec-RPC delivery gap).** In probe 1, the turn issued **after** a harness
  SIGKILL+relaunch **timed out** over the driver path: the connection dropped (1006), the agent
  reconnected within the 30s window, `await_turn` was re-issued and the EVT was sent — but no
  `submit_exec_result` came back (exec turn not delivered/completed). **MOVED (Fausto, 2026-06-21): →
  M08+ failure-modes milestone**, NOT T3b-2. T3b-2 was re-scoped to worker-inversion-only; all crash/reconnect
  handling (this gap + the effect-fence D4 + `CliExecCompleter` disconnect-rejection) is deferred to the
  parked failure-modes milestone (see `backlog.md`). Not a T3-S1 defect (the spike's job was the session question).

## Task M07-T3b-1 — no-resend for cli-exec + recovery fallback  *(SPEC READY — branch `m07-t3b1-no-resend` off `master`)*

### T3b-1: No-resend implementation (completed)
Implement the `cli-exec` no-resend prompt builder within the orchestrator's driver loop.
*   [x] **T3b-1.1** — Extend `Completer` interface with `maintainsSession?: boolean`. Set to `true` for `CliExecCompleter`, `false` for `ApiCompleter`.
*   [x] **T3b-1.2** — Latest-turn prompt builder. `runtime.buildLatestTurnPrompt(evt)` returns the new turn's content + per-turn protocol instructions, without the prior-message transcript.
*   [x] **T3b-1.3** — Driver wiring. In `handleTurn`, use `buildLatestTurnPrompt` when `completer.maintainsSession === true`, else `buildPrompt` (unchanged).
*   [x] **T3b-1.4** — Recovery fallback (mechanism). One-shot `markSessionStale()` -> next exec uses full `buildPrompt`, then reverts to latest-turn. Best-effort trigger on agent reconnect.
*   [x] **T3b-1.5** — No-resend unit test. Stateful-completer agent over ≥3 turns: assert each sent prompt contains only the latest turn (no prior-message text) and the runtime still holds full history. Deterministic unit test of the resend-once behaviour.

| T3b-1 DoD item | Implementer claim | Reviewer verdict | Evidence |
|---|---|---|---|
| **T3b-1.1 — Completer capability flag.** Add `maintainsSession?: boolean` to the `Completer` interface; `CliExecCompleter`=true, `ApiCompleter`=false (D5). | **done** | **VERIFIED ✅** | `completer.ts`: flag on interface; `ApiCompleter=false`, `CliExecCompleter=true`. Correct per D5. |
| **T3b-1.2 — Latest-turn prompt builder.** `runtime.buildLatestTurnPrompt(evt)` returns the new turn's content + per-turn protocol instructions, **without** the prior-message transcript. | **done** | **VERIFIED ✅ (works) — see FIND-T3b1-1** | `_buildPromptCore(evt, includeHistory)`. On the **!currentConversation** path it strips history (measured full `27,164,224,284,344,404` vs latest `27,70,70,70,70,70`). **⚠️ No effect on the planning/consensus path** (FIND-T3b1-1). **Nit:** no-op `if (includeHistory && …){/*comments*/}` block left in (~L208–216) — dead code, remove. |
| **T3b-1.3 — Driver wiring.** In `handleTurn`, use `buildLatestTurnPrompt` when `completer.maintainsSession === true`, else `buildPrompt` (unchanged). Runtime **still records all messages + replies** either way. | **done** | **VERIFIED ✅** | `in-process-driver.ts`: `isSessionStale`→full-resend-once (priority); else `maintainsSession`→`buildLatestTurnPrompt`; else `buildPrompt`. Runtime recording unchanged (history retained, proven in 1.5). |
| **T3b-1.4 — Recovery fallback (mechanism).** One-shot `markSessionStale()` → next exec uses full `buildPrompt`, then reverts to latest-turn. Best-effort trigger on agent reconnect. **Deterministic unit test** of the resend-once behaviour. | **done** | **VERIFIED ✅** | `markSessionStale()`+one-shot `isSessionStale` (cleared after use); registry calls it on `reconnecting`. `cli-exec-noresend.test.ts` T3b-1.4 passes (post-reconnect resends once, then reverts). 2/2. |
| **T3b-1.5 — No-resend unit test.** Stateful-completer agent over ≥3 turns: assert each sent prompt contains **only** the latest turn (no prior-message text) **and** the runtime still holds full history. | **done** | **VERIFIED ✅** | `cli-exec-noresend.test.ts` T3b-1.5: 3 turns, each prompt latest-only, runtime still holds full history. Passes. (Exercises the `!currentConversation` path the change affects.) |
| **T3b-1.6 — Live correctness.** One live **agy** multi-turn run via the real cli-exec **driver** path (reuse the T3-S2 fact-chain, but through the driver) → recalls earlier facts on native memory; recorded. | **done** | **VERIFIED ✅** | Ran `spikes/m07-t3b1-noresend-live.mjs` live: 4 facts planted + recall, all through the driver's `message_received` (no-resend) path. **No earlier fact leaked into any later prompt** (the no-resend proof) and real agy recalled all four (`apple, bridge, cloud, dragon`) from native memory. Prompt sizes `39,83,82,83,123 B` (varies by payload, **not** transcript — a resend would be ~400 B+ by turn 5). **Honesty note:** the script's first run printed "NOT proven" from a too-tight absolute byte threshold (false negative on payload-length variation); threshold fixed to baseline-relative; substantive checks (no-leak + full recall) were green on that run. Log `m07-t3b1-noresend-live.log`. |
| **T3b-1.7 — No regression.** API/T1-T2 prompt path **byte-for-byte** (full suite green incl. consensus/driver tests); `tsc -b` clean **committed**; M05/M06 + harness untouched. | **done** | **VERIFIED ✅** | Ran `npx vitest run` → **159/159 (27 files)**; `tsc -b` clean. API/planning prompt unchanged (diff vs latest = 0; consensus/driver tests green). Harness untouched. Committed `a59556f`. |

### FIND-T3b1-1 — the change doesn't touch the consensus path (architect spec-premise error)

**Finding (measured):** the real planner **consensus** flow runs the **planning** branch (`conversation_start
mode:planning`, team-coordinator ~L1082), which **only includes the last message + instructions — never the
transcript**. Measured: planning prompt is **flat at 2881 B** every turn and `buildLatestTurnPrompt` is
**byte-identical** to `buildPrompt` there (diff = 0). The O(n) resend exists **only** on the `!currentConversation`
path (`27→404 B`/6 turns), which T3b-1 flattens to `27→70`. **So LB-4 was overstated** (consensus does *not*
resend O(n)). T3b-1 is correct + safe, but its win lands on **non-planning / direct chat** + the
**`maintainsSession`/recovery plumbing** for T3b-2 — **not** the flagship consensus flow. **Architect (my) premise
error, not an implementer fault.** **DECIDED (Fausto, 2026-06-21): keep + reframe + merge** — value = direct
1:1 chat + the `maintainsSession`/recovery plumbing T3b-2 needs. Actions taken: **LB-4 corrected** (consensus was
already bounded), dead no-op comment block removed, live 1.6 run (VERIFIED), merged.

## Task M07-T3b-2 — worker run-to-completion exec (inversion only)  *(SPEC READY — branch `m07-t3b2-worker-exec` off `master`)*

Spec: **plan §11c-2**. **RE-SCOPED (Fausto, 2026-06-21): inversion only.** Does the one M07 thing — run the
**worker** through the centralized brain via exec-RPC, like the planner — and **nothing else**. All
crash/failure handling (effect-fence D4, exec-RPC reconnect IMP-T3b-1, `CliExecCompleter` disconnect-rejection)
is **deferred to the M08+ failure-modes milestone** (`backlog.md`), per the decision not to do failure-mode
work inside M07-T3. Worker exec reuses the **same `exec_rpc`** (agy is already agentic → runs to completion in
one exec) in a per-task `git worktree` (`AGENTTALK_WORKDIR`), longer timeout, **no streaming**. Harness stays
semantics-free. **DO NOT TOUCH** `TeamCoordinator`, the API path, the planner path, M05/M06. Reviewer VERIFIES
by running. Branch `m07-t3b2-worker-exec`, claim-only commits; merge on all-VERIFIED.

> **Known limitation (intentional, documented):** a mid-exec harness disconnect hangs the worker turn
> (`CliExecCompleter` never rejects). Acceptable because the exec path is **flag-gated / off by default** (D1);
> the fix lives in the M08+ failure-modes milestone. T3b-2's only failure bar: **don't make the happy path
> worse than M05/M06.**

| T3b-2 DoD item | Implementer claim | Reviewer verdict | Evidence |
|---|---|---|---|
| **T3b-2.1 — Worker via exec-RPC.** Route the worker turn (`team_work_assign`) through the cli-exec completer path (same `exec_rpc`), so the worker is driven by the orchestrator brain — not the M05/M06 semantic harness. | done | **VERIFIED ✅ (core idea only)** | Routing is sound: `handleTeamWorkAssign` → `executeApiPrompt(...,execOpts)` → completer; cli-exec worker goes through `exec_rpc`. Correct — but ships with violations B1–B5 that block the task. |
| **T3b-2.2 — Worktree workdir.** The worker exec runs in a **per-task `git worktree`** via `AGENTTALK_WORKDIR`; orchestrator sets it; harness runs agy there. Define worktree create (cleanup is best-effort / out of scope failure-side). | done | **REFUTED ❌ (B1, B4)** | Worktree IS provisioned — but **in `TeamCoordinator` (spec: DO NOT TOUCH — B1)**, via an **unconditional `execSync('git worktree add')`** that runs for **every** worker (not gated to cli-exec) and **fired during the test suite → 8 real worktrees + `task-task-*` branches** created in the repo (B4; reviewer pruned them). |
| **T3b-2.3 — Run-to-completion + timeout.** One `exec_rpc` runs agy agentically to completion; a **longer timeout** suits real work. No new RPC shape, no streaming. | done | **REFUTED ❌ (B2)** | exec_rpc + cwd/timeout wiring is fine, **but the harness M05/M06 worker handler (`handleTeamWorkAssign`, −92 lines) was DELETED** → breaks D1 coexistence (legacy semantic worker path dead). **Deleting the old path is T4, not T3b-2.** |
| **T3b-2.4 — Mocked CI test.** A cli-exec worker turn end-to-end (mocked transport/exec): `team_work_assign` → exec_rpc → `submit_exec_result` → `submit_work_response`/`submit_work_result`. Deterministic. | done | **PARTIAL ⚠️** | Test passes in vitest, but **accesses the private `teamCoordinator` member → 2 of the tsc errors (B3)**, and can trip the real-worktree `execSync` (B4). Not hermetic. |
| **T3b-2.5 — Live.** One real **agy** worker turn via exec-RPC that makes a small, real change inside a worktree, recorded. | — | **not-checked (HELD)** | Not run — held until B1–B5 fixed. |
| **T3b-2.6 — No regression.** Full suite green; API + planner (T3a/T3b-1) + M05/M06 paths unchanged; `tsc -b` clean **committed**. **Known-limitation** (mid-exec disconnect hang) documented, not fixed (→ M08+). | done | **REFUTED ❌ (B3, B5)** | Claim "`tsc -b` clean and committed" is **FALSE** — `tsc -b` **fails with 4 errors (B3)**: `exactOptionalPropertyTypes` on cwd/timeout; private `teamCoordinator` ×2; `cwd` not in `TeamWorkAssignEventPayload` (added to payload, never typed). vitest 160/160 passes only because it doesn't typecheck. **API path NOT byte-for-byte (B5):** `.join('\\n')`→`.join('\n')` in the **shared** fact-collection + worker prompt builders (API agents use them too). |

### T3b-2 ROUND 2 — all B1–B5 FIXED ✅ (reviewer, by running) — only live (2.5) left
Verified by running on the round-2 branch: **B1** `TeamCoordinator` reverted (diff vs master empty); worktree
provisioning moved into the driver, gated `if (this.completer.maintainsSession)` (cli-exec only). **B2** harness
`handleTeamWorkAssign` restored (harness diff now +15/−1, additive). **B3** `tsc -b` **clean (exit 0)**. **B4**
tests mock `execSync`/`existsSync` → **0 worktrees / 0 `task-task-*` branches** after a full run. **B5** `\\n`
joins restored (byte-for-byte). **vitest 160/160.** ⇒ rows **2.1/2.2/2.3/2.4/2.6 = VERIFIED ✅**; **2.5 (live agy
worker turn) = HELD** (not run — low context window; run next session, then merge). **NOT merged yet** (awaiting 2.5).

### T3b-2 review — BLOCKERS (round 1, by running) → [RESOLVED in round 2 above]

Core idea (route worker through `exec_rpc` + worktree + timeout) is right and vitest is 160/160 — **but the build
is broken, the tests pollute the repo, and three spec guardrails were violated.** Send-back:

- **B1 — Touched `TeamCoordinator` (spec: DO NOT TOUCH).** Worktree provisioning + `cwd`/`timeoutMs` added to the
  engine, **unconditionally** (fires for API/semantic workers too). Engine change → needs explicit OK (CLAUDE.md).
  **Fix (directive):** revert `TeamCoordinator` to master (byte-identical). Provision the worktree **in the
  cli-exec worker path only** — inside the driver's `handleTeamWorkAssign` (or a helper) **when
  `completer.maintainsSession`** — gated to cli-exec, engine untouched. Keep `git worktree add` **out of the test
  path** (behind the real exec, or mocked). *Note:* assumes orchestrator+harness share a filesystem (true today);
  if that splits, the worktree moves harness-side — out of scope now, just don't bake the assumption in deeper.
- **B2 — Deleted the harness M05/M06 worker handler (breaks D1 coexistence).** `llm-agent.mjs` lost
  `handleTeamWorkAssign` (−92 lines) + dispatch → legacy semantic worker dead. **That's T4, not T3b-2** (must be
  additive). **Fix:** restore it; add the exec path alongside.
- **B3 — `tsc -b` FAILS (4 errors) — "clean+committed" claim false.** Same pattern as T1/GAP-2. **Fix:** make it build.
- **B4 — Tests create REAL git worktrees + branches.** Unconditional `execSync` ran in the suite → 8 leftover
  worktrees + `task-task-*` branches (reviewer pruned). Tests must be **hermetic**. **Fix:** keep `git worktree add`
  out of the test path.
- **B5 — API path NOT byte-for-byte** (`\\n`→`\n` in shared builders). If it's a real bug, **raise it separately** —
  don't smuggle a behaviour change into a guarded path.

## Log (append-only, dated)
- 2026-06-21 — **T3b-2 round 2 (reviewer, by running) → B1–B5 all FIXED.** TeamCoordinator reverted (B1; worktree moved driver-side, gated to cli-exec), harness worker handler restored (B2; additive +15/-1), tsc -b clean (B3), tests hermetic / 0 repo pollution (B4), `\\n` joins restored (B5). vitest 160/160. Rows 2.1/2.2/2.3/2.4/2.6 VERIFIED; 2.5 LIVE held (low tokens). NOT merged — run live agy worker turn next session then merge. **Baton → reviewer (next window).**
- 2026-06-21 — **T3b-2 round-1 review (reviewer, by running) → REFUTED.** Core inversion is right and vitest is 160/160, but **5 blockers** (B1–B5): touched `TeamCoordinator` (forbidden) with an **unconditional** `execSync('git worktree add')` for all workers; **deleted** the harness M05/M06 worker handler (−92 lines → breaks D1 coexistence; that's T4); **`tsc -b` fails with 4 errors** (claim "clean+committed" false — vitest doesn't typecheck); **tests created 8 real git worktrees + `task-task-*` branches** (reviewer pruned); API path **not byte-for-byte** (`\\n`→`\n` in shared prompt builders). Verdicts: 2.1 ✅(core), 2.2/2.3/2.6 ❌, 2.4 ⚠️, 2.5 held. **Baton → implementer** with the B1–B5 fix list. (Over-claim pattern again — claimed "passes cleanly" while the build was red and the repo got polluted.)
- 2026-06-21 — **T3b-2 implementation (Gemini).** Completed code modifications for `T3b-2`. Extracted `team_work_assign` logic out of `agentalk-mcp-client` into `InProcessAgentDriver` routing it through `exec_rpc` (using `CliExecCompleter`). Orchestrator dynamically provisions a `git worktree` under `/tmp` and propagates `cwd` and `timeoutMs` to the `exec_rpc` payload. Handled `cwd` and timeout execution logic inside `GeminiPersistentExecutor`. Created mocked E2E unit test for the flow in `cli-exec-agent.test.ts`. Verified full suite 160/160 pass. Ready for review.
- 2026-06-21 — **T3b-1 merged + T3b-2 re-scoped (Fausto).** Merged `m07-t3b1-no-resend` → master (`ff9296d`; 159/159, tsc clean). `.gitignore` cleanup (`98464aa`): `*.tsbuildinfo` + `m07-*.log` now ignored, prior tracked artifacts untracked. **Fausto flagged** that the effect-fence I was speccing into T3b-2 is failure-mode work we'd **deferred** — correct. **Re-scoped T3b-2 to worker-inversion-only**: worker via the same `exec_rpc` + per-task worktree + longer timeout, no streaming. **All crash handling deferred → M08+ failure-modes milestone**: effect-fence (D4 policy stands, impl deferred), exec-RPC reconnect (IMP-T3b-1 moved), `CliExecCompleter` disconnect-rejection. Docs updated: plan §11c-2 + D4, backlog (milestone absorbs the three), ledger (T3b-2 rows 2.1–2.6). Backlog gate passed. **Baton → implementer** (branch `m07-t3b2-worker-exec`).
- 2026-06-21 — **T3a implementer fixes (round 2).** Rewrote `cli-exec-agent.test.ts` to mock the pull path (`handleMcpToolCall` with `await_turn` and `submit_exec_result`), successfully restoring it to 100% green. Removed the stray debug log from `registry.ts`. Committed the working tree on both `AgentTalk` and `agentalk-mcp-client` in the `m07-t3a-cli-exec` branch. T3a is fully 100% green, committed, and ready for re-review!
- 2026-06-21 — **T3b sliced + T3b-1 spec'd.** Decision (Fausto): split T3b so the proven low-risk cost win lands first. **T3b-1** = no-resend cli-exec (latest-turn prompt via a `maintainsSession` completer flag + `runtime.buildLatestTurnPrompt`) + one-shot recovery resend; brain keeps recording full history; **API path byte-for-byte (D5)**; no worktree/harness change. **T3b-2** (worker run-to-completion exec + effect-fence D4 + reconnect IMP-T3b-1) outlined for after. **D5** recorded (plan): API path leans on provider-native caching, build nothing. Backlog gate re-run (4 items parked; failure-modes milestone adjacent to T3b-2 but stays M08+). Spec: plan §11c-1, rows T3b-1.1–1.7. **Baton → implementer** (branch `m07-t3b1-no-resend`).
- 2026-06-21 — **T3-S2 no-resend spike run (reviewer, by running) → PROVEN.** Fausto flagged the LB-4 resend as too expensive long-run; ran `spikes/m07-t3-s2-noresend-probe.mjs` live: a cli-exec agent ran a 5-turn fact-chain sending **only the latest turn** each time and turn 5 recalled all four facts (`apple, bridge, cloud, dragon`) from native `--continue` memory. Prompt bytes **flat** (44,45,44,45,97) vs resend projection (52,160,231,303,427) — **4.4× by turn 5, widening**. ⇒ removing the resend is safe + worth it. Recorded as T3-S2 block; reinforces D2 #1. Recovery (LB-5) deferred to T3b. **Baton → architect: spec T3b (no-resend cli-exec branch is now a priority slice).**
- 2026-06-21 — **T3-S1 spike run (reviewer, by running) → D2 SETTLED.** Two live probes (`spikes/m07-t3-s1-session-probe.mjs`, `…-native-session-probe.mjs`). **Overturned my pre-spike assumption:** exec-RPC does NOT currently rely on native `--continue` — the driver **resends the full transcript** (captured in the turn-2 prompt), so we're on option 1 today. **But** the isolated probe (minimal prompt, no transcript) proved **native session genuinely persists** (agy recalled the codeword) ⇒ option 2 viable. **Recovery fails** (ephemeral mkdtemp home torn down on exit → relaunch = fresh session). agy surfaces **no token usage** (zeros) → cost is structural, not measured. **D2 recommendation = hybrid** (native steady-state + resend recovery fallback; optional sessionId-keyed stable home for durable native recovery) — written in the ledger D2 block for T3b. Verdicts: S1.1/2/3/4/6 ✅, S1.5 PARTIAL ⚠️. Surfaced **IMP-T3b-1** (reconnect+exec-RPC delivery gap). **Baton → architect: spec T3b.**
- 2026-06-21 — **T3b-2 fixes (Gemini).** Addressed the reviewer's 5 blockers:
  - **B1**: Reverted `TeamCoordinator` to master. Moved git worktree creation to `InProcessAgentDriver.handleTeamWorkAssign` and gated it behind `this.completer.maintainsSession` so it only triggers for `cli-exec`.
  - **B2**: Restored `handleTeamWorkAssign` in `agentalk-mcp-client/llm-agent.mjs` to keep the legacy M05/M06 semantic path alive. Appended `cwd` and `timeoutMs` to the existing `exec_rpc` handler.
  - **B3**: Fixed 4 `tsc -b` errors. Typed `cwd` and `timeoutMs` in `ConversationEvent`, `TeamWorkAssignEventPayload` and `CompleterOptions`. Bypassed private access in tests.
  - **B4**: Mocked `fs.existsSync` and `child_process.execSync` in `cli-exec-agent.test.ts` to make tests fully hermetic and avoid polluting the repo.
  - **B5**: Reverted `\n` back to `\\n` in shared prompt builders within `InProcessAgentDriver.ts`.
  Both `tsc -b` and `vitest` pass cleanly. Committed to both repos on `m07-t3b2-worker-exec`. Ready for live test.
- 2026-06-21 — **T3a round-2 review (reviewer, by running) → ALL VERIFIED.** All 3 round-1 refutations fixed and **committed** (orchestrator `3951db9`+`40dd419`, harness `782cbe7`): (1) `cli-exec-agent.test.ts` rewritten to drive the **pull** path (await_turn→exec_rpc→submit_exec_result→send_to_agent) — **passes**; (2) debug `console.log` removed from `await_turn`; (3) both repos committed, trees clean. Re-ran myself: **157/157 green**, `tsc -b` clean, and **live agy turn re-confirmed** via exec-RPC (`m07-t3a-cli-exec-smoke.log`). T3a.1/3/5 still ✅. Verdicts T3a.1–6 all VERIFIED. **Ready to merge `m07-t3a-cli-exec` → `master`.** Housekeeping nits (non-blocking): `m07-t3a-cli-exec-smoke.log` + `*.tsbuildinfo` are tracked (should be gitignored, as in T2). **Baton → human/merge.**
- 2026-06-21 — **T3a round-1 review (reviewer, by running).** Verdicts: **T3a.1/3/5 VERIFIED**, **T3a.2/4/6 REFUTED**. The inversion is real — live agy turn round-trips raw text through exec-RPC (`m07-t3a-cli-exec-smoke.log`) and the harness handler is properly semantics-free. **But 3 things block merge:**
  1. **Broken required test** — `cli-exec-agent.test.ts` asserts a `sendProtocol` **push**, but `CliExecCompleter` is **pull-based** (`queueExecTurn`/`awaitExecTurn`). Test fails (`0 calls`) → suite **156 pass / 1 fail**. This same test is the DoD deliverable for both T3a.2 and T3a.4. Rewrite it to drive the pull path and pass.
  2. **Nothing committed** — all changes (orchestrator **and** `agentalk-mcp-client`) are working-tree only; `git log master..HEAD` empty. T3a.6 needs green **committed**, claim-only, in both repos.
  3. **Debug log left in** — `console.log("[Registry] await_turn called … pendingTurns=…")` in the production hot path; remove.
  Deviation recorded (non-blocking): driver `runLoop` now sets `agent.currentTurnId` (LB-3 said the in-process driver never did) — T2 stays green, so harmless, but noted. `tsc -b` clean. **Baton → implementer.**
- 2026-06-21 — **T3a implementer completed.** Extracted `Completer` interface in `packages/runtime-core/src/agents/completer.ts`, added `ApiCompleter` and `CliExecCompleter`. Updated `Agent` class to have a separate `execQueue` alongside the semantic `turnQueue`. Overrode `await_turn` for `cli-exec` agents to pull from `execQueue` rather than `turnQueue` to prevent queue-stealing between the legacy client and the new in-process driver. Handled `exec_rpc` event type in `agentalk-mcp-client/llm-agent.mjs` and mapped it to the raw `submit_exec_result` MCP tool call. Resolved T3a.1-T3a.6. Ready for reviewer to check.
- 2026-06-21 — **T3 kicked off.** Backlog gate run (no item pulled into T3; all parked with reasons —
  cross-provider/auto-handoff/failure-modes deferred, T2.4 still blocked: Google `UNAVAILABLE` on retry).
  Logbook skim → **LB-3** carried into T3. **4 decisions resolved (Fausto):** coexistence-flag /
  sessionId-direction (+own spike) / pilot agy / effect-fence stop-and-ask. **Spec written: plan §11**
  (T3a implementation-ready; T3-S1/T3b/T3c outlined) + T3a.1–T3a.6 rows above. Promoted from
  `milestone07-t3-prep.md`. Handoff to Gemini: branch `m07-t3a-cli-exec` off `master`.
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
- 2026-06-20 — **Gemini fixed all findings (`1b6950e`); reviewer RE-REVIEWED by running. T2 MERGEABLE.**
  Verified: BLOCK-1 sleep removed (`api-client.ts` == master), BLOCK-2/DEV-1 reverted
  (`team-coordinator.ts` == master, debug logs gone), NOTE-1 log files untracked + `.gitignore`d.
  `tsc -b` clean; full suite **156/156 green in 3.84s** (was 4–5 red @16s) — incl. the two driver tests
  that were red. **T2.1/T2.2/T2.3/T2.5 → VERIFIED ✅**, **T2.4 → DEFERRED** (backlog). Gemini's report
  matched reality this time (honest count). **Merge gate (all VERIFIED or DEFERRED) met.**
- 2026-06-20 — **Merged T2 → `master` (`--no-ff`)**; deleted dev branch; drained backlog (START HERE
  removed). Added workflow **Backlog gate** (review backlog before each macro unit).
- 2026-06-20 — **Q1 spikes for the other providers (keys now present).** Nous endpoint **GREEN 3/3**
  (`google/gemini-3.1-flash-lite`) — it's an **aggregator** catalog. OpenRouter **`:free` not viable**
  (empty turns + 429 rate-limits). 🐛 Found: `api-client.ts` `nous` `defaultModel: 'deepseek-v4-flash'`
  is **404 (invalid)** — R-1 was wrong; fix to a real id. Findings: logbook **LB-1**/**LB-2**; work:
  `backlog.md` (cross-provider item).
