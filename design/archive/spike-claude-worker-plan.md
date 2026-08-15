# Spike — a **claude** worker, governed by AGENT.md, inside an AgentTalk session — PLAN

**Author:** Claude (planner + architect hats, resource fallback) · **Date:** 2026-07-27
**Status:** ✅ **APPROVED — PO go 2026-07-27** (`[PO]`: "opus, file it as BL-080, commit the plan, then run it").
The PO exercised Gate 1 directly rather than have the sole available agent review its own plan.
**Backlog:** **BL-080** (`doing`).
**Thread:** the autonomous-development ladder ("AgentTalk improves AgentTalk"). Sits **below rung 5**: it is a
derisking spike, not a rung. Rungs land fixes; this run answers questions.
**Depends on:** Bite-0 launcher (`agentalk-mcp-client:scripts/launcher.mjs`, BL-040, done) · rung 4 (BL-046,
merged 2026-07-19 — proved the loop with a **goose** worker) · BL-075 (worktree honouring, merged) · BL-076
(report survival, merged) · BL-077 (status broadcast, merged).

---

## 0. Honest framing — what this is, and what it is not

The PO's long-horizon goal (stated 2026-07-27): **run AgentTalk's own development inside an AgentTalk session**,
with the in-session agent inheriting the configuration we have built up, starting with a **single agent that
plans, implements and reviews alone**.

Rung 4 already proved the *loop* — a launched worker autonomously produced a complete, mutation-checked,
mergeable fix. But it proved it with **goose**, and with a **hand-written 3,000-word goal blob** as its only
governance. The PO's chosen shape (decisions below) changes the provider to **claude** and the governance source
to **AGENT.md itself**. Both changes are unproven. This spike proves or refutes them **before** an epic is built
on top of them.

**It deliberately lands no fix.** Its output is *answers with evidence*. An honest "this does not work and here
is why" is a complete, successful spike.

### PO decisions this plan implements (2026-07-27)

| Decision | Choice | Consequence for this spike |
|---|---|---|
| Provider | **claude** — inherits `AGENT.md` via the `CLAUDE.md` symlink | Q1/Q2 exist at all |
| PO gates | **agent commits and stops; PO merges from the terminal** | no approval channel to build; run ends at a commit |
| Task assignment | **PO states a goal; the agent decomposes it** | not exercised here (spike goal is trivial by design) |
| Governance | **rules yes, primer ritual no** | Q2 *is* this decision's implementation test |

## 1. Goal / "done" in one line

**One `claude` worker, launched by the Bite-0 launcher into a throwaway AgentTalk worktree, is observed to (a)
inherit AGENT.md, (b) not be halted by the turn-1 primer gate, (c) write a file and commit it inside its
worktree, and (d) return a readable report through the substrate — each answered with pasted evidence, no
product source touched.**

## 2. The questions — this spike's actual deliverable

Each question gets a verdict (**ANSWERED-YES / ANSWERED-NO / INCONCLUSIVE**) and pasted evidence.

### Q1 — Does the worker actually inherit `AGENT.md`?
The whole governance premise. `llm-agent.mjs:86` chdir's into the assigned workdir; `ClaudePersistentExecutor`
spawns `claude -p …` with `cwd: process.cwd()` (`executor-runtime.mjs:175`) — so if the workdir is an AgentTalk
worktree, `CLAUDE.md` → `AGENT.md` should load. **Unverified in headless `-p` mode.**

- **Probe:** the goal asks the worker to state *the project's hard naming convention about a forbidden word*.
- **Pass:** it answers **"spawn" is forbidden; use "launch"** — a fact present only in AGENT.md and not
  guessable from the codebase or from general knowledge.
- **Fail:** it cannot answer, guesses, or says no instructions were provided.

### Q2 — Does the turn-1 primer gate halt an autonomous worker? *(the hazard)*
`.claude/settings.json` arms a `SessionStart` hook instructing the session to do the primer handshake, **report,
and STOP** — fatal for an autonomous worker. It is guarded by `[ -n "$AGENTTALK_SKIP_PRIMER" ]`. Independently,
**AGENT.md's own text** ("FIRST ENTRY POINT … before anything else") instructs the same ritual, so suppressing
the hook may not suppress the behaviour. Worse: `implementer-primer.md` currently carries a **fresh** key, and a
worker with no private key store reads any real key as unconsumed → **report-and-STOP**.

