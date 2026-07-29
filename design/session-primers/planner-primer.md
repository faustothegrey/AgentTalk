---
role: planner
key: 20260729-0845-c4f18a
written: 2026-07-29 by Claude — session close after the H-L3 regression run. The ladder is idle and the
  agent-selectable queue is EMPTY; the next move is a scoping decision, which is why this hands to the planner.
---

This is your session primer.

**Project.** AgentTalk orchestrates real, heterogeneous LLM agents (claude / codex / gemini-agy / goose) as one
software team: they attach as MCP clients over WebSocket, pull turns via `await_turn`, and coordinate through a
planner→implementer→reviewer workflow under a human Product Owner. Current thrust: the **autonomous-development
ladder** — improving AgentTalk *with* AgentTalk, one graded rung at a time.

**Roles.** Human = PO (Fausto): scope, direction, **merges**, **pushes**. Bindings live ONLY in `AGENT.md → 📌
DEFAULT ROLE ASSIGNMENTS` — read it, don't trust this line. Codex and agy remain PO-declared UNAVAILABLE, so you
are almost certainly the sole agent under the **resource-scarcity fallback**: wear every hat, handshake once per
role, declare all of them, keep each gate's discipline separately. **Standing Conditional Reassignment ACTIVE**
(you may implement). Hermes holds the **OPERATOR seat** — it launches and monitors, holds no authority, and its
reports are *observations*, unverified until you check the artifact.

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` + `AGENT.md`. Operator
briefs, pre-registered bars and gradings live in `design/operator/`. **Closed items carry a closing block +
telemetry inside the backlog item — read those first.** Resume from the backlog, **NOT from chat**.

## Where we are

**Do not trust a sha written here.** Last session's own bar was invalidated by its own closing commit (see
below), so this primer states none: run `git log --oneline -5` and `git status -sb`, and take what you find.

At close: `tsc -b` exit 0 · suite **519/519 across 76 files** · backlog **102 items, 0 warnings** · one
worktree (master only) · no `/tmp/att-*` · ports 3500/3600 free · client `c7a5991`, in sync.

**⚠️ Local master is AHEAD of `origin/master` by three commits and none of them is pushed.** `origin/master`
sits at `ef96804`. **Push is the PO's act — ask, never assume.** If the PO expects a clean push state, that
gap is the first thing to raise.

**Shipped this session — one arc: H-L3, a regression rung.** The PO commissioned a brief operator session to
confirm nothing broke since H-L2. It passed on all four blocks (P 5/6 · R 6/6 · C 4/4 · W 7/7): launch,
attach, worker write, containment, harness bracket and teardown all behaved as they did the day before. The
worker's commit is preserved as tag `hl3-worker-52df7f0` plus `/tmp/hl3/worker.patch`. Brief, bar and grading:
`design/operator/hl3-{brief,bar-real,grading}.md`.

**Read `hl3-grading.md`'s opening section before you write your next bar.** The bar hardcoded a reference sha
and then the act of committing the brief moved it — so a literal reading of the row would have **failed the
worker for being correct.** The brief warns against that exact trap one section above its own config. The
lesson is not "read the runbook"; it is that **reference values must be re-derived immediately before
hand-over**, because the last thing you do before handing over is usually a commit.

## Your queue

1. **The agent-selectable set is EMPTY — no item is `autonomy: eligible`.** Nothing can be handed to a worker
   unattended until the PO marks something. **This is the first scoping decision and it is yours to propose:**
   which of the open items is boundable, test-local, and safe enough to be worth an autonomous rung? [[BL-093]]
   made eligibility fail closed, and `bl093-backlog-selectable.test.ts:147` pins the real backlog's selectable
   set exactly — so changing it goes red and forces a human look. **Do not loosen that test to make room.**
2. **[[BL-102]] — filed this session, from grading H-L3.** An autonomous worker's commits are authored under
   the **PO's git identity**, so in history they are indistinguishable from the human's. True of every run back
   to O-1. Small today because worker branches are force-deleted; it stops being small the moment a worker
   commit is actually merged — which is where the ladder is heading.
3. **[[BL-101]]** — the cross-repo contract check **fail-opens in every worktree**, so under the worktree
   MANDATE it never runs during development. It is the check that would have caught the v7/v8 client mismatch.
4. **[[BL-098]]** — on Linux nothing can classify `LEGITIMATE` (`launchctl` only). **It did NOT bite H-L3**
   (nothing was still listening at sweep time), so it is real but less urgent than it reads.
5. **[[BL-096]]** — the long-run failure class is STILL untested. No run in this project's history has ever
   been interrupted. **Do NOT cite O-3, O-4 or H-L3 as evidence about it** — 4m44s, 9m04s, and 84s.
6. **[[BL-100]]** (PORTING half done) · **[[BL-086]]** (a PO decision) · **[[BL-084]] T2** → unblocks
   **[[BL-028]]**.

## What to reuse — mechanisms that keep earning their keep

**The mutation check.** Before believing any "it's green now", ask: *would this look identical if the change
did nothing?* Cheap, and it is the difference between a bar and a decoration.

**Pre-register the bar, hash it, publish after.** Write the bar before hand-over, commit its SHA-256 in the
brief, publish the file only after grading, and **re-verify the hash at publication** — that is what makes
"no row was retuned after the results" checkable rather than asserted.

**Predict in writing, then score your own predictions.** Two of six were wrong in H-L3 and are recorded as
wrong. A prediction list that only ever confirms itself is decoration.

**Grade the artifact, at the coordinates where the process actually stood.** `completed` ≠ done. Re-run the
load-bearing bars yourself; an operator's report is one layer further from the evidence than a worker's.

## Op notes

- **Worktrees:** `node scripts/wt-setup.mjs create <id> --base master --root /tmp` (**`--root /tmp` on Linux,
  every time, including `remove`** — `DEFAULT_ROOT` is the macOS `/private/tmp`). It prepends `att-`. **Stage
  files EXPLICITLY and run `git status` AFTER committing.**
- **Gates:** `npx tsc -b` + `npx vitest run`; `npm run backlog:check` after ANY backlog edit (update **both**
  the header `status:` and the prose tag). Closing an item with `autonomy: eligible` **fails the gate**.
- **The meter WORKS on Linux** — `node scripts/usage.mjs`. Ignore any older primer or `PORTING.md` §11 line
  saying it won't exist; that was corrected in [[BL-100]]. At close: weekly **44%**, session **14%** (weekly
  window resets ~09:00 Europe/Rome).
- **Operator runs:** `design/launch-and-monitor-runbook.md` is the contract. Pass `--expect` with
  `allowWritePaths` **only if the operator itself commits**; H-L3 needed none. Nothing forces the flag yet.
- **`git merge -F -` does not read stdin** (unlike `git commit`). Write the message to a file.
- **`npm run backend` leaves a child that outlives the npm wrapper.** Confirm the port is actually free.

Verify all of the above against ground truth before acting. Report your understanding, then **STOP** for the
PO's go.
