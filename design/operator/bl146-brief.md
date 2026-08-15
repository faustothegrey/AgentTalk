# Brief — [[BL-146]]: an instrument that reports where the ladder actually stands

**Subject item:** [[BL-146]] in `design/backlog/50-containment.md`.
**Bar:** `design/operator/bl146-bar.md` (pre-registered; its hash travels with the authorization).
**Run identifier and config:** assigned by the PO at authorization time, not here.

---

## ⚠️ NOT YET AUTHORIZED — and that is deliberate

**Authorization is not mine to write, so it is not written.**

To authorize this rung the **PO** creates one file, `design/po/<run>.authorized`, whose **entire** content is the
line `[PO] AUTHORIZED-RUN: <run>` — and commits it so it is reachable from `master`. The verifier refuses any
`repo-sha` that is not an ancestor of `master`, so **the merge is the authorization act**.

Still not ceremony: the whole design rests on authorization being a thing a message cannot assert and an agent
cannot mint. An author who writes the `[PO]` line for their own brief has forged precisely what the check exists
to protect, and the check would still be green.

## 1. Goal — the item, and the deliverable

> Implement backlog item BL-146 — produce a status tool that reads the recorded-run ledger and the grading
> documents beside it, and reports one line per recorded run: identifier · date · subject item · verdict ·
> wall-clock. It must flag any recorded run with **no grading document**, and it must distinguish that state
> from "graded, but the verdict could not be parsed". Commit on your branch.

The authoritative statement of the task is the committed backlog item — read [[BL-146]] in
`design/backlog/50-containment.md`. A brief that restates its source can drift from it and then contradict the
thing it was derived from.

## 2. The premise, verified by SYMBOL rather than by line number

Re-verified by hand on 2026-08-16 at master `5d3a9c0`. **Every coordinate below is a claim you should re-derive
yourself** — this project has put a stale line number into an artifact in four consecutive sessions, and two
figures in BL-146's own text were corrected after measurement rather than before it. Do not inherit any number
here without re-deriving it.

- **The ledger** is `design/operator/.hmp-launched.json` — a dotfile, easy to miss with a plain `ls`. It holds a
  single `launched` array of **9** entries, each with exactly the keys `run`, `repoSha`, `sandbox`, `configPath`,
  `at`. Runs `hmp1` … `hmp9`. **Note what is absent: there is no verdict, no subject item and no duration in the
  ledger.** Everything this tool reports beyond identity has to come from elsewhere.
- **The grading corpus** is `design/operator/*-grading.md` — **13** files, spanning three naming eras (`o*`,
  `hl*`, `hmp*`). Only 8 of the 9 ledger runs have one.
- **`hmp6` has no grading document at all.** `ls design/operator/hmp6*` returns a bar, a brief, an authorization
  file and a config. Its verdict exists, in prose, inside the backlog item it delivered. This is [[BL-147]]'s
  subject; here it is the case your tool must not misreport.
- **The verdict line has at least four genuine shapes.** Grep each grading file for `Verdict` and read what comes
  back:
  - bold inline — `**Verdict: PASS on R1–R5.**` (`hmp2`), `**Verdict: PASS**, and it beat the bar.` (`hmp9`)
  - a heading — `## Verdict: **PASS** — R1–R6 all met` (`hmp3`)
  - a table row — `| Verdict | **PASS.** R1, R1a, R2 … |` (`hmp4`, `hmp5`, `hmp7`, `hmp8`)
  - a title-line suffix — `# Grading — run \`hmp4\` ([[BL-116]]): **PASS**`
- **⚠️ And it has one shape that is NOT a verdict at all.** In `hl2`, `hl3` and `o4` the first match for
  `Verdict` is a **table column header** — `| Block | Score | Threshold | Verdict |`. A naive first-match parser
  returns the word "Verdict" as though it were a result. **This is the defect this rung is most likely to ship.**
- **`o3` has no verdict line by design**, and says so: *"The rung verdict itself is the PO's to issue."* That is a
  legitimate state, not a parse failure, and it is different again from `hmp6`'s missing document.

**The live evidence, which is why the item exists.** On 2026-08-16 the planner primer stated the ladder stood at
"O-1/O-2". Nine commissioned runs had completed, the last on 2026-08-13. `AGENT.md`'s soft-ladder table still
presents O-1 as *"first real test of the harness"* and O-3 as aspirational. **Two artifacts, written by the actor
closest to the work, both understated what had been proven** — and reconstructing the truth by hand cost most of
a session.

## 3. What this run is, and is not

**Is:** a new read-only reporting script, its test, and its npm wiring. Additive.

**Is not:** a licence to normalise the grading corpus. Those documents are **evidence**. Rewriting them so a
parser is easier is the one move that would make this tool worthless — see §5b.

**Is not:** a grader. It reports what the corpus says. It never computes, infers, or upgrades a verdict.

**Is not:** evidence that the worker did the work. An acknowledgement over the wire means the message was
answered. `completed` has never meant done here. Grade the artifact, at the coordinates where the process
actually stood ([[BL-053]] / [[BL-059]]).

