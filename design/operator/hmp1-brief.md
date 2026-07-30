# Run `hmp1` — operator brief: prove the channel, write nothing

**Rung:** the first commission carried over HMP. **Plan:** `design/hmp-commission-plan.md` §3.
**Bar:** `design/operator/hmp1-bar.md` (pre-registered; its hash travels in the commission).
**Config:** `design/operator/hmp1.config.json`.

---

## ⚠️ NOT YET AUTHORIZED — and that is deliberate

**Authorization is not mine to write, so it is not written.**

To authorize this run the **PO** creates one file, `design/operator/hmp1.authorized`, whose **entire** content
is the line `[PO] AUTHORIZED-RUN:` followed by the run id — and commits it to `master`. The verifier refuses any
`repo-sha` that is not an ancestor of `master`, so **the merge is the authorization act**. Until both happen, a
commission for `hmp1` refuses with `no-po-authorization`.

> **Why a separate file rather than a line in this brief** — and this is not tidiness, it is a live refutation.
> The first mechanism looked for the line *in the brief*. It then **accepted this very brief**, whose entire
> purpose is to say the run is unauthorized, because the paragraph above **quoted** the required line as an
> example. A line-anchored matcher cannot tell an example from the real thing, and stripping code fences would not
> have saved it: an indented block or a blockquote quotes the line just as well. Found by running the CLI, two
> hours after Gate 1 caught the *same* vacuous-pass shape in the same check. A discrete file whose whole content
> must equal the line is immune to quotation by construction — which is why this document can now safely describe
> the format in prose without authorizing itself.

**Why the author of the fence did not simply authorize their own run:** the entire design rests on the
authorization being a thing a message cannot assert and an agent cannot mint. An implementer who writes the `[PO]`
line into the brief has forged precisely what the check exists to protect, and the check would still be green —
the worst possible combination. So this is left undone on purpose, and its being undone is itself the first
evidence that the fence binds its own author.

## 1. Goal — a property, not a file

> Report the repository's current `HEAD` sha and the test suite's pass and skip counts. **Change no files.**

The goal names a **property** (*nothing is modified*) rather than a path, because [[BL-094]]'s root cause was a
goal that named a **file** instead of a property, and it produced a run that satisfied the letter of its brief
while missing the point.

## 2. What this run is, and is not

**Is:** a proof that a commission can travel from a supervising session to a resident operator, be verified
against committed content, and produce a contained run with a graded artifact.

**Is not:** evidence that long runs work. This one is minutes. [[BL-096]] — the long-run failure class — remains
entirely untested, and no result here may be cited against it. The same caution the O-3/O-4 runs earned applies.

**Is not:** evidence that the worker did the work. An acknowledgement over the wire means the message was
answered — *Notificato ≠ Allineato*, which is the protocol's own way of stating this project's rule that
`completed` has never meant done. Grade the artifact.

## 3. Grading — read §"Grading" of the bar, then these two coordinates

Check the worker's output at **both** paths and state what is at each:

- `<workdir>` — for the `claude` provider on the persistent path, the work lands **here**, in the parent.
- `<workdir>/agentalk-task-<taskId>/` — the nested task worktree, usually left empty by `claude`.

An artifact check at the wrong coordinates is worse than none: it manufactures false confidence and a paper
trail. That is [[BL-053]]/[[BL-059]], and it has cost this project a defect that never existed.

## 4. Containment

Port **3600**, never 3500. Sandbox **`att-op-hmp1`**. `cap.wallClockMs` and `cap.meter` both set — the meter is
mandatory here because the worker draws on the same provider pool as the session grading it.
