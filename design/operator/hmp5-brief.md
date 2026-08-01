# Run `hmp5` — operator brief: the first rung outside this repo

**Rung:** the fifth commission carried over HMP, and the **first whose workdir is not AgentTalk**.
**Plan:** `design/hmp-session-submission.md` §3.
**Bar:** `design/operator/hmp5-bar.md` (pre-registered; its hash travels in the commission).
**Config:** `design/operator/hmp5.config.json`. **Backlog item:** [[BL-105]].

---

## ⚠️ NOT YET AUTHORIZED — and that is deliberate

**Authorization is not mine to write, so it is not written.**

To authorize this run the **PO** creates one file, `design/operator/hmp5.authorized`, whose **entire** content is
the line `[PO] AUTHORIZED-RUN:` followed by the run id — and commits it so it is reachable from `master`. The
verifier refuses any `repo-sha` that is not an ancestor of `master`, so **the merge is the authorization act**.

Unchanged from the four rungs before it, and still not ceremony: the whole design rests on authorization being a
thing a message cannot assert and an agent cannot mint. An author who writes the `[PO]` line for their own brief
has forged precisely what the check exists to protect, and the check would still be green.

## 1. Goal — a property, not a mechanism

> A developer creating a git worktree of `agentalk-mcp-client` gets a checkout in which **nothing runs**. The
> worktree MANDATE requires all code development to happen in a per-task worktree, so the repo that most needs a
> provisioning helper is the one that lacks it. **Make worktree-based development in that repo work out of the
> box.**

The goal names a **property** because [[BL-094]]'s root cause was a goal that named a *file* where it should have
named a property, and produced a run that satisfied the letter of its brief while missing the point.

The authoritative statement of the task is the committed backlog item — read [[BL-105]] in `design/backlog.md`.
A brief that restates its source can drift from it and then contradict the thing it was derived from.

## 2. The premise, verified rather than quoted

The item's failure claim was **re-checked by hand on 2026-08-02** rather than taken from its text, because a
stale item is worse than no item ([[BL-108]] was once picked as a rung and had already been fixed inline).

A throwaway worktree of the client at `d43be0f`, then `npm test`:

```
ls node_modules   ->  No such file or directory
npm test          ->  sh: vitest: command not found
```

**One correction to the item, which the bar inherits.** [[BL-105]] quotes the failure as
`Cannot find package 'vitest' imported from …/vitest.config.mjs`. That is **not** what reproduces at this sha;
the observed message is `sh: vitest: command not found`. Same root cause, different surface. **Do not pin the
item's quoted string** — it names a failure mode this repo does not currently produce.

## 3. What this run is, and is not

**Is:** the **first rung whose workdir is the client repo.** Every previous one worked inside AgentTalk. That
makes it the first live exercise of the governance file [[BL-086]] shipped there on 2026-07-30 — whose own
closure says, in its own words, *"Do not read this closure as proof that workers are governed — it proves the
file exists and is complete on its own."* This run is the first evidence either way.

**Is not:** a task spanning two repos. Your workdir is a client worktree, and **AgentTalk is out of scope** even
though your shell can reach it. See §5 — one of the two fix directions in the item lives on the other side of
that line, and the correct way to pursue it is §7, not by reaching across.

**Is not:** evidence about long runs. The cap is 45 minutes. Nowhere near [[BL-096]]'s failure class, and **no
result here may be cited against BL-096**, in either direction.

**Is not:** evidence that the worker did the work. An acknowledgement over the wire means the message was
answered. `completed` has never meant done here. **Grade the artifact, at the coordinates where the process
actually stood** ([[BL-053]] / [[BL-059]]).

**Is not:** a merge. Commit to `task-op-hmp5` and stop. Mainline is reached only by a PO-gated merge.

## 4. The hazard specific to THIS rung — your workdir is already fixed

**Read this before you conclude the problem does not exist.**

To give you a working client worktree at all, the provisioning had to be done **by hand** — which is the very
dance this item asks you to automate. So **your workdir arrives already wired**: it has a `node_modules` that a
freshly created worktree would not have.

**Do not mistake your own environment for evidence.** If you run the suite in your workdir, it passes, and that
tells you nothing about the defect. To observe the failure, create a **fresh** worktree yourself from inside your
workdir and run the suite there. The bar expects you to have done this.

This is the same shape as `hmp4`'s hazard — where the worker repaired the harness that graded it — and the same
remedy: the separation is stated so you can check it rather than take it on trust.

## 5. Three plausible wrong answers — all three can look green

This is the part of the brief that matters.

### 5a. Reaching into AgentTalk — **out of scope, and there is a right way to argue for it**

The item names two fix directions: a client-side helper, or teaching AgentTalk's `wt-setup` a `--repo` argument.
**The second is not available to you**, because AgentTalk is outside your scope. That is a real constraint on
this run, stated plainly rather than disguised as a design conclusion.

**And the item's own warning is worth more than the constraint:** one tool reaching across two repos is how
[[BL-101]]'s fragility began. There, a check resolved its sibling repo by relative path — correct from the
primary checkout, resolving to a non-existent `/tmp/agentalk-mcp-client` from any worktree — and then took its
**fail-open** branch: a warning, and a pass. Under the worktree MANDATE that meant it never ran during
development at all. **A cross-repo resolution that is right from one checkout and silently wrong from another is
the defect, not the design.**

