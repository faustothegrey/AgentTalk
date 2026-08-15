# Run `hmp6` — operator brief: an investigation inside AgentTalk

**Rung:** the sixth commission carried over HMP, and the first to investigate a dead branch in status logic.
**Plan:** `design/hmp-session-submission.md` §3.
**Bar:** `design/operator/hmp6-bar.md` (pre-registered; its hash travels in the commission).
**Config:** `design/operator/hmp6.config.json`. **Backlog item:** [[BL-120]].

---

## ⚠️ NOT YET AUTHORIZED — and that is deliberate

**Authorization is not mine to write, so it is not written.**

To authorize this run the **PO** creates one file, `design/operator/hmp6.authorized`, whose **entire** content is
the line `[PO] AUTHORIZED-RUN: hmp6` — and commits it so it is reachable from `master`. The verifier refuses any
`repo-sha` that is not an ancestor of `master`, so **the merge is the authorization act**.

Unchanged from the five rungs before it, and still not ceremony: the whole design rests on authorization being a
thing a message cannot assert and an agent cannot mint. An author who writes the `[PO]` line for their own brief
has forged precisely what the check exists to protect, and the check would still be green.

## 1. Goal — the item, and the deliverable

> Investigate backlog item BL-120 — `setAgentBusyState(agent, true)` is unreachable, so an attached agent's
> status never says `busy` — and write a design document at `design/archive/bl120-attached-busy-investigation.md` weighing
> its recorded options and recommending one, with reasons. Commit that document to your branch; change no code.

The authoritative statement of the task is the committed backlog item — read [[BL-120]] in `design/backlog.md`.
A brief that restates its source can drift from it and then contradict the thing it was derived from.

## 2. The premise, verified rather than quoted

The item's failure claim was **re-checked by hand on 2026-08-07 at master `04a30e7`** rather than taken from its
text, because a stale item is worse than no item ([[BL-108]] was once picked as a rung and had already been fixed
inline).

- `setAgentBusyState` (`packages/runtime-core/src/registry/registry.ts:822-833`) has exactly **one** call site —
  `registry.ts:548`, the `send_to_agent` `to === 'user'` branch — and it passes **`false`**. The `true` branch,
  and with it `updateAgentSessionStatus(agent, 'busy')` (`registry.ts:835`), cannot execute.
- The reconnect restore sets `busy` via `setAgentStatus(agent, agent.currentTurnId ? 'busy' : 'ready')` at
  `registry.ts:1367`. The item cites `:1287`; the mechanism is the same and the line has drifted. So the only
  route to `busy` on the attached transport remains a disconnect, exactly as the item says.

The item's coordinates were filed against an earlier sha. What matters is the mechanism, which reproduces at
`04a30e7`.

## 3. What this run is, and is not

**Is:** an **INVESTIGATION that changes no code.** The deliverable is a design document at
`design/archive/bl120-attached-busy-investigation.md`.

**Is not:** a fix. Wiring the `true` branch is a behaviour change on shared status logic — `busy` is read by the
conversation coordinator, the team coordinator, `ALLOWED_TRANSITIONS`, and the reconnect restore. That is a
show-stopper: **report, don't build.** Finding the defect is your job; fixing it is not (Implementer Rule 2).

**Is not:** evidence about long runs. The cap is bounded and nowhere near [[BL-096]]'s failure class; no result
here may be cited against BL-096, in either direction.

**Is not:** evidence that the worker did the work. An acknowledgement over the wire means the message was
answered. `completed` has never meant done here. Grade the artifact, at the coordinates where the process
actually stood ([[BL-053]] / [[BL-059]]).

**Is not:** a merge. Commit to `task-op-hmp6` and stop. Mainline is reached only by a PO-gated merge.

## 4. The hazard specific to THIS rung — the deliverable is a document, not code

The item is deliberately **"harmless if botched"**: it changes nothing, and a wrong recommendation is caught by
the gate that reads it. The hazard is the inverse — an investigation that looks green by **restating the item**
instead of independently tracing the readers.

