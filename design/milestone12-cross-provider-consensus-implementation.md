# M12 — Cross-Provider Consensus — Implementation Breakdown

> **Status:** Planner breakdown — ready for Reviewer gate 1.
> **Plan:** `design/milestone12-cross-provider-consensus-plan.md`
> **Base:** `master` at `edc6a3b` (2026-07-01).
> **Planner:** Codex. **Architect:** Claude. **PO:** Fausto.

This is the task-level handoff for M12. It starts with **M12-T2** because the timeout coupling should be fixed
before the live harness is added.

## Sequencing

Execution order:

1. **M12-T2** — Fix C1: fact-collection timeout is member-provider-aware.
2. **M12-T1** — Add the cross-provider live harness.
3. **M12-T3** — Add deterministic provider-mix invariance coverage.
4. **M12-PF** — Run a cheap Codex MCP parse/attach preflight.
5. **M12-T4** — Run and record capped live mixed-provider observations.
6. **M12-T5** — Close docs, backlog, telemetry, and calibration.

Hard rule for all implementation tasks: no opportunistic protocol, parser, MCP tool-surface, or client-repo changes.
If a live or deterministic check exposes a broader problem, report it as a finding and stop for a scope decision.

## Reviewer Gate 1 — verdict: **APPROVED WITH ONE REQUIRED CLARIFICATION**

**Reviewer:** Claude (reviewer seat). **Date:** 2026-07-01. **Verified against:** `master` @ `c009072`
(confirmed docs-only vs `edc6a3b`, so cited line numbers still hold). **Method:** read every cited code range
fresh (Reviewer Rule 1); did **not** re-bless the Architect plan's findings (independence — I authored that
plan). Deterministic/full-suite runs are the *implementer's* gate-2 evidence, not gate 1.

**Code-citation audit — all ACCURATE ✅** (read at HEAD):
- `team-coordinator.ts:168` `createTeam(members, provider?)` ✓; `Team` has `provider?` + `members`
  (`contracts/src/types.ts:29-30`) ✓; optional-legacy-`provider` behavior preservable ✓.
- Timeout branch at **1019-1021** exactly as the spec says to replace ✓;
  `DEFAULT_GEMINI_FACT_COLLECTION_TIMEOUT_MS = 720_000` (line 79) ✓ — matches the test's expected `720_000`;
  base `DEFAULT_FACT_COLLECTION_TIMEOUT_MS = 480_000` (line 78) ✓.
- `TeamCoordinatorDeps.getAgent: (id) => Agent` (line 29) ✓ — the `deps.getAgent(member.agentId)` helper shape
  is viable. Agent carries both `providerName` and `provider`, so inspecting both for `'gemini'` correctly
  covers MCP (`providerName:'gemini'`) **and** legacy in-process (`provider:'gemini'`).
- Test citations `team-mcp-consensus.test.ts` 1-31 (hermetic `child_process`/`fs` mocks) ✓, 33-46 (mixed
  create + `createTeam(members)`) ✓, 96-104 (mocked `await_turn`/`submit_exec_result` loop) ✓.

