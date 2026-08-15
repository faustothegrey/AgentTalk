# Bar for [[BL-146]] — pre-registered

**Subject:** an instrument that reports where the autonomy ladder stands.
**Brief:** `design/operator/bl146-brief.md`. **Pre-registered before any work exists; do not edit after
authorization.**

Rows are numbered so a grader can dispose of each one individually. **Every row below states an observable
outcome** — a command that can be run and an output that can be read — because a row that cannot be falsified is
not a bar row, it is an opinion with a number next to it.

---

## ⚠️ Mutual-satisfiability check — done before the rows were finalised

This section exists because of `hmp7`, whose **R4 pinned the suite at 722/722 while its R2 required a new parity
test file**. No delivery could satisfy both. It was committed, PO-authorized and launched, and the contradiction
was found only at grading. That failure is the subject of [[BL-148]]; this bar does not get to repeat it.

| Pair | Satisfiable together? | Why |
|---|---|---|
| **R2 (the tool reports all 9 runs) × R3 (no verdict is ever inferred)** | **Yes** | R2 requires a *row* per run; R3 constrains what may fill the verdict *cell*. `missing` and `unparsed` are reporting outcomes, not gaps in R2. |
| **R4 (a test over the REAL corpus) × R6 (the corpus is not modified)** | **Yes — and this is the pair most easily made contradictory** | The test reads `design/operator/*-grading.md` as fixtures **in place**. A bar phrased as "pin the corpus in a fixture directory" × "add no files outside `scripts/`" would have been unsatisfiable and would have looked reasonable. |
| **R5 (suite health) × R4 (a new test file is required)** | **Yes, and deliberately so** | **R5 is expressed as a DELTA, never as an absolute total.** This is the `hmp7` R4 defect and it is designed out rather than avoided by luck. |
| **R7 (show-stopper path) × R1 (delivery)** | **Yes** | R1 admits two legitimate endings; a reasoned refusal *is* one of them. |

---

## R1 — the run ends in one of exactly two legitimate ways

**(a) The artifact.** The script, its test and its npm wiring are committed on the task branch.

**(b) A reasoned refusal.** A written finding that the corpus cannot be classified honestly without editing it,
naming the specific files and shapes that defeat classification.

Anything else — a partial script left uncommitted, a claim of completion without a commit, silence — is **not
met**. **(b) is a PASS**, and R8 governs how it is judged.

### R1a — the shape of outcome (a)

`git show --stat HEAD` on the task branch shows **a new script under `scripts/`, a new test, and `package.json`**
— and nothing else. A delivery touching a fourth file fails R6 rather than this row; this row is about the
delivery being a coherent, committed unit.

## R2 — THE ROW THIS RUNG EXISTS FOR: every recorded run is reported, and the three states are distinguished

Running the tool prints **one row per ledger entry — all 9**, `hmp1` … `hmp9`.

Each row carries a verdict cell holding **either** a verdict read from a grading document **or** one of two
explicitly distinct classifications:

- **`missing`** — no grading document exists for this run. **`hmp6` must land here.**
- **`unparsed`** — a grading document exists but no verdict could be read from it honestly.

**Falsified if:** any run is absent; `hmp6` is reported as anything other than *no grading document*; or the two
classifications are collapsed into one indistinguishable state.

**This row is the heaviest.** The item's whole complaint is that the ladder's position cannot be read off an
instrument, and conflating "ungraded" with "undocumented" is the specific way an instrument here lies.

## R3 — no verdict is ever inferred, and the column-header trap is not fallen into

- **`hl2`, `hl3` and `o4` must NOT report a verdict of `Verdict`.** Their first `Verdict` match is a table column
  header (`| Block | Score | Threshold | Verdict |`), not a result. Whatever they report, it is not that string.
- **`o3` must not be reported as an error.** Its grading document deliberately withholds the verdict — *"The rung
  verdict itself is the PO's to issue."* Reporting it as `unparsed`, or as a named "withheld" state, both pass;
  reporting it as `PASS`, or crashing on it, does not.
- **No verdict is derived from anything but a grading document.** Not from a merge, not from the item's status,
  not from the branch. **Falsified if** the implementation reads `design/backlog/**` or git history to fill a
  verdict cell.

## R4 — a test exercises the REAL corpus, not a hand-made one

A committed test runs the parser against `design/operator/*-grading.md` **as they exist in the repo** and pins,
at minimum:

- the four genuine verdict shapes — bold inline, heading, table row, title-line suffix;
- **at least one column-header case** (`hl2`, `hl3` or `o4`) asserting it is *not* read as a verdict;
- `hmp6` classified as having no grading document.

**Falsified if** the test only exercises synthetic strings. A parser proved against fixtures its author wrote is
proved against its author's assumptions — and every real shape in this corpus was written by someone who did not
know a parser was coming.

## R5 — nothing else moved (expressed as a DELTA, deliberately)

- `npx tsc -b` exits **0**.
- The suite passes, and **the only change in test count is the tests this rung adds**. No pre-existing test is
  removed, skipped, weakened, or renamed to avoid it.

**No absolute total is pinned here, and that is the point** — R4 requires a new test file, so a pinned total
would make this bar unsatisfiable. See the mutual-satisfiability table.

## R6 — scope held

`git diff --name-only` against the baseline touches **only** the new script, its test, and `package.json`.

**Falsified by any modification to:** `design/operator/**` (most especially any `*-grading.md` or the ledger),
`design/backlog/**`, `AGENT.md`, `scripts/infra-invariant.mjs`, the launcher, or engine code.

**The corpus being byte-identical after the run is checked directly**, not inferred from the diff:
`git status --porcelain design/operator/` is empty.

## R7 — the show-stopper path, if it is taken

If the worker concludes the corpus cannot be classified without editing it, the report names **which files** and
**which shapes** defeat classification, and **no corpus file is modified**. A show-stopper correctly raised and
correctly *not* acted on is a PASS on this row.

## R8 — a reasoned refusal is a PASS

If the run ends in R1(b), it is graded on the quality of the evidence, not on the absence of a script. A refusal
that names the defeating shapes and demonstrates them is worth more than a parser that guesses. **An unevidenced
refusal — "this seems hard" — is not met.**

## R9 — containment

- Work is on the task branch in the `att-op-*` sandbox; **no merge and no push by the worker**.
- The primary checkout `/Users/fausto/Software/AgentTalk` is byte-identical afterwards, save the ledger entry
  written there by design.
- No process left holding port 3600; no orphaned provider process.

---

## How the rows are weighted

| Row | Weight | How it is checked |
|---|---|---|
| **R2** — all 9 runs, three states distinguished | **heaviest — the deciding row** | run the tool, read the output |
| **R3** — nothing inferred, no column-header trap | **heavy** | run the tool; grep the implementation for backlog/git reads |
| **R4** — test over the real corpus | **heavy** | read the test; confirm it reads the repo's files |
| R1/R1a | gating | `git show --stat` |
| R5 | gating | `tsc -b`, suite |
| R6/R9 | gating | `git diff --name-only`, `git status --porcelain` |
| R7/R8 | conditional | apply only on the path taken |

**A delivery that passes R1, R5, R6 and R9 but fails R2 or R3 is NOT PASS.** Those are the rows the item was
filed for; the rest establish that the delivery is a clean, contained unit rather than that it is the right one.
