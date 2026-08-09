# Plan — the brief-authoring rung: making step ② of the loop delegable

**Status:** DRAFT — gate 1 not yet held. **Planner:** Claude (sole-agent fallback). **Written:** 2026-08-09 against `26ec5b8`.
**Origin:** PO question — *"the ultimate goal is still: list backlog items on hermes, PO chooses one, hermes launches an
AgentTalk session to do it. How close are we?"* This plan addresses the one leg that is not close.

---

## 1. The gap, stated precisely

```
 ①  Hermes lists items          GET /api/backlog (server.ts:245)        ✅ exists
 ②  PO chooses one              ⚠️  eligible-bit + BRIEF + BAR + .authorized
 ③  Hermes launches             hmp-commission.mjs                      ✅ proven ×7
```

Legs ① and ③ are built. Leg ② is not a plumbing gap: marking `autonomy: eligible` and signing `.authorized` are
one-line PO acts, but the **brief** (~150 lines) and the **bar** (~110–137 lines) are the substance of a rung, and
today each takes a planner session. That is the whole distance between "PO picks an item" and "Hermes launches."

**This plan proposes delegating the authoring of those two artifacts to a commissioned worker.**

## 2. The win condition — read this before the design

A brief costs ~one planner session. If supervising and grading a brief-authoring run also costs ~one session, **this
is a net loss** and should not be built. It pays off in exactly one case:

> **The meta-brief is REUSABLE — one brief-authoring brief, parameterised by the chosen item, that works for rung
> N+1, N+2, N+3 without being rewritten.**

Everything below is designed around that. **If the meta-brief has to be substantially rewritten per item, the
experiment has failed and should be abandoned rather than tuned.** That is a pre-registered refutation condition,
not a hedge.

**Measurement (pre-registered):** after the worker produces `<run>-brief.md` and `<run>-bar.md`, the PO/planner edits
them to committable quality. Record **lines changed / lines produced**. Success = **≤ 30%**. Between 30% and 60% is
inconclusive — run it once more before deciding. **> 60% = refuted**, abandon.

## 3. The three collisions this design has to survive

### 3a. The recursion fence — verified by execution, not assumed

`hmp-commission.mjs:343` runs `findsLaunchInstruction(brief)` and refuses `recursive-commission` on seven patterns
(`:192-200`). A brief-authoring brief naturally describes the machinery its output feeds. I tested five candidate
wordings against the real exported function:

| Wording | Result |
|---|---|
| A — names `hmp-commission.mjs` | **TRIPS** `/hmp-commission\.mjs/i` |
| B — "commission a run for BL-122" | **TRIPS** `/\bcommission\s+(a\|an\|another\|the)\s+(session\|run)\b/i` |
| C — "used to launch a worker session" | **TRIPS** `/\blaunch\s+(a\|an\|another\|the)\s+(session\|run\|operator\|worker)\b/i` |
| D — artifact-only: *"Produce two documents: an operator brief and a pre-registered bar for BL-122, modelled on the hmp3 and hmp7 exemplars. Do not perform the work the item describes."* | **passes** |
| E — mentions the `AGENTTALK-RUN` discriminator | **TRIPS** |

**Resolution: adopt wording D, and do NOT widen the fence.** The distinction matters and must be stated honestly —
this is not evading a safety check. **The worker does not need the machinery to do the job.** It needs the backlog
item, the codebase, and two exemplars. If a draft meta-brief genuinely *cannot* be written without naming the
launcher, that is evidence the task **is** recursive and the fence is right to refuse it.