- **Probe:** run with `AGENTTALK_SKIP_PRIMER=1` set in the agent's env (the intended production setting).
- **Pass:** the worker proceeds to the task; the transcript shows no handshake-and-stop.
- **Fail:** the worker performs the handshake and/or stops without doing the work.
- **Either way it is a real answer:** a fail localises the cause to **AGENT.md's text** rather than the hook,
  which is exactly the finding that shapes the next increment.

### Q3 — Does it do real file work and commit, inside its worktree?
Rung 4 proved this for goose. Unproven for claude, which runs with `--permission-mode bypassPermissions`
(`executor-runtime.mjs:56`) — so no permission wall is *expected*, but expected ≠ verified.

- **Pass:** the named file exists in the worktree with the right content **and** `git log --oneline -1` in the
  worktree shows the worker's commit.
- **Check both paths (BL-053/BL-059 discipline):** the assigned workdir **and** `<workdir>/agentalk-task-<id>/`.
  Report what is at each. An artifact check at the wrong coordinates is worse than none.

### Q4 — Does the protocol round-trip complete, and is the report readable?
- **Pass:** the team reaches `completed`, and the worker's report is present in the response-log sidecar with
  the substance of its answers (not the literal `'Task completed.'` — the BL-076 regression).
- Note: the launcher derives the sidecar from `instance.recording`
  (`${recording}.responses.ndjson`, `launcher.mjs` `assembleDeps`) — **configuring `recording` is what satisfies
  the "always set the response log" lesson.** No separate env var needed.

### Q5 — What does it cost?
`node scripts/usage.mjs` before and after. I stay **idle** during the run so attribution holds (LB-11 breaks
under concurrency). Recorded in the closing telemetry block.

## 3. Method

**One run.** Not a batch — the rung-4 lesson was that an opaque background batch hides the clue.

1. **Worktree (throwaway):** `node scripts/wt-setup.mjs create spike-claude --base origin/master`, or plain
   `git worktree add` to a `/tmp` path. It must be a **real AgentTalk checkout** so `CLAUDE.md` is present.
   Confirm the symlink resolves inside the worktree before launching.
