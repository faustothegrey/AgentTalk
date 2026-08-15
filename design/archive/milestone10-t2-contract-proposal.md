# M10-T2 — Graded loop: contract-change proposal (for approval BEFORE any code)

> Per CLAUDE.md (tests are behaviour contracts) + Rules of Engagement: this surfaces the **exact before→after**
> of every *tested* contract T2 would change, for explicit sign-off, **before** touching code or tests.
> Decisions D1 (fail-soft eject) / D2 (retry N=2) / D3 (T1+T2 = v1) are already settled; T1 (`ejectPlanner`)
> is implemented + pushed on `m10-t1-eject-planner`.

## 1. What T2 does (one sentence)

At the **single validation site** `validateProtocolStep` (`team-coordinator.ts:1832`), replace *"illegal
`message_type` → dual-kill both planners"* with *"illegal move → correct + retry (bounded N=2) → **eject the
offender** (T1), peer + round survive."*

## 2. 🔑 Key finding — the blast radius is MUCH smaller than the Phase-2 plan assumed

The Phase-2 plan listed four test files as dual-kill contracts. On inspection, **only ONE file actually encodes
the *illegal-move* dual-kill that T2 changes.** The rest are *different* dual-kill triggers that T2 does **not**
touch:

| Path / trigger | Method | T2 touches it? |
|---|---|---|
| **Illegal `message_type` (out of expected set)** | `validateProtocolStep → interruptPlanningForRegression` | ✅ **YES — this is T2** |
| Agent enters `error` state (crash/idle) | `handleAgentFailure` (`:1482`) | ❌ No — a crashed agent can't be "retried" |
| Watchdog/urgency timeouts (no submit_plan, ignored urgency) | `armPlanningWatchdog` / `armSubmitPlanUrgencyWatchdog` | ❌ No — timeout, not an illegal move |
| Agreement-fallback exhausted (3rd missed acceptance) | `handleAgreementReachedFallbackToDiscussion` (`:806`) | ⚠️ **Decision — see §5** |
| Phase guards (`agreement_proposal` before discussion, etc.) | synchronous `throw new Error` (`:514/:590`) | ⚠️ **Decision — see §5** |

**Consequence for the named test files:**
- `agent-failure-impact.test.ts` — tests **agent-failure** dual-kill (+ my T1 test). **UNCHANGED by T2.**
- `team-api-consensus.test.ts` / `team-mcp-consensus.test.ts` — test only the **happy path** to completion. They
  assert **no** dual-kill. **UNCHANGED by T2** (must stay green; no contract rewrite).
- **`team-coordinator.test.ts` — the ONLY file with illegal-move dual-kill contracts to rewrite** (2 tests; see §3).

## 3. The contracts that CHANGE (exact before→after)

Both live in `apps/orchestrator/src/__tests__/team-coordinator.test.ts`.

### C1 — `should reject submit_plan before agreement in multi-planner flow` (line 819)

A forward illegal move (`submit_plan` before agreement). **Today: immediate dual-kill, NO retry.**

- **BEFORE (asserts dual-kill):**
  ```
  expect(currentTaskId).toBeUndefined();                       // team.currentTaskId deleted
  expect(latestTask.status).toBe('interrupted');               // task killed
  expect(latestTask.transcript.at(-1)?.payload).toContain('Protocol regression');
  ```
- **AFTER (asserts graded loop → eject):** first illegal `submit_plan` → a **correction** is sent (restating the
  legal set) and planning stays alive; only after the **N=2** budget is exhausted → **eject** the offender:
  ```
  // 1st + 2nd illegal submit_plan: correction sent, planning still alive
  expect(coordinator.getTeam(team.id).currentTaskId).toBeDefined();
  // 3rd: budget exhausted → eject (fail-soft, NOT dual-kill)
  expect(latestTask.status).toBe('awaiting_operator');         // frozen for operator, not 'interrupted'
  expect(latestTask.transcript.some(e => e.payload.includes('ejected'))).toBe(true);
  // peer planner-b kept alive (not removed)
  ```
  *(Title would become e.g. "corrects submit_plan before agreement, then ejects on repeated violation".)*

### C2 — `should ask for regression confirmation twice then interrupt planning on confirmed regression` (line 877)

A regression (`agreement_proposal` after agreement reached). **Today: 2 confirmation asks, then dual-kill.** The
**retry half stays identical**; only the **terminal action** flips.

- **BEFORE (terminal = dual-kill):**
  ```
  // (attempts 1 & 2 unchanged: 'confirmation attempt 1/2', '2/2', planning stays alive)
  expect(coordinator.getTeam(team.id).currentTaskId).toBeUndefined();   // 3rd → both killed
  const interruptCalls = ...includes('Protocol regression');
  expect(interruptCalls.length).toBeGreaterThanOrEqual(1);
  ```
- **AFTER (terminal = eject):** attempts 1 & 2 **byte-identical** (`confirmation attempt 1/2`, `2/2`, planning
  alive); on the 3rd:
  ```
  expect(latestTask.status).toBe('awaiting_operator');         // eject, fail-soft
  expect(latestTask.transcript.some(e => e.payload.includes('ejected'))).toBe(true);
  // peer kept alive
  ```

## 4. Code change (the implementation, for context — only after approval)

- **`validateProtocolStep` (`:1832`)** — generalise the existing regression-retry mechanism to **all** illegal
  moves: on `expected && !expected.includes(actualType)`, send a **correction** (restate the legal set from
  `taskExpectedResponses`), tracked by a per-`(task,agent)` counter bounded by a named const **`N=2`** (mirrors
  `MAX_REGRESSION_RETRIES`, which it effectively absorbs/unifies); on exhaustion call **`ejectPlanner`** (T1)
  instead of `interruptPlanningForRegression`.
- **`interruptPlanningForRegression` (`:1943`)** — its only caller becomes the eject path; the method itself either
  retargets to `ejectPlanner` or is inlined. **Its other consumers (timeouts, agent-failure) are untouched** —
  they keep calling `interruptPlanningForMissingEvents` (the dual-kill stays for genuine failures/timeouts).
- *(Optional, deferred)* extend `parseWithRetry` (`agents/translation.ts`) from malformed-JSON to illegal-move —
  the plan mentioned it, but the brain-side graded loop above already delivers robustness; recommend deferring.

**Untouched:** `interruptPlanningForMissingEvents` body, `handleAgentFailure`, the watchdogs, the wire contract,
the two consensus tests, `agent-failure-impact.test.ts`.

## 5. ⚠️ Decisions — ✅ SETTLED (Fausto, 2026-06-25)

- **D-T2a — Scope of "illegal move": ✅ MINIMAL.** T2 converts **only** the `validateProtocolStep` terminal
  (C1+C2). The **agreement-fallback** terminal (`:806`) and the **phase-guard throws** (`:514/:590`) stay as-is
  for v1 (separate mechanisms; out of T2 scope).
- **D-T2b — Forward illegal moves get the retry too: ✅ YES (unify).** Every illegal move gets correct + retry
  (N=2) then eject — regressions and forward/lateral illegal moves alike. This changes C1 from immediate-kill to
  retry-then-eject; the existing `MAX_REGRESSION_RETRIES` mechanism is generalised to cover all illegal moves.

## 6. Definition of Done (unchanged from plan §6, restated)

Illegal move → bounded correct/retry → eject (not dual-kill); recovery + eject both tested; peer + round survive;
tsc 0 + full suite green with the **approved** rewritten C1/C2; no LB-9 pollution; ledger + telemetry block.
