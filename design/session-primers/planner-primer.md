---
role: planner
key: 20260727-1204-f7c2a1
written: 2026-07-27 by Claude (session close — rung 5 landed: the first governed autonomous fix, merged and PUSHED)
---

This is your session primer.

**Project.** AgentTalk orchestrates real, heterogeneous LLM agents (Claude/Codex/Gemini-agy/goose) as one software
team: they attach as MCP clients over WebSocket, pull turns via `await_turn`, and coordinate through a
planner→implementer→reviewer workflow under a human Product Owner. Current thrust: the **autonomous-development
ladder** — improving AgentTalk *with* AgentTalk.

**Roles.** Human = PO (Fausto): scope, direction, **merges**, **pushes**. Bindings live ONLY in `AGENT.md → 📌
DEFAULT ROLE ASSIGNMENTS` — read it, don't trust this line. **Codex and Gemini (agy) are UNAVAILABLE as *agents***
(PO, 2026-07-15), so you are likely sole agent under the **resource-scarcity fallback**: wear every hat, do the
handshake once per role, declare all of them, keep each gate separately. **Standing Conditional Reassignment
ACTIVE** (you may implement). **"merge" and "push" are SEPARATE words and the PO means it** — stop at each and
wait for the literal word. It held all of this session, across five separate acts.
**Independence caveat — say it in every delivery:** as sole agent you author AND review. What catches things is
**running the code and checking the artifact**; never a re-read of your own diff, never a status field.

**⚠️ `git fetch` BOTH repos at startup** (`AgentTalk`, `agentalk-mcp-client`) and verify HEAD against
`origin/master`. Never trust a primer's hash — including this one.

**Workflow / source of truth.** `design/collaboration-workflow.md` + `design/backlog.md` (BL items) + `AGENT.md`.
Plans live in `design/*-plan.md`. **Closed items carry a closing block + telemetry inside the backlog item — read
those first.** Resume from the backlog and plan docs, **NOT from chat**.

## The PO's long-horizon goal (stated 2026-07-27) — everything now aims at this

> **Run AgentTalk's own development inside an AgentTalk session**, with the in-session agent inheriting the
> configuration built up so far. A **single agent** that plans, implements and reviews alone is fine for now; more
> agents later. Replacing the human-in-the-TUI is the point.

**Four PO decisions that shape all planning** (2026-07-27): provider **claude/opus** · the agent **commits and
stops; the PO merges** (no approval channel is being built) · the **PO states a goal, the agent decomposes it** ·
**inherit the rules, skip the primer ritual** (the launcher now sets `AGENTTALK_SKIP_PRIMER` — BL-082).

## Where we are (2026-07-27 close)

**Both repos PUSHED and in sync — verify by fetching:** AgentTalk **`1dc42d5`**, client **`c7a5991`**. No
worktrees, task branches, or stray processes in either. Green at close: AgentTalk **`tsc -b` 0 · suite 410/410**
(71 files); client **lint 0 · 93/93** (17 files). Backlog **83 items, 0 warnings**.

**Shipped this session, each PO-gated:**
- **[[BL-080]]** — spike: proved a claude/opus worker **inherits `AGENT.md`** via the `CLAUDE.md` symlink in
  headless `-p` mode. The premise the whole direction rests on.
- **[[BL-081]]** (client) — the launcher no longer leaks an orphaned orchestrator per run (spawn detached, signal
  the group). Confirmed working live on the rung-5 run.
- **[[BL-082]]** (client) — launched workers are exempt from the turn-1 primer gate, every provider.
- **[[BL-047]] = RUNG 5** — **the first AgentTalk fix authored end-to-end by a governed claude/opus worker**, from
  a one-sentence goal it decomposed itself, **relay count 0**. Plan: `design/rung5-plan.md`.
- **[[BL-083]]** filed — an uncapped relay that OOMs; found by the worker, reproduced by the reviewer.

## What's next — PO picks (no fresh task assigned; report + STOP for the go)

1. **[[BL-083]] — the one that can burn real money.** Two idle in-process agents with no active conversation relay
   unbounded; live, every iteration is a **billed API call**. Needs **planning + Gate 1**: the fix direction is a
   *behaviour decision* on shared engine code ("should an idle agent answer-and-relay at all?"), interacting with
   [[BL-078]] and [[BL-028]]. **This is the natural next planning unit and why this primer is for the planner.**
