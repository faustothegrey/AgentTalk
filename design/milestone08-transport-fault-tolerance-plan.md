# Milestone 08 — Transport / Lifecycle Fault Tolerance — Plan

**Status:** **DRAFT for review** — needs Fausto's scope/sign-off + the three design calls in §5 confirmed.
**Author:** Claude (architect), 2026-06-22 · **Implementer (proposed):** see §8 (sensitive engine work — assignment is Fausto's call).
**Related:** `design/milestone07-centralized-brain-plan.md` (M07, closed) · `design/backlog.md` (failure-modes split + M08 gate) ·
`design/collaboration-workflow.md` (method) · `design/logbook.md` (LB-5, LB-9) ·
`design/milestone07-centralized-brain-implementation.md` (IMP-T3b-1, D4, T3b-2 known-limitation note).

> Per the workflow: **document before implementation, readiness gate precedes code.** This plan opens the
> first of the two failure-mode milestones. **M08 = transport/lifecycle** (deterministic, mockable, low
> ambiguity — done first); **M09 = consensus/protocol robustness** (spike-led — opens after M08). M08 builds
> the safety net M09 leans on: a derailed planner *is* a lifecycle event.

---

## 0. One-sentence vision

Make the **exec-RPC turn lifecycle survivable**: a turn that can't complete (timeout, mid-exec disconnect,
worker crash) **fails cleanly and visibly** instead of hanging the agent forever — so the orchestrator can
re-deliver, fail the round, or stop-and-ask, deterministically.

## 1. Problem (why M08 exists)

The M07 inversion left the exec-RPC path **happy-path-only by design** (T3b-2 was scoped to inversion only;
all crash handling was deferred here). Three concrete gaps, all confirmed in the current code:

- **G1 — `McpCompleter` never rejects.** `complete()` (`completer.ts:46`) registers an `exec_result`
  listener and **only ever resolves**. If the harness disconnects mid-exec, enters a terminal state, or simply
  never returns `submit_exec_result`, the Promise hangs forever → the driver's `await completer.complete(...)`
  (`in-process-driver.ts:180`, worker at `:258`) hangs the whole turn. No timeout, no disconnect rejection.
- **G2 — exec-RPC reconnect delivery gap (IMP-T3b-1).** On an abnormal drop (1006), `handleMcpDisconnect`
  (`registry.ts:712`) requeues the **semantic** `activeTurn` and fires `markSessionStale()`, then gives a 30s
  reconnect window. But the **in-flight exec turn is never re-delivered** to the relaunched harness → the turn
  that was issued before the drop times out (observed live in the T3-S1 probe).
- **G3 — no worker effect-fence (D4).** The worker path (`handleTeamWorkAssign`, `in-process-driver.ts:225`)
  awaits `completer.complete` with no fence. D4's policy — *worker crash mid-exec → **stop-and-ask*** — was
  decided in T3b-2 but has no implementation, so a crashing/hanging worker exec silently hangs the task
  (today masked only because the exec path is flag-gated / off by default, D1).

These three are **layered**: G1 (the completer must be able to reject) is the foundation; G2 and G3 both need a
clean failure signal to act on. Fix G1 first; G2 and G3 build on it.

## 2. Scope

**In scope (files this epic may touch):**
- `packages/runtime-core/src/agents/completer.ts` — add the reject path (G1).
- `packages/runtime-core/src/registry/registry.ts` — exec-turn re-delivery on reconnect / clean rejection on
  window-expiry (G2); routing a worker-exec failure to the fence (G3). **HIGH-sensitivity shared engine.**
- `packages/runtime-core/src/agents/in-process-driver.ts` — worker fence handling (G3); caller handling of a
  rejected `complete()` (G1).
- `packages/runtime-core/src/agents/agent.ts` — **(added to T2 scope, Fausto 2026-06-22)** the exec-turn
  queue state (`pendingExecTurns`/`execTurnResolvers`) lives here; T2's reconnect re-delivery needs an
  `activeExecTurn` field + a `clearExecTurnWaiters()` + a head-requeue helper, mirroring the semantic-turn
  guards (`activeTurn`/`clearTurnWaiters`) the file already hosts. Additive only; no change to existing turn flow.
- New/extended `__tests__` for the above (deterministic, mocked transport — §6).
- `packages/runtime-core/src/registry/` + server test for IP-4 (G/T4, hygiene).
- This plan + the M08 `-implementation.md` ledger + `logbook.md` (findings).

