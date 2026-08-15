# Brief — [[BL-151]]: a scaffold for rung preparation documents, and the trap of generating confidence

**Subject item:** [[BL-151]] in `design/backlog/50-containment.md`.
**Bar:** `design/operator/bl151-bar.md` (pre-registered; its hash travels with the authorization).
**Run identifier and config:** assigned by the PO at authorization time, not here.

---

## ⚠️ NOT YET AUTHORIZED — and that is deliberate

**Authorization is not mine to write, so it is not written.**

To authorize this rung the **PO** creates one file, `design/po/<run>.authorized`, whose **entire** content is the
line `[PO] AUTHORIZED-RUN: <run>` — and commits it so it is reachable from `master`. The verifier refuses any
`repo-sha` that is not an ancestor of `master`, so **the merge is the authorization act**.

## 1. Goal — the item, and the deliverable

> Implement backlog item BL-151 — produce a scaffold that generates, from the existing exemplars, skeleton
> preparation documents for a chosen backlog item, with the structural properties of the plan's §3c present as
> an explicit checklist rather than as prose to remember. Generated text must refer to its outputs **by role,
> never by mechanism**. Commit on your branch.

The authoritative statement of the task is the committed backlog item — read [[BL-151]] in
`design/backlog/50-containment.md`.

## 2. The premise, verified by SYMBOL rather than by line number

Re-verified by hand on 2026-08-16 at master `5d3a9c0`. **Re-derive every coordinate yourself.**

- **The cost is real and repeated.** `wc -l design/operator/hmp9-brief.md design/operator/hmp9-bar.md
  design/operator/hmp7-brief.md` returns **165**, **154**, **158**. Nine rungs have each paid roughly that,
  by hand, from exemplars.
- **The structural properties are already enumerated.** In
  `modules/containment/docs/brief-authoring-rung-plan.md`, grep for `## 3c`. It lists the properties that made
  the `hmp3` and `hmp7` briefs work — each independently checkable by a reader who never saw the item: names the
  item and the concrete deliverable; **verifies the premise by symbol, not line number**; lists **≥2 plausible
  wrong answers that would look green**; declares scope, files in and files explicitly out; states a show-stopper
  and that refuting the brief is a valid outcome; **every bar row individually falsifiable AND the rows mutually
  satisfiable**; no launch-mechanism reference. **Read that section — it is the specification for what you are
  generating.**
- **The plan is explicit that two of those are mechanical and the rest are not.** Grep the same section for
  `read-and-judge`. Rows 6 and 7 can be checked by running something; the others cannot. **That asymmetry is the
  design constraint for this rung** — see §4.
- **The corpus is larger and fresher than the plan assumes.** `ls design/operator/*-brief.md` — and note that
  **six new briefs and six new bars were written on 2026-08-16** for the ladder items [[BL-146]]–[[BL-151]],
  including this one, all to a single structure. They are the best available template evidence, and this brief is
  one of them.
- **The fence is real and it discriminates.** The exported predicate in the launcher refuses seven wordings.
  Verified on 2026-08-16: a goal naming the run ledger **by path** passes, while a wording that asks for a run to
  be *commissioned*, and one that uses the verb *launch* with a worker or session as its object, both **trip**. A
  control set was run alongside to confirm the predicate still fires, so the passes are meaningful rather than an
  artifact of calling it wrongly.

  **⚠️ Read that bullet carefully, because it is written the way it is on purpose — and the first draft was
  not.** The obvious way to document a refused wording is to quote it. Quoting it **puts the refused string in
  your document**, and the document is then refused. This brief tripped its own fence on exactly that, and the
  fix was to *describe* the wordings rather than reproduce them. **Your generator will face the identical
  problem** the moment its template tries to warn an author about forbidden phrasings. Same discipline: describe,
  never quote — and if the generator trips, that is a finding about the generator.

## 3. What this run is, and is not

**Is:** a new scaffold script, its tests, its npm wiring, and a checklist artifact. Additive.

**Is not:** a brief-authoring engine. It generates **structure and prompts**. It does not generate analysis —
see §4, which is the whole of this rung.

**Is not:** a licence to edit any existing brief or bar. They are the template evidence and the historical
record.

**Is not:** a change to the fence. Your generator must produce fence-clean output; if it does not, the finding is
about the generator.

**Is not:** a merge. Commit to your branch and stop.

## 4. The hazard specific to THIS rung — a well-shaped empty brief is worse than a rough good one

This is the item's own warning and it is the reason the rung is not trivial. **A scaffold can lower the cost of
producing documents without raising the quality of the thinking in them.** The failure is not an ugly template;
it is a beautiful one.

Consider what §3c's properties actually are. *"Lists ≥2 plausible wrong answers that would look green"* is a
**structural** requirement whose value is entirely in the **content**. A generator that emits

