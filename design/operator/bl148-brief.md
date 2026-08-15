# Brief — [[BL-148]]: a checker for pre-registered bars, because one shipped that no delivery could satisfy

**Subject item:** [[BL-148]] in `design/backlog/50-containment.md`.
**Bar:** `design/operator/bl148-bar.md` (pre-registered; its hash travels with the authorization).
**Run identifier and config:** assigned by the PO at authorization time, not here.

**Read this first:** you are building a checker for the class of document that is grading *you*. That is not a
paradox and it grants you nothing — **your own bar was written before this brief and is not yours to touch** (see
§6). But it does mean the corpus you are working over includes the document you will be judged against, and you
should expect that to feel strange.

---

## ⚠️ NOT YET AUTHORIZED — and that is deliberate

**Authorization is not mine to write, so it is not written.**

To authorize this rung the **PO** creates one file, `design/po/<run>.authorized`, whose **entire** content is the
line `[PO] AUTHORIZED-RUN: <run>` — and commits it so it is reachable from `master`. The verifier refuses any
`repo-sha` that is not an ancestor of `master`, so **the merge is the authorization act**.

## 1. Goal — the item, and the deliverable

> Implement backlog item BL-148 — produce a checker for pre-registered bars that proves each row is individually
> falsifiable, that the rows are mutually satisfiable **for the known contradiction shapes**, that no row pins an
> absolute suite total while another row requires adding tests, and that the document is clean under the
> recursion fence. **State plainly what it catches and what it does not.** Commit on your branch.

The authoritative statement of the task is the committed backlog item — read [[BL-148]] in
`design/backlog/50-containment.md`.

## 2. The premise, verified by SYMBOL rather than by line number

Re-verified by hand on 2026-08-16 at master `5d3a9c0`. **Re-derive every coordinate yourself.**

**The failure is real, is named, and is still in the tree.** In `design/operator/hmp7-bar.md`:

- Grep for `## R4`. It reads: *"The test suite is unchanged at **722/722, 86 files** — same count, no skipped,
  no weakened assertions."*
- Grep for `## R2 `. It reads: *"A **parity test** exists and drives the `send_to_agent → user` path while
  capturing the ordered sequence of emitted `status` and `session_status` events…"*

**A new parity test file changes the suite count. R4 forbids the count changing. No delivery could satisfy
both.** That bar was written by a human, committed to master, PO-authorized, and launched. The contradiction was
found only at grading, and `hmp7-grading.md` records the disposition: *"R4 not met as written; PO-disposed…"*

**The correction was written down at the time, and writing it down is all that has happened since.** Grep
`design/backlog/90-closed.md` for `never pin a fixed suite total` — *"never pin a fixed suite total on a rung
that also requires a new test."* It has been a sentence in a closed backlog item ever since.

**Why the existing controls do not cover this.** `modules/containment/docs/brief-authoring-rung-plan.md` §3b
states it outright — grep for `unauthorized`: the PO committing and authorizing a bar is *"a control against an
**unauthorized** bar, not an **incoherent** one."* That same plan then keeps bar-authoring human **because
incoherence has no mechanical check**, while conceding that human authorship produced the one known incoherent
bar. **Build the check and that reasoning changes** — which is why this item is the highest-value one on the
board.

**The corpus.** `design/operator/*bar*.md` — **20** documents before this rung's own two. Note two naming eras:
`<run>-bar.md` (pre-registered) and `<run>-bar-real.md` (older). Row headings are not uniform: some use
`## R4 — …`, some use table rows, some use `### R1a`. **Do not assume a single format; measure the corpus before
choosing a parse.**

## 3. What this run is, and is not

**Is:** a new checker, its tests, and its npm wiring. Additive.

**Is not:** a licence to edit any historical bar. `hmp7-bar.md` in particular is **evidence** — it is the one
recorded instance of the defect, and it is this rung's most important test fixture. Fixing it would destroy the
fixture and the record in one move.

**Is not:** a general theorem prover over English. See §4 — the honest limit is the deliverable here, not a
caveat on it.

**Is not:** a decision about whether bar-authoring gets delegated. That call is the PO's. This item only makes it
available.

**Is not:** a merge. Commit to your branch and stop.

## 4. The hazard specific to THIS rung — overclaiming is the failure mode, not underdelivering

**Mutual satisfiability is not decidable in general over prose.** Any checker you build will catch some
contradiction shapes and miss others. That is acceptable and expected. **What is not acceptable is a checker that
does not say so.**

