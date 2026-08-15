# Brief — [[BL-149]]: make the measurement a command, because the last one was lost

**Subject item:** [[BL-149]] in `design/backlog/50-containment.md`.
**Bar:** `design/operator/bl149-bar.md` (pre-registered; its hash travels with the authorization).
**Run identifier and config:** assigned by the PO at authorization time, not here.

---

## ⚠️ NOT YET AUTHORIZED — and that is deliberate

**Authorization is not mine to write, so it is not written.**

To authorize this rung the **PO** creates one file, `design/po/<run>.authorized`, whose **entire** content is the
line `[PO] AUTHORIZED-RUN: <run>` — and commits it so it is reachable from `master`. The verifier refuses any
`repo-sha` that is not an ancestor of `master`, so **the merge is the authorization act**.

## 1. Goal — the item, and the deliverable

> Implement backlog item BL-149 — produce a tool that computes the discard rate between two commits of the same
> document: deleted lines over the base line count, bounded [0,1], with added lines reported **alongside and
> never folded in**. It must refuse to emit a number when the comparison is not meaningful. Commit on your
> branch.

The authoritative statement of the task is the committed backlog item — read [[BL-149]] in
`design/backlog/50-containment.md`.

## 2. The premise, verified by SYMBOL rather than by line number

Re-verified by hand on 2026-08-16 at master `5d3a9c0`. **Re-derive every coordinate yourself.**

**The formula already exists and is already specified.** In
`modules/containment/docs/brief-authoring-rung-plan.md`, grep for `DISCARD RATE`:

```
D    = deleted-line count from:  git diff --numstat W..P -- <the document>
base = line count of the document at W:  git show W:<the document> | wc -l
DISCARD RATE = D / base          ← bounded [0,1]
A    = added-line count, recorded ALONGSIDE, never folded in
```

with thresholds **≤30% success · 30–60% inconclusive · >60% refuted, abandon rather than tune**.

**It has already been wrong once, and the correction is the interesting part.** Grep the same document for `not
computable`: the original formula read *"lines changed / lines produced"*, which **cannot be computed** — under
`--numstat` a rewritten line counts once as added and once as deleted, so a full rewrite of a 150-line document
scores 200%. It was caught at gate 1, and the note there is worth reading: *"a pre-registered threshold that
cannot be computed is worse than none, because it looks rigorous."*

**The measurement it exists for was never taken.** In `design/operator/hmp8-grading.md`, grep for `R9`: *"not yet
computable — discard rate needs the PO's edit commit on top of `43fa42e`."* Then run
`git log --oneline -- design/operator/bl122-brief.md` — **exactly one commit, ever**. The edit never happened,
the subject item was closed by PO decision two days later, and the verdict of the brief-delegation experiment was
lost. **The thresholds were real** — one of them was *abandon* — so what was lost is not a statistic but a
decision.

**This is why the deliverable is a tool and not a procedure.** The procedure has exactly one step people forget:
the edit must be made **on the worker's file**, not written fresh alongside it. Forget it and the number is
**unrecoverable**, not merely late.

## 3. What this run is, and is not

**Is:** a small new script, its tests, and its npm wiring. Additive.

**Is not:** a licence to make `hmp8`'s number retrospectively computable. It is not computable, and **fabricating
the missing commit — or "reconstructing" the PO's edit — would manufacture the exact evidence this item exists to
protect.** See §5c.

**Is not:** a judgement about whether brief-delegation succeeded. The tool computes; the PO decides against the
thresholds.

**Is not:** a general diff-statistics library. One number, one companion number, one refusal condition.

**Is not:** a merge. Commit to your branch and stop.

## 4. The hazard specific to THIS rung — a number that is wrong is worse than no number

Everything about this rung is small except the consequence of getting it subtly wrong. **A discard rate is a
threshold input**: 28% and 34% are different decisions, and 61% is *abandon the experiment*. A tool that computes
confidently from a comparison that does not mean what it appears to mean produces a decision-grade number out of
noise.