2. **Rung 6 — the fence test.** Hand a governed worker a task `AGENT.md` says it must **refuse** ([[BL-028]] is the
   natural one, since fixing it switches on a behaviour currently off) and measure whether it stops and reports.
   Rung 5 gave *circumstantial* evidence the fence binds — the worker declined BL-083 unprompted — but refusing has
   never been the *whole* task. Rationale in `design/rung5-plan.md` §8.
3. **[[BL-078]]** — still a PO **decision**, not an implementation.
4. **Cost measurement is broken and the PO deliberately parked it** (*"let's put aside costs for now"*). The meter
   goes stale for hours, and the per-run `usage` in the response sidecar is not physically consistent (391 prompt
   tokens for a turn that read a 65 KB file). **The ladder's actual claim is *measured* improvement, so this comes
   back eventually.** Do not silently treat a stale meter as a 0% delta — write `unavailable`.

## Hard-won gotchas — these cost real time this session

- **An independent grader is a hypothesis too.** Mine was pre-registered, RED before the run, and **wrong twice**:
  v1 demanded the exact behaviour the worker had deliberately (and correctly) excluded; v2 failed its own
  precondition. **Always put a precondition guard in a grader** — it is the only reason a false "rung failed"
  verdict wasn't reported. When a bar disagrees with a fix, suspect the bar.
- **Reproduce a second-hand claim before filing or acting on it.** BL-083 was the *premise* the merged BL-047 fix
  depended on. Reproducing it (34s to heap exhaustion) is what made the merge trustworthy.
- **`completed` ≠ done — and check the artifact at BOTH paths.** For **claude**, work lands in the **parent
  workdir**, NOT the per-task worktree it is handed (`ClaudePersistentExecutor` spawns once at `initialize()` with
  `cwd: process.cwd()`). Per-task isolation is not real for claude; session isolation is → **one session = one
  task.**
- **The exec_rpc per-turn timeout is `600000` (10 min)** — separate from the launcher's wall-clock cap. Rung 5
  finished in ~10 minutes, *uncomfortably* close. A bigger task may need this raised; check it before blaming a
  worker for stalling.
- **[[BL-028]] is still dead**, so the wall-clock cap is the **only** anti-hang rail. Nothing detects a hung agent.
- **`.claude/` is gitignored** → the SessionStart primer hook exists in the primary checkout but in **no worktree**.
- **The client repo carries NO governance file** (no `AGENT.md`/`CLAUDE.md`). A worker there inherits **nothing** —
  which is why rung 5 had to be an AgentTalk-repo task. Unfiled design question.
- **Watch your cwd.** A `cd` inside a compound Bash command persists; I ran git checks against the wrong repo once
  and briefly reached a false conclusion. Use `git -C <path>` for anything load-bearing.

## Op notes

- **Launching a worker:** `node scripts/launcher.mjs <config.json>` from `agentalk-mcp-client`. Config:
  `provider`/`model`/`executionMode: persistent`/`workdir`; **`PORT` in `instance.env`** (not `startCommand.env`);
  set **`instance.recording`** — the raw-response sidecar derives from it, and without it you cannot tell which
  branch a run took. `runs/` is gitignored; configs there are disposable. Working examples:
  `runs/rung5.config.json`, `runs/spike-claude.config.json`.
- **Worktrees:** `node scripts/wt-setup.mjs create <id> --base origin/master` (AgentTalk only; the client repo has
  no helper — plain `git worktree add` + symlink `node_modules`). It wires deps and builds. **Stage files
  EXPLICITLY, never `git add -A`.** `remove <id> --delete-branch` uses a safe `-d` that refuses unmerged branches —
  an exit-1 there can still mean the worktree *was* removed.
- **Gates:** AgentTalk `npx tsc -b` (`exactOptionalPropertyTypes` — conditional spread is the idiom) + `npx vitest
  run`; `npm run backlog:check` gates the backlog (update BOTH the header `status:` and the prose). Client:
  `npm run lint` + `npm test`.
- **Meter:** `node scripts/usage.mjs`. Best-effort, never blocking; it was stale for most of this session.
- **Left deliberately untouched:** the PO's modified `com.fausto.agenttalk-orchestrator.plist`; the **untracked**
  `design/bl024-t3b-plan.md` (exists on the PO's machine only — commit it before working BL-024); and the stale
  `task-BL-039` branch.

Verify all of the above against ground truth before acting. Report your understanding, then **STOP** for the PO's go.
