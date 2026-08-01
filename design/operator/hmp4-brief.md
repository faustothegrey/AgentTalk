# Run `hmp4` — operator brief: the worker changes the instrument that grades it

**Rung:** the fourth commission carried over HMP, and the first where the file under repair is the **grader's own
harness**. **Plan:** `design/hmp-session-submission.md` §3.
**Bar:** `design/operator/hmp4-bar.md` (pre-registered; its hash travels in the commission).
**Config:** `design/operator/hmp4.config.json`. **Backlog item:** [[BL-116]].

---

## ⚠️ NOT YET AUTHORIZED — and that is deliberate

**Authorization is not mine to write, so it is not written.**

To authorize this run the **PO** creates one file, `design/operator/hmp4.authorized`, whose **entire** content is
the line `[PO] AUTHORIZED-RUN:` followed by the run id — and commits it so it is reachable from `master`. The
verifier refuses any `repo-sha` that is not an ancestor of `master`, so **the merge is the authorization act**.

Unchanged from the three rungs before it, and still not ceremony: the whole design rests on authorization being a
thing a message cannot assert and an agent cannot mint. An author who writes the `[PO]` line for their own brief
has forged precisely what the check exists to protect, and the check would still be green. Its being undone is
the evidence that the fence binds its author.

## 1. Goal — a property, not a file

> `scripts/infra-invariant.mjs` merges an `--expect` file over its defaults and **never inspects the
> declaration**. A mistyped key, or a pattern that matches nothing, is accepted in silence and contributes
> nothing — so the harness fails closed onto an innocent run and reports a `critical` the run did not cause.
> Make a declaration that cannot have had any effect **say so**, at severity `warn` and never higher.

The goal names a **property** rather than a path, because [[BL-094]]'s root cause was a goal that named a *file*
where it should have named a property, and produced a run that satisfied the letter of its brief while missing
the point.

The authoritative statement of the task is the committed backlog item, not this paragraph — read [[BL-116]] in
`design/backlog.md` inside your worktree. A brief that restates its source can drift from it and then contradict
the thing it was derived from.

## 2. What this run is, and is not

**Is:** the first rung where the worker repairs **the instrument that grades operator runs**. See §3 — it is
safe, and the argument for why is one you should check rather than take on trust.

**Is:** a rung with **more than one plausible shape**. Where the new check lives, what it is given to inspect,
and how the four allowlists differ from one another are all open. §4 names three specific wrong answers, two of
which go green on a naive bar.

**Is not:** evidence about long runs. The cap is 45 minutes. Nowhere near [[BL-096]]'s failure class, and **no
result here may be cited against BL-096**, in either direction.

**Is not:** evidence that the worker did the work. An acknowledgement over the wire means the message was
answered. `completed` has never meant done here. **Grade the artifact, at the coordinates where the process
actually stood** ([[BL-053]] / [[BL-059]]).

**Is not:** a merge. The worker commits to `task-op-hmp4` and stops. Mainline is reached only by a PO-gated
merge, and the operator seat may never perform one.

## 3. The hazard specific to THIS rung — argued, not assumed

**The worker edits the harness that computes this run's own grade.** That deserves a real argument rather than a
reassuring sentence, so here is the mechanism:

- The bracket around this run — `snapshot` before, `check` after — is executed by the **primary checkout's** copy
  of `scripts/infra-invariant.mjs`, invoked by the grader from `/Users/fausto/Software/AgentTalk`.
- The worker edits **its own copy**, inside `/tmp/att-op-hmp4`, which is a linked worktree on branch
  `task-op-hmp4`. Nothing it writes there is visible to the primary checkout's file until the **PO merges**.
- Therefore the instrument that grades this run is, for the entire duration of this run, the **unmodified**
  version — the same code that graded `hmp1`, `hmp2` and `hmp3`.

This is sharper than `hmp2`'s hazard, where the worker fixed the tool that had built its own sandbox. Here the
tool is the grader. **A grading harness that silently graded a run using code that run had just modified would be
worthless**, and "it was fine" would not be a finding — so the separation above is the thing that makes this rung
legitimate, and a grader should confirm it rather than assume it (bar row R6).

**The corollary, which cuts the other way:** because the grader is still running the *unfixed* harness, the very
footgun this item is about is **live for exactly this run**. Whoever brackets it must test the `--expect`
declaration by hand before trusting anything it reports. That is bar row R7, and it exists because this mistake
has now caught the same author three times.

## 4. Three plausible wrong answers — two of them go green

This is the part of the brief that matters. Each of these is a shape a competent worker might reach for.

### 4a. Loosening the matcher — **forbidden, and the item says so**

`matchesWritePath` anchors its pattern end to end, so `design/operator/` matches nothing and `design/operator/**`
is the correct form. The tempting repair is to treat a trailing `/` as an implicit `/**`, which would make the
typo pass.

**Do not.** The anchoring is correct and deliberate. That change would quietly **widen the operator write
fence** — the one thing that fence exists to hold — and it would do so at every future call site, silently. A
matcher that guesses the author's intent is a worse defect than one that reports an unused declaration.
**Report the mismatch; do not guess the intent.**

### 4b. Reporting the built-in defaults as unmatched — **breaks a clean run, which is the bug one level up**

`DEFAULT_EXPECT` is not empty. It ships `allowNewWorktrees: ['att-op-*', 'att-*/agentalk-task-*']`,
`allowNewBranches: ['task-*']` and `allowPorts: [3600]`, and `loadExpect` merges the declaration **over** those.
A check that inspects the merged object therefore sees those patterns on **every** run — including a run that
changed nothing at all, where by construction they match zero candidates.