**Explicitly OUT of scope (DO NOT TOUCH — [BLOCK]-class if needed):**
- **`TeamCoordinator` consensus/phase logic** — the consensus state machine, illegal-transition tolerance,
  re-prompt/coerce. That is **M09**, not M08. The fence (G3) may *signal* the coordinator that a worker turn
  failed, but must **not** change how consensus phases are enforced. Any change to coordinator throw/guard
  behavior is a show-stopper → confirm with the human.
- **The API/`ApiCompleter` happy path** — must stay byte-for-byte (M07 D5). The reject path is additive only.
- **The harness** (`agentalk-mcp-client`) — stays pure transport + exec. If G2 needs the harness to acknowledge
  re-delivery, that is a **wire-contract change** (v4 → v5, re-bump both repos) and must be flagged as its own
  decision before any harness edit.
- **M05/M06 attach (semantic) path, the planner happy path.**

## 3. The three gaps → three tasks (+ one hygiene task)

| Task | Goal | Branch (implementer creates) | Depends on |
|---|---|---|---|
| **M08-T1** | **`McpCompleter` rejection** — `complete()` rejects on (a) wall-clock timeout, (b) agent entering a terminal/disconnected state mid-exec; listener cleaned up (no leak); callers handle the rejection so the turn fails cleanly instead of hanging. Happy path unchanged. | `m08-t1-completer-reject` | — (foundation) |
| **M08-T2** | **exec-RPC reconnect delivery (IMP-T3b-1)** — a harness that drops mid-exec and reconnects within the 30s window gets the in-flight exec turn **re-delivered** (D2); if the window expires, the completer **rejects cleanly** (via T1) so the turn fails instead of hanging. Re-delivered exec uses the full-resend prompt (session is stale — `markSessionStale` already fires; LB-5). | `m08-t2-exec-reconnect` | T1 |
| **M08-T3** | **Worker effect-fence (D4 stop-and-ask)** — when the worker exec rejects/crashes mid-exec (via T1), the worker path diverts it (before generic agent `error`) to `pauseTaskForOperator` → new `awaiting_operator` status, surfaced + recorded, **terminates nobody**; plus an operator **abort** path. M03 kill path unchanged for all other cases; consensus logic untouched. | `m08-t3-worker-effect-fence` | T1 |
| **M08-T4** | **(hygiene, absorbed from IP-4)** — pin the no-driver rejection: a small server/registry test asserting a provider-less `createAgent` → `/start` returns the error status (not 200, not a crash). | `m08-t4-no-driver-test` | — |

## 4. Definition of Done (mirrored as claim/verdict rows in the `-implementation.md` ledger)

**M08-T1**
- T1.1 — `McpCompleter.complete()` rejects on a wall-clock timeout (per-exec, sourced per D1) with a typed,
  identifiable error; the `exec_result` listener is removed on both resolve **and** reject (no listener leak).
- T1.2 — `complete()` rejects when its agent transitions to a terminal/disconnected state mid-exec (a turn in
  flight when the socket dies must not hang). Reject carries enough context to distinguish *timeout* vs *disconnect*.
- T1.3 — Callers (`executeApiPrompt` / `handleTurn` / `handleTeamWorkAssign`) handle a rejected `complete()`:
  the turn ends in a clean, reported failure — **never** an unhandled rejection, never a silent swallow.
- T1.4 — **Happy path byte-for-byte:** a normal exec that returns `submit_exec_result` behaves exactly as today;
  `ApiCompleter` untouched. Proven by the existing mcp + API suites staying green.
- T1.5 — Deterministic mocked-transport tests for T1.1/T1.2 (no live calls): inject "no result" → assert
  timeout-reject; inject mid-exec disconnect → assert disconnect-reject; assert no listener leak.

**M08-T2**
- T2.1 — On a 1006 drop with an in-flight exec turn, after reconnect within the window the exec turn is
  **re-delivered** to the harness (D2), using the full-resend prompt (`markSessionStale` path).
- T2.2 — If the reconnect window expires with the exec still in flight, `complete()` rejects cleanly (T1 path) —
  the turn fails, the agent goes to its existing terminal state (`registry.ts:725`), no hang.
- T2.3 — Deterministic test simulating drop-mid-exec + reconnect-in-window → re-delivery → completion; and
  drop + window-expiry → clean rejection. Mocked transport; no live calls.
- T2.4 — **(live, recorded — BLOCKED-deferrable)** reproduce the original IMP-T3b-1 scenario (SIGKILL + relaunch
  mid-exec) and show the turn now completes or fails cleanly, not hangs. If quota/env blocks it → BLOCKED ⛔,
  deferrable to backlog with a reopen condition, since T2.3 proves it deterministically (§3c).

