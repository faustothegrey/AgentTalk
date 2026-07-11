# SP2 Clean Attempt Notes — 2026-07-11

These notes preserve terminal excerpts from the clean in-scope attempt that were not fully represented in the
runtime recorder.

## Fresh Orchestrator

Command:

```bash
PORT=3310 AGENTTALK_MCP_PORT=3311 AGENTTALK_RECORDING_PATH=design/evidence/sp2-clean-attempt-20260711.ndjson npm run backend
```

Observed output:

```text
AgentTalk Orchestrator V1 started.
Recording runtime events to design/evidence/sp2-clean-attempt-20260711.ndjson
AgentTalk Web UI Backend listening on http://localhost:3310
AgentTalk WebSocket MCP server listening on ws://localhost:3311/
```

## Codex CLI Attempt 2

Observed server output:

```text
[McpServer] Connection established for agentId=sp2-clean2-codex
[Registry] MCP tool call from sp2-clean2-codex: await_turn {}
```

Observed Codex CLI output after interruption:

```text
Called agenttalk-bridge.await_turn({})
  Error: interrupted
```

Interpretation: Codex CLI reached the native MCP bridge tool surface and called `await_turn`. It did not prove
consensus progress because the real-CLI pair never both became usable.

## Claude Code Attempt 2

Observed server output:

```text
[McpServer] Connection established for agentId=sp2-clean2-claude
[McpServer] Connection closed for agentId=sp2-clean2-claude (code: 1006)
[Registry] MCP connection dropped for agent sp2-clean2-claude (code 1006). Allowing 30s reconnect...
[Agent sp2-clean2-claude] ready -> reconnecting
[Registry] Reconnect timeout expired for agent sp2-clean2-claude (in-flight turn: none) -> terminated
[Agent sp2-clean2-claude] reconnecting -> terminated
```

Observed Claude CLI output:

```text
The `await_turn` call needs your permission to proceed. Please approve it (or the bridge tools generally) and I'll
block on the turn, then follow the AgentTalk instructions using only the MCP tool surface.
```

Debug log anchors in `design/evidence/sp2-clean2-claude-debug.log`:

```text
[mcp-bridge] injected contractHash from URL
MCP server "agenttalk-bridge": Successfully connected
ToolSearchTool: partial select — found: mcp__agenttalk-bridge__await_turn, mcp__agenttalk-bridge__consensus_respond, mcp__agenttalk-bridge__send_to_agent, mcp__agenttalk-bridge__list_agents
mcp__agenttalk-bridge__await_turn tool permission denied
```

Interpretation: Claude Code accepted the bridge config and the base bridge injected the URL hash, but the
noninteractive tool permission path blocked `await_turn`.

## Controls

Hermetic registry/MCP consensus control:

```bash
npx vitest run packages/runtime-core/src/registry/__tests__/team-mcp-consensus.test.ts
```

Result in `design/evidence/sp2-control-hermetic-20260711.txt`:

```text
Test Files  1 passed (1)
Tests  2 passed (2)
```

Live MCP-harness control:

```bash
node scripts/test-live-gate.mjs
```

Result in `design/evidence/sp2-control-clean-20260711.txt`:

```text
Rejecting agentId=planner-a: contract hash mismatch. Expected ffa94e93e3182d44924ed28381870c7bd814c908279942022d5925a4865a9446, got 1236003f9db2a7110879855bbdc66c7aa5b7c19dbab28f2bdcdb463cd1ac9883
TEST ERROR Error: Agent planner-a must be ready before joining a team
```

Interpretation: the hermetic consensus substrate is green; the live harness path is blocked by the sibling client's
stale committed v5 contract hash.
