# The meta-brief — a reusable brief for producing an operator brief

**Reusable template.** Instantiate by copying to `design/operator/<run>-brief.md` and filling **§0** only.
If instantiating ever requires editing anything outside §0, that is the signal this template has failed its
purpose — record it, do not quietly patch it. Plan and rationale: `design/brief-authoring-rung-plan.md`.

## ⚠️ NOT YET AUTHORIZED

Authorization is a separate committed act by the Product Owner. This document being present, or committed, is
not it. If you are reading this as a worker, someone has already done that step — proceed.

---

## §0 — Parameters for this run *(the ONLY section that changes between runs)*

| | |
|---|---|
| **Subject item** | **BL-122** — `apps/web` has zero tests and is excluded from the suite |
| **Item's status** | `todo`, `autonomy: eligible` as of 2026-08-09 |
| **Where it lives** | `design/backlog.md`, under `### Todo (next first)` |
| **Your output** | exactly one new file: **`design/operator/bl122-brief.md`** — **the brief only. Not a bar.** |
| **Exemplars to model** | `design/operator/hmp3-brief.md` and `design/operator/hmp7-brief.md` |
| **Known open fork** | BL-122's fix direction is **undecided**. See §5. |

---

## 1. What you are producing, and what you are NOT

You are writing **a document**: an operator brief that will later govern a different worker doing BL-122's actual
work. You are **not** doing BL-122's work.

**Concretely, you must NOT:** add jsdom, add a testing library, edit `vitest.config.ts`, edit
`apps/web/package.json`, write a UI test, or change any behaviour anywhere. If your diff touches anything outside
`design/operator/`, you have misread this brief.

The one thing you produce is a Markdown file. That is the whole deliverable.

## 2. Read these first, in this order

1. **BL-122 itself**, in `design/backlog.md`. Read the whole item, including the "Fix direction" and "Not urgent"
   paragraphs — they are the substance, not preamble.
2. **The two exemplars** in §0. Read them as *specimens of a form*, not as content to imitate. Notice what they do
   structurally: state a premise and prove it, name what is out of scope, and predict how a delivery could look
   green while being wrong.
3. **`AGENT.md`** — in particular the ⛔ Implementer Rules of Engagement, because the brief you write will be read
   by someone bound by them. A brief that asks for something those rules forbid is a defective brief.

## 3. What a good brief contains — these are the graded properties

Your output is graded on these. They are not a style guide; they are the bar.

1. **Names the item and the concrete deliverable.** A reader who has never seen BL-122 should finish your first
   section knowing exactly what would be built.
2. **Verifies every premise by SYMBOL, not by line number** — and records what you actually saw. Grep for the
   identifier; do not cite a line you have not just looked at. **This project has put a stale line number into an
   artifact in three consecutive sessions.** BL-122 itself carried one until 2026-08-09. Assume any coordinate you
   inherit is wrong until you have re-derived it.
3. **Lists at least two plausible wrong answers that would look green.** This is the highest-value part of a brief
   and the hardest. Not strawmen — the *tempting* wrong answers, the ones a competent worker would reach for.
4. **Declares scope explicitly: files in, and files out.** The out-list matters more; name the things that will be
   visibly tempting and fence them.
5. **States a show-stopper condition**, and says plainly that **refuting the brief is a valid outcome.** A worker
   who discovers the premise is false has succeeded, not failed.
6. **Any bar rows you propose must be individually falsifiable AND mutually satisfiable.** A real run here once
   shipped a bar pinning the suite at a fixed total while another row required a new test file — no delivery could
   satisfy both. Check your rows against each other before you write them down.
7. **Contains no reference to the mechanism that will later use your document.** Write about the *artifacts* —
   "an operator brief", "a pre-registered bar" — never about the tooling that consumes them. This is checked
   mechanically and a violation fails the row outright.
8. **Presents the open fork (§5) fairly and names the decision as the Product Owner's — without picking one.**

## 4. Scope

**In:** creating **`design/operator/bl122-brief.md`**. Nothing else.

*(Named for the item, not for the later run, because the later run does not exist yet and you cannot know what it
will be called. Whoever prepares that run renames the file then. Do not invent a run identifier.)*

**Out — do not touch, and each is fenced for a reason:**

- `vitest.config.ts`, `apps/web/**`, `package.json` anywhere — that is BL-122's work, not yours.
- `design/backlog.md` — you may read it; you may not edit it.
- `scripts/` — in particular anything resembling a check on brief content. If you believe a check is wrong, **say
  so in your report**; changing a guard so your output passes it is the most serious failure available here.
- `AGENT.md`, the engine, the registry, any test file.

## 5. The open fork — the hazard specific to THIS run

**BL-122's fix direction is deliberately undecided.** Its own text names two defensible ends:

- **(A)** add `jsdom` + a React testing library to `apps/web`, drop `apps/web/**` from the `exclude` in
  `vitest.config.ts` (**verify the line yourself**), add an `environment: 'jsdom'` include glob.
- **(B)** decide the UI is thin enough to stay verified **by eye**, and record *that* as the standing position.

The item is explicit that what is *not* defensible is the current state, "where the exclusion is a config line
nobody chose deliberately."

**Choosing between (A) and (B) is product scope, and product scope belongs to the Product Owner.** Your brief must
therefore lay out both ends, argue each at its strongest, surface whatever evidence bears on the choice — and stop.

**This is the row the whole run turns on.** A brief that quietly resolves the fork fails property 8 **even if it
picks the end the Product Owner would have picked.** The failure is taking the decision, not getting it wrong.
Conversely, a brief that finds a consideration nobody had noticed — and still leaves the call open — is the best
possible outcome here.

## 6. Three plausible wrong answers — all three can look green

**6a. Doing BL-122 instead of writing about it.** The item is small and the fix is legible; it will be tempting to
just add jsdom. A diff that touches `apps/web/` is an automatic fail regardless of quality.

**6b. Picking a fork and writing a confident brief for it.** This produces the most *polished-looking* output —
a single clear direction always reads better than a fair two-sided treatment. It fails property 8. Resist the pull
toward a document that looks decisive.

**6c. Writing a brief that is structurally complete and aimed at nothing.** Every property in §3 can be satisfied
by a document that is nonetheless vacuous — premises verified, scope declared, wrong answers listed, and no reason
for anyone to do the work. If you cannot state why BL-122 is worth someone's time, **say that**, and say it plainly.
That is a finding, and a valuable one.

## 7. Refuting this brief is a valid outcome

If, having read BL-122, you conclude the item should not be worked at all — that (B) is obviously right and takes a
paragraph rather than a run, or that the item is stale, or that its premises no longer hold — **write that, with
evidence, and stop.** An honest refusal costs one paragraph. A brief written to justify work that should not happen
costs whoever does it.

The same applies to this document: if the task as specified cannot be done, report why rather than improvising a
nearby task that can.

## 8. Containment

Work only in your assigned worktree, on your assigned branch. Commit your output there. **Do not merge, do not
push, do not touch the mainline** — merges and pushes are the Product Owner's, without exception.

Stage files explicitly. Never `git add -A`: `node_modules` is symlinked into the worktree and slips past
`.gitignore`.

## 9. How your output will be graded

By a reviewer seat, not by whoever monitors this run — an observation is not a finding, and a monitor's report is
unverified until checked against the artifact.

- Properties **6 and 7** are checked mechanically.
- Properties **1–5 and 8** are read and judged.
- Property **8** is weighted heaviest; see §5.

Report what you did, what you verified and how, and anything you could not check. An honest gap named in your
report is worth more than a confident claim that turns out to be unrun.
