# BL-087 — the infrastructure invariant harness

**Status:** APPROVED at Gate 1, 2026-07-27, with one required amendment (§4a). PO answered all of §9 — see §9.
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

## 4a. REQUIRED AMENDMENT (Gate 1, plan reviewer, 2026-07-27)

**The process/port half of §3 must REUSE `scripts/check-orchestrator-ports.mjs`, not reimplement it.**

That script ([[BL-023]]) already inspects listening processes and exports its classifier as pure functions —
`classifyProcess`, `classifyAll`, `sweepFails`, `parseDeclared`, `isOrchestratorIsh`, `STATUS` — precisely so
another caller can drive it. As written, §3 described this as fresh work.

**Why this is a defect and not a preference:** that classifier encodes knowledge this plan does not.
`ppid` **cannot** discriminate — the PO's launchd service runs at ppid 1 and an orphaned leak *also* reparents
to ppid 1, so "ppid 1 ⇒ managed" hides every leak and "ppid 1 ⇒ leaked" reproduces **IP-15**, where a reviewer
inferred a leak from ppid + a plausible cwd and filed a defect against a service the PO runs deliberately. A
second, naive classifier would re-commit exactly that error — which is **§7's risk #1, cried wolf**. So reuse
*is* the mitigation for the plan's own top risk.

**The two tools have different, both-correct semantics — do not conflate them:**

| | `check-orchestrator-ports.mjs` (BL-023) | this harness (BL-087) |
|---|---|---|
| Question | "is anything unaccounted-for listening **right now**?" | "did **this run** change the infrastructure?" |
| Model | **absolute** | **differential** (vs a baseline) |
| `UNKNOWN` | **fails, always** — "could not tell" never reads as clean | see mapping below |

**Mapping, which preserves BL-023's fail-closed rule rather than weakening it:**

- a process that classifies `UNKNOWN` and **was already in the baseline** → `warn` (pre-existing; this run did
  not cause it, and the absolute check still fails on it independently)
- a process that classifies `UNKNOWN` and **appeared during the run** → `critical` (this run produced an
  unclassifiable listening process — the operator-burning-infrastructure signal itself)
- a **new** process classifying `LEGITIMATE` or `DECLARED` → `info` (positive evidence exists)

This also inherits BL-023's escape valve for free: `AGENTTALK_SWEEP_DECLARED` clears a false positive without
touching the harness. Importing a module is not "touching an existing script's behaviour" — §6's fence holds.

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

## 9. PO gate — ANSWERED 2026-07-27

All five resolved by the PO, each as recommended. These are decisions, not proposals:

1. **Gate, not advise.** A `critical` finding **blocks** the next operator run until the PO clears it. Advisory
   harnesses get ignored under time pressure, and this one runs unattended.
2. **Snapshots live outside both repos**, at `/tmp/att-invariant/`. Baselines are disposable on reboot; that is
   accepted, because a harness that measures repo cleanliness must not write into the repo it measures.
3. **Both repos from day one** — AgentTalk *and* `agentalk-mcp-client`. The launcher lives in the client repo, so
   operator residue lands there, and it is the repo with **no governance file** ([[BL-086]]).
4. **Ports `3400-3700` plus `9899`.** (Taken as the standing default; a config constant, cheap to revisit.)
5. **Hermes MAY run the harness** — safe by construction — **but may never interpret a `critical` away.** That
   disposition is the PO's alone. Hermes's reports are observations, unverified until checked against the artifact.