**M08-T3**
- T3.1 — A worker exec that rejects/crashes mid-exec (via T1) is diverted in the worker path **before** it
  bubbles to a generic agent `error`, into `pauseTaskForOperator(reason)` → `task.status='awaiting_operator'`,
  transcript line recorded (reason + "effects may be partial"), task/team emitted; **no member is shut down, no
  auto-retry, no silent completion.**
- T3.2 — **M03 Shared-Fate kill path unchanged for all non-worker-exec failures** — `handleAgentFailure`
  (planner error, idle timeout, etc.) behaves byte-for-byte; proven by the existing M03 regression tests staying
  green. The fence is a **narrow diversion of the worker-exec-crash case only.**
- T3.3 — **Consensus/coordinator phase logic untouched** — `team-coordinator.ts` consensus/phase enforcement
  unchanged (only the additive `awaiting_operator` status + `pauseTaskForOperator`/abort added); consensus suite green.
- T3.4 — An explicit operator **abort** path performs a clean teardown from `awaiting_operator` (task can't get
  permanently stuck). *(Retry/salvage of partial output deferred — not M08.)*
- T3.5 — Deterministic test (worker exec rejected → `awaiting_operator`, no member shutdown; then abort →
  clean teardown), **mocking `execSync`/`existsSync`** so no `/tmp/agentalk-task-*` worktree or `task-*` branch is
  created (LB-9).

**M08-T4**
- T4.1 — A test asserts provider-less `createAgent` → `/start` returns the error status (not 200, not a crash).

**Cross-cutting DoD (all tasks):** `tsc -b` clean + full vitest suite green **committed**; **0 repo pollution**
(`git worktree list` / `git branch` clean after any run — LB-9); M05/M06 + API + planner happy paths unchanged;
harness untouched (unless a v5 contract bump is explicitly approved for T2).

## 5. Design calls (D1/D2 accepted by Fausto 2026-06-22; D3 recommended — confirm)

- **D1 — T1 timeout source. ✅ ACCEPTED.** The completer gets its **own** guard timer that rejects: use
  `opts.timeoutMs` when present (worker = 600 s), else a **120 s default** (configurable) for un-timed (planner)
  exec turns.
- **D2 — T2 reconnect behavior. ✅ ACCEPTED: re-deliver.** Within the 30 s window the in-flight exec turn is
  **re-delivered** (matches M07 R2; the brain holds full history and `markSessionStale` makes the re-delivered
  prompt a full resend); **reject-and-fail (T1)** is the window-expiry fallback. *(If re-delivery turns out to
  need a harness-side ack, that's a v5 wire-contract bump — a separate decision; flag, don't sneak it in.)*
