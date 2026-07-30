# BL-102 — an autonomous worker's commits must not be authored as the human

**Status:** PLANNED (v2, reworked after Gate 1 REFUTED v1's design), awaiting re-gate.
**Planner:** Claude, 2026-07-30. **Gate 1 reviewer:** Claude (resource-scarcity fallback; reviewer discipline
kept separately — the verdict in §6 is why the seat was worth exercising).
**Split from BL-100's `DEFAULT_ROOT` half by PO decision, 2026-07-30** — that work is now
`design/bl100-defaultroot-plan.md`. See §0 for why bundling them was wrong.

---

## 0. Why this is no longer one task with `DEFAULT_ROOT`

I originally proposed bundling them because *"both are `scripts/wt-setup.mjs`, one worktree, one gate."*
**False.** They are in different repos and — per §2 — BL-102's fix is not in `wt-setup.mjs` at all, nor where
v1 of this plan then claimed. The saving evaporated; the PO split them.

---

## 1. The defect

`52df7f0`, the H-L3 worker's commit, is authored `Fausto Lelli <fausto@domotz.com>`. Nothing is misconfigured:
git resolves identity from the machine, and the worker is a process on the PO's machine. **Every worker commit
back to O-1 is the same.** The containment model's claim is that agent work stays legible and separable until a
human lands it; the git **author** field is the one part of that record which outlives the branch, and it
currently says a human wrote it. Small today only because worker branches are force-deleted — and the ladder is
heading toward merging worker commits.

## 2. ⛔ Where the worker actually commits — the finding that decides the design

**This is the load-bearing fact, and both the backlog item's fix direction and v1 of this plan got it wrong in
opposite directions.** It was settled by reading the H-L3 config and the executor, not by reasoning.

The commit directory **depends on the provider's execution path**:

| Path | cwd the worker commits in | Evidence |
|---|---|---|
| **claude, persistent** | **the assigned `workdir` itself** — session-level, set once at `initialize()` | `executor-runtime.mjs:167-176` (`cwd: process.cwd()`), and its own comment: *"session isolation, not task isolation… it cannot be"* |
| gemini · codex · every one-shot | the per-turn task worktree from `provisionTaskDir` | `executor-runtime.mjs:107`, `:581`, `:729` — `cwd: sink.cwd \|\| process.cwd()`; [[BL-075]] |

**H-L3 ran claude/persistent with `workdir: /tmp/att-op-h3`** (`hl3-brief.md:95-98`), so its worker committed
**in the workdir** — an operator worktree made by `wt-setup.mjs` — on branch `task-op-h3`. A
`provisionTaskDir` task worktree may have been created alongside and sat **empty**, which is exactly the
"assigned worktree stayed empty" class BL-075 fixed for one-shot and which **remains structural for claude
persistent**.

**Consequences, stated plainly:**
- The backlog item's *"do it in `wt-setup.mjs`"* was **right for the observed case and wrong in general** — it
  covers the claude path only, and `wt-setup.mjs` also builds **human** worktrees, which must never be given an
  agent identity.
- **v1 of this plan was worse:** it put the fix solely in `provisionTaskDir`, which claude/persistent never
  cd's into — so it would have missed `52df7f0`, **the exact commit BL-102 was filed about**, while passing a
  green test on the gemini path.

**Therefore the identity must attach to the worker PROCESS, not to any directory.**

## 3. ⛔ Second finding — `git config` in a linked worktree is not worktree-scoped

Kept from v1 because it survives the rework and remains a live footgun for anyone who reaches for the item's
literal wording. Probed empirically today:

```
$ git -C ../wt config user.email "agent@example.com"
primary sees:  agent@example.com      # ← the human's own checkout, silently reassigned
worktree sees: agent@example.com

$ git config extensions.worktreeConfig true      # and then, with --worktree:
primary sees:  human@example.com      # ← preserved
worktree sees: agent@example.com
```

A plain `git config` fix would reauthor **the PO's own future commits** as an agent — the inverse of the defect,
discoverable only by reading `git log` days later. **The design in §4 avoids this class entirely by mutating no
repo config at all.**

## 4. Design — inject the identity into the worker's environment

Set `GIT_AUTHOR_NAME` / `GIT_AUTHOR_EMAIL` / `GIT_COMMITTER_NAME` / `GIT_COMMITTER_EMAIL` in the environment of
the launched worker process.

**Why this and not a directory-scoped config:**
- **cwd-independent** — §2 shows cwd varies by provider and, for claude, cannot be per-task. Env follows the
  process wherever it commits, so the fix does not depend on a fact that differs per execution path.
- **No repo mutation** — §3's leak becomes structurally impossible; nothing is written to any `.git/config`.
- **No human contamination** — `wt-setup.mjs` stays untouched, so a human's worktrees keep the human's identity.
- **Author *and* committer** are set, so neither field claims a human.

**Choke point:** `getSpawnEnv(providerName)` in `lib/provider-runtime.mjs:36-43` already exists to shape the
worker env (it strips `ANTHROPIC_API_KEY`) and is used at `:62` and `:318`. That is the natural single site.
**But coverage must be verified, not assumed:** `executor-runtime.mjs` has spawn sites passing `env: process.env`
(`:63`, `:730`) and `{...baseCmd.env, ...process.env}` (`:583-584`) that may bypass it. **Enumerating every
spawn site and proving each carries the identity is part of the task, and is what T-4 below pins.**

**Identity string:** minimum bar *unmistakably not a human*, e.g.
`AgentTalk worker (claude) <agent+worker-1@agenttalk.local>`. The agent id is available via
`AGENTTALK_AGENT_ID` (`executor-runtime.mjs:302`). **Do not expand scope to plumb the provider name through** if
it is not already in hand at the chosen site — say so and use the agent id alone.

**Not in scope:** the `taskId: null` / `teamId` join defect in BL-102's "related" paragraph — same theme,
different mechanism, and it would make a bounded change unbounded. It stays on the item.

## 5. DoD

| # | Row | Verified by |
|---|---|---|
| T-1 | A commit made by a launched **claude/persistent** worker is authored under the agent identity | live run; `git log -1 --format='%an <%ae>'` on the worker's commit |
| T-2 | The same holds on a **task-worktree** provider path (gemini or a one-shot) | second live run, or a unit test asserting the env reaches that spawn site |
| T-3 | **The PO's identity is unchanged** — no `.git/config` anywhere is written | `git config user.email` in the workdir and the primary, before/after, byte-identical |
| T-4 | **Every** spawn site that launches a worker carries the identity | enumerate the sites; a test that fails if one is added without it |
| T-5 | Client suite green (was **93/93, 17 files** — re-derive, do not trust this number) | `npm test` |

**Mutation check (REQUIRED — BL-102's own text demands it and is right).** A commit authored correctly and one
authored by accident are indistinguishable in a green suite. So: wire it, watch T-1 pass, then **deliberately
remove the injection and confirm T-1 goes red with the author reverting to the human's identity.** A row never
watched to fail is not evidence.

**Second mutation check, for T-3.** T-3 asserts an *absence* (no config written). Deliberately add a
`git config user.email` call and confirm T-3 goes red — an absence-assertion that cannot fail is decoration.

## 6. Gate 1 — plan-reviewer verdict

**v1 REFUTED — design reworked. v2 (this document) awaits re-gate.** Claude, plan-reviewer seat, 2026-07-30.

| # | Finding | Disposition |
|---|---|---|
| G1 | **v1's fix would have missed the defect it was filed for.** It placed the identity solely in `provisionTaskDir`, but H-L3 ran claude/persistent, whose cwd is the workdir and **structurally cannot be** the task worktree. The fix would have gone green on the gemini path while `52df7f0`-class commits stayed authored as the human. | **REFUTED → reworked.** §4 now attaches identity to the process, not a directory. |
| G2 | **v1 accused the backlog item of naming the wrong file; that accusation was itself wrong.** `wt-setup.mjs` *did* create the worktree H-L3's worker committed in. The item's direction was right for the observed case and wrong only in general. | **Corrected in §2.** Recorded rather than quietly dropped — a reviewer's confident refutation being wrong is the finding. |
| G3 | **The plan pinned the suite baseline at a number copied from a primer, not re-derived.** This is the third occurrence of the hardcoded-reference-value trap in three days ([[H-L3]]'s W3 row; the lesson recorded twice). | **Amended** — T-5 now says re-derive; no plan row hardcodes a count. |
| G4 | **v1 claimed "one site" as the reason to prefer `provisionTaskDir`.** Under §4's design the site count is an open question, and `executor-runtime.mjs` has spawn sites that appear to bypass `getSpawnEnv`. | **Amended** — enumerating sites is now task work, pinned by T-4, not an assumption. |
| G5 | §3's `git config` leak finding | **Survives the rework, verified by probe, retained.** |

**Checked and clear (recorded so it is not re-litigated):** the infra harness's `allowNewWorktrees` allowlist
(`infra-invariant.mjs:76`) matches on **path segments**, not on an absolute root — so neither this task nor the
`DEFAULT_ROOT` change breaks it.
