# BL-087 — the infrastructure invariant harness

**Status:** PLAN — awaiting Gate 1 and the PO's answers to §9.
**Planner:** Claude, 2026-07-27. **Item:** [[BL-087]] (PO-directed, "crucial").
**Serves:** the operator-seat handoff (O-0…O-3) — session launching moves to an external agent (Hermes,
operator only, no workflow participation). **Prerequisite for O-1 and beyond.**

---

## 0. What this is, and three things it is not

**It is** one read-only script that captures the state of the development infrastructure, and diffs a *before*
against an *after*, so a run can be **proven** not to have damaged anything.

It is **not** a cleanup tool, **not** a linter, and **not** CI. The single most important property:

> **It REPORTS and NEVER REPAIRS.** No `git worktree prune`, no branch deletion, no killing processes, no git
> writes of any kind. A harness that "fixes" what it finds is itself capable of burning the hole it exists to
> prevent — and it will be running on an operator agent's say-so, unattended.

## 1. Goal, in one line

**After any run, a single command answers "did the infrastructure come back intact?" with an exit code** — and
distinguishes the residue a run legitimately creates from damage.

## 2. Why now, and the evidence that hand-checking is not enough

Every autonomous run so far tested an **implementer**, structurally contained: its own worktree, its own branch,
no merge rights. The **operator** seat is different in kind — it spawns process trees, binds ports, creates and
removes worktrees and branches, and kills process groups. **The fence that made the worker safe does not
transfer.** Damage would come from a bad `git worktree remove`, a port collision with a live orchestrator, or an
orphaned tree holding the port — not from a bad diff.

**Hand-verification has already failed once, in the session that produced this plan.** Rung 6 left a nested
`agentalk-task-*` worktree and a `task-task-*` branch that were **not in the reviewer's cleanup model**, noticed
only because a post-merge branch listing happened to be read. One run, one blind spot, caught by luck. That is
the argument, and it is stronger than any hypothetical.

## 3. The state vector

**Per repo** (AgentTalk *and* `agentalk-mcp-client` — the client path is configurable, never hardcoded):

- `HEAD` sha, current branch, and ahead/behind counts vs `origin/<branch>`
- worktrees: `(path, sha, branch)`, sorted
- local branches, sorted
- working-tree state from `git status --porcelain` (respects `.gitignore`, so the symlinked `node_modules` that
  shows up as `?? apps/web/node_modules` is handled as data, not a crash)
- stash count, tag list

**Global:**