- **D3 — T3 stop-and-ask mechanism. ✅ ACCEPTED (Fausto 2026-06-22).** A **new, additive task status
  `awaiting_operator`**, reached **only** on the worker-exec-failure route — intercepted in the worker path
  (`handleTeamWorkAssign`) *before* the rejection bubbles to a generic agent `error`. A coordinator method
  `pauseTaskForOperator(reason)` sets `task.status='awaiting_operator'`, records a transcript line (reason +
  "effects may be partial"), emits to the UI, and **terminates nobody / deletes nothing.**
  - **Narrow override, not a rewrite of M03.** Only the worker-exec-crash case diverts to pause; the existing
    `handleAgentFailure` Shared-Fate kill path (`team-coordinator.ts:1458`) stays **byte-for-byte** for every
    other case (planner error, idle timeout). This narrow diversion *is* T3's behavior change — nothing else.
  - **New status, not overloaded `interrupted`.** `interrupted` already means "team died, members shut down,
    task gone" (terminal kill) — the opposite of paused-and-recoverable. A distinct status keeps both clean.
  - **Task-level freeze; kill no one (the "peer planner" answer).** At worker-exec time the task is
    post-consensus and the planners are idle — **no peer-planner turn is in flight to halt.** Pausing the task
    idles everyone via the scheduler **without** `requestAgentShutdown` on the planners; we deliberately don't
    tear down their sessions, so the operator can inspect/resume. The peer planner is halted only *passively*.
  - **Bounding T3:** delivers (a) the `awaiting_operator` state + surfacing and (b) an explicit operator
    **abort** path (clean teardown so a task can't get stuck forever). **Retry / salvage of partial worktree
    output is deferred** (needs worker-output collection, FIND-T3b2-1 territory — not M08).

## 6. Testing principle (binding for M08)

M08 is the **deterministic** milestone — that is its whole reason for going first. Every DoD bar is a
**deterministic, mocked test** (inject the timeout / disconnect / crash, assert clean failure). Live runs are
**recorded observations only**, never a flaky pass/fail gate (the M07 lesson, logbook). **Mock
`execSync`/`existsSync` on any worker-path test (LB-9)** or it pollutes the repo with worktrees/branches —
check `git worktree list` + `git branch` after.

## 7. Explicitly NOT in M08

- **All consensus/protocol robustness** — illegal-transition tolerance, turn-budget/referee, the affordance
  skill+scoped-toolset spike. That is **M09** (spike-led, opens after M08). M08 must not pre-empt it.
- **Cross-provider consensus, auto-handoff, the deferred T2.4 live re-run** — deferred at the M08 backlog gate.
- **Worker-prompt nested-worktree cleanup (FIND-T3b2-1)** — only absorbed into M08-T3 *if* the fence work
  reopens the worker prompt; otherwise stays parked (it's a behavior change needing its own spec).

## 8. Implementer assignment (DECIDED — Fausto, 2026-06-22)

Serial throughout (resource interim rule — no parallel actors).

**Budget override (Fausto, 2026-06-22):** agy/Gemini is **effectively exhausted for the weekly window**
(meter `antigravity` 95% weekly, confirmed by Fausto's independent measure). So **Claude takes the implementer
role for ALL M08 tasks until Gemini's weekly window refills** — at which point T1/T4-style contained work can
revert to Gemini. T2/T3 were always Claude's (sensitive engine). The original split is kept below for when
Gemini is available again.

| Order | Task | Implementer (now) | Verifier (fills verdict by running) | When agy refills |
|---|---|---|---|---|
| 1 | **T1** completer-reject (foundation — T2/T3 depend on it) | **Claude** | **Fausto is the gate; Claude self-runs + reports honest output** | → Gemini |
| 2 | **T4** no-driver test (hygiene) | **Claude** | **Fausto is the gate; Claude self-runs** | → Gemini |
| 3 | **T2** registry reconnect re-delivery | **Claude** (impl role) | **Fausto is the gate** (Gemini runs the suite when back) | stays Claude |
| 4 | **T3** worker fence / M03 narrow diversion | **Claude** (impl role) | **Fausto is the human gate** (T3.2/T3.3 regression tests are the structural backstop) | stays Claude |

**Honesty note (the lost circuit breaker):** with Gemini out, there is **no independent agent verifier** —
Claude implements *and* runs. The independent run-it check (the method's circuit breaker) is therefore **carried
by Fausto as the human gate** plus the deterministic regression bars (T1.4, T3.2/T3.3) that pin
behaviour-preservation. Claude reports **actual command output**, never a remembered/optimistic summary
(Honesty-over-Results).

**Gate-policy amendment (Fausto, 2026-06-22 — degraded-workflow relaxation; see LB-14):** the human gate exists
for **independence**, not determinism. Since Gemini cannot function, Fausto **delegates the full deterministic
gate to Claude** (run tsc/vitest + self-review the diff for scope/behaviour-preservation + merge on green),
reporting actual output; Fausto retains a cheap re-run audit. This knowingly relaxes the circuit breaker above
and **reverts to an independent runner/reviewer once agy's weekly window refills.** Live bars (e.g. T2.4) stay
deferred/human-gated. T1 was gated hands-on by Fausto (pre-amendment); T2 onward use the delegated gate.

## 9. Status log

- 2026-06-22 — **M08 opened (architect: Claude).** Backlog gate run (recorded in `backlog.md`): failure-modes
  M08 portion promoted here, IP-4 absorbed → T4, the rest deferred. Plan drafted from the three confirmed code
  gaps (G1 `completer.ts:46` no-reject, G2 `registry.ts:712` reconnect gap / IMP-T3b-1, G3
  `in-process-driver.ts:225` no fence / D4).
- 2026-06-22 — **D1 + D2 accepted (Fausto); D3 recommended.** D1 = 120 s default completer timeout (configurable),
  use `opts.timeoutMs` when present. D2 = re-deliver in-window, reject on window-expiry. D3 (architect rec, grounded
  in `team-coordinator.ts:1458` Shared-Fate) = new additive `awaiting_operator` status via a narrow worker-exec-crash
  diversion (terminates nobody, kill path otherwise unchanged) + operator abort; retry/salvage deferred. **Still
  DRAFT — awaiting D3 confirmation + scope sign-off, then the `-implementation.md` ledger is created and T1 is batoned.**