2. **Config** in `agentalk-mcp-client/runs/` (gitignored, disposable):
   - `agents[0]`: `provider: "claude"`, `executionMode: "persistent"`, `workdir: <worktree>`,
     `model: "opus"` *(PO ruling 2026-07-27, overriding the plan's sonnet recommendation — see §7.1)*,
     env `AGENTTALK_SKIP_PRIMER=1`.
   - `instance.recording: "runs/spike-claude.ndjson"` → sidecar comes free.
   - `instance.startCommand` boots the orchestrator with a `PORT` in `instance.env` (**not**
     `startCommand.env` — rung-4 gotcha).
   - `cap.wallClockMs`: **600000 (10 min)**. This cap is the *only* anti-hang rail: the idle timeout is dead
     code (LB-70/BL-028), so nothing else detects a hung worker.
3. **Goal (deliberately trivial, touches no source):** create `spike-evidence.md` in the worktree containing
   (a) the forbidden-word convention and what replaces it, (b) the current branch name, (c) a one-line statement
   of where it believes its instructions came from; then `git add` + `git commit`. **Do not push. Change no
   other file.**
4. **Grade by artifact, never by status.** `completed` ≠ done (BL-062). Read the file, read `git log`, read the
   sidecar.

## 4. Scope

**May touch:** this plan doc; a throwaway worktree; a disposable config under `runs/`; a findings section
appended here at close.

**May NOT touch:** any product source in **either** repo. No `team-coordinator.ts`, registry, consensus,
protocol, contracts. No test changes. No edits to `AGENT.md`, `.claude/settings.json`, or any primer file —
including the fresh `implementer-primer.md` key that Q2 implicates. **If the spike shows one of those needs
changing, that is a finding to file, not a change to make** (Implementer Rule 2).

## 5. Risks & hazards

- **An autonomous claude with `bypassPermissions` and write access.** Contained by cwd to its worktree (that
  containment is the documented property of the session-level-cwd design), and the goal touches one new file.
  Real, accepted, bounded — but it is a genuinely autonomous writer and should be named as such.
- **Budget:** spends the PO's claude quota — the same meter this terminal session draws on. Mitigated by a
  trivial goal and a 10-minute cap; estimated **≤5%** of a session window (rung-4-class *real* work ran 7–13%).
- **Hang:** the wall-clock cap is the only rail (see §3.2). If it trips, that is itself a reportable finding.
- **Worktree pollution:** `git worktree list` must be clean at close in both repos; the worktree is removed.
- **Context cost of AGENT.md:** it is ~65 KB (~16k tokens) loaded into every worker session. Not a blocker, but
  if Q1 passes it becomes a standing per-session cost worth knowing before the ladder scales.

## 6. Definition of Done

| # | Row | Evidence required |
|---|---|---|
| 1 | Q1 answered | the worker's own words on the forbidden-word convention, from the sidecar |
| 2 | Q2 answered | transcript showing either clean proceed, or the handshake-and-stop with its trigger localised |
| 3 | Q3 answered | file contents + `git log --oneline -1` from the worktree, **and** the both-paths check |
| 4 | Q4 answered | terminal team status + the report text from the sidecar |
| 5 | Q5 answered | meter before/after; telemetry block in the closing section |
| 6 | Hygiene | `git status` + `git worktree list` clean in both repos; no product source modified (`git diff --stat` empty) |
| 7 | Findings filed | every defect/friction observed → a proposed backlog item **written here**, not fixed |

## 7. Gate questions — **RESOLVED by the PO, 2026-07-27**

1. **Model — `sonnet` or `opus`?** → **`opus`.** The PO overrode the plan's cost-based sonnet recommendation.
   The reasoning is sound and worth recording: the spike's purpose is to derisk *the agent that replaces
   Claude-in-the-terminal*, and that agent is opus — so measuring sonnet's instruction-following under a 65 KB
   system prompt would answer a question we are not actually asking. **Consequence: Q5's cost figure will be
   higher than the ≤5% estimated in §5**, which was written for sonnet. The estimate is not re-derived; the
   measured number is the deliverable.
2. **Backlog id?** → **Yes: BL-080**, status `doing`.
3. **Commit the plan before running?** → **Yes**, before the run.

---

## 8. Findings — **RUN EXECUTED 2026-07-27 09:39–09:42** (one run, no retries)

**Headline: the governance premise holds. A `claude`/opus worker inside an AgentTalk session inherited
AGENT.md, was *not* halted by the primer gate, did the work, and committed it — first attempt, no retries.**

Config: `agentalk-mcp-client/runs/spike-claude.config.json` (gitignored). Orchestrator booted by the launcher on
port 3400, MCP on dynamic `ws://localhost:58484/`. Worker `spike-claude-worker`, provider `claude`, model `opus`,
`executionMode: persistent`, workdir `/private/tmp/att-spike-claude` (branch `task-spike-claude`).

### Verdicts

| Q | Verdict | Evidence |
|---|---|---|
| **Q1** governance inherited | **ANSWERED-YES** | The worker wrote: *"The forbidden word is **spawn**. The word that must be used in its place is **launch**"*, citing **`AGENT.md:200-203`** and naming `CLAUDE.md` as *"auto-loaded project instructions; it is a symlink to `AGENT.md`"*. Unguessable from the codebase. **Headless `claude -p` does load `CLAUDE.md` from cwd.** |
| **Q2** primer gate halts it | **ANSWERED-NO — it did not halt** | The worker went straight to the task. No handshake, no report-and-STOP, no mention of a primer or key store anywhere in the transcript. |
| **Q3** real file work + commit | **ANSWERED-YES (parent workdir)** | `189012f spike: claude worker evidence`, **1 file changed, +14** — exactly the one file. Branch answer `task-spike-claude` verbatim-correct. |
| **Q4** round-trip + readable report | **ANSWERED-YES** | Team reached `completed`; sidecar `runs/spike-claude.ndjson.responses.ndjson` holds a full `work_accept` with the file contents, `git log` and `git status` inline. **Not** the literal `'Task completed.'` — [[BL-076]]'s fix holds for a claude worker. |
| **Q5** cost | **INCONCLUSIVE — telemetry unavailable** | The meter was **stale**: `updated 09:33:15` both before *and* after a run that took place 09:39–09:42, session pinned at 51% across three polls. **No cost delta can be claimed.** Reported as unavailable rather than as "0%". |

### Q2 — read this before treating it as settled

**The hook was structurally absent, so this is a weaker result than "the gate was overridden."** Pre-run checks
found `.claude/` is **gitignored** (`.gitignore:1`), so `.claude/settings.json` — and its `SessionStart` turn-1
gate — **does not exist in any worktree**; `~/.claude/settings.json` has no `SessionStart` hook either.
`AGENTTALK_SKIP_PRIMER=1` was exported for the run but was therefore a **no-op**.

What the run *does* prove is the sharper half: **AGENT.md's own FIRST-ENTRY-POINT text did not, by itself, cause
an autonomous worker to stop** — even though a fresh, unconsumed key sat in `implementer-primer.md` at the time.
The plausible reason is that the worker was addressed as a **worker executing a task**, not as an agent starting a
session, and the exec_rpc prompt frames it that way. **Untested and load-bearing for the ladder:** whether a
worker whose workdir is the **primary checkout** (where the hook *does* exist) behaves the same. Do not assume it.

### Q3 — the both-paths check (the [[BL-053]]/[[BL-059]] discipline)

| Path | State |
|---|---|
| `/private/tmp/att-spike-claude` (**parent workdir**) | `spike-evidence.md` present; commit `189012f` on `task-spike-claude`. **The work is here.** |
| `/private/tmp/att-spike-claude/agentalk-task-task-1785138090967-2` (**per-task worktree**) | Provisioned by `llm-agent`, contains a full checkout — **but no `spike-evidence.md` and no new commit** (HEAD still `a95488e`). Empty of work. |

**This is the documented `ClaudePersistentExecutor` limit, now confirmed live for the first time:** the exec_rpc
carried `cwd: agentalk-task-task-1785138090967-2`, `llm-agent` created it, and the claude process — spawned once
at `initialize()` with `cwd: process.cwd()` (`executor-runtime.mjs:175`) — never entered it. **Per-task isolation
is not real for claude; session isolation is.** Harmless under the PO's chosen shape (one session = one goal), and
it is exactly why that shape was the right call. It would be a live hazard the moment a claude worker is given two
tasks in one session.

### New findings to file

- **F1 — the launcher leaks an orphaned orchestrator.** After the run, port 3400 was still held by
  `node dist/index.js` **pid 69131, PPID 1**. `stopInstance` kills the process it spawned — `npm run backend` —
  but npm's **node grandchild survives and is reparented to init**. Every launched run leaves a port-holding
  zombie; a second run on the same port would fail to boot, and the ladder launches repeatedly. Killed by hand
  here. **Propose BL-081.** *(Not fixed: out of this spike's scope — Implementer Rule 2.)*
- **F2 — the sidecar's `usage` numbers cannot be trusted as cost.** Recorded
  `{prompt_tokens: 391, completion_tokens: 1600}` for a turn that demonstrably read a 65 KB `AGENT.md`. 391 prompt
  tokens is not physically consistent with that; the figure most likely excludes system-prompt and/or cached
  input. **Unverified — stated as an inconsistency, not a diagnosis.** It matters because the ladder's whole claim
  is *measured* improvement, and this is the only per-run usage number the substrate produces. Combined with the
  stale meter (Q5), **the loop currently has no trustworthy cost measurement at all.**
- **F3 — a positive signal worth recording.** Unprompted, the worker (a) distinguished pre-existing untracked
  paths from its own changes rather than claiming a clean tree, and (b) volunteered *"the forbidden-word answer
  was not taken from memory — I grepped the repo and read `AGENT.md:200-203` in this worktree to confirm it."*
  Verify-don't-assert behaviour, unasked. Weak evidence (n=1, trivial task) but it is the behaviour the
  governance inheritance is *for*.

### What this does and does not license

**Does:** a claude/opus worker in an AgentTalk session inherits the project's governance and can do bounded,
scoped, committed work without a hand-written governance blob. That was the premise of the PO's whole chosen
direction, and it is now evidence rather than hope.

**Does not:** the task was trivial by design — one file, no source, no tests, no decomposition, ~3 minutes. It
says **nothing** about a claude worker on a real backlog item, about goal decomposition, or about behaviour in the
primary checkout where the hook exists. Those are rung-5 questions.

**Telemetry (task closure):**
- task:        BL-080 (claude-worker spike)
- wall-clock:  2026-07-27 09:39 → 09:42 (~3 min run; ~1h session incl. planning)
- budget:      **unavailable** — meter stale at `09:33:15` across the whole run window (session pinned 51%, weekly 6%)
- gate:        n/a — no product source touched; `git diff --stat` on both repos empty
- diff:        2 files (+204) in `9258f39` (plan + backlog); worker's own commit `189012f` on `task-spike-claude`
- outcome:     **SPIKE ANSWERED ✅** — Q1–Q4 answered, Q5 inconclusive, 3 findings filed
