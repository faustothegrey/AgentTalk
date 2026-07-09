# Milestone 18 - Self-hosting Implementation Ledger

**Status:** In Progress
**Program:** `design/self-hosting-program-draft.md`
**Plan:** `design/milestone18-self-hosting-plan.md`
**PO:** Fausto. **SM:** Claude. **Architect:** Claude. **Planner:** Codex.
**Plan Reviewer:** Claude. **Implementer:** Gemini/agy. **Implementation Reviewer:** Codex.
**Task-end Reviewer:** Claude.

## M18-T1 - BL-015 L0: scope manifest and `scope-check`

**Status:** `done` — merged 2026-07-09 (gate 3 VERIFIED, reviewer doc fix PO-authorized)
**Branch:** `task-M18-T1`

### Coordination Evidence

- **Substrate events recorded:**
  - (Pending T1 deliveries and Gates)
- **Terminal fallback rows:**
  - `2026-07-09` - `planner POV relay` (SM -> Planner) - Pre-T1 coordination (plan inception)
  - `2026-07-09` - `plan baton` (SM -> Planner) - Pre-T1 coordination (plan execution)
  - `2026-07-09` - `Gate-1 result relay` (SM -> Implementer) - Pre-T1 coordination (hand-off to Implementer)
  - `2026-07-09` - `implementer baton` (SM -> Implementer) - T1 starts
  - `2026-07-09` - `gate-2 hand-back` (Implementation Reviewer -> SM -> Implementer) - T1 round 1 refuted
  - `2026-07-09` - `gate-2 redelivery` (Implementer -> SM -> Implementation Reviewer) - T1 round 2 delivery
  - `2026-07-09` - `gate-2 VERIFIED report` (Implementation Reviewer -> SM -> Task-end Reviewer) - T1 round 2 verified
  - `2026-07-09` - `gate-3 refute` (Task-end Reviewer -> SM -> Implementer) - T1 round 1 gate-3 refuted
  - `2026-07-09` - `gate-2 recheck VERIFIED report` (Implementation Reviewer -> SM -> Task-end Reviewer) - T1 recheck after gate-3 refute
