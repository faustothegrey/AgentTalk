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
