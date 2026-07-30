# BL-102 — an autonomous worker's commits must not be authored as the human

**Status:** **PLANNED — Gate 1 APPROVED WITH REQUIRED AMENDMENTS (v2 re-gate, §6). Ready to implement.**
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

**⛔ There is NO single choke point — verified at re-gate, see §6/H1.** `getSpawnEnv` (`provider-runtime.mjs:36`)
looked like one, but the **claude persistent path does not go through it**: `getPersistentProviderCommand`
returns `env: process.env` directly (`executor-runtime.mjs:63`), and that is the path that produced `52df7f0`.
Injecting only at `getSpawnEnv` would once again go green while missing the defect's own path.

**Required shape instead:**
1. **One shared helper** — `workerGitIdentityEnv()` — that returns the four `GIT_*` variables. Single source of
   the identity string; no site invents its own.
2. **Applied at every worker-launching site**, which at minimum includes `getSpawnEnv`
   (`provider-runtime.mjs:36`, covering `:62` and `:318`) **and** `getPersistentProviderCommand`
   (`executor-runtime.mjs:44-64`). Sites passing `env: process.env` (`:63`, `:730`) or
   `{...baseCmd.env, ...process.env}` (`:583-584`) must each be inspected, not assumed covered.
3. **Every site returns a COPY.** `getSpawnEnv` currently returns `process.env` **by reference** for non-claude
   providers (`:37-38`) and a copy only for claude (`:40`). Mutating the returned object would behave
   differently per provider and could pollute the llm-agent's own environment. **Normalising this to always
   copy is itself a small change to shared logic — declare it in the delivery; do not smuggle it in.**

**Identity string — sub-decision RESOLVED at re-gate, no scope expansion needed.** Both parts are already in
hand: `providerName` is a parameter of both sites, and the agent id is in the environment
(`llm-agent.mjs:67` sets `AGENTTALK_AGENT_ID`). Use e.g.
`AgentTalk worker (claude) <agent+worker-1@agenttalk.local>`.

**Not in scope:** the `taskId: null` / `teamId` join defect in BL-102's "related" paragraph — same theme,
different mechanism, and it would make a bounded change unbounded. It stays on the item.

## 5. DoD

| # | Row | Verified by |
|---|---|---|
| T-1 | A commit made by a launched **claude/persistent** worker is authored under the agent identity | **live run required** — this is the only path that can be exercised live (see H4), and the only one that reproduces the filed defect. Needs a PO-authorised operator rung or a manual launch; **name which before starting.** `git log -1 --format='%an <%ae>'` on the worker's commit |
| T-2 | The same holds on a **task-worktree** provider path | **unit test, definitively — NOT a live run.** gemini and codex are PO-declared UNAVAILABLE and goose is not installed, so no second provider can be launched. Assert the env reaches `provider-runtime.mjs:62`'s spawn |
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

### v2 re-gate: **APPROVED WITH REQUIRED AMENDMENTS** — Claude, plan-reviewer seat, 2026-07-30

**The design principle survives and is now settled: attach identity to the process, not to a directory.**
What failed re-gate is the *site*. Five findings; all folded in above.

| # | Finding | Disposition |
|---|---|---|
| H1 | **`getSpawnEnv` is NOT on the claude/persistent path — the path that produced the defect.** v2 called it *"the natural single site"*. Verified: `getPersistentProviderCommand` returns `env: process.env` directly (`executor-runtime.mjs:63`) and never consults it. Injecting only there would go green while `52df7f0`-class commits stayed authored as the human. | **Amended** — §4 now requires a shared helper applied at **both** sites, with the rest enumerated. |
| H2 | **`getSpawnEnv` returns `process.env` by REFERENCE for non-claude providers** (`:37-38`), and a copy only for claude (`:40`). A mutation-based injection would behave differently per provider and could pollute the llm-agent's own environment. | **Amended** — §4.3 requires a copy at every site, **and requires the normalisation to be declared** as the shared-logic change it is. |
| H3 | Open sub-decision on the identity string | **RESOLVED, no scope expansion:** `providerName` is a parameter at both sites and `AGENTTALK_AGENT_ID` is set at `llm-agent.mjs:67`, so both parts are already in hand. |
| H4 | **T-2 offered "a second live run **or** a unit test" — the live option is impossible.** gemini and codex are PO-declared UNAVAILABLE and goose is not installed, so only claude can be launched. A DoD row offering a route that cannot be taken invites a BLOCKED ⛔ that is really a planning error. | **Amended** — T-2 is a unit test, definitively. |
| H5 | **T-1 requires a live launch but the plan never said under what rung or who runs it.** | **Amended** — T-1 now says name it before starting. |

**⚠️ The durable lesson, and it is now a pattern rather than an incident.** Two consecutive gates on this item
failed the same way: **a design reasoned about "the worker" without naming which execution path it meant, and
both times the miss was claude/persistent** — the one provider on a structurally different path
(`cwd` session-level, env bypassing the shared helper), and currently the *only available* one. **Any change in
this codebase that says "the worker does X" must name the path.** Worth recording in
`implementer-pitfalls.md` when this lands.

### v1: **REFUTED** — design reworked (retained for the record)

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
