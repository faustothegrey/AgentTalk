# BL-138 — a committed, tested `--expect` declaration for operator runs

**Status:** awaiting gate 1 · **Planner:** Claude, 2026-08-15 · **Item:** [[BL-138]] (premise retracted and
rescoped before planning — read that correction block first)

---

## 0. In one sentence

Stop hand-typing the operator's write allowlist at every run: commit it once as
`scripts/operator-run.expect.json` *(path corrected at gate 1 — see G1)*, and **test that it does not match
`design/po/**`.**

## 1. What is true today — verified, not assumed

| Claim | Evidence |
|---|---|
| An empty allowlist is the **strictest** state, not the blindest | `classifyHeadMove` returns `foreign` (`infra-invariant.mjs:413-415`) → `critical` (`:793-799`); contract stated at `:400-405` |
| `allowWritePaths` is a **softening** | same lines: *"the softening is narrow on purpose"* |
| Declarations are already used, **ad hoc on the CLI** | hmp2 passed `allowWritePaths: ['design/operator/']`; recorded in `design/operator/hmp4-grading.md` and `hmp3-bar.md:106` |
| Hand-typing has **already failed once** | that hmp2 pattern matched nothing → a `critical` the run did not cause → the whole of [[BL-116]] |
| A wrong pattern still will not gate | `warn` is the deliberate ceiling (`:318-321`) — so the harness **will not catch a bad declaration for you** |
| `matchesWritePath` and `DEFAULT_EXPECT` are exported | `:265`, `:77` — so a bar can assert the committed file directly |

**The value is therefore narrow and honest:** the declaration becomes **versioned, diffable and reviewed**
instead of retyped, and the one exclusion that matters gets a **bar** instead of a habit.

## 2. Scope

**New:**
- `scripts/operator-run.expect.json` — the declaration. **Location changed at gate 1 (G1); see §8.**
- `scripts/__tests__/bl138-operator-expect.test.mjs` — bars against that committed file.

**Edited (docs only):** `design/launch-and-monitor-runbook.md` (the bracket block) and
`design/operator-seat/SKILL.md` (its bracket blocks at `~:400`, `~:520`, `~:584`) — pass `--expect`.

**NOT touched — this task changes no production code:** `scripts/infra-invariant.mjs` (at all),
`DEFAULT_EXPECT`, `matchesWritePath`, `classifyHeadMove`, `exitCodeFor`, any existing test.
**If satisfying this task appears to need a harness change, the plan is wrong — stop and report.**

## 3. The declaration

```json
{
  "allowWritePaths": ["design/backlog.md", "design/operator/**", "design/operator-seat/**"]
}
```

Exactly the charter's list from `AGENT.md` → OPERATOR → Visibility. Three properties, each load-bearing:

1. **`design/po/**` is absent, deliberately.** When the softening is applied, a write to the authorization
   path must stay `foreign`. This is the item's only real safety content — and it *preserves* [[BL-137]]'s
   exclusion rather than creating detection.
2. **Directories are `dir/**`, never `dir/`.** Matching is end-to-end (`:265-277`); `design/operator/` matches
   nothing. That is the exact hmp2 mistake.
3. **`allowWritePaths` only.** No `allowNewWorktrees` / `allowNewBranches` / `allowPorts` — `DEFAULT_EXPECT`
   already ships those, and re-declaring them would add unmatched-pattern warns for no gain.

## 4. Bars

- **B1** every key in the file is a key of `DEFAULT_EXPECT` (the BL-116 typo class)
- **B2** it matches a real lawful write in each declared root: `design/backlog.md`,
  `design/operator/hmp9-brief.md`, `design/operator-seat/SKILL.md`
- **B3** ⭐ **it does NOT match `design/po/<run>.authorized`** — the load-bearing bar; if someone later adds
  that path, this goes red
- **B4** it does not match an unrelated path (`src/index.ts`, `AGENT.md`)
- **B5** the hmp2 regression, made concrete at gate 1 (G2): **for every pattern in the committed file, assert
  it matches at least one representative path.** A pattern matching nothing *is* the hmp2 defect
