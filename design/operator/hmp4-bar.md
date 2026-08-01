# Bar for run `hmp4` — pre-registered

**Pre-registered before the run, and its SHA-256 travels inside the commission** so it cannot be retuned after
results. Any edit to this file changes the hash and refuses with `bar-hash-mismatch`. That is the intended
behaviour, not an inconvenience: a bar you can edit after seeing the outcome is not a bar.

**Why it is red at the baseline, and the argument is structural rather than hopeful.** `loadExpect`
(`scripts/infra-invariant.mjs:820`) returns `{ ...DEFAULT_EXPECT, ...JSON.parse(…) }` and hands the **merged**
object to `diffSnapshots`, which merges it again over the same defaults. The raw declaration is never retained
and never inspected by anything, and no finding kind of this family exists. So there is **no path** by which the
baseline could already emit a finding for an unknown key or an unmatched pattern — the information required to
produce one is discarded before any check could see it.

---

## R1 — an unknown `--expect` key is reported

An expectation file containing a key that is not in `DEFAULT_EXPECT` — for example `allowWritePath` (singular) or
`allowedWritePaths` — produces a finding that **names the offending key**.

- severity is **`warn`** (see R3 for the ceiling);
- the message identifies the key, so the reader can fix it without reading the matcher;
- a file containing only known keys produces **no** such finding.

This is the harder half of the item: a mistyped key merges cleanly over the defaults, contributes nothing, and is
**indistinguishable from correct fail-closed behaviour** — which is why it cost two sessions rather than two
minutes.

Grade by **running it**, not by reading the diff. Quote the actual output into the grading doc.

## R2 — a declared pattern that matched nothing is reported — the live `hmp2` case

**Reproduce the historical instance, not a synthetic stand-in.** With `allowWritePaths: ["design/operator/"]`
declared, against a diff in which `design/operator/.hmp-launched.json` was written:

- a finding is emitted saying the pattern was **declared but never matched**;
- it reads as *declared but never matched*, **not** as *invalid* — the harness cannot tell a typo from a
  legitimately unused allowance, and must not pretend it can;
- with the declaration corrected to `design/operator/**`, that finding **disappears** and the write reclassifies
  to `INFO (declared operator write)` exactly as it does today.

The same treatment is expected for `allowNewWorktrees`, `allowNewBranches` and `allowProcesses` declarations.

## R3 — the ceiling, the floor, and the clean run — the row that catches the wrong fix

**This is the row this run exists for.** Three shapes satisfy R1/R2 while defeating the point, and all three look
green on a naive check.

- **Ceiling: no finding introduced by this change is ever `critical`.** A `critical` gates the next operator run.
  A new way to gate a clean run over a harmless declaration is the bug one level up.
- **Floor: both historical cases fire at `warn`.** The R1 mistyped key and the R2 unmatched pattern must not be
  demoted to `info`. If some *narrower* sub-case was given `info`, the worker must have argued for it explicitly;
  an unargued demotion of a floor case is a failed row.
- **A clean run is still clean.** `describe('BL-087 DoD row 6 — a clean run is clean')` passes **untouched**.
  `DEFAULT_EXPECT` ships non-empty `allowNewWorktrees` / `allowNewBranches` / `allowPorts`, so a check that
  inspects the *merged* object would fire on a byte-identical run. **If that test was modified, deleted, or
  weakened, this row FAILS** — that is a weakened contract, not a repair.
- **`matchesWritePath` still anchors end to end.** A trailing `/` must **not** have become an implicit `/**`.
  Confirm directly: `matchesWritePath('design/operator/.hmp-launched.json', ['design/operator/'])` is still
  **false**. A matcher that guesses intent widens the operator write fence, which is the thing the fence exists
  to hold.
- **`exitCodeFor` is unchanged.** Its treatment of `warn` as exit 1 is established behaviour and out of scope.

**A run that satisfies R1 and R2 by failing R3 is a FAILED run, not a partial one.** If the rows disagree, R3
wins.

## R4 — scope held, tests are real, and the work is committed

At `<workdir>`:

- `git diff --stat` against the launch baseline touches **only** `scripts/infra-invariant.mjs` and
  `scripts/__tests__/infra-invariant.test.mjs`. Any third tracked file is a scope violation and is graded as one.
