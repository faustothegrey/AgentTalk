# Run `hmp7` — operator brief: the first rung that changes engine code

**Rung:** the seventh commission carried over HMP, and the first whose worker **changes engine code** — every
prior rung (hmp1–hmp6) was read-only, a client-repo implementation, or an investigation that changed nothing.
**Plan:** `design/hmp-session-submission.md` §3.
**Bar:** `design/operator/hmp7-bar.md` (pre-registered; its hash travels in the commission).
**Config:** `design/operator/hmp7.config.json`. **Backlog item:** [[BL-121]].

---

## ⚠️ NOT YET AUTHORIZED — and that is deliberate

**Authorization is not mine to write, so it is not written.**

To authorize this run the **PO** creates one file, `design/operator/hmp7.authorized`, whose **entire** content
is the line `[PO] AUTHORIZED-RUN: hmp7` — and commits it so it is reachable from `master`. The verifier refuses
any `repo-sha` that is not an ancestor of `master`, so **the merge is the authorization act**.

Unchanged from the six rungs before it, and still not ceremony: the whole design rests on authorization being a
thing a message cannot assert and an agent cannot mint. An author who writes the `[PO]` line for their own brief
has forged precisely what the check exists to protect, and the check would still be green.

## 1. Goal — the item, and the deliverable

> Implement backlog item BL-121 — delete the unreachable `busy` branch in `Registry` and rename the helper to
> say what it actually does — satisfying the item's own bar, whose deciding row is OBSERVABLE-EVENT PARITY on
> the `send_to_agent → user` path, with your new test proven red at the baseline. Commit on your branch; change
> nothing outside the item's scope.

The authoritative statement of the task is the committed backlog item — read [[BL-121]] in `design/backlog.md`.
A brief that restates its source can drift from it and then contradict the thing it was derived from.

## 2. The premise, verified by SYMBOL rather than by line number

The item insists on this, and the item is right to: the file drifts ([[BL-120]] was filed with numbers already
~15 lines stale). Re-verified by hand on 2026-08-08 at master `0aefb2e`:

- `setAgentBusyState(agent, busy)` — `packages/runtime-core/src/registry/registry.ts:822` — has exactly **one**
  call site, `registry.ts:548`, inside `send_to_agent`'s `to === 'user'` branch, and that call site passes
  **`false`**. The `busy === true` branch (with `updateAgentSessionStatus(agent, 'busy')` at `:823`) cannot
  execute.
- The item says the mechanism, not the numbers, is what matters. At `0aefb2e` the call-site symbol is
  `this.setAgentBusyState(agent, false)` at `:548`; a future sha may move it. **Grep for the symbol and trust
  what you find.**
- The two `busy` **producers** the rename must NOT disturb: the driver
  (`in-process-driver.ts:118` — `notifyAgentStatus(this.agent, 'busy')` on every pulled turn) and the reconnect
  restore (`registry.ts:1380` — `this.setAgentStatus(agent, agent.currentTurnId ? 'busy' : 'ready')`).
- A comment at `registry.ts:888` already records the BL-120 correction; the rename's own comment joins it.

The change itself: `setAgentBusyState(agent, busy)` becomes `markAgentIdle(agent)` — no boolean parameter, no
dead branch — keeping exactly its reachable behaviour: set `sessionStatus` to `'ready'`, and move `status` from
`busy` to `ready` **only if it was `busy`**.

## 3. What this run is, and is not

**Is:** the **first engine-code change** on this ladder — a rename + dead-branch deletion in one private helper,
its one call site, a comment, and the parity test the bar requires.

**Is not:** a permission to loosen the fence because the tree is now being written. The bar's B4 pins the suite
at **722/722, 86 files** — a green suite with a weakened assertion is a finding, not a pass (assertion-line
counts are verified mechanically).

**Is not:** evidence about long runs. The cap is bounded and nowhere near [[BL-096]]'s failure class; no result
here may be cited against BL-096, in either direction.

**Is not:** evidence that the worker did the work. An acknowledgement over the wire means the message was
answered. `completed` has never meant done here. Grade the artifact, at the coordinates where the process
actually stood ([[BL-053]] / [[BL-059]]).

**Is not:** a merge. Commit to `task-op-hmp7` and stop. Mainline is reached only by a PO-gated merge.

