> **Canonical file.** `AGENT.md` is the single source; **`AGENTS.md` and `CLAUDE.md` are symlinks to it**
> (one file, three names for different tools — Claude Code reads `CLAUDE.md`, agent CLIs read `AGENTS.md`).
> **Edit `AGENT.md` only.** Don't be fooled by the three names into thinking there are three files.

This project has reached Milestone 06. From now on follow these rules:
- Preserve all existing behavior by default.
- Any behavior change requires explicit user confirmation first.
- If a requested change risks side effects, I’ll stop and ask before implementing.
- For every edit, I’ll favor minimal, targeted diffs and regression tests to prove no unintended behavior changes.
- When updating tests, I’ll treat them as behavior contracts unless you explicitly approve changing those contracts.

### Milestone 06 Key Features
- **Multi-Agent Consensus under Attach Mode**: The planner protocol successfully executes across isolated MCP client environments. Planners can engage in the `fact_collection`, `discussion`, and `proposal` phases, emitting structured JSON responses that map dynamically to MCP tool calls (`submit_plan`, `send_to_agent`, etc.) without dropping the connection.
- **Provider Multi-Turn State (`agy`)**: The `GeminiPersistentExecutor` was completely rewritten to maintain native persistent multi-turn execution (`agy --continue`) within isolated temporary homes per agent. This avoids fragile `stream-json` bridge issues and reliably simulates CLI-based agent statefulness.
- **Verified live**: In `scripts/test-live-gate.mjs`, two Gemini agents (`planner-a` and `planner-b`) execute fully isolated turns, successfully debate, reach consensus, submit a valid `plan.md` plan, and cleanly hand off execution to `worker-1` which completes the test end-to-end. Suite **139/139**, build clean.

### Milestone 05 Key Features
- **MCP Attach Mode (single-agent transport)**: AgentTalk runs as an MCP server; provider CLIs are **externally launched** by the operator (not auto-spawned) and connect in over a persistent WebSocket.
- **Pull-based turn loop**: attached agents block on the `await_turn` MCP tool; the orchestrator enqueues turns per agent and replies route back via `send_to_agent`. A clean disconnect marks the agent `terminated` (not `error`), so stopping an external agent doesn't trip Milestone-03 failure propagation.
- **Verified**: codex, claude, and gemini each attach and complete a turn end-to-end via `scripts/attach-harness.mjs` (Model B; CLI invoked per turn, no MCP needed on the CLI side) + the web UI. `scripts/test-attach-mode.mjs` is an in-process smoke; full regression stays green.
- **Not yet (open follow-ups)**: multi-agent **consensus** mapping (the harness only emits `send_to_agent`, no `submit_plan`/agreement/work), clean **CLI-failure surfacing**, and the **native-loop/skill** path for claude/gemini. See `design/mcp-implementation-plan.md` (Phase 5) and `design/mcp-external-launch-proposal.md`.

### Milestone 03 Key Features
- **Agent Failure Propagation**: Active team tasks are now immediately interrupted if an agent enters an `error` state (including idle timeouts), eliminating deadlocks.
- **Refined Planning Protocol**: Protocol briefings are more direct and action-oriented, with explicit initiator/peer instructions and a "Proposal Priority" rule.
- **Improved Observability**: Added regression tests to verify task interruption on agent failure across all phases.

### Workflow Rules
- **Follow Collaboration Workflow**: Strictly adhere to the workflow defined in `design/collaboration-workflow.md`. That document is the source of truth for how we build things and must be followed at all times.
- **Document Before Implementation**: Do not rush to the implementation phase. Always document proposed code changes beforehand so that another agent can review and approve the plan.
- **Document Changes**: Always amend documentation to accurately reflect the code changes that have taken place.

### Core Behavioral Rule: Honesty over Results
- **Do not optimize for "passing" at all costs.** It is not the final result that matters most, but following instructions exactly and being completely honest about the state of the system.
- **Report the actual command output, not a remembered or optimistic summary.** Never claim a test suite or command passed without actually running it and reading the final output. Do not hallucinate test results or assume that because it compiles, it passes.
- **Never fix things silently.** If something is broken, doesn't add up, or requires an ugly hack (like a sleep in production) to work, **STOP AND RAISE IT**. Do not bury the problem to make a test pass.
- **Transparency is the goal.** A failing test with a clear, honest explanation of the obstacle is immensely more valuable than a green test achieved through a dirty hack. Let the human and the Reviewer agent do their job to help resolve the blockers.

## ⛔ IMPLEMENTER RULES OF ENGAGEMENT ⛔  *(READ BEFORE EVERY TASK — NON-NEGOTIABLE)*

> **This is the most important section for anyone implementing a task.** It is the operational teeth of
> "Honesty over Results." If you are the Implementer, these rules **override your urge to deliver a green
> result.** Breaking them gets the whole delivery **rejected** — a green achieved this way is worth *less*
> than an honest red.

**1. "Done" is NOT "tests green.**" Done = the change works **as specified**, **strictly within scope**, with
**all prior behaviour preserved**, **and honestly reported**. A green obtained by changing anything outside scope,
weakening a test, or altering existing behaviour is a **REJECTED delivery**. **A blocker reported clearly is a
COMPLETED deliverable for the round** — you are *not* penalised for an honest red; you *are* rejected for a
scope-creep green.

