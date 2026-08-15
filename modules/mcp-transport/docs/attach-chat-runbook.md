# Runbook — single-agent 1:1 chat in attach mode (web UI ⇄ real `agentalk-mcp-client`)

**What this is.** Step-by-step operator instructions to hold a plain 1:1 chat with **one** agent in the
web UI, where the agent's turns are executed by the **real external** `agentalk-mcp-client` CLI driving a
provider CLI (`claude` / `codex` / `gemini`). No consensus, no teams — just *you ⇄ one agent*. This is the
M05 attach path; the old `attach-harness.mjs` is gone, so this runbook is the canonical reproduction.

**Verified live:** 2026-06-26 (logbook **LB-28**) — provider `claude`, suite/build green.

---

## 0. Prerequisites

- This repo built: `npm run build` (or it builds on `npm run backend`).
- The client repo checked out at `/Users/fausto/Software/agentalk-mcp-client` (its `node_modules` installed,
  incl. the native `node-pty` prebuild).
- A provider CLI on `PATH`. Check: `command -v claude codex agy` (gemini's CLI is `agy`). **Pick one with
  budget** — at time of writing gemini/antigravity is out of weekly budget, so use `claude` or `codex`.
- The **wire-contract hashes must match** between repos (the orchestrator enforces it; a mismatch → the
  client is rejected with WS `1008`). Check they're equal:
  ```bash
  grep '"hash"' packages/contracts/wire-contract.json /Users/fausto/Software/agentalk-mcp-client/wire-contract.json
  ```

## 1. Start the orchestrator (backend) + web UI

Two long-lived processes. Easiest: one terminal each (or `npm run dev` for both).

```bash
npm run backend     # Express API + browser WS on :3000, AND the MCP attach server on a DEDICATED random port
npm run frontend    # vite dev server on :5173 (proxies /api and /ws to :3000)
```

**Grab the MCP port** from the backend log — this is the single most important line:
```
[Server] AgentTalk WebSocket MCP server listening on ws://localhost:<MCP_PORT>/
```
> ⚠️ The MCP server runs on its **own dedicated random port** with path `/` — **NOT** `:3000/mcp`. (Port 3000
> is the Express/browser server; a second WS upgrade route on it is unreliable in `ws`, hence the dedicated
> port — see the WS-collision fix in `server.ts`.) You **must** pass this exact URL to the client in step 3.

Open the UI: **http://localhost:5173**

## 2. Create the agent (UI)

In the left sidebar's agent-creation form:
- **Agent ID**: pick one you'll reuse, e.g. `chat-1`. **This must match the client's `--agentId` exactly.**
- **Provider / model**: in attach mode these are just a **label** on the orchestrator side — they select the
  MCP-delegation completer (`McpCompleter`), they do **not** run anything. The real model is whatever the
  *client* launches in step 3. So any choice is fine (the default is OK).
- Click create. The agent is created **and** activated (`create` + `start` in one).

**Expected status: `ready` (green) — immediately, before the client connects.** This is correct and was a
point of confusion: `ready` means "the agent's turn-loop driver is up and will accept a message", **not**
"it can answer on its own". For a `claude`/`codex`/`gemini`-labelled agent the actual work is delegated to
the external client via `McpCompleter` — so you still must launch the client (step 3), or a sent message
just queues and **times out after 120s**.

## 3. Launch the real client (terminal)

```bash
cd /Users/fausto/Software/agentalk-mcp-client
AGENTTALK_PERSISTENT_MCP_URL=ws://localhost:<MCP_PORT>/ \
  node llm-agent.mjs --provider claude --agentId chat-1
```
- Put `AGENTTALK_PERSISTENT_MCP_URL` **on the same command** (env prefix). If you omit it, the client
  defaults to `ws://localhost:3000/mcp` → hits the Express server → `Unexpected server response: 400`,
  reconnect-loops. (This is the #1 mistake.)
- `--agentId` **must equal** the UI agent ID.
- `<MCP_PORT>` is the dedicated port from step 1's log (changes every orchestrator restart).

**Success looks like:**
```
[McpClient] Connecting to ws://localhost:<MCP_PORT>/?agentId=chat-1   ← the dedicated port, NOT 3000
[McpClient] Connected.
[llm-agent] Waiting for turn...
```
and on the backend:
```
[McpServer] Connection established for agentId=chat-1
[Registry] MCP tool call from chat-1: await_turn {}     ← client is blocking, ready to receive a turn
```

## 4. Chat

In the UI, click the agent (`chat-1`) → the **"Send message…"** box appears at the bottom → type → Enter.

**Round-trip** (backend log):
```
[Server] Sending message to agent chat-1: <your text>
[Registry] Sending EVT ... {"type":"message_received", ...}
[Agent chat-1] ready -> busy
[Registry] MCP tool call from chat-1: submit_exec_result { text: "<the reply>" }
[Server] Agent message from chat-1: "<the reply>" → 1 client(s)   ← back to the browser
[Agent chat-1] busy -> ready
[Registry] MCP tool call from chat-1: await_turn {}              ← ready for the next turn
```
The reply appears in the UI chat. The first turn can take a few seconds (provider CLI startup). The client
stays alive on `await_turn`, so keep chatting freely.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Client: `Unexpected server response: 400`, loops on `:3000/mcp` | `AGENTTALK_PERSISTENT_MCP_URL` not set → default wrong URL | Set the env var to `ws://localhost:<MCP_PORT>/` (dedicated port, path `/`) |
| Client closed with `1008` right after connect | wire-contract hash mismatch between repos | Realign the client's `wire-contract.json` to the orchestrator's (README → "How to Realign") |
| Sent a message, nothing comes back, then a timeout error ~120s later | no client attached for that agentId (or agentId mismatch) | Launch the client with the **matching** `--agentId`; confirm `Connection established` on the backend |
| Reply text has a meta preamble (e.g. *"Let me check my memory…"*) | the **client's** provider output-parser leaking CLI thinking into the response — a `agentalk-mcp-client` concern, **not** AgentTalk | Cosmetic; track in the client repo (separate; we only relay) |
| Agent never reaches `ready` | provider-less / unknown provider | The orchestrator rejects provider-less agents (M08-T4); pick a real provider label in the form |

## Notes

- **Provider label vs real model:** orchestrator-side provider (e.g. the form's default) only picks
  `McpCompleter`; the `exec_rpc` turn carries only `{prompt}`. The client's `--provider` decides the actual
  CLI/model. So a "gemini"-labelled agent answered by a `--provider claude` client is normal and correct.
- **No budget, protocol-only path:** to exercise the transport without spending provider budget, override the
  provider command with a fake bridge via `AGENTTALK_PERSISTENT_COMMAND_JSON` (see
  `scripts/smoke-mcp-exec-server.mjs` and the client's `__tests__/exec-rpc.test.ts`). That is the *exec-server*
  smoke; this runbook is the *real-provider* chat.
