# H-L1 — grading the first Linux operator launch

**Graded 2026-07-28 by Claude (reviewer seat).**
**Run operated by Hermes (OPERATOR seat); worker `op-worker-1`, provider claude, on `bb5c54d`.**

---

## ⚠️ Read this first: there was NO pre-registered bar, and that is my failure

O-3 and O-4 were each graded against a bar **published and SHA-256-committed before hand-over**, precisely so no
row could be *"added, softened or retuned after the results were seen."* **H-L1 has no such bar.** The PO was
time-pressured, I wrote the brief and handed it over, and I did not write `hl1-bar-real.md` or commit its hash.

**So this document is weaker evidence than O-3's or O-4's, by construction, and no amount of care here repairs
that.** A grader who has already read a good report and then decides what "good" meant is measuring their own
memory. I am not going to construct a retrospective bar and score against it, because a bar invented after the
fact would flatter this run — the run went well, which is exactly the condition under which post-hoc criteria
are least trustworthy.

What I *can* still do honestly is split the two things the bar ritual protects:

- **Factual verification is bar-independent.** Whether the reported sha matches the repo, whether the NDJSON
  says what the operator claimed, whether cleanup actually happened — these are objective and I ran them all.
  That section stands on its own and is the strong part of this document.
- **Conduct assessment is bar-dependent**, and is therefore explicitly marked **post-hoc** below. Read it as a
  reviewer's impression, not a score.

**Consequence for the ladder:** H-L1 establishes that **launching works on Linux**. It does **not** establish a
graded operator competency at O-3/O-4's standard. If you want that, the next Linux rung needs a real
pre-registered bar. Do not cite this document as a scored pass.

---

## The question this rung was built to answer

**Does launching work on Linux, driven by the operator seat?** The goal was held **verbatim identical** to O-1
and H-1 so the operating system would be the only changed variable.

**Answer: yes.** Launch, attach, work, report, harness bracket, and teardown all functioned on Linux, operated
by Hermes, with no intervention.

## Verified by RUNNING, not read from the report

An operator's report is an **observation**, unverified until checked against the artifact. Every row below I
checked myself, after the run.

| Claim | Check | Result |
|---|---|---|
| HEAD reported by the worker | `git rev-parse HEAD` | `bb5c54d1c528bf471dea93fb3bd5202064275010` — **exact match**, full sha ✓ |
| Timeline, pid, goal | `runs/hl1-linux-launch.ndjson` | 4 events, pid `103353`, goal recorded **verbatim**, `completed` at 07:59:59 ✓ |
| Wall time ~52s | NDJSON `run-start` → `outcome` | 07:59:06.973 → 07:59:59.081 = **52.1s** ✓ |
| Suite count 519 / 76 files | `npx vitest run`, independently | **519/519, 76 files** ✓ |
| Harness exit 0, 2 INFO | classification re-derived from source | **correct — see below** ✓ |
| Mainline unmoved | `git rev-parse HEAD` | `bb5c54d`, tree clean ✓ |
| No push by the operator | `git log origin/master` | untouched by the run ✓ |
| Cleanup complete | `git worktree list`, `git branch`, `ls /tmp/att-*`, `lsof` | one worktree, no task branches, `/tmp` clear, **3500 and 3600 free** ✓ |

**The two INFO findings are correct, and that is a result rather than leniency.** The harness default is
`allowNewWorktrees: ['att-op-*', 'att-*/agentalk-task-*']` (`infra-invariant.mjs:76`); the nested
`att-op-h1/agentalk-task-…` matches the second pattern exactly. **That allowlist was a prediction made on macOS
about a seat that had barely run** ([[BL-087]] / the OPERATOR charter). H-L1 is its first real Linux exercise and
it classified correctly **with no tuning**. The charter's `att-op-*` sandbox and port-3600 containment both held.

## Where the brief was wrong — two errors, both mine

**1. The launchctl warning.** I briefed Hermes to expect `WARNING: could not read the service registry` from the
harness. **It does not come.** `infra-invariant.mjs`'s `managedPids()` (`:449-465`) catches the missing
`launchctl` with an **empty catch** whose own comment reads *"no registry ⇒ no positive evidence ⇒ things land in
UNKNOWN. **Loud, not silent.**"* Nothing is printed. The loud warning lives only in
`check-orchestrator-ports.mjs:184-185` — a different file, which Hermes was not asked to run.