Think about what this tool is *for*: it is the control that would let a bar be written by something other than a
careful human. **A checker that claims more than it proves licenses exactly the delegation it is too weak to
protect** — and the failure would show up later, as an incoherent bar that passed a green gate, which is strictly
worse than today's state where at least everyone knows a human is the only check.

So: **start from the known contradiction shape** — a pinned absolute suite total alongside a row requiring a new
test — because that one actually occurred. Add shapes you can defend. **Then write down, in the tool's own output
and in your report, what it does not catch.**

**⚠️ SHOW-STOPPER: if you conclude that the only honest checker is too narrow to be worth having** — that it
would catch the one historical case and nothing else, and would therefore mislead more than it helps — **STOP and
report that with reasons. That is a success.** A finding that this control cannot be built honestly at useful
strength is more valuable than a weak checker that gets cited as one.

## 5. Four plausible wrong answers — all four can look green

### 5a. A checker that claims general mutual-satisfiability detection — **the most dangerous outcome**

It will pass its own tests, catch `hmp7`, and be described in a commit message as proving the rows are mutually
satisfiable. **The first bar it wrongly greenlights will have been authorized on its word.** Scope the claim to
what is proved.

### 5b. Rewriting historical bars until the checker passes over the corpus — **destroying the evidence**

The tempting shape: run the checker over 20 documents, get failures, "fix" the documents. Those bars are the
record of nine autonomous runs; `hmp7-bar.md` is the single instance of the defect. **A diff touching any
existing bar fails the scope row regardless of merit.** Historical failures are *findings to report*, not
breakage to repair.

### 5c. A vague heuristic that cannot itself be falsified — **an opinion with a number next to it**

"Rows should be clear and specific" is not checkable. If a row of your checker cannot be demonstrated firing on a
concrete input and not firing on another, it does not belong in the tool — the same standard the tool is being
built to enforce.

### 5d. Tuning until the corpus is all-green — **fitting the gate to the data**

If 20 bars pass on the first run, the likeliest explanation is that the check is vacuous, not that the corpus is
perfect. **`hmp7-bar.md` must fail.** If it does not, the checker does not work, whatever else it reports.

## 6. Scope

**May write:** a new checker under `scripts/`, its tests under `scripts/__tests__/`, and the npm script entry in
`package.json`.

**May read:** anything in this repo.

**May NOT write:** any existing `*bar*.md` under `design/operator/` — **including
`design/operator/bl148-bar.md`, the bar you are being graded against.** Also: any `*-grading.md`, any brief, the
ledger, `design/backlog/**` (including BL-148's own entry), `AGENT.md`,
`modules/containment/docs/brief-authoring-rung-plan.md`, the launcher, `scripts/infra-invariant.mjs`, or any
engine code. The primary checkout `/Users/fausto/Software/AgentTalk` must remain byte-identical.

**On `LAUNCH_PATTERNS`:** your checker includes a recursion-fence cleanliness check, which means calling the
existing exported predicate. **Call it; do not modify it, and do not widen it.** If a legitimate bar trips it,
that is a finding about the bar — never a reason to touch the patterns.

The Implementer Rules of Engagement you inherit through this repo's `CLAUDE.md` govern in full.

## 7. Refuting this brief is a valid outcome

If §2 is wrong — if `hmp7`'s R4 and R2 are in fact mutually satisfiable and the grading disposition was mistaken,
if the corpus has a uniform structure this brief claims it lacks — **say so with evidence and stop.**

The strongest result this ladder has produced was a worker refuting the finding of the item that commissioned it,
with a live probe that held on independent reproduction. **An unevidenced claim fails here, in either
direction.**

## 8. Containment

Port **3600**, never the orchestrator's (**3741** is the live one). Sandbox `att-op-<run>`, a worktree of
AgentTalk, on its own branch.

Since [[BL-117]] `cap.meter` **no longer terminates anything** — demoted to a warning after it killed complete,
verified work on `hmp5` fourteen seconds after the worker committed. **`cap.wallClockMs` is the only rail that
will stop this rung.** This is the largest of the six ladder items; set it generously but bounded, and expect the
corpus survey to be the slow part.

## 9. Grading — check both coordinates

- `<workdir>` — for the `claude` provider on the persistent path the process cwd is session-level and is the
  assigned workdir, so the work is expected **here**.
- `<workdir>/agentalk-task-<taskId>/` — the nested task worktree, usually left empty by `claude`.

An artifact check at the wrong coordinates is worse than none ([[BL-053]] / [[BL-059]]).

Report what you did, what you verified and how, and — **specifically for this rung** — an explicit statement of
what your checker does **not** catch. That statement is part of the deliverable, not a disclaimer attached to it.
