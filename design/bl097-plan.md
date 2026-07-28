# BL-097 — the operator write fence, mechanised

**Status:** plan · written 2026-07-28 by Claude (planner) · PO chose **fork (i): the operator commits**
**Item:** [[BL-097]] · **Predecessors:** [[BL-087]] (the harness), [[BL-090]] (the false-critical lesson),
[[BL-093]] (`autonomy`/`blocked_by`), the OPERATOR charter amendment `7948ea4`

## 1. The problem, in one paragraph

The charter now lets the operator **commit** to `design/backlog.md` and `design/operator/**`. The harness treats
a HEAD move as `CRITICAL` and *"never allowlisted"* (`infra-invariant.mjs:369-372`), a divergence change as
`CRITICAL` (`:378-381`), and a tracked-file change as `CRITICAL` (`:424`). So the operator's **first lawful
write fires three criticals**, and a critical gates the next operator run. Fix the false fire first; only then
is an allowlist check worth adding, because otherwise it grades noise (the [[BL-090]] lesson).

## 2. Scope

**MAY touch:** `scripts/infra-invariant.mjs` · a new test file
`apps/orchestrator/src/__tests__/bl097-operator-write-fence.test.ts` · `design/backlog.md` (the item) ·
this plan.
**MAY NOT touch:** the orchestrator/engine, `check-orchestrator-ports.mjs`, `bl093-backlog-selectable.test.ts`
(the tripwire is not to be loosened), any existing harness finding not named below.

**"Done" =** an operator run that writes only inside the allowlist produces **no critical**; a run that writes
anywhere else still produces one; **any** change to the agent-selectable set produces a critical that no
allowlist can suppress; and a run with no allowlist configured behaves **exactly** as today.

## 3. Design

### 3a. `allowWritePaths` — fail closed

`DEFAULT_EXPECT` gains `allowWritePaths: []`. Empty ⇒ today's behaviour, byte for byte. Only an expect file
naming paths (via the existing `--expect`, which already merges over `DEFAULT_EXPECT` at `:570-574`) softens
anything. No new CLI flag is needed.

### 3b. Commit-range paths — captured at SNAPSHOT time, because the diff must stay pure

`diffSnapshots` is documented as pure — *"the part the bars drive with synthetic state"* (`:329-330`). So it
**must not** shell out to `git diff before..after`. Instead `snapshotRepo` records a bounded window:

```
commits: [{ hash, paths: [...] }, …]   // git log --format=… --name-only -n 50
```

The diff then walks `after.commits` back until it reaches `before.head` and unions the paths — pure, and
drivable with synthetic fixtures like every other check.

`classifyHeadMove(before, after, allowWritePaths)` → one of:

| Result | Meaning | Severity |
|---|---|---|
| `none` | heads equal | no finding |
| `allowed` | every path in the range matches the allowlist | `info` — `head-moved-declared` |
| `foreign` | **any** path falls outside | `critical` — `head-moved` (message preserved) |
| `undetermined` | `before.head` not within the captured window | `critical` |

**`undetermined` is critical on purpose** — the BL-023/BL-090 discipline that *"we could not look"* must never
outrank *"we looked and it was fine."* A window overflow must not read as permission.

**One foreign path poisons the whole range.** No partial credit: a commit touching `design/backlog.md` **and**
`server.ts` is foreign.

**A commit with ZERO paths is `undetermined`, not `allowed`** *(caught at gate 1 — plan review)*. An empty
commit, and more importantly a **merge commit** (`git log --name-only` prints no paths for one by default),
would otherwise satisfy *"every path matches"* **vacuously** and sail through as an allowed write. That is the
allowlist's worst failure mode: a merge is precisely what the operator may never do, so the one commit shape it
is most important to catch is the one an empty path set would wave past. Zero paths ⇒ we could not see what it
did ⇒ `critical`. DoD row 11.

### 3c. The two dependent findings

- **`upstream-diverged`** softens to `info` only when the head move classified `allowed` **and** `behind` is
  unchanged (a `behind` move is someone else's fetch, not our write).
- **`tracked-file-modified`** softens to `info` per-path when the path matches `allowWritePaths`; every
  non-matching path stays `critical`.

### 3d. The selectable-set check — never allowlistable

`snapshotRepo` records the **effective selectable set**: `autonomy: eligible` ∧ `status: todo` ∧ every
`blocked_by` id `done`/`dropped`. Absent backlog ⇒ `SKIPPED` (the existing collected-but-empty vs.
not-collected discipline, `:71-73`). Any add or removal ⇒ **`critical` `selectable-set-changed`**, unaffected
by `allowWritePaths`.

**Why the effective set and not the raw `autonomy` field:** the set an agent may be handed also moves
**indirectly** — by writing `blocked_by`, or by flipping a blocker to `done`. The charter forbids all three, so
the check watches the thing that actually matters.

**Duplication is deliberate, and fenced.** The extractor re-implements `parseBacklog`/`selectableBacklogItems`
in dependency-free `.mjs` because the harness must run when the build is broken — it is infrastructure safety.
DoD row 8 pins the two against each other on the real backlog so they cannot drift.

## 4. Definition of Done

| # | Row | Bar |
|---|---|---|
| 1 | No allowlist ⇒ unchanged | head move with `allowWritePaths: []` is still `critical` |
| 2 | Allowed write | range touching only `design/backlog.md` ⇒ `info`, zero criticals |
| 3 | Foreign write | range touching backlog **and** `server.ts` ⇒ `critical` |
| 4 | Window overflow | `before.head` outside the window ⇒ `critical`, never silent |
| 5 | Tracked file | inside allowlist ⇒ `info`; outside ⇒ `critical` |
| 6 | Divergence | softens only on `allowed` + unchanged `behind` |
| 7 | Selectable set | any change ⇒ exactly one `critical`, even with allowlist set |
| 8 | No drift | harness extractor agrees with `parseBacklog` on the real `design/backlog.md` |
| 9 | Mutation check | each new check demonstrably **fires** — a negative test per check, not just a positive |
| 10 | Gates | `npx tsc -b` 0 · full suite green · `npm run backlog:check` exit 0 |
| 11 | Empty-path commit | a zero-path (merge/empty) commit in the range ⇒ `critical`, never vacuously allowed |

## 5. Op notes

- Worktree: `node scripts/wt-setup.mjs create bl097 --base master` → `/private/tmp/att-bl097`, `task-bl097`.
- Stage **explicitly**, `git status` **after** committing (the trap that fired two sessions running).
- Merge is the task-end reviewer's; **push is the PO's**.
