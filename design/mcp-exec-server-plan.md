# Plan — standalone exec-only MCP attach server (`@agenttalk/mcp-exec-server`)

**Status:** ✅ MERGED to `master` at `b67a6ce` + pushed; live-smoke follow-ups `e3f85c4`/`4fb2a69` also on
`master`. Decisions D1 extract / D2 names / D3 single-flight / D4 hash-unset all as recommended. Gate: tsc 0,
suite 245/245 (239 +6).
**Owed → ✅ DONE (2026-06-26):** live smoke vs a real `agentalk-mcp-client` CLI — `scripts/smoke-mcp-exec-server.mjs`
spawns the actual `llm-agent.mjs` (real McpClient + executor-runtime + node-pty) against a real `McpExecServer`; the
provider is replaced by a fake bridge (`AGENTTALK_PERSISTENT_COMMAND_JSON`) so no budget is spent. PASS ×2; suite
245/245. Only a real-LLM-provider end remains unexercised (gated on budget). Full record: logbook LB-27.
**Author:** Claude (planner/architect), 2026-06-26.
**Type:** new transport package (Option B from the Phase-2 fork). Delivers the consensus-free "third-party app
chats via an MCP CLI executor" path — the piece the llm-client spike flagged as owed.

---

## 1. Goal

Let a third-party app run an LLM turn through an **external MCP executor** (an `agentalk-mcp-client` driving a
`claude`/`codex`/`gemini` CLI) **without any consensus/Registry/teams stack** in its dependency tree. Concretely:
stand up a lean WebSocket attach endpoint that speaks only the **exec subset** of the wire-contract
(`await_turn` + `submit_exec_result`), and expose it as an `ExecTransport` so `McpChatCompleter` (Phase-2-core,
already built) drives it.

```
third-party app
  │  const completer = new McpChatCompleter(execServer.transport(agentId))
  │  await new ChatSession(completer).send("hi")
  ▼
@agenttalk/mcp-exec-server   ← NEW (this plan)
  ├─ McpServer (generic WS/JSON-RPC transport, reused)
  ├─ exec tools = [await_turn, submit_exec_result]   (NO consensus tools)
  ├─ per-agent exec turn-queue (await_turn blocks; submit_exec_result resolves)
  └─ ExecTransport impl over that queue
        ▲ WebSocket (MCP attach)
  agentalk-mcp-client  → claude/codex/gemini CLI
```

## 2. The key finding that shrinks this

`McpServer` (`apps/orchestrator/src/mcp-server.ts`) is **already generic and consensus-free**: a JSON-RPC-over-WS
server parameterised by `tools: McpToolDefinition[]` + `handler: (agentId, name, args) => Promise<any>` +
`onConnect`/`onDisconnect`. The consensus coupling lives entirely in the *injected* `AGENTTALK_MCP_TOOLS` +
`registry.handleMcpToolCall`. It already handles sockets, JSON-RPC framing, ping/liveness, the contract-hash
gate, and stale-session takeover. **We reuse it verbatim** and inject an exec-only tools list + handler.

So the genuinely new code is small: a **turn-queue + exec handler + ExecTransport**, plus a thin `start()`.

## 3. Packaging (the one real structural decision)

`McpServer` currently lives in `apps/orchestrator` — not importable by a new package. Both the orchestrator
(full consensus server) and the new exec server need it. Cleanest DAG: extract the generic class into a tiny
shared leaf package, depended on by both.

```
@agenttalk/mcp-transport   ← NEW leaf: just the generic McpServer (dep: ws)
      ▲                    ▲
      │                    │
@agenttalk/mcp-exec-server   apps/orchestrator
  (exec tools + queue +       (imports McpServer from the package instead of the local file;
   ExecTransport)              one-line import change, behaviour identical)
```

**D1 — extract `McpServer` into `@agenttalk/mcp-transport`?** *Recommend yes* (mirrors the llm-client extraction:
a `git mv` + re-point the orchestrator's single import; the class is already generic, so it's a move, not a
rewrite). Alternative: keep `McpServer` in orchestrator and *duplicate* a copy in the exec-server package — worse
(drift). Touching orchestrator's import is low-risk and additive in spirit, but it IS an edit to a shipped app →
needs your nod (Rule 2 / M06 confirm).

## 4. New package contents (`@agenttalk/mcp-exec-server`)

Deps: `ws`, `@agenttalk/mcp-transport`, `@agenttalk/llm-client` (for the `ExecTransport`/`ExecResult` types).