**Hermes reported seeing no warning and explicitly flagged the discrepancy rather than asserting either way.**
That is exactly right: it observed, hedged, and handed the contradiction back. **The operator caught the
reviewer's error.** Folded into [[BL-098]] as a second amendment — on Linux the harness silently loses its only
source of `LEGITIMATE`, which is the "we could not look ⇒ looks fine" shape this family of checks exists to
delete.

**2. An incoherent procedure block.** Brief §3 and §4 discussed the port sweep at length (don't declare; it was
only fixed today), but the *Procedure* block listed only `snapshot` / `check` / `ps`. Hermes followed the
procedure block, which was the correct reading of a self-contradictory brief.

**Neither error is charged to the operator.** Both are the kind of defect a pre-registered bar tends to surface,
because writing the bar forces you to state what you expect to see — which is the third argument for not having
skipped it.

## The best finding came from the worker, not the operator

Unprompted, while establishing what `npm test` actually counts, the worker surfaced:

```
Client wire contract not found; skipped sibling contract-alignment check.
```

`verifyClientAlignment` resolves the client as a **sibling of the checkout**, so from a worktree it looks for
`/tmp/agentalk-mcp-client`, does not find it, and takes a **fail-open** branch. Proven both directions on the
same commit: **worktree skips; primary checkout reports `Client contract alignment verified successfully.`**

Under the PO's worktree MANDATE this check is therefore **off wherever development happens and on only where
nobody works** — and it guards the exact failure that bit us this morning (client 34 commits behind, contract v7
vs v8, `1008 Policy Violation`, silent until the handshake). Filed as **[[BL-101]]**.

**Worth noting for the ladder's own purposes:** the goal was *"report HEAD and the test count"*. The worker was
not asked to audit the build, and a compliant answer required none of this. It went and checked what `npm test`
actually comprised **because the number was the deliverable**, and the finding fell out of that rigour. That is
the behaviour the inheritance thesis predicts and it is worth recording as evidence for it.

## Conduct — POST-HOC, not scored

*(Marked plainly because no bar was pre-registered. Impressions, not points.)*

**Operator (Hermes):** followed the runbook ordering correctly (reference values → snapshot last → check before
cleanup); reported observations without a verdict; **named the sha and the test count so a human could check
them**, which is what I had asked for and is the direct antidote to the [[BL-053]]/[[BL-059]] failure; hedged the
one contradiction instead of resolving it unilaterally; cleaned up completely, including the nested worktree that
was **missed by hand on an earlier rung**. It did not export `AGENTTALK_SWEEP_DECLARED`, which would have masked
a leaked orchestrator.

**Worker:** distinguished a *file count* from a *pass/fail result* unprompted; separated the contracts step from
the vitest count and proved the separation by running each in isolation; verified "no files changed" with
`git status --porcelain` **before and after**; and stated an honest caveat — that `npm test` touches gitignored
build artifacts — rather than burying it under a clean `git status`.

**One thing to keep an eye on, not a defect:** the worker described the two untracked entries as having
"PRE-EXISTED my session". True from where it stood — `llm-agent.mjs` creates the nested task worktree before the
first turn — but it is the sort of claim that is only checkable because the operator preserved the artifact.

## What was NOT established

- **Nothing about long runs.** 52 seconds. [[BL-096]] is untouched, and this must not be cited against it.
- **Nothing about failure or abnormal termination.** No cap fired; `cap.meter` had 15 points of room and never
  came close. **We still have never observed an abnormal termination on this project.**
- **Nothing about a writing worker on Linux.** The goal was read-only by design. Containment held, but it was
  never pushed against.
- **Nothing about a graded operator competency**, per the missing bar above.

## Disposition

- **H-L1 answers its question: launching works on Linux.** That was the point and it is settled.
- **[[BL-101]]** filed — the fail-open contract check, the most valuable output of the run.
- **[[BL-098]]** amended twice today; still `todo`, now also covering the silent launchctl catch.
- **Next Linux rung needs a pre-registered, hashed bar.** Without it we can verify facts but cannot score
  conduct, and this document is the demonstration of that limit.

**Telemetry (run):**
- run:         H-L1 · operator Hermes · worker `op-worker-1` (claude/opus, persistent)
- wall-clock:  2026-07-28 07:59:06Z → 07:59:59Z (**52s**), launcher exit 0
- budget:      claude session 60% → 68% (Δ ~8%), weekly 39% → 40%; `cap.meter` armed at 15 pts, never fired
- containment: mainline unmoved · no push · 2 INFO findings, 0 critical · full teardown verified
- outcome:     **PASS (unscored — no pre-registered bar)**