The bar is the item's own: the document must identify **every production reader** of `busy`/`sessionStatus` and
say, **per reader**, what changes if the `true` branch is wired — or state plainly which it could not determine.
**A recommendation with no reader inventory does not meet it.** The item names four readers to start from
(conversation-coordinator, team-coordinator, `ALLOWED_TRANSITIONS` in `agents/agent.ts`, the reconnect restore);
the inventory must be exhaustive across production code, not a restatement of that list.

**Do not mistake your own reading for the inventory.** The point of the run is that the reader set is
*established*, not that the obvious four are named.

## 5. Three plausible wrong answers — all three can look green

### 5a. Wiring the `true` branch — **out of scope, and it is a show-stopper**

The item is an INVESTIGATION because "nobody has established what else would move". A worker that resolves the
question by making the change has bypassed the very gate the rung exists to feed. Implementer Rule 2 is explicit:
a non-trivial behaviour change on shared logic is a show-stopper — **report it, don't make it.** The document may
*recommend* the change; it may not *be* the change.

### 5b. A recommendation with no reader inventory — **fails the item's own bar**

The item's bar is quoted in §4. A document that recommends an option without establishing, per reader, what moves
if the branch is wired, does not meet it — even if the recommendation is the one the PO would have chosen. The
inventory is the deliverable; the recommendation is its conclusion.

### 5c. Restating the item instead of verifying it — **the run becomes weaker evidence**

A document that echoes the item's four named readers and stops is not an investigation — it is a summary. The
run's value is that the reader set is checked against the code, and that any reader the worker **could not**
determine is **stated plainly** (the bar's escape clause). An unverified claim, in either direction, is what
fails.

## 6. Scope

**May write:** `design/archive/bl120-attached-busy-investigation.md` — the one deliverable.

**May read:** anything in this repo, including the code paths named by the item. The backlog **is** in your
workdir (`design/backlog.md`), so no external read is needed.

**May NOT write:** any other file, anywhere — not code, not tests, not notes. `git diff --stat` against your
launch baseline must show **exactly one file**. The primary checkout `/Users/fausto/Software/AgentTalk` must
remain byte-identical (your shell can reach it; that is precisely why this line is explicit).

The Implementer Rules of Engagement you inherit through this repo's `CLAUDE.md` govern in full.

## 7. Refuting this brief is a valid outcome

`hmp2`'s most valuable output was its worker demonstrating, with evidence, that its item's own suggested fix
could not have worked. If the reasoning in §2 or §4 is wrong — if the `true` branch is reachable after all, if
the reader set is materially different from what the item claims — **say so with evidence and stop.** That is
worth more than a green run.

What fails is an **unevidenced** claim, in either direction.

## 8. Containment

Port **3600**, never 3500. Sandbox **`att-op-hmp6`** (`/tmp/att-op-hmp6`, branch `task-op-hmp6`), a worktree of
AgentTalk. `cap.wallClockMs` and `cap.meter` both set.

**One honest note on the caps (operator-skill correction, 2026-08-07).** Since [[BL-117]] `cap.meter` **no longer
terminates anything** — it was demoted to a warning after it killed complete, verified work on `hmp5` fourteen
seconds after the worker committed. It is still **mandatory to configure**, but `cap.wallClockMs` is the **only
rail** that will stop this run. It is set **deliberately at 60 minutes**: a read-only investigation traced across
~5 source files plus one document does not need more, and nothing else will stop a wedged worker. Do not read the
meter as a second rail.

## 9. Grading — check both coordinates

- `<workdir>` — for the `claude` provider on the persistent path the process cwd is session-level and is the
  assigned workdir, so the work is expected **here**.
- `<workdir>/agentalk-task-<taskId>/` — the nested task worktree the orchestrator provisions, usually left empty
  by `claude`.

An artifact check at the wrong coordinates is worse than none: it manufactures false confidence and a paper
trail. That is [[BL-053]] / [[BL-059]], and it has already cost this project a defect that never existed.

**This brief was written against the recursion fence** — the verifier refuses a brief that reads as instructing
its receiver to start further sessions, so certain phrasings are avoided here deliberately rather than by
accident.
