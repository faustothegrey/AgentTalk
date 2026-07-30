---
role: planner
key: 20260730-1032-9ba4e7
written: 2026-07-30 by Claude — session close after five items closed (BL-086 · BL-100 half 2 · BL-101 ·
  BL-102 · BL-106). Both repos pushed and in sync. Hands to the planner because everything left is either a
  PO decision or an engine arc that needs a real plan.
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
separately. **Standing Conditional Reassignment ACTIVE** (you may implement). Hermes holds the **OPERATOR
seat** — launches and monitors, holds no authority, and its reports are *observations*, unverified until you
check the artifact.

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` + `AGENT.md`. **Closed
items carry a closing block + telemetry inside the backlog item — read those first.** Resume from the backlog,
**NOT from chat**.

## Where we are

**Don't trust a sha written here — run `git log --oneline -5` and `git status -sb` and take what you find.**

At close: **both repos pushed and in sync** (AgentTalk `9dd2cf0`, client `e011f0d`) · `npm test` **523/523
across 77 files** · client **104/104 across 19** · backlog **106 items, 0 warnings** · one worktree (master
only) · no `/tmp/att-*` · ports 3500/3600 free · weekly budget **5%**.

**Closed this session — five items, and the through-line is worth knowing.** Three of them were defects that
were *invisible because the check that would have caught them was fail-open*:

- **[[BL-086]]** — the client repo had **no governance at all**; it now carries its own `AGENT.md` (+
  `AGENTS.md`/`CLAUDE.md` symlinks), rules **inline** rather than behind a cross-repo pointer, and no primer
  handshake (that would halt every launched worker). Client-repo tasks are no longer excluded from autonomous
  work.
- **[[BL-101]]** + **[[BL-106]]** — **neither direction** of the cross-repo contract check ran in a worktree.
  Under the worktree MANDATE that meant the alignment guarantee was absent from the entire workflow while
  appearing green. Both now resolve the primary checkout via
  `git rev-parse --path-format=absolute --git-common-dir`.
- **[[BL-102]]** — every worker commit back to O-1 was authored as the PO. Now set on the worker **process**
  (`GIT_AUTHOR_*`/`GIT_COMMITTER_*`) at all four launch sites. Verified by two live launches.
- **[[BL-100]] half 2** — `wt-setup`'s `DEFAULT_ROOT` is `os.tmpdir()`; **`--root` is no longer needed on
  Linux**.

**Read `design/lessons/claude-lessons.md`'s 2026-07-30 entry before you plan anything.** Three separate
path-resolution mistakes landed in one day, the third *inside the test written to catch the second*. The
reusable form: **"the worker does X" is not a proposition until you name the execution path**, and **a skip is
not a neutral test outcome.**

## Your queue

1. **The agent-selectable set is STILL EMPTY — this is the standing open question and it is now a full session
   old.** Every item this session was implemented by the agent itself; the ladder has been idle throughout.
   `bl093-backlog-selectable.test.ts` pins the empty set exactly, so marking anything goes red **by design** and
   forces a human look. **[[BL-103]]** or **[[BL-104]]** are the most boundable candidates. Marking is a **PO
   act** — propose, don't mark.
2. **[[BL-084]] T2 → T3 (= [[BL-028]])** — the engine arc and the only real behaviour change left, on
   `registry.ts` + `team-coordinator.ts`. T1 is merged. Plan: `design/bl084-plan.md`. Needs a real Gate 1; this
   is not "while we're here" work.
   **§4's classification table is RATIFIED and encoded — do not go looking for a ratification to chase.** The
   PO ratified it 2026-07-27 (including *reversing* the `unknown-mcp-tool` row to non-fault) and T1 landed it.
   An earlier version of this primer said otherwise; that was a stale claim copied from the backlog without
   checking §4, and it is exactly the failure the "distrust the docs, check ground truth" rule exists for.
   **What actually gates T2** is a re-gate of the T2 step plus the PO's go-ahead on the behaviour change
   itself — after T2, an in-process agent erroring with a *fault-class* reason will interrupt its team, which
   it has never done.
3. **HMP session submission** — `design/hmp-session-submission.md`, a **proposal awaiting five PO decisions**
   (§8). Two are gating: *where the operator process runs* (a Pi can carry a message but cannot run a session),
   and *per-run `[PO]` authorization vs a standing grant*. Its load-bearing idea: **authorization is anchored in
   the committed repo, not in the message**, because HMP is unauthenticated.
4. **Filed this session, unstarted:** [[BL-103]] (teardown leaks a branch per run) · [[BL-104]] (`wt-setup`
   reports git failures as raw Node stacks) · [[BL-105]] (client repo has no worktree helper — and the MANDATE
   requires one; also carries BL-102's `taskId: null` audit defect).
5. **[[BL-096]]** — the long-run failure class is **still untested**; consider its own suggestion of a cheap
   direct cap test first. **[[BL-098]]** — Linux `LEGITIMATE` classification, confirmed live, gates operator
   runs. **[[BL-100]] half 1** — client lockfile drift, **the PO's to land**.

## What to reuse

**The mutation check, every time.** Four fired this session and two caught real design errors. Ask: *would this
look identical if the change did nothing?* A row never watched to fail is not evidence.

**Verify the bar's COMMAND, not just its rows.** `npx vitest run` does not run the contract check; `npm test`
does (`package.json:11` chains a workspace script ahead of vitest). A green from the wrong command is worse than
a red.

**Grade the artifact, at the coordinates where the process actually stood.** `completed` ≠ done — proven again
this session: a run reported `completed` while its assigned worktree sat **empty**.

**Re-derive reference values immediately before hand-over.** Suite counts, shas, paths. Three days running, the
hardcoded-reference trap has cost something.

## Op notes

- **Worktrees:** `node scripts/wt-setup.mjs create <id> --base master` — **no `--root` needed any more**
  ([[BL-100]]). It prepends `att-`. **Stage files EXPLICITLY and run `git status` AFTER committing.** A failed
  `create` leaks its branch ([[BL-103]]); a failed `remove` prints a raw Node stack ([[BL-104]]).
- **The client repo has NO worktree helper** ([[BL-105]]): after `git worktree add`, symlink `node_modules` from
  the primary or nothing runs.
- **Gates:** `npx tsc -b` · **`npm test`** (not bare vitest, see above) · `npm run backlog:check` after ANY
  backlog edit (update **both** the header `status:` and the prose tag).
- **The meter works on Linux** — `node scripts/usage.mjs`. Session window resets every ~5h; weekly resets Aug 5.
- **`git merge -F -` does not read stdin.** Write the message to a file.
- **`git config` inside a linked worktree is NOT worktree-scoped** — it writes the shared config and would
  rewrite the PRIMARY checkout's identity. Probed, and it is why BL-102 went the env route.
- **Operator runs:** `design/launch-and-monitor-runbook.md` is the contract; it was corrected this session (the
  `/private/tmp` default and the client-governance warning were both stale).

Verify all of the above against ground truth before acting. Report your understanding, then **STOP** for the
PO's go.
