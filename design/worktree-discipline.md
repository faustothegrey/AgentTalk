# Worktree discipline — parallel code development without collisions

> **Status:** adopted convention (BL-036 discipline bite). **Owner:** PO (governance). **Applies to:** every actor
> that touches **code** in `AgentTalk` or `agentalk-mcp-client` — human or agent, one hat or many.
> **Companion tooling:** `scripts/wt-setup.mjs` (AgentTalk). **Policy source:** AGENT.md → Resource-Expenditure
> Monitoring (the 2026-07-16 PO worktree mandate) + the 2026-07-13 coordination near-misses (LB-90).

## 0. The rule in one line

**All code development happens in a per-task git worktree on a `task-<id>` branch; the mainline is reached only by a
PO-gated merge; the worktree is torn down at close.** Docs, backlog, and governance may be edited directly on
`master` — **code may not.** This is both the parallel-dev collision guard *and* the safety sandbox for autonomous
agents (an agent's file changes stay contained to its worktree/branch and cannot reach mainline until the gate).

## 1. Why this exists (the collisions it prevents)

Four real near-misses on 2026-07-13, plus two since, define the collision surface — each is a rule below:

- A parallel session advanced `master`/primers **under** an in-flight session → the running session's primer went
  stale within minutes. *(→ §2 isolation, §6 sync-before-you-start.)*
- A delivery arrived **uncommitted in two worktrees on two branches** (the BL-033 mess) — the same edits existing
  un-committed in two trees, unmergeable. *(→ §4.)*
- `origin` advanced **twice** under a running session; a later session built a whole closure on a checkout **23
  commits behind** origin and only found out when `git push` was rejected. *(→ §6.)*
- Two actors independently claimed the **same backlog id** (`BL-035`). *(→ §5.)*
- `git` **auto-merged `backlog.md`** with duplicate ids at different line offsets — no textual conflict, a real
  collision git cannot see. *(→ §5, §7.)*

## 2. One task → one worktree → one branch

- **Create it with the helper — don't hand-run the dance:**
  `node scripts/wt-setup.mjs create <id> [--base <ref>] [--baseline]`
  builds `/private/tmp/att-<id>` on branch **`task-<id>`**, wires `node_modules` (incl. `.bin` and relative
  `@agenttalk/*` targets), runs `tsc -b`, and (`--baseline`) prints the pre-edit suite count. Tear down with
  `node scripts/wt-setup.mjs remove <id> [--delete-branch]`.
- **Branch name is `task-<id>`** where `<id>` is the backlog id (`BL-071`) or task id (`M18-T3`) — one canonical
  name, so any actor can find any in-flight work by `git worktree list` / `git branch`.
- **Worktrees live under `/private/tmp/att-<id>`**, never inside the checkout tree.
- **Client repo (`agentalk-mcp-client`)** is lighter — no build; a worktree is a single
  `ln -s <primary>/node_modules <wt>/node_modules`. No helper is warranted there (deliberate — the AgentTalk dance
  was 90% of the pain). Its vitest transform cache is `node_modules/.vite`; `rm -rf` it to force a cold run before
  trusting a green.

## 3. Who owns `master` — merge serialization

- **`master` is verified-only and PO-gated.** No actor pushes code to `master` except through a merge the PO has
  approved. The PO says **"merge"** and **"push"** as separate words and means them literally — stop at the branch
  and wait for each.
- **Merges are serialized: one code merge to `master` at a time**, per repo. With each actor isolated in its own
  worktree, *developing* in parallel is safe (that is the whole point); the single serialization point is the
  **merge**, which the PO batons.
- **Push each repo from its own directory, in a separate step**, and **verify the push by `fetch` + reading the hash
  out of `origin/master`** — never trust the push command's own output.
- **`git merge -F <file>`** needs a message *file* (`-F -` does **not** read stdin).
- REFUTED / unfinished work **stays on its branch** and is fixed there — it never rides onto `master`.

## 4. Uncommitted work is never shared

- **The same edits must never exist un-committed in two worktrees on two branches.** A worktree's uncommitted
  changes are private to that worktree; to move work, **commit it on its `task-<id>` branch**, then let another tree
  fetch the branch. No copying dirty files between trees.
- Stage files **explicitly** — **never `git add -A`** in an AgentTalk worktree: a symlinked `node_modules` slips
  past `.gitignore` and gets staged. (`wt-setup.mjs` prints this reminder at the end of `create`.)
- `git status` / `git diff --stat` the **whole tree** before committing (Implementer Rule 5) — the omission is
  where stray out-of-scope files hide.

## 5. Backlog-id allocation without races

Two id namespaces — keep them distinct:

- **Backlog ids (`BL-NNN`)** are human/agent-allocated by editing `design/backlog.md`. To avoid two actors claiming
  the same number:
  1. **Allocate on `master`, atomically, before branching.** Add the `@item` header + `todo` line for your new
     `BL-NNN` directly on `master` (docs are master-editable), run **`npm run backlog:check`**, and confirm the
     **printed item count went up by one** (a green ✓ is not enough — an insertion can eat a neighbour's header and
     still pass; check the *count*). Then create your `task-BL-NNN` worktree.
  2. **Never trust a clean auto-merge of `backlog.md`.** After any merge that touches it, run
     `npm run backlog:check` and confirm no duplicate ids — git merges by line offset and cannot see an id
     collision. Renumber the side with **fewer external references**, honor the PO's precedence call, and annotate
     historical records rather than rewriting them.
- **Runtime ids** (`conversation`/`team`/`task`) are **not** hand-allocated — they come from `mintId(prefix)`
  (`packages/runtime-core/src/registry/ids.ts`), which is process-unique by an internal counter (not the clock).
  Always use `mintId`; never interpolate `Date.now()` into an id by hand. *(Enforcement of this convention is
  parked — BL-068 — so it is discipline, not a lint.)*

## 6. Sync before you start, and don't trust a stale primer

- **`git fetch` BOTH repos at cold-start** and read `origin/master` — a primer/backlog/ledger is a *claim* about
  state, possibly written by a session that has since been overtaken (or lost to a reboot). Verify HEAD against
  ground truth before scoping, never trust a written hash.
- Base your worktree on the freshly-fetched `origin/master` (`--base origin/master`) so you don't build on a
  behind checkout.
- A **contract-hash bump has a wide blast radius** — `grep` the OLD hash across **both** repos before scoping, so
  you find every test/mock/script that hard-codes it.

## 7. Cleanup at close

- **Tear down your worktree the moment the task closes** (merged or abandoned):
  `node scripts/wt-setup.mjs remove <id> --delete-branch`. `remove` uses `git branch -d` (safe — refuses an
  unmerged branch), **never** `-D`.
- **Leave no leak:** at close, `git worktree list` and `git branch` must show nothing of yours; `ps` for stray
  orchestrators / harnesses / `yes` hogs you started. **Identify before you reap** — never broad-`pkill`; confirm a
  process is yours (ppid, cwd, ports, `etime`) before killing it. The PO's `launchd` orchestrator service (non-default
  ports) is **not** a leak — leave it alone.
