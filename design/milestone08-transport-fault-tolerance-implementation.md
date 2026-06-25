# Milestone 08 — Transport / Lifecycle Fault Tolerance — Implementation Status

**Status:** **✅ COMPLETE — M08-T1 + M08-T2 + M08-T3 + M08-T4 all MERGED to `master`. M08 (transport/lifecycle fault tolerance) is done.** Only deferred item: **T2.4** (live SIGKILL+relaunch, BLOCKED until agy quota returns). Implementer = Claude (agy out). Plan signed off (D1/D2/D3
accepted, scope + assignment §8 decided). **Budget override (Fausto, 2026-06-22): agy/Gemini exhausted for the
weekly window (95%) → Claude implements ALL M08 tasks until it refills.** **Gate-policy amendment (LB-14): the
deterministic gate is delegated to Claude while Gemini is out** (run + self-review diff + merge on green; reverts
to independent verifier when agy refills). **All four tasks merged to `master`**; T3 (worker effect-fence /
`awaiting_operator`) was the most sensitive (touched `team-coordinator.ts`; M03 kill path kept byte-for-byte). T4
(hygiene, test-only) merged last — M08 is closed.
**Plan:** `design/milestone08-transport-fault-tolerance-plan.md` (architect-owned; this doc tracks status only).
**Last verified:** 2026-06-22 (epic opened) · **Architect:** Claude · **Implementer (now):** Claude (all tasks, agy out) · **Gate/verifier:** Fausto (no independent agent verifier available — §8 honesty note).

> **Verdict discipline (workflow §3b / principle 2):** the *implementer* fills the **claim** column on its
> branch (claim-only commits — no DoD self-ticking, no editing CLAUDE.md/AGENT.md). The *verifier* fills the
> **verdict** column **only after running it**, with evidence. A row is closed only when the verdict is
> **VERIFIED ✅** — never on the claim alone. Verdict ∈ {VERIFIED ✅ / REFUTED ❌ / PARTIAL ⚠️ / BLOCKED ⛔ /
> not-checked}. Merge to `master` only when every row of a task is VERIFIED.

## Tasks (DoD lives in the plan; this tracks state)

| Task | Goal | Branch (implementer creates off `master`) | Impl | Verifier | Status |
|---|---|---|---|---|---|
| **M08-T1** | `McpCompleter` rejection (timeout + mid-exec disconnect); callers handle it; happy path byte-for-byte | `m08-t1-completer-reject` | Claude (agy out) | Fausto gate | **MERGED ✅** → `master` `1fab267` (all DoD VERIFIED; IMP-M08-1 grace amendment included) |
| **M08-T2** | exec-RPC reconnect re-delivery (IMP-T3b-1); reject on window-expiry | `m08-t2-exec-reconnect` | Claude | Claude (delegated gate, LB-14) | **VERIFIED ✅ → merging** (T2.1/2.2/2.3 verified; T2.4 deferred BLOCKED ⛔) |
| **M08-T3** | Worker effect-fence (D4) **— fence only**: worker crash mid-exec → `awaiting_operator` → record + surface → kill nobody. M03 kill path byte-for-byte. *(Operator abort/recovery split OUT → own future milestone, see backlog 2026-06-23.)* | `m08-t3-worker-effect-fence` | Claude | Claude (delegated gate) + Fausto merge-gate | **MERGED ✅ → `master` `7686554` (ff). Delegated gate green (tsc 0, suite 182/182, 0 pollution); T3.1/T3.2/T3.3/T3.5 VERIFIED, T3.4 OUT. Human merge-gate cleared 2026-06-24.** |
| **M08-T4** | Pin no-driver rejection (absorbed IP-4) | `m08-t4-no-driver-test` | Claude | Claude (delegated gate) + Fausto merge-gate | **MERGED ✅ → `master` (ff `9e526e6`; test `356e5e7`). Test-only; gate green (tsc 0, suite 183/183, 0 pollution). Human merge-gate cleared 2026-06-24.** |

---

## Task M08-T1 — `McpCompleter` rejection  *(ACTIVE — branch `m08-t1-completer-reject` off `master`)*