**Standing rule for this rung:** the meta-brief refers to its outputs by *role* ("an operator brief", "a
pre-registered bar"), never by mechanism. **A trip is a finding about the brief, never a reason to touch
`LAUNCH_PATTERNS`.**

### 3b. Bar independence — the sharpest risk, and the existing gate does not cover it

A bar encodes *what would falsify this delivery*. Letting the system under test author its own grading standard is
the thing every independence default in `AGENT.md` exists to prevent.

The tempting counter-argument is that the PO already gates it: the bar must be **committed to master** and the PO
signs `.authorized`. That is a real control — but it is a control against an **unauthorized** bar, **not an
incoherent one**, and we have the evidence:

> **hmp7's R4 pinned the suite at 722/722 while R2 required a new parity test file. No delivery could satisfy both.**
> It was committed, authorized, and launched. PO-disposed 2026-08-08 as a bar defect.

A human-authored bar cleared that gate with a contradiction in it. **So "the PO commits it" must not be cited as the
independence control for a delegated bar.** It isn't one.

**Three options, for the PO (§7 Q1):**

| | Option | Trade |
|---|---|---|
| **(a)** | **Delegate the BRIEF only; bar stays planner-authored** | Safest. Saves maybe 55% of the effort. Recommended for the first run. |
| **(b)** | Delegate both, PO reviews | Full saving; but per the above, review is a weak filter for coherence. |
| **(c)** | Delegate both, require author ≠ implementer | Preserves independence in form; costs a second run and does not fix incoherence. |

**Recommendation: (a) for the first run**, then reconsider (b) with real data on how good the produced brief was. A
first rung whose failure mode is "the bar was wrong" would be graded by the very artifact under suspicion.

### 3c. Can "write a good brief" even be graded?

A bar must be falsifiable *before* the work exists. "Write a good brief" is not. **Resolution: grade against the
structural properties that made the hmp3 and hmp7 briefs work** — each independently checkable by a reader who never
saw the item:

1. Names the item and the concrete deliverable.
2. **Verifies the premise by SYMBOL, not line number**, and records what it actually saw (staleness guard).
3. Lists **≥ 2 plausible wrong answers that would look green**. *(hmp3's entire value: the obvious fix was the wrong
   one, and the brief said so.)*
4. Declares scope: files in, and files **explicitly out**.
5. States a show-stopper condition, and says **refuting the brief is a valid outcome**.
6. **Every bar row is individually falsifiable AND the rows are mutually satisfiable.** ← this row exists **because
   of hmp7 R4**, and it is the one with real teeth.
7. Contains no launch-mechanism reference (§3a) — checkable by running `findsLaunchInstruction` over it.

Rows 6 and 7 are *mechanically* checkable. The rest are read-and-judge, which is honest to say out loud.

## 4. Scope

**In:** `design/operator/meta-brief.md` (the reusable meta-brief), `design/operator/<run>-brief.md` +
`<run>-bar.md` for the meta-rung itself, its `.config.json` and `.authorized`, and a grading doc.

**Explicitly OUT — do not touch:**
- `scripts/hmp-commission.mjs` — **especially `LAUNCH_PATTERNS`** (§3a).
- `apps/orchestrator/src/__tests__/bl093-backlog-selectable.test.ts` — unless the eligible set genuinely changes,
  and then only with the red shown to the PO first.
- The engine, the registry, `AGENT.md`, the charter.
- The backlog item the produced brief is *about* — the worker writes **about** it, never **does** it.

## 5. Sequence

0. **PO resolves the §7a shape** (i / ii / iii). The meta-brief cannot be written before this — its whole content
   is what the worker is asked to produce, and §7a changes that.
1. **PO marks [[BL-122]] `autonomy: eligible`.** The queue is currently EMPTY; nothing can be commissioned until
   this happens. `bl093-backlog-selectable.test.ts:321` goes red — that red is the ritual, shown before it moves.
2. Planner writes `meta-brief.md` (reusable) + the meta-rung's own bar, per §3c.
3. PO commits and signs `.authorized`.
4. Hermes commissions the meta-rung. Worker produces a brief + bar for the subject item.
5. **Measure the edit distance (§2).** Record it before any rework, or the number is worthless.
6. If ≤ 30%: PO commits the produced artifacts and the subject item runs as a normal rung — **the first time a
   commissioned artifact governs a later run.**

## 6. Definition of Done

| # | Row | How it is checked |
|---|---|---|
| D1 | `meta-brief.md` exists, is committed, and passes `findsLaunchInstruction` | run the function over it — exit clean |
| D2 | The meta-rung's own bar satisfies §3c rows 6–7 | inspect; rows mutually satisfiable |
| D3 | A worker produced both artifacts without doing the subject item's work | `git diff --stat` on the task branch touches only `design/operator/**` |
| D4 | Edit distance recorded **before** rework | a number in the grading doc |
| D5 | Verdict recorded against §2's thresholds, including ABANDON if > 60% | grading doc |
| D6 | Containment held: `att-op-*` worktree, port 3600, no mainline write | invariant harness bracket, `snapshot` → `check` |

## 7. PO decisions

**DECIDED 2026-08-09 `[PO]`:**
- **Q1 — brief only.** The bar stays planner-authored (§3b option (a)). Bar delegation is not revisited until this
  run produces data.
- **Q2 — subject is [[BL-122]]** (`apps/web` has zero tests and is excluded from the suite).

**Q3 — threshold** not separately answered; the pre-registered **30% / 60%** of §2 therefore stands as written.

### 7a. ⚠️ BL-122 carries an undecided fork — this is now the plan's central open question

BL-122's own text says the fix direction is **"deliberately not decided here"** and names two defensible ends:

- **(A)** add `jsdom` + a React testing library to `apps/web`, drop `apps/web/**` from the root `exclude`
  (`vitest.config.ts:29`), add an `environment: 'jsdom'` include glob; **or**
- **(B)** decide the UI is thin enough to stay verified **by eye**, and record *that* as the standing position.

The item is explicit that *"what is not defensible is the current state, where the exclusion is a config line
nobody chose deliberately."* **So the subject item's deliverable is a DECISION, and choosing between (A) and (B)
is product scope — reserved to the PO** (`AGENT.md` → Origin Tag Protocol rule 3). A brief-author cannot resolve
it, and a worker that quietly picks one produces exactly the §8 failure mode: structurally complete, aimed at
nothing anyone chose.

**Three shapes, for the PO:**

| | Shape | Trade |
|---|---|---|
| **(i)** | **PO decides (A) or (B) now**; the worker writes an implementation brief | Cleanest. But the PO does the interesting thinking, and the rung tests only brief *mechanics*. |
| **(ii)** | The worker writes a brief that **presents both forks and names the decision** for the PO | Tests whether a delegated brief can *find the decision* — the property that makes a plan worth writing. Costs a round: the governed rung can't start until the fork is answered. |
| **(iii)** | Subject is narrowed to **(B) only** — argue and record the standing position | Doc-only, tiny blast radius, but thin enough that it may not exercise anything. |

**Planner recommendation: (ii).** It is the only shape that tests the capability we actually want. My own lesson
from T3b is that *a plan earns its keep by finding the decision* — if a delegated brief can do that, the
capability is real; if it can only fill in a decision already made, we have automated transcription.

**One property worth noting whichever shape is chosen:** BL-122 has an unusually **low blast radius** — `apps/web`
is excluded from the suite, so work there cannot break the 743/743 green. That is a good property for a first
delegated brief, and it was not the reason the item was picked, but it counts in its favour.

## 8. What would refute this plan

- Edit distance > 60% on the first run (§2). **Abandon, do not tune.**
- The meta-brief cannot be written without tripping §3a → the task is genuinely recursive; drop it.
- The produced brief is structurally complete (§3c all green) but the resulting rung is *vacuous* — a brief can
  satisfy every checkable property and still aim at nothing worth doing. **This is the failure mode the bar cannot
  see**, and the reason §3b option (a) keeps a human on the bar.

## 9. Honest limits

- **Gate-1 fresh eyes are structurally unavailable.** One actor holds planner and plan reviewer under the
  resource-scarcity fallback. This is the same caveat that shipped with BL-028 T3b; it is recorded, not waived.
- The measurement in §2 is a proxy. Edit distance counts lines, not judgement; a brief can be 95% retained and still
  wrong in the 5% that matters.
- §3c rows 1–5 are read-and-judge, not mechanical. Only rows 6–7 have teeth.
