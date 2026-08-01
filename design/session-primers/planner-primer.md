---
role: planner
key: 20260801-1231-6bd42f
written: 2026-08-01 by Claude — session close after the third HMP-carried rung. BL-115 was
  commissioned, delivered, graded PASS on R1–R6, merged and closed in one session. Deliberately
  no claim here about what is queued: read the queue yourself, it is one command and it has
  invalidated this header before.
---

This is your session primer.

**Project.** AgentTalk orchestrates real, heterogeneous LLM agents (claude / codex / gemini-agy / goose) as one
software team: they attach as MCP clients over WebSocket, pull turns via `await_turn`, and coordinate through a
planner→implementer→reviewer workflow under a human Product Owner. Current thrust: the **autonomous-development
ladder** — improving AgentTalk *with* AgentTalk, one graded rung at a time.

**Roles.** Human = PO (Fausto): scope, direction, **merges**, **pushes**, and the `autonomy: eligible` bit.
Bindings live ONLY in `AGENT.md → 📌 DEFAULT ROLE ASSIGNMENTS` — read it, don't trust this line. Codex and agy
remain PO-declared UNAVAILABLE, so you are almost certainly the sole agent under the **resource-scarcity
fallback**: wear every hat, handshake once per role, declare all of them, keep each gate's discipline
separately. **Standing Conditional Reassignment ACTIVE** (you may implement). Hermes holds the **OPERATOR seat**
— it launches and monitors, holds no authority, and its reports are *observations*, unverified until you check
the artifact.

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` + `AGENT.md`. **Closed
items carry a closing block + telemetry inside the backlog item — read those first.** Resume from the backlog,
**NOT from chat**.

## Where we are

**No sha and no queue state is written here, deliberately.** Run `git log --oneline -5` and `git status -sb` in
**both** repos, and read the selectable set out of the code rather than out of prose:

```
npx vitest run apps/orchestrator/src/__tests__/bl093-backlog-selectable.test.ts
```

That test pins the *exact* agent-selectable set, so its assertion is the answer, and a red is a finding rather
than a chore. Naming volatile state in this file has invalidated it within the hour four times now — twice in
the session that wrote the previous version of it.

At close: `npm test` **671/671 across 82 files**, `tsc -b` clean · backlog **117 items, 0 warnings** · ports
3500/3600 free · **no worktrees but the primary, no branches but `master`** · claude weekly **32%** · **both
repos pushed and in sync.**

## ⚠️ The one thing to do first

**Find out whether there is a rung waiting, and do not assume either answer.** At close, closing BL-115 emptied
the agent-selectable queue and the pin was updated to `[]` — but the last time a primer stated that as settled,
the PO stocked the next item within the hour and the header sat there contradicting the body. So: run the
command above.

- **If the set is non-empty:** you have a rung. **Verify the item is still real before you hand it out** — a
  session picked BL-108 once and it had already been fixed inline; an eligible no-op produces a green run that
  proves nothing, which is worse than not running. Then write its brief (see below).
- **If the set is empty:** refilling it is a **PO act** — `autonomy: eligible` is authority in file form, and
  [[BL-093]] made it fail closed. **Do not mark anything eligible yourself, and do not treat an empty queue as
  permission to pick something.** Bring the PO candidates with your reasoning and let them choose.

## What the last three rungs actually established — read this before writing the next brief

Each rung proved one new thing, and they are cumulative:

- **`hmp1`** — a commissioned worker can *observe*. Its own grading says what it left open: "the one property
  tested was that it didn't write."
- **`hmp2`** ([[BL-104]]) — it can *write*: change tracked files, commit to its own branch, in scope. Its best
  output was refuting the item's own suggested fix with evidence.
- **`hmp3`** ([[BL-115]]) — **it can take reasoning over precedent.** The item was picked *because* the obvious
  fix was wrong: copying the sibling's piped-stderr mechanism would have passed a naive bar while regressing a
  build's live output. The brief said "not like that, and here is why", and it held. **That is the first
  evidence a fenced brief can carry a negative instruction.**

**So the interesting next rung is not "a slightly bigger fix."** The open questions are now about *duration*
([[BL-096]]; every rung so far is under 7 minutes against caps of 30–45), about a task with **more than one
plausible shape**, and about whether a worker will speak up unprompted — hmp3 was **quiet**, reported nothing
out of scope, and that is recorded in its closure so the silence is not later read as an endorsement.

## How a run actually goes — the parts that are not obvious

- **`design/hmp-session-submission.md` is the design; `scripts/hmp-commission.mjs` is the law.** Read the second
  one. The verifier is the only lawful entry point and every check fails closed.
- **Authorization is the PO's commit, not a message.** `design/operator/<run>.authorized`, whose **entire**
  content must equal `[PO] AUTHORIZED-RUN: <run>`, reachable from `master`. **Do not write it yourself** — an
  agent that mints its own authorization has forged exactly what the check protects, and the check stays green.
- **There is no rehearsal any more, and this is structural.** `hmp2` could send a real commission for free
  because its authorization did not yet exist, so refusal was the only available outcome. Once the PO's
  `.authorized` commit lands, **anything reaching the wire launches.** Rehearsal and authorization are mutually
  exclusive by construction. Get the dry-run right instead: `--dry-run` against the committed sha exercises
  every check and launches nothing.
- **The order that works:** write brief/bar/config → **dry-run** (expect `no-po-authorization`) → PO commits
  `.authorized` → **dry-run again** (expect `workdir-missing` — that refusal is progress, not a fault) →
  provision (`wt-setup.mjs create op-<run> --base master --root /tmp` on **macOS**) → **dry-run again** (expect
  `accepted`) → snapshot → send → grade. Each refusal names exactly which check is next; that ladder is the
  cheapest debugging in the system.
- **The recursion fence scans the BRIEF's committed text.** It refuses `launcher.mjs`, `hmp-commission.mjs`, the
  discriminator, `/hmp/send`, and phrasings like "launch the run". Check with `findsLaunchInstruction` **before**
  committing. It refused the `hmp2` author on the first try.
- **Keep the wire message short and put the commission in a FILE.** The working pattern is a ~250-char message
  carrying one command that reads `/tmp/<run>-commission.txt` locally. A 342-char message once arrived as 154.
- **Pass a real `message_id`.** The `hmp2` probe sent it as `undefined` and the POST still looked healthy —
  HMP's replay protection travelled as nothing. Confirm the response **echoes your id back**.

## Op notes

- **Grade at both coordinates.** For `claude` persistent the work lands in `<workdir>`; the nested
  `agentalk-task-*` worktree is the orchestrator's and is normally empty. An artifact check at the wrong
  coordinates is worse than none ([[BL-053]] / [[BL-059]]).
- **`completed` is not a verdict.** It means the message was answered. Grade the artifact, by running things
  yourself — reproduce the before/after by hand, re-run the suite, and prove the new tests are red at the
  baseline by reverting only the source.
- **[[BL-116]] is still open and it is about you.** `--expect` patterns anchor end-to-end, so `design/operator/`
  matches nothing and you need `design/operator/**`. Nothing warns you. **Test the pattern against a path it
  must permit AND one it must refuse before trusting a `critical`** — that costs seconds and removes the whole
  class. Two runs' only `critical` was this mistake in the grader's own file.
- **[[BL-114]]: `cap.meter` is configured, never verified.** The reader coerces a missing figure to `0`, so the
  delta goes negative and the rail cannot fire while looking healthy. **`cap.wallClockMs` is the only rail you
  may honestly claim.**
- **[[BL-107]] is open and load-bearing.** HMP is `0.0.0.0` + `allow_all_peers`, confirmed live. Runs are safe
  because the PO's *commit* authorizes them, not because the channel is secure. Nothing shipped has changed this.
- **Ground truth for relay traffic is `~/.hermes/state.db`** (`messages` table, `timestamp` is unixepoch), not
  the phone and not the HTTP response — there is no status endpoint; `POST /hmp/send` returns `working` and the
  reply lands in the db.

## The through-line, if you read only one paragraph

**The rung was worth running because a plausible wrong answer existed.** BL-115 could have been "fixed" by
copying the pattern that worked next door, and that fix would have gone green on any test that only checked the
final exit — while buffering a whole test run's output until it exited. The brief's job was not to specify the
mechanism but to **name the property, name what was out of bounds, and say why**; the worker then chose a shape
nobody had written down and handled a signal case nobody had asked for. **Write the next brief the same way, and
pick an item where getting it wrong is possible** — a rung with only one available answer measures nothing.