## 4. The hazard specific to THIS rung — the parity bar is a show-stopper, and its red path is the point

Every rung before this one was safe to botch because it changed nothing. This one **changes engine code**, and
the whole justification for the change is that the `busy` branch is unreachable. That justification is tested,
not assumed:

**⚠️ SHOW-STOPPER (verbatim from the item): if the parity bar shows ANY event-sequence difference, the worker
STOPS and reports.** That would mean the branch was not unreachable after all and the entire justification
collapses — **reporting that is a *success*, not a failure.**

The bar's R2c makes this graded: a STOP-and-report with evidence of an event-sequence difference is a PASSED
rung. The one thing that fails is silence — a run that completes without stating whether the parity held, in
either direction.

## 5. Three plausible wrong answers — all three can look green

### 5a. "Fixing" the asymmetry by wiring `busy` instead of deleting it — **out of scope, and it is the show-stopper's twin**

The item's fence is the inverse of hmp6's: **wiring rather than deleting** is the forbidden direction. The item
names why: a second `busy` producer next to `ArbiterCoordinator`'s strict `=== 'ready'` convergence gate and a
transition table that **throws** — an escaped `Invalid transition: terminated -> busy` once killed the
orchestrator process (M17 G3-4, [[BL-020]]). A worker that "fixes" the symmetry has bypassed the very gate the
rung exists to test. The parity test exists to verify the branch is dead; it is not a licence to revive it.

### 5b. A parity test written against internal fields instead of emitted events — **fails B1's letter**

The item is explicit: *"Write it against the **emitted events**, not internal fields — events are what a
consumer observes."* A test that asserts `agent.status`/`agent.sessionStatus` directly has not tested what a
consumer would see, and does not meet the bar — even if it goes green.

### 5c. Touching the out-of-scope list — **visible, tempting, and each item is fenced for a reason**

Narrowing the `AgentSessionStatus` union (feeds `isAgentSessionStatus` in the wire contract; `mcp-server.ts`
rejects a mismatch on binary hash equality — LB-66), deleting `sessionStatus` (deliberately kept), the
`apps/web/src/api/types.ts:46` drift, and the coordinator files are all **out of scope**. The item names them
precisely so a worker that meets them reports them (Rule 2) rather than fixes them. Any of them changed fails
R5 regardless of merit.

## 6. Scope

**May write:** `packages/runtime-core/src/registry/registry.ts` (the helper, its one call site, the comment),
the new parity test, and nothing else. `git diff --stat` against the launch baseline must touch **only** the
registry source, its tests, and the new parity test.

**May read:** anything in this repo, including the code paths named by the item. The backlog **is** in your
workdir (`design/backlog.md`), so no external read is needed.

**May NOT write:** any other file, anywhere — not notes, not the out-of-scope list, not `design/operator/`
itself. The primary checkout `/Users/fausto/Software/AgentTalk` must remain byte-identical (your shell can reach
it; that is precisely why this line is explicit).

The Implementer Rules of Engagement you inherit through this repo's `CLAUDE.md` govern in full.

## 7. Refuting this brief is a valid outcome

`hmp2`'s most valuable output was its worker demonstrating, with evidence, that its item's own suggested fix
could not have worked. If the reasoning in §2 is wrong — if the `busy` branch is reachable after all, if the
parity check shows any event-sequence difference — **say so with evidence and stop.** That is the rung
succeeding, not failing.

What fails is an **unevidenced** claim, in either direction.

## 8. Containment

Port **3600**, never 3500. Sandbox **`att-op-hmp7`** (`/tmp/att-op-hmp7`, branch `task-op-hmp7`), a worktree of
AgentTalk. `cap.wallClockMs` and `cap.meter` both set.

**One honest note on the caps (operator-skill correction, 2026-08-07).** Since [[BL-117]] `cap.meter` **no
longer terminates anything** — it was demoted to a warning after it killed complete, verified work on `hmp5`
fourteen seconds after the worker committed. It is still **mandatory to configure**, but `cap.wallClockMs` is
the **only rail** that will stop this run. It is set **deliberately at 90 minutes**: a first engine-code change
with a rename, a new parity test, a red-at-baseline proof, a full suite run (722 tests), and a `tsc -b` —
generous-but-bounded, and nothing else will stop a wedged worker. Do not read the meter as a second rail.

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