- listening TCP ports in a configured range (orchestrator range + the meter's `9899`), with owning pid
- processes matching the launcher and provider CLIs (`launcher.mjs`, `claude -p`, `codex`, `goose`, orchestrator)

**Best-effort, never blocking** (the meter rule, [[LB-11]]): if `lsof`/`ps` are unavailable or restricted, that
field records `unavailable` and the run continues. A harness that fails closed on a missing tool would block runs
it was meant to protect.

## 4. The core design problem — legitimate delta vs residue

A run **legitimately** adds a task branch and worktree (plus the nested `task-task-*` pair). So the harness needs
a declared expectation and must flag everything else. Both failure modes are real: **flag everything and it gets
ignored** — the cried-wolf failure, same family as [[BL-079]]'s overstated claim that had to be walked back —
**flag nothing and it is theatre.**

**The asymmetry that makes this tractable, and the plan's central idea:**

> **Additions can be expected. Removals and moves never are.** An operator doing its job *adds* a task branch and
> a worktree. An operator burning the infrastructure *removes* a worktree, *deletes* a branch, or *moves* `HEAD`.
> So additions are matched against an allowlist; **deletions, `HEAD` movement and upstream divergence are ALWAYS
> findings**, with no allowlist path at all.

Expectation file (small, explicit):

```json
{
  "allowNewWorktrees": ["att-op-*", "att-*/agentalk-task-*"],
  "allowNewBranches": ["task-*"],
  "allowPorts": [3600],
  "allowProcesses": []
}
```

**Severity, so the signal survives contact with reality:**

| Severity | Examples | Exit |
|---|---|---|
| `critical` | mainline `HEAD` moved · a branch or worktree **disappeared** · upstream diverged · a tracked file modified unexpectedly | **1** |
| `warn` | an added branch/worktree not matching the allowlist · a stray process · an unexpected listening port | **1** |
| `info` | a new untracked file · stash count changed | 0 |

Exit `0` = nothing above `info`. Exit `1` = findings. Exit `2` = usage/internal error — **kept distinct so a
crashing harness can never be misread as a clean run.**

## 5. Interface

```bash
node scripts/infra-invariant.mjs snapshot --out <file>
node scripts/infra-invariant.mjs check --before <file> [--expect <file>] [--json]
```

`check` takes a fresh snapshot internally and compares. `--json` emits the machine-readable finding list so an
**operator agent can gate on it** without parsing prose; the default output is human-readable. Snapshots are
written **outside both repos** (or to a gitignored path) so the harness never dirties the thing it measures.

## 6. Scope

**May touch:** a new `scripts/infra-invariant.mjs`, its test under `scripts/__tests__/`, and a pointer from
`design/launch-and-monitor-runbook.md` §10.
**May NOT touch:** anything under `packages/` or `apps/` · the launcher or client repo code · `wt-setup.mjs` ·
any existing script's behaviour.

**Fences as properties:** the harness performs **no** state-changing operation of any kind — no git writes, no
process signals, no file writes inside either repo. It must be safe to run at any moment, including mid-run.

## 7. Risks

- **Cried wolf** (§4) — mitigated by the severity tiers and the additions-only allowlist. If the first real
  operator run produces a wall of `warn`s, that is a **finding about the harness**, and the tiers get tuned before
  anyone is told to ignore output.
- **False clean** — the worse failure, and the reason §9 demands planted-residue tests rather than "it ran and
  said OK."
- **Environment coupling** — `lsof`/`ps` differ across platforms; hence best-effort fields. Verified on darwin
  only; state that rather than implying portability.
- **Snapshot drift** — an operator could snapshot *after* causing damage. Mitigation: the `before` snapshot is
  taken by the human/PO or by the harness step that precedes launch, and its timestamp is recorded in the finding
  output so a late baseline is visible.

## 8. Definition of Done

Bar written **before** the code, RED before / GREEN after.

| # | Row | Verified by |
|---|---|---|
| 1 | A planted **stray worktree** is caught as `warn` (or `critical` if unexpected-removal) | Test creates one in a temp repo, runs `check` |
| 2 | A planted **stray branch** is caught | Same |
| 3 | A **deleted** branch/worktree is `critical` even if the allowlist is permissive | Explicit test — allowlists must not apply to removals |
| 4 | A **moved `HEAD`** on the mainline is `critical` | Explicit test |
| 5 | A planted **orphan process** on a watched port is caught, and a **missing `lsof`** degrades to `unavailable` rather than failing | Test with the tool shadowed on `PATH` |
| 6 | A **clean run** yields zero findings above `info` and exit 0 | End-to-end on a real snapshot pair |
| 7 | The harness **mutates nothing** — run it twice, the world is byte-identical | Snapshot the world around the harness itself |
| 8 | Exit codes are distinct: 0 clean · 1 findings · 2 error | Test each |
| 9 | `--json` output is parseable and lists every finding with severity | Test |
| 10 | `tsc -b` 0 (if TS) · full suite green · no pollution | Recorded output |

**Row 7 is the one I would not skip.** A read-only claim is exactly the kind of thing that is asserted and never
tested, and this tool's entire safety case rests on it.

## 9. Open questions for the PO gate

1. **Does the harness gate O-1 automatically, or advise?** I recommend **gate**: a `critical` finding blocks the
   next operator run until the PO clears it. Advisory-only harnesses get ignored under time pressure.
2. **Snapshot location** — I propose outside both repos (`/tmp/att-invariant/`), which keeps the repos clean but
   makes baselines disposable on reboot. The alternative is a gitignored in-repo dir that survives.
3. **Is the client repo in scope from day one?** I recommend yes: the launcher lives there, so an operator's
   residue will land there, and it is the repo with **no governance file** ([[BL-086]]).
4. **Port range** to watch — proposed `3400-3700` plus `9899`.
5. **Does Hermes run the harness, or only read its output?** I recommend it may **run** it (it is read-only by
   construction) but never interpret a `critical` away — that disposition is the PO's.
