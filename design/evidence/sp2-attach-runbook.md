# SP2 Real-CLI Attach Runbook

This is the docs-only runbook produced from the clean SP2 attempt on 2026-07-11. It is evidence of the current
hand-assembled ritual, not production tooling.

## Scope Rules

- Do not edit `agentalk-mcp-client`.
- Do not edit global CLI config.
- Do not use `scripts/m17-live-gate-proof.mjs` as evidence.
- Pass the server's current v7 contract hash in the bridge URL:
  `ffa94e93e3182d44924ed28381870c7bd814c908279942022d5925a4865a9446`.

## 1. Start a Fresh Orchestrator

Use explicit ports so stale helper scripts cannot silently target an old server:

```bash
PORT=3310 \
AGENTTALK_MCP_PORT=3311 \
AGENTTALK_RECORDING_PATH=design/evidence/sp2-clean-attempt-20260711.ndjson \
npm run backend
```

The backend process runs from the orchestrator workspace, so a relative recorder path may land under
`apps/orchestrator/`. Move generated evidence back to `design/evidence/` before review if that happens.

## 2. Register and Start Agents

The `creating` -> `start` transition is mandatory. A created MCP agent does not accept the real client as ready until
it has been explicitly started.

```bash
curl -s -X POST http://localhost:3310/api/agents \
  -H 'Content-Type: application/json' \
  -d '{"id":"sp2-clean2-claude","provider":"mcp","requestedExecutionMode":"auto"}'

curl -s -X POST http://localhost:3310/api/agents \
  -H 'Content-Type: application/json' \
  -d '{"id":"sp2-clean2-codex","provider":"mcp","requestedExecutionMode":"auto"}'

curl -s -X POST http://localhost:3310/api/agents \
  -H 'Content-Type: application/json' \
  -d '{"id":"sp2-clean2-worker","provider":"mcp","requestedExecutionMode":"auto"}'

curl -s -X POST http://localhost:3310/api/agents/sp2-clean2-claude/start
curl -s -X POST http://localhost:3310/api/agents/sp2-clean2-codex/start
```

Observed provider value for both real-CLI candidates was transport-shaped: `provider: "mcp"`.

## 3. Codex CLI Config

Codex CLI uses TOML-style override keys, not Claude-style `mcpServers`. The clean in-scope form was:

```bash
/usr/local/bin/codex --no-alt-screen \
  -c 'mcp_servers.agenttalk-bridge.command="node"' \
  -c 'mcp_servers.agenttalk-bridge.args=["/Users/fausto/Software/agentalk-mcp-client/bridge.mjs","ws://localhost:3311/mcp?agentId=sp2-clean2-codex&contractHash=ffa94e93e3182d44924ed28381870c7bd814c908279942022d5925a4865a9446"]' \
  'Connect to the agenttalk-bridge MCP server. First call the await_turn tool from that MCP server to receive AgentTalk instructions. Then follow the AgentTalk turn exactly using the available MCP tools such as consensus_respond and submit_plan. Do not edit files. Do not run shell commands to simulate MCP. Use the MCP tool surface directly.'
```

Result: the server logged a connection for `sp2-clean2-codex` and an MCP `await_turn` call. This proves native Codex
bridge reachability with the base client and the hash in the URL. It does not prove consensus progress.

## 4. Claude Code Config

Claude Code accepted the same base bridge and URL hash through `--mcp-config`:

```bash
/Users/fausto/.local/bin/claude --strict-mcp-config \
  --mcp-config '{"mcpServers":{"agenttalk-bridge":{"command":"node","args":["/Users/fausto/Software/agentalk-mcp-client/bridge.mjs","ws://localhost:3311/mcp?agentId=sp2-clean2-claude&contractHash=ffa94e93e3182d44924ed28381870c7bd814c908279942022d5925a4865a9446"]}}}' \
  --debug-file design/evidence/sp2-clean2-claude-debug.log \
  -p 'Connect to the agenttalk-bridge MCP server. First call the await_turn tool from that MCP server to receive AgentTalk instructions. Then follow the AgentTalk turn exactly using the available MCP tools such as consensus_respond and submit_plan. Do not edit files. Do not run shell commands to simulate MCP. Use the MCP tool surface directly.'
```

Result: Claude connected to the bridge, the base bridge printed that it injected `contractHash` from the URL, and
Claude discovered bridge tools. The run then stopped because `mcp__agenttalk-bridge__await_turn` required permission
in noninteractive mode. That exhausted the two-attempt cap for Claude in SP2.

## 5. Known Blockers

- The base `bridge.mjs` can inject the v7 hash from the URL, so SP2 does not need a client edit for that path.
- The committed client contract remains stale at v5 (`1236003f...`), so harness paths that use client
  `wire-contract.json` rather than a URL hash fail against the v7 AgentTalk server by design.
- Claude Code needs an approved/noninteractive permission path for the AgentTalk MCP tools before it can block on
  `await_turn` unattended.
- TUI capture remains unreliable for proof; use server logs, recorder output, and debug files as primary evidence.