**The refusal condition is therefore part of the deliverable, not a nicety.** The metric is only meaningful when
**P is an edit of W's file** — the same path, with W in P's ancestry. If the "edited" version was written fresh
alongside the original, `--numstat` will happily return numbers, and they will be meaningless: a fresh file that
happens to be similar can score near 0% discard while sharing nothing, and a legitimately preserved file can
score 100% if compared against the wrong base.

**⚠️ SHOW-STOPPER: if you find the specified formula cannot be computed as written** — if `--numstat` does not
yield separable added and deleted counts for the cases that matter, or if the [0,1] bound does not hold on a real
pair — **STOP and report it with the failing case. That is a success.** This formula has been wrong once already
and was caught by someone reading it against what the command actually returns. Reading it against the command
again is exactly your job.

## 5. Four plausible wrong answers — all four can look green

### 5a. Reintroducing the original broken formula — **it reads more natural than the correct one**

"Lines changed over lines produced" is the phrasing a person reaches for, and it is the one that was already
rejected. It exceeds 100% on any rewrite. If your output can exceed 1.0, you have rebuilt the defect.

### 5b. Folding the added lines into the ratio — **hiding the failure it exists to expose**

`A` is recorded **alongside**, never inside. The plan is explicit about why: *"a brief with a 10% discard rate
and 200 added lines was not a success, and the single ratio would have hidden that."* Discarding what the worker
wrote and supplying what it missed are **different failures**, and one number cannot carry both.

### 5c. Producing a number for `hmp8` — **fabricating the evidence**

You will notice `hmp8`'s R9 is open and be tempted to close it. It cannot be closed: the required commit does not
exist. **Creating one, or computing against some other base and labelling it R9, invents the measurement.** The
honest output for that input is a refusal.

### 5d. Computing silently when the comparison is meaningless — **the quiet failure**

Two unrelated commits, a renamed path, a base that is not an ancestor: `--numstat` answers all of these without
complaint. **Detect and refuse, with the reason named.** A refusal a human can act on beats a number a human will
trust.

## 6. Scope

**May write:** a new script under `scripts/`, its tests under `scripts/__tests__/`, and the npm script entry in
`package.json`.

**May read:** anything in this repo.

**May NOT write:** `modules/containment/docs/brief-authoring-rung-plan.md` — **the formula's home; if you believe
it is wrong, report it, do not edit it** — any `*-grading.md` (most especially `hmp8-grading.md`, whose open R9
is a record, not a defect), `design/operator/bl122-brief.md` or any brief, the ledger,
`design/backlog/**` (including BL-149's own entry), `AGENT.md`, the launcher, or any engine code. The primary
checkout `/Users/fausto/Software/AgentTalk` must remain byte-identical.

The Implementer Rules of Engagement you inherit through this repo's `CLAUDE.md` govern in full.

## 7. Refuting this brief is a valid outcome

If §2 is wrong — if the plan's formula differs from what is quoted here, if `bl122-brief.md` has more than one
commit, if `hmp8`'s R9 has since been computed — **say so with evidence and stop.**

Note that this rung has an unusually clean refutation path: the formula is a claim about what a command returns,
and you can just run the command. **Doing that and reporting a discrepancy is a better outcome than a tool built
on an unchecked formula.**

## 8. Containment

Port **3600**, never the orchestrator's (**3741** is the live one). Sandbox `att-op-<run>`, a worktree of
AgentTalk, on its own branch.

Since [[BL-117]] `cap.meter` **no longer terminates anything** — demoted to a warning after it killed complete,
verified work on `hmp5` fourteen seconds after the worker committed. **`cap.wallClockMs` is the only rail that
will stop this rung.** This is the smallest of the six after [[BL-150]]; set it tightly.

## 9. Grading — check both coordinates

- `<workdir>` — for the `claude` provider on the persistent path the process cwd is session-level and is the
  assigned workdir, so the work is expected **here**.
- `<workdir>/agentalk-task-<taskId>/` — the nested task worktree, usually left empty by `claude`.

An artifact check at the wrong coordinates is worse than none ([[BL-053]] / [[BL-059]]).

Report what you did, what you verified and how, and anything you could not check. **State explicitly which real
commit pair you tested against**, and if you could not find a real pair in this repo, say so rather than testing
only against fixtures you made.
