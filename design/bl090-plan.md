# BL-090 — the invariant harness goes quiet instead of loud (plan)

**Planner: Claude, 2026-07-27.** Sole-agent fallback; gates kept separate.
**Status: awaiting the PO's decision on §3, then gate 1 (plan approval).**
**Item:** [[BL-090]] · **Rider:** [[BL-089]] (§6) · **Subject:** `scripts/infra-invariant.mjs`

Both defects re-verified in code by me before planning — not taken from the backlog entry.

## 1. Defect A — an unreadable repo skips every check and does not gate

`infra-invariant.mjs:325-328`:

```js
if (before.unavailable || after.unavailable) {
  at('repo-unavailable', SEVERITY.WARN, `${name}: ${after.unavailable ?? before.unavailable}`);
  return;                                  // ← every check below is skipped
}
```

`return` skips the HEAD check, the branch check, upstream divergence, worktrees, branches and porcelain. The
PO's gate is on **`critical`** (`bl087-plan.md` §9.1), so a mistyped or missing repo path produces **no gating
and no checking**, while the run still reports as inspected. This is the failure mode a safety harness must not
have.

**The early `return` is not the defect — the severity is.** With `critical`, returning early is correct and
desirable: it gates loudly *and* skips comparisons that would be meaningless anyway. That is the smaller,
safer fix, and it is what §3 proposes.

## 2. Defect B — `diffRepo` compares by key, never by path

`snapshotRepo` **already records `path`** (`:166`, `:170`, `:180`) — the data is present and simply never read.
The caller (`:471-482`) matches purely on the key name, so two snapshots whose `agenttalk` key points at
different directories are silently diffed against each other.

Measured (backlog, reproduced): `/Users/fausto/Software/AgentTalk` vs `/private/tmp/att-op-2` →
**three false `critical`s** (`head-moved`, `branch-changed`, `upstream-diverged`) on the path that gates the
operator seat. Nothing detects that the two sides describe different repositories.

## 3. ⚠️ The two behaviour changes — PO decision required

Both alter the severity model, so neither is mine to make.

### Decision A — `repo-unavailable`: `warn` → `critical`

*"We could not look" must never outrank "we looked and it was fine"* — the BL-023 `UNKNOWN` discipline applied
one level up.

**The tradeoff, stated plainly.** `resolveRepos` (`:525-529`) **always** watches a `client` key, defaulting to
`../agentalk-mcp-client`. On a machine where the client repo is absent or elsewhere, this fix makes **every**
operator run emit a `critical` — and a `critical` **gates the next operator run** until the PO clears it. A
misconfiguration therefore becomes a hard stop rather than a warning.

I judge that correct rather than unfortunate: the config *is* wrong, `--client` / `$AGENTTALK_CLIENT_REPO` fix
it, and the alternative is exactly the silence BL-090 was filed about. The finding text will name the remedy.
**Not a risk on this machine** — `../agentalk-mcp-client` resolves (verified).

**Sub-decision:** unavailable on **both** sides is the mistyped-path case, so it must gate too. Restricting
`critical` to one-sided unavailability would leave the reported defect standing. Proposal: **any** unavailable
side ⇒ `critical`.

### Decision B — path mismatch ⇒ `critical`

`diffRepo` compares `before.path` to `after.path`; a mismatch emits `path-mismatch` at `critical` and returns.
This **replaces** the three false criticals with one true one. Returning early is right for the same reason as
§1: every later comparison is meaningless once the two sides describe different repositories.

## 4. Scope

**May touch:** `scripts/infra-invariant.mjs` (`diffRepo` only) · `scripts/__tests__/infra-invariant.test.mjs`
(new bars) · this plan · the backlog item.
**May NOT touch:** the snapshot functions, `snapshotGlobal`, the CLI surface, the allowlist model, the
port/process logic, `git()`, or any file outside `scripts/`.

**Deliberately out of scope — an adjacent finding, reported not fixed.** `inspection-unavailable`
(ports/processes) is also `warn` (`test:304`), which is the same *"could not look"* class. It does **not**
return early, so it is not fail-quiet in the same shape, and BL-090 names only `diffRepo`. **Flagging, not
touching** — the PO may file it separately.

## 5. Definition of Done

| # | Row | Bar |
|---|---|---|
| D1 | `repo-unavailable` is `critical` when the **before** side is unavailable | new bar |
| D2 | …when the **after** side is unavailable | new bar |
| D3 | …when **both** sides are (the mistyped-path case) | new bar |
| D4 | A path mismatch emits exactly one `path-mismatch` `critical` | new bar |
| D5 | A path mismatch emits **no** `head-moved` / `branch-changed` / `upstream-diverged` — the false trio is gone | new bar (the regression that motivated this) |
| D6 | Matching paths behave exactly as before | new bar (parity) |
| D7 | The existing **29 bars** stay green | `npx vitest run scripts/__tests__/infra-invariant.test.mjs` |
| D8 | Full suite green, `tsc -b` 0 | `npx tsc -b && npx vitest run` |
| D9 | The harness still reports and never repairs | the existing repair-verb scan bar |

**No existing bar asserts `repo-unavailable`'s severity** (checked: the `unavailable` assertions at
`test:290-309` cover `inspection-unavailable` and a snapshot shape, not this). So this changes **no existing
test contract** — the new severities arrive as *added* bars, not as edits to established ones.

## 6. Rider — [[BL-089]]

`git()`'s `.trim()` (`:129`) eats the leading space of porcelain line 1, so an unstaged-only first entry loses
its filename's first character and reads as staged. **Fix at the parse site** (`:173-177`), never in `git()` —
every other caller depends on that trim. Same file, independent bar, no severity implications.

## 7. Method

Per-task worktree (mandate), branch off `master`, explicit staging. Retry budget **2 attempts per bar**.
`npm run backlog:check` after the backlog edit. Merge and push stay PO-gated and are separate words.

**Independence caveat:** I author and review this. The verdict comes from running the bars, never from
re-reading the diff.
