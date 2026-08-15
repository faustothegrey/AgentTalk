# Bar for [[BL-147]] — pre-registered

**Subject:** a gate proving every recorded run leaves a grading artifact.
**Brief:** `design/operator/bl147-brief.md`. **Pre-registered before any work exists; do not edit after
authorization.**

---

## ⚠️ Mutual-satisfiability check — done before the rows were finalised

Because of `hmp7`, whose **R4 pinned the suite at 722/722 while its R2 required a new test file** — no delivery
could satisfy both, and it was found only at grading ([[BL-148]]).

| Pair | Satisfiable together? | Why |
|---|---|---|
| **R2 (the check fails on a missing document) × R3 (`hmp6` is exempted so the suite is green)** | **Yes — and this is the pair that could most easily have been made contradictory** | R2 is proved by **temporarily removing the exemption and observing red**, R3 by the committed end state. A bar phrased as "the check must fail on `hmp6`" × "the suite must be green" *would* be unsatisfiable, and would have looked perfectly reasonable. This pair is why the mutual-satisfiability section exists. |
| **R4 (no `*-grading.md` is written) × R3 (`hmp6` is resolved)** | **Yes** | R3 is resolved by an **exemption record**, which is not a grading document. If the only way you can satisfy R3 is by writing `hmp6-grading.md`, the correct move is R7, not a scope breach. |
| **R5 (suite health) × R2 (a new test file is required)** | **Yes** | **R5 is a DELTA, never an absolute total.** Designed out, not avoided by luck. |
| **R6 (scope) × R3 (an exemption record may be a new file)** | **Yes** | R6 admits the exemption record explicitly as an in-scope artifact. |

---

## R1 — the run ends in one of exactly two legitimate ways

**(a) The artifact.** The check, its test, its npm wiring and the exemption record are committed on the task
branch.

**(b) A reasoned refusal.** A written argument that the exemption mechanism is the wrong answer — that a
suppression record is worse than an honest permanent red, or that this convention belongs somewhere other than a
repo check — with reasons.

Anything else is **not met**. **(b) is a PASS** and R8 governs it.

### R1a — the shape of outcome (a)

`git show --stat HEAD` shows the check, its test, `package.json`, and **at most one** exemption record. Nothing
else.

## R2 — THE ROW THIS RUNG EXISTS FOR: the check actually bites

**Proved by breaking it, not by reading it.** With the `hmp6` exemption temporarily removed, running the check
**fails**, and its output **names `hmp6`**. Restore the exemption and it passes.

**Falsified if:** the check passes with the exemption removed; its failure output does not identify which run is
missing a document; or the demonstration is asserted in the report rather than performed.

**This row is the heaviest.** *"I wrote a check"* and *"the check discriminates"* are different claims, and only
the second is worth anything. A gate never observed failing is a gate nobody has evidence works.

## R3 — the ledger is the iteration source, and `hmp6` is resolved by exemption

- The implementation iterates **`design/operator/.hmp-launched.json`** and looks up a document per entry.
  **Falsified if** it walks `*-grading.md` and asks the reverse question — that shape is green today and blind by
  construction (brief §5b).
- **`hmp6` is resolved by an exemption record that names where its verdict actually lives** — the backlog item it
  delivered. **A bare id in an array is NOT met**: an exemption without a destination is a suppression list.

## R4 — no grading document was written, and the corpus is untouched

`git status --porcelain design/operator/` is **empty**, and `git diff --name-only` touches **no** `*-grading.md`,
no brief, no bar, no config, no authorization file, and not the ledger.

**This is the row the item exists to protect.** Back-filling `hmp6-grading.md` from a backlog item nine days
after the fact would manufacture an artifact indistinguishable in the tree from twelve written against live runs.
**A delivery that does this is REFUTED regardless of every other row.**

## R5 — nothing else moved (expressed as a DELTA, deliberately)

- `npx tsc -b` exits **0**.
- The suite passes, and **the only change in test count is the tests this rung adds**. No pre-existing test
  removed, skipped, weakened or renamed.

No absolute total is pinned, because R2 requires a new test file.

## R6 — scope held

`git diff --name-only` touches only: the new check, its test, `package.json`, and at most one exemption record.

**Falsified by any modification to** `design/operator/**` beyond the exemption record if you place it there,
`design/backlog/**`, `AGENT.md`, `scripts/infra-invariant.mjs`, the launcher, or engine code.

## R7 — the show-stopper path, if it is taken

If the worker concludes the exemption mechanism is wrong, the report argues it with reasons, **and no exemption
record and no grading document are written.** A show-stopper correctly raised and correctly not acted on is a
PASS on this row.

## R8 — a reasoned refusal is a PASS

R1(b) is graded on the argument's quality, not on the absence of a check. **An unevidenced refusal is not met.**

## R9 — containment

- Task branch in the `att-op-*` sandbox; **no merge, no push** by the worker.
- Primary checkout byte-identical afterwards, save the ledger entry written there by design.
- Port 3600 released; no orphaned provider process.

---

## How the rows are weighted

| Row | Weight | How it is checked |
|---|---|---|
| **R2** — the check bites, demonstrated | **heaviest — the deciding row** | remove exemption → run → observe red → restore |
| **R4** — no grading document written | **heaviest, and disqualifying** | `git status --porcelain design/operator/` |
| **R3** — ledger-driven, exemption names a destination | **heavy** | read the implementation and the record |
| R1/R1a | gating | `git show --stat` |
| R5 | gating | `tsc -b`, suite |
| R6/R9 | gating | `git diff --name-only` |
| R7/R8 | conditional | apply only on the path taken |

**R4 is disqualifying on its own.** Every other row can be met perfectly and the delivery still REFUTED if a
grading document was written — because the whole point of the item is that the gap must be *recorded*, not
*filled*.