1. **`EXEC_TOOLS`** — `[await_turn, submit_exec_result]` only (copy the two definitions from `mcp-tools.ts`).
2. **`ExecTurnQueue`** (per agentId) — minimal version of the `Agent` turn-queue:
   - `awaitTurn()` → resolves with the next queued turn, or blocks until one is dispatched;
   - `dispatch(turn)` → hands the turn to a waiting `await_turn` or queues it;
   - `submitResult(result)` → resolves the in-flight turn's pending promise.
   v1 is single-flight per agent (one turn at a time — a chat turn is short); **no** M08 reconnect/re-delivery
   complexity (the socket-layer liveness in `McpServer` already covers dead sockets).
3. **`McpExecServer`** — wires `McpServer` with `EXEC_TOOLS` + a handler that routes `await_turn`/
   `submit_exec_result` to the right agent's `ExecTurnQueue`. `start(port)`, `close()`.
4. **`transport(agentId): ExecTransport`** — adapts a queue to the llm-client plug: `dispatch` → `queue.dispatch`,
   `onResult` → fires when `submit_exec_result` lands for that agent, `onDisconnect` → fires on the server's
   `onDisconnect` for that agent.

## 5. Scope — files

| File | Change |
|---|---|
| `packages/mcp-transport/**` (NEW) | `git mv` `McpServer` here; package.json/tsconfig; export it. |
| `apps/orchestrator/src/server.ts` | re-point `McpServer` import to `@agenttalk/mcp-transport` (1 line). |
| `apps/orchestrator/src/mcp-server.ts` | removed (moved). Any other importers re-pointed. |
| `packages/mcp-exec-server/**` (NEW) | exec tools + `ExecTurnQueue` + `McpExecServer` + `transport()` + tests. |
| `vitest.config.ts`, root/`runtime-core` tsconfig refs, `package.json` workspaces | wire the 2 new packages (incl. the vitest `include` glob + src alias — the lesson from Phase 1). |

**NOT in scope (show-stopper if touched):** the consensus brain, `registry.handleMcpToolCall`, the existing
`AGENTTALK_MCP_TOOLS`, the orchestrator's consensus server behaviour (only its *import path* for `McpServer`
moves). The exec server is a **parallel, independent** server — it does not change the orchestrator's runtime.

## 6. Decisions for Fausto

- **D1** (above) — extract `McpServer` → `@agenttalk/mcp-transport` (recommend yes) vs duplicate.
- **D2** — package name `@agenttalk/mcp-exec-server` ok? transport class name `McpExecServer`?
- **D3** — v1 turn-queue: **minimal single-flight, no reconnect re-delivery** (recommend — keep it small; revisit
  if a real reconnect need appears) vs port the M08 resilience now.
- **D4** — contract-hash gate: the exec server's `expectedContractHash` is **optional** (only checked when set).
  v1 **leave it unset** (any exec client may attach) vs reuse `wireContract.hash`. Recommend unset for v1 +
  document it; the exec subset is a strict subset so a full client still works.

## 7. Verification / DoD

- New packages build standalone; `mcp-exec-server` pulls in **no** runtime-core/consensus (only `ws` +
  `mcp-transport` + `llm-client` types). A consumer can stand up the server + `McpChatCompleter` with zero
  consensus in its tree.
- Unit tests: `ExecTurnQueue` (dispatch-before-await, await-before-dispatch, result resolves, disconnect), the
  `transport()` adapter against `McpChatCompleter` (in-process, no real socket).
- **Live smoke (owed, like every transport here):** a real `agentalk-mcp-client` connects to `McpExecServer`,
  receives one `exec_rpc` via `await_turn`, runs it in a CLI, returns `submit_exec_result`; `McpChatCompleter`
  resolves the text. Gated on a provider/CLI being available; report honestly if budget/CLI blocks it.
- Full existing suite stays green; orchestrator behaviour unchanged (only the `McpServer` import moved).

## 8. Risk

- **Main risk = the `McpServer` extraction touching the orchestrator** (D1). Mitigated: it's a `git mv` + 1-line
  import; the class is already generic; the full suite + a build prove behaviour identical. If anything about the
  orchestrator server changes semantically, STOP (Rule 2).
- The exec server itself is **new and parallel** — it can't regress existing behaviour (nothing depends on it yet).
- Cross-repo: depends on `agentalk-mcp-client` speaking the exec subset (it already does — `await_turn` +
  `submit_exec_result` are in its `wire-contract.json`).

## 9. Effort (rough)

~1–1.5 days: the extraction (small) + the queue/handler/transport (small-medium) + tests + the live smoke. The
big unknown is the live smoke (real CLI executor), not the code.

## 10. Related
- `design/llm-client-architecture.md` §3 (where the WebSocket lives), §8 (what's owed).
- `design/llm-client-extraction-spike.md` §7 (the owed adapter note).
- `apps/orchestrator/src/mcp-server.ts` (the generic server being reused).
- `agentalk-mcp-client/wire-contract.json` (exec subset = `await_turn` + `submit_exec_result`).