**Scope fences / retry budgets — SOUND ✅.** Out-of-scope table (types, registry, agents/*, wire-contract,
scripts, client repo) is correct and comprehensive; the "no opportunistic protocol/parser/tool-surface/client
change" hard rule matches the plan's show-stopper fences. Per-check pre-registered retry budgets satisfy
Implementer Rule 7. Claim/verdict ledger is well-formed.

**REQUIRED CLARIFICATION — F-G1-1 (must fix before T2 implementation starts):**
> **T2-C4 ("Existing all-Gemini / legacy provider behavior is preserved") is self-contradictory with the fix's
> intended effect.** Ground truth I verified: **no caller anywhere passes a `provider` arg to `createTeam`** —
> not the live gate, not `scenario-runner.ts:108`, not any test (grep clean; both callers use
> `createTeam(members)`). So `team.provider` is **always `undefined`** today and the `=== 'gemini'` branch is
> **effectively dead** — every team, including the all-Gemini MCP live gate and the mocked consensus test,
> currently gets the **base 480_000** window, *not* 720_000. After T2, an all-Gemini MCP team
> (`providerName:'gemini'`) will **correctly** get 720_000 — a real, intended, PO-approved behavior change to
> the existing all-Gemini path. But T2-C4 as worded tells the implementer that path is "preserved," which is
> false for the (dominant) providerName route. **Fix:** split T2-C4 into (a) *legacy explicit
> `createTeam(members,'gemini')` still yields 720_000 — unchanged*, and (b) *all-Gemini-via-`providerName` MCP
> team now yields 720_000 (was 480_000) — deliberate C1 fix, safe because a longer force-advance window is
> strictly more lenient*. **Add a regression case** pinning all-Gemini-MCP (`providerName`, no `team.provider`)
> → 720_000, alongside the existing mixed-team case. This is a **DoD-wording precision fix, not an
> architecture change** — the epic is not blocked.

**MINOR — F-G1-2 (advisory):** `deps.getAgent` returns a non-optional `Agent` and may throw for an unknown id.
Members exist during fact-collection start, so risk is low, but the helper should degrade gracefully (skip a
member it can't resolve rather than throw and break fact-collection scheduling). Implementer's call; note it.

**Disposition:** gate 1 **passes** — the breakdown is sound, citations exact, fences correct. Proceeding to T2
implementation is authorized **once F-G1-1 is folded into the T2 DoD** (Planner/implementer edit; no re-review
needed for the wording fix — I'll confirm the added regression case at gate 2). F-G1-2 is advisory.

**Telemetry (gate 1):** budget claude weekly 3% (fresh, resets Jul 8), codex weekly 40%; gate = read-only
code-citation verification, no suite run (correct for gate 1). Outcome: **APPROVED-W/-CLARIFICATION**.

## Reviewer Gate 2 — M12-T2 — verdict: **VERIFIED ✅** (on branch; pending merge authorization)

**Reviewer:** Claude (reviewer seat). **Date:** 2026-07-01. **Branch:** `m12-t2-fact-collection-timeout`
@ `c3f312e` (code at `3b1585f`). **Method:** verify-by-running (Reviewer Rule 1); every bar below was
executed by me on the branch, not taken from the implementer's claim.

**Evidence I ran (branch):**
- Targeted regression: `npx vitest run …/team-fact-collection-timeout.test.ts` → **4/4 passed** (53ms).
- Typecheck: `npx tsc -b` → **exit 0, clean**.
- Full suite: `npm test` → **45 files, 254/254 passed** (8.2s).
- Scope: `git diff --name-only master...branch` → **3 files** — `team-coordinator.ts`,
  `team-fact-collection-timeout.test.ts` (both in-scope), + this ledger (docs, expected). **No out-of-scope
  file** (no `registry.ts` / `types.ts` / `agents/*` / `wire-contract.json` / `scripts/*` / client repo).
- `git status --short --branch` → clean working tree; `git worktree list --porcelain` → **no pollution**
  (single main worktree).

**Code read (verified against the diff):**
- `getFactCollectionTimeoutMs(team)` helper at `team-coordinator.ts:974-993`: starts at base, preserves the
  legacy `team.provider === 'gemini'` hint, iterates `team.members` via `deps.getAgent`, checks **both**
  `providerName` and `provider` for `'gemini'`, returns the **max**. Matches the spec's member-aware shape.
- Call site correctly replaced at **:1040** (`const timeoutMs = this.getFactCollectionTimeoutMs(team);`); the
  old inline branch is gone (the only remaining `=== 'gemini'` is the legacy check inside the helper).
- **F-G1-2 (my gate-1 advisory) was addressed**: the member loop wraps `deps.getAgent` in try/catch and
  `logError`s — degrades gracefully instead of throwing on an unresolvable member. 

**Per-claim verdicts:**
| Claim | Verdict | Evidence |
|---|---|---|
| T2-C1 (member-aware + legacy preserved) | **VERIFIED ✅** | helper :974-993, call site :1040 — read the diff. |
| T2-C2 (mixed Gemini+Codex, no team.provider → 720k) | **VERIFIED ✅** | test 1 passes; fires at 720k not 480k. |
| T2-C3 (non-Gemini → base 480k) | **VERIFIED ✅** | test 2 passes; fires at 480k. |
| T2-C4 (all-Gemini + legacy preserved) | **VERIFIED ✅** | test 4 (legacy explicit → 720k) **and** test 3 (all-Gemini-MCP `providerName`, no `team.provider` → 720k) both pass. **Test 3 is the F-G1-1 regression case I required at gate 1 — present and green.** |
| T2-C5 (no out-of-scope files) | **VERIFIED ✅** | `git diff --name-only` — 3 files, all in scope. |
| T2-C6 (tsc + suite clean) | **VERIFIED ✅** | tsc exit 0; 254/254. |

**F-G1-1 disposition:** **substantively CLOSED.** The required all-Gemini-MCP→720k regression (test 3) exists
and passes, so the behavior the split was meant to protect is pinned. The T2-C4 *wording* was not literally
split, but with test 3 + test 4 both green the DoD is no longer ambiguous in effect. No re-work needed.

**Corrections to prior ledger claims (Reviewer Rule 5):**
- The implementer's row said **"Merged in `3b1585f`"** — **false**: `git branch --merged master` shows the
  branch is **NOT** merged; `3b1585f` is a branch-only commit. Corrected in the table below. (Pre-declaring a
  merge that hasn't happened is a claim-vs-ground-truth slip; noting it, not penalizing — the code is sound.)
- T2-C1 evidence cited "line 1021" for the replaced call site; the actual replaced line is **:1040** (the
  helper was inserted above it). Minor; the change itself is correct.

**Disposition:** all six DoD rows **VERIFIED** by my own runs; scope clean; no pollution; F-G1-1 satisfied.
**Recommend MERGE to master.** Per the merge-is-human-gated rule (Origin Tag Protocol) and this baton (which
asked for a *verdict*, not a merge), I am **not** merging unilaterally — awaiting explicit PO/[Human]
authorization to merge the branch.

**Telemetry (gate 2):** budget claude weekly ~4%, codex weekly 40%; gate = ran targeted test + tsc + full
suite + scope/worktree audit. Outcome: **VERIFIED ✅ (pending merge auth)**.

## Claim / Verdict Ledger

The implementer records **Claim** entries with command output. The reviewer records **Verdict** only after running
the relevant check.

| Task | Implementer claim | Reviewer verdict | Evidence |
|---|---|---|---|
| M12-T2 | implemented ✅ | **gate 2 VERIFIED ✅** (branch; pending merge auth) | Verified on branch `m12-t2-fact-collection-timeout` @ `c3f312e` (code `3b1585f`) — NOT yet merged to master. See "Reviewer Gate 2" section: 4/4 targeted, tsc 0, 254/254, scope clean, F-G1-1 (test 3) satisfied. |
| M12-T1 | implemented ✅ | not-checked | Script `test-live-cross-provider.mjs` implemented. |
| M12-T3 | not-started | not-checked | Pending T1. |
| M12-PF | not-started | not-checked | Pending T3. |
| M12-T4 | not-started | not-checked | Pending PF. |
| M12-T5 | not-started | not-checked | Pending T4. |

## M12-T2 — Member-Provider-Aware Fact-Collection Timeout

### Intent

Fix C1 from the plan: the current fact-collection timeout uses a team-level provider field, so a mixed MCP team
created with `createTeam(members)` does not get Gemini's extended window even when one planner is Gemini.

The fix must compute the timeout as:

```ts
max(this.factCollectionTimeoutMs, ...per-member required minimums)
```

Today the only special per-provider minimum is Gemini's `DEFAULT_GEMINI_FACT_COLLECTION_TIMEOUT_MS`. Codex and other
providers currently require the base `this.factCollectionTimeoutMs`; do not invent a Codex-specific duration in this
task. Make the implementation extensible enough that adding one later is local.

### Exact Source Scope

Allowed runtime file:

| File | Lines at `edc6a3b` | Scope |
|---|---:|---|
| `packages/runtime-core/src/registry/team-coordinator.ts` | 28-61 | Read existing `TeamCoordinatorDeps.getAgent`; use it to inspect member agents. No dependency shape change expected. |
| `packages/runtime-core/src/registry/team-coordinator.ts` | 72-80 | Read timeout constants. Add only a tiny provider-minimum helper/table here if needed. |
| `packages/runtime-core/src/registry/team-coordinator.ts` | 130-165 | Read coordinator fields/constructor. Do not add new constructor options unless absolutely required. |
| `packages/runtime-core/src/registry/team-coordinator.ts` | 168-190 | Read `createTeam`; preserve the optional legacy `team.provider` behavior. |
| `packages/runtime-core/src/registry/team-coordinator.ts` | 1018-1024 | Replace the direct `team.provider === 'gemini'` timeout branch with the member-aware helper result. |

Allowed test file:

| File | Lines at `edc6a3b` | Scope |
|---|---:|---|
| `packages/runtime-core/src/registry/__tests__/team-mcp-consensus.test.ts` | 1-31 | Reuse existing hermetic mocks/setup style if adding the regression here. |
| `packages/runtime-core/src/registry/__tests__/team-mcp-consensus.test.ts` | 33-46 | Reuse mixed/team creation pattern; convert only in the new regression, not the existing test. |
| `packages/runtime-core/src/registry/__tests__/team-mcp-consensus.test.ts` | 96-104 | Reuse mocked MCP turn flow only if needed. Prefer a narrower fake-timer test. |

Alternative allowed test file:

| File | Scope |
|---|---|
| `packages/runtime-core/src/registry/__tests__/team-fact-collection-timeout.test.ts` | Create this file if the regression is cleaner as a focused fake-timer test. Use the same `child_process` and `fs.existsSync` mocks as the existing MCP consensus tests to preserve hermeticity. |

Out of scope for T2:

| File / area | Reason |
|---|---|
| `packages/contracts/src/types.ts` | No contract shape change is needed. |
| `packages/runtime-core/src/registry/registry.ts` | Provider-blind routing is not part of C1. |
| `packages/runtime-core/src/agents/*` | Parser/completer behavior is not part of C1. |
| `packages/contracts/wire-contract.json` | MCP wire contract must remain unchanged. |
| `scripts/*` | Harness work is T1/PF/T4, not T2. |
| `../agentalk-mcp-client/*` | Client changes are explicitly cross-repo findings, not T2. |

### Implementation Shape

Recommended minimal shape:

1. Add a private helper near the timeout constants or inside `TeamCoordinator`:

   ```ts
   private getFactCollectionTimeoutMs(team: Team): number
   ```

2. The helper should:
   - Start with `this.factCollectionTimeoutMs`.
   - Include `team.provider` as a legacy team-level hint, preserving all prior all-Gemini behavior.
   - For each `team.members` entry, call `this.deps.getAgent(member.agentId)` and inspect both:
     - `agent.providerName` for MCP-backed external model identity (`'gemini'`, `'codex'`, `'claude'`).
     - `agent.provider` for direct legacy provider identity (`'gemini'`, `'codex'`, `'claude'`).
   - Map provider identity to a required minimum:
     - `gemini` -> `DEFAULT_GEMINI_FACT_COLLECTION_TIMEOUT_MS`.
     - all other current providers -> `this.factCollectionTimeoutMs`.
   - Return the maximum.

3. Replace lines 1019-1021 with:

   ```ts
   const timeoutMs = this.getFactCollectionTimeoutMs(team);
   ```

Do not change phase transitions, protocol correction behavior, parser behavior, team creation, or member validation.

### Required Regression Coverage

Use fake timers or a `setTimeout` spy so the test observes the scheduled delay without waiting real minutes.

Minimum assertions:

| Case | Setup | Expected scheduled timeout |
|---|---|---|
| Mixed MCP Gemini+Codex team, no `team.provider` | `planner-a` has `{ provider: 'mcp', providerName: 'gemini' }`; `planner-b` has `{ provider: 'mcp', providerName: 'codex' }`; `createTeam(members)` with no provider arg. | `720_000` (or `max(customBase, 720_000)` if the test sets a custom base). |
| All non-Gemini mixed MCP team, no `team.provider` | e.g. Codex+Claude planners, Gemini absent. | Base `factCollectionTimeoutMs`. |
| Legacy team-provider Gemini | `createTeam(members, 'gemini')`, even if member metadata is absent or generic. | Gemini extended timeout, preserving old behavior. |

Optional but useful:

| Case | Setup | Expected scheduled timeout |
|---|---|---|
| Custom base above Gemini default | Registry/coordinator configured with `factCollectionTimeoutMs > 720_000`, with a Gemini member. | Custom base, proving the helper uses max rather than hard-coding Gemini. |

If reaching `TeamCoordinator` options through `Registry` is awkward, instantiate `TeamCoordinator` directly in the
focused test with a minimal `deps` object. If direct construction is too coupled, use `Registry` and spy on global
`setTimeout`.

### DoD Claim Rows for M12-T2

The implementer must fill these rows in the claim section when handing off:

| Claim ID | Claim | Required evidence |
|---|---|---|
| T2-C1 | Timeout selection is member-provider-aware and preserves legacy `team.provider` behavior. | Helper added at `team-coordinator.ts:971-997`; inline branch replaced at line 1021. |
| T2-C2 | Mixed MCP Gemini+Codex team with no `team.provider` schedules the Gemini extended timeout. | Reg. test 'schedules the Gemini extended timeout for a mixed MCP team' passes. |
| T2-C3 | Non-Gemini teams keep the base timeout. | Reg. test 'keeps the base timeout for non-Gemini mixed MCP teams' passes. |
| T2-C4 | Existing all-Gemini / legacy provider behavior is preserved. | Reg. test 'preserves legacy explicit team-level provider behavior' passes. |
| T2-C5 | No out-of-scope files changed. | `git diff --stat` shows only `team-coordinator.ts` and `team-fact-collection-timeout.test.ts`. |
| T2-C6 | Typecheck and full suite are clean, or failure is honestly reported. | `tsc -b` clean. `npm test` passed (254 tests). |

### Retry Budgets for M12-T2

The implementer must pre-register attempts before running each check and stop at the limit.

| Check | Command | Max attempts | Stop condition |
|---|---|---:|---|
| Targeted T2 regression | `npx vitest run packages/runtime-core/src/registry/__tests__/<chosen-test-file>` | 3 | If failing after attempt 3, stop and report the exact failing assertion/output. |
| Typecheck | `npx tsc -b` | 2 | If failing after attempt 2, stop unless the fix is strictly within T2 source scope. |
| Full suite | `npm test` | 2 | If failing after attempt 2, stop and report whether failure is related to T2. |
| Diff scope audit | `git diff --stat && git diff --name-only` | 1 | If any out-of-scope file appears, revert only the implementer's out-of-scope change or stop for guidance if uncertain. |

No live LLM commands are part of T2.

## Later Task Skeletons

### M12-T1 — Cross-Provider Live Harness

Scope:

| File | Scope |
|---|---|
| `scripts/test-live-cross-provider.mjs` | New script forked from `scripts/test-live-gate.mjs`, with `PLANNER_A_PROVIDER`, `PLANNER_B_PROVIDER`, and `WORKER_PROVIDER` env overrides. |
| `scripts/test-live-gate.mjs` | Read-only baseline unless the reviewer explicitly approves a shared helper extraction. |

DoD:

| Claim ID | Claim | Required evidence |
|---|---|---|
| T1-C1 | Script creates three MCP agents with per-agent providerName values | Implemented in `scripts/test-live-cross-provider.mjs`, dynamically resolving to `gemini`/`codex`/`gemini` using env overrides. |
| T1-C2 | Script launches each external agent with matching `llm-agent.mjs --provider` | Implemented in `scripts/test-live-cross-provider.mjs`. Spawns use matching `--provider` and proper `AGENTTALK_AGENT_ID` environment variables for executor initialization. Script dry runs structurally correctly. |
| T1-C3 | Existing all-Gemini gate unchanged (no edits to `test-live-gate.mjs`) | Verified: `test-live-gate.mjs` was kept entirely unmodified. |

Retry budgets:

| Check | Max attempts |
|---|---:|
| `npx tsc -b` | 2 |
| structural script run, if designed with a no-live mode | 2 |
| `git diff --stat && git diff --name-only` | 1 |

### M12-T3 — Provider-Mix Invariance Test

Scope:

| File | Scope |
|---|---|
| `packages/runtime-core/src/registry/__tests__/team-mcp-consensus.test.ts` or new focused test | Add deterministic coverage that mixed `providerName` metadata does not change `await_turn` routing or `consensus_respond` dispatch. |
| `packages/runtime-core/src/registry/registry.ts` | Read-only unless the test exposes a real T3 regression and Reviewer/PO authorize a fix. |

DoD:

| Claim ID | Claim | Required evidence |
|---|---|---|
| T3-C1 | Mixed provider metadata still uses exec-turn routing. | Test assertion. |
| T3-C2 | `consensus_respond` dispatch remains action-based, not provider-based. | Test assertion. |
| T3-C3 | Full suite and typecheck clean. | Exact command output. |

Retry budgets:

| Check | Max attempts |
|---|---:|
| Targeted T3 Vitest | 3 |
| `npx tsc -b` | 2 |
| `npm test` | 2 |

### M12-PF — Codex MCP Preflight

Scope:

| File | Scope |
|---|---|
| No production file required by default. | Prefer running an existing or T1-created one-agent preflight. If a script is needed, spec it separately before adding it. |

DoD:

| Claim ID | Claim | Required evidence |
|---|---|---|
| PF-C1 | One Codex MCP agent attaches and completes one structured turn. | Command, transcript/log excerpt, usage before/after. |
| PF-C2 | Any parse failure is classified as Layer 1 client cleanup or Layer 2 AgentTalk structured parse. | Exact error/output and file boundary. |

Retry budgets:

| Check | Max attempts |
|---|---:|
| Single-agent Codex MCP preflight | 2 |
| Usage meter read before/after | 1 each, best-effort |

### M12-T4 — Recorded Live Mixed-Provider Run

Scope:

| File | Scope |
|---|---|
| `scripts/test-live-cross-provider.mjs` | Execute only; do not edit during T4 unless a separate scope decision is made. |
| `design/milestone12-cross-provider-consensus-implementation.md` | Record transcript summary, attempts, usage, and outcome. |

DoD:

| Claim ID | Claim | Required evidence |
|---|---|---|
| T4-C1 | PF was run before full live consensus. | PF evidence link/section. |
| T4-C2 | Up to 4 live attempts were run or intentionally stopped earlier for budget/blocker. | Attempt log with commands and outcomes. |
| T4-C3 | Clean completion, or honest partial with follow-on finding. | Transcript summary and classification. |

Retry budgets:

| Check | Max attempts |
|---|---:|
| Full Gemini+Codex live round | 4 total across the epic |
| Usage meter read before/after live window | 1 each, best-effort |

### M12-T5 — Docs / Close

Scope:

| File | Scope |
|---|---|
| `design/milestone12-cross-provider-consensus-implementation.md` | Final claim/verdict rows, telemetry blocks, live observations. |
| `design/backlog.md` | Close/disposition the deferred cross-provider consensus item. |
| `design/logbook.md` | Add LB-11-style calibration entry for cross-provider work. |
| `design/session-primers/*` and `design/lessons/*` | Only if this is a session-close handoff. |

DoD:

| Claim ID | Claim | Required evidence |
|---|---|---|
| T5-C1 | Backlog item dispositioned. | Diff reference. |
| T5-C2 | Telemetry recorded where available. | Ledger section. |
| T5-C3 | Final suite/typecheck state recorded. | Exact command output or reason unavailable. |

Retry budgets:

| Check | Max attempts |
|---|---:|
| Docs consistency grep for stale M12 status | 2 |
| `git diff --stat && git diff --name-only` | 1 |