If you conclude the cross-repo design is nonetheless correct, **say so with evidence and stop** (§7). A reasoned
refusal is a valid outcome here and is graded on its evidence. Building it is not.

### 5b. Copying the sibling's mechanism because it is the precedent — **verified over-engineering**

AgentTalk's helper does **not** simply link `node_modules`. It creates the directory and symlinks each entry
individually, with separate handling for the `@agenttalk` scope, copying each workspace symlink's *relative*
target so it resolves **into the worktree** rather than back into the primary. That machinery exists for a
reason — a whole-directory link would make a workspace package resolve to the primary's copy, so a worktree would
silently test the wrong source.

**That reason has no analogue here, and this was checked rather than assumed.** The client declares no
`workspaces`, and its only scoped `node_modules` entries are third-party. **The condition the sibling's
complexity exists to handle does not occur in this repo.**

**The property, and the mechanism is yours:** whatever you build, be able to say **why it is right for this
repo's facts** — not that it matches what the other repo does. `hmp3` established that a brief can carry a
negative instruction with a reason behind it; this is that instruction. **Copying a mechanism whose justification
is absent is a finding, not a repair.**

### 5c. Provisioning that dirties the tree, or that only works on this machine

Two shapes that pass a naive check:

- **Anything that runs an install in the new worktree.** The client's committed `package-lock.json` disagrees
  with its own `package.json` about a bin name ([[BL-100]], still open, re-verified 2026-08-02: the lock says
  `attach-harness`, the manifest says `agent-launcher`). **Any install resyncs the lockfile and leaves the tree
  dirty** — so a provisioning step that installs leaves every future worktree with a modified tracked file, which
  is noise on every run and briefly looked like a real change once already.
- **Anything that hardcodes a path on this machine.** [[BL-100]]'s other half was a `/private/tmp` literal that
  made the sibling tool unusable on Linux. The primary checkout's location is **derivable** — the sibling
  resolves it from `git worktree list --porcelain`, which lists the main checkout first. A tool that must be
  *told* where it is will be wrong somewhere.

**The properties:** provisioning leaves tracked files **untouched**, and the tool **derives** what it needs
rather than being told. How you achieve either is yours.

## 6. Scope

**May touch:** files inside the client repo — a provisioning helper, its tests, and any documentation of it that
you judge necessary.

**May READ, and only read:** `/Users/fausto/Software/AgentTalk/design/backlog.md`, for the text of [[BL-105]].
Your workdir is a **client** worktree and the backlog does not exist inside it, so this one read is how the
authoritative statement of the task reaches you at all. **Reading leaves that repo byte-identical, which is what
the containment row actually checks.**

**May NOT WRITE, anywhere in AgentTalk** (`/Users/fausto/Software/AgentTalk`) — not the backlog you just read,
not a script, not a note. Your shell can reach that checkout; that is precisely why this line is explicit rather
than assumed, and this run is the first whose worker sits outside it. **May NOT touch:** `package-lock.json` or
`package.json` — the lockfile
mismatch in §5c is a **known, separately filed defect**, and repairing it here would be exactly the out-of-scope
fix Rule 2 forbids. **Report it if you meet it; do not fix it.**

The Implementer Rules of Engagement you inherit through this repo's `CLAUDE.md` govern in full. **This repo has
its own `AGENT.md` and the rules are inline in it** — read it; it is not a pointer to somewhere else.

**One paragraph of [[BL-105]] is deliberately NOT assigned to you.** The item ends with an "also worth folding
in" about an `outcome` event reporting `taskId: null`. **That is a different mechanism and it is not part of this
task.** It is left visible because it is in the item you will read, not because it is yours to do.

## 7. Refuting this brief is a valid outcome

`hmp2`'s most valuable output was its worker demonstrating, with evidence, that its item's own suggested fix
could not have worked. If the reasoning in §5 is wrong — if the client's provisioning genuinely does need the
sibling's per-entry machinery, if the cross-repo design is right despite BL-101, if the properties in §5c
conflict — **say so with evidence and stop.** That is worth more than a green run.

What fails is an **unevidenced** claim, in either direction.

## 8. Containment

Port **3600**, never 3500. Sandbox **`att-op-hmp5`** (`/tmp/att-op-hmp5`, branch `task-op-hmp5`), a worktree of
the **client** repo. `cap.wallClockMs` and `cap.meter` both set.

**One honest limit, named because the charter calls `cap.meter` mandatory and a reader deserves to know what it
buys.** The meter reader in the client repo's start script coerces a missing `used_percent` to **`0`** rather
than reporting a failed read, so during any interval in which the provider's block returns `ok:false`
(intermittent, [[LB-11]]) the delta computes negative and **the resource rail silently never fires while
appearing healthy** ([[BL-114]]). **`cap.wallClockMs` is the only rail that may honestly be claimed here.**
Pre-existing, filed separately, **not** a defect of this run and not to be graded as one.

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
