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

### Session hand-off (how to write one)
When the user asks for a hand-off — or at a clean stopping point before a fresh session — write **one self-contained phrase** so a cold-start reader (fresh session, the human, or another agent) can orient with **zero prior context**. It MUST contain:
1. **Project micro-description** — what AgentTalk is, in 1–2 lines.
2. **Roles** — the human (Fausto) and each agent, **including which agent you are** (e.g. Claude = planner/reviewer/architect; Gemini = implementer; human = scope/decisions/relay).
3. **Workflow / source of truth** — `design/collaboration-workflow.md` (the method) + the artifacts: `*-plan.md` (spec+DoD), `*-implementation.md` (the **ledger**), `backlog.md`, `logbook.md`.
4. **Which epic/task we're on** *(REQUIRED — always state the active milestone/epic/task)* + what's next.
5. **Where state lives** — resume from the active epic's `*-implementation.md` ledger, **not from chat**.
6. **Op notes** — key/env gotchas, current blockers.

Keep it tight; the ledger holds the detail.
