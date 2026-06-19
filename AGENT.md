This project has reached Milestone 05. From now on follow these rules:
- Preserve all existing behavior by default.
- Any behavior change requires explicit user confirmation first.
- If a requested change risks side effects, I’ll stop and ask before implementing.
- For every edit, I’ll favor minimal, targeted diffs and regression tests to prove no unintended behavior changes.
- When updating tests, I’ll treat them as behavior contracts unless you explicitly approve changing those contracts.

### Milestone 05 Key Features
- **Complete client/orchestrator separation**: the worker is a standalone repo (`agentalk-mcp-client`) with **zero** shared packages with AgentTalk (vendored bridge; deps are only public npm). A byte-identical, versioned + **hashed** wire-contract is checked at the MCP handshake (mismatch → reject 1008), with a commit/CI guard against silent drift. One-way import guard enforced in the client's lint/build.
- **Channel hardening**: client-side reconnect with backoff; **liveness-gated takeover** (probe the existing socket — reject a live peer with 4001 to prevent reconnect wars, take over only a zombie); in-flight-turn **requeue** + effect-fence on drop; **stale `await_turn` waiter cleanup** so the first post-reconnect turn isn't lost; clean vs abnormal close mapping (`terminated` vs `reconnecting`→`error`); CLI failures surfaced via close code 1011.
- **Gemini provider → Antigravity (`agy`)**: the harness runs `agy` (the `gemini` CLI is obsolete); UI model dropdowns default to `gemini-3.1-pro`.
- **Verified live**: codex/claude/gemini(`agy`) each attach + round-trip a turn; reconnect (`kill -9` → restart) recovers and the next turn is delivered; two same-id clients no longer war. Suite **140/140**, build clean.
- **Not yet (deferred → Phase 6)**: multi-agent **consensus** under attach (harness still maps every reply to `send_to_agent`); model not plumbed to the harness (`agy` uses its default); harness doesn't give up on a 4001/terminal rejection. See `design/mcp-implementation-plan.md` (Phase 5) and `phase5-client-extraction-proposal.md` §6.

### Milestone 04 Key Features
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
