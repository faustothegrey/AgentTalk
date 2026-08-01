---
role: planner
key: 20260801-2144-9c4e17
written: 2026-08-01 by Claude — session close after the fourth HMP-carried rung. BL-116 was
  commissioned, delivered, graded PASS on R1–R7, merged, closed and PUSHED in one session.
  No queue state is written here. That is not an omission; read on.
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
than a chore. A queue state named in a primer has gone stale **five times** now — including once inside the
paragraph written to prevent it. The instrument is one command. Use it.

Verified at the moment of writing (2026-08-01 21:44Z), not remembered: `tsc -b` clean · backlog **117 items,
0 warnings** · ports 3500/3600 free · **no worktrees but the primary, no branches but `master`** · claude weekly
**38%** · **both repos pushed and in sync.**

## ⚠️ The one thing to do first

**Find out whether there is a rung waiting, and do not assume either answer.** Run the command above.

- **If the set is non-empty:** you have a rung. **Verify the item is still real before you hand it out** — a
  session picked BL-108 once and it had already been fixed inline; an eligible no-op produces a green run that
  proves nothing, which is worse than not running. Then write its brief (see below).
- **If the set is empty:** refilling it is a **PO act** — `autonomy: eligible` is authority in file form, and
  [[BL-093]] made it fail closed. **Do not mark anything eligible yourself, and do not treat an empty queue as
  permission to pick something.** Bring the PO candidates with your reasoning and let them choose.

## What the four rungs established — read this before writing the next brief

Each proved one new thing, and they are cumulative:

- **`hmp1`** — a commissioned worker can *observe*. Its own grading says what it left open: "the one property
  tested was that it didn't write."
- **`hmp2`** ([[BL-104]]) — it can *write*: change tracked files, commit to its own branch, in scope. Its best
  output was refuting the item's own suggested fix with evidence.
- **`hmp3`** ([[BL-115]]) — **it can take reasoning over precedent.** The obvious fix (copying the sibling's
  mechanism) would have passed a naive bar while regressing a build's live output. The brief said "not like
  that, and here is why", and it held. First evidence a fenced brief can carry a *negative* instruction.
- **`hmp4`** ([[BL-116]]) — **it can repair the instrument that grades it, and choose a SHAPE nobody specified.**
  The declaration/merge split — threading the raw `--expect` as a fourth parameter so the built-in defaults are
  never judged — was not in the brief; it is what makes the "fires on a byte-identical run" trap *impossible*
  rather than merely avoided. Three named wrong answers, two of which go green. It took none of them.

**So what is still unproven, and where the next rung should aim.** Duration ([[BL-096]]): the longest run so far
is **13m28s** against caps of 30–45m, so nothing has approached that failure class. **Whether a worker will
speak up unprompted:** `hmp3` and `hmp4` both reported nothing out of scope, and both silences are recorded in
their closures as facts rather than endorsements — two in a row is now a pattern worth designing a rung around.
And **a task whose scope spans more than one file family**, since every rung so far has been two files.

## How a run actually goes — the parts that are not obvious

- **`design/hmp-session-submission.md` is the design; the commissioning verifier in `scripts/` is the law.** Read
  the second one. It is the only lawful entry point and every check fails closed.
- **Authorization is the PO's commit, not a message.** `design/operator/<run>.authorized`, whose **entire**
  content must equal `[PO] AUTHORIZED-RUN: <run>`, reachable from `master`. **Do not write it yourself** — an
  agent that mints its own authorization has forged exactly what the check protects, and the check stays green.
- **There is no rehearsal any more, and this is structural.** Once the PO's `.authorized` commit lands,
  **anything reaching the wire launches.** Rehearsal and authorization are mutually exclusive by construction.
  Get the dry-run right instead: `--dry-run` against the committed sha exercises every check and launches
  nothing.