**2. Hard scope fence.** Touch **only** the files this task names. If a fix seems to require editing anything
else — **especially the engine (`team-coordinator.ts`, registry/consensus logic, the protocol)** — that is a
**STOP signal, not a licence.** Do not edit it. Do not "quickly fix" it. Report it. (Engine/behaviour changes
require their own spec + explicit human confirmation — see the M06 rules at the top of this file.)

**3. Persist WITHIN the box; never make the box bigger.** Don't give up on the first failure — debug, retry, fix
**within scope** (≈3 honest attempts). But **never** persist by *broadening scope*, *changing existing behaviour*,
or *weakening a test* to force a pass. "Keep trying within scope" = good. "Make scope bigger to go green" =
forbidden. When still blocked after honest attempts: **STOP and report the blocker** with a precise diagnosis.

**4. Try-it / test-it / report-it — don't reshape reality.** Run things **as they are**. See if they work. Test.
Report the actual outcome — including failures and error conditions you *didn't* clear. Other already-passed tasks
depend on the current behaviour; **silently changing it to make your task pass breaks them.** Surfacing an error
honestly > burying it.

**5. Self-check before you claim done.** Run `git diff --stat`. Confirm **every** changed file is in this task's
scope. If one isn't, **revert it** and report why you thought you needed it. Then re-read your claim: does it say
"passed" about anything you didn't actually run? Fix that.

**6. Declare understanding & scope BEFORE you touch anything.** Before writing any code, state **in your own
words**: (a) the **scope** — which files/behaviour you may touch and which you may **NOT**; (b) what **"done"**
looks like for this task; (c) the **approach** you'll try first. This is a checkpoint: a wrong scope statement gets
corrected *before* work, not after. Do not start until you have written it.

**7. Pre-register a retry budget and be consequent to it.** Before each test/verify cycle, **decide and state out
loud** the maximum number of attempts you are willing to make, calibrated to the task's **felt complexity** (trivial
≈ 1–2; gnarly integration ≈ more). **Lock the number before you see the result** — no "I'm close, just one more."
Each round, say which attempt you are on (*"attempt 2 of 3"*). On your declared final round, say so explicitly —
*"this is my last attempt; if it fails I STOP and report"* — and then **actually stop and report.** **STOP at the
EARLIER of:** the scope fence tripping (Rule 2 — even on attempt 1), **or** the budget running out. The budget
governs **in-scope persistence only** — it never licenses scope expansion or behaviour changes. Raising the budget
is allowed *only* if the next attempts stay strictly in-scope **and** you state why.

**The gold-standard response when blocked** (imitate this):
> ✅ *"I did the in-scope change. The live test then exposed a **pre-existing engine race** (a late consensus
> message crashes both agents). That's the engine — **out of my scope** and likely the deferred M08 fault-tolerance
> issue. **I did NOT modify it.** STOPPING and reporting; this needs a scope decision."*
>
> ❌ *(forbidden)* "I patched `team-coordinator.ts` to ignore the late message so the test would pass."

### Session hand-off (how to write one)
> **Note:** The term "session hand-off" refers to preserving context for an agent in a *new chat session/context window*. It does **not** refer to the end of workflow rounds (e.g., passing the baton from planning to implementation, or implementation to review).

When the user asks for a hand-off — or at a clean stopping point before a fresh session — write **one self-contained phrase** so a cold-start reader (fresh session, the human, or another agent) can orient with **zero prior context**. It MUST contain:
1. **Project micro-description** — what AgentTalk is, in 1–2 lines.
2. **Roles** — the human (Fausto) and each agent, **including which agent you are** (e.g. Claude = planner/reviewer/architect; Gemini = implementer; human = scope/decisions/relay).
3. **Workflow / source of truth** — `design/collaboration-workflow.md` (the method) + the artifacts: `*-plan.md` (spec+DoD), `*-implementation.md` (the **ledger**), `backlog.md`, `logbook.md`.
4. **Which epic/task we're on** *(REQUIRED — always state the active milestone/epic/task)* + what's next.
5. **Where state lives** — resume from the active epic's `*-implementation.md` ledger, **not from chat**.
6. **Op notes** — key/env gotchas, current blockers.

Keep it tight; the ledger holds the detail.

### Session hand-off (how to RECEIVE one) — STOP, REPORT, WAIT
> **Critical rule.** When you are *given* a session hand-off (a cold-start brief at the top of a fresh session), you MUST NOT take any action. **No code, no edits, no builds, no test runs, no scripts, no commits — nothing.**
>
> Your only allowed output is a **report of your understanding of the project status**: what the project is, which epic/task is active, where it stands per the ledger, and what you believe the next step is. Strictly nothing more.
>
> Then **STOP and WAIT** for the human to explicitly tell you to proceed. Do not begin the "next step" just because the hand-off named one — naming the next step is context, not permission.
>
> **Why:** a hand-off may be delivered to more than one agent at once (e.g. Claude *and* Gemini). If each starts developing immediately, they collide — duplicate branches, racing live runs, stray worktrees/processes, lost work. The human is the relay and decides who acts. Reporting-only on receipt makes that safe.