> ### 5a. [Plausible wrong answer #1 — describe why it looks green]

has satisfied the structure and supplied nothing. That is fine — it is a prompt, and a human fills it. But a
generator that emits a *plausible-sounding* wrong answer it invented from the item's title has supplied something
worse than nothing: **text that reads as analysis, that a hurried author will keep, and that no one verified.**

**The rule follows directly: generate structure and prompts; never generate content that reads as analysis.** A
section header, a question, an explicit `TODO` with what must be established — good. A fabricated premise, an
invented trap, a confident-sounding claim about code the generator never read — forbidden.

**⚠️ SHOW-STOPPER: if you conclude the exemplars are too heterogeneous to template honestly** — that extracting a
common shape would either be so loose as to be useless or so tight as to force real briefs into the wrong form —
**STOP and report it with the specific divergences. That is a success.** A finding that briefs are irreducibly
bespoke would itself be worth knowing, and it would redirect [[BL-152]] rather than waste it.

## 5. Four plausible wrong answers — all four can look green

### 5a. Generating prose that reads as analysis — **the failure this rung is about**

Covered in §4 at length because it is the one that matters. The generated document will *look* better than a
skeleton. It will be worse.

### 5b. Naming the mechanism in generated text — **it trips the fence downstream, at the worst moment**

If the template refers to its outputs by mechanism rather than by role, every document it produces will be
refused at the gate — discovered when someone tries to use it, not when it is written. Worse is the second-order
temptation: **widening the patterns to accommodate the generator.** That is forbidden outright. **A trip is a
finding about the generator, never a reason to touch the fence**, and the bar has a row for exactly this.

### 5c. Copying an exemplar wholesale as the template — **carrying one rung's specifics into every future one**

`hmp9`'s brief is about a documentation sentence and a lazily-opened sink. Its shape generalises; its claims do
not. A template that inherits its §2 will assert things about code the next item never touches.

### 5d. Overfitting to the six ladder items — **a template that works once**

[[BL-146]]–[[BL-151]] are all small, additive, script-shaped items written by one author on one day. They are
**not** representative: past rungs include an engine-code change, a read-only investigation, a client-repo change
and a brief-authoring rung. **Sample across the eras**, not just the fresh six.

## 6. Scope

**May write:** a new scaffold under `scripts/`, its tests under `scripts/__tests__/`, the npm script entry in
`package.json`, and its template/checklist artifact (location argued in your report — under `scripts/` beside the
generator is the default; **not** under `design/operator/`, which is the run corpus).

**May read:** anything in this repo.

**May NOT write:** any existing `*-brief.md` or `*bar*.md` under `design/operator/` — **including this brief and
`design/operator/bl151-bar.md`, the bar you are graded against** — any `*-grading.md`, the ledger, the launcher
and **especially `LAUNCH_PATTERNS`**, `modules/containment/docs/brief-authoring-rung-plan.md`,
`design/backlog/**` (including BL-151's own entry), `AGENT.md`, or any engine code. The primary checkout
`/Users/fausto/Software/AgentTalk` must remain byte-identical.

The Implementer Rules of Engagement you inherit through this repo's `CLAUDE.md` govern in full.

## 7. Refuting this brief is a valid outcome

If §2 is wrong — if §3c does not enumerate what is quoted, if the exemplar line counts differ, if the fence does
not behave as described — **say so with evidence and stop.**

There is a specific refutation worth naming: **that a scaffold is the wrong intervention entirely**, because the
expensive part of a brief is the premise verification and no generator can do that. If you can show it, that is a
better outcome than a template nobody should use.

## 8. Containment

Port **3600**, never the orchestrator's (**3741** is the live one). Sandbox `att-op-<run>`, a worktree of
AgentTalk, on its own branch.

Since [[BL-117]] `cap.meter` **no longer terminates anything** — demoted to a warning after it killed complete,
verified work on `hmp5` fourteen seconds after the worker committed. **`cap.wallClockMs` is the only rail that
will stop this rung.** Expect the corpus survey across eras to be the slow part; set it accordingly.

## 9. Grading — check both coordinates

- `<workdir>` — for the `claude` provider on the persistent path the process cwd is session-level and is the
  assigned workdir, so the work is expected **here**.
- `<workdir>/agentalk-task-<taskId>/` — the nested task worktree, usually left empty by `claude`.

An artifact check at the wrong coordinates is worse than none ([[BL-053]] / [[BL-059]]).

Report what you did, what you verified and how, and anything you could not check. **Include one generated
example in your report** — for a real backlog item of your choosing — so the grader can judge the §4 line
between prompt and fabricated analysis on an actual output rather than on a description of one.