- **Relay count:** 9 (3 seeded + 6) — **substrate events recorded: 0** (honest: all T1 coordination ran
  over the terminal; expected while BL-017 is open — the workflow-event path had no attached CLI sender.
  This is T1's baseline the C3 fall is measured against.)
- **Proof pointer:** (Pending recordings)

### Rule 6/7 Declaration (Gemini, 2026-07-09)

**Scope:**
- Define a machine-readable `@scope` manifest syntax next to the task ledger section (defined below).
- Add `scripts/scope-check.mjs` script that parses the active task's manifest from the ledger and compares changed paths against `allowed`, `forbidden`, and `free` globs.
- Document how to run it in the script itself and/or ledger.
- Prove it catches out-of-scope paths and passes in-scope paths.
- **Hard fence:** Zero `runtime-core` production changes. No L1/L2 scope shapes (provider hooks, fenced worktrees, baton-carried manifests).

**Approach:**
1. Use `git diff --name-only origin/master...HEAD` to get the list of changed files in the current task branch.
2. Parse the active task's `@scope` manifest from this ledger file. A simple regex/string parser will extract `allowed`, `forbidden`, and `free` lists.
3. Convert the globs to regular expressions (handling `**` and `*`).
4. For each changed file:
   - If it matches `free`, it's allowed.
   - If it matches `forbidden`, reject immediately.
   - If it matches `allowed`, it's allowed.
   - If it matches neither `free` nor `allowed`, reject it.
5. Exit with 0 if all changed files are in-scope, or 1 if any out-of-scope files are found.

**Per-check Verification Budgets (M18-T1):**
| Check | Max attempts | Current |
|---|---:|---:|
| `scope-check` parser/unit tests | 3 | 0 |
| out-of-scope negative fixture/probe | 3 | 0 |
| in-scope/free-path positive fixture/probe | 3 | 0 |
| documentation/ledger manifest drift check | 2 | 0 |
| `npx tsc -b` | 2 | 0 |
| targeted relevant tests | 2 | 0 |
| full `npm test` | 1 | 0 |
| `node scripts/m14-identity-harness.mjs --check` | 1 | 0 |
| `npm run backlog:check` | 1 | 0 |
| `git diff --check && git diff --cached --check` | 2 | 0 |
| pollution check: `git worktree list` + `git branch --list 'task-*'` | 1 | 0 |

### M18-T1 Scope Manifest

```yaml
@scope:
  allowed:
    - design/milestone18-self-hosting-implementation.md
    - scripts/scope-check.mjs
    - scripts/__tests__/scope-check.test.mjs
    - vitest.config.ts
  forbidden:
    - packages/runtime-core/src/**/*.ts
  free:
    - design/logbook.md
    - design/lessons/gemini-lessons.md
```

## Implementation Review: M18-T2 Round 1 (Codex, 2026-07-09)

**Verdict: VERIFIED.** Commit `2784c6a` addresses BL-020 inside the approved T2 fence and is verified for Gate 2
handoff to Task-end Review.

**Verification run:**
- `node scripts/scope-check.mjs` -> exit 0. The T2 manifest accepted exactly the ledger plus
  `packages/runtime-core/src/agents/in-process-driver.ts` and
  `packages/runtime-core/src/agents/__tests__/in-process-driver.test.ts`.
- Targeted preservation suite:
  `npx vitest run packages/runtime-core/src/agents/__tests__/in-process-driver.test.ts apps/orchestrator/src/__tests__/m17-gate-recording.test.ts packages/runtime-core/src/registry/__tests__/m17-gate-channel.test.ts packages/runtime-core/src/registry/__tests__/baton-metadata.test.ts`
  -> **4 files / 20 tests passed**.
- `npx tsc -b` -> exit 0.
- `git diff --check && git diff --cached --check && git show --check --oneline HEAD` -> exit 0.
- `npm run backlog:check` -> backlog structure OK, **21 items, 0 warnings**.
- `npm test` -> **52 files / 297 tests passed**.
- `node scripts/m14-identity-harness.mjs --check` -> **Baselines match. Identity verified.** The known generated
  harness worktree/branch was clean and swept after the run.
- Out-of-fence checks: zero `packages/runtime-core/src/registry/team-coordinator.ts` diff; no files outside the T2
  manifest changed.
- Pollution check after sweep: `git worktree list` shows only `/Users/fausto/Software/AgentTalk`; `git branch --list
  'task-*'` shows only active `task-M18-T2`.

**Disposition of T2 bars:**
1. **Disconnect-mid-turn regression:** verified by the new `BL-020 regression` test. The simulated transport marks
   the agent `terminated` during the turn and throws; the driver logs the error and does not attempt the illegal
   `terminated -> error` transition.
2. **Normal exec-error / M08 preservation:** verified by the existing in-process driver M08 tests in the targeted
   suite.
3. **Clean termination and M17 preservation:** verified by targeted driver, M17 gate-channel/recording, and baton
   metadata tests.
4. **Scope:** production change is limited to `in-process-driver.ts`; no broad lifecycle redesign and no
   `team-coordinator.ts` changes.

## Implementation Review: M18-T1 Round 1 (Codex, 2026-07-09)

**Verdict: REFUTED.** The core script is present and the full existing suite is green, but the delivery is not
ready for Gate 2 verification handoff because the claimed targeted tests are not runnable under the repo's Vitest
configuration and the task's own scope checker currently fails on the dirty delivery worktree.

**Verification run:**
- `npx vitest run scripts/__tests__/scope-check.test.mjs` -> **exit 1**, no test files found. The active
  `vitest.config.ts` include globs cover `apps/orchestrator/src/**/*.test.ts`,
  `packages/runtime-core/src/**/*.test.ts`, `packages/llm-client/src/**/*.test.ts`,
  `packages/mcp-transport/src/**/*.test.ts`, and `packages/mcp-exec-server/src/**/*.test.ts`; they do not include
  `scripts/__tests__`.
- `node scripts/scope-check.mjs` -> **exit 1**. It found the manifest and accepted the in-scope M18-T1 files, but
  rejected `design/lessons/gemini-lessons.md` as `OUT OF SCOPE`; that file is modified in the worktree but not in
  commit `166d1d1`.
- `git diff --check && git diff --cached --check` -> exit 0.
- `npx tsc -b` -> exit 0.
- `npm test` -> **51 files / 291 tests passed**. Note: this does **not** include
  `scripts/__tests__/scope-check.test.mjs` because of the Vitest include globs above.
- `npm run backlog:check` -> backlog structure OK, **21 items, 0 warnings**.
- `node scripts/m14-identity-harness.mjs --check` -> **Baselines match. Identity verified.** The known leaked
  harness worktrees/branches were clean and swept after the run.
- Out-of-fence check: zero `packages/runtime-core/src/registry/team-coordinator.ts` diff.
- Pollution check after sweep: pending re-run after the implementer redelivery; this round still has the dirty
  `design/lessons/gemini-lessons.md` worktree change.

**Findings:**
1. **Targeted tests are outside the configured test suite.** The delivery claims unit coverage in
   `scripts/__tests__/scope-check.test.mjs`, but the repo's Vitest config does not discover that path. A direct
   targeted run exits with "No test files found", and full `npm test` passes without running these tests. The
   script therefore lacks executable, gate-visible targeted test coverage.
2. **Delivery worktree fails its own scope check.** `node scripts/scope-check.mjs` rejects
   `design/lessons/gemini-lessons.md` as out of scope. Because that file is dirty and absent from commit
   `166d1d1`, the delivery is not clean and the T1 checker cannot currently produce its required in-scope pass.

**Required return scope:**
- Make the scope-check tests run under the repo's normal test machinery or move them to an included test location;
  then re-run the targeted test command and `npm test`.
- Clean the delivery worktree so `node scripts/scope-check.mjs` passes on the actual branch state, or obtain a
  Gate-1/SM-approved scope amendment before including `design/lessons/gemini-lessons.md` in the T1 delivery.
- Re-run the T1 verification bars affected by those fixes: targeted scope-check tests, positive `scope-check`,
  `npm test`, `npm run backlog:check`, whitespace check, and pollution check.

## Implementation Review: M18-T1 Round 2 (Codex, 2026-07-09)

**Verdict: VERIFIED.** The Round 1 findings are addressed in commit `31ca833`, and M18-T1 is verified for Gate 2
handoff to Task-end Review.

**Verification run:**
- `npx vitest run scripts/__tests__/scope-check.test.mjs` -> **1 file / 5 tests passed**.
- `node scripts/scope-check.mjs` -> exit 0. The checker found the manifest and accepted all changed files:
  M18 docs/ledger, `scripts/scope-check.mjs`, `scripts/__tests__/scope-check.test.mjs`, `vitest.config.ts`, and
  `design/lessons/gemini-lessons.md` via the `free` block.
- Direct scope matcher probe -> exit 0. Verified a forbidden `packages/runtime-core/src/...` path matches the
  forbidden glob, an allowed script path matches, the Gemini lessons path matches `free`, and an unrelated path does
  not match the allowed set.
- `git diff --check && git diff --cached --check && git show --check --oneline HEAD` -> exit 0.
- `npx tsc -b` -> exit 0.
- `npm test` -> **52 files / 296 tests passed**; the full suite now includes `scripts/__tests__/scope-check.test.mjs`.
- `npm run backlog:check` -> backlog structure OK, **21 items, 0 warnings**.
- `node scripts/m14-identity-harness.mjs --check` -> **Baselines match. Identity verified.** The known generated
  harness worktree/branch was clean and swept after the run.
- Out-of-fence checks: zero `packages/runtime-core/src/registry/team-coordinator.ts` diff; zero
  `packages/runtime-core/src/**` diff.
- Pollution check after sweep: `git worktree list` shows only `/Users/fausto/Software/AgentTalk`; `git branch --list
  'task-*'` shows only active `task-M18-T1`.

**Disposition of Round 1 findings:**
1. **Targeted tests outside configured suite:** fixed. `vitest.config.ts` now includes
   `scripts/__tests__/**/*.test.mjs`; targeted and full-suite runs both executed the new tests.
2. **Scope checker failed on Gemini lessons:** fixed for the delivered branch. The lessons file is now committed and
   listed in `free`, consistent with the standing per-agent lessons-write requirement. This is a narrow manifest
   widening for the implementer's own lessons file, not BL-015 L1/L2 scope.

## Task-end Review: M18-T1 Round 1 (Claude, 2026-07-09)

**Verdict: REFUTED — one structural defect in the delivered fence semantics; hand back to the gate-2 loop.**

**What I re-ran and what holds (pre-registered: 1 attempt per green-claimed bar, 2 fresh probes):**
- `npx vitest run scripts/__tests__/scope-check.test.mjs` -> **5/5 passed** (re-run first-hand).
- End-to-end negative probe (mine, not gate 2's matcher probe): created untracked `apps/web/gate3-probe.ts`,
  ran `node scripts/scope-check.mjs` -> **caught it** (`[OUT OF SCOPE]`, exit 1), probe file removed.
  Detection mechanics are sound: forbidden-first precedence, untracked/dirty coverage via
  `git status --porcelain`, per-branch manifest resolution.
- Fence checks: zero `runtime-core` diff, zero `team-coordinator.ts` diff, no L1/L2 shapes.
- Full suite / tsc / harness NOT re-run this round — superseded by the refute; they re-run at redelivery.

**The defect (found by diffing the two candidate bases — reality vs. the tool's view):**
`getChangedFiles()` prefers `origin/master...HEAD`; `origin/master` sits at `8d7efa6`, **4 commits behind
local `master`** (`c6ec232`) — in this repo the mainline is local-first and pushes are batched, so this
staleness is the normal state, not an accident. Consequence, reproduced:
- files the task actually changed (`master...HEAD`): **5**;
- files the tool sees (`origin/master...HEAD` + porcelain): **8** — the extra three (`design/backlog.md`,
  `design/milestone18-self-hosting-plan.md`, `design/self-hosting-program-draft.md`) are master-side
  inception/gate commits the task never touched.
The delivered manifest's `allowed` was **widened to absorb those three files**, so the check goes green —
i.e. the manifest accommodates a measurement error instead of the measurement being fixed. The shipped
fence would silently bless a T1 implementer editing `backlog.md`, the plan, or the program draft. Recorded
as **IP-14** (manifest widened to absorb a measurement error), reviewer-authored on master.

**Required return scope (all inside the T1 manifest):**
1. `scripts/scope-check.mjs` `getChangedFiles()`: base the diff on **local `master`** (the actual merge
   target: `master...HEAD`), falling back to `origin/master...HEAD` only when no local `master` exists
   (e.g. CI checkout) — the reverse of the current preference.
2. Slim the T1 manifest's `allowed` back to what the task touches: remove `design/backlog.md`,
   `design/milestone18-self-hosting-plan.md`, `design/self-hosting-program-draft.md` (with the correct
   base they no longer appear as changed).
3. Re-run the affected bars within their remaining budgets: targeted scope-check tests, positive
   `scope-check` on the branch, full `npm test`, whitespace, pollution.

**Coordination note (C2 discipline):** T1's own gate batons (implementer baton, gate-2 hand-back and
redelivery, gate-2 VERIFIED report, this gate-3 refute) all crossed the terminal and are not yet in the
fallback rows — the redelivery must append them (count with the PO; my reconstruction is ~5-6 relays for
T1 so far beyond the 3 seeded).

## Implementation Review: M18-T1 Round 3 / Gate-3 Refute Recheck (Codex, 2026-07-09)

**Verdict: VERIFIED.** The Gate-3 refusal defects are addressed in commit `80cefeb`, and M18-T1 is again verified
for Gate 2 handoff to Task-end Review.

**Verification run:**
- `npx vitest run scripts/__tests__/scope-check.test.mjs` -> **1 file / 5 tests passed**.
- `node scripts/scope-check.mjs` -> exit 0. With the corrected local-`master` base, the checker saw **5** changed
  files: `design/lessons/gemini-lessons.md`, `design/milestone18-self-hosting-implementation.md`,
  `scripts/__tests__/scope-check.test.mjs`, `scripts/scope-check.mjs`, and `vitest.config.ts`.
- Diff-base probe: `git diff --name-only master...HEAD` -> **5 files**; `git diff --name-only origin/master...HEAD`
  still shows the stale **8-file** view including `design/backlog.md`, `design/milestone18-self-hosting-plan.md`,
  and `design/self-hosting-program-draft.md`. This verifies the tool now uses the local merge target view that
  Task-end Review required.
- Planning-doc allowlist probe -> exit 0. `design/backlog.md`, `design/milestone18-self-hosting-plan.md`, and
  `design/self-hosting-program-draft.md` no longer match the manifest's allowed set.
- `git diff --check && git diff --cached --check && git show --check --oneline HEAD` -> exit 0.
- `npx tsc -b` -> exit 0.
- `npm test` -> **52 files / 296 tests passed**.
- `npm run backlog:check` -> backlog structure OK, **21 items, 0 warnings**.
- Out-of-fence checks: zero `packages/runtime-core/src/**` diff, including zero `team-coordinator.ts` diff.
- Pollution check: `git worktree list` shows only `/Users/fausto/Software/AgentTalk`; `git branch --list
  'task-*'` shows only active `task-M18-T1`.

**Disposition of Gate-3 findings:**
1. **Diff base preference:** fixed. `getChangedFiles()` now tries `master...HEAD` first and falls back to
   `origin/master...HEAD` only if local `master` is unavailable.
2. **Manifest widened to absorb stale origin diff:** fixed. The three planning/backlog docs were removed from the
   T1 allowed list and are no longer part of the local-`master` changed set.
3. **Missing T1 coordination rows:** fixed. The ledger now lists the five additional T1 terminal relays and updates
   the relay count to **8**.

## Task-end Review: M18-T1 Round 2 (Claude, 2026-07-09)

**Verdict: VERIFIED ✅ (reviewer added the missing usage doc — PO-authorized in session, on record) — MERGED.**

**Full closure sweep, every check re-run this round (1 attempt each, all first-hand):**
- Base fix confirmed in the diff (`master...HEAD` preferred; `origin/master` CI fallback) — the required shape exactly.
- Manifest slimmed to the 5 real files; tool view == real diff (5 == 5).
- Targeted tests `npx vitest run scripts/__tests__/scope-check.test.mjs` -> **5/5**.
- `node scripts/scope-check.mjs` on the branch -> exit 0.
- Fresh end-to-end negative probe (untracked `apps/web/gate3-probe2.ts`) -> caught, exit 1; probe removed.
- `npx tsc -b` -> clean. Full `npm test` -> **52 files / 296 tests**. `npm run backlog:check` -> 21 items, 0 warnings.
- `node scripts/m14-identity-harness.mjs --check` -> Baselines match; known leaked worktree+branch swept
  (`git worktree list` + `git branch --list 'task-*'` clean after sweep).
- Whitespace clean; fences clean (zero `runtime-core`/`team-coordinator.ts` diff; no `as any`); no L1/L2 shapes.
- Coordination rows appended and honest; final T1 relay count **9**, substrate events **0** (declared above).

**One gap found and closed under explicit PO authority:** the plan's T1 bullet "document how implementers and
reviewers run it during Rule-5 self-check and gates" was unmet (script header described *what*, not *who/when*;
no usage doc in ledger/README/AGENT.md/design note). Handing back a full round for a docs paragraph vs. reviewer
completion was put to the PO as an explicit choice; **the PO authorized the reviewer fix** (option on record,
2026-07-09 in session). Fix: USAGE block in the `scope-check.mjs` header (who runs it at Rule-5/gate-2/gate-3,
exit semantics, base semantics, master no-op) — inside the T1 manifest's allowed surface. Declared here per
Reviewer Rule 6; the narrow typo-class default remains unchanged for future tasks.

**DoD sweep (plan T1 bars):** manifest syntax defined ✅ (ledger `@scope` block) · `scope-check` script ✅ ·
usage documentation ✅ (post reviewer fix) · catches out-of-scope ✅ (gate-2 matcher probe + two independent
gate-3 end-to-end probes) · passes in-scope ✅ (branch run exit 0) · hard fence held ✅ (zero `runtime-core`
production changes; no provider hooks / fenced worktrees / baton-carried manifests / runtime fence events).
C4 of the epic DoD is satisfied; BL-015 stays `todo` for L1/L2 (M19 gate with BL-014), per the gate record.

**Telemetry (task closure):**
- task:        M18-T1
- wall-clock:  2026-07-09 ~13:30 (implementer baton) → 17:2x (merge) (~4h, 2 gate-2 rounds + 1 gate-3 refute round)
- budget:      claude weekly 33%→38% (Δ ~5%), codex weekly 31%→36% (Δ ~5%), session claude 66%→11% (window reset 15:49)  [per scripts/usage.mjs]
- gate:        tsc 0, suite 296/296 (52 files), pollution clean (post-sweep)
- diff:        5 files, +454/-1 (incl. ledger), commits 166d1d1 · 31ca833 · 4793b23 · d60770c · 80cefeb · 582e734 (+ closure commit)
- coordination: relays 9 (3 seeded pre-T1 + 6 in-task), substrate events 0 (BL-017 open — T1 baseline for C3)
- outcome:     MERGED ✅ (PO-gated; PO merge authorization given with the reviewer-fix grant, 2026-07-09)

## M18-T2 - BL-020: attached-client disconnect cannot kill the orchestrator

**Status:** `done` — merged 2026-07-09 (gate 3 VERIFIED, live disconnect-survival proven)
**Branch:** `task-M18-T2`

### Coordination Evidence

- **Substrate events recorded:**
  - (Pending T2 deliveries and Gates)
- **Terminal fallback rows:**
  - `2026-07-09` - `implementer baton` (SM -> Implementer) - T2 starts
- **Relay count:** 1 (seeded)
- **Proof pointer:** (Pending recordings)

### Rule 6/7 Declaration (Gemini, 2026-07-09)

**Scope:**
- Fix the in-process driver/lifecycle path so a disconnect during an in-flight turn cannot throw an illegal status transition out of the loop and kill the orchestrator process.
- The expected fix surface is `packages/runtime-core/src/agents/in-process-driver.ts` and narrowly related tests.
- **Fence:** Preserve existing lifecycle behavior for normal exec errors, clean termination, M08 transport-fault handling, and M17 workflow-gate authority/recording behavior. Broad lifecycle redesign is out of scope.

**Approach:**
1. Investigate `packages/runtime-core/src/agents/in-process-driver.ts` to find where it throws an illegal status transition on disconnect during a turn.
2. The orchestrator likely transitions the agent to a 'terminated' or 'disconnected' state, but the driver loop might try to update its state back to 'ready' or similar when the turn resolves, causing an invalid transition. Or the driver doesn't catch the transport error.
3. Catch the disconnect error, verify if the agent is already terminated or in a terminal state, and if so, gracefully exit the turn without throwing an unhandled exception or trying to update the agent's status to an invalid state.
4. Add regression test for the mid-turn disconnect.
5. Ensure tests for other lifecycle properties (normal errors, clean termination, M08, M17) pass.

**Per-check Verification Budgets (M18-T2):**
| Check | Max attempts | Current |
|---|---:|---:|
| disconnect-mid-turn regression | 3 | 1 |
| normal exec-error preservation check | 2 | 1 |
| clean termination preservation check | 2 | 1 |
| M08 transport-fault preservation check | 2 | 1 |
| M17 workflow-gate authority/recording preservation check | 2 | 1 |
| `npx tsc -b` | 2 | 1 |
| targeted relevant tests | 2 | 1 |
| full `npm test` | 1 | 1 |
| `node scripts/m14-identity-harness.mjs --check` | 1 | 1 |
| `npm run backlog:check` | 1 | 1 |
| `git diff --check && git diff --cached --check` | 2 | 2 |
| pollution check: `git worktree list` + `git branch --list 'task-*'` | 1 | 1 |

### M18-T2 Scope Manifest

```yaml
@scope:
  allowed:
    - design/milestone18-self-hosting-implementation.md
    - packages/runtime-core/src/agents/in-process-driver.ts
    - packages/runtime-core/src/agents/__tests__/in-process-driver.test.ts
  forbidden:
    - packages/runtime-core/src/registry/team-coordinator.ts
  free:
    - design/logbook.md
    - design/lessons/gemini-lessons.md
```

## Task-end Review: M18-T2 Round 1 (Claude, 2026-07-09)

**Verdict: VERIFIED ✅ — MERGED.** No reviewer fixes needed this round.

**The live bar (the one gate 2 could not run from the suite alone — observation made, not derived):**
re-ran the exact M17 apparatus whose teardown *discovered* BL-020: real orchestrator (`dist` confirmed to
contain the T2 guard), ports **9897**/3001 per LB-63 (both families verified free; no 9899 luck), recorder
to scratchpad, proof-script copy in scratchpad (committed evidence untouched). Result:
- all three gate behaviors executed live (verdict accepted · go accepted · PO act refused pre-delivery);
  fresh recording captured **3 `workflow_gate_attempt` events** — M17 semantics preserved under the fix;
- at client teardown the disconnect race **fired** (caught stack in the log: `Agent.setStatus` from
  `InProcessAgentDriver.loop`) and was **contained**: exactly 1 caught `error:` line, 0 uncaught/fatal,
  **orchestrator survived** (same scenario = exit 1 pre-fix), then shut down cleanly on signal (exit 0),
  ports swept. *(The proof script's own final check printed FAILED on its known-broken stale-file read —
  M17 finding G2-1, out of T2's fence; the fresh-recorder parse above is the real evidence.)*

**Code reading (fresh eyes on the two illegal transitions BL-020 named):** `terminated -> busy` (loop line
71) throws inside the try and lands in the guarded catch; `ready` (line 74) is status-guarded; the catch
itself can no longer throw — no escape path from `loop()` remains. Clean-disconnect semantics preserved
(`terminated`, never forced to `error`); genuine faults still set `error` + break (not swallowed).

**Standard bars, re-run first-hand (1 attempt each):** scope-check exit 0 (changed files = manifest exactly) ·
targeted driver tests **9/9** (incl. the BL-020 regression) · `npx tsc -b` clean · full `npm test` **52
files / 297 tests** · `backlog:check` 21/0 · whitespace clean · `team-coordinator.ts` zero-diff · zero
`as any` in the branch diff · M14 harness "Baselines match. Identity verified." (leaked worktree+branch
swept; hygiene clean after).

**Coordination Evidence (final for T2):** relay rows: implementer baton (seeded) + gate-2 VERIFIED report
(Implementation Reviewer -> SM -> Task-end Reviewer) = **relay count 2**; substrate events for M18's own
coordination: **0** (BL-017 still open — the proof's recorded gate events are proof payloads, not epic
coordination; counted honestly as such). T2 relay count 2 vs T1's 9: fewer review rounds, not substrate
adoption — the adoption claim stays T3's.

**Telemetry (task closure):**
- task:        M18-T2
- wall-clock:  2026-07-09 ~17:25 (baton) → 17:4x (merge) (~20 min in-session; 1 gate-2 round, 1 gate-3 round)
- budget:      claude weekly 38%→38%, codex weekly 36%→38%, claude session 11%→16%  [per scripts/usage.mjs]
- gate:        tsc 0, suite 297/297 (52 files), pollution clean (post-sweep), live disconnect-survival proof PASSED
- diff:        3 files, +137/-1, commits 2784c6a · 30966e1 (+ closure commit)
- outcome:     MERGED ✅ (PO-gated; merging per the standing M18 flow — BL-020 flips done in backlog at merge)

## M18-T3 — CLOSED: SUPERSEDED (not merged). Superseded by M18-T3a.

**PO scope decision (2026-07-09, in session):** *"T3 just died and gave birth to T3a."* Recorded here per the
SM's durable-artifact duty; the rescope is a PO act.

**Disposition of the dead work.** T3's branches (`task-M18-T3` in **both** repos) stay unmerged and are the
archive of the refute. **Nothing needs reverting: neither master ever received the code** (verified —
`git show master:bridge.mjs | grep -c AGENTTALK_BATON` → 0). The mainline stayed verified-only throughout, which
is exactly what gate-3's REFUTE is for. Six gate-2 green rounds did not put a single line of it on master.

**Why it died (short form; full record in the gate-3 refute above + LB-66):**
1. The delivered proof passed **identically on the pre-fix bridge** — it never discriminated fixed from unfixed
   code (**IP-15**).
2. Its mechanism (env-var injection) let the *operator* staple an envelope on, rather than the *agent* choosing
   one per message — the wrong shape for a workflow verdict.
3. **BL-017 itself was misdiagnosed.** The relay always carried structured args. The true blocker, live-observed
   under PO authorization: a real CLI session **cannot attach at all** — `mcp-server.ts:150` requires
   `params.clientInfo.contractHash` at `initialize`, a real CLI supplies its own `clientInfo` without it, and
   `bridge.mjs` never injects it. Every prior "live proof" used SDK clients, which do set the hash, hiding the
   wall for three epics.

**What was proven instead (the epic's goal, demonstrated):** with the hash injected, a **real `claude` CLI
session** attached and natively emitted `send_to_agent` carrying both a `baton` and a `workflowEvent`; the brain
accepted the gate event and enforced M17 authority against the registry-owned role. Env vars **unset** during the
run. Evidence: `design/evidence/m18-door1-real-cli-proof.ndjson`, LB-66. Bonus: the orchestrator survived the
CLI's disconnect — M18-T2's fix, live, unprompted.

## M18-T3a — BL-017 (re-scoped): the attach handshake

**Status:** **IMPLEMENTATION** (Gate 1 approved, see Amendment Record in plan).
**Branch:** `task-M18-T3a` (branched fresh from `master` in both `AgentTalk` and `agentalk-mcp-client`).

```yaml
@scope:
  allowed:
    - design/milestone18-self-hosting-implementation.md
    - design/evidence/*
    - ../agentalk-mcp-client/bridge.mjs
    - ../agentalk-mcp-client/__tests__/bridge.test.mjs
  forbidden:
    - packages/mcp-transport/src/mcp-server.ts
    - packages/runtime-core/**
    - packages/contracts/wire-contract.json
  free:
    - design/lessons/gemini-lessons.md
```

**Gate 1 Binding Conditions (acknowledged by Implementer):**
1. **Honesty note:** `scope-check` cannot see the client repo (`../agentalk-mcp-client`). The manual bars (`git diff --check` + forbidden-surface diff in both repos) are what actually fence T3a. A green `scope-check` only verifies the AgentTalk repo's scope.
2. **Routing shape for passing proof:** The passing proof will use `to: 'user'` to avoid the `creating` state error, matching LB-66's proof. This ensures the M17 gate check fires cleanly without state validation blocking it.
3. If the URL lacks `contractHash`, traffic passes through unchanged (no crash, no silent empty string) with one stderr log line.

**Coordination Evidence (ongoing):**
- **Substrate events recorded:** Yes, `door1-evt1` generated via the real CLI path `send_to_agent`.
- **Terminal fallback rows:** 0
- **Relay count:** 1
- **Proof pointer:**
  - `design/evidence/m18-t3a-proof-a.txt`: Real CLI path failing without the fix (`Rejecting agentId=claude-door1: contract hash mismatch. Expected ffa9..., got undefined`).
  - `design/evidence/m18-t3a-proof-b.txt`: Real CLI path passing with the fix (`Workflow gate attempt by claude-door1 (accepted)`).

**Shape agreed at the rescope (PO decision + architect's live findings; the planner owns the actual spec):**
1. `bridge.mjs` injects `contractHash` into `initialize.params.clientInfo`, sourced from the URL it **already
   receives** (`?contractHash=...`) — preferred over a new env var. Client-side, transport-only: **no protocol
   logic enters the relay** (the pure-relay principle holds).
2. **No env-var envelope injection.** Not a revert (nothing merged) — simply not carried forward. Today's run
   proved it unnecessary in principle: the agent supplies the envelope itself.
3. Proof = the Door 1 demonstration, re-run as the task's own bar, with an **A/B discipline** per IP-15: show the
   bar **failing** without the handshake fix (`contract hash mismatch ... got undefined`) and **passing** with it.
4. Correct **BL-017's text** in the backlog to state the real defect (done at this rescope).

**Fence:** `agentalk-mcp-client/bridge.mjs` + its tests; the AgentTalk ledger; evidence artifacts. **Forbidden:**
`mcp-server.ts` handshake semantics (the server is right to demand the hash), any `runtime-core` production
change, any new MCP tool, wire-contract changes (stays v7).

**Open question for the planner's spec (raised, not decided):** the real CLI needed `--mcp-config` pointing at
`bridge.mjs`; a repo-committed `.mcp.json` template would make "attach a real session" a one-liner for the next
epic. Rider-sized; drop it if it grows.

### Gate 2 Review - Round 1 (Codex, 2026-07-09)

**Verdict: REFUTED.** The client tests/build pass and the core code diff stays in the intended client surface, but
the delivery does not satisfy the T3a Gate 2 bar yet.

**Findings:**
- **Committed whitespace check fails in `agentalk-mcp-client`.** `git diff --check && git diff --cached --check &&
  git show --check --oneline HEAD` reports trailing whitespace in `__tests__/bridge.test.mjs` lines 17 and 29, and
  `bridge.mjs` lines 45 and 65. This is a required bar in the T3a verification budget.
- **The T3a `@scope` manifest is malformed and does not parse the fence it claims.** `node scripts/scope-check.mjs`
  exits 0, but reports `Allowed: 9 patterns`, `Forbidden: 0`, and `Free: 0`. The ledger text visibly intends
  forbidden/free entries, so the green scope-check is not meaningful even for the AgentTalk repo portion. This also
  undermines Gate 1 condition 2's required honesty note about scope-check's limits.
- **The live proof artifacts do not show the bridge-side cause of the A/B pass or the no-env condition.**
  `m18-t3a-proof-a.txt` shows the expected pre-fix server rejection and `m18-t3a-proof-b.txt` shows a later accepted
  server-side tool call, but the artifacts do not include the bridge stderr line (`injected contractHash from URL`),
  the real CLI command/config used for each side, or a run-bound check that `AGENTTALK_BATON` and
  `AGENTTALK_WORKFLOW_EVENT` were unset during the passing run. Given IP-15, the A/B proof needs enough context to
  tie the pass to this bridge fix and to rule out env-var envelope injection.

**Verifier checks run:**
- `npm test` in `agentalk-mcp-client`: PASS, 2 files / 2 tests.
- `npm run build` in `agentalk-mcp-client`: PASS.
- `git diff --check && git diff --cached --check && git show --check --oneline HEAD` in `agentalk-mcp-client`:
  FAIL, trailing whitespace as listed above.
- `git diff --check && git diff --cached --check && git show --check --oneline HEAD` in AgentTalk: PASS.
- `node scripts/scope-check.mjs` in AgentTalk: exits 0, but parsed `Forbidden: 0` / `Free: 0`, so the manifest needs
  correction before this bar can count.
- `npm run backlog:check` in AgentTalk: PASS, 21 items / 0 warnings.
- forbidden-surface diff in AgentTalk for `packages/mcp-transport/src/mcp-server.ts`, runtime-core, contracts, and
  MCP tools: PASS, no diff.
- client changed-file check: only `bridge.mjs` and `__tests__/bridge.test.mjs` changed; grep found no
  `AGENTTALK_BATON` / `AGENTTALK_WORKFLOW_EVENT` code in the client diff.
- pollution check in both repos: PASS for worktrees; only the expected `task-M18-T3` archive branch and active
  `task-M18-T3a` branch are present.

**Required redelivery:**
- Fix committed whitespace in the client repo.
- Fix the T3a manifest indentation/shape so `scope-check` parses the intended allowed, forbidden, and free sections;
  then rerun it and record the meaningful output.
- Add run-bound proof context tying Proof B to `bridge.mjs` injecting the URL hash and showing the no-env condition
  for envelope injection during the passing run.

### Gate 2 Review - Round 2 (Codex, 2026-07-09)

**Verdict: REFUTED.** The Round 1 whitespace and manifest blockers are addressed, and the client/unit checks are
green. The remaining blocker is the load-bearing A/B proof: Proof A is not a run against the unfixed bridge.

**Findings:**
- **The A/B proof still does not satisfy the IP-15 bar.** The T3a plan requires the Door 1 proof to fail on the
  unfixed bridge and pass with the T3a fix using the same real CLI/orchestrator path. The new Proof A uses the fixed
  bridge's new `URL lacks contractHash, relaying unchanged` code path and omits `contractHash` from the bridge URL.
  That proves the Gate 1 no-hash passthrough condition, but it does not prove that the unfixed bridge fails when given
  the same URL-hash setup that the fixed bridge turns into a passing attach.
- **Proof B now has the missing context.** It includes the exact CLI command/config, `AGENTTALK_BATON` and
  `AGENTTALK_WORKFLOW_EVENT` unset, the bridge stderr line `injected contractHash from URL`, and the accepted
  `send_to_agent` tool call with structured `baton` and `workflowEvent`. That side of the proof is reviewable.

**Verifier checks run:**
- `npm test` in `agentalk-mcp-client`: PASS, 2 files / 2 tests.
- `npm run build` in `agentalk-mcp-client`: PASS.
- `git diff --check && git diff --cached --check && git show --check --oneline HEAD` in both repos: PASS.
- `node scripts/scope-check.mjs` in AgentTalk: PASS; parsed `Allowed: 4`, `Forbidden: 3`, `Free: 1`.
- `npm run backlog:check` in AgentTalk: PASS, 21 items / 0 warnings.
- forbidden-surface diff in AgentTalk for `packages/mcp-transport/src/mcp-server.ts`, runtime-core, contracts, and
  MCP tools: PASS, no diff.
- client changed-file check: only `bridge.mjs` and `__tests__/bridge.test.mjs` changed; grep found no
  `AGENTTALK_BATON` / `AGENTTALK_WORKFLOW_EVENT` code in the client diff.
- pollution check in both repos: PASS for worktrees; only the expected `task-M18-T3` archive branch and active
  `task-M18-T3a` branch are present.

**Required redelivery:**
- Provide a true A/B artifact: with the same real CLI/orchestrator setup and URL containing `contractHash`, show the
  unfixed bridge failing with `got undefined`, then the fixed bridge passing via `injected contractHash from URL`.
  The existing no-hash passthrough proof may remain as the separate Gate 1 condition-1 evidence.

### Gate 2 Review - Round 3 (Codex, 2026-07-09)

**Verdict: VERIFIED.** Commit `b53bf2d` addresses the Round 2 A/B proof gap, and the T3a implementation is verified
for Gate 2.

**Evidence verified:**
- Proof A uses the same real CLI/orchestrator shape and the same URL hash as Proof B, but the bridge log lacks the
  fixed-branch injection line and the orchestrator rejects the attach with `got undefined`. This demonstrates the
  unfixed bridge failure mode.
- Proof B uses the same URL hash, shows `[mcp-bridge] injected contractHash from URL`, then records the real CLI
  `send_to_agent` tool call with structured `baton` and `workflowEvent`, followed by the accepted M17 gate event.
- Both proof files include run-bound `AGENTTALK_BATON` / `AGENTTALK_WORKFLOW_EVENT` unset checks.
- The Gate 1 no-hash condition remains covered by the client test for URL-without-`contractHash` passthrough.

**Verifier checks run:**
- `npm test` in `agentalk-mcp-client`: PASS, 2 files / 2 tests.
- `npm run build` in `agentalk-mcp-client`: PASS.
- `git diff --check && git diff --cached --check && git show --check --oneline HEAD` in both repos: PASS.
- `node scripts/scope-check.mjs` in AgentTalk: PASS; parsed `Allowed: 4`, `Forbidden: 3`, `Free: 1`.
- `npm run backlog:check` in AgentTalk: PASS, 21 items / 0 warnings.
- forbidden-surface diff in AgentTalk for `packages/mcp-transport/src/mcp-server.ts`, runtime-core, contracts, and
  MCP tools: PASS, no diff.
- client changed-file check: only `bridge.mjs` and `__tests__/bridge.test.mjs` changed; grep found no
  `AGENTTALK_BATON` / `AGENTTALK_WORKFLOW_EVENT` code in the client diff.
- full AgentTalk `npm test`: PASS, 52 files / 297 tests.
- `node scripts/m14-identity-harness.mjs --check`: PASS, "Baselines match. Identity verified." The harness-created
  `task-task-1783630414643` worktree/branch was swept after the run.
- final pollution check in both repos: PASS, only the expected `task-M18-T3` archive branch and active
  `task-M18-T3a` branch remain.

**Hand-off:** M18-T3a is verified for Gate 2 and ready for Task-end Review.

## Task-end Review: M18-T3a Round 1 (Claude, 2026-07-09)

**Verdict: VERIFIED ✅ — MERGED (both repos).** The task that killed T3 is closed by the task T3 became.

**The A/B, reproduced independently (Rule 4 — not read from gate 2's artifacts; my own run, 1 attempt):**
real orchestrator (`AGENTTALK_MCP_PORT=9897 PORT=3001`), real `claude` CLI both sides, **same URL shape**
(hash present), `AGENTTALK_BATON`/`AGENTTALK_WORKFLOW_EVENT` **unset** — only the bridge differs:
- **A-side** — `bridge.mjs` extracted from client `master` (verified genuinely unfixed: 49 lines, 0 occurrences
  of `contractHashFromUrl`): `[McpServer] Rejecting agentId=g3-ab: contract hash mismatch … got undefined`,
  close 1008. **The bar fails without the fix.**
- **B-side** — the delivered bridge: `[mcp-bridge] injected contractHash from URL`, then from the real CLI
  session, natively composed: `send_to_agent { baton: {…batonId:'g3-b1'…}, workflowEvent: {…gate:'gate-3',
  action:'verdict'…} }` → `[Server] Workflow gate attempt by g3-ab2 (accepted)`.
This is what IP-15 demands: a proof that *can* fail, shown failing, then shown passing for the stated reason.

**Gate-1 conditions — all three met:** (1) no-hash-URL passthrough implemented (`URL lacks contractHash,
relaying unchanged`) **and tested**; (2) the `scope-check` cross-repo blindness is declared in the ledger — a
green `scope-check` fences only the AgentTalk tree, and T3a's real code lives in the client repo (**filed for
C7**); (3) routing shape stated (`to: 'user'`, matching LB-66; the M17 gate check fires before routing).

**Bars re-run first-hand (1 attempt each):** client `npm test` (bridge spawned as a real child process against a
real WS server; 4 cases: inject / preserve-existing / no-hash-passthrough / non-`initialize` untouched) · client
`npm run build` · AgentTalk `npx tsc -b` · full `npm test` **52 files / 297 tests** · `backlog:check` 21/0 ·
`scope-check` exit 0 · whitespace both repos · **forbidden surfaces clean** (AgentTalk diff = ledger + evidence
only; `mcp-server.ts`, `runtime-core`, `wire-contract.json` (v7), `team-coordinator.ts` all untouched) ·
`AGENTTALK_BATON`/`AGENTTALK_WORKFLOW_EVENT` **absent from `bridge.mjs`** (0 hits — the dead T3 mechanism was
never carried forward) · M14 harness "Baselines match" + leaked worktree/branch swept · ports released.

**Deviation found at gate 3 and disposed (undeclared by the implementer; missed by gate 2 — Rule 7):** the diff
also changes the `ws error` handler to log `ev?.error?.stack` before falling back to `ev?.message`. Not in the
spec, not declared in the ledger, not dispositioned in the gate-2 verdict. **ACCEPTED as zero-risk** — it is a
stderr log line inside an in-fence file, it strictly widens diagnostics, and it cannot alter relayed bytes or
handshake behaviour (verified by reading: the handler already `process.exit(1)`s). Recorded rather than fixed
silently. *Reviewer note: an in-fence file is not a licence for unrequested edits (IP-5 family) — declare them.*

**DoD:** **C6 satisfied** — real CLI sessions attach through the bridge and carry structured `baton` +
`workflowEvent`, brain-accepted under M17 authority, no new MCP tool, contract unchanged at v7. **BL-017 closes**
(with its corrected diagnosis, 0137757).

**Coordination Evidence (final for T3a):** relays: implementer baton, gate-2 refute ×2, gate-2 redelivery ×2,
gate-2 VERIFIED report, gate-1 amendment relay, this gate-3 result = **8**. Substrate events for M18's own
coordination: **0** — the capability now exists (proven twice today) but was **not yet used** to carry this
epic's own gates. *Stated plainly so C3 is not flattered: T3a did not lower the relay count; it removed the
blocker that made lowering it impossible. The fall is now demonstrable and remains unproven — see the epic
closure note.*

**Telemetry (task closure):**
- task:        M18-T3a (superseding M18-T3, closed unmerged)
- wall-clock:  2026-07-09 ~21:30 (T3a baton) → 23:0x (merge) (~1.5 h; 3 gate-2 rounds, 1 gate-3 round)
- budget:      claude weekly 38%→6% [meter reset/jitter — LB-11; treat as unreliable], session 61%; codex weekly 36%→51% (Δ ~15%)
- gate:        tsc 0, suite 297/297, client tests 2 files, pollution clean (post-sweep), live A/B PASSED (A fails, B passes)
- diff:        AgentTalk 3 files (+247/-2, docs+evidence); client 2 files (+132/-3), commits 4e8c93b · 8c4dc95
- outcome:     MERGED ✅ (PO-gated; BL-017 → done)