- **B6** the file parses as JSON and is committed at HEAD

## 5. Definition of Done

| # | Row | Verified by |
|---|---|---|
| D1 | the declaration covers every lawful operator root | B2 |
| D2 | **`design/po/**` is not matched** | B3 |
| D3 | no unknown keys | B1 |
| D4 | no bare-directory pattern (no hmp2 repeat) | B5 |
| D5 | both bracket sites pass `--expect` | read the diff — runbook + SKILL |
| D6 | **zero production-code changes** | `git diff --name-only` contains no `scripts/infra-invariant.mjs` |
| D7 | `tsc -b` 0, full suite green | run it |

## 6. What this does NOT do — so the item cannot be over-read a second time

- **It does not add detection.** A `design/po/` write during a bracketed run is `critical` **today**, with no
  declaration at all. This keeps that true while turning down the noise around it.
- **It makes the harness report LESS.** That is the point of a softening, and it is a real trade: lawful
  operator commits stop firing criticals, and the reviewer stops learning to ignore them.
- **It does not protect against a bad declaration.** `warn` is the ceiling, so a future edit that adds
  `design/po/**` would **not** be caught by the harness — only by **B3**. That bar is the whole fence here.
- **It is housekeeping.** The status quo is stricter, merely noisier. A reviewer may legitimately conclude it
  is not worth doing.

## 7. Open question for gate 1

- **q1** ~~Should the file live inside the seat's own write allowlist?~~ **ANSWERED AT GATE 1 — no. See G1.**

---

## 8. Gate 1 (plan reviewer, 2026-08-15) — **APPROVED ✅, two corrections applied**

**Independence: absent** (same actor as planner). Every claim below was **re-derived by running the matcher**,
which is the only part of this review that does not depend on who wrote the plan.

**Verified by execution** — `matchesWritePath` against the proposed declaration:

| Path | Result | Expected |
|---|---|---|
| `design/backlog.md` · `design/operator/hmp9-brief.md` · `design/operator-seat/SKILL.md` | **true** | ✅ lawful roots covered |
| **`design/po/hmp1.authorized`** | **false** | ✅ **the load-bearing exclusion holds** |
| `src/index.ts` · `AGENT.md` | false | ✅ no over-reach |
| the hmp2 mistake — `['design/operator/']` vs `design/operator/.hmp-launched.json` | **false** | ✅ bare `dir/` really does match nothing |
| `DEFAULT_EXPECT` keys | `allowNewWorktrees, allowNewBranches, allowPorts, allowProcesses, allowWritePaths` | ✅ B1 is checkable |

### G1 — [substantive, REQUIRED] the plan put the declaration inside the seat's own write allowlist

q1 proposed `design/operator/operator-run.expect.json` and defended it with *"the declaration only ever
loosens what is **reported**, never what is permitted, and B3 is the actual guard."* **That defence does not
hold, and the shape should be familiar: it is [[BL-137]] one level down.**

- The seat could add `design/po/**` to **its own declaration**, so its authorization write reports `allowed`
  instead of `foreign`.
- **B3 would not catch that during a run.** B3 is a suite bar — it runs in CI or on a developer's machine, not
  inside the bracket. Widen the file, run, revert, and that run's report is clean.
- The charter calls the harness safe *"precisely because it cannot change anything."* An operator-writable
  declaration does not change what the harness **does**, but it changes what the harness **concludes** — and
  the seat's whole product is a report.

**Correction applied: the file moves to `scripts/operator-run.expect.json`.** `scripts/` is outside the
allowlist (`design/backlog.md` + `design/operator/**` + `design/operator-seat/**` — verified), so the harness
and its declaration now live together, both beyond the seat's reach. Zero extra cost: `--expect` takes any
path.

### G2 — [minor, REQUIRED] B5's mechanism was hand-waving

*"no pattern is a bare directory … asserted against the real matcher, not by eyeballing"* never said **how**.
Concrete replacement, which catches the hmp2 class directly rather than by proxy:

> **B5** — for **every** pattern in the committed file, assert it matches at least one representative path.
> A pattern matching nothing is precisely the hmp2 defect, and it is exactly what `unmatchedDeclarations`
> would `warn` about at runtime — where `warn` is the ceiling and therefore will not save anyone.

### G3 — [recorded, not a defect] D5 *is* a behaviour change, and that is the deliverable

After this, lawful operator commits stop firing `critical` in a bracketed run. §6 states the trade honestly
and the PO's "proceed with rescoped BL-138" covers it — recorded so no later reader mistakes it for a side
effect. **The reviewer's note:** the real benefit is that a reviewer stops learning to ignore criticals, which
is the failure mode a permanently-red signal always produces.

**Cleared for implementation** with G1 and G2 applied above.

---

## 9. Gates 2 + 3 — implementation review and closure sweep, 2026-08-15

**Held together and declared as such.** The task changed **no production code** (D6), so the two seats' work
collapses to one sweep. **Independence absent at every seat** — same actor throughout, under the
resource-scarcity fallback. Declared, not mitigated.

| DoD | Verdict | Evidence — re-run at the gate, not read off the implementation |
|---|---|---|
| D1 lawful roots covered | **VERIFIED ✅** | B2; `matchesWritePath` true for all three roots + `.hmp-launched.json` |
| D2 **`design/po/**` not matched** | **VERIFIED ✅** | B3 + mutation **N1** (add `design/po/**` → 3 bars die, B3 among them) |
| D3 no unknown keys | **VERIFIED ✅** | B1 + mutation **N3** (mistype the key → 6 of 7 bars die) |
| D4 no dead pattern | **VERIFIED ✅** | B5 + `unmatchedDeclarations` → `[]` + mutation **N2** (hmp2's bare `dir/` → 3 bars die) |
| D5 both brackets pass `--expect` | **VERIFIED ✅** | grep: 3 `check` sites, all carrying the flag (runbook `:289`, SKILL `:402`, `:584`) |
| D6 **zero production-code changes** | **VERIFIED ✅** | `git diff --name-only` — one new JSON, one new test, two docs. `infra-invariant.mjs` absent |
| D7 suite + tsc | **VERIFIED ✅** | **805 passed / 95 files**, `tsc -b` 0 |

### The defect this task caught in its own artifact

**The first version of the declaration carried a `_comment` key** — the natural way to document a JSON file
with no comment syntax. Running `unmatchedDeclarations` against it produced a **`warn`** (BL-116's
unknown-key finding), and **a warn takes an otherwise clean bracket from exit 0 to exit 1**. Shipping it would
have made **every operator run fail**, in an item whose entire purpose is reducing false alarms.

Caught by testing the artifact rather than assuming JSON comments are inert. The rationale moved into the test
file — which is where the enforcement lives anyway — and the JSON is now four lines of pure data.

### Mutation run

| # | Mutation | Bars killed |
|---|---|---|
| N1 | add `design/po/**` to the declaration | **3**, including ⭐B3 |
| N2 | hmp2's bare `design/operator/` | **3** |
| N3 | mistype `allowWritePaths` → `allowWritePath` | **6** |

Every mutation kills bars, and **B3 dies only to N1** — the defect it exists for.

### Carried into the merge, unresolved by design

- **The fence on this file is the suite, and nothing else.** An over-wide declaration warns at most, and
  `warn` is BL-116's deliberate ceiling — so the harness will never catch a future edit adding `design/po/**`.
  **B3 is the only guard.** Do not weaken it to accommodate a future path.
- **This makes the harness report less.** Lawful operator commits stop firing `critical`. That is the
  deliverable, not a side effect (gate 1, G3), and the benefit is that a reviewer stops learning to ignore a
  permanently-red signal.

**Telemetry (task closure):**
- task:        BL-138
- wall-clock:  2026-08-15 18:45 → 19:05 (~20m)
- budget:      weekly ~31%, session ~45% (Δ ~5% for this item)
- gate:        tsc 0, suite 805/805 (95 files), pollution clean
- diff:        4 files (2 new), no production code
- outcome:     **READY TO MERGE — PO-gated**