**Spec:** plan §3 (G1), §4 (DoD T1.1–T1.5), §5 D1 (120 s default; use `opts.timeoutMs` when present).
**Scope:** `packages/runtime-core/src/agents/completer.ts` + its caller(s) in `in-process-driver.ts` (handle a
rejected `complete()`); deterministic mocked-transport tests. **DO NOT TOUCH** the `ApiCompleter` happy path,
`team-coordinator.ts` consensus logic, the harness, M05/M06. Behaviour-preservation: a normal exec that returns
`submit_exec_result` must be byte-for-byte unchanged.

| T1 DoD item (from plan §4) | Implementer claim | Reviewer verdict | Evidence |
|---|---|---|---|
| **T1.1** — `complete()` rejects on a per-exec wall-clock timeout (`opts.timeoutMs` if present, else 120 s default, configurable) with a typed/identifiable error; `exec_result` listener removed on **both** resolve and reject (no leak). | **done** (Claude) | **VERIFIED ✅** (Fausto gate, 2026-06-22) | `completer.ts`: `complete()` races the `exec_result` resolve vs `setTimeout(opts.timeoutMs ?? DEFAULT_EXEC_TIMEOUT_MS=120_000)` → `reject(new McpError('timeout', …))`; `settled` guard; `cleanup()` does `off('exec_result')`+`off('status')`+`clearTimeout` on **every** settle. Tests `completer.test.ts`: "typed timeout error" + "applies the 120s default (D1)"; both assert `listenerCount('exec_result')===0` & `('status')===0`. |
| **T1.2** — `complete()` rejects when its agent enters a terminal/disconnected state mid-exec; reject carries enough context to distinguish *timeout* vs *disconnect*. | **done** (Claude) | **VERIFIED ✅** (Fausto gate, 2026-06-22) | `completer.ts`: `'status'` listener (existing `registry.ts:170` event, **no registry change**) rejects with `McpError('disconnect', …)` on `error`/`terminated`; `reason` field distinguishes from `'timeout'`. Tests: rejects on `error` and on `terminated`; **ignores** non-terminal `reconnecting` (left for T2) and other-agent status. |
| **T1.3** — Callers (`executeApiPrompt`/…) handle a rejected `complete()`: the turn ends in a clean, reported failure — never an unhandled rejection, never a silent swallow. | **done** (Claude) | **VERIFIED ✅** (Fausto gate, 2026-06-22) | `in-process-driver.ts:executeApiPrompt` now `try/catch` → `console.warn("exec failed, ending turn: …")` + `return null` (the existing "no text" contract). Deliberately does **not** rethrow (rethrow → loop catch sets `error` → M03 trip — a T2/T3 lifecycle call). Test `in-process-driver.test.ts` "M08-T1: a rejected exec ends the turn cleanly": asserts `complete` called, warn emitted, **no** `handleMcpToolCall`, agent **not** `error`. |
| **T1.4** — **Happy path byte-for-byte:** normal exec returning `submit_exec_result` behaves exactly as today; `ApiCompleter` untouched. Existing mcp + API suites stay green. | **done** (Claude) | **VERIFIED ✅** (Fausto gate, 2026-06-22) | `ApiCompleter` untouched (diff shows only the `McpCompleter` body + new error type/const). Resolve path returns the same `{text, usage}`. Full suite **172/172** (was 165 at M07 close; the +7 are the new T1 tests only — no existing test changed), `tsc -b` exit 0. |
| **T1.5** — Deterministic mocked-transport tests: inject no-result → timeout-reject; inject mid-exec disconnect → disconnect-reject; assert no listener leak. No live calls. | **done** (Claude) | **VERIFIED ✅** (Fausto gate, 2026-06-22) | New `agents/__tests__/completer.test.ts` — 6 cases (happy+no-leak, other-agent ignored, timeout, 120s default, disconnect-on-error, terminated+non-terminal-ignored). Fake registry = bare `EventEmitter`, stub agent; `vi.useFakeTimers` for the timeout cases. **No live calls.** Ran: completer 6/6 + driver 5/5 = 11/11. |

**Cross-cutting (all tasks):** `tsc -b` clean + full vitest suite green **committed**; 0 repo pollution
(`git worktree list` / `git branch` clean after runs — LB-9); M05/M06 + API + planner happy paths unchanged; harness untouched.

### Impediments (§3c) — *(none yet)*
| ID | What blocked | Blocks (DoD row) | Status | Unblock condition |
|---|---|---|---|---|