**Is not:** a merge. Commit to your branch and stop. Mainline is reached only by a PO-gated merge.

## 4. The hazard specific to THIS rung — a confident blank is worse than an honest gap

Every output state here has a *plausible* wrong rendering, and all of them look like a working tool:

| Real state | The wrong rendering | Why it is dangerous |
|---|---|---|
| `hmp6` — no grading document | "no verdict" | conflates *ungraded* with *undocumented*; hmp6 was graded |
| `o3` — verdict deliberately withheld | "missing" / an error | it is a legitimate recorded state |
| `hl2`/`hl3`/`o4` — column header matched | verdict = `"Verdict"` | a **false positive that looks parsed** |

**The item names the standard and it is not negotiable: prefer an explicit `unparsed` / `missing` classification
over a confident blank.** A tool that silently reports "no verdict" for a run that was graded would tell the next
session exactly the false story the primer told this one — which is the defect this rung exists to end.

**⚠️ SHOW-STOPPER: if you conclude the corpus cannot be parsed without editing it** — that the shapes are too
irregular to classify honestly — **STOP and report that, with the specific files and shapes that defeat you. Do
not edit the corpus to make your parser work.** Reporting it is a success, not a failure: it would mean the real
deliverable is a convention (that is [[BL-147]]), not a parser, and that finding is worth more than a tool built
on rewritten evidence.

## 5. Four plausible wrong answers — all four can look green

### 5a. First-match `grep Verdict` — **the likeliest failure, and it produces output that looks right**

Three files answer with a table column header. The tool prints a row for every run, nothing errors, and the
verdict column reads `Verdict` for three of them. Anyone skimming sees a populated table. **A test over the real
corpus is the only thing that catches this** — which is why the bar requires one.

### 5b. Normalising the grading documents so the parser can be simple — **the forbidden direction**

Making the world match the tool rather than the tool match the world. These files are the evidence trail for nine
autonomous runs, several of them self-graded with independence caveats written into them. **A diff touching any
`*-grading.md` fails the scope row regardless of how much tidier the result is.**

### 5c. Back-filling `hmp6`'s grading document — **the trap [[BL-147]] names explicitly**

You will be tempted, because it makes your output uniform. Writing a grading document nine days after the fact,
from a backlog item rather than from a run anyone observed, **manufactures an artifact that looks like evidence
and is not**. That is this project's most-repeated lesson. Report the gap; do not fill it.

### 5d. Inferring a verdict — **quiet fabrication**

From the branch being merged, from the item being closed, from the absence of complaint. Every one of these is a
guess wearing the costume of a fact. **Positive evidence or an explicit `unparsed`** — the [[BL-023]] discipline,
and the [[IP-15]] trap it exists to avoid.

## 6. Scope

**May write:** a new script under `scripts/`, a new test file under `scripts/__tests__/`, and the npm script
entry in `package.json`. `git diff --stat` should show those three and nothing else.

**May read:** anything in this repo.

**May NOT write:** any file under `design/operator/` — **especially any `*-grading.md`** — the ledger
`.hmp-launched.json`, `AGENT.md`, `design/backlog/**` (including BL-146's own entry: you do not close your own
item), the launcher, `scripts/infra-invariant.mjs`, or any engine code. The primary checkout
`/Users/fausto/Software/AgentTalk` must remain byte-identical — your shell can reach it, which is precisely why
this line is explicit.

The Implementer Rules of Engagement you inherit through this repo's `CLAUDE.md` govern in full.

## 7. Refuting this brief is a valid outcome

If §2 is wrong — if the ledger has different keys, if a grading shape listed here does not exist, if `hmp6` does
have a grading document somewhere this brief did not look — **say so with evidence and stop.** That is this rung
succeeding.

`hmp2`'s most valuable output was its worker demonstrating, with evidence, that its item's own suggested fix
could not have worked; `hmp6`'s worker refuted the finding of the item that commissioned it. **What fails here is
an unevidenced claim, in either direction.**

## 8. Containment

Port **3600**, never the orchestrator's (**3741** is the live one). Sandbox `att-op-<run>`, a worktree of
AgentTalk, on its own branch.

**One honest note on the caps.** Since [[BL-117]] `cap.meter` **no longer terminates anything** — it was demoted
to a warning after it killed complete, verified work on `hmp5` fourteen seconds after the worker committed. It is
still mandatory to configure, but **`cap.wallClockMs` is the only rail that will stop this rung.** Set it
deliberately for the work: this is a parser over 13 small documents plus a test, not an open-ended investigation.

## 9. Grading — check both coordinates

- `<workdir>` — for the `claude` provider on the persistent path the process cwd is session-level and is the
  assigned workdir, so the work is expected **here**.
- `<workdir>/agentalk-task-<taskId>/` — the nested task worktree the orchestrator provisions, usually left empty
  by `claude`.

An artifact check at the wrong coordinates is worse than none: it manufactures false confidence and a paper trail
to match ([[BL-053]] / [[BL-059]]).

Report what you did, what you verified and how, and anything you could not check. **An honest gap named in your
report is worth more than a confident claim that turns out to be unrun** — which is, exactly, the subject of this
rung.