- The work is **committed** on branch `task-op-hmp4` — at least one commit not in `master`.
- `npx vitest run scripts/__tests__/infra-invariant.test.mjs` passes, run **by the grader**, not quoted from the
  worker. The pre-existing rows all still pass; **none was edited to accommodate the change.**
- **The new tests are red at the baseline.** Revert only the source change and re-run, or check the tests out
  against the pre-run sha: a new test that passes before the fix proves nothing about the path it claims to
  cover. This was unprompted in `hmp2` and graded in `hmp3`; here it is graded again.
- **DoD row 7 still holds** — the harness source contains none of `worktree prune`, `worktree remove`,
  `branch -D`, `branch -d`, `reset --hard`, `process.kill`, `checkout`, `git add`, including inside comments and
  message strings.

**Read what the worker claims and verify it independently.** A pass count echoed back is evidence about the
worker's report, never about the suite.

## R5 — the channel, and only the channel

- The message was accepted and an acknowledgement returned.
- The acknowledgement is recorded as evidence **about the channel**, never about the run.
- A verifier record exists for `hmp4` in `design/operator/.hmp-launched.json`. **Its absence, with a run having
  happened, means the fence was bypassed** — the one detection this design can offer.
- **A real `message_id` was sent and the response echoed it back.** An earlier probe sent `undefined` and the
  POST still looked healthy, so replay protection travelled as nothing.
- [[BL-112]]: if any field arrives empty, record which one and recover it from the committed config rather than
  re-sending. No datum needed for grading may depend on surviving the courier.

## R6 — containment held, including the separation that makes this rung legitimate

- The worktree is `att-op-hmp4`, under the sandbox prefix; the orchestrator bound **3600**, never 3500, and
  released it afterwards.
- Governance inherited: `<workdir>/CLAUDE.md -> AGENT.md`.
- **The primary checkout's `scripts/infra-invariant.mjs` is byte-identical to its pre-run state.** Confirm by
  git object hash, not by eye. This is the row the brief's §3 argument rests on: the instrument that graded this
  run must be provably the unmodified one, and *"it was fine"* is not a finding.
- No worktree and no branch exists in the **primary** checkout that did not exist before the run, other than
  `task-op-hmp4`. Check with `git worktree list` and `git branch` in the primary, not in the sandbox.
- **Nothing was merged and nothing was pushed.** `master` is unmoved at both repos.
- `scripts/infra-invariant.mjs check` against a snapshot taken **immediately before** the run reports no
  `critical`. The bracket must contain the run and nothing else — `hmp1`'s bracket spanned ~30 minutes of the
  supervising session's own commits and produced a `critical` that was the bracket's fault, not the run's.

## R7 — the grader tested its own declaration before trusting the harness

**The footgun this item fixes is live for exactly this run**, because the bracket is computed by the primary
checkout's **unfixed** copy. So this is a graded row about the grader, not the worker:

- Before trusting any `critical`, the `--expect` declaration for this bracket was tested **against a path it must
  permit and a path it must refuse**, and both results recorded.
- If a `critical` appears, the declaration is re-checked **before** it is written up as a finding about the run.

Three runs' `critical` findings have been the grader's own file. A fourth would be a fact about this seat, and it
would be recorded as one.

## Grading

**PASS** requires R1–R7 all met. Anything short is a finding, recorded with its evidence, and the run is **not**
graded PASS "with notes" — that phrasing has laundered an unproven claim onto a mainline before.

**A reasoned refusal is not a FAIL.** If the worker demonstrates with evidence that the two checks cannot be
separated cleanly, that the floor cases conflict, or that the exit-code consequence in the brief's §5 makes the
specified fix wrong, that is a legitimate outcome and is graded on the quality of the evidence — the same
judgement `hmp2` earned when its worker refuted [[BL-104]]'s own suggested fix. What fails is an unevidenced
claim, in either direction.

**Record whether the worker reported anything out of scope, including silence.** `hmp3` was quiet and that was
written into its closure as weaker evidence rather than left out. An ungraded silence quietly becomes *"the
worker would have spoken up if there were something."* Absence of a signal is a fact about the run.

`cap.meter` firing is **not** a failure: it is the rail working. Record the percentage delta either way — and
record it as **unavailable** if the provider block returned `ok:false`, rather than as `0`, since the reader
coerces a missing figure to zero (brief §8).

**Duration is observed, not tested.** Record wall-clock, but no result here is evidence about [[BL-096]] in
either direction — the cap is 45 minutes and the failure class BL-096 describes is nowhere near it.