- Stale branches accumulate when this is skipped; the **one-time prune** of the historical backlog of stale
  `task-*` branches is a separate, destructive bite (BL-036), done confirm-then-prune per branch with PO sign-off.

## 8. `workdir` → worktree assignment (autonomous agents)

When an agent is launched to do code work, its **per-task worktree is its assignment boundary**: the launcher's
`workdir` parameter points the agent at `/private/tmp/att-<id>`, and everything the agent writes stays contained
there until the PO-gated merge. This is the same mechanism as a human running `wt-setup.mjs` — one convention,
whether the actor is a person or an agent. *(Caveat, BL-053: `gemini`/agy is currently the only provider that
honours a forwarded `cwd`; claude/codex hardcode `process.cwd()`, so an agy worker works in the orchestrator's
task worktree under `/tmp/agentalk-task-<id>`, not the assigned `workdir`. Check the artifact where the process
actually stood, not where you assigned it.)*

---

## Quick checklist

```
START   git fetch both repos → read origin/master (not the primer's hash)
ID      new BL-NNN? allocate on master, backlog:check, confirm COUNT +1, then branch
CREATE  node scripts/wt-setup.mjs create <id> --base origin/master [--baseline]
WORK    stage EXPLICITLY (never git add -A); commit on task-<id>; never share dirty files
MERGE   stop at the branch → PO says "merge" then "push" → verify via fetch + origin hash
CLOSE   node scripts/wt-setup.mjs remove <id> --delete-branch → git worktree list / branch clean
```