### Implementer notes & deviations (§3c)
| ID | Type {deviation/opinion/question} | Re: (DoD row) | What & why | Reviewer disposition |
|---|---|---|---|---|
| IMP-M08-1 | opinion | T1.1 | I implemented D1 **literally**: the completer guard = `opts.timeoutMs` exactly (no grace margin). For the worker (600 s) the harness *also* receives `timeoutMs:600 s` in the exec payload — so if the harness has its own timeout that returns a result/error at 600 s, the completer's guard at the same 600 s could **race** it and pre-empt a result about to arrive. Faithful to D1 as written; flagging in case you'd prefer the completer guard be `timeoutMs + grace` (pure backstop). Not changed without a call. | **ACCEPTED (Fausto, 2026-06-22) → D1 amendment.** Grace margin added: completer's own timer now backstops an *explicit* `timeoutMs` at `timeoutMs + EXEC_TIMEOUT_BACKSTOP_GRACE_MS` (5 s); the unforwarded 120 s default is unchanged (no competing timer). `completer.ts` only; `turn.timeoutMs` still forwarded literal. New test pins ordering (fires after grace, not at `timeoutMs`). `tsc -b` 0, suite **173/173**. Couldn't confirm harness enforcement from this repo (sibling `agentalk-mcp-client`); accepted on asymmetric-risk grounds. |

## Task M08-T2 — exec-RPC reconnect re-delivery  *(ACTIVE — branch `m08-t2-exec-reconnect` off `master`)*

