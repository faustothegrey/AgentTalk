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

## 8. Findings *(filled in at close — empty until the run happens)*

_TBD._