- **The order that works:** write brief/bar/config → **dry-run** (expect `no-po-authorization`) → PO commits
  `.authorized` → **dry-run again** (expect `workdir-missing` — that refusal is progress, not a fault) →
  provision (`wt-setup.mjs create op-<run> --base master --root /tmp` on **macOS**) → **dry-run again** (expect
  `accepted`) → snapshot → send → grade. Each refusal names exactly which check is next; that ladder is the
  cheapest debugging in the system.
- **The recursion fence scans the BRIEF's committed text.** It refuses the launcher's and the verifier's
  filenames, the discriminator, the send endpoint, and any phrasing that reads as instructing the receiver to
  start a further session. Check with `findsLaunchInstruction` **while writing**, not after being refused — it
  costs one command. *(This paragraph is deliberately worded around the patterns rather than quoting them: the
  matcher cannot tell an example from an instruction, so a primer that spelled them out would refuse any brief
  that copied it — the same lesson that moved authorization out of the brief and into its own file.)*
- **Keep the wire message short and put the commission in a FILE.** ~220–250 chars carrying one command that
  reads `/tmp/<run>-commission.txt` locally. A 342-char message once arrived as 154.
- **Pass a real `message_id` and confirm the response echoes it back.** An early probe sent `undefined` and the
  POST still looked healthy — replay protection travelled as nothing.
- **Status reads taken too early lie.** The ledger entry lands ~20s after the POST. A check before then shows
  "not launched" and is a fact about your timing, not the channel. Wait before concluding.

## Op notes

- **Grade at both coordinates.** For `claude` persistent the work lands in `<workdir>`; the nested
  `agentalk-task-*` worktree is the orchestrator's and is normally empty. An artifact check at the wrong
  coordinates is worse than none ([[BL-053]] / [[BL-059]]).
- **`completed` is not a verdict.** It means the message was answered. Grade the artifact by running things
  yourself — reproduce the before/after by hand, re-run the suite, and prove the new tests are red at the
  baseline by reverting **only** the source.
- **[[BL-116]] is CLOSED — the `--expect` footgun is now instrumented.** A pattern or key that cannot have
  applied is reported as a `warn` saying *"declared but never matched"*. **This does not retire the habit:** test
  your declaration against a path it must permit **and** one it must refuse anyway. Three of four brackets had a
  `critical` that was the grader's own file. Note the new `warn` also flips an otherwise clean bracket's exit
  from 0 to 1 — accepted and documented, not a defect.
- **Run the harness from the PRIMARY checkout, with the repos it should watch.** Running a worktree's copy makes
  it snapshot the *worktree*; BL-090's path-mismatch check catches it, but only if you read the output rather
  than the exit code.
- **[[BL-114]]: `cap.meter` is configured, never verified.** The reader coerces a missing figure to `0`, so the
  delta goes negative and the rail cannot fire while looking healthy. **`cap.wallClockMs` is the only rail you
  may honestly claim.**
- **[[BL-107]] is open and load-bearing.** HMP is `0.0.0.0` + `allow_all_peers`, confirmed live. Runs are safe
  because the PO's *commit* authorizes them, not because the channel is secure. Nothing shipped has changed this.
- **Ground truth for relay traffic is `~/.hermes/state.db`** (`messages` table, `timestamp` is unixepoch), not
  the phone and not the HTTP response — there is no status endpoint; the send returns `working` and the reply
  lands in the db.

## The through-line, if you read only one paragraph

**Pick an item where getting it wrong is possible, and write the brief to name the PROPERTY and what is out of
bounds — never the mechanism.** BL-116 had three plausible wrong answers and two of them go green: loosening the
matcher (which would have widened the very fence it protects), inspecting the merged object (which would have
fired on a run where nothing happened), and raising the severity (a new way to gate a clean run). The brief named
all three and specified none of the fix. The worker then produced a structure nobody had written down. **A brief
that specifies the mechanism cannot be outperformed; one that specifies the property can be** — and a rung with
only one available answer measures nothing.