**Spec:** plan §3 (G2), §4 (DoD T2.1–T2.4), §5 D2 (re-deliver in-window; reject on window-expiry).
**Scope (amended Fausto 2026-06-22):** `registry.ts` (exec-turn requeue in the 1006 branch; set/clear
`activeExecTurn` at the `await_turn`/`submit_exec_result` sites) + **`agent.ts`** (`activeExecTurn` field,
`clearExecTurnWaiters()`, head-requeue helper — mirrors `activeTurn`/`clearTurnWaiters`) + deterministic mocked
tests. **DO NOT TOUCH** `completer.ts` (T1's reject reused as-is), `in-process-driver.ts` (worker fence = T3),
`team-coordinator.ts`/consensus, `ApiCompleter`, the harness, `wire-contract.json`.
**Approved scope calls (Fausto 2026-06-22):** (1) `agent.ts` added to scope; (2) **T2.2 is test-only** —
window-expiry rejection is already delivered by T1 (30 s timer → `error` → T1 disconnect-reject, which ignores
`reconnecting`); (3) **T2.4 (live SIGKILL+relaunch) deferred BLOCKED** — T2.3 proves the mechanism
deterministically; reopen when agy quota returns.

| T2 DoD item (from plan §4) | Implementer claim | Reviewer verdict | Evidence |
|---|---|---|---|
| **T2.1** — in-flight exec turn re-delivered to the harness after an in-window reconnect (D2, full-resend). | **done** (Claude) | **VERIFIED ✅** (delegated gate — Claude, 2026-06-22; LB-14) | `agent.ts`: new `activeExecTurn` (set on delivery in `awaitExecTurn`/`queueExecTurn`-resolve, cleared on result), `queueExecTurn(turn, atHead)` head-requeue, `clearExecTurnWaiters()` — all mirror the existing `activeTurn`/`queueTurn`/`clearTurnWaiters`. `registry.ts` `handleMcpDisconnect` 1006 branch requeues `activeExecTurn` at head (next to the existing semantic requeue); re-delivery uses the same `turn` object = full resend (`markSessionStale` already fires at reconnect). Test "re-delivers the in-flight exec turn after an in-window reconnect". |
| **T2.2** — window-expiry → `complete()` rejects cleanly (T1 path), no hang. **(test-only — T1 already implements it.)** | **done** (Claude) | **VERIFIED ✅** (delegated gate — Claude, 2026-06-22; LB-14) | No new code: the completer's `onStatus` (T1) ignores `reconnecting` and rejects on `error`; the existing 30 s timer flips `reconnecting`→`error` (`registry.ts:725`, `'…error on reconnect timeout if a turn was in flight'` test) → T1 disconnect-reject fires. T1's completer tests already pin the reject. |
| **T2.3** — deterministic test: drop-mid-exec + reconnect-in-window → re-delivery → completion; drop + window-expiry → clean reject. No live calls. | **done** (Claude) | **VERIFIED ✅** (delegated gate — Claude, 2026-06-22; LB-14) | 3 new tests in `registry.test.ts` (attach-mode reconnect block): re-delivery after in-window reconnect; stale exec waiter cleared (can't eat the re-delivery); no re-delivery once `submit_exec_result` ran (driven through real `handleMcpToolCall`). Mocked transport (no live calls). Full suite **176/176** (was 173; +3, no existing test changed), `tsc -b` 0. No repo pollution (`git worktree`/`git branch` clean). |
| **T2.4** — live SIGKILL+relaunch reproduction. | **DEFERRED ⛔** | n/a | Deferred BLOCKED (Fausto 2026-06-22): quota/serial-actor constraint; T2.3 is the deterministic proof. Reopen when agy weekly window refills. |

## Task M08-T3 — Worker effect-fence (FENCE ONLY)  *(branch `m08-t3-worker-effect-fence` off `master`)*

**Spec:** plan §3 (G3), §4 (DoD T3.1–T3.5), §5 D3; decisions ratified 2026-06-23 (**LB-16 addendum**): ①②③⑤
approved, **④ operator abort/recovery deferred → own milestone** (so T3.4 is OUT). **Scope (ratified):**
`packages/contracts/src/types.ts` (① `awaiting_operator`), `in-process-driver.ts` (② worker-only
`throwOnExecError` rethrow + `handleTeamWorkAssign` fence catch), `team-coordinator.ts` (③ `pauseTaskForOperator`
+ ⑤ `isTaskAwaitingOperator`; **`handleAgentFailure` byte-for-byte**), `registry.ts` (③ thin delegation + ⑤ idle
guard), new `__tests__`. **DO NOT TOUCH** `completer.ts`, `handleAgentFailure` logic, consensus/phase logic,
`ApiCompleter`, the harness, web UI; **no abort path / no UI text promising an abort** (④ deferred).
**Implementation finding (folds into LB-16):** `handleAgentFailure` fires **only** on the transition to `error`
(`registry.ts:172`), never on `terminated`/`timeout`. So the realistic fence trigger — a worker exec that
hangs/crashes → completer **timeout** reject (agent stays `busy`, no status change) — reaches the fence with **no
race** against the M03 kill. (An `error`-status trigger *would* race; that path is the idle-timeout case, which
correctly still kills — T3.2.) The deterministic tests model the clean timeout/disconnect-reject path.

| T3 DoD item (from plan §4) | Implementer claim | Reviewer verdict | Evidence |
|---|---|---|---|
| **T3.1** — worker exec reject (via T1) diverted **before** a generic agent `error` → `pauseTaskForOperator` → `awaiting_operator`, transcript recorded (reason + "effects may be partial"), task emitted; **no member shut down, no auto-retry, no silent completion.** | **done** (Claude) | **VERIFIED ✅ (delegated gate, Claude — LB-14) — awaiting human merge-gate** | `in-process-driver.ts`: `executeApiPrompt` gains worker-only `throwOnExecError` (rethrows **only** `McpError`; planner paths omit it → null-swallow byte-for-byte); `handleTeamWorkAssign` wraps exec in `try/catch (McpError)` → `registry.pauseTaskForOperator(agentId, msg)` + return. `team-coordinator.pauseTaskForOperator`: sets `awaiting_operator`, `recordTaskTranscript`, `emitTeamTask`, **no `requestAgentShutdown`, no `team.status='error'`, no `delete currentTaskId`.** Tests: driver "a worker exec crash (McpError) fences the task…" (pause called, no `handleMcpToolCall`, agent not `error`); coordinator "pauseTaskForOperator: task → awaiting_operator, team left alive, nobody shut down". |
| **T3.2** — **M03 Shared-Fate kill path unchanged** for all non-worker-exec failures; the fence is a narrow diversion of the worker-exec-crash case only. | **done** (Claude) | **VERIFIED ✅ (delegated gate, Claude)** | `handleAgentFailure` diff = **zero lines** (byte-for-byte). New coordinator tests pin both halves: "handleAgentFailure still kills on an in_progress task (M03 Shared-Fate unchanged)" (→ `interrupted`, team `error`, `currentTaskId` deleted, surviving member shut down) **and** "no-ops on an awaiting_operator task" (the new status matches neither branch → harmless no-op, LB-16 F3.2). Full suite **182/182**, no existing test changed. |
| **T3.3** — **Consensus/coordinator phase logic untouched.** | **done** (Claude) | **VERIFIED ✅ (delegated gate, Claude)** | `team-coordinator.ts` diff = only the two **additive** methods (`isTaskAwaitingOperator`, `pauseTaskForOperator`); no phase/transition/guard code touched. Consensus suite (`team-mcp-consensus.test.ts`) green within the 182/182. |
| **T3.4** — operator **abort** path. | **OUT (deferred)** | n/a | Split to its own future milestone (Fausto 2026-06-23, LB-16 ratification; `backlog.md`). "Stop ASAP" is bounded but "clean up" (partial worker effects) is unbounded → let experience dictate. v1 recovery = manual cleanup + restart. The fence keeps the partial state frozen + surfaced (harmless per LB-16 F1–4). **No abort code, no UI text promising one.** |
| **T3.5** — deterministic test (worker exec rejected → `awaiting_operator`, no member shutdown), **no repo pollution** (LB-9). | **done** (Claude) | **VERIFIED ✅ (delegated gate, Claude)** | 3 driver tests (injected rejecting completer, `maintainsSession=false` → the `execSync('git worktree…')` provisioning path is **never entered**, so no mock even needed) + 3 coordinator tests (seed the task map directly — no worker provisioning). Post-run `git worktree list` = main only, no `task-*` branches, no `/tmp/agentalk-task-*`. (Abort half of the plan's T3.5 dropped with T3.4.) |

**Delegated-gate run (Claude, 2026-06-24):** `tsc -b` exit 0; full vitest **182/182** (was 176; **+6** = 3 driver + 3 coordinator, **no existing test changed**); `git diff --stat` = exactly the 6 in-scope files (contracts/types, in-process-driver +test, registry, team-coordinator, + new fence test); 0 repo pollution.

**Telemetry (task closure):**
- task:        M08-T3 (worker effect-fence, fence only)
- wall-clock:  2026-06-24 10:29 → 11:42 CEST (Δ ~1h13m)
- budget:      weekly 2%→4% (Δ ~2%), session 10%→24% (Δ ~14%)  [per /usage @ 11:02; closure read `unavailable` — meter `ok:false`, LB-11]
- gate:        tsc 0, suite 182/182, pollution clean (worktree/branch/`/tmp`)
- diff:        8 files, +328/-8; commit `7686554`
- outcome:     MERGED ✅ → `master` (fast-forward from `66e2bfe`); branch `m08-t3-worker-effect-fence` retained

## Task M08-T4 — no-driver test (hygiene, absorbed IP-4)  *(branch `m08-t4-no-driver-test` off `master`)*

**Spec:** plan §4 (DoD T4.1). **Scope: test-only** — new `packages/runtime-core/src/registry/__tests__/no-driver-start.test.ts`. **No production code touched** (no behaviour change). **Behaviour pinned (already correct):** a provider-less agent → `activateAgent` throws `Provider-less or unknown agents are no longer supported` (`registry.ts:228`); `POST /api/agents/:id/start` catches it → HTTP **500** via `getErrorStatus` (`server.ts:37`). Tested at the **registry** level (plan permits "server/registry test") — `startServer` is heavyweight (WS+MCP) and there is no `supertest` dep, so booting the full server for a hygiene pin would be the wrong size + a scope expansion.

| T4 DoD item (from plan §4) | Implementer claim | Reviewer verdict | Evidence |
|---|---|---|---|
| **T4.1** — a test asserts provider-less `createAgent` → start returns the error status (not 200, not a crash). | **done** (Claude) | **VERIFIED ✅ (delegated gate, Claude — LB-14) — awaiting human merge-gate** | `no-driver-start.test.ts`: `createAgent('no-driver-agent', {})` (asserts `agent.provider === undefined`) then `await expect(registry.activateAgent(...)).rejects.toThrow(/no longer supported/)`. A rejection that *resolves* in the test = the error is **catchable** (the route's try/catch → HTTP 500), i.e. NOT a silent success/200 and NOT an uncaught crash. The 500 mapping is plain express plumbing already exercised by `getErrorStatus`. |

**Telemetry (task closure):**
- task:        M08-T4 (no-driver test, hygiene)
- wall-clock:  2026-06-24 11:56 → ~11:57 CEST (Δ ~minutes; trivial test-only task)
- budget:      weekly 4%→6% (Δ ~2%, incl. T3 doc/merge tail), session ~24%→~30%  [per /usage]
- gate:        tsc 0, suite 183/183 (+1), pollution clean (worktree/branch/`/tmp`)
- diff:        1 file (+test only), commit `356e5e7`
- outcome:     MERGED ✅ → `master` (fast-forward to `9e526e6`); branch `m08-t4-no-driver-test` retained

## Status log

- 2026-06-22 — **M08 opened + T1 batoned (architect: Claude).** Plan signed off: D1 (120 s default timeout),
  D2 (re-deliver in-window), D3 (`awaiting_operator` narrow diversion + abort) all accepted; assignment §8
  decided. Ledger created. **Budget override (Fausto): agy/Gemini exhausted for the week (meter 95% weekly +
  independent confirm) → Claude takes the implementer role for ALL M08 tasks until agy refills; Fausto is the
  gate (no independent agent verifier — §8 honesty note).** T1 active; T2/T3 queued behind it (dependency).
- 2026-06-22 — **T1 implemented (Claude, impl role) — CLAIMED, awaiting Fausto gate.** `completer.ts`
  (reject path: timeout + terminal-status via existing `'status'` event, typed `McpError`, full cleanup),
  `in-process-driver.ts` (`executeApiPrompt` try/catch → warn + null, no M03 trip), new `completer.test.ts`
  (6) + 1 driver test. `tsc -b` 0; full suite **172/172** (was 165; +7 new, no existing test changed). No
  registry/coordinator/harness/ApiCompleter change (scope held). 1 implementer opinion logged (IMP-M08-1:
  timeout grace-margin). **Not committed** (awaiting Fausto). Branch `m08-t1-completer-reject`.
- 2026-06-22 — **T1 GATED by Fausto → all 5 DoD rows VERIFIED ✅.** Fausto ran the gate on `989ad74`
  (`tsc -b` exit 0; full suite **172/172**; `git diff --stat` = exactly the 4 in-scope files; `git worktree
  list`/`git branch` clean — no LB-9 pollution). Claude guided step-by-step; verdict cells filled on his
  evidence (no agent self-rubber-stamp).
- 2026-06-22 — **IMP-M08-1 ACCEPTED → D1 amendment implemented (Claude, impl role).** Added
  `EXEC_TIMEOUT_BACKSTOP_GRACE_MS=5_000`; completer's own timer now fires at `timeoutMs + grace` for an
  *explicit* timeout (pure backstop, never races the harness), default 120 s unchanged. `completer.ts` +
  `completer.test.ts` only (47 ±, scope held); new ordering test added. `tsc -b` 0, suite **173/173**
  (+1). **Uncommitted, on top of the gated `989ad74`** — awaiting Fausto's optional re-gate of the amended
  tree, then commit + merge to `master`.
- 2026-06-22 — **T1 committed + rebased + MERGED ✅ to `master` (`1fab267`).** Fausto OK'd taking Claude's run;
  amendment committed (`68e4c7e`→ rebased `1fab267`), rebased onto current master (2 docs-only commits, clean),
  re-verified on the rebased tree (`tsc -b` 0, suite **173/173**), fast-forward merged. No push (local only).
  Branch `m08-t1-completer-reject` retained (merged). T1 closed.
- 2026-06-22 — **T2 scoped + opened (architect/impl: Claude).** Scope proposal accepted by Fausto: (1) add
  `agent.ts` to scope; (2) T2.2 is test-only (T1 already rejects on window-expiry); (3) T2.4 live deferred
  BLOCKED ⛔. Plan §2 amended (+`agent.ts`). Approach = mirror the semantic-turn reconnect guards
  (`activeTurn`/`clearTurnWaiters`) onto the exec-turn path (`activeExecTurn`/`clearExecTurnWaiters` + head
  requeue in the 1006 branch). Branch `m08-t2-exec-reconnect` created off `master`. Implementation starting.
- 2026-06-22 — **Gate-policy amendment accepted (Fausto) → LB-14 + plan §8.** Human gate exists for
  *independence*, not determinism; with Gemini out, the **deterministic gate is delegated to Claude** (run
  tsc/vitest + self-review diff + merge on green, reporting actual output; Fausto retains cheap re-run audit).
  Knowingly relaxes the §8 circuit breaker; reverts to an independent verifier when agy's weekly window refills.
  Live bars stay deferred/human-gated. T1 was hands-on gated (pre-amendment); T2 onward use the delegated gate.
- 2026-06-22 — **T2 implemented + gated (delegated, Claude) → VERIFIED ✅, MERGED to `master`.** Claim commit
  `c11b94f`. Gate run: `tsc -b` 0; full suite **176/176** (was 173; +3 T2 tests, no existing test changed);
  `git diff --stat` = 5 files (`agent.ts`, `registry.ts`, `registry.test.ts` + plan/ledger), all in scope;
  worktree/branches clean (no LB-9 pollution). Diff self-review: all changes additive, semantic-turn path
  byte-for-byte, only the re-delivery behaviour is new (fires solely on a 1006 drop with an exec in flight).
  T2.1/T2.2/T2.3 VERIFIED; **T2.4 (live) deferred BLOCKED ⛔** (reopen when agy refills). No push (local only).
- 2026-06-22 — **T3 scoped, then PAUSED (Fausto's call — resume fresher / more budget).** Full scope pass
  recorded in **LB-15**: the T1↔T3 `null`-overload finding, the approach (`pauseTaskForOperator` as a new sibling
  of the untouched `handleAgentFailure`), files, **2 scope amendments** (`packages/contracts/src/types.ts` for
  the new `awaiting_operator` status; the worker-only `McpError` rethrow helper) and **4 open decisions**.
  **No code written.** Restart from LB-15. Session primer refreshed (cites LB-15). T4 (hygiene) also remains.
- 2026-06-23 — **T3 decisions RATIFIED (Fausto, walk-through).** ①②③⑤ approved as recommended; **④ abort
  deferred → own future milestone** (T3 now FENCE ONLY). Recorded in **LB-16 ratification addendum** + `backlog.md`.
  Implementation deliberately deferred past the Jun-24 weekly reset (heaviest task; mid-engine-edit cutoff is the
  worst failure). Still no code.
- 2026-06-24 — **T3 IMPLEMENTED + delegated-gate green (Claude, impl role; cleared by Fausto).** Branch
  `m08-t3-worker-effect-fence` off `master` (`66e2bfe`). Five changes per the ratified scope (①②③⑤ + tests);
  `handleAgentFailure` **byte-for-byte** (zero-line diff). Gate: `tsc -b` 0; full suite **182/182** (was 176; +6
  new tests — 3 driver + 3 coordinator; no existing test changed); `git diff --stat` = the 6 in-scope files; 0
  repo pollution (`git worktree`/`git branch`/`/tmp` clean). Diff self-reviewed for behaviour-preservation
  (planner null-swallow + `handleAgentFailure` + consensus all unchanged). Implementation finding folded into the
  T3 section: `handleAgentFailure` triggers only on `error` → the timeout-reject fence path is race-free.
- 2026-06-24 — **T3 MERGED ✅ to `master` (`7686554`, fast-forward from `66e2bfe`).** Human merge-gate cleared
  (Fausto: "T3 is mergeable"). Post-merge gate re-run on `master`: `tsc -b` 0, suite **182/182**. Branch retained.
  Structured **task-closure telemetry block** added (new convention, AGENT.md Resource-Monitoring §). **T4 (hygiene)
  is the last M08 task.** Pushed `master` to origin (`33d1d82`).
- 2026-06-24 — **T4 IMPLEMENTED (Claude, impl role) — CLAIMED + delegated gate green.** Branch
  `m08-t4-no-driver-test` off `master` (`9406b70`). **Test-only**, no production code: new
  `no-driver-start.test.ts` pins the provider-less rejection at the registry level. `tsc -b` 0; full suite
  **183/183** (+1); `git status` = 1 new test file; 0 pollution. **NOT merged — closure human-gated; awaiting
  Fausto's merge-gate.** After it merges, **M08 is complete** (T2.4 live remains the only deferred item).
- 2026-06-24 — **T4 MERGED ✅ → `master` (ff to `9e526e6`; test commit `356e5e7` + ledger-header housekeeping
  `9e526e6`). M08 COMPLETE.** Human merge-gate cleared (Fausto: "do housekeeping and then merge if everything
  checks"). Pre-merge housekeeping: stale ledger-header line refreshed. Post-merge gate on `master`: `tsc -b` 0,
  suite **183/183**, 0 pollution. Pushed to origin. **All four M08 tasks merged**; only **T2.4** (live
  SIGKILL+relaunch) remains deferred BLOCKED (reopen when agy weekly quota returns). Next epic = **M09**
  (consensus/protocol robustness, spike-led) per the plan.