The result would be a harness that reports findings on a byte-identical run. That is precisely *"a new way to
gate a clean run"* — the failure mode this item was filed to prevent, reintroduced by its own fix.

**The property that must hold:** `describe('BL-087 DoD row 6 — a clean run is clean')` in
`scripts/__tests__/infra-invariant.test.mjs` **passes untouched**. If satisfying this task appears to require
editing that test, the fix is wrong, not the test. **Modifying it is a weakened contract and a finding, not a
repair.** How you keep it green is yours to decide.

### 4c. Raising the severity — **`warn`, never `critical`**

A `critical` gates the next operator run until the PO clears it. A check that fires `critical` on an unused
allowance would hand the harness a brand-new way to block work over a declaration that harmed nothing.

**There is a real false-positive case here that must be tolerated rather than engineered away:** a legitimately
unused allowance — you declared a path the run happened not to write. That is why the message must read
**"declared but never matched"** and not **"invalid"**. The harness does not know which one it is looking at, and
saying so honestly is the whole point.

**The floor and the ceiling, stated so the middle is yours:**

- **Ceiling — `warn`, never `critical`.** No sub-case, however obviously a typo, earns a `critical`.
- **Floor — the two historical cases must actually fire at `warn`.** `allowWritePaths: ["design/operator/"]`
  against a diff in which `design/operator/.hmp-launched.json` was written **must warn** (that is the live
  `hmp2` instance, [[BL-116]]'s own evidence). A misspelled key such as `allowWritePath` or `allowedWritePaths`
  **must warn** (that is the same bug one level up, and the harder half — it merges cleanly, contributes
  nothing, and is indistinguishable from correct fail-closed behaviour).
- Between those two, whether some narrower sub-case deserves `info` instead of `warn` is a judgement you may
  make **and must argue in your report**. What you may not do is demote the two floor cases.

## 5. One consequence you will meet, and how to dispose of it

`exitCodeFor` already returns **1** for a `warn` as well as a `critical`. So a new `warn` on an otherwise clean
bracket turns an exit `0` into an exit `1`.

**That is an accepted consequence of the fix as specified, not a defect to repair.** `exitCodeFor` is **out of
scope** — changing it would alter established behaviour that other checks depend on, which is Rule 2
show-stopper territory. **Do not touch it, and do not dodge the consequence by demoting a floor case to `info`.**
State the consequence plainly in your report so the grader knows to expect it.

If you conclude that this consequence makes the specified fix wrong, **say so with evidence and stop** — see §7.

## 6. Scope

**May touch:** `scripts/infra-invariant.mjs` and `scripts/__tests__/infra-invariant.test.mjs`.

**May NOT touch:** anything else. [[BL-116]] is a signal-quality item with no urgency attached, so there is no
pressure that could justify reaching further. The Implementer Rules of Engagement you inherit through `CLAUDE.md`
govern in full — in particular Rule 2: **a bug found outside this scope is reported, not fixed.**

**Two existing contracts in that test file are guardrails, not obstacles:**

- **DoD row 6 — "a clean run is clean"** — see §4b. Must pass untouched.
- **DoD row 7 — "exposes no repair verb"** — the harness must not contain `worktree prune`, `worktree remove`,
  `branch -D`, `branch -d`, `reset --hard`, `process.kill`, `checkout`, or `git add`, **anywhere in its source,
  including inside a comment or a string**. This is a substring scan over the whole file. A new diagnostic
  message that happens to quote one of those phrases will fail the suite, and it will be a correct failure.

## 7. Refuting this brief is a valid outcome

`hmp2`'s most valuable output was its worker demonstrating, with evidence, that its item's own suggested fix
could not have worked. If the reasoning in §4 or §5 is wrong — if the two checks cannot be separated cleanly, if
the floor cases conflict with each other, if the exit-code consequence is worse than the defect — **say so with
evidence and stop.** That is worth more than a green run, and it is graded on the quality of the evidence.

What fails is an **unevidenced** claim, in either direction.

## 8. Containment

Port **3600**, never 3500. Sandbox **`att-op-hmp4`** (`/tmp/att-op-hmp4`, branch `task-op-hmp4`).
`cap.wallClockMs` and `cap.meter` both set.

**One honest limit, named because the charter calls `cap.meter` mandatory and a reader deserves to know what it
buys.** The meter reader in the client repo's start script coerces a missing `used_percent` to **`0`** rather
than reporting a failed read, so during any interval in which the provider's block returns `ok:false`
(intermittent, [[LB-11]]) the delta computes negative and **the resource rail silently never fires while
appearing healthy** ([[BL-114]]). **`cap.wallClockMs` is the only rail that may honestly be claimed here.**
Pre-existing, filed separately, **not** a defect of this run and not to be graded as one.

**Observed at the time of writing:** the `claude` block returns `ok:false`. Record the budget delta as
**unavailable** rather than as `0` if that holds through the run.

## 9. Grading — check both coordinates, and state what is at each

- `<workdir>` — for the `claude` provider on the persistent path the process cwd is session-level and is the
  assigned workdir, so the work is expected **here**.
- `<workdir>/agentalk-task-<taskId>/` — the nested task worktree the orchestrator provisions, usually left empty
  by `claude`.

An artifact check at the wrong coordinates is worse than none: it manufactures false confidence and a paper
trail. That is [[BL-053]] / [[BL-059]], and it has already cost this project a defect that never existed.

**This brief was written against the recursion fence** — the verifier refuses a brief that reads as instructing
its receiver to start further sessions, so certain phrasings are avoided here deliberately rather than by
accident.
