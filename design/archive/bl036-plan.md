# BL-036 (tooling bite) — `wt-setup` worktree helper (plan)

> **Status:** DRAFT for the plan-review gate. Planner: Claude (resource-fallback).
> **Scope:** the **tooling** half of BL-036 (the "worktree-create helper" the item names). The discipline *doc*
> (merge serialization, id allocation without races) and the one-time **stale-branch prune** are **separate
> bites**, flagged not done here.

## 1. Why now / the pain

The per-task worktree is mandatory for all code (PO, 2026-07-16), but the setup is a hand-run, error-prone dance —
performed **4× in this session alone**. Its gotchas are exactly the ones the op-notes warn about (and that bite
when forgotten): `*` doesn't glob `.bin` → `vitest: command not found`; `@agenttalk/*` must be re-created with
**relative** targets so they resolve into the worktree (not the primary); `apps/web/node_modules`; `dist` is
gitignored so `tsc -b` must run first. A helper turns ~15 fiddly lines into one command and removes the footguns.

## 2. Deliverable

**`scripts/wt-setup.mjs`** in AgentTalk (Node ESM, no deps), two subcommands:

- **`node scripts/wt-setup.mjs create <id> [--base <ref>] [--baseline]`**
  1. `git worktree add /private/tmp/att-<id> -b task-<id>` (base defaults to current `HEAD`/`master`).
  2. Wire `node_modules`: symlink every top-level entry **plus `.bin`** from the **primary** checkout, **skip
     `@agenttalk`**, then re-create `@agenttalk/*` with each link's **relative** target (readlink from primary);
     symlink `apps/web/node_modules`.
  3. `npx tsc -b` in the worktree (dist is gitignored).
  4. `--baseline` (optional): run `npx vitest run` and print the pass count, so the actor baselines before editing.
  5. Print the worktree path + a reminder to stage files **explicitly** (never `git add -A` — a symlinked
     `node_modules` slips past `.gitignore`).
- **`node scripts/wt-setup.mjs remove <id> [--delete-branch]`**
  - `git worktree remove /private/tmp/att-<id> --force`; with `--delete-branch`, `git branch -d task-<id>`
    (safe `-d`, refuses if unmerged — never `-D`).

**Primary-repo resolution:** the helper resolves the primary checkout via `git rev-parse --git-common-dir` (works
whether invoked from the primary or from within a worktree), so the node_modules source is always the real primary.

**Client repo:** deliberately **not** covered by this script — the client worktree is a single
`ln -s <primary>/node_modules <wt>/node_modules` (no build). A 3-line `wt-setup` there is optional; noted, not built
now (keep the bite small; the AgentTalk dance is 90% of the pain).

## 3. Scope — files I MAY touch

- **`scripts/wt-setup.mjs`** (new).
- **`scripts/__tests__/wt-setup.test.mjs`** (new) — the vitest `include` already covers `scripts/__tests__/**/*.test.mjs`.
- A short **usage note**: either a header comment block in the script + a pointer line in the op-notes, or a tiny
  `design/worktree-discipline.md` stub. (Doc-only; decide at implementation. The full discipline doc is a separate bite.)

## 4. Files I may NOT touch

- Any product code (engine, registry, server, contracts) — this is pure dev-tooling.
- The **stale-branch prune** (BL-039/BL-063/BL-045/… local branches in both repos) — destructive, per-branch
  confirm-then-prune, needs care/PO sign-off. **Separate bite**, flagged not done.
- The client repo (see §2).

## 5. Definition of Done

1. `wt-setup.mjs create <id>` produces a worktree where **`npx vitest run` passes at the current baseline** and
   `vitest`/`tsc` resolve (the `.bin` + `@agenttalk` relative-target gotchas are handled) — proven by **dogfooding**:
   run the helper to create a throwaway worktree, run the suite inside it green, then `remove` it.
2. `remove --delete-branch` leaves `git worktree list` and `git branch` clean (no leak).
3. An automated test (`wt-setup.test.mjs`) covers the pure logic — the symlink-plan builder (which entries to
   link, which to skip, the relative `@agenttalk` targets) — without needing a real 200-entry `node_modules`
   (inject a tiny fake tree into a tempdir). The full create/remove is proven by the dogfood run (#1), since a unit
   test can't meaningfully assert a real `git worktree`.
4. Full suite still green (the new test included); `tsc -b` clean; no worktree/branch pollution at close.

## 6. Open question for the gate

- **Dev location.** `wt-setup.mjs` is pure new dev-tooling with **zero** product/runtime/test-import surface, so
  it has no branch/merge-collision risk — arguably the same carve-out the worktree mandate grants docs/governance.
  **Two honest options:** (A) develop it **in a worktree** anyway (one last manual dance, then dogfood the helper
  for teardown) — strictly disciplined; (B) develop **on master** as tooling — pragmatic, avoids the ironic 5th
  manual dance, verified by dogfooding + the unit test. **Recommend (A)** to respect the mandate's letter, and let
  the dogfool teardown be its first real use. **PO/gate: confirm A or B.**

## 7. Approach

Write the symlink-plan builder as a **pure function** (`buildLinkPlan(primaryNodeModules) → {links, skips,
scopedLinks}`) so it's unit-testable, then the imperative `create`/`remove` around it. Dogfood end-to-end on a
throwaway id. Stop at the branch; merge PO-gated.

---
*Telemetry block at closure.*
